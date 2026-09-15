# Cruise design — local-only alpha

## Purpose and provenance
Cruise unifies decision-oriented UX work and scoped coding under one `/cruise` entry.
This local repository inherits CruiseCode commit history; UX guidance is imported
from the installed `cruise-ux.js` source, not represented as inherited UX Git history.
The original repositories and installed mods remain unchanged. This alpha does not
imply remote creation, publication, installation, or automatic migration.

## Surface and progressive guidance
`/cruise <request>` routes work; `status`, `resume`, `check`, and `help` are controls.
Natural language provides a routing hint, not approval or a semantic authority.
The mod reads and embeds only `skills/cruising/SKILL.md`, with a selected reference
path for the agent to read. Bulky UX/code/delta protocols stay in references.
Framing, research, adaptive interviews, diverse concepts, specs/test plans, reviews,
implementation, and small deltas remain available activities, not old slash aliases.
A full UX pipeline is optional; a minor fix does not warrant rediscovery or restyling.
There is no parallel scheduler or automatic retry loop.

## Contract and tool responsibilities
The schema-version-1 contract records goal, inspect/implement intent, low/high risk,
requirements (`id`, `text`, `required`), non-goals, constraints, and checks (`id`, label,
bin, args, requirement IDs, required, timeout, exit-code/output-includes assertion).
The precise schema and workflow live in the code reference. Stable requirement IDs
connect UX criteria, implementation, and checks rather than relying on completion prose.

| Tool | Responsibility |
| --- | --- |
| `cruise_update` | State writes: contract, checkpoint, finish, explicit JSON import_handoff |
| `cruise_approve` | Human approval with alwaysAsk |
| `cruise_verify` | Execute checks and capture evidence with requiresApproval: true |

Update arguments are `{action, contract?, phase?, summary?, blockers?, handoff_path?}`;
blockers have `id`, `reason`, and `status: open|resolved`. Callers cannot assign verified
or approval. Runs bind contract hash/version and workspace to requirement/check evidence.
Use the approval tool once for the exact initial implementation contract, then reuse
approval until request/contract changes. Routing never mints authorization. This is a
deliberately conservative alpha boundary, not a per-stage approval loop.
Finish evaluates actual evidence, or concludes inspection as `review_ready`.
`turn_end` never finishes automatically. Review readiness is not behavioral verification.

## Evidence and limits
Discover stack-specific checks and explain which observable criteria they cover.
Build/typecheck success is not proof of behavior. ID linkage, freshness checks, and
assertions are mechanical safeguards; semantic adequacy is still agent/human judgment.
Tests can be too weak, source claims can be wrong, and user research can be missing.
Stakeholder preferences are not actual-user observations. Preserve sources and gaps.
Browser work must use Aside, never Playwright, including in scripts.
Delta work reuses scope and parent requirements, not automatically fresh old evidence.
Uncertainty can justify explicit scope expansion, not a silent full-pipeline redo.
Cruise gates its own acceptance; it does not sandbox all host tools or guarantee
that every edit went through a Cruise gate. Host permissions and review remain necessary.

## Compatibility boundary
Legacy `.letta/cruise-code` and `.letta/cruise-ux` remain untouched and are never
auto-migrated. Import requires explicit JSON through the external handoff adapter;
it is not a legacy-run importer and does not inherit approvals or evidence.
The installed UX source has no handoff producer. New UX work can submit a contract
directly using the same requirement IDs. Existing legacy lessons/export interfaces
are read-only context, not active new export support; no generic lesson generation.
