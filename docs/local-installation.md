# Local installation transition — 2026-09-14 (updated 2026-09-15)

The user approved backing up/disabling the old installations, installing Cruise, and validating the transition. No repository deletion, commit, push, public release or automatic project-state migration was authorized or performed.

## Installed state

- CLI: Letta Code **0.32.8**, Desktop-bundled CLI selected by its shell shim.
- Enabled managed package: `npm:cruise@0.1.0-alpha.2` in the **local registry**. This registry name does not mean the package was published to npm.
- Installed root: `$HOME/.letta/mods/packages/npm/cruise`.
- Stable source snapshot: `$HOME/.letta/mod-sources/cruise/0.1.0-alpha.2-<timestamp>` (see install receipt below).
- Rollback backup: `$HOME/.letta/mod-backups/cruise-switch-20260914T221640Z` (original alpha.1-era switch backup, retained).
- The two old loose `cruise-ux.js` / `cruise-code.js` files are outside all Mod loading directories. Older CruiseCode backup files were also retained there, not deleted.
- Other installed packages and loose mods were left unchanged. Both original source repositories and project run stores remain intact.

### 2026-09-15 update — scoped workspace

The alpha.2 upgrade supersedes the alpha.1 install. Between 2026-09-14 and this commit, an uncommitted scoped-workspace change set (subdirectory execution support, `src/core/workspace.mjs`, `tests/scoped-workspace.test.mjs`) had already been copied into the installed package despite the unchanged alpha.1 version string. That state was discovered during inspection on 2026-09-15; the alpha.2 version bump makes the installed state identifiable again. Reinstall the alpha.2 snapshot from the committed source; do not trust the version string of a package that predates this commit.

## Verification layers

1. Source regression suite and package checks: 53 tests passed before the alpha.2 install (48 original + 5 scoped-workspace).
2. Installed package: all 19 snapshot files matched by SHA-256. Registry retained the pre-existing muscle-memory entry unchanged.
3. `scripts/verify-installed.mjs <installed-root>` reuses the same regression assertions with only import locations redirected to the installed package. It exercises inspection, implementation, failed-check recovery, follow-up changes, freshness, approvals and ownership with a test host and real processes.
4. `scripts/live-loader-smoke.mjs <installed-root>` starts the real CLI App Server in an isolated HOME/backend, creates an unpinned/no-MemFS fixture runtime, dispatches `/reload`, `/cruise help`, and `/cruise status`, and checks that legacy commands are absent. It does not restart/reload the user's current Desktop or request model inference. Its server, agent store and project fixture are removed after the probe.

The initial loader probe assumed runtime IDs were top-level and that custom commands returned the built-in response shape. The actual 0.32.8 protocol nests scope in `runtime` and completes custom commands through `slash_command_end` lifecycle deltas. The test was corrected against the installed runtime source and rerun, without changing Cruise behavior or weakening success assertions.

A separate early `letta -p '/cruise help' --ephemeral` probe produced a model reply rather than dispatching the slash command. That reply is **not** counted as command verification; use the App Server probe above.

## Remaining acceptance boundary

- Already-open Desktop sessions may retain the old registry until `/reload`. The isolated server reload does not prove the current user's session reloaded.
- Native Desktop approval UI and autonomous live-model execution across a full work cycle were not tested. Scripted regression and real command dispatch are distinct evidence layers.
- No measured token/time improvement is claimed.
- Local installs are represented as `npm:cruise` by this CLI. Do **not** run `letta mods update npm:cruise` to upgrade this private build: reinstall an explicitly verified local snapshot instead.

## Rollback

The backup directory contains `manifest.json` with original hashes, original files, prior registry snapshot, and `rollback.py`.

```bash
python3 "$HOME/.letta/mod-backups/cruise-switch-20260914T221640Z/rollback.py"
```

The script checks backup hashes, refuses to overwrite an existing old-mod file, disables only `npm:cruise`, restores both old files, and leaves unrelated registry entries alone. Run `/reload` in active sessions afterward. The rollback script was syntax-checked; rollback itself was not executed, since it would undo the requested installation.

## 2026-09-26 update — alpha.3 visible command failures

- Blocking `/cruise <request>`, `resume` and `check` failures now return a `prompt` result (system reminder) so the agent explains the failure in conversation; hosts may render plain command output faintly or not at all. The prompt states that no run was started and forbids calling Cruise tools. `status`/`help` failures stay model-free `output`.
- The 64 MiB budget error now names the counted total, the three largest top-level entries (with untracked bytes), and remedies: a smaller subdirectory, or `.gitignore` for untracked archives/build output. The budget itself is unchanged. Submodule errors now name the entry.
- Verification: 56/56 source tests (53 prior + 3 new), package check, live-loader smoke on the worktree and installed root.
- Installed as `npm:cruise@0.1.0-alpha.3` from snapshot `$HOME/.letta/mod-sources/cruise/0.1.0-alpha.3-20260926T195644Z`; prior alpha.2 install and registry backed up to `$HOME/.letta/mod-backups/cruise-alpha2-before-alpha3-20260926T195644Z/` (restore by copying `package/` back and restoring `packages.json`). Run `/reload` in open sessions.

## 2026-09-26 update — alpha.4 budget alternatives

- The 64 MiB budget error now lists up to three subdirectories that fit (widest folders whose parent does not fit), most recently changed first, relative to the selected folder, and adds that work may proceed without Cruise when scope cannot be reduced.
- The failure prompt asks the agent to offer ordered options (fitting subdirectory, `.gitignore` for untracked bytes, continue without Cruise) and not to change cwd, edit `.gitignore` or start work itself.
- Verification: 57/57 tests, package check, live-loader smoke. Fully restart the desktop app after installing (the `mods/index.mjs` stub is unchanged, so `/reload` keeps the old module).

## 2026-09-28 update — alpha.5 self-healing tool registration

- Symptom: `/cruise <request>` created a run and injected the workflow, but the agent got `Tool not found: cruise_update` (desktop 0.32.19). Cause: the global package is activated by more than one mod engine in the process; with `override` the later engine owns the global tool entries, and disposing that engine removes them by owner while the command stays registered.
- Fix: every `/cruise` invocation re-registers the three tools from the live engine. The bundled skill tells the agent to ask for `/cruise resume` (or `/cruise status`) instead of an app restart when a tool is reported missing.
- Verification: 58/58 tests (new regression), package check, live-loader smoke. Fully restart the desktop app after installing.
