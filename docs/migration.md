# Migration notes — local-only alpha

## What exists locally
This work unifies CruiseCode and imported CruiseUX guidance in a local repository.
CruiseCode Git history is inherited; UX protocol provenance is the installed original
`/Users/homebodify/.letta/mods/cruise-ux.js`, not a merged UX history.
No remote was created or pushed, no installation was changed, and the original
repositories and installed mods remain intact. Treat this as alpha development,
not an announcement of a deployed replacement.

## Request translation, not aliases
Use `/cruise <request>` and controls `status`, `resume`, `check`, `help`.
Describe the desired activity rather than relying on old mode flags or commands:

| Prior capability | New request style |
| --- | --- |
| UX frame/research | Frame a decision / research this workflow with sources |
| UX interview | Clarify this idea / trace this decision / prepare real-user research |
| UX ideate/spec | Compare distinct concepts / write the spec and test thresholds |
| UX review | Review this artifact for decision readiness without implementing |
| UX cruise | Combine the needed UX activities; reuse known results |
| Code planning/review | Inspect scope, requirements, risks, and relevant checks |
| Code implementation | Implement the explicit bounded change and verify criteria |
| Prototype implementation | Build the approved minimal prototype; report technical evidence, not UX validation |
| Verification-only / report | Check current changes without fixes / summarize actual evidence and gaps |
| Follow-up correction | Fix this delta against the relevant parent requirements |

Old slash aliases and automatic loop scheduling are not carried forward. Continuous
work requests do not bypass interviews or human gates. Revision remains a deliberate,
bounded decision with recorded rationale, not an automatic retry loop.
The skill retains adaptive discovery, decision-trace, and research-protocol interviews,
actual-user versus stakeholder distinctions, research sources and `docs/search/`,
diverse concepts, hypotheses, thresholds, and full specs/reviews without forcing all stages.

## State and explicit handoff
Do not rename, copy, delete, or automatically migrate `.letta/cruise-code` or
`.letta/cruise-ux` state into a new run. Old state is historical context only.
For an intentional handoff, supply explicit JSON to
`cruise_update({action: "import_handoff", handoff_path: "...json"})`.
The external JSON adapter validates proposed scope; this is not arbitrary Markdown
ingestion or an automatic legacy-run migration. Inspect the resulting contract.
The original UX mod has no JSON handoff producer. Prepare an explicit adapter input
when needed, or have new UX work submit `cruise_update` contract requirements directly.
Preserve requirement IDs across UX and code; do not copy approval or verified claims.
Existing legacy lessons/export interfaces remain read-only; future export is optional
future work, not a new active capability. Do not generate generic lesson candidates.

## Acceptance changes to understand
Contracts explicitly separate inspect and implement intent, risk, requirements,
non-goals, constraints, and executable checks. A routing hint cannot authorize edits.
`cruise_approve` asks once for the exact initial implementation contract. Approval is
reused until request/contract changes; routing is not authorization. Review-only to implementation
needs this gate. `cruise_verify` requires host tool permission and records actual checks.
Evidence must be fresh for contract hash/version, requirement/check IDs, and workspace;
parent-run tests are not automatically current after a delta or import.
Finish evaluates evidence, or marks inspection review-ready; turn end never auto-finishes.
No caller-supplied approval/verified flag can replace those operations.
Check selection is semantic judgment, not deterministic proof: typecheck is not behavior,
and a passing command is not actual-user validation. Browser work uses Aside only,
never Playwright, even through scripts. Cruise gates its acceptance, not all host tools.

## Scoped-workspace compatibility
The selected canonical cwd is now the evidence, check and run-store scope, including
project subdirectories. Git-root ownership and operation locks still serialize the
worktree. Existing root run paths and omitted-dependency contract hashes are unchanged;
root runs without workspace identity remain readable, but old fingerprints do not
match versioned identity-bound snapshots and must be recaptured through approved checks.
Unversioned subdirectory or copied/relocated run state fails closed, without rewriting
approval or history. Never hand-write a run to migrate it.

Subdirectory implementation requires a human-reviewed `dependencies` array of relevant
scope-relative local file paths; `[]` explicitly declares no additional dependencies.
Dependencies outside scope, ignored files, missing files, symlinks and metadata-only
secrets cannot be certified. Choose a containing scope for shared parent/sibling inputs;
do not omit dependencies to avoid the unchanged 64 MiB cap. External runtime state and
arbitrary script dependency graphs remain outside automatic fingerprint guarantees.
Reload the host with `/reload` after an authorized installation update; this does not
start a run or approve its contract.

## Before any later adoption
Review the local diff, run project tests and official skill validation, and inspect
the tool permission behavior and acceptance limitations. Installation, remote creation,
publication, and changes to legacy data require separate explicit instructions.
