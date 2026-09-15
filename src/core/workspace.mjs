import { realpathSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import path from 'node:path';

/** cwd selects the evidence/store/check scope, not necessarily the Git root. */
export function workspaceIdentity(cwd) {
  const scope_root = realpathSync(cwd);
  if (scope_root === realpathSync(homedir())) throw new Error('Home directory is not an eligible workspace');
  const env = { ...process.env, GIT_OPTIONAL_LOCKS: '0' };
  for (const key of Object.keys(env)) if (key.startsWith('GIT_') && key !== 'GIT_OPTIONAL_LOCKS') delete env[key];
  const git_root = realpathSync(execFileSync('git', ['-C', scope_root, 'rev-parse', '--show-toplevel'], { env, encoding: 'utf8', timeout: 10000 }).trimEnd());
  const scope = path.relative(git_root, scope_root).split(path.sep).join('/') || '.';
  if (scope === '..' || scope.startsWith('../') || path.isAbsolute(scope) || scope.split('/').some(part => ['.git', '.letta'].includes(part))) throw new Error('Unsafe workspace scope');
  return { version: 1, git_root, scope_root, scope };
}

export function assertWorkspace(cwd, run) {
  const current = workspaceIdentity(cwd);
  const saved = run.workspace ?? run.baseline?.workspace;
  // Legacy root runs stay readable, but fingerprints must be recaptured. Never
  // infer a subdirectory identity for unversioned/copied state.
  if (saved ? JSON.stringify(saved) !== JSON.stringify(current) : current.scope !== '.') {
    throw new Error('Cruise workspace identity mismatch; preserve state and start a new run in the selected scope.');
  }
  return current;
}
