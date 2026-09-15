# Local alpha validation

Validated 2026-09-13 (local date), before installation/publication.

Follow-up: [local installation transition, 2026-09-14](local-installation.md) records the installed-package and real App Server validation separately from this initial source test.

## Executed

- `npm test`: **48 passed, 0 failed**. Tests use temporary Git fixtures without commits/config changes, pure contract tests, a mock Mod host, and real subprocess checks.
- `npm run check`: passed syntax checks, single `/cruise` registration, three tool registrations, bundled workflow completeness.
- `git diff --check`: passed.
- Official `validate-skill.ts` and `package-skill.ts` via Bun: passed; ignored artifact `dist/cruising.skill` generated.
- `npm pack --dry-run --json`: passed. Package allowlist excluded legacy source, tests, `.letta`, local logs, credentials and development output. No publication performed.
- Original CruiseUX/CruiseCode repositories had no tracked diff; installed CruiseCode still matched its original source. Their remotes and installation were not changed.

## Regression targets

Coverage includes incomplete/failing work remaining resumable, actual behavioral checks, absent/stale evidence, changed contracts, missing artifacts, state/log metadata disagreement, zero-required-evidence contracts, inspection wording, exact approval, takeover ownership, overlapping operation locks, safe report replacement, parent context without inherited proof, external handoff IDs, and untouched legacy stores.

Independent read-only review identified five blockers: former-owner mutation after takeover, dangling report links, log/state metadata mismatch plus old-hash execution, no-evidence verification, and routing used as authorization. All were addressed with source changes and regression coverage. Routing now never mints approval; the first exact implementation contract uses a human gate.

## Not verified

- Actual installation/reload, live Desktop/TUI tool exposure, human approval UI, or live-model task execution.
- Faster total task time/token consumption versus the old mods; no efficiency claim follows from unit tests.
- Runtime, DB, environment variables or ignored-file freshness beyond explicitly executed checks.
- Semantic adequacy of the agent's requirement-to-assertion mapping, or general host-tool sandboxing.
- Cross-worktree run relocation, automatic legacy-run migration, manual evidence approval, parallel scheduling or autonomous repair loops.

Next acceptance step: user-approved local installation switch, then one inspection task, one small implementation/failing-check recovery, and one partial follow-up in an already selected worktree. Keep old installations available for rollback; do not run both old mods alongside the new package by default.
