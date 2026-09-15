import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, mkdir, rm, stat, symlink, unlink, truncate } from 'node:fs/promises';
import { tmpdir, homedir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { snapshotWorkspace, executeChecks } from '../src/core/evidence.mjs';

const exec = promisify(execFile);
async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'cruise-evidence-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await exec('git', ['init', root]); // Unborn HEAD: no config changes or commits.
  return root;
}
const check = (code, overrides = {}) => ({ id: 'source', bin: process.execPath, args: ['-e', code],
  label: 'Source check', requirement_ids: ['R1'], timeout_ms: 3000, required: true,
  assertion: { type: 'exit_code', value: 0 }, ...overrides });
const run = checks => ({ run_id: randomUUID(), contract_hash: 'contract-hash', contract: { checks } });

test('snapshots hash tracked/untracked contents and deletions, without bodies', async t => {
  const root = await fixture(t);
  await writeFile(path.join(root, 'source.txt'), 'body-one');
  await exec('git', ['-C', root, 'add', 'source.txt']);
  const a = await snapshotWorkspace(root);
  assert.equal(a.head, null);
  assert.equal(a.dirty, true);
  assert.ok(!JSON.stringify(a).includes('body-one'));
  await writeFile(path.join(root, 'source.txt'), 'body-two');
  const b = await snapshotWorkspace(root);
  assert.notEqual(a.fingerprint, b.fingerprint);
  await writeFile(path.join(root, 'new.txt'), 'new-file');
  const c = await snapshotWorkspace(root);
  assert.notEqual(b.fingerprint, c.fingerprint);
  await writeFile(path.join(root, 'new.txt'), 'changed!');
  assert.notEqual(c.fingerprint, (await snapshotWorkspace(root)).fingerprint);
  await unlink(path.join(root, 'source.txt'));
  assert.equal((await snapshotWorkspace(root)).files.find(file => file.path === 'source.txt').type, 'missing');
});

test('ignores .letta metadata and ignored untracked files, but not tracked ignored files', async t => {
  const root = await fixture(t);
  await writeFile(path.join(root, '.gitignore'), 'ignored.txt\n');
  const before = await snapshotWorkspace(root);
  await mkdir(path.join(root, '.letta'));
  await writeFile(path.join(root, '.letta', 'state'), 'metadata');
  await writeFile(path.join(root, 'ignored.txt'), 'ignored');
  assert.equal(before.fingerprint, (await snapshotWorkspace(root)).fingerprint);
  await exec('git', ['-C', root, 'add', '-f', 'ignored.txt']);
  assert.notEqual(before.fingerprint, (await snapshotWorkspace(root)).fingerprint);
});

test('known secret contents never enter snapshot; stat changes invalidate', async t => {
  const root = await fixture(t);
  const filename = path.join(root, '.env.local');
  await writeFile(filename, 'TOP_SECRET_VALUE');
  const a = await snapshotWorkspace(root);
  assert.ok(!JSON.stringify(a).includes('TOP_SECRET_VALUE'));
  assert.equal(a.files[0].type, 'excluded-secret');
  await writeFile(filename, 'ANOTHER_TOP_SECRET_VALUE');
  const b = await snapshotWorkspace(root);
  assert.notEqual(a.fingerprint, b.fingerprint);
  const result = await executeChecks(root, run([check('console.log("ordinary output")')]));
  const log = await readFile(path.join(root, result.evidence[0].artifact_path), 'utf8');
  assert.ok(!log.includes('TOP_SECRET_VALUE'));
  assert.match(log, /may contain secrets/);
});

test('rejects nested directories, home, external symlinks and excessive bytes', async t => {
  const root = await fixture(t);
  await mkdir(path.join(root, 'nested'));
  await assert.rejects(snapshotWorkspace(path.join(root, 'nested')), /root/);
  await assert.rejects(snapshotWorkspace(homedir()), /Home/);
  await symlink(homedir(), path.join(root, 'outside'));
  await exec('git', ['-C', root, 'add', 'outside']);
  await assert.rejects(snapshotWorkspace(root), /Symlink escapes/);
  await unlink(path.join(root, 'outside'));
  await writeFile(path.join(root, 'large'), '');
  await truncate(path.join(root, 'large'), 64 * 1024 * 1024 + 1);
  await assert.rejects(snapshotWorkspace(root), /64 MiB/);
});

test('actual completed exits and stdout predicates determine evidence', async t => {
  const root = await fixture(t);
  const result = await executeChecks(root, run([
    check('console.log("expected");console.error("diagnostic")', { id: 'pass', assertion: { type: 'output_includes', value: 'expected' } }),
    check('process.exit(7)', { id: 'fail' }),
    check('console.log("expected");process.exit(3)', { id: 'nonzero', assertion: { type: 'output_includes', value: 'expected' } }),
    check('console.error("expected")', { id: 'stderr-only', assertion: { type: 'output_includes', value: 'expected' } }),
    check('process.exit(7)', { id: 'expected-exit', assertion: { type: 'exit_code', value: 7 } }),
  ]));
  assert.equal(result.changedDuringChecks, false);
  assert.deepEqual(result.evidence.map(entry => entry.status), ['passed', 'failed', 'failed', 'failed', 'passed']);
  assert.ok(result.evidence.every(entry => entry.assertion_evaluated && entry.fingerprint === result.snapshot.fingerprint));
  assert.equal(new Set(result.evidence.map(entry => entry.id)).size, 5);
  const artifact = path.join(root, result.evidence[0].artifact_path);
  assert.equal((await stat(artifact)).mode & 0o777, 0o600);
  assert.match(await readFile(artifact, 'utf8'), /expected[\s\S]*diagnostic/);
  assert.equal((await snapshotWorkspace(root)).fingerprint, result.snapshot.fingerprint);
});

test('missing executables, timeout, truncation and invalid assertions never pass', async t => {
  const root = await fixture(t);
  const result = await executeChecks(root, run([
    check('', { bin: 'cruise-nonexistent-command-xyz', args: [] }),
    check('setInterval(()=>{},1000)', { timeout_ms: 40 }),
    check('process.stdout.write("x".repeat(2*1024*1024))'),
    check('console.log("ok")', { assertion: { type: 'output_includes', value: '' } }),
  ]));
  assert.ok(result.evidence.every(entry => entry.status === 'unevaluable' && !entry.assertion_evaluated));
});

test('abort before/during execution is unevaluable', async t => {
  const root = await fixture(t);
  const already = new AbortController();
  already.abort();
  const before = await executeChecks(root, run([check('process.exit(0)')]), { signal: already.signal });
  assert.equal(before.evidence[0].status, 'unevaluable');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 300);
  try {
    const during = await executeChecks(root, run([check('setInterval(()=>{},1000)')]), { signal: controller.signal });
    assert.equal(during.evidence[0].status, 'unevaluable');
  } finally { clearTimeout(timer); }
});

test('workspace change invalidates the entire batch, including earlier passes', async t => {
  const root = await fixture(t);
  const result = await executeChecks(root, run([
    check('console.log("first")'),
    check('require("node:fs").writeFileSync("new-source", "changed")'),
  ]));
  assert.equal(result.changedDuringChecks, true);
  assert.ok(result.evidence.every(entry => entry.status === 'unevaluable' && !entry.assertion_evaluated));
  assert.notEqual(result.snapshot.fingerprint, (await snapshotWorkspace(root)).fingerprint);
});

test('snapshot failure after a check fails the whole batch closed', async t => {
  const root = await fixture(t);
  const result = await executeChecks(root, run([check('require("node:fs").symlinkSync("/tmp", "escape")')]));
  assert.equal(result.changedDuringChecks, true);
  assert.equal(result.evidence[0].status, 'unevaluable');
});

test('unsafe run paths and symlinked metadata directories are rejected', async t => {
  const root = await fixture(t);
  await assert.rejects(executeChecks(root, { ...run([]), run_id: '../escape' }), /Invalid run/);
  await symlink(tmpdir(), path.join(root, '.letta'));
  await assert.rejects(executeChecks(root, run([])), /Unsafe evidence/);
});

test('rejects Playwright directly, in scripts, and network installers', async t => {
  const root = await fixture(t);
  await writeFile(path.join(root, 'browser.mjs'), 'import "playwright";');
  const result = await executeChecks(root, run([
    check('', { bin: 'playwright', args: ['test'] }),
    check('', { args: ['browser.mjs'] }),
    check('', { bin: 'npm', args: ['install', 'anything'] }),
    check('', { bin: 'npx', args: ['anything'] }),
  ]));
  assert.ok(result.evidence.every(entry => entry.status === 'unevaluable' && entry.exit_code === null));
});

test('stdout matching preserves UTF-8 split across process output chunks', async t => {
  const root = await fixture(t);
  const result = await executeChecks(root, run([check(
    'process.stdout.write(Buffer.from([0xe2]));setTimeout(()=>process.stdout.write(Buffer.from([0x82,0xac])),40)',
    { assertion: { type: 'output_includes', value: '€' } },
  )]));
  assert.equal(result.evidence[0].status, 'passed');
});

test('internal links hash the link target without following file bodies', async t => {
  const root = await fixture(t);
  await writeFile(path.join(root, '.env'), 'SECRET_LINK_BODY');
  await symlink('.env', path.join(root, 'link'));
  const snapshot = await snapshotWorkspace(root);
  assert.equal(snapshot.files.find(file => file.path === 'link').type, 'symlink');
  assert.ok(!JSON.stringify(snapshot).includes('SECRET_LINK_BODY'));
});
