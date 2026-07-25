# Phase Numbering Rules

> Shared reference for all skills and agents. Defines how roadmap phases are numbered and ordered.

## Rules

1. **Fázis 0** is always i18n (step 0, never changes)
2. **Fázis 1–4** are the core roadmap (Firebase → Ship → Shop Backend → Shop Frontend)
3. **main-menu-settings** is a foundational plan at step 1 (never renumbered)
4. **New phases** can be inserted between existing phases or appended after Fázis 4
5. **Phase numbers are stable** — once assigned, don't renumber existing phases
6. **Use "Fázis X" notation** consistently in all plan files

## Current Phases

| Phase | Name | Plan Step | Status |
|-------|------|-----------|--------|
| 0 | i18n alapréteg | 0 — `000-i18n-nyelvesites` | ✅ Implemented |
| 1 | Firebase auth + beállítások + Settings menü | 2 — `002-firebase-auth-settings` | ⬜ Not started |
| 2 | Hajóválasztó + sebesség | 2 — `002-firebase-auth-settings` | ⬜ Not started |
| 3 | Bolt backend (Strapi + Functions) | 3 — `003-ingame-shop-strapi-stripe` | ⬜ Not started |
| 4 | Bolt frontend + Stripe + fordítások | 3 — `003-ingame-shop-strapi-stripe` | ⬜ Not started |

## Adding New Plans

New plans should either:
- Extend an existing phase (add to its TODO)
- Insert as a new phase between existing ones
- Append as a new phase after Fázis 4

> 🔄 Renumbering and roadmap regeneration are handled by the `manage-roadmap` agent (`.claude/agents/manage-roadmap.md`), which runs `python .claude/scripts/generate_roadmap.py` to rebuild `roadmap.md` from the plan files.
