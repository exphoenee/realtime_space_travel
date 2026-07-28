---
# Auto-generated from plan files — do not edit manually
# Single source of truth: ./plans/ directory
# Regenerate with: python .claude/scripts/generate_roadmap.py
generated_at: "2026-07-28"
total_plans: 16
implemented: 11
in_progress: 2
not_started: 3
tasks_done: 487
tasks_total: 704
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
    tasks_done: 10
    tasks_total: 14
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
    status: "implemented"
    category: "auth"
    tasks_done: 23
    tasks_total: 27
    dependencies: [000-i18n-nyelvesites, 001-main-menu-settings]
  - step: 4
    slug: "004-firebase-auth-bugfix"
    status: "implemented"
    category: "auth"
    tasks_done: 67
    tasks_total: 67
    dependencies: [003-firebase-auth-settings]
  - step: 5
    slug: "005-ingame-shop-strapi-stripe"
    status: "in-progress"
    category: "shop"
    tasks_done: 25
    tasks_total: 28
    dependencies: [003-firebase-auth-settings, 004-firebase-auth-bugfix]
  - step: 6
    slug: "006-editable-displayname"
    status: "implemented"
    category: "auth"
    tasks_done: 0
    tasks_total: 0
    dependencies: [004-firebase-auth-bugfix]
  - step: 7
    slug: "007-state-persist-page-refresh"
    status: "implemented"
    category: "core"
    tasks_done: 30
    tasks_total: 30
    dependencies: [004-firebase-auth-bugfix]
  - step: 8
    slug: "008-shop-cart-bugfixes"
    status: "implemented"
    category: "core"
    tasks_done: 14
    tasks_total: 14
    dependencies: [007-state-persist-page-refresh]
  - step: 9
    slug: "009-firebase-identity-split-bugfix"
    status: "implemented"
    category: "auth"
    tasks_done: 63
    tasks_total: 63
    dependencies: [004-firebase-auth-bugfix]
  - step: 10
    slug: "010-firebase-guest-merge-single-gate"
    status: "implemented"
    category: "auth"
    tasks_done: 66
    tasks_total: 66
    dependencies: [009-firebase-identity-split-bugfix]
  - step: 11
    slug: "011-difficulty-event-system"
    status: "in-progress"
    category: "core"
    tasks_done: 51
    tasks_total: 51
    dependencies: [001-main-menu-settings]
  - step: 12
    slug: "012-wall-of-shame"
    status: "implemented"
    category: "ui"
    tasks_done: 66
    tasks_total: 66
    dependencies: [011-difficulty-event-system]
  - step: 13
    slug: "013-social-multiplayer"
    status: "not-started"
    category: "core"
    tasks_done: 0
    tasks_total: 68
    dependencies: [011-difficulty-event-system, 010-firebase-guest-merge-single-gate, 003-firebase-auth-settings]
  - step: 14
    slug: "014-stripe-fraud-defense"
    status: "not-started"
    category: "security"
    tasks_done: 0
    tasks_total: 51
    dependencies: [005-ingame-shop-strapi-stripe, 009-firebase-identity-split-bugfix, 010-firebase-guest-merge-single-gate]
  - step: 15
    slug: "015-stripe-go-live"
    status: "not-started"
    category: "payments"
    tasks_done: 0
    tasks_total: 85
    dependencies: [005-ingame-shop-strapi-stripe, 009-firebase-identity-split-bugfix, 010-firebase-guest-merge-single-gate, 014-stripe-fraud-defense]
---

# Roadmap

> Auto-generated from `./plans/` — **do not edit by hand**. Regenerate before reading:
> `python .claude/scripts/generate_roadmap.py`
> Last generated: 2026-07-28

## Project Status

- **Plans:** 11 implemented · 2 in progress · 3 not started (of 16)
- **Tasks:** 487/704 done (69%)

## Overview

| Step | Plan | Status | Progress | Phase | Category | Depends on |
|------|------|--------|----------|-------|----------|-----------|
| 0 | Nyelvesítési terv | ✅ Implemented | 20/21 | 0 | i18n | — |
| 1 | Főmenü + Beállítások képernyő terve | ✅ Implemented | 10/14 | — | ui | 0 |
| 2 | Helyi működésű áruház (frontend-only) terve | ✅ Implemented | 52/53 | — | shop | 1 |
| 3 | Firebase bejelentkezés + perzisztens felhasználói beállítások terve | ✅ Implemented | 23/27 | 1–2 | auth | 0, 1 |
| 4 | Firebase Google bejelentkezés bugfix | ✅ Implemented | 67/67 | 1 | auth | 3 |
| 5 | Valós pénzes kredit vásárlás | 🟨 In progress | 25/28 | 3–4 | shop | 3, 4 |
| 6 | Szerkeszthető fantázianév a Settings menüben | ✅ Implemented | — | 1 | auth | 4 |
| 7 | Játékállapot perzisztálása oldalfrissítésnél (F5/Ctrl+R) | ✅ Implemented | 30/30 | 4 | core | 4 |
| 8 | Áruház kosár bugfixek + kreditlimit + összérték kijelzés | ✅ Implemented | 14/14 | 4 | core | 7 |
| 9 | Firebase identitás-szétválás bugfix | ✅ Implemented | 63/63 | — | auth | 4 |
| 10 | Firebase guest→fiók merge egyszeri kapu + figyelmeztetések | ✅ Implemented | 66/66 | — | auth | 9 |
| 11 | Nehézségi szintek + eseményrendszer | 🟨 In progress | 51/51 | — | core | 1 |
| 12 | Szégyenfal | ✅ Implemented | 66/66 | — | ui | 11 |
| 13 | Social és multiplayer | ⬜ Not started | 0/68 | — | core | 3, 10, 11 |
| 14 | Stripe csalásvédelem | ⬜ Not started | 0/51 | — | security | 5, 9, 10 |
| 15 | Stripe élesítés | ⬜ Not started | 0/85 | — | payments | 5, 9, 10, 14 |

## Next Open Tasks

> The next unchecked TODO in each unfinished plan (the live work front).

- **Step 0 — Nyelvesítési terv** (20/21): Firebase `settings.language` szinkron bekötése (Fázis 1 után — lásd [[003-firebase-auth-settings]])
- **Step 1 — Főmenü + Beállítások képernyő terve** (10/14): **Login bekötése** (Firebase) → [[003-firebase-auth-settings]]
- **Step 2 — Helyi működésű áruház (frontend-only) terve** (52/53): Vitest: `useShopStore` (kosár, checkout, kredithiány, birtoklás, `buyCredits`), ár-/wage-képlet determinizmus, debug-kredit inicializálás (TODO, a tesztek még hiányoznak)
- **Step 3 — Firebase bejelentkezés + perzisztens felhasználói beállítások terve** (23/27): **Security Rules deploy** a Firebase Console-ba (másold be a `security.rules.json` tartalmát a Realtime Database → Rules oldalon)
- **Step 5 — Valós pénzes kredit vásárlás** (25/28): Stripe teszt-vásárlások a 4 pakkra (siker, megszakítás) — **feloldva**: eddig blokkolta, hogy a linkek a Firebase Hostingra tértek vissza; a dev linkekkel most localhoston végigjátszható
- **Step 13 — Social és multiplayer** (0/68): RTDB új node-ok: `friends/{uid}/{friendUid}: true`, `friendRequests/{uid}/{fromUid}: { from, at, status }`, `chats/{chatId}: { participants, messages }`
- **Step 14 — Stripe csalásvédelem** (0/51): `.env`: `VITE_STRIPE_SECRET_KEY` → **`STRIPE_SECRET_KEY`** átnevezés (a `VITE_` prefix elhagyása)
- **Step 15 — Stripe élesítés** (0/85): `[A]` [[014-stripe-fraud-defense]] **A fázis** teljes lefutása: `VITE_STRIPE_SECRET_KEY` → `STRIPE_SECRET_KEY`, kulcs-rotáció, **restricted key**, `scripts/check_secrets.mjs`, CI-beépítés

## Insertion Guide

> To place a **new plan**: it goes after the highest step of its dependencies and before the
> lowest step of anything that must depend on it. `manage-roadmap` then renumbers the rest
> (step 0 and 1 are stable). Slugs are shown so dependencies can be wired directly.

| Step | Slug | Category | Depends on (slugs) | Required by (steps) |
|------|------|----------|--------------------|---------------------|
| 0 | `000-i18n-nyelvesites` | i18n | — | 1, 3 |
| 1 | `001-main-menu-settings` | ui | 000-i18n-nyelvesites | 2, 3, 11 |
| 2 | `002-ingame-shop-frontend` | shop | 001-main-menu-settings | — |
| 3 | `003-firebase-auth-settings` | auth | 000-i18n-nyelvesites, 001-main-menu-settings | 4, 5, 13 |
| 4 | `004-firebase-auth-bugfix` | auth | 003-firebase-auth-settings | 5, 6, 7, 9 |
| 5 | `005-ingame-shop-strapi-stripe` | shop | 003-firebase-auth-settings, 004-firebase-auth-bugfix | 14, 15 |
| 6 | `006-editable-displayname` | auth | 004-firebase-auth-bugfix | — |
| 7 | `007-state-persist-page-refresh` | core | 004-firebase-auth-bugfix | 8 |
| 8 | `008-shop-cart-bugfixes` | core | 007-state-persist-page-refresh | — |
| 9 | `009-firebase-identity-split-bugfix` | auth | 004-firebase-auth-bugfix | 10, 14, 15 |
| 10 | `010-firebase-guest-merge-single-gate` | auth | 009-firebase-identity-split-bugfix | 13, 14, 15 |
| 11 | `011-difficulty-event-system` | core | 001-main-menu-settings | 12, 13 |
| 12 | `012-wall-of-shame` | ui | 011-difficulty-event-system | — |
| 13 | `013-social-multiplayer` | core | 011-difficulty-event-system, 010-firebase-guest-merge-single-gate, 003-firebase-auth-settings | — |
| 14 | `014-stripe-fraud-defense` | security | 005-ingame-shop-strapi-stripe, 009-firebase-identity-split-bugfix, 010-firebase-guest-merge-single-gate | 15 |
| 15 | `015-stripe-go-live` | payments | 005-ingame-shop-strapi-stripe, 009-firebase-identity-split-bugfix, 010-firebase-guest-merge-single-gate, 014-stripe-fraud-defense | — |

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
| 6 | `plans/006-editable-displayname.md` | Szerkeszthető fantázianév a Settings menüben |
| 7 | `plans/007-state-persist-page-refresh.md` | Játékállapot perzisztálása oldalfrissítésnél (F5/Ctrl+R) |
| 8 | `plans/008-shop-cart-bugfixes.md` | Áruház kosár bugfixek + kreditlimit + összérték kijelzés |
| 9 | `plans/009-firebase-identity-split-bugfix.md` | Firebase identitás-szétválás bugfix |
| 10 | `plans/010-firebase-guest-merge-single-gate.md` | Firebase guest→fiók merge egyszeri kapu + figyelmeztetések |
| 11 | `plans/011-difficulty-event-system.md` | Nehézségi szintek + eseményrendszer |
| 12 | `plans/012-wall-of-shame.md` | Szégyenfal |
| 13 | `plans/013-social-multiplayer.md` | Social és multiplayer |
| 14 | `plans/014-stripe-fraud-defense.md` | Stripe csalásvédelem |
| 15 | `plans/015-stripe-go-live.md` | Stripe élesítés |
