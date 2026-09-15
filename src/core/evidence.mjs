import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, realpath, readlink, open, mkdir, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const MAX_BYTES = 64 * 1024 * 1024;
const MAX_OUTPUT = 1024 * 1024;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const digest = value => createHash('sha256').update(value).digest('hex');
const inside = (root, target) => target === root || target.startsWith(root + path.sep);
const excluded = name => name.split('/').some(part => part === '.git' || part === '.letta');
const secret = name => name.split('/').some(part => /^(?:\.env.*|\.ssh|\.aws|\.gnupg|.*credentials.*|.*secrets?.*|id_(?:rsa|dsa|ecdsa|ed25519)(?:\..*)?|.*\.(?:pem|key|p12|pfx|keystore)|\.npmrc|\.netrc)$/i.test(part));
const metadata = stat => ['dev', 'ino', 'mode', 'size', 'mtimeNs', 'ctimeNs'].map(key => String(stat[key]));

async function git(cwd, args, allowMissing = false) {
  const env = { ...process.env, GIT_OPTIONAL_LOCKS: '0' };
  for (const key of Object.keys(env)) if (key.startsWith('GIT_') && key !== 'GIT_OPTIONAL_LOCKS') delete env[key];
  try {
    return (await exec('git', ['-C', cwd, ...args], { env, encoding: 'utf8', maxBuffer: MAX_BYTES, timeout: 10000 })).stdout;
  } catch (error) {
    if (allowMissing && error.code === 1) return null;
    throw new Error('Cannot verify Git workspace', { cause: error });
  }
}

async function rootOf(cwd) {
  const root = await realpath(cwd);
  if (root === await realpath(homedir())) throw new Error('Home directory is not an eligible workspace');
  const gitRoot = (await git(root, ['rev-parse', '--show-toplevel'])).trimEnd();
  if (await realpath(gitRoot) !== root) throw new Error('cwd must equal the Git repository/worktree root');
  return root;
}

async function inventory(root) {
  const head = (await git(root, ['rev-parse', '--verify', '--quiet', 'HEAD'], true))?.trim() ?? null;
  const branch = (await git(root, ['symbolic-ref', '--quiet', '--short', 'HEAD'], true))?.trim() ?? null;
  if (!head && !branch) throw new Error('Invalid or unreadable HEAD');
  const names = [...new Set((await git(root, ['ls-files', '-z', '--cached', '--others', '--exclude-standard'])).split('\0').filter(Boolean))]
    .filter(name => !excluded(name)).sort();
  return { head, branch, names };
}

/** Content evidence, not a diff. Ignored untracked files and .letta are excluded.
 * Known secrets are NEVER opened: only their stat metadata contributes. Metadata
 * cannot prove secret content equality against an adversary restoring timestamps;
 * unknown secret names may be hashed but their bodies are never returned/stored.
 * This is a local point-in-time check, not an atomic filesystem transaction.
 */
export async function snapshotWorkspace(cwd) {
  const root = await rootOf(cwd);
  const initial = await inventory(root);
  const files = [];
  let bytes = 0;
  for (const name of initial.names) {
    const absolute = path.resolve(root, name);
    if (!inside(root, absolute) || absolute === root) throw new Error('Unsafe Git file path');
    let stat;
    try {
      stat = await lstat(absolute, { bigint: true });
    } catch (error) {
      if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') throw error;
      files.push({ path: name, type: 'missing' });
      continue;
    }
    if (!inside(root, await realpath(path.dirname(absolute)))) throw new Error('File ancestor escapes workspace');
    if (stat.isSymbolicLink()) {
      const target = await readlink(absolute);
      if (!inside(root, path.resolve(path.dirname(absolute), target))) throw new Error('Symlink escapes workspace');
      try {
        if (!inside(root, await realpath(absolute))) throw new Error('Symlink escapes workspace');
      } catch (error) { if (error.code !== 'ENOENT') throw error; }
      files.push({ path: name, type: 'symlink', hash: digest(target), metadata: metadata(stat) });
    } else if (!stat.isFile()) {
      throw new Error('Unsupported workspace entry (including submodules)');
    } else if (secret(name)) {
      files.push({ path: name, type: 'excluded-secret', metadata: metadata(stat) });
    } else {
      if (stat.size > BigInt(MAX_BYTES - bytes)) throw new Error('Workspace exceeds 64 MiB content budget');
      const handle = await open(absolute, constants.O_RDONLY | constants.O_NOFOLLOW);
      try {
        const before = await handle.stat({ bigint: true });
        if (!before.isFile() || JSON.stringify(metadata(before)) !== JSON.stringify(metadata(stat))) throw new Error('Workspace changed while snapshotting');
        const hash = createHash('sha256');
        const buffer = Buffer.alloc(64 * 1024);
        while (true) {
          const { bytesRead } = await handle.read(buffer, 0, buffer.length, null);
          if (!bytesRead) break;
          bytes += bytesRead;
          if (bytes > MAX_BYTES) throw new Error('Workspace exceeds 64 MiB content budget');
          hash.update(buffer.subarray(0, bytesRead));
        }
        if (JSON.stringify(metadata(before)) !== JSON.stringify(metadata(await handle.stat({ bigint: true }))) ||
            JSON.stringify(metadata(before)) !== JSON.stringify(metadata(await lstat(absolute, { bigint: true })))) throw new Error('Workspace changed while snapshotting');
        files.push({ path: name, type: 'file', mode: String(stat.mode), hash: hash.digest('hex') });
      } finally { await handle.close(); }
    }
  }
  if (JSON.stringify(initial) !== JSON.stringify(await inventory(root))) throw new Error('Git state changed while snapshotting');
  const status = await git(root, ['status', '--porcelain=v1', '-z', '--untracked-files=all']);
  // Path-aware filtering also avoids counting evidence logs themselves as dirty.
  const records = status.split('\0');
  let dirty = false;
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    if (!record) continue;
    if (!excluded(record.slice(3))) dirty = true;
    if (record.slice(0, 2).includes('R') || record.slice(0, 2).includes('C')) {
      if (!excluded(records[++i] ?? '')) dirty = true;
    }
  }
  return { fingerprint: digest(JSON.stringify({ head: initial.head, files })), head: initial.head, branch: initial.branch, dirty, files };
}

async function evidenceDirectory(root, runId) {
  let dir = root;
  for (const part of ['.letta', 'cruise', 'runs', runId, 'evidence']) {
    dir = path.join(dir, part);
    await mkdir(dir, { mode: 0o700 }).catch(error => { if (error.code !== 'EEXIST') throw error; });
    const stat = await lstat(dir);
    if (!stat.isDirectory() || stat.isSymbolicLink() || !inside(root, await realpath(dir))) throw new Error('Unsafe evidence directory');
  }
  return dir;
}

function forbidden(text) {
  return /playwright/i.test(text) || /\b(?:npx|pnpx|bunx)\b|\b(?:npm|pnpm|yarn|bun|pip3?|uv)\s+(?:install|add|i|dlx|exec)\b|\b(?:curl|wget)\b/i.test(text);
}

async function validateCommand(root, check) {
  if (typeof check.bin !== 'string' || !check.bin || !Array.isArray(check.args) || check.args.some(arg => typeof arg !== 'string')) throw new Error('Invalid command');
  if (!Number.isInteger(check.timeout_ms) || check.timeout_ms < 1 || check.timeout_ms > 600000) throw new Error('Invalid timeout');
  if (!['exit_code', 'output_includes'].includes(check.assertion?.type)) throw new Error('Invalid assertion');
  if (check.assertion.type === 'output_includes' && (typeof check.assertion.value !== 'string' || !check.assertion.value.length)) throw new Error('Empty output assertion');
  if (check.assertion.type === 'exit_code' && check.assertion.value !== undefined && !Number.isInteger(check.assertion.value)) throw new Error('Invalid exit assertion');
  if (forbidden([check.bin, ...check.args].join(' '))) throw new Error('Playwright/network installs prohibited; use Aside for browser verification');
  // Inspect explicitly referenced scripts, never known secret files. This is a
  // guardrail, not a sandbox: validated commands must still be locally trusted.
  for (const arg of [check.bin, ...check.args]) {
    if (!/\.(?:[cm]?js|sh|py|ts)$/.test(arg)) continue;
    const filename = path.resolve(root, arg);
    if (!inside(root, filename) || secret(arg)) throw new Error('Unsafe script path');
    const resolved = await realpath(filename);
    if (!inside(root, resolved) || secret(path.relative(root, resolved))) throw new Error('Unsafe script path');
    const stat = await lstat(resolved);
    if (!stat.isFile() || stat.size > MAX_OUTPUT) throw new Error('Cannot inspect script safely');
    if (forbidden(await readFile(resolved, 'utf8'))) throw new Error('Script invokes prohibited browser/install tooling; use Aside');
  }
  if (/^(?:npm|pnpm|yarn|bun)(?:\.cmd)?$/.test(path.basename(check.bin))) {
    const filename = path.join(root, 'package.json');
    if (!inside(root, await realpath(filename)) || (await lstat(filename)).size > MAX_OUTPUT) throw new Error('Unsafe package manifest');
    const manifest = JSON.parse(await readFile(filename, 'utf8'));
    // Conservatively reject any prohibited package script, including lifecycle hooks.
    if (forbidden(Object.values(manifest.scripts ?? {}).join('\n'))) throw new Error('Package scripts invoke prohibited browser/install tooling; use Aside');
  }
}

function invoke(root, check, signal) {
  return new Promise(resolve => {
    if (signal?.aborted) return resolve({ stdout: '', stderr: '', exit_code: null, problem: 'Aborted before execution' });
    const stdoutChunks = [], stderrChunks = [];
    let size = 0, problem = null, timer;
    let child;
    const stop = reason => {
      problem ??= reason;
      try { if (process.platform !== 'win32') process.kill(-child.pid, 'SIGKILL'); else child.kill('SIGKILL'); } catch { child.kill('SIGKILL'); }
    };
    const abort = () => stop('Aborted');
    try {
      child = spawn(check.bin, check.args, { cwd: root, shell: false, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch { return resolve({ stdout: '', stderr: '', exit_code: null, problem: 'Process could not start' }); }
    const capture = stream => chunk => {
      const remaining = Math.max(0, MAX_OUTPUT - size);
      // Decode only after concatenation: UTF-8 characters can span data events.
      if (remaining) (stream === 'stdout' ? stdoutChunks : stderrChunks).push(Buffer.from(chunk.subarray(0, remaining)));
      size += chunk.length;
      if (size > MAX_OUTPUT) stop('Output truncated; assertion cannot be certified');
    };
    child.stdout.on('data', capture('stdout'));
    child.stderr.on('data', capture('stderr'));
    child.on('error', () => { problem ??= 'Process could not start'; });
    child.on('close', (code, processSignal) => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      resolve({ stdout: Buffer.concat(stdoutChunks).toString('utf8'), stderr: Buffer.concat(stderrChunks).toString('utf8'),
        exit_code: code, problem: problem ?? (processSignal ? `Terminated by ${processSignal}` : null) });
    });
    timer = setTimeout(() => stop('Timed out'), check.timeout_ms);
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
  });
}

/** Logs are local-only, 0600, and may contain secrets printed by commands.
 * Callers hold the run lock and MUST NOT certify changedDuringChecks batches.
 * Initial snapshot failures throw; later failures invalidate every batch entry.
 */
export async function executeChecks(cwd, run, { signal } = {}) {
  if (!uuid.test(run?.run_id ?? '') || typeof run.contract_hash !== 'string' || !run.contract_hash || !Array.isArray(run.contract?.checks)) throw new Error('Invalid run');
  const root = await rootOf(cwd);
  const snapshot = await snapshotWorkspace(root);
  const directory = await evidenceDirectory(root, run.run_id);
  const evidence = [];
  const logs = [];
  let changedDuringChecks = false;
  const verify = async () => {
    try { if ((await snapshotWorkspace(root)).fingerprint !== snapshot.fingerprint) changedDuringChecks = true; }
    catch { changedDuringChecks = true; }
  };
  for (const check of run.contract.checks) {
    await verify();
    let result;
    try { await validateCommand(root, check); result = await invoke(root, check, signal); }
    catch (error) { result = { stdout: '', stderr: '', exit_code: null, problem: error.message }; }
    await verify();
    const evaluated = !result.problem && Number.isInteger(result.exit_code);
    const passed = evaluated && (check.assertion.type === 'exit_code'
      ? result.exit_code === (check.assertion.value ?? 0)
      : result.exit_code === 0 && result.stdout.includes(check.assertion.value));
    const id = randomUUID();
    const artifact_path = path.relative(root, path.join(directory, `${id}.log`)).split(path.sep).join('/');
    const command = [check.bin, ...(check.args ?? [])].map(value => JSON.stringify(value)).join(' ');
    evidence.push({ id, check_id: check.id, requirement_ids: [...(check.requirement_ids ?? [])], contract_hash: run.contract_hash,
      fingerprint: snapshot.fingerprint, status: evaluated ? (passed ? 'passed' : 'failed') : 'unevaluable',
      assertion_evaluated: evaluated, artifact_path, exit_code: result.exit_code, command, created_at: new Date().toISOString() });
    logs.push(result);
  }
  await verify();
  if (changedDuringChecks) for (const entry of evidence) { entry.status = 'unevaluable'; entry.assertion_evaluated = false; }
  for (let i = 0; i < evidence.length; i++) {
    const entry = evidence[i], result = logs[i];
    const handle = await open(path.join(directory, `${entry.id}.log`), constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    try {
      await handle.writeFile(`WARNING: Local command output may contain secrets. Do not send remotely.\n${JSON.stringify(entry, null, 2)}\nBatch changed: ${changedDuringChecks}\nProblem: ${result.problem ?? 'none'}\n--- stdout ---\n${result.stdout}\n--- stderr ---\n${result.stderr}\n`);
    } finally { await handle.close(); }
  }
  return { evidence, snapshot, changedDuringChecks };
}
