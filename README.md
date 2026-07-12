# CruiseCode

[한국어 README](./README.ko.md)

CruiseCode is an evidence-first coding workflow mod for Letta Code.

It turns coding tasks and UX handoffs into verifiable contracts, evidence, verdicts, and reports. The goal is not to be a bigger autonomous coding harness. CruiseCode focuses on making agent-assisted coding work traceable, reviewable, and honest about what is or is not verified.

## Why CruiseCode exists

AI coding agents can often produce code quickly, but the harder question is whether the result can be trusted.

CruiseCode helps answer:

- What was the task supposed to satisfy?
- Which acceptance criteria were used?
- What evidence supports the implementation?
- Which checks passed or failed?
- What is still missing or unverified?

The core rule is:

```txt
No evidence → no verified
```

## Commands

```txt
/code-cruise "task"        Create a run and Evidence Contract
/code-cruise --verify-only Verify the current git diff with available checks
/code-cruise --resume      Show the active run
/code-cruise --handoff <file>
                            Create a run from implementation-handoff.json
/code-plan [task]          Create or update the Evidence Contract
/code-check                Collect git/check evidence
/code-status               Show current run status
/code-report               Generate report.md
```

## What it stores

CruiseCode stores project-local state under the current working directory:

```txt
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

This repository intentionally does **not** include local run state or evidence artifacts.

## Install

Copy the mod file into your local Letta Code mods directory:

```bash
mkdir -p ~/.letta/mods
cp cruise-code.js ~/.letta/mods/cruise-code.js
```

Then reload Letta Code:

```txt
/reload
```

Use CruiseCode from a project directory, not from your home directory:

```txt
/code-cruise "Fix login redirect after expired session"
```

## MVP scope

The first version focuses on:

- Evidence Contract generation
- JS/TS check detection from `package.json`
- git status/diff evidence collection
- typecheck/test/lint/build output capture
- verdict calculation
- compact status panel
- detailed `/code-status`
- `report.md` generation
- JSON handoff consumption for future CruiseUX integration

## CruiseUX handoff direction

CruiseCode is designed to pair with CruiseUX.

```txt
CruiseUX  → UX framing, research, interview, ideation, spec, review
CruiseCode → implementation, evidence, checks, verdict, report
```

Future CruiseUX handoff files should use:

```txt
implementation-handoff.json
```

CruiseCode maps UX acceptance criteria such as `ux-ac-001` into implementation acceptance criteria while preserving the original `ux_ref`.

## Design notes

For a concise public design overview, see [docs/DESIGN.md](./docs/DESIGN.md).

## Security notes

This repository should only contain source and documentation. Do not commit:

- `.letta/cruise-code/` run state
- evidence files from private projects
- `.env` files
- credentials or API keys
- local diagnostics
- private project paths or logs

## License

MIT License. See [LICENSE](./LICENSE).
