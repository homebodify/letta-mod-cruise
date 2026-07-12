# CruiseCode

[한국어 README](./README.ko.md)

CruiseCode is an evidence-first coding workflow mod for Letta Code.

It turns implementation tasks and UX handoffs into verifiable contracts, evidence, verdicts, and reports.

```text
No evidence → no verified
```

## What it adds

| Command | Purpose | Best used when |
| --- | --- | --- |
| `/code-cruise "task"` | Creates a run and Evidence Contract | You are starting a coding task that should be traceable |
| `/code-cruise --verify-only` | Verifies the current git diff with available checks | You already changed code and want evidence/reporting |
| `/code-cruise --resume` | Shows the active run | You want to continue or inspect the current run |
| `/code-cruise --handoff <file>` | Creates a run from `implementation-handoff.json` | You are continuing from a UX/product handoff |
| `/code-plan [task]` | Creates or updates the Evidence Contract | The task criteria or checks need to be clarified |
| `/code-check` | Collects git/check evidence | You want proof before claiming progress |
| `/code-status` | Shows run state, evidence, blockers, and next action | You need a readable dashboard |
| `/code-report` | Generates `report.md` | You need a handoff or verification summary |

## Core idea

CruiseCode separates workflow state from verification judgment.

```text
phase   = where the run is in the workflow
verdict = what the evidence says about trust/completion
```

A run can be complete enough to report but still not be verified. That distinction is the point.

## Storage

CruiseCode writes project-local state under the current working directory:

```text
.letta/cruise-code/
  config.json
  active.json
  runs/
    <run-id>/
      run.json
      plan.json
      ledger.jsonl
      evidence/
        index.json
        git-status.txt
        git-diff-stat.txt
        git-diff.patch
        typecheck.txt
        test.txt
        lint.txt
        build.txt
      report.md
```

This repository does **not** include local run state or evidence artifacts.

## Installation

### Local development install

Clone this repo and copy the mod entry into your local Letta mods directory:

```bash
git clone https://tangled.org/homebodify.tngl.sh/letta-mode-cruisecode
mkdir -p ~/.letta/mods
cp letta-mode-cruisecode/mods/index.ts ~/.letta/mods/cruise-code.js
```

Then reload active Letta Code sessions:

```text
/reload
```

Verify commands are available:

```text
/code-cruise help
```

Use CruiseCode from a project directory, not from your home directory:

```text
/code-cruise "Fix login redirect after expired session"
```

## Development

Run the package check:

```bash
npm run check
```

The check verifies:

- `package.json#letta` exists
- declared mod files exist
- `MOD.md` frontmatter includes `name` and `description`
- the mod source parses as JavaScript-compatible TypeScript

## CruiseUX handoff

CruiseCode is designed to pair with CruiseUX.

```text
CruiseUX   → UX framing, research, interview, ideation, spec, review
CruiseCode → implementation, evidence, checks, verdict, report
```

The intended handoff file is:

```text
implementation-handoff.json
```

CruiseCode preserves original UX acceptance criteria such as `ux-ac-001` as `ux_ref`, so reports can connect UX intent to implementation evidence.

## Safety

Mods are trusted local code. Review the source before installing third-party mods.

This mod performs local filesystem writes under the active project’s `.letta/cruise-code/` directory and runs local git/check commands only when invoked by the user. It has no startup side effects and does not run background timers by itself.

Do not commit private CruiseCode run state, evidence files, `.env` files, credentials, local diagnostics, or private project logs.

If a mod breaks startup or command handling, recover with:

```bash
letta --no-mods
# or
LETTA_DISABLE_MODS=1 letta
```

Then remove or edit the mod package and run `/reload`.

See MOD.md for the agent-facing behavioral contract.

## License

MIT License. See [LICENSE](./LICENSE).
