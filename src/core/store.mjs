import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, lstatSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { workspaceIdentity, assertWorkspace } from './workspace.mjs';

export const idPattern = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/;
export function identity(ctx) {
  const conversation_id = ctx.conversation?.id;
  const agent_id = ctx.agent?.id;
  if (!conversation_id || !agent_id) throw new Error('Cruise needs an identified agent and conversation.');
  return { conversation_id, agent_id };
}
export function sameOwner(a, b) { return a?.conversation_id === b?.conversation_id && a?.agent_id === b?.agent_id; }
function checkId(id) { if (typeof id !== 'string' || !idPattern.test(id)) throw new Error('Invalid Cruise run ID.'); return id; }
export function root(cwd) {
  const base = workspaceIdentity(cwd).scope_root;
  let current = base;
  for (const part of ['.letta', 'cruise']) {
    current = join(current, part);
    if (lstatSync(current, { throwIfNoEntry: false })?.isSymbolicLink()) throw new Error('Cruise state directories must not be symbolic links.');
  }
  return current;
}
export function runPath(cwd, id) {
  const base = root(cwd);
  for (const part of ['runs', checkId(id)]) {
    const path = part === 'runs' ? join(base, part) : join(base, 'runs', part);
    if (lstatSync(path, { throwIfNoEntry: false })?.isSymbolicLink()) throw new Error('Cruise run directories must not be symbolic links.');
  }
  return join(base, 'runs', id);
}
function read(path) {
  if (!existsSync(path)) return null;
  if (lstatSync(path).isSymbolicLink()) throw new Error('Cruise state files must not be symbolic links.');
  try { return JSON.parse(readFileSync(path, 'utf8')); }
  catch { throw new Error(`Cannot read Cruise state: ${path}. Preserve it for recovery; it was not overwritten.`); }
}
function write(path, data) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  if (existsSync(path) && lstatSync(path).isSymbolicLink()) throw new Error('Cruise state files must not be symbolic links.');
  const temp = `${path}.${randomUUID()}.tmp`;
  writeFileSync(temp, JSON.stringify(data, null, 2) + '\n', { mode: 0o600 });
  renameSync(temp, path);
}
const ownerKey = owner => createHash('sha256').update(JSON.stringify(owner)).digest('hex').slice(0, 24);
export function activeRun(cwd, owner) {
  const active = read(join(root(cwd), `active-${ownerKey(owner)}.json`));
  const run = active ? loadRun(cwd, active.run_id) : null;
  if (run && !sameOwner(run.owner, owner)) throw new Error('This run was transferred to another conversation. Its former owner cannot resume or modify it.');
  return run;
}
export function loadRun(cwd, id) {
  const run = read(join(runPath(cwd, id), 'run.json'));
  if (run && (run.schema_version !== 1 || run.run_id !== id || !Array.isArray(run.evidence) || !run.owner)) throw new Error('Unsupported or invalid Cruise state. No automatic migration was attempted.');
  if (run) assertWorkspace(cwd, run);
  return run;
}
export function saveRun(cwd, run) {
  assertWorkspace(cwd, run);
  run.updated_at = new Date().toISOString();
  write(join(runPath(cwd, run.run_id), 'run.json'), run);
  write(join(root(cwd), `active-${ownerKey(run.owner)}.json`), { run_id: run.run_id });
}
const coordinationRoot = cwd => root(workspaceIdentity(cwd).git_root);
export function workspaceOwner(cwd) {
  const owner = read(join(coordinationRoot(cwd), 'owner.json'));
  if (owner && (owner.scope_root ?? workspaceIdentity(cwd).git_root) !== workspaceIdentity(cwd).scope_root) throw new Error('An unfinished Cruise run owns this Git worktree in another scope. Resume or explicitly take over from its original cwd.');
  return owner;
}
export function claim(cwd, run, takeover = false) {
  const owner = workspaceOwner(cwd);
  if (owner && !sameOwner(owner, run.owner) && !takeover) throw new Error('Another conversation owns an unfinished Cruise run here. Continue there, or explicitly approve a takeover with cruise_approve.');
  assertWorkspace(cwd, run);
  write(join(coordinationRoot(cwd), 'owner.json'), { ...run.owner, run_id: run.run_id, scope_root: workspaceIdentity(cwd).scope_root });
}
export function release(cwd, run) {
  const owner = workspaceOwner(cwd);
  if (owner?.run_id === run.run_id && sameOwner(owner, run.owner)) unlinkSync(join(coordinationRoot(cwd), 'owner.json'));
}
export async function locked(cwd, action) {
  const base = coordinationRoot(cwd);
  mkdirSync(base, { recursive: true, mode: 0o700 });
  const lock = join(base, 'operation.lock');
  try { writeFileSync(lock, JSON.stringify({ pid: process.pid, created_at: new Date().toISOString() }), { flag: 'wx', mode: 0o600 }); }
  catch (error) {
    if (error.code === 'EEXIST') throw new Error('A Cruise operation is running, or left a lock after a crash. Do not remove the lock until its recorded process is confirmed stopped.');
    throw error;
  }
  try { return await action(); } finally { unlinkSync(lock); }
}
export function record(run, event, detail = {}) {
  run.history ||= [];
  run.history.push({ at: new Date().toISOString(), event, ...detail });
}
export function newRun(request, route, owner, baseline, parent = null) {
  return {
    schema_version: 1, run_id: randomUUID(), owner, request, route,
    request_revision: 1, contract_request_revision: 0,
    parent_run_id: parent?.run_id ?? null,
    inherited: parent?.contract ? { contract: parent.contract, contract_hash: parent.contract_hash, source_run_id: parent.run_id } : null,
    workspace: baseline.workspace, baseline, contract: null, contract_hash: null, contract_version: 0,
    approval: null, blockers: [], evidence: [], history: [],
    phase: 'planned', verdict: 'needs_evidence', summary: '',
    created_at: new Date().toISOString(),
  };
}
