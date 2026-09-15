---
name: cruising
description: Coordinate scoped UX discovery, research, interviews, concepts, specifications, reviews, implementation, and small follow-up fixes with Cruise contracts, human gates, and fresh requirement-linked evidence. Use for /cruise requests or continuing a Cruise run, not as permission to implement a review.
---

# Cruising

## Entry and routing
- Use `/cruise <request>`; controls are `/cruise status`, `resume`, `check`, and `help`.
- Natural-language classification is a routing hint, never implementation authority.
- Read the selected reference before work; load another only when scope requires it:
  - [UX](references/ux.md): frame, research, adaptive interview, concepts, spec, prototype/test planning, review.
  - [Code](references/code.md): contract details, project checks, implementation and acceptance.
  - [Delta](references/delta.md): narrow follow-up fixes retaining parent scope and requirement IDs.
- Choose only needed activities. A review, interview, research brief, or tiny fix is not a full pipeline.
- Start Cruise from the final selected Git root/worktree. Do not switch cwd during an active run: this alpha does not relocate run state across worktrees.
- Reuse known context; clarify only uncertainty that changes scope, risk, criteria, or the next decision.

## Contract before execution
- State goal, `intent` (`inspect` or `implement`), `risk` (`low` or `high`), requirements,
  non-goals, constraints, and requirement-linked checks; preserve stable requirement IDs.
- Submit `cruise_update` with `action: contract`; contract schema is in the code reference.
- Distinguish actual-user observations, stakeholder decisions, assumptions, and untested hypotheses.
- A run binds its contract hash/version and workspace to evidence and approval; changed scope is not old permission.
- Use `cruise_approve` (alwaysAsk) once for the exact initial implementation contract; pass `action: contract`, the returned `contract_hash`, and the full `contract`.
- Reuse that approval while request and contract are unchanged. Do not ask at every stage. Changed scope, risk or check commands require a new contract approval.
- Never claim approval yourself or treat a classifier, imported file, plan, or checkpoint as human approval.

## Work and evidence
- `cruise_update` arguments: `{action, contract?, phase?, summary?, blockers?, handoff_path?}`.
- Actions: `contract`, `checkpoint`, `finish`, `import_handoff`; blockers: `{id, reason, status: open|resolved}`.
- Use checkpoints for progress and unresolved uncertainty, not caller-assigned verified status.
- Discover checks from the actual project; bind them to observable requirements and explain their selection.
- `cruise_verify` runs checks with `requiresApproval: true`; success text from the agent is not execution evidence.
- Evidence must be fresh for the contract hash/version, requirement/check IDs, and workspace.
- Typechecking/building alone does not establish behavior. Semantic check selection remains agent judgment, not deterministic proof.
- For browser inspection, interaction, screenshots, and tests use Aside ONLY; never Playwright, including via scripts.
- Keep edits in scope. Do not restyle source for a minor fix, install dependencies, publish, or change unrelated files without authorization.
- No parallel scheduler or automatic retry loops. Report a failure and choose a bounded next step with appropriate approval.

## Stop and report
- Call `finish` only to evaluate actual evidence, or conclude inspection as `review_ready`.
- The tool decides acceptance; never submit caller-assigned verified or approved state.
- `turn_end` never completes a run automatically. Unmet criteria and open blockers stay visible.
- Report scope, decisions, changed artifacts, requirement-linked results, missing evidence, and remaining risks.
- Inspect completion means review-ready, not implemented, behaviorally verified, or approved to build.
- Resume by inspecting saved contract, blockers, approval, and evidence freshness, not by replaying a pipeline.
- Import only an explicitly supplied JSON handoff using `import_handoff` and `handoff_path`.
- Legacy `.letta/cruise-code` and `.letta/cruise-ux` are never automatically migrated; imported claims are not fresh evidence.
- Do not generate generic lesson candidates. Existing legacy lessons/export interfaces are read-only context, not active new export functionality.

## Boundary
Cruise gates its own acceptance, not every host tool. Host permissions still apply; this local-only alpha is not a sandbox or a guarantee of semantic correctness.
