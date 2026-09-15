import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, truncate, rm, symlink, unlink, realpath, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { snapshotWorkspace, validateDependencies, executeChecks } from '../src/core/evidence.mjs';
import { handleCommand, handleUpdate, handleApprove } from '../src/index.mjs';
import { activeRun, identity, loadRun, runPath, locked } from '../src/core/store.mjs';
import { assertWorkspace } from '../src/core/workspace.mjs';

async function fixture(t, large = false) {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'cruise-scope-')));
  t.after(() => rm(root, { recursive: true, force: true }));
  execFileSync('git', ['init', '-q', root]);
  const cwd = path.join(root, 'PI');
  await mkdir(cwd);
  await writeFile(path.join(cwd, 'subject.txt'), 'ok');
  await writeFile(path.join(root, 'sibling'), 'outside');
  if (large) await truncate(path.join(root, 'sibling'), 65 * 1024 * 1024);
  return { root, cwd };
}
const context = (cwd, args, owner = 'test') => ({ cwd, args, agent: { id: owner }, conversation: { id: owner } });
const current = c => activeRun(c.cwd, identity(c));
const contract = () => ({ schema_version: 1, goal: 'Verify scoped subject', intent: 'implement', risk: 'low', requirements: [{ id: 'R1', text: 'Subject is ok', required: true }], non_goals: [], constraints: [], dependencies: ['subject.txt'], checks: [{ id: 'C1', label: 'Read subject in selected cwd', bin: process.execPath, args: ['-e', "if(require('node:fs').readFileSync('subject.txt','utf8')!=='ok')process.exit(1)"], requirement_ids: ['R1'], required: true, timeout_ms: 3000, assertion: { type: 'exit_code' } }] });

test('PI snapshot ignores >64MiB sibling, stays scope-relative and detects edits/deletions', async t => {
  const { root, cwd } = await fixture(t, true);
  const a = await snapshotWorkspace(cwd);
  assert.deepEqual(a.workspace, { version: 1, git_root: root, scope_root: cwd, scope: 'PI' });
  assert.deepEqual(a.files.map(f => f.path), ['subject.txt']);
  await assert.rejects(snapshotWorkspace(root), /64 MiB/);
  await writeFile(path.join(root, 'outside-edit'), 'unrelated');
  assert.equal(a.fingerprint, (await snapshotWorkspace(cwd)).fingerprint);
  execFileSync('git', ['-C', cwd, 'add', 'subject.txt']);
  await writeFile(path.join(cwd, 'subject.txt'), 'changed');
  assert.notEqual(a.fingerprint, (await snapshotWorkspace(cwd)).fingerprint);
  await unlink(path.join(cwd, 'subject.txt'));
  assert.equal((await snapshotWorkspace(cwd)).files[0].type, 'missing');
});

test('scoped traversal, external and ancestor symlinks fail closed', async t => {
  const { root, cwd } = await fixture(t);
  const snap = await snapshotWorkspace(cwd);
  const undeclared = contract(); delete undeclared.dependencies;
  assert.throws(() => validateDependencies(snap, undeclared), /requires explicit dependencies/);
  assert.doesNotThrow(() => validateDependencies(snap, { ...contract(), dependencies: [] }));
  for (const dependency of ['../sibling', path.join(root, 'sibling'), 'x/../../sibling', 'x\\y', './subject.txt', 'missing']) {
    assert.throws(() => validateDependencies(snap, { ...contract(), dependencies: [dependency] }), /dependency|Dependency/);
  }
  await symlink('../sibling', path.join(cwd, 'link'));
  await assert.rejects(snapshotWorkspace(cwd), /Symlink escapes/);
  await unlink(path.join(cwd, 'link'));
  await mkdir(path.join(cwd, 'dir'));
  await writeFile(path.join(cwd, 'dir', 'file'), 'tracked');
  execFileSync('git', ['-C', cwd, 'add', 'dir/file']);
  await rm(path.join(cwd, 'dir'), { recursive: true });
  await mkdir(path.join(root, 'external'));
  await writeFile(path.join(root, 'external', 'file'), 'outside');
  await symlink('../external', path.join(cwd, 'dir'));
  await assert.rejects(snapshotWorkspace(cwd), /escapes workspace/);
});

test('declared ignored/secret/link dependencies cannot be certified; edits invalidate batch', async t => {
  const { cwd } = await fixture(t);
  await writeFile(path.join(cwd, '.gitignore'), 'ignored\n');
  await writeFile(path.join(cwd, 'ignored'), 'ignored');
  await writeFile(path.join(cwd, '.env'), 'secret');
  await symlink('subject.txt', path.join(cwd, 'link'));
  const snap = await snapshotWorkspace(cwd);
  for (const dependency of ['ignored', '.env', 'link']) assert.throws(() => validateDependencies(snap, { ...contract(), dependencies: [dependency] }), /not content-covered/);
  const c = context(cwd, 'Fix subject');
  await handleCommand(c);
  const value = contract();
  value.checks[0].args = ['-e', "require('node:fs').writeFileSync('subject.txt','changed')"];
  await handleUpdate({ ...c, args: { action: 'contract', contract: value } });
  const result = await executeChecks(cwd, current(c));
  assert.equal(result.changedDuringChecks, true);
  assert.equal(result.evidence[0].status, 'unevaluable');
});

test('MOCKED command lifecycle: PI cwd, approval, ownership, dependency rejection and freshness', async t => {
  const { root, cwd } = await fixture(t, true);
  const c = context(cwd, 'Fix subject');
  assert.equal((await handleCommand(c)).type, 'prompt');
  await handleUpdate({ ...c, args: { action: 'contract', contract: contract() } });
  assert.equal(current(c).approval, null);
  await assert.rejects(handleCommand({ ...c, args: 'check' }), /requires approval/);
  await assert.rejects(handleCommand(context(cwd, 'Fix subject', 'other')), /owns/);
  // Repository-wide owner/operation locks cannot be bypassed via a sibling scope.
  const other = path.join(root, 'other'); await mkdir(other);
  await assert.rejects(handleCommand(context(other, 'Review', 'other')), /another scope/);
  await locked(cwd, async () => { await assert.rejects(locked(other, async () => {}), /operation/); });
  const approve = async () => { const run = current(c); await handleApprove({ ...c, args: { action: 'contract', contract: run.contract, contract_hash: run.contract_hash } }); };
  await approve();
  await handleCommand({ ...c, args: 'check' });
  assert.equal(current(c).verdict, 'verified');
  assert.ok(current(c).evidence[0].artifact_path.startsWith('.letta/cruise/runs/'));
  await writeFile(path.join(cwd, 'subject.txt'), 'bad');
  assert.match((await handleCommand({ ...c, args: 'status' })).output, /needs_evidence/);
  await handleUpdate({ ...c, args: { action: 'contract', contract: { ...contract(), dependencies: ['../sibling'] } } });
  assert.equal(current(c).approval, null);
  await approve();
  await assert.rejects(handleCommand({ ...c, args: 'check' }), /Unsafe dependency/);
  assert.notEqual(current(c).verdict, 'verified');
});

test('scope identity rejects copied runs; legacy root identity is not inferred for PI', async t => {
  const { root, cwd } = await fixture(t);
  const c = context(cwd, 'Review subject'); await handleCommand(c);
  const run = current(c);
  assert.throws(() => assertWorkspace(cwd, { baseline: {} }), /identity mismatch/);
  assert.doesNotThrow(() => assertWorkspace(root, { baseline: {} }));
  const other = path.join(root, 'other'); await mkdir(other);
  await writeFile(path.join(other, 'subject.txt'), 'ok');
  assert.notEqual((await snapshotWorkspace(other)).fingerprint, (await snapshotWorkspace(cwd)).fingerprint);
  await assert.rejects(executeChecks(other, { ...run, contract_hash: 'test', contract: contract() }), /identity mismatch/);
  await cp(runPath(cwd, run.run_id), runPath(other, run.run_id), { recursive: true });
  assert.throws(() => loadRun(other, run.run_id), /identity mismatch/);
  const alias = path.join(root, 'alias'); await symlink('PI', alias);
  assert.equal((await snapshotWorkspace(alias)).fingerprint, (await snapshotWorkspace(cwd)).fingerprint);
});
