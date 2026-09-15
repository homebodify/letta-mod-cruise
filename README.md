# Cruise

[English](README.md) | [한국어](README.ko.md)

One entry point for UX discovery, scoped implementation, and follow-up changes. Run only the process the change needs; verify what you claim.

**Local alpha — not publicly released.** The author's local installation has switched to Cruise with rollback backups; original repositories and run records remain intact. See [installation validation](docs/local-installation.md). This repository retains CruiseCode history and incorporates CruiseUX workflow guidance; see [provenance](NOTICE.md).

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

`verified` means all required **declared** checks and requirements have fresh successful evidence. The agent/human still must judge whether those assertions prove the requested behavior. A typecheck does not implicitly cover behavior. Technical verification does not establish usability, clinical validity or user acceptance.

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

The selected Git repository/worktree root contains private state at `.letta/cruise/`: owner-specific active pointers, `owner.json`, and `runs/<uuid>/{run.json,report.md,evidence/*.log}`.

- No startup state writes, background loops, auto-commits, auto-pushes, dependency installs or remote calls are introduced by the lifecycle.
- Checks execute trusted project scripts. String filters are not a sandbox and cannot prove arbitrary subprocess behavior safe. Host permissions still apply. Colocated hashes catch inconsistencies, not a same-user attacker able to rewrite both state and artifacts.
- Fingerprints cover Git-listed tracked and untracked content, excluding `.letta` and ignored untracked files. Known secrets use metadata, not content reads. Runtime/DB/environment state needs explicit observations and rechecks; it is not certified by file fingerprints.
- Whole-workspace hashing is conservative: unrelated tracked changes can invalidate evidence. Above 64 MiB of content, or on submodules/external symlinks, verification fails closed. Dependency-scoped optimization is deferred.
- Output logs may contain secrets. Keep `.letta/` out of version control. Cruise itself does not upload source/logs.
- A crash may leave `operation.lock`. Confirm the recorded process has stopped before manual recovery. Takeover never bypasses an active operation lock.
- Select the intended Git root/worktree before invoking Cruise. Active runs do not automatically follow cwd switches to another worktree in this alpha.
- No automatic legacy-run migration, manual evidence approval workflow, parallel scheduler or repair loop is claimed. Human/visual review remains explicit workflow work, not implicitly certified evidence.

[Design](docs/design.md) · [Migration](docs/migration.md) · [Official Mod API](https://docs.letta.com/configuration/mods/index.md)
