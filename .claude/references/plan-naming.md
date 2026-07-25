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
- `[[002-firebase-auth-settings]]`
- `[[003-ingame-shop-strapi-stripe]]`

## Current Plans (Sorted by Step)

| Step | Filename | Title |
|------|----------|-------|
| 0 | `plans/000-i18n-nyelvesites.md` | Nyelvesítési terv |
| 1 | `plans/001-main-menu-settings.md` | Főmenü + Beállítások képernyő |
| 2 | `plans/002-firebase-auth-settings.md` | Firebase bejelentkezés + perzisztens beállítások |
| 3 | `plans/003-ingame-shop-strapi-stripe.md` | Játékon belüli áruház (Strapi + Stripe) |
