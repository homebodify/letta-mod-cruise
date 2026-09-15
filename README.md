# Cruise

[English](https://github.com/homebodify/letta-mod-cruise/blob/main/README.md) | [한국어](https://github.com/homebodify/letta-mod-cruise/blob/main/README.ko.md)

One entry point for UX discovery, scoped implementation, and follow-up changes. Run only the process the change needs; verify what you claim.

Cruise is a Letta Code mod for working on a change end to end: frame the decision, research it, review an artifact, implement a bounded change, or fix a follow-up delta — then prove what was done with real command evidence instead of claiming completion. It is the successor of two earlier mods: [CruiseUX](https://github.com/homebodify/letta-mod-cruiseux), which guided UX/UI discovery (framing, research, adaptive interviews, ideation, specs, decision-readiness review), and [CruiseCode](https://github.com/homebodify/letta-mod-cruisecode), an evidence-first coding workflow (contracts, live progress, check evidence, verdicts, reports). Those capabilities now share one contract, one run state, and one command. The original repositories remain as read-only archives.

**Alpha.** The author's local installation has switched to Cruise with rollback backups; original repositories and run records remain intact. See [installation validation](https://github.com/homebodify/letta-mod-cruise/blob/main/docs/local-installation.md). For what changed relative to the earlier mods, see [migration notes](https://github.com/homebodify/letta-mod-cruise/blob/main/docs/migration.md) and [provenance](https://github.com/homebodify/letta-mod-cruise/blob/main/NOTICE.md).

## Commands

| Command | Purpose |
| --- | --- |
| `/cruise <request>` | Explore, review, implement, or make a partial change |
| `/cruise status` | Inspect state and evidence freshness without a model call |
| `/cruise resume` | Resume unfinished or newly stale work |
| `/cruise check` | Execute approved checks and write a report without a model call |
| `/cruise help` | Show short help locally |

Only `/cruise` is registered. UX interviews, research, alternatives, specification, and review remain available internally—not as separate slash commands.

```text
/cruise Review the onboarding flow; do not implement yet
/cruise Fix the empty-search result message
/cruise resume
/cruise check
```

Natural-language routing is a convenience hint, not permission. Unclear requests start with inspection. This alpha asks once for the exact initial implementation contract, including check commands; it reuses that approval until the request or contract changes. There are no per-stage gates. Keyword-based silent approval is intentionally not implemented.

## Implemented

- Shared versioned contract: stable requirement IDs, constraints, non-goals and explicit check bindings.
- Partial-change guidance and parent context reuse; historical evidence is not copied as current proof.
- Real subprocess evidence with timeouts, cancellation, output caps, explicit assertions and requirement coverage.
- Contract/workspace fingerprinting and artifact hashes: stale or missing evidence cannot silently remain verified.
- Separate phase and verdict: failed or incomplete work remains resumable.
- Explicit checkpoints and finish: no success on turn-end, clarification or interruption.
- Per-conversation active runs, exclusive workspace ownership and a cross-process operation lock.
- Exact-contract approval through an always-ask tool; explicit ownership takeover.
- Read-only external JSON handoff import. Legacy readiness/approval never becomes current verification.
- Three agent tools: `cruise_update`, `cruise_approve`, `cruise_verify`.

`verified` means all required **declared** checks and requirements have fresh successful evidence. The agent/human still must judge whether those assertions prove the requested behavior. A typecheck does not implicitly cover behavior. Technical verification does not establish usability or user acceptance.

## Development

Node 22+ and Git are required. There are no package dependencies and no install step for tests.

```bash
npm test
npm run check
npm pack --dry-run
```

Tests create temporary Git fixtures without commits or Git configuration changes. They mock the host API and run real local verification processes; they are not a live Desktop acceptance test.

Use the complete package directory; `mods/index.mjs` imports `src/` and reads bundled skill files. **Do not copy the entrypoint alone to global mods.** Installation and old-mod deactivation are a separate, user-approved step. `private: true` blocks accidental npm publication pending licensing/publication review. The API targets Letta Code 0.32.1; verify the live host before installation.

## Storage and limits

The selected cwd (Git root or project subdirectory) contains private state at `.letta/cruise/`: owner-specific active pointers and `runs/<uuid>/{run.json,report.md,evidence/*.log}`. Git-root `.letta/cruise/{owner.json,operation.lock}` coordinates the entire worktree, so changing subdirectories cannot bypass an unfinished owner or active operation. Takeover must be requested from the original scope.

- No startup state writes, background loops, auto-commits, auto-pushes, dependency installs or remote calls are introduced by the lifecycle.
- Checks execute trusted project scripts. String filters are not a sandbox and cannot prove arbitrary subprocess behavior safe. Host permissions still apply. Colocated hashes catch inconsistencies, not a same-user attacker able to rewrite both state and artifacts.
- Fingerprints cover Git-listed tracked and untracked content, excluding `.letta` and ignored untracked files. Known secrets use metadata, not content reads. Runtime/DB/environment state needs explicit observations and rechecks; it is not certified by file fingerprints.
- Evidence covers all Git-listed files under the selected cwd, with paths relative to that cwd; checks execute there. Siblings outside that scope are not read or certified. The unchanged 64 MiB content cap applies within the scope. Submodules and symlinks escaping the scope fail closed. Git HEAD and canonical Git-root/scope identity also bind the fingerprint.
- Subdirectory implementation contracts must explicitly provide `dependencies`: relevant local dependency file paths relative to cwd (`[]` declares no additional dependencies). Every declared file must be content-covered inside the scope; traversal, absolute, ignored, missing, secret and symlink dependencies block certification. Shared parent/sibling dependencies require selecting a containing scope, not silently omitting them or increasing the cap. This declaration is human-reviewed and hash-bound; arbitrary scripts/import graphs, runtime state and semantic relevance are not inferred or sandboxed.
- Output logs may contain secrets. Keep `.letta/` out of version control. Cruise itself does not upload source/logs.
- A crash may leave `operation.lock`. Confirm the recorded process has stopped before manual recovery. Takeover never bypasses an active operation lock.
- Select the intended project cwd within its Git worktree before invoking Cruise. No directory moves or nested Git initialization are needed. Run identity binds canonical Git root and selected scope; active runs do not relocate across cwd/worktree changes. Symlink aliases of the same cwd share identity.
- Existing root runs remain readable without rewriting contracts or approvals, but versioned scope fingerprints invalidate old evidence until checks are rerun. Unversioned subdirectory state and copied runs fail closed; there is no automatic state migration.
- No automatic legacy-run migration, manual evidence approval workflow, parallel scheduler or repair loop is claimed. Human/visual review remains explicit workflow work, not implicitly certified evidence.

[Design](https://github.com/homebodify/letta-mod-cruise/blob/main/docs/design.md) · [Migration](https://github.com/homebodify/letta-mod-cruise/blob/main/docs/migration.md) · [Official Mod API](https://docs.letta.com/configuration/mods/index.md)
