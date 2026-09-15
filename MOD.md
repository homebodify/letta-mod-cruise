---
name: Cruise
description: One entry point for scoped UX work, implementation, partial changes, and evidence-backed verification.
---

# Cruise

Use `/cruise <request>`; controls are `status`, `resume`, `check`, `help`.
No `/ux-*` or `/code-*` aliases are registered. Read the bundled `skills/cruising/SKILL.md` and only the relevant reference.

Save a concrete contract through `cruise_update`, not by modifying run files manually. Keep requirements, scope exclusions and constraints intact. Inspections do not authorize implementation. Use `cruise_approve` for the exact implementation contract and `cruise_verify` for captured checks; finish explicitly with `cruise_update`. Turn-end never certifies completion.

This is a trusted local alpha, not a general tool sandbox. Current semantic scope and assertion relevance still require agent/human judgment. Requirements must not be certified by unrelated typecheck/build output. Technical evidence is not user validation. Browser testing uses Aside only.

Store private state in the selected Git root under `.letta/cruise/`. Old run stores, installed mods and remote repositories are never migrated or modified automatically. Do not commit run state, logs or credentials. See `docs/design.md` and `docs/migration.md` for boundaries.
