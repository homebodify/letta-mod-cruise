import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test, { after } from "node:test";

const modCopyDir = mkdtempSync(join(tmpdir(), "cruise-code-mod-"));
const modCopyPath = join(modCopyDir, "index.mjs");
writeFileSync(modCopyPath, readFileSync(new URL("../mods/index.ts", import.meta.url), "utf8"), "utf8");
const { default: activate } = await import(pathToFileURL(modCopyPath).href);
after(() => rmSync(modCopyDir, { recursive: true, force: true }));

function git(cwd, ...args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" });
}

function createHarness() {
  const commands = new Map();
  const events = new Map();
  let panelUpdates = 0;
  let panelOpens = 0;
  let panelCloses = 0;
  const letta = {
    capabilities: {
      commands: true,
      events: { tools: true, turns: true },
      ui: { panels: true },
    },
    commands: {
      register(command) {
        commands.set(command.id, command);
        return () => commands.delete(command.id);
      },
    },
    events: {
      on(name, handler) {
        events.set(name, handler);
        return () => events.delete(name);
      },
    },
    ui: {
      openPanel(options) {
        panelOpens += 1;
        return {
          update() {
            panelUpdates += 1;
            options.render({ width: 72 });
          },
          close() {
            panelCloses += 1;
          },
        };
      },
    },
  };
  const dispose = activate(letta);
  return {
    commands,
    events,
    dispose,
    get panelUpdates() { return panelUpdates; },
    get panelOpens() { return panelOpens; },
    get panelCloses() { return panelCloses; },
  };
}

function createProject() {
  const cwd = mkdtempSync(join(tmpdir(), "cruise-code-test-"));
  writeFileSync(join(cwd, ".gitignore"), ".letta/\n", "utf8");
  writeFileSync(join(cwd, "README.md"), "# Fixture\n", "utf8");
  writeFileSync(join(cwd, "package.json"), JSON.stringify({
    name: "cruise-code-fixture",
    private: true,
    scripts: { typecheck: "node -e \"process.exit(0)\"" },
  }, null, 2), "utf8");
  git(cwd, "init", "-q");
  git(cwd, "config", "user.name", "CruiseCode Test");
  git(cwd, "config", "user.email", "cruise-code@example.test");
  git(cwd, "add", ".gitignore", "README.md", "package.json");
  git(cwd, "commit", "-qm", "fixture baseline");
  return cwd;
}

function commandContext(cwd, args, conversationId = "conv-cruise") {
  return {
    cwd,
    args,
    agent: { id: "agent-cruise" },
    conversation: { id: conversationId },
  };
}

test("code-cruise launches implementation, tracks real tools, and finalizes once", async () => {
  const cwd = createProject();
  const harness = createHarness();
  const ctx = commandContext(cwd, '"Create app.js with a greeting"');

  try {
    const result = await harness.commands.get("code-cruise").run(ctx);
    assert.equal(result.type, "prompt");
    assert.match(result.content, /Execute this coding task now/);
    assert.match(result.content, /Create app\.js with a greeting/);

    const activePath = join(cwd, ".letta", "cruise-code", "active.json");
    const runId = JSON.parse(readFileSync(activePath, "utf8")).active_run_id;
    const runPath = join(cwd, ".letta", "cruise-code", "runs", runId, "run.json");
    const planPath = join(cwd, ".letta", "cruise-code", "runs", runId, "plan.json");
    let run = JSON.parse(readFileSync(runPath, "utf8"));
    assert.equal(run.phase, "active");
    assert.equal(run.execution.status, "running");
    assert.equal(run.execution.conversation_id, "conv-cruise");

    await harness.events.get("tool_start")({
      agentId: "agent-cruise",
      conversationId: "conv-cruise",
      toolCallId: "tool-read",
      toolName: "Read",
      args: { path: "README.md" },
    }, ctx);
    await harness.events.get("tool_end")({
      agentId: "agent-cruise",
      conversationId: "conv-cruise",
      toolCallId: "tool-read",
      toolName: "Read",
      args: { path: "README.md" },
      status: "success",
      output: "# Fixture",
    }, ctx);

    writeFileSync(join(cwd, "app.js"), "export const greeting = 'hello';\n", "utf8");
    await harness.events.get("tool_start")({
      agentId: "agent-cruise",
      conversationId: "conv-cruise",
      toolCallId: "tool-edit",
      toolName: "ApplyPatch",
      args: { path: "app.js" },
    }, ctx);
    await harness.events.get("tool_end")({
      agentId: "agent-cruise",
      conversationId: "conv-cruise",
      toolCallId: "tool-edit",
      toolName: "ApplyPatch",
      args: { path: "app.js" },
      status: "success",
      output: "updated app.js",
    }, ctx);

    let plan = JSON.parse(readFileSync(planPath, "utf8"));
    assert.equal(plan.steps.find((step) => step.kind === "map").status, "done");
    assert.equal(plan.steps.find((step) => step.kind === "edit").status, "active");

    const turnResult = await harness.events.get("turn_end")({
      agentId: "agent-cruise",
      conversationId: "conv-cruise",
      stopReason: "end_turn",
      assistantMessage: "Implemented app.js",
    }, ctx);
    assert.match(turnResult.continue, /CruiseCode finished automatic evidence collection/);

    run = JSON.parse(readFileSync(runPath, "utf8"));
    plan = JSON.parse(readFileSync(planPath, "utf8"));
    assert.equal(run.phase, "closed");
    assert.equal(run.verdict, "verified");
    assert.equal(run.execution.status, "complete");
    assert.equal(run.execution.finalization_status, "complete");
    assert.ok(run.execution.summary_continuation_sent_at);
    assert.ok(plan.steps.every((step) => step.status === "done"));
    assert.ok(harness.panelUpdates > 0);

    const reportPath = join(cwd, ".letta", "cruise-code", "runs", runId, "report.md");
    const evidencePath = join(cwd, ".letta", "cruise-code", "runs", runId, "evidence", "index.json");
    assert.ok(existsSync(reportPath));
    assert.match(readFileSync(reportPath, "utf8"), /Verdict: verified/);
    const evidence = JSON.parse(readFileSync(evidencePath, "utf8"));
    assert.equal(evidence.items.find((item) => item.type === "git_diff").status, "collected");
    assert.equal(evidence.items.find((item) => item.type === "typecheck_output").status, "passed");

    const repeated = await harness.events.get("turn_end")({
      agentId: "agent-cruise",
      conversationId: "conv-cruise",
      stopReason: "end_turn",
      assistantMessage: "Final summary",
    }, ctx);
    assert.equal(repeated, undefined);
  } finally {
    harness.dispose();
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("events from another conversation cannot advance an active run", async () => {
  const cwd = createProject();
  const harness = createHarness();
  const ownerCtx = commandContext(cwd, '"Change the fixture"');

  try {
    await harness.commands.get("code-cruise").run(ownerCtx);
    const active = JSON.parse(readFileSync(join(cwd, ".letta", "cruise-code", "active.json"), "utf8"));
    const runPath = join(cwd, ".letta", "cruise-code", "runs", active.active_run_id, "run.json");
    const before = JSON.parse(readFileSync(runPath, "utf8"));

    await harness.events.get("tool_start")({
      agentId: "agent-other",
      conversationId: "conv-other",
      toolCallId: "wrong-tool",
      toolName: "ApplyPatch",
      args: { path: "README.md" },
    }, commandContext(cwd, "", "conv-other"));

    const after = JSON.parse(readFileSync(runPath, "utf8"));
    assert.equal(after.updated_at, before.updated_at);
    assert.equal(after.current_step_id, before.current_step_id);
    assert.equal(after.execution.last_tool, null);
  } finally {
    harness.dispose();
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("verify-only checks the current diff without leaving execution stuck", async () => {
  const cwd = createProject();
  const harness = createHarness();
  writeFileSync(join(cwd, "README.md"), "# Updated fixture\n", "utf8");

  try {
    const result = await harness.commands.get("code-cruise").run(commandContext(cwd, "--verify-only"));
    assert.equal(result.type, "output");
    assert.match(result.output, /Checks\/evidence completed/);

    const active = JSON.parse(readFileSync(join(cwd, ".letta", "cruise-code", "active.json"), "utf8"));
    const runPath = join(cwd, ".letta", "cruise-code", "runs", active.active_run_id, "run.json");
    const run = JSON.parse(readFileSync(runPath, "utf8"));
    assert.equal(run.verdict, "verified");
    assert.equal(run.execution.status, "idle");
    assert.equal(run.execution.last_activity, null);
  } finally {
    harness.dispose();
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("code-panel hides persistently and can be shown again", async () => {
  const cwd = createProject();
  const harness = createHarness();
  const ctx = commandContext(cwd, '"Change the fixture"');

  try {
    await harness.commands.get("code-cruise").run(ctx);
    assert.equal(harness.panelOpens, 1);

    const hidden = await harness.commands.get("code-panel").run(commandContext(cwd, "hide"));
    assert.equal(hidden.type, "output");
    assert.match(hidden.output, /panel hidden/);
    assert.equal(harness.panelCloses, 1);

    const configPath = join(cwd, ".letta", "cruise-code", "config.json");
    let config = JSON.parse(readFileSync(configPath, "utf8"));
    assert.equal(config.panel.enabled, false);

    await harness.events.get("tool_start")({
      agentId: "agent-cruise",
      conversationId: "conv-cruise",
      toolCallId: "hidden-tool",
      toolName: "Read",
      args: { path: "README.md" },
    }, ctx);
    assert.equal(harness.panelOpens, 1);

    const shown = await harness.commands.get("code-panel").run(commandContext(cwd, "show"));
    assert.equal(shown.type, "output");
    assert.match(shown.output, /panel shown/);
    assert.equal(harness.panelOpens, 2);
    config = JSON.parse(readFileSync(configPath, "utf8"));
    assert.equal(config.panel.enabled, true);

    const status = await harness.commands.get("code-panel").run(commandContext(cwd, "status"));
    assert.match(status.output, /panel: shown/);
    assert.match(status.output, /10000ms/);
  } finally {
    harness.dispose();
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("terminal runs auto-hide the panel after the configured delay", async () => {
  const cwd = createProject();
  const harness = createHarness();
  const ctx = commandContext(cwd, '"Update the fixture"');

  try {
    await harness.commands.get("code-cruise").run(ctx);
    const configPath = join(cwd, ".letta", "cruise-code", "config.json");
    const config = JSON.parse(readFileSync(configPath, "utf8"));
    config.panel.auto_hide_terminal_ms = 20;
    writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
    writeFileSync(join(cwd, "README.md"), "# Updated fixture\n", "utf8");

    await harness.events.get("turn_end")({
      agentId: "agent-cruise",
      conversationId: "conv-cruise",
      stopReason: "end_turn",
      assistantMessage: "Updated the fixture",
    }, ctx);
    await new Promise((resolve) => setTimeout(resolve, 60));
    assert.equal(harness.panelCloses, 1);
  } finally {
    harness.dispose();
    rmSync(cwd, { recursive: true, force: true });
  }
});
