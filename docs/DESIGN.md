# CruiseCode Design Notes

CruiseCode is an evidence-first implementation layer for Letta Code.

It is intentionally smaller than a full autonomous coding harness. Its job is to make coding work easier to trust by preserving the link between task intent, acceptance criteria, collected evidence, verdict, and report.

## Core workflow

```txt
Task or UX handoff
→ Evidence Contract
→ git/check evidence
→ verdict
→ report.md
```

## Product principles

### Evidence over claims

CruiseCode should not mark work as verified just because code changed or an agent says it is complete.

```txt
No evidence → no verified
```

### Phase and verdict are separate

A run has both workflow state and verification judgment.

```txt
phase   = where the run is in the workflow
verdict = what the evidence says about trust/completion
```

This allows states such as:

```json
{
  "phase": "closed",
  "verdict": "needs_evidence"
}
```

### Small command surface

MVP keeps the user-facing surface small:

```txt
/code-cruise
/code-plan
/code-check
/code-status
/code-report
```

## Evidence Contract

`plan.json` is the Evidence Contract. It contains:

- goal
- non-goals
- constraints
- acceptance criteria
- implementation/check steps
- detected checks
- manual check placeholders when needed

The contract is the bridge between what the work is supposed to satisfy and what evidence later proves.

## Evidence model

CruiseCode collects project-local evidence such as:

- `git status --short`
- `git diff --stat`
- `git diff`
- typecheck output
- test output
- lint output
- build output

Evidence files are latest snapshots. The ledger records event summaries.

## Verdicts

CruiseCode uses conservative verdicts:

```txt
unreviewed
needs_work
needs_evidence
ready_with_caveats
verified
```

`verified` requires sufficient required evidence and no unresolved blockers.

## CruiseUX handoff

CruiseCode is designed to pair with CruiseUX.

```txt
CruiseUX  → UX framing, research, interview, ideation, spec, review
CruiseCode → implementation, evidence, checks, verdict, report
```

The intended handoff file is:

```txt
implementation-handoff.json
```

CruiseCode can preserve original UX acceptance criteria references such as `ux-ac-001` through `ux_ref`, so the report can show how UX criteria map to implementation evidence.

## Why this is different

Many coding-agent harnesses optimize for stronger autonomy, parallel execution, model routing, or long-running loops.

CruiseCode focuses on a narrower trust gap:

```txt
What was promised?
What changed?
What evidence exists?
What can be verified?
What remains unverified?
```

That focus is especially useful for UX-to-code handoffs, QA-heavy work, and sensitive workflow changes.

## Future directions

Future versions may add features only when real usage justifies them, such as:

- `/code-review`
- manual QA evidence input
- stronger CruiseUX handoff validation
- bounded recovery loop
- worktree mode
- CI/coverage import
- cross-language check adapters
- optional Checker or Mapper subagents

These are intentionally not part of the initial public mod surface.
