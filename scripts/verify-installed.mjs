// Run the unchanged regression assertions against an explicitly installed package.
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

assert.ok(process.argv[2], 'Pass the installed package root.');
const installed = resolve(process.argv[2]);
const temp = mkdtempSync(join(tmpdir(), 'cruise-installed-tests-'));
try {
  const files = ['contracts.test.mjs', 'evidence.test.mjs', 'cruise.test.mjs', 'scoped-workspace.test.mjs'].map(name => {
    const source = readFileSync(new URL(`../tests/${name}`, import.meta.url), 'utf8');
    // Only module locations change. Test bodies, assertions and fixtures stay intact.
    const test = source.replace(/(['"])\.\.\/src\/([^'"]+)\1/g, (_match, _quote, path) => JSON.stringify(pathToFileURL(join(installed, 'src', path)).href));
    const file = join(temp, name); writeFileSync(file, test); return file;
  });
  const result = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit', timeout: 180000 });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, 'Installed-package regression failed.');
} finally { rmSync(temp, { recursive: true, force: true }); }
