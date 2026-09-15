import { createHash } from 'node:crypto';
import { readFileSync, existsSync, realpathSync } from 'node:fs';
import { join, resolve, relative, isAbsolute } from 'node:path';
import { activeRun, loadRun, saveRun, newRun, identity, sameOwner, claim, release, locked, record, workspaceOwner, runPath, idPattern } from './core/store.mjs';
import { validateContract, reviseContract, evaluateRun, contractHash } from './core/contracts.mjs';
import { snapshotWorkspace, executeChecks } from './core/evidence.mjs';
import { renderStatus, writeReport } from './core/report.mjs';
import { classifyRequest, workflowPrompt, help } from './workflow.mjs';

const output = text => ({ type: 'output', output: text });
const prompt = run => ({ type: 'prompt', content: workflowPrompt(run), systemReminder: true });
const terminal = run => ['completed', 'review_ready'].includes(run.phase);
const digest = path => createHash('sha256').update(readFileSync(path)).digest('hex');

function ownedRun(ctx) {
  const owner = identity(ctx);
  const run = activeRun(ctx.cwd, owner);
  if (!run) throw new Error('No active Cruise run. Start with /cruise <request>.');
  if (!sameOwner(run.owner, owner)) throw new Error('This run belongs to another conversation.');
  const lock = workspaceOwner(ctx.cwd);
  if (lock && !sameOwner(lock, owner)) throw new Error('Another conversation owns this workspace.');
  return run;
}
function checkedArtifacts(cwd, run) {
  const evidenceRoot = join(runPath(cwd, run.run_id), 'evidence');
  return run.evidence.map(entry => {
    try {
      const file = resolve(cwd, entry.artifact_path);
      const rel = relative(evidenceRoot, realpathSync(file));
      if (rel.startsWith('..') || isAbsolute(rel) || !entry.artifact_hash || digest(file) !== entry.artifact_hash) return { ...entry, status: 'unevaluable', assertion_evaluated: false };
      const text = readFileSync(file, 'utf8');
      const firstNewline = text.indexOf('\n');
      const boundary = text.indexOf('\nBatch changed:', firstNewline);
      const captured = JSON.parse(text.slice(firstNewline + 1, boundary));
      for (const key of ['id', 'check_id', 'requirement_ids', 'contract_hash', 'fingerprint', 'status', 'assertion_evaluated', 'artifact_path', 'exit_code']) {
        if (JSON.stringify(captured[key]) !== JSON.stringify(entry[key])) return { ...entry, status: 'unevaluable', assertion_evaluated: false };
      }
      return entry;
    } catch { return { ...entry, status: 'unevaluable', assertion_evaluated: false }; }
  });
}
async function assess(cwd, run, snapshot = null) {
  if (!run.contract) return { phase: run.phase, verdict: 'needs_evidence', coverage: [], reasons: ['No concrete contract has been recorded.'] };
  if (run.contract_request_revision !== run.request_revision) return { phase: 'planned', verdict: 'needs_evidence', coverage: [], reasons: ['Reconcile the contract with the latest request before continuing.'] };
  const current = snapshot ?? await snapshotWorkspace(cwd);
  return evaluateRun({ ...run, evidence: checkedArtifacts(cwd, run) }, current.fingerprint);
}
function applyEvaluation(run, evaluation) {
  run.phase = evaluation.phase;
  run.verdict = evaluation.verdict;
  return run;
}
function validateBlockers(blockers) {
  if (!Array.isArray(blockers)) throw new Error('blockers must be an array');
  const seen = new Set();
  return blockers.map(b => {
    if (!b || !idPattern.test(b.id ?? '') || typeof b.reason !== 'string' || !b.reason.trim() || !['open', 'resolved'].includes(b.status) || seen.has(b.id)) throw new Error('Invalid or duplicate blocker.');
    seen.add(b.id);
    return { id: b.id, reason: b.reason, status: b.status };
  });
}
function assertApproved(run) {
  if (!run.contract || run.contract_request_revision !== run.request_revision) throw new Error('Record a contract for the current request first.');
  if (contractHash(run.contract) !== run.contract_hash) throw new Error('The persisted contract changed outside the revision workflow. Approval is invalid.');
  if (run.contract.intent !== 'implement') throw new Error('This is an inspection-only run. Execution requires an implementation contract and human approval.');
  if (run.approval?.contract_hash !== run.contract_hash || (run.contract.risk === 'high' && run.approval.source !== 'human')) throw new Error('The current contract requires approval before verification commands may run.');
  if (run.blockers.some(b => b.status !== 'resolved')) throw new Error('Resolve or explicitly disposition blockers before executing checks.');
}
async function verify(ctx) {
  await snapshotWorkspace(ctx.cwd);
  return locked(ctx.cwd, async () => {
    let run = ownedRun(ctx);
    assertApproved(run);
    claim(ctx.cwd, run);
    const before = { phase: run.phase, verdict: run.verdict };
    run.phase = 'checking';
    saveRun(ctx.cwd, run);
    try {
      const results = await executeChecks(ctx.cwd, run, { signal: ctx.signal });
      for (const entry of results.evidence) {
        entry.artifact_hash = digest(resolve(ctx.cwd, entry.artifact_path));
        run.evidence.push(entry);
      }
      const evaluation = await assess(ctx.cwd, run, results.snapshot);
      if (results.changedDuringChecks) {
        evaluation.phase = 'paused'; evaluation.verdict = 'needs_evidence';
        evaluation.reasons.push('Workspace changed during verification. Rerun against the final state.');
      }
      applyEvaluation(run, evaluation);
      record(run, 'checks_completed', { from: before, verdict: run.verdict });
      saveRun(ctx.cwd, run);
      const report = writeReport(ctx.cwd, run, evaluation);
      if (terminal(run)) release(ctx.cwd, run);
      return `${renderStatus(run, evaluation)}\nReport: ${report}`;
    } catch (error) {
      run.phase = 'paused'; run.verdict = 'needs_evidence';
      record(run, 'verification_interrupted', { reason: error.message });
      saveRun(ctx.cwd, run);
      throw error;
    }
  });
}

export async function handleCommand(ctx) {
  let text = String(ctx.args ?? '').trim();
  if (/^(?:지난|이전)\s*작업을?\s*이어서\s*진행해(?:줘|주세요)[.!]?$/u.test(text)) text = 'resume';
  if (/^현재\s*변경\s*사항만\s*검증해(?:줘|주세요)[.!]?$/u.test(text)) text = 'check';
  if (!text || ['help', '-h', '--help'].includes(text)) return output(help);
  if (text === 'status') {
    const run = activeRun(ctx.cwd, identity(ctx));
    return output(renderStatus(run, run ? await assess(ctx.cwd, run) : null));
  }
  if (text === 'check') return output(await verify(ctx));
  const baseline = await snapshotWorkspace(ctx.cwd);
  return locked(ctx.cwd, async () => {
    if (text === 'resume') {
      const run = ownedRun(ctx);
      const evaluation = await assess(ctx.cwd, run, baseline);
      if (evaluation.verdict === 'verified' || (run.phase === 'review_ready' && evaluation.verdict === 'review_only')) return output(renderStatus(run, evaluation));
      claim(ctx.cwd, run);
      // Do not turn a failed/incomplete run into completed merely because its turn ended.
      applyEvaluation(run, evaluation);
      record(run, 'resumed');
      saveRun(ctx.cwd, run);
      return prompt(run);
    }
    const owner = identity(ctx);
    const previous = activeRun(ctx.cwd, owner);
    const route = classifyRequest(text);
    let run;
    if (previous && !terminal(previous)) {
      run = previous;
      claim(ctx.cwd, run);
      record(run, 'request_revised', { previous_request: run.request, previous_revision: run.request_revision });
      run.request = text; run.route = route; run.request_revision += 1;
      run.approval = null; run.phase = 'planned'; run.verdict = 'needs_evidence';
    } else {
      run = newRun(text, route, owner, baseline, route.kind === 'delta' ? previous : null);
      claim(ctx.cwd, run);
      record(run, 'created', { parent_run_id: run.parent_run_id });
    }
    saveRun(ctx.cwd, run);
    return prompt(run);
  });
}

function externalContract(cwd, path) {
  if (typeof path !== 'string' || !path) throw new Error('handoff_path is required');
  const full = realpathSync(resolve(cwd, path));
  const rel = relative(realpathSync(cwd), full);
  if (rel.startsWith('..') || isAbsolute(rel)) throw new Error('Explicit handoff imports must be inside this project.');
  const source = readFileSync(full, 'utf8');
  if (source.length > 512000) throw new Error('Handoff exceeds the 512KB limit.');
  const data = JSON.parse(source);
  if (data.schema_version === 1 && data.requirements) return { contract: validateContract(data), source: rel, hash: digest(full) };
  if (!['implementation_ready', 'prototype_ready'].includes(data.readiness) || !data.brief || !Array.isArray(data.acceptance_criteria) || !data.acceptance_criteria.length || !Array.isArray(data.open_questions) || !Array.isArray(data.constraints) || !Array.isArray(data.non_goals)) throw new Error('Invalid legacy handoff. No direct-task fallback was used.');
  if (data.open_questions.some(q => !q || typeof q.blocking !== 'boolean' || typeof q.question !== 'string' || q.blocking)) throw new Error('Legacy handoff contains unresolved or malformed questions.');
  const contract = validateContract({
    schema_version: 1, goal: data.brief.title || data.brief.approved_direction,
    intent: 'implement', risk: 'high',
    requirements: data.acceptance_criteria.map(c => ({ id: c.id, text: c.text, required: c.priority !== 'optional' })),
    non_goals: data.non_goals, constraints: data.constraints, checks: [],
  });
  return { contract, source: rel, hash: digest(full) };
}

export async function handleUpdate(ctx) {
  await snapshotWorkspace(ctx.cwd);
  return locked(ctx.cwd, async () => {
    const args = ctx.args;
    let run = ownedRun(ctx);
    if (args.action === 'contract' || args.action === 'import_handoff') {
      const imported = args.action === 'import_handoff' ? externalContract(ctx.cwd, args.handoff_path) : null;
      const previous = run.contract;
      const before = run.contract_hash;
      run = reviseContract(run, imported?.contract ?? args.contract);
      if (before !== run.contract_hash) record(run, 'contract_revised', { previous_contract: previous, previous_hash: before, version: run.contract_version });
      run.contract_request_revision = run.request_revision;
      if (imported) {
        run.imported = imported; run.approval = null;
      }
      // Routing is not permission. This alpha asks once for the exact implementation
      // contract, then reuses that approval until a request/contract change invalidates it.
      run.phase = run.contract.intent === 'inspect' ? 'planned' : run.approval ? 'implementing' : 'awaiting_approval';
    } else if (args.action === 'checkpoint') {
      if (!['planned', 'awaiting_input', 'paused', 'implementing'].includes(args.phase)) throw new Error('Invalid checkpoint phase. Completion is evaluated, not caller-assigned.');
      if (args.phase === 'implementing') assertApproved(run);
      if (typeof args.summary !== 'string' || !args.summary.trim() || args.summary.length > 6000) throw new Error('A checkpoint needs a concise summary (max 6000 characters).');
      if (args.blockers !== undefined) {
        const blockers = validateBlockers(args.blockers);
        if (run.blockers.some(old => !blockers.some(b => b.id === old.id))) throw new Error('Do not drop recorded blockers; mark resolved and explain the disposition.');
        record(run, 'blockers_updated', { previous: run.blockers, next: blockers });
        run.blockers = blockers;
      }
      run.phase = args.phase; run.summary = args.summary;
      record(run, 'checkpoint', { phase: run.phase, summary: run.summary });
    } else if (args.action === 'finish') {
      if (!run.contract) throw new Error('Record a contract before finishing.');
      if (args.summary !== undefined) {
        if (typeof args.summary !== 'string' || args.summary.length > 6000) throw new Error('Invalid summary.');
        run.summary = args.summary;
      }
      applyEvaluation(run, await assess(ctx.cwd, run));
      record(run, 'finish_evaluated', { verdict: run.verdict });
    } else throw new Error('Unknown Cruise action.');
    claim(ctx.cwd, run);
    saveRun(ctx.cwd, run);
    const evaluation = await assess(ctx.cwd, run);
    if (args.action === 'finish') {
      writeReport(ctx.cwd, run, evaluation);
      if (terminal(run)) release(ctx.cwd, run);
    }
    const details = ['contract', 'import_handoff'].includes(args.action)
      ? `\nContract hash: ${run.contract_hash}\nCurrent contract:\n${JSON.stringify(run.contract, null, 2)}` : '';
    return renderStatus(run, evaluation) + details;
  });
}

export async function handleApprove(ctx) {
  await snapshotWorkspace(ctx.cwd);
  return locked(ctx.cwd, async () => {
    if (ctx.args.action === 'takeover') {
      const lock = workspaceOwner(ctx.cwd);
      if (!lock || lock.run_id !== ctx.args.run_id) throw new Error('The requested run does not own this workspace.');
      const run = loadRun(ctx.cwd, lock.run_id);
      if (!run) throw new Error('The original run is missing; preserve state for recovery.');
      record(run, 'ownership_transferred', { previous_owner: run.owner, next_owner: identity(ctx) });
      run.owner = identity(ctx); run.phase = 'paused';
      claim(ctx.cwd, run, true); saveRun(ctx.cwd, run);
      return 'Ownership transferred after explicit approval. Resume the saved run; no old evidence was refreshed.';
    }
    if (ctx.args.action !== 'contract') throw new Error('Unknown approval action.');
    const run = ownedRun(ctx);
    if (!run.contract || run.contract_hash !== ctx.args.contract_hash || contractHash(ctx.args.contract) !== run.contract_hash) throw new Error('Approval must show the exact current contract, including checks. It changed or is missing.');
    if (run.contract_request_revision !== run.request_revision) throw new Error('Reconcile the latest request before approval.');
    run.approval = { source: 'human', contract_hash: run.contract_hash, at: new Date().toISOString() };
    run.phase = run.contract.intent === 'implement' ? 'implementing' : 'planned';
    record(run, 'contract_approved', { contract_hash: run.contract_hash });
    claim(ctx.cwd, run); saveRun(ctx.cwd, run);
    return 'Current contract approved. This does not authorize commits, pushes, deployment, or changes outside the approved scope.';
  });
}

const strings = { type: 'array', items: { type: 'string' } };
const contractSchema = {
  type: 'object', additionalProperties: false,
  description: 'Concrete Cruise contract. Checks must actually prove the requirements they reference; typechecking alone does not prove behavior.',
  properties: {
    schema_version: { type: 'integer', enum: [1] }, goal: { type: 'string' },
    intent: { type: 'string', enum: ['inspect', 'implement'] }, risk: { type: 'string', enum: ['low', 'high'] },
    requirements: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { id: { type: 'string' }, text: { type: 'string' }, required: { type: 'boolean' } }, required: ['id', 'text', 'required'] } },
    non_goals: strings, constraints: strings,
    checks: { type: 'array', maxItems: 20, items: { type: 'object', additionalProperties: false, properties: {
      id: { type: 'string' }, label: { type: 'string' }, bin: { type: 'string' }, args: strings,
      requirement_ids: strings, required: { type: 'boolean' }, timeout_ms: { type: 'integer', minimum: 1, maximum: 300000 },
      assertion: { type: 'object', additionalProperties: false, properties: { type: { type: 'string', enum: ['exit_code', 'output_includes'] }, value: { type: 'string', description: 'Required only for output_includes; omit for exit_code (zero).' } }, required: ['type'] },
    }, required: ['id', 'label', 'bin', 'args', 'requirement_ids', 'required', 'timeout_ms', 'assertion'] } },
  }, required: ['schema_version', 'goal', 'intent', 'risk', 'requirements', 'non_goals', 'constraints', 'checks'],
};
const safe = fn => async ctx => { try { return await fn(ctx); } catch (error) { return `Cruise: ${error.message}`; } };
export default function activate(letta) {
  const disposers = [];
  const toolsAvailable = !!letta.capabilities?.tools;
  if (letta.capabilities?.commands) {
    disposers.push(letta.commands.register({ id: 'cruise', description: 'One entry for UX discovery, bounded implementation and partial changes', args: '<request>|status|resume|check|help', async run(ctx) {
      const text = String(ctx.args ?? '').trim();
      if (!toolsAvailable && !['', 'help', '-h', '--help', 'status'].includes(text)) return output('Cruise execution requires Mod tools on this host. Only help/status are available; no run was started.');
      try { return await handleCommand(ctx); } catch (error) { return output(`Cruise: ${error.message}`); }
    } }));
  }
  if (toolsAvailable) {
    disposers.push(letta.tools.register({ name: 'cruise_update', description: 'During an explicitly started Cruise run, record the contract, save a checkpoint, import an explicit handoff, or finish based on captured evidence. Never sets approval or verified directly.', requiresApproval: true, parallelSafe: false, parameters: { type: 'object', properties: {
      action: { type: 'string', enum: ['contract', 'checkpoint', 'finish', 'import_handoff'] }, contract: contractSchema,
      phase: { type: 'string', enum: ['planned', 'awaiting_input', 'paused', 'implementing'] }, summary: { type: 'string', maxLength: 6000 },
      blockers: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, reason: { type: 'string' }, status: { type: 'string', enum: ['open', 'resolved'] } }, required: ['id', 'reason', 'status'], additionalProperties: false } }, handoff_path: { type: 'string' },
    }, required: ['action'], additionalProperties: false }, run: safe(handleUpdate) }));
    disposers.push(letta.tools.register({ name: 'cruise_approve', description: 'Human approval gate for the exact Cruise contract or explicit takeover of an unfinished run. Present the complete contract in arguments; never self-approve or infer approval from a review request.', approvalPolicy: 'alwaysAsk', parallelSafe: false, parameters: { type: 'object', properties: { action: { type: 'string', enum: ['contract', 'takeover'] }, contract_hash: { type: 'string' }, contract: contractSchema, run_id: { type: 'string' } }, required: ['action'], additionalProperties: false }, run: safe(handleApprove) }));
    disposers.push(letta.tools.register({ name: 'cruise_verify', description: 'Run the approved Cruise contract checks, capture command evidence, evaluate each requirement and generate the report. Failures remain resumable. No implementation, commits or automatic repair loop.', requiresApproval: true, parallelSafe: false, parameters: { type: 'object', properties: {}, additionalProperties: false }, run: safe(verify) }));
  }
  // Deliberately no turn_end finalization: a clarification, cancellation or crash is not completion.
  return () => { for (const dispose of disposers.reverse()) dispose(); };
}
