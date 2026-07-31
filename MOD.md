---
name: CruiseCode
description: Evidence-first coding workflow that executes implementation tasks and UX handoffs with live progress, checks, verdicts, and reports.
---

# CruiseCode Mod

CruiseCode registers `/code-*` slash commands for evidence-first coding work in Letta Code.

It is designed to make implementation work easier to trust. A run starts from a task or handoff, creates an Evidence Contract, launches the coding agent, tracks actual tool activity, collects git/check evidence, calculates a conservative verdict, and writes a report.

CruiseCode runs one foreground coding-agent turn and automatically finalizes its evidence/report. It does not create worktrees, commit code, open pull requests, run multi-agent teams, or auto-loop through fixes.

## Commands

- `/code-cruise "task"` — create a CruiseCode run, launch implementation, track progress, verify, and report.
- `/code-cruise --verify-only` — verify the current git diff with available checks.
- `/code-cruise --resume` — show the active run.
- `/code-cruise --handoff <file>` — create a run from `implementation-handoff.json`.
- `/code-plan [task]` — create or update the active Evidence Contract.
- `/code-check` — collect git evidence and run configured checks.
- `/code-status` — show current run status.
- `/code-report` — generate `report.md`.
- `/code-panel hide|show|status` — control progress-panel visibility; terminal states auto-hide after 10 seconds.

Each command supports `help`, `-h`, or `--help` where applicable.

## Core rule

```text
No evidence → no verified
```

CruiseCode should not mark work as `verified` just because code changed or an agent says the task is complete.

## State model

CruiseCode separates workflow state from trust judgment:

```text
phase   = where the run is in the workflow
verdict = what the evidence says about trust/completion
```

This allows a run to be closed but still not verified.

## Project-local state

State is written under the current working directory:

```text
.letta/cruise-code/
```

This includes run metadata, the Evidence Contract, append-only ledger events, latest evidence snapshots, and `report.md`.

`/code-report` also writes `lesson-candidates.json`. This file is a boundary artifact for `muscle-memory`: CruiseCode may suggest reusable lesson candidates from the evidence chain, but it does not create, update, sanitize, graduate, or publish skills.

## Evidence Contract

`plan.json` is the Evidence Contract. It records:

- goal
- non-goals
- constraints
- acceptance criteria
- implementation/check steps
- detected checks
- manual check placeholders when needed

## Evidence collection

CruiseCode can collect:

- `git status --short`
- `git diff --stat`
- `git diff`
- typecheck output
- test output
- lint output
- build output

Evidence files are latest snapshots. The ledger records event summaries.

## CruiseUX handoff

CruiseCode is designed to pair with CruiseUX. The intended handoff file is:

```text
implementation-handoff.json
```

When a handoff includes UX acceptance criteria such as `ux-ac-001`, CruiseCode preserves that original reference as `ux_ref` in the implementation plan.

## muscle-memory boundary

Use CruiseCode for the current coding run's proof. Use `muscle-memory` for durable skill lifecycle work across runs.

```text
CruiseCode    → report.md + lesson-candidates.json
muscle-memory → distill / dedup / quality gate / sanitize / publish
```

CruiseCode should not add `/code-skill`, `/code-learn`, or automatic skill writes unless the product boundary is deliberately redesigned later.

## Safety

Mods are trusted local code. Review the source before installing third-party mods.

This mod performs local filesystem writes under the active project’s `.letta/cruise-code/` directory. After `/code-cruise` is invoked, it observes the bound run's tool/turn events and runs local git/check commands during automatic finalization. It has no startup side effects and does not run background timers by itself.

If a mod breaks startup or command handling, recover with:

```bash
letta --no-mods
# or
LETTA_DISABLE_MODS=1 letta
```

Then remove or edit the mod package and run `/reload`.
