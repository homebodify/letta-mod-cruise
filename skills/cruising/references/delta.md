# Delta: narrow follow-up without replaying discovery

## Recover context
Use for a small correction, regression, polish request, or follow-up to prior work.
Read the parent scope, requirements and IDs, decisions, constraints, relevant source,
tests, known blockers, and current workspace changes. Reuse context, not old proof.
If parent scope is unavailable, reconstruct a minimal explicit contract and disclose
the missing lineage rather than inventing a parent run or assumed authorization.

## Bound the change
State the requested delta, affected parent requirement IDs, acceptance criteria,
non-goals, and plausible regression surface. Preserve IDs for unchanged meanings;
give genuinely new requirements new IDs and explain any changed interpretation.
Do not redo research/interviews/concepts/specification for a minor fix without cause.
Do not restyle source or broaden refactoring just because nearby code looks untidy.
Review-only remains inspect: diagnose and suggest, but do not implement without an
explicit human gate. A classifier calling work a delta is not authority to edit.
Obtain `cruise_approve` (alwaysAsk) once for the delta contract, not for every stage.
Continue within the same approved contract; scope/risk/check changes require renewed approval.

## Check related behavior
Read the code reference for contract schema and check execution rules. Discover the
actual project stack, then select checks for affected criteria plus adjacent regression
risks. Explain why each is relevant; a typecheck alone does not establish behavior.
Carry parent requirement IDs into the new contract and mapped checks. Retained parent
evidence may explain a decision but is not automatically fresh for this contract
hash/version, requirement/check IDs, or workspace. Rerun required relevant checks via
`cruise_verify` (`requiresApproval: true`) after edits.
Browser work ALWAYS uses Aside, never Playwright, including through scripts.
For a visual/interaction delta inspect the affected state and meaningful adjacent
states with Aside; keep the observation distinct from actual-user validation.
Do not silently drop required parent criteria to make a finish pass. Explain what is
retained, what is out of delta scope, and why; material scope changes need the gate.

## Let uncertainty expand scope deliberately
Unexpected behavior, unclear user intent, inaccessible evidence, shared infrastructure
impact, or safety/security risk can invalidate the narrow plan. Stop, checkpoint the
new blocker, explain the smallest expanded investigation, revise the contract, and
obtain required approval before expanded implementation.
Load only the needed UX activity if uncertainty concerns workflow or a product
decision. Do not default to a full pipeline. No automatic retry loop or parallel scheduler.

## Close honestly
Checkpoint what changed and why with `{id, reason, status: open|resolved}` blockers.
Ask `finish` to evaluate fresh actual evidence or conclude inspect as `review_ready`;
never assign verified/approved yourself and never finish merely because a turn ended.
Report delta scope, preserved requirements, related tests, observed outcomes, and
remaining uncertainty. Explain semantic coverage limits even when all checks pass.
Cruise acceptance is not a host-tool sandbox; it cannot guarantee that every edit or
test outside its tools obeyed the contract.
