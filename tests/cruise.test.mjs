import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync, symlinkSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import activate, { handleCommand, handleUpdate, handleApprove } from '../src/index.mjs';
import { activeRun, identity, runPath, locked, workspaceOwner } from '../src/core/store.mjs';
import { classifyRequest } from '../src/workflow.mjs';

function fixture(t) {
  const cwd = mkdtempSync(join(tmpdir(), 'cruise-integration-'));
  execFileSync('git', ['init', '-q', cwd]);
  writeFileSync(join(cwd, '.gitignore'), '.letta/\n');
  writeFileSync(join(cwd, 'subject.txt'), 'bad');
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  return cwd;
}
const ctx = (cwd, args, id = 'a') => ({ cwd, args, agent: { id: `agent-${id}` }, conversation: { id: `conv-${id}` } });
const current = c => activeRun(c.cwd, identity(c));
const contract = () => ({ schema_version: 1, goal: 'Correct the subject content', intent: 'implement', risk: 'low', requirements: [{ id: 'subject', text: 'subject.txt contains ok', required: true }], non_goals: ['No redesign'], constraints: ['No dependencies'], checks: [{ id: 'behavior', label: 'Subject behavior', bin: process.execPath,
  args: ['-e', "if(require('node:fs').readFileSync('subject.txt','utf8')==='ok')console.log('PASS');else process.exit(1)"], requirement_ids: ['subject'], required: true, timeout_ms: 1000, assertion: { type: 'output_includes', value: 'PASS' } }] });
async function begin(c, value = contract()) {
  await handleCommand({ ...c, args: 'Fix the subject content' });
  await handleUpdate({ ...c, args: { action: 'contract', contract: value } });
  return current(c);
}
async function approve(c) {
  const run = current(c);
  return handleApprove({ ...c, args: { action: 'contract', contract_hash: run.contract_hash, contract: run.contract } });
}
function patchRun(c, fn) {
  const run = current(c); fn(run);
  writeFileSync(join(runPath(c.cwd, run.run_id), 'run.json'), JSON.stringify(run));
}

test('registers only cruise and three tools; disposal and activation have no state writes', t => {
  const cwd = fixture(t); const commands = new Map(), tools = new Map();
  const dispose = activate({ capabilities: { commands: true, tools: true }, commands: { register(c) { commands.set(c.id, c); return () => commands.delete(c.id); } }, tools: { register(x) { tools.set(x.name, x); return () => tools.delete(x.name); } } });
  assert.deepEqual([...commands.keys()], ['cruise']);
  assert.equal(tools.size, 3);
  assert.equal(tools.get('cruise_approve').approvalPolicy, 'alwaysAsk');
  assert.equal(existsSync(join(cwd, '.letta')), false);
  dispose(); assert.equal(commands.size, 0); assert.equal(tools.size, 0);
});
test('help and empty status do not create state or prompt a model', async t => {
  const c = ctx(fixture(t), 'help');
  assert.equal((await handleCommand(c)).type, 'output');
  assert.equal((await handleCommand({ ...c, args: 'status' })).type, 'output');
  assert.equal(existsSync(join(c.cwd, '.letta')), false);
});
test('tool-less host does not start an unusable run', async t => {
  let command;
  const c = ctx(fixture(t), 'Fix subject');
  activate({ capabilities: { commands: true }, commands: { register(x) { command = x; return () => {}; } } });
  assert.match((await command.run(c)).output, /requires Mod tools/);
  assert.equal(existsSync(join(c.cwd, '.letta')), false);
});
test('review and negated implementation requests never mint approval', async t => {
  for (const request of ['Fix nothing; only inspect the issue', 'Update the plan only; no code changes', '버튼을 검토해줘. 아직 수정하지 말고']) assert.equal(classifyRequest(request).intent, 'inspect');
  const c = ctx(fixture(t), 'Fix nothing; only inspect the issue');
  await handleCommand(c);
  await handleUpdate({ ...c, args: { action: 'contract', contract: contract() } });
  assert.equal(current(c).approval, null);
  await assert.rejects(() => handleCommand({ ...c, args: 'check' }), /requires approval/);
});
test('inspection finishes as review-ready, never implemented or verified', async t => {
  const c = ctx(fixture(t), 'Review the subject');
  await handleCommand(c);
  await handleUpdate({ ...c, args: { action: 'contract', contract: { schema_version: 1, goal: 'Review subject', intent: 'inspect', risk: 'low', requirements: [], checks: [], non_goals: [], constraints: [] } } });
  assert.equal(current(c).phase, 'planned');
  await handleUpdate({ ...c, args: { action: 'finish', summary: 'Review complete; no edits.' } });
  assert.equal(current(c).phase, 'review_ready'); assert.equal(current(c).verdict, 'review_only');
  assert.equal(readFileSync(join(c.cwd, 'subject.txt'), 'utf8'), 'bad');
});
test('real failing assertion stays resumable, then passes after repair', async t => {
  const c = ctx(fixture(t)); await begin(c); await approve(c);
  await handleCommand({ ...c, args: 'check' });
  assert.equal(current(c).verdict, 'needs_work'); assert.equal(current(c).phase, 'paused');
  assert.equal((await handleCommand({ ...c, args: 'resume' })).type, 'prompt');
  writeFileSync(join(c.cwd, 'subject.txt'), 'ok');
  await handleCommand({ ...c, args: 'check' });
  assert.equal(current(c).verdict, 'verified'); assert.equal(current(c).phase, 'completed');
  assert.equal(workspaceOwner(c.cwd), null);
});
test('subsequent source changes invalidate status and allow completed work to resume', async t => {
  const c = ctx(fixture(t)); await begin(c); await approve(c);
  writeFileSync(join(c.cwd, 'subject.txt'), 'ok'); await handleCommand({ ...c, args: 'check' });
  writeFileSync(join(c.cwd, 'subject.txt'), 'bad again');
  assert.match((await handleCommand({ ...c, args: 'status' })).output, /needs_evidence/);
  assert.equal((await handleCommand({ ...c, args: 'resume' })).type, 'prompt');
  assert.equal(current(c).phase, 'paused');
});
test('follow-up after completion gets parent context but no inherited proof or approval', async t => {
  const c = ctx(fixture(t)); await begin(c); await approve(c);
  writeFileSync(join(c.cwd, 'subject.txt'), 'ok'); await handleCommand({ ...c, args: 'check' });
  const old = current(c);
  const result = await handleCommand({ ...c, args: 'Fix the subject wording' });
  const next = current(c);
  assert.notEqual(next.run_id, old.run_id); assert.equal(next.parent_run_id, old.run_id);
  assert.equal(next.route.kind, 'delta'); assert.deepEqual(next.evidence, []); assert.equal(next.approval, null);
  assert.match(result.content, /No redesign/);
});
test('contract changes invalidate approval and preserve requirements/history', async t => {
  const c = ctx(fixture(t)); await begin(c); await approve(c);
  const next = contract(); next.requirements[0].text = 'Updated explicit behavior';
  await handleUpdate({ ...c, args: { action: 'contract', contract: next } });
  assert.equal(current(c).contract_version, 2); assert.equal(current(c).approval, null);
  assert.equal(current(c).history.at(-1).previous_contract.requirements[0].id, 'subject');
});
test('stale exact-contract approvals and persisted contract modifications cannot execute', async t => {
  const c = ctx(fixture(t)); await begin(c); const old = current(c); await approve(c);
  const next = contract(); next.goal = 'Another goal';
  await assert.rejects(() => handleApprove({ ...c, args: { action: 'contract', contract_hash: old.contract_hash, contract: next } }), /exact current contract/);
  patchRun(c, run => { run.contract.checks[0].args = ['-e', "require('fs').writeFileSync('UNAUTHORIZED','1')"]; });
  await assert.rejects(() => handleCommand({ ...c, args: 'check' }), /persisted contract changed/);
  assert.equal(existsSync(join(c.cwd, 'UNAUTHORIZED')), false);
});
test('state-only tampering cannot turn a captured failure into success', async t => {
  const c = ctx(fixture(t)); await begin(c); await approve(c); await handleCommand({ ...c, args: 'check' });
  patchRun(c, run => { const ev = run.evidence.at(-1); ev.status = 'passed'; ev.assertion_evaluated = true; ev.exit_code = 0; });
  assert.doesNotMatch((await handleCommand({ ...c, args: 'status' })).output, /Verdict: verified/);
});
test('missing artifact cannot remain verified', async t => {
  const c = ctx(fixture(t)); await begin(c); await approve(c);
  writeFileSync(join(c.cwd, 'subject.txt'), 'ok'); await handleCommand({ ...c, args: 'check' });
  rmSync(join(c.cwd, current(c).evidence[0].artifact_path));
  assert.doesNotMatch((await handleCommand({ ...c, args: 'status' })).output, /Verdict: verified/);
});
test('another conversation cannot mutate a run, including after explicit takeover', async t => {
  const cwd = fixture(t), a = ctx(cwd), b = ctx(cwd, '', 'b'); await begin(a);
  await assert.rejects(() => handleCommand({ ...b, args: 'Fix subject' }), /Another conversation/);
  const id = current(a).run_id;
  await handleApprove({ ...b, args: { action: 'takeover', run_id: id } });
  const request = current(b).request;
  await assert.rejects(() => handleCommand({ ...a, args: 'Fix other thing' }), /transferred/);
  await assert.rejects(() => handleCommand({ ...a, args: 'status' }), /transferred/);
  assert.equal(current(b).request, request);
});
test('operation lock rejects overlapping operations', async t => {
  const c = ctx(fixture(t)); await begin(c);
  await locked(c.cwd, async () => assert.rejects(() => handleCommand({ ...c, args: 'resume' }), /operation is running/));
});
test('report replacement does not follow dangling links outside the workspace', async t => {
  const c = ctx(fixture(t)); await begin(c); await approve(c);
  const external = mkdtempSync(join(tmpdir(), 'cruise-external-')); t.after(() => rmSync(external, { recursive: true, force: true }));
  const target = join(external, 'must-not-exist');
  const report = join(runPath(c.cwd, current(c).run_id), 'report.md'); symlinkSync(target, report);
  await handleUpdate({ ...c, args: { action: 'finish' } });
  assert.equal(existsSync(target), false); assert.match(readFileSync(report, 'utf8'), /Cruise report/);
});
test('blockers cannot disappear silently; inspection blockers prevent completion', async t => {
  const c = ctx(fixture(t), 'Review subject'); await handleCommand(c);
  await handleUpdate({ ...c, args: { action: 'contract', contract: { schema_version: 1, goal: 'Review', intent: 'inspect', risk: 'low', requirements: [], checks: [], non_goals: [], constraints: [] } } });
  await handleUpdate({ ...c, args: { action: 'checkpoint', phase: 'awaiting_input', summary: 'Need direction', blockers: [{ id: 'decision', reason: 'Owner decision needed', status: 'open' }] } });
  await assert.rejects(() => handleUpdate({ ...c, args: { action: 'checkpoint', phase: 'paused', summary: 'Skip', blockers: [] } }), /Do not drop/);
  await handleUpdate({ ...c, args: { action: 'finish' } }); assert.equal(current(c).verdict, 'blocked');
});
test('explicit handoff preserves IDs, leaves original unchanged and requires new checks/approval', async t => {
  const c = ctx(fixture(t)); await handleCommand({ ...c, args: 'Review handoff' });
  const handoff = { readiness: 'prototype_ready', brief: { title: 'Prototype' }, acceptance_criteria: [{ id: 'ux-ac-01', text: 'Show state' }], non_goals: ['No real data'], constraints: [], open_questions: [] };
  const file = join(c.cwd, 'handoff.json'); writeFileSync(file, JSON.stringify(handoff));
  const before = readFileSync(file, 'utf8');
  await handleUpdate({ ...c, args: { action: 'import_handoff', handoff_path: 'handoff.json' } });
  assert.equal(current(c).contract.requirements[0].id, 'ux-ac-01'); assert.equal(current(c).approval, null);
  assert.equal(readFileSync(file, 'utf8'), before);
});
test('legacy stores remain untouched', async t => {
  const c = ctx(fixture(t)); mkdirSync(join(c.cwd, '.letta/cruise-code'), { recursive: true });
  const legacy = join(c.cwd, '.letta/cruise-code/run.json'); writeFileSync(legacy, '{"verdict":"verified"}');
  await begin(c); assert.equal(readFileSync(legacy, 'utf8'), '{"verdict":"verified"}'); assert.deepEqual(current(c).evidence, []);
});

test('an implementation cannot define only optional criteria and certify zero work', async t => {
  const c = ctx(fixture(t)); await handleCommand({ ...c, args: 'Fix subject' });
  const value = contract(); value.requirements[0].required = false; value.checks = [];
  await assert.rejects(() => handleUpdate({ ...c, args: { action: 'contract', contract: value } }), /required requirement/);
  assert.equal(current(c).contract, null);
});

test('initial implementation always needs a human contract gate, not just a routing hint', async t => {
  const c = ctx(fixture(t)); await begin(c);
  assert.equal(current(c).route.intent, 'implement');
  assert.equal(current(c).approval, null);
  await assert.rejects(() => handleCommand({ ...c, args: 'check' }), /requires approval/);
  await approve(c);
  const original = current(c).approval;
  await handleUpdate({ ...c, args: { action: 'contract', contract: contract() } });
  assert.deepEqual(current(c).approval, original);
});

test('a new unrelated discovery request does not inherit the previous product scope', async t => {
  const c = ctx(fixture(t)); await handleCommand({ ...c, args: 'Review old product' });
  await handleUpdate({ ...c, args: { action: 'contract', contract: { schema_version: 1, goal: 'Old product', intent: 'inspect', risk: 'low', requirements: [], checks: [], non_goals: [], constraints: [] } } });
  await handleUpdate({ ...c, args: { action: 'finish' } });
  await handleCommand({ ...c, args: 'Research a new unrelated idea' });
  assert.equal(current(c).parent_run_id, null); assert.equal(current(c).inherited, null);
});
