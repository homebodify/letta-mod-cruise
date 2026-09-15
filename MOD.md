---
name: Cruise
description: One entry point for scoped UX work, implementation, partial changes, and evidence-backed verification.
---

# Cruise

Use `/cruise <request>`; controls are `status`, `resume`, `check`, `help`.
No `/ux-*` or `/code-*` aliases are registered. Read the bundled `skills/cruising/SKILL.md` and only the relevant reference.

Save a concrete contract through `cruise_update`, not by modifying run files manually. Keep requirements, scope exclusions and constraints intact. Inspections do not authorize implementation. Use `cruise_approve` for the exact implementation contract and `cruise_verify` for captured checks; finish explicitly with `cruise_update`. Turn-end never certifies completion.

This is a trusted local alpha, not a general tool sandbox. Current semantic scope and assertion relevance still require agent/human judgment. Requirements must not be certified by unrelated typecheck/build output. Technical evidence is not user validation. Browser testing uses Aside only.

Store private run state in the selected project cwd (Git root or subdirectory) under `.letta/cruise/`; owner and operation locks remain at the Git root. Checks and evidence are scoped to selected cwd. Subdirectory implementation contracts require explicit scope-relative `dependencies`; outside dependencies cannot be certified. The 64 MiB cap and Aside-only browser rule are unchanged. Old run stores, installed mods and remote repositories are never migrated or modified automatically. Do not commit run state, logs or credentials. See `docs/design.md` and `docs/migration.md` for boundaries.
