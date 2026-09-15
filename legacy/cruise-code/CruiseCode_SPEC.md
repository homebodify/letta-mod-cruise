# CruiseCode Spec (historical; not the unified Cruise contract)

CruiseCode is an evidence-first coding workflow mod for Letta Code.

It turns a coding task into an Evidence Contract, collects git/check evidence, shows a compact readable progress panel, and generates a final verification report.

CruiseCode is not intended to be a full autonomous coding harness in MVP. Its first version focuses on making coding work traceable, verifiable, and resumable through clear state, evidence, and reporting.

---

## 1. Product Principles

### 1.1 Evidence over claims

CruiseCode should not say a task is done simply because code was changed.

It should answer:

- What changed?
- Which acceptance criteria does it satisfy?
- What evidence supports that?
- What checks passed or failed?
- What remains unverified?

The preferred final state is not `done`, but `verified`.

### 1.2 Phase and verdict are separate

CruiseCode separates workflow progress from verification judgment.

```txt
phase   = where the run is in the workflow
verdict = what the evidence says about trust/completion
```

Example:

```json
{
  "phase": "checking",
  "verdict": "needs_evidence"
}
```

This avoids mixing process state with quality judgment.

### 1.3 Small command surface

MVP should use a small set of predictable commands.

```txt
/code-cruise
/code-plan
/code-check
/code-status
/code-report
```

Additional commands can be added later only when real usage proves they are needed.

### 1.4 Loose coupling with CruiseUX

CruiseUX and CruiseCode should connect through a file-based handoff contract.

CruiseUX should not auto-run CruiseCode or directly create CruiseCode internal run state.

```txt
CruiseUX  → creates implementation-handoff.json
CruiseCode → consumes implementation-handoff.json
```

### 1.5 No evidence, no verified

CruiseCode must never mark a run as `verified` when evidence is insufficient.

If checks are missing or proof is weak, it should say so.

---

## 2. MVP Scope

### 2.1 MVP definition

CruiseCode MVP is a Letta Code mod that:

1. Creates a coding run from a task or handoff.
2. Converts the task into an Evidence Contract.
3. Detects available JS/TS project checks.
4. Collects git diff and check evidence.
5. Shows a compact progress panel.
6. Provides detailed `/code-status`.
7. Generates `report.md`.

### 2.2 MVP implementation scope

The MVP starts as a single JavaScript Letta Code mod file with no native helper dependency.

This is an implementation scope, not product identity.

Public/product wording should say:

```txt
CruiseCode is an evidence-first coding workflow mod for Letta Code.
```

Avoid presenting the product as “JS-only.”

### 2.3 Local file

Initial local mod file:

```txt
~/.letta/mods/cruise-code.js
```

If the mod grows, it can later move into a package structure.

---

## 3. Commands

### 3.1 MVP commands

```txt
/code-cruise
/code-plan
/code-check
/code-status
/code-report
```

---

### 3.2 `/code-cruise`

#### Purpose

Flagship entry command for a CruiseCode run.

It creates or resumes a run, prepares state, creates an Evidence Contract when possible, and shows the next action.

#### MVP supported forms

```txt
/code-cruise "task"
/code-cruise --prototype "task"
/code-cruise --mode prototype "task"
/code-cruise --prototype --handoff <file>
/code-cruise --verify-only
/code-cruise --resume
/code-cruise --handoff <file>
```

#### Candidate / later forms

```txt
/code-cruise --from-ux <run-id>
/code-cruise --auto
/code-cruise --loop
```

`--from-ux` may have a partial resolver in MVP, but full support depends on CruiseUX generating `implementation-handoff.json`.

#### Behavior

For a new task:

```txt
task input
→ create run
→ create brief in run.json
→ create plan.json
→ detect checks
→ show panel
```

For `--verify-only`:

```txt
current git diff
→ collect evidence
→ run checks if available
→ calculate verdict
→ generate status/report path
```

For `--resume`:

```txt
active.json
→ load active run
→ show current state
→ suggest next command
```

For `--handoff <file>`:

```txt
handoff JSON
→ validate handoff
→ create run
→ convert acceptance criteria into Evidence Contract
```

For prototype mode:

```txt
direct task or read-only handoff
→ Prototype Execution Contract
→ bounded implementation
→ git/check evidence
→ portable Prototype Review Packet + report
```

Direct prototype tasks are recorded as `ux_intent_status: unverified`, so CruiseCode can make technical-evidence claims only. Prototype handoffs preserve inherited criterion references as read-only `ux_ref` values. CruiseCode does not create UX criteria, invent user scenarios, or issue a UX/product verdict.

#### Blocking conditions

CruiseCode should not proceed automatically when:

- task is too vague
- handoff readiness is not suitable
- blocking open questions exist
- dependency changes require approval
- DB/migration changes require approval
- large deletion/change threshold is exceeded
- checks are unavailable and verification risk is not accepted

---

### 3.3 `/code-plan`

#### Purpose

Create or update the Evidence Contract.

This command does not edit product code.

#### Behavior

```txt
load active run
→ read run.json.brief or handoff seed
→ create/update plan.json
→ set phase = planned
→ set verdict = unreviewed
→ append ledger event
→ show panel/status summary
```

#### Output

- goal
- non-goals
- constraints
- acceptance criteria
- implementation steps
- required evidence
- detected checks

---

### 3.4 `/code-check`

#### Purpose

Collect evidence and run configured checks.

#### Behavior

```txt
load active run
→ collect git status/diff evidence
→ run configured checks
→ save latest check outputs
→ update evidence/index.json
→ classify failures
→ detect risk gates
→ calculate verdict
→ update panel
```

#### Evidence files

```txt
evidence/git-status.txt
evidence/git-diff-stat.txt
evidence/git-diff.patch
evidence/typecheck.txt
evidence/test.txt
evidence/lint.txt
evidence/build.txt
```

Check output files are latest snapshots.  
Repeated `/code-check` runs overwrite the same check files.

Ledger entries preserve event summaries, but MVP does not provide a full immutable artifact archive.

---

### 3.5 `/code-status`

#### Purpose

Show the current run state in a human-readable format.

#### Behavior

Read-only in MVP.

```txt
load active run
→ load plan
→ load evidence index
→ read ledger summary
→ render detailed status
```

#### Sections

```txt
Run
Source
Phase
Verdict
Risk
Progress
Evidence
Blockers
Next
```

---

### 3.6 `/code-report`

#### Purpose

Generate a final report for the current run.

`/code-report` should still generate a report when the run is incomplete or failing.

#### Behavior

```txt
load active run
→ load plan/evidence/ledger
→ calculate final verdict
→ write report.md
→ update phase/verdict
→ append ledger event
→ show final panel
```

#### Report path

```txt
.letta/cruise-code/runs/<run-id>/report.md
```

#### Report should include

- task summary
- source
- final phase/verdict
- acceptance criteria
- evidence by criterion
- checks run
- failures or missing evidence
- blockers
- next recommended action

---

## 4. Storage Layout

Final MVP storage layout:

```txt
.letta/cruise-code/
  config.json
  active.json
  runs/
    <run-id>/
      run.json
      plan.json
      prototype-contract.json       # prototype runs only
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
      prototype-review-packet.md    # prototype runs only
      prototype-review-packet.json  # prototype runs only
```

### Removed from MVP run files

```txt
brief.md
checks.json
handoff.md
```

Rationale:

- `brief.md` is merged into `run.json.brief`.
- `checks.json` is merged into `plan.json.checks`.
- `handoff.md` is removed because `report.md` and state files can serve next-session needs.

---

## 5. Config

Path:

```txt
.letta/cruise-code/config.json
```

Example:

```json
{
  "schema_version": 1,
  "storage_dir": ".letta/cruise-code",
  "checks": {
    "auto_detect": true,
    "required_by_default": ["typecheck"],
    "optional_by_default": ["test", "lint", "build"],
    "capture_git_diff": true,
    "allow_no_checks": false
  },
  "risk_gates": {
    "dependency_change": true,
    "db_migration": true,
    "large_deletion": true,
    "large_changed_files": true,
    "auth_security_keywords_raise_risk": true
  },
  "retention": {
    "max_closed_runs": 20,
    "max_age_days": 30,
    "auto_delete": false
  },
  "panel": {
    "enabled": true,
    "max_lines": 8
  }
}
```

### Retention behavior

MVP should not auto-delete old runs.

If retention thresholds are exceeded, CruiseCode may warn the user that cleanup is recommended.

Future versions may add:

```txt
/code-clean
/code-config retention
```

---

## 6. Active Run Pointer

Path:

```txt
.letta/cruise-code/active.json
```

Example:

```json
{
  "schema_version": 1,
  "active_run_id": "2026-07-11-login-redirect",
  "updated_at": "2026-07-11T23:30:00-03:00"
}
```

`active.json` remains separate from `config.json`.

Rationale:

```txt
config.json = stable settings
active.json = frequently changing active-run pointer
```

Merging them would save one file but create unnecessary config churn.

---

## 7. Run State

Path:

```txt
.letta/cruise-code/runs/<run-id>/run.json
```

Example:

```json
{
  "schema_version": 1,
  "run_id": "2026-07-11-login-redirect",
  "title": "Fix login redirect after expired session",
  "mode": "standard",
  "phase": "planned",
  "verdict": "unreviewed",
  "current_step_id": null,
  "brief": {
    "task": "Fix login redirect after expired session",
    "summary": "User should be redirected cleanly after an expired session.",
    "created_from": "manual"
  },
  "source": {
    "type": "manual",
    "handoff_path": null,
    "ux_run_id": null,
    "readiness": null
  },
  "workspace": {
    "cwd": "/path/to/project",
    "branch": null,
    "base_commit": null,
    "head_commit": null
  },
  "summary": {
    "steps_total": 0,
    "steps_done": 0,
    "evidence_collected": 0,
    "required_checks_passed": 0,
    "required_checks_total": 0,
    "risk": "unknown"
  },
  "blockers": [],
  "created_at": "2026-07-11T23:30:00-03:00",
  "updated_at": "2026-07-11T23:30:00-03:00"
}
```

### 7.1 Prototype extension

Prototype runs use `mode: "prototype"` and add a `prototype` object to `run.json`. It is also written separately as `prototype-contract.json` so a run can preserve:

- `ux_input`: direct-task `unverified` input or read-only external/CruiseUX handoff references
- `coverage_map`: inherited criterion references and their evidence status
- `evidence_plan`: runtime, interaction, visual, accessibility, and human-review dimensions
- `review_packet`: portable output status and the UX-validation-claim boundary

Direct prototype tasks have no inherited UX criteria. Valid external handoffs remain optional inputs; CruiseUX is not a runtime dependency.

---

## 8. State Model

### 8.1 Phase

```txt
draft
planned
active
checking
reviewing
blocked
closed
cancelled
```

| Phase | Meaning |
|---|---|
| `draft` | Brief exists, but no Evidence Contract yet |
| `planned` | Evidence Contract exists |
| `active` | Implementation/editing in progress |
| `checking` | Checks/evidence collection in progress or completed |
| `reviewing` | Evidence is being compared against acceptance criteria |
| `blocked` | Human decision, external issue, or safety gate |
| `closed` | Report generated and run ended |
| `cancelled` | Run intentionally stopped/discarded |

### 8.2 Verdict

```txt
unreviewed
needs_work
needs_evidence
ready_with_caveats
verified
```

| Verdict | Meaning |
|---|---|
| `unreviewed` | No verification judgment yet |
| `needs_work` | Implementation or checks failed |
| `needs_evidence` | Implementation may be okay, but proof is insufficient |
| `ready_with_caveats` | Core proof exists, but manual/optional checks remain |
| `verified` | Evidence Contract is satisfied |

### 8.2.1 Prototype verdicts

Prototype runs do not use `verified` to make a UX claim. They use the following verdicts in addition to the shared workflow phases:

| Verdict | Meaning |
|---|---|
| `prototype_evidence_incomplete` | Required implementation evidence is missing or an executable check failed |
| `prototype_ready_for_review` | Technical evidence is collected; a human or separate UX workflow must determine any UX verdict |
| `prototype_evidence_collected_with_caveats` | Core evidence exists, while optional or manual review evidence remains |
| `review_packet_ready` | A portable review packet was generated for external review |
| `promotion_blocked` | A blocker prevents promotion or review |

### 8.3 Step status

```txt
pending
active
done
blocked
skipped
```

### 8.4 Evidence status

```txt
collected
passed
failed
missing
not_applicable
```

---

## 9. Evidence Contract

Path:

```txt
.letta/cruise-code/runs/<run-id>/plan.json
```

`plan.json` is the Evidence Contract.

It includes acceptance criteria, implementation steps, and checks.

Example:

```json
{
  "schema_version": 1,
  "goal": "Fix login redirect after expired session",
  "non_goals": [
    "Do not redesign the login flow",
    "Do not change authentication provider behavior"
  ],
  "constraints": [
    "Preserve existing successful login behavior"
  ],
  "acceptance_criteria": [
    {
      "id": "ac-001",
      "text": "Expired sessions redirect users to the expected login path.",
      "source": "manual",
      "ux_ref": null,
      "status": "pending",
      "evidence_required": ["git_diff", "typecheck_output"]
    }
  ],
  "steps": [
    {
      "id": "step-01",
      "title": "Map current expired-session redirect path",
      "kind": "map",
      "status": "pending",
      "risk": "low",
      "acceptance_refs": ["ac-001"],
      "done_when": [
        "Relevant redirect/session files are identified"
      ],
      "evidence_required": ["code_references"]
    },
    {
      "id": "step-02",
      "title": "Update redirect behavior",
      "kind": "edit",
      "status": "pending",
      "risk": "medium",
      "acceptance_refs": ["ac-001"],
      "done_when": [
        "Expired sessions redirect correctly"
      ],
      "evidence_required": ["git_diff", "typecheck_output"]
    }
  ],
  "checks": [
    {
      "id": "typecheck",
      "label": "Typecheck",
      "command": "npm run typecheck",
      "required": true,
      "timeout_ms": 120000,
      "evidence_type": "typecheck_output"
    }
  ],
  "manual_checks": []
}
```

---

## 10. Ledger

Path:

```txt
.letta/cruise-code/runs/<run-id>/ledger.jsonl
```

The ledger is append-only.

MVP event set:

```txt
run_created
plan_created
phase_changed
evidence_added
check_started
check_finished
blocker_added
blocker_resolved
step_completed
report_created
run_cancelled
```

Example event:

```json
{
  "time": "2026-07-11T23:40:00-03:00",
  "event": "check_finished",
  "actor": "CruiseCode",
  "phase": "checking",
  "verdict": "needs_evidence",
  "step_id": null,
  "summary": "Typecheck passed",
  "data": {
    "check_id": "typecheck",
    "status": "passed",
    "exit_code": 0,
    "evidence_path": "evidence/typecheck.txt"
  }
}
```

Deferred event types:

```txt
brief_updated
step_started
review_finished
handoff_created
```

---

## 11. Check Detection

MVP focuses on JS/TS projects.

### 11.1 Package manager detection

Priority:

```txt
bun.lockb / bun.lock → bun
pnpm-lock.yaml       → pnpm
yarn.lock            → yarn
package-lock.json    → npm
package.json only    → npm
```

### 11.2 Script detection

From `package.json.scripts`:

| Check ID | Script names |
|---|---|
| `typecheck` | `typecheck`, `type-check`, `tsc` |
| `test` | `test`, `test:unit`, `unit` |
| `lint` | `lint` |
| `build` | `build` |

### 11.3 Command generation

Use consistent command generation:

```txt
npm run <script>
pnpm run <script>
yarn run <script>
bun run <script>
```

### 11.4 Required vs optional

Default:

```txt
typecheck = required when available
test      = optional
lint      = optional
build     = optional
```

If no required check is detected, CruiseCode should not mark the run as `verified` unless other explicit evidence is sufficient.

---

## 12. Evidence Collection

MVP collects:

```txt
git status --short
git diff --stat
git diff
check stdout/stderr
exit code
failure type
```

Evidence index path:

```txt
.letta/cruise-code/runs/<run-id>/evidence/index.json
```

Example:

```json
{
  "schema_version": 1,
  "items": [
    {
      "id": "ev-git-diff",
      "type": "git_diff",
      "path": "evidence/git-diff.patch",
      "status": "collected",
      "created_at": "2026-07-11T23:45:00-03:00"
    },
    {
      "id": "ev-typecheck",
      "type": "typecheck_output",
      "path": "evidence/typecheck.txt",
      "status": "passed",
      "command": "npm run typecheck",
      "exit_code": 0,
      "created_at": "2026-07-11T23:46:00-03:00"
    }
  ]
}
```

### 12.1 Evidence types

```txt
git_status
git_diff_stat
git_diff
typecheck_output
test_output
lint_output
build_output
manual_note
code_references
review_note
log
screenshot
```

`screenshot` is future/backlog, not MVP.

### 12.2 Latest snapshot model

MVP evidence files represent latest snapshots.

Repeated checks overwrite:

```txt
typecheck.txt
test.txt
lint.txt
build.txt
```

The ledger records event summaries, not immutable full artifacts.

---

## 13. Failure Classification

Check failures should be classified.

```txt
code_failure
environment_failure
missing_command
timeout
permission_denied
unknown
```

Mapping:

| Failure type | Result |
|---|---|
| `code_failure` | `needs_work` |
| `missing_command` | `needs_evidence` |
| `timeout` | `needs_evidence` or `blocked` |
| `environment_failure` | `blocked` |
| `permission_denied` | `blocked` |
| `unknown` | `needs_evidence` |

---

## 14. Verdict Rules

### 14.1 `verified`

Allowed only when:

```txt
required checks passed
required evidence collected
acceptance criteria sufficiently mapped to evidence
no unresolved blockers
```

### 14.2 `ready_with_caveats`

Use when:

```txt
core checks passed
git diff collected
manual/optional checks remain
```

### 14.3 `needs_evidence`

Use when:

```txt
checks are missing
required evidence is missing
no executable proof exists
manual QA is required but absent
```

### 14.4 `needs_work`

Use when:

```txt
required check failed
acceptance criterion is obviously unmet
implementation is incomplete
```

### 14.5 `unreviewed`

Use before any verification judgment.

---

## 15. Risk Gates

### 15.1 Blocking gates in MVP

CruiseCode should block or request human approval for:

```txt
dependency change
DB/migration change
large deletion
large changed-file count
```

Examples:

```txt
package.json
package-lock.json
pnpm-lock.yaml
yarn.lock
bun.lock
bun.lockb
migrations/
prisma/schema.prisma
supabase/migrations/
db/migrations/
```

Suggested thresholds:

```txt
changed_files > 20
deleted_lines > 500
```

### 15.2 Risk-only keywords

These keywords raise risk but do not automatically block in MVP:

```txt
auth
login
session
token
permission
role
security
```

Rationale: keyword-only blocking has too many false positives.

Examples that should not automatically block:

```txt
SessionTimer.tsx
tokenHelpers.ts
auth-helper.test.ts
```

---

## 16. Panel UI

Compact panel target: 8 lines including border.

Canonical format:

```txt
╭─ CruiseCode · <run-title> ───────────╮
│ Phase   <phase label> · <progress>   │
│ Now     <current action>             │
│ Proof   <evidence badges>            │
│ Verdict <verdict> · risk <level>     │
│ Next    <recommended command/action> │
│ Source  <manual|CruiseUX|handoff>    │
╰──────────────────────────────────────╯
```

Fixed line order:

```txt
Phase
Now
Proof
Verdict
Next
Source
```

### 16.1 Phase display labels

```txt
draft      → Brief
planned    → Plan
active     → Build
checking   → Check
reviewing  → Review
blocked    → Blocked
closed     → Closed
cancelled  → Cancelled
```

### 16.2 Proof symbols

```txt
✓ passed / verified
× failed
◉ collected
– not run
? unknown
! needs attention
… running
```

### 16.3 Style

Use calm cyan/blue base styling with semantic colors for pass/fail/risk.

Do not rely on color alone. Symbols and labels must carry meaning.

---

## 17. `/code-status` Format

Example:

```txt
CruiseCode Status

Run
- ID: 2026-07-11-login-redirect
- Source: manual
- Phase: Plan
- Verdict: unreviewed
- Risk: medium

Progress
– step-01 Map current expired-session redirect path
– step-02 Update redirect behavior

Evidence
– git diff: not collected
– typecheck: not run
– test: not run

Blockers
- none

Next
/code-check after implementation
```

---

## 18. Report Format

Path:

```txt
.letta/cruise-code/runs/<run-id>/report.md
```

Recommended sections:

```md
# CruiseCode Report: <title>

## Summary

## Final Verdict

## Source

## UX Input Status

## Evidence Matrix

## Limitations

## Portable Review Packet

## Acceptance Criteria

## Evidence

## Checks

## Blockers / Risks

## Missing Evidence

## Next Recommended Action

## Run Metadata
```

`report.md` replaces MVP `handoff.md`.

If next-session notes are useful, include them inside `report.md`:

```md
## Next-session notes
```

The four prototype-specific sections appear only for prototype runs. The paired `prototype-review-packet.md` and `prototype-review-packet.json` artifacts are portable review inputs; they do not represent a UX or product decision.

---

## 19. CruiseUX → CruiseCode Handoff Contract

### 19.1 Source of truth

CruiseCode MVP consumes:

```txt
implementation-handoff.json
```

No `.md` fallback parser in MVP.

CruiseUX may later generate:

```txt
implementation-handoff.md
```

as an optional human-readable view, but JSON remains source of truth.

### 19.2 Required fields

```txt
readiness
brief
acceptance_criteria
non_goals
constraints
open_questions
```

`open_questions` may be an empty array.

### 19.3 Optional fields

```txt
implementation_hints
risks
suggested_checks
source_artifacts
```

### 19.4 Example

```json
{
  "schema_version": 1,
  "handoff_type": "cruiseux_to_cruisecode",
  "producer": {
    "mod": "CruiseUX",
    "run_id": "workspace-template-flow",
    "created_at": "2026-07-11T23:50:00-03:00"
  },
  "readiness": {
    "status": "implementation_ready",
    "confidence": "medium",
    "reason": "UX spec and review are complete."
  },
  "brief": {
    "title": "Workspace template selection flow",
    "problem": "Reduce setup steps when a user starts a new workspace.",
    "approved_direction": "After login, recently used templates are available. Selecting one opens workspace setup.",
    "user_flow_summary": "Login → select a template → workspace setup opens with the selected template."
  },
  "acceptance_criteria": [
    {
      "id": "ux-ac-001",
      "text": "After login, selecting a template opens workspace setup.",
      "priority": "must",
      "type": "functional",
      "evidence_required": ["git_diff", "manual_note"]
    }
  ],
  "non_goals": [
    "Do not redesign the sign-in flow."
  ],
  "constraints": [
    "Preserve existing template selection behavior."
  ],
  "open_questions": []
}
```

### 19.5 Mapping to CruiseCode plan

CruiseCode maps UX criteria into `plan.json.acceptance_criteria[]`.

Example:

```json
{
  "id": "ac-001",
  "text": "After login, selecting a template opens workspace setup.",
  "source": "cruiseux:workspace-template-flow",
  "ux_ref": "ux-ac-001",
  "status": "pending",
  "evidence_required": ["git_diff", "manual_note"]
}
```

### 19.6 Readiness behavior

```txt
implementation_ready → proceed
prototype_ready      → proceed with caveat
needs_review         → block and recommend UX review
not_ready            → block
blocked              → block
```

Any blocking open question should block CruiseCode implementation.

### 19.7 Prototype handoff behavior

Prototype mode accepts the same valid JSON handoff schema from CruiseUX or an external producer. Optional `scenarios`, `states`, and `design_refs` fields are consumed when present and otherwise remain unassessed.

```txt
valid handoff  → inherited_read_only UX input → implementation/coverage evidence
direct task    → unverified UX input          → technical evidence only
invalid explicit handoff → block; do not silently fall back to a direct task
```

The resulting packet is portable. CruiseUX can consume it later, but its presence is never required to run CruiseCode.

---

## 20. Implementation Architecture

MVP file:

```txt
~/.letta/mods/cruise-code.js
```

Internal architecture should be modular even if implemented in one file.

### 20.1 Layers

```txt
Command Layer
  /code-cruise
  /code-plan
  /code-check
  /code-status
  /code-report

Core Layer
  state manager
  schema/defaults
  ledger writer
  evidence manager
  check detector/runner
  risk detector
  handoff resolver
  verdict calculator

UI Layer
  panel renderer
  status formatter
  report formatter
```

### 20.2 Suggested section order

```txt
1. Imports and constants
2. Storage paths
3. Schema/default builders
4. Utilities
5. State manager
6. Ledger writer
7. Handoff resolver
8. Plan / Evidence Contract builder
9. Check detector
10. Evidence collector
11. Risk detector
12. Verdict calculator
13. Panel renderer
14. Status/report formatters
15. Command handlers
16. Mod registration
```

### 20.3 Core function groups

```txt
ensureStorageRoot()
createRun()
loadActiveRun()
saveRun()
setActiveRun()
loadPlan()
savePlan()
loadEvidenceIndex()
saveEvidenceIndex()

appendLedger()

resolveHandoffFile()
validateHandoff()
handoffToPlanSeed()

buildPlanFromTask()
buildPlanFromHandoff()
revisePlan()

detectPackageManager()
readPackageJson()
detectScripts()
buildCheckCommands()
runCheck()
runAllChecks()
classifyCheckFailure()

collectGitEvidence()
addEvidence()
updateEvidenceStatus()

detectRiskFromGit()
detectRiskFromFiles()
detectHumanGates()

calculateVerdict()

renderPanel()
formatStatus()
buildReportMarkdown()
```

---

## 21. Implementation Order

Recommended implementation order:

```txt
1. Storage/state manager
2. Ledger writer
3. Panel renderer
4. /code-status skeleton
5. /code-plan skeleton
6. Check detection
7. Evidence collector
8. /code-check
9. /code-report
10. /code-cruise orchestration
11. Handoff resolver
12. Risk gates
```

Rationale:

`/code-cruise` is the flagship command, but it orchestrates other components. Building it too early may create tangled logic.

---

## 22. Error Handling

Error categories:

```txt
user_error
environment_error
internal_error
```

### user_error

Examples:

```txt
No active CruiseCode run.
Handoff file not found.
Task is too vague.
```

Behavior:

```txt
Guide the user.
Do not mutate phase unless necessary.
```

### environment_error

Examples:

```txt
Package manager missing.
Permission denied.
Command timeout.
```

Behavior:

```txt
May move phase to blocked.
Add blocker event when appropriate.
```

### internal_error

Examples:

```txt
run.json parse failure.
schema mismatch.
unexpected exception.
```

Behavior:

```txt
Preserve recoverability.
Show repair guidance.
Avoid overwriting state blindly.
```

---

## 23. MVP Exclusions

Excluded from MVP:

```txt
/code-review
separate /code-resume command
/code-config
/code-cancel
/code-cruise --loop actual recovery
/code-cruise --auto full automation
automatic subagent orchestration
automatic worktree creation
native Go/Rust helper
PR/commit automation
automatic dependency approval
automatic DB migration approval
Python/Rust/Go project detection
Playwright/browser visual QA
screenshot evidence
CI import
coverage parsing
flaky test detection
```

---

## 24. Future Backlog

### Deferred workflow candidates

```txt
/code-review
/code-resume
/code-config
/code-cancel
full /code-cruise --from-ux <run-id>
CruiseUX handoff generation cleanup
manual QA evidence input
stronger handoff schema validation
/code-clean
```

### Deferred validation and execution candidates

```txt
Checker subagent
Mapper subagent
limited /code-cruise --loop recovery
worktree mode
screenshot evidence
Playwright/browser QA
```

### Longer-term platform candidates

```txt
Python/Rust/Go project detection
CI result import
coverage parsing
flaky test detection
per-project custom adapters
optional native Go/Rust helper
official package structure
```

---

## 25. Success Criteria

### 25.1 New run

Command:

```txt
/code-cruise "Fix login redirect after expired session"
```

Expected:

```txt
.letta/cruise-code/runs/<run-id>/ created
run.json created
plan.json created
ledger.jsonl created
evidence/index.json created
active.json updated
panel displayed
```

### 25.2 Plan

Command:

```txt
/code-plan
```

Expected:

```txt
Evidence Contract created or updated
phase = planned
verdict = unreviewed
status shows acceptance criteria and steps
```

### 25.3 Check

Command:

```txt
/code-check
```

Expected:

```txt
git status/diff evidence saved
available checks executed
check output saved as latest snapshot
evidence/index.json updated
verdict calculated
panel proof line updated
```

### 25.4 Status

Command:

```txt
/code-status
```

Expected:

```txt
Run state displayed clearly
Phase/verdict shown separately
Evidence and blockers shown
Next action suggested
```

### 25.5 Report

Command:

```txt
/code-report
```

Expected:

```txt
report.md generated
final verdict shown
missing evidence explicitly stated
phase updated to closed when appropriate
```

---

## 26. Final MVP Summary

CruiseCode MVP should be small, clear, and trustworthy.

It should not over-automate.

It should make this possible:

```txt
Task → Evidence Contract → Code/check evidence → Verdict → Report
```

The core promise:

```txt
CruiseCode does not just say work is done.
CruiseCode shows why it can or cannot be trusted.
```

---

## 27. Competitive Positioning

CruiseCode should not be positioned as a bigger or stronger autonomous coding harness than OmO, LazyCodex, OMC/OMX, Gajae-Code, Hermes, Superpowers, or AmpCode.

Its clearest position is narrower:

```txt
CruiseCode is an evidence-first implementation layer for Letta Code.
```

Expanded:

```txt
CruiseCode turns coding tasks and UX handoffs into verifiable contracts, evidence, verdicts, and reports.
```

### 27.1 Differentiation

CruiseCode differs from larger coding-agent harnesses in these ways:

1. **Letta-native mod** — it runs as a local Letta Code mod, not as a separate CLI/runtime/harness.
2. **Evidence-first workflow** — the core unit is `task → Evidence Contract → evidence → verdict → report`.
3. **UX-to-code handoff** — CruiseUX acceptance criteria can be preserved as implementation criteria via `ux_ref`.
4. **Phase/verdict separation** — a run can be closed without being verified; completion and trust are different states.
5. **Conservative verification** — `verified` is not allowed without sufficient evidence.
6. **Report as artifact** — `report.md` is a first-class output for team handoff, QA, and future-session recovery.
7. **Small MVP surface** — multi-agent orchestration, worktrees, auto-loop recovery, and model routing are intentionally deferred until state/evidence/report flows prove stable.

### 27.2 Comparison summary

| Tool | Primary strength | CruiseCode distinction |
|---|---|---|
| OmO | Multi-model/multi-agent orchestration, team mode, hooks, MCPs | CruiseCode is smaller and focuses on evidence/verdict/report inside Letta Code |
| LazyCodex | Codex distribution for OmO-style planning, Boulder progress, verified completion | CruiseCode shares verification concern but is Letta-native and UX-handoff oriented |
| OMC/OMX | Codex CLI workflow/runtime layer with deep-interview, ralplan, ultragoal, team | CruiseCode is not a Codex wrapper; it is a Letta Code evidence layer |
| Gajae-Code | Deep-interview → ralplan → ultragoal workflow harness | CruiseCode adapts the durable/evidence idea into Evidence Contract + verdict/report |
| Hermes Agent | General-purpose self-improving agent runtime/toolset/gateway | CruiseCode is intentionally narrow: coding evidence tracking inside Letta Code |
| Superpowers | Cross-host SKILL.md development methodology and subagent-driven workflows | CruiseCode is an executable mod/state system; future skills may emerge from repeated usage |
| AmpCode | Frontier coding agent runtime with subagents, handoff/context control, modes | CruiseCode handoff is product/UX criteria → code evidence mapping, not primarily thread/context transfer |

### 27.3 Why this matters

AI coding work increasingly fails less because code cannot be generated and more because teams cannot reliably answer:

- What exactly was the task supposed to satisfy?
- Which acceptance criteria were implemented?
- What evidence supports each claim?
- Which checks passed or failed?
- What remains unverified?
- Can this be handed to another session, teammate, QA pass, or implementation follow-up?

CruiseCode should focus on this trust gap.

```txt
CruiseCode does not just say work is done.
CruiseCode shows why it can or cannot be trusted.
```

### 27.4 Future inspiration, not MVP scope

CruiseCode may later borrow patterns from larger harnesses, but these should remain future additions until usage justifies them:

- From OmO / LazyCodex: Boulder-style durable progress, loop recovery, quality gate reviewer.
- From Gajae-Code / OMC: stronger planning/revision gates and durable goal reconciliation.
- From Superpowers: TDD workflow, two-stage review, worktree discipline, subagent-driven development.
- From AmpCode: focused handoff/context distillation and permission/risk gates.
- From Hermes: toolset thinking, scheduled review/cleanup, and self-improvement loops.

These should not obscure the MVP promise: evidence-first implementation tracking for Letta Code.
