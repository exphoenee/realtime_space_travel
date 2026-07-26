---
# Auto-generated from plan files — do not edit manually
# Single source of truth: ./plans/ directory
# Regenerate with: python .claude/scripts/generate_roadmap.py
generated_at: "2026-07-26"
total_plans: 6
implemented: 3
in_progress: 1
not_started: 2
tasks_done: 104
tasks_total: 170
plans:
  - step: 0
    slug: "000-i18n-nyelvesites"
    status: "implemented"
    category: "i18n"
    tasks_done: 20
    tasks_total: 21
    dependencies: []
  - step: 1
    slug: "001-main-menu-settings"
    status: "implemented"
    category: "ui"
    tasks_done: 9
    tasks_total: 13
    dependencies: [000-i18n-nyelvesites]
  - step: 2
    slug: "002-ingame-shop-frontend"
    status: "implemented"
    category: "shop"
    tasks_done: 52
    tasks_total: 53
    dependencies: [001-main-menu-settings]
  - step: 3
    slug: "003-firebase-auth-settings"
    status: "in-progress"
    category: "auth"
    tasks_done: 21
    tasks_total: 28
    dependencies: [000-i18n-nyelvesites, 001-main-menu-settings]
  - step: 4
    slug: "004-firebase-auth-bugfix"
    status: "not-started"
    category: "auth"
    tasks_done: 0
    tasks_total: 39
    dependencies: [003-firebase-auth-settings]
  - step: 5
    slug: "005-ingame-shop-strapi-stripe"
    status: "not-started"
    category: "shop"
    tasks_done: 2
    tasks_total: 16
    dependencies: [003-firebase-auth-settings, 004-firebase-auth-bugfix]
---

# Roadmap

> Auto-generated from `./plans/` — **do not edit by hand**. Regenerate before reading:
> `python .claude/scripts/generate_roadmap.py`
> Last generated: 2026-07-26

## Project Status

- **Plans:** 3 implemented · 1 in progress · 2 not started (of 6)
- **Tasks:** 104/170 done (61%)

## Overview

| Step | Plan | Status | Progress | Phase | Category | Depends on |
|------|------|--------|----------|-------|----------|-----------|
| 0 | Nyelvesítési terv | ✅ Implemented | 20/21 | 0 | i18n | — |
| 1 | Főmenü + Beállítások képernyő terve | ✅ Implemented | 9/13 | — | ui | 0 |
| 2 | Helyi működésű áruház (frontend-only) terve | ✅ Implemented | 52/53 | — | shop | 1 |
| 3 | Firebase bejelentkezés + perzisztens felhasználói beállítások terve | 🟨 In progress | 21/28 | 1–2 | auth | 0, 1 |
| 4 | Firebase Google bejelentkezés bugfix | ⬜ Not started | 0/39 | 1 | auth | 3 |
| 5 | Valós pénzes kredit vásárlás | ⬜ Not started | 2/16 | 3–4 | shop | 3, 4 |

## Next Open Tasks

> The next unchecked TODO in each unfinished plan (the live work front).

- **Step 0 — Nyelvesítési terv** (20/21): Firebase `settings.language` szinkron bekötése (Fázis 1 után — lásd [[003-firebase-auth-settings]])
- **Step 1 — Főmenü + Beállítások képernyő terve** (9/13): **Login bekötése** (Firebase) → [[003-firebase-auth-settings]]
- **Step 2 — Helyi működésű áruház (frontend-only) terve** (52/53): Vitest: `useShopStore` (kosár, checkout, kredithiány, birtoklás, `buyCredits`), ár-/wage-képlet determinizmus, debug-kredit inicializálás (TODO, a tesztek még hiányoznak)
- **Step 3 — Firebase bejelentkezés + perzisztens felhasználói beállítások terve** (21/28): **Security Rules deploy** a Firebase Console-ba (másold be a `security.rules.json` tartalmát a Realtime Database → Rules oldalon)
- **Step 4 — Firebase Google bejelentkezés bugfix** (0/39): `security.rules.json` — dokumentált (kommentelt) forrás létrehozása/frissítése a Phase-1 szabályokkal + a generáló one-liner a fejlécbe
- **Step 5 — Valós pénzes kredit vásárlás** (2/16): Stripe fiók + API kulcsok + 4 Price objektum (5€, 10€, 25€, 100€) a Stripe Dashboard-on

## Insertion Guide

> To place a **new plan**: it goes after the highest step of its dependencies and before the
> lowest step of anything that must depend on it. `manage-roadmap` then renumbers the rest
> (step 0 and 1 are stable). Slugs are shown so dependencies can be wired directly.

| Step | Slug | Category | Depends on (slugs) | Required by (steps) |
|------|------|----------|--------------------|---------------------|
| 0 | `000-i18n-nyelvesites` | i18n | — | 1, 3 |
| 1 | `001-main-menu-settings` | ui | 000-i18n-nyelvesites | 2, 3 |
| 2 | `002-ingame-shop-frontend` | shop | 001-main-menu-settings | — |
| 3 | `003-firebase-auth-settings` | auth | 000-i18n-nyelvesites, 001-main-menu-settings | 4, 5 |
| 4 | `004-firebase-auth-bugfix` | auth | 003-firebase-auth-settings | 5 |
| 5 | `005-ingame-shop-strapi-stripe` | shop | 003-firebase-auth-settings, 004-firebase-auth-bugfix | — |

## Phase Details

> Full descriptions, decisions, and architecture live in the individual plan files.

| Step | Plan File | Title |
|------|-----------|-------|
| 0 | `plans/000-i18n-nyelvesites.md` | Nyelvesítési terv |
| 1 | `plans/001-main-menu-settings.md` | Főmenü + Beállítások képernyő terve |
| 2 | `plans/002-ingame-shop-frontend.md` | Helyi működésű áruház (frontend-only) terve |
| 3 | `plans/003-firebase-auth-settings.md` | Firebase bejelentkezés + perzisztens felhasználói beállítások terve |
| 4 | `plans/004-firebase-auth-bugfix.md` | Firebase Google bejelentkezés bugfix |
| 5 | `plans/005-ingame-shop-strapi-stripe.md` | Valós pénzes kredit vásárlás |
