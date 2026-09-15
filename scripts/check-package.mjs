import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import activate from '../mods/index.mjs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
assert.equal(pkg.name, 'cruise');
assert.equal(pkg.private, true);
assert.deepEqual(pkg.letta.mods, ['./mods/index.mjs']);
const commands = [], tools = [];
const dispose = activate({ capabilities: { commands: true, tools: true },
  commands: { register(c) { commands.push(c.id); return () => {}; } },
  tools: { register(t) { tools.push(t.name); return () => {}; } },
});
assert.deepEqual(commands, ['cruise']);
assert.deepEqual(tools, ['cruise_update', 'cruise_approve', 'cruise_verify']);
dispose();
for (const dir of ['src', 'mods', 'scripts', 'tests']) {
  const walk = path => { for (const e of readdirSync(path, { withFileTypes: true })) {
    const file = join(path, e.name);
    if (e.isDirectory()) walk(file);
    else if (file.endsWith('.mjs')) execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } };
  walk(fileURLToPath(new URL(`../${dir}`, import.meta.url)));
}
for (const file of ['SKILL.md', 'references/ux.md', 'references/code.md', 'references/delta.md']) {
  const text = readFileSync(new URL(`../skills/cruising/${file}`, import.meta.url), 'utf8');
  assert.ok(!text.includes('[TODO'), `Unfinished skill: ${file}`);
}
console.log('Cruise package: syntax, single command, tools and bundled workflow checks passed.');
