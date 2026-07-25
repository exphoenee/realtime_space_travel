# Plan File Naming Conventions

> Shared reference for all skills and agents.

## Filename Format

`NNN-feature-name.md` with 3-digit zero-padded prefix + kebab-case.

- Examples: `004-achievements-system.md`, `007-multiplayer-lobby.md`
- Be descriptive: `008-leaderboard.md`, `009-social-features.md`
- Avoid abbreviations: `010-in-app-purchases.md` not `iap.md`
- The numeric prefix determines implementation order and must match the `step` field in YAML

## Reference Syntax

When referencing existing plans in markdown, use `[[plan-name]]` syntax (without `.md`):
- `[[000-i18n-nyelvesites]]`
- `[[001-main-menu-settings]]`

The slug **contains the numeric prefix**, so every `[[...]]` link breaks when a plan is
renumbered. Renumbering therefore always includes a repo-wide `[[old-slug]]` → `[[new-slug]]`
sweep (`plans/`, `.claude/`, `CLAUDE.md`, `agents.md`) — see `manage-roadmap` Section A.

## Current Plans

> ⚠️ **Deliberately not listed here.** A hand-maintained plan list goes stale on every
> renumbering. The live list is the **generated** `plans/roadmap.md` ("Phase Details" +
> "Insertion Guide"). Regenerate before reading it:
>
> ```bash
> python .claude/scripts/generate_roadmap.py
> ```
