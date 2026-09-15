// Opt-in acceptance probe: real installed App Server, isolated HOME/backend, no model work.
// This is not part of npm test and never reloads or restarts the user's running Desktop.
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, cpSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:net';
import { randomUUID } from 'node:crypto';

const installed = resolve(process.argv[2] || '');
assert.ok(process.argv[2], 'Pass the installed Cruise package root.');
const sandbox = mkdtempSync(join(tmpdir(), 'cruise-live-loader-'));
const home = join(sandbox, 'home'), cwd = join(sandbox, 'project');
mkdirSync(join(home, '.letta/mods/packages/npm'), { recursive: true });
mkdirSync(cwd);
cpSync(installed, join(home, '.letta/mods/packages/npm/cruise'), { recursive: true });
writeFileSync(join(home, '.letta/mods/packages.json'), JSON.stringify({ packages: [{ source: 'npm:cruise', version: '0.1.0-alpha.2', enabled: true, root: 'packages/npm/cruise', entries: ['./mods/index.mjs'] }] }));
writeFileSync(join(home, '.letta/settings.json'), JSON.stringify({ preferredBackendMode: 'local', createDefaultAgents: false }));
writeFileSync(join(cwd, '.gitignore'), '.letta/\n');
execFileSync('git', ['init', '-q', cwd]);
const socket = createServer();
await new Promise(r => socket.listen(0, '127.0.0.1', r));
const port = socket.address().port;
await new Promise(r => socket.close(r));
const env = { ...process.env, HOME: home, LETTA_LOCAL_BACKEND_DIR: join(sandbox, 'backend') };
for (const key of ['AGENT_ID', 'CONVERSATION_ID', 'LETTA_AGENT_ID', 'LETTA_CONVERSATION_ID', 'LETTA_BASE_URL', 'LETTA_SETTINGS_BASE_URL', 'LETTA_API_KEY', 'MEMORY_DIR']) delete env[key];
let logs = '', exited = false, ws;
const child = spawn('letta', ['--backend', 'local', 'server', '--listen', `ws://127.0.0.1:${port}`], { cwd, env, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
child.stdout.on('data', x => { logs += x.toString(); }); child.stderr.on('data', x => { logs += x.toString(); });
child.on('exit', () => { exited = true; });
const events = [];
try {
  const until = Date.now() + 30000;
  while (Date.now() < until && !exited) {
    try {
      ws = await new Promise((res, rej) => {
        const s = new WebSocket(`ws://127.0.0.1:${port}`);
        s.addEventListener('open', () => res(s), { once: true });
        s.addEventListener('error', () => { s.close(); rej(new Error('not ready')); }, { once: true });
      });
      break;
    } catch { await new Promise(r => setTimeout(r, 250)); }
  }
  assert.ok(ws, `App Server did not start: ${logs.slice(-3000)}`);
  ws.addEventListener('message', e => { try { events.push(JSON.parse(e.data)); } catch {} });
  async function request(body) {
    const offset = events.length;
    const request_id = randomUUID(); ws.send(JSON.stringify({ ...body, request_id }));
    const until = Date.now() + 30000;
    while (Date.now() < until) {
      const reply = events.find(e => e.request_id === request_id);
      if (reply) { assert.notEqual(reply.success, false, JSON.stringify(reply)); return reply; }
      // Letta 0.32.8 custom commands complete via a lifecycle delta, unlike built-ins.
      if (body.type === 'execute_command' && body.command_id === 'cruise') {
        const terminal = events.slice(offset).find(e => e.type === 'stream_delta' && e.delta?.message_type === 'slash_command_end' && e.delta.command_id === body.command_id);
        if (terminal) { assert.equal(terminal.delta.success, true, JSON.stringify(terminal.delta)); return terminal.delta; }
      }
      if (exited) throw new Error(`Server exited: ${logs.slice(-2000)}`);
      await new Promise(r => setTimeout(r, 50));
    }
    throw new Error(`No response for ${body.type}; recent event types: ${events.slice(-12).map(e => e.type)}; logs: ${logs.slice(-1500)}`);
  }
  const info = await request({ type: 'app_server_info' });
  assert.equal(info.backend, 'local', JSON.stringify(info));
  const started = await request({ type: 'runtime_start', create_agent: { body: { name: 'Cruise isolated loader smoke', tools: [], include_base_tools: false }, pin_global: false, memfs: false }, create_conversation: { body: {} }, cwd, skill_sources: [], force_device_status: true });
  assert.ok(started.runtime?.agent_id && started.runtime?.conversation_id, JSON.stringify(started));
  const runtime = started.runtime;
  const reloaded = await request({ type: 'execute_command', command_id: 'reload', runtime });
  assert.match(reloaded.output, /Reloaded/);
  const help = await request({ type: 'execute_command', command_id: 'cruise', args: 'help', runtime });
  assert.match(help.output, /Cruise — one entry point/);
  const status = await request({ type: 'execute_command', command_id: 'cruise', args: 'status', runtime });
  assert.match(status.output, /No active Cruise run/);
  await assert.rejects(() => request({ type: 'execute_command', command_id: 'ux-frame', args: 'help', runtime }), /Unknown command: ux-frame/);
  await assert.rejects(() => request({ type: 'execute_command', command_id: 'code-cruise', args: 'help', runtime }), /Unknown command: code-cruise/);
  const commandLists = events.filter(e => Array.isArray(e.mod_commands)).map(e => e.mod_commands.map(c => c.id));
  if (commandLists.length) { assert.ok(commandLists.some(ids => ids.includes('cruise'))); assert.ok(commandLists.every(ids => !ids.some(id => id.startsWith('ux-') || id.startsWith('code-')))); }
  console.log(JSON.stringify({ success: true, version: info.version, actual_app_server: true, reload: reloaded.output, help: help.output, status: status.output, legacy_commands_absent: true, commandLists, model_calls_requested: 0, isolated_home_and_backend: true }, null, 2));
} finally {
  ws?.close();
  if (!exited) {
    const done = new Promise(r => { child.once('exit', r); setTimeout(r, 3000); });
    try { process.kill(-child.pid, 'SIGTERM'); } catch {}
    await done;
    if (!exited) { try { process.kill(-child.pid, 'SIGKILL'); } catch {} }
  }
  rmSync(sandbox, { recursive: true, force: true });
}
