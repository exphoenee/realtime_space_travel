---
# Auto-generated from plan files — do not edit manually
# Single source of truth: ./plans/ directory
# Regenerate with: python .claude/scripts/generate_roadmap.py
generated_at: "2026-08-06"
total_plans: 24
implemented: 18
in_progress: 1
not_started: 5
tasks_done: 1147
tasks_total: 1616
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
    tasks_done: 21
    tasks_total: 25
    dependencies: [000-i18n-nyelvesites]
  - step: 2
    slug: "002-ingame-shop-frontend"
    status: "implemented"
    category: "shop"
    tasks_done: 83
    tasks_total: 84
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
    status: "implemented"
    category: "shop"
    tasks_done: 28
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
    tasks_done: 44
    tasks_total: 44
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
    status: "implemented"
    category: "core"
    tasks_done: 62
    tasks_total: 62
    dependencies: [001-main-menu-settings]
  - step: 12
    slug: "012-wall-of-shame"
    status: "implemented"
    category: "ui"
    tasks_done: 109
    tasks_total: 109
    dependencies: [011-difficulty-event-system]
  - step: 13
    slug: "013-social-multiplayer"
    status: "in-progress"
    category: "core"
    tasks_done: 105
    tasks_total: 209
    dependencies: [003-firebase-auth-settings, 010-firebase-guest-merge-single-gate, 011-difficulty-event-system, 012-wall-of-shame]
  - step: 14
    slug: "014-camera-consent"
    status: "implemented"
    category: "ui"
    tasks_done: 71
    tasks_total: 84
    dependencies: [001-main-menu-settings, 003-firebase-auth-settings]
  - step: 15
    slug: "015-toast-notification"
    status: "implemented"
    category: "ui"
    tasks_done: 69
    tasks_total: 72
    dependencies: [013-social-multiplayer]
  - step: 16
    slug: "016-notification-retention"
    status: "not-started"
    category: "core"
    tasks_done: 0
    tasks_total: 48
    dependencies: [015-toast-notification]
  - step: 17
    slug: "017-starfield-realism"
    status: "implemented"
    category: "ui"
    tasks_done: 134
    tasks_total: 134
    dependencies: [011-difficulty-event-system]
  - step: 18
    slug: "018-nextjs-migration"
    status: "not-started"
    category: "core"
    tasks_done: 0
    tasks_total: 153
    dependencies: [003-firebase-auth-settings, 005-ingame-shop-strapi-stripe, 007-state-persist-page-refresh]
  - step: 19
    slug: "019-intro-deterministic-layout"
    status: "implemented"
    category: "ui"
    tasks_done: 134
    tasks_total: 134
    dependencies: []
  - step: 20
    slug: "020-mobile-camera-orientation"
    status: "implemented"
    category: "core"
    tasks_done: 34
    tasks_total: 34
    dependencies: []
  - step: 21
    slug: "021-stripe-fraud-defense"
    status: "not-started"
    category: "security"
    tasks_done: 0
    tasks_total: 53
    dependencies: [005-ingame-shop-strapi-stripe, 009-firebase-identity-split-bugfix, 010-firebase-guest-merge-single-gate, 018-nextjs-migration]
  - step: 22
    slug: "022-stripe-tax-compliance"
    status: "not-started"
    category: "payments"
    tasks_done: 0
    tasks_total: 9
    dependencies: [005-ingame-shop-strapi-stripe]
  - step: 23
    slug: "023-stripe-go-live"
    status: "not-started"
    category: "payments"
    tasks_done: 0
    tasks_total: 76
    dependencies: [005-ingame-shop-strapi-stripe, 009-firebase-identity-split-bugfix, 010-firebase-guest-merge-single-gate, 018-nextjs-migration, 021-stripe-fraud-defense, 022-stripe-tax-compliance]
---

# Roadmap

> Auto-generated from `./plans/` — **do not edit by hand**. Regenerate before reading:
> `python .claude/scripts/generate_roadmap.py`
> Last generated: 2026-08-06

## Project Status

- **Plans:** 18 implemented · 1 in progress · 5 not started (of 24)
- **Tasks:** 1147/1616 done (71%)

## Overview

| Step | Plan | Status | Progress | Phase | Category | Depends on |
|------|------|--------|----------|-------|----------|-----------|
| 0 | Nyelvesítési terv | ✅ Implemented | 20/21 | 0 | i18n | — |
| 1 | Főmenü + Beállítások képernyő terve | ✅ Implemented | 21/25 | — | ui | 0 |
| 2 | Helyi működésű áruház (frontend-only) terve | ✅ Implemented | 83/84 | — | shop | 1 |
| 3 | Firebase bejelentkezés + perzisztens felhasználói beállítások terve | ✅ Implemented | 23/27 | 1–2 | auth | 0, 1 |
| 4 | Firebase Google bejelentkezés bugfix | ✅ Implemented | 67/67 | 1 | auth | 3 |
| 5 | Valós pénzes kredit vásárlás | ✅ Implemented | 28/28 | 3–4 | shop | 3, 4 |
| 6 | Szerkeszthető fantázianév a Settings menüben | ✅ Implemented | — | 1 | auth | 4 |
| 7 | Játékállapot perzisztálása oldalfrissítésnél (F5/Ctrl+R) | ✅ Implemented | 44/44 | 4 | core | 4 |
| 8 | Áruház kosár bugfixek + kreditlimit + összérték kijelzés | ✅ Implemented | 14/14 | 4 | core | 7 |
| 9 | Firebase identitás-szétválás bugfix | ✅ Implemented | 63/63 | — | auth | 4 |
| 10 | Firebase guest→fiók merge egyszeri kapu + figyelmeztetések | ✅ Implemented | 66/66 | — | auth | 9 |
| 11 | Nehézségi szintek + eseményrendszer | ✅ Implemented | 62/62 | — | core | 1 |
| 12 | Szégyenfal | ✅ Implemented | 109/109 | — | ui | 11 |
| 13 | Social és multiplayer | 🟨 In progress | 105/209 | — | core | 3, 10, 11, 12 |
| 14 | Kamera hozzájárulás | ✅ Implemented | 71/84 | — | ui | 1, 3 |
| 15 | Toast notification rendszer | ✅ Implemented | 69/72 | — | ui | 13 |
| 16 | Notification retention | ⬜ Not started | 0/48 | — | core | 15 |
| 17 | Élethűbb csillagmező (Starfield realizmus) | ✅ Implemented | 134/134 | — | ui | 11 |
| 18 | Next.js 16 migráció | ⬜ Not started | 0/153 | — | core | 3, 5, 7 |
| 19 | Determinisztikus intró-elrendezés | ✅ Implemented | 134/134 | — | ui | — |
| 20 | Mobil/tablet kamera orientáció-kompenzáció | ✅ Implemented | 34/34 | — | core | — |
| 21 | Stripe csalásvédelem | ⬜ Not started | 0/53 | — | security | 5, 9, 10, 18 |
| 22 | Stripe adózás és ÁFA-megfelelőség | ⬜ Not started | 0/9 | — | payments | 5 |
| 23 | Stripe élesítés | ⬜ Not started | 0/76 | — | payments | 5, 9, 10, 18, 21, 22 |

## Next Open Tasks

> The next unchecked TODO in each unfinished plan (the live work front).

- **Step 0 — Nyelvesítési terv** (20/21): Firebase `settings.language` szinkron bekötése (Fázis 1 után — lásd [[003-firebase-auth-settings]])
- **Step 1 — Főmenü + Beállítások képernyő terve** (21/25): **Login bekötése** (Firebase) → [[003-firebase-auth-settings]]
- **Step 2 — Helyi működésű áruház (frontend-only) terve** (83/84): Vitest: `useShopStore` (kosár, checkout, kredithiány, birtoklás, `buyCredits`), ár-/wage-képlet determinizmus, debug-kredit inicializálás (TODO, a tesztek még hiányoznak)
- **Step 3 — Firebase bejelentkezés + perzisztens felhasználói beállítások terve** (23/27): **Security Rules deploy** a Firebase Console-ba (másold be a `security.rules.json` tartalmát a Realtime Database → Rules oldalon)
- **Step 13 — Social és multiplayer** (105/209): Chat játék közben (kisebb panel, jobb alsó sarok)
- **Step 14 — Kamera hozzájárulás** (71/84): CameraConsentScreen megjelenik intro után (manuális teszt)
- **Step 15 — Toast notification rendszer** (69/72): **`database.rules.json` deploy** — ⚠️ **felhasználói művelet, még nem futott le.** Amíg a szabályok nincsenek élesítve, a `sendNotification` a címzett node-jába íráskor `PERMISSION_DENIED`-et kap (a hiba elnyelődik, lásd D. blokk), így a toast-ok **nem jelennek meg** a másik félnél.
- **Step 16 — Notification retention** (0/48): `src/constants/constants.ts`: `NOTIFICATION_RETENTION_MS = 7 * 24 * 60 * 60 * 1000` (7 nap)
- **Step 18 — Next.js 16 migráció** (0/153): `npm run test` lefuttatva a migráció **előtt**, a pontos szám rögzítve (elvárt: **147 teszt / 9 fájl**, mind zöld)
- **Step 21 — Stripe csalásvédelem** (0/53): `.env`: `VITE_STRIPE_SECRET_KEY` → **`STRIPE_SECRET_KEY`** átnevezés (a `VITE_` prefix elhagyása)
- **Step 22 — Stripe adózás és ÁFA-megfelelőség** (0/9): `[K]` Dashboard → **Tax** → Get started; **origin address** (székhely) megadása
- **Step 23 — Stripe élesítés** (0/76): `[A]` [[021-stripe-fraud-defense]] **A fázis** teljes lefutása: `VITE_STRIPE_SECRET_KEY` → `STRIPE_SECRET_KEY` (`.env`, `.env.example`, `create_payment_links.mjs` **és mindkét workflow `env:` blokkja**), kulcs-rotáció, **restricted key**, `scripts/check_secrets.mjs`, CI-beépítés

## Insertion Guide

> To place a **new plan**: it goes after the highest step of its dependencies and before the
> lowest step of anything that must depend on it. `manage-roadmap` then renumbers the rest
> (step 0 and 1 are stable). Slugs are shown so dependencies can be wired directly.

| Step | Slug | Category | Depends on (slugs) | Required by (steps) |
|------|------|----------|--------------------|---------------------|
| 0 | `000-i18n-nyelvesites` | i18n | — | 1, 3 |
| 1 | `001-main-menu-settings` | ui | 000-i18n-nyelvesites | 2, 3, 11, 14 |
| 2 | `002-ingame-shop-frontend` | shop | 001-main-menu-settings | — |
| 3 | `003-firebase-auth-settings` | auth | 000-i18n-nyelvesites, 001-main-menu-settings | 4, 5, 13, 14, 18 |
| 4 | `004-firebase-auth-bugfix` | auth | 003-firebase-auth-settings | 5, 6, 7, 9 |
| 5 | `005-ingame-shop-strapi-stripe` | shop | 003-firebase-auth-settings, 004-firebase-auth-bugfix | 18, 21, 22, 23 |
| 6 | `006-editable-displayname` | auth | 004-firebase-auth-bugfix | — |
| 7 | `007-state-persist-page-refresh` | core | 004-firebase-auth-bugfix | 8, 18 |
| 8 | `008-shop-cart-bugfixes` | core | 007-state-persist-page-refresh | — |
| 9 | `009-firebase-identity-split-bugfix` | auth | 004-firebase-auth-bugfix | 10, 21, 23 |
| 10 | `010-firebase-guest-merge-single-gate` | auth | 009-firebase-identity-split-bugfix | 13, 21, 23 |
| 11 | `011-difficulty-event-system` | core | 001-main-menu-settings | 12, 13, 17 |
| 12 | `012-wall-of-shame` | ui | 011-difficulty-event-system | 13 |
| 13 | `013-social-multiplayer` | core | 003-firebase-auth-settings, 010-firebase-guest-merge-single-gate, 011-difficulty-event-system, 012-wall-of-shame | 15 |
| 14 | `014-camera-consent` | ui | 001-main-menu-settings, 003-firebase-auth-settings | — |
| 15 | `015-toast-notification` | ui | 013-social-multiplayer | 16 |
| 16 | `016-notification-retention` | core | 015-toast-notification | — |
| 17 | `017-starfield-realism` | ui | 011-difficulty-event-system | — |
| 18 | `018-nextjs-migration` | core | 003-firebase-auth-settings, 005-ingame-shop-strapi-stripe, 007-state-persist-page-refresh | 21, 23 |
| 19 | `019-intro-deterministic-layout` | ui | — | — |
| 20 | `020-mobile-camera-orientation` | core | — | — |
| 21 | `021-stripe-fraud-defense` | security | 005-ingame-shop-strapi-stripe, 009-firebase-identity-split-bugfix, 010-firebase-guest-merge-single-gate, 018-nextjs-migration | 23 |
| 22 | `022-stripe-tax-compliance` | payments | 005-ingame-shop-strapi-stripe | 23 |
| 23 | `023-stripe-go-live` | payments | 005-ingame-shop-strapi-stripe, 009-firebase-identity-split-bugfix, 010-firebase-guest-merge-single-gate, 018-nextjs-migration, 021-stripe-fraud-defense, 022-stripe-tax-compliance | — |

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
| 14 | `plans/014-camera-consent.md` | Kamera hozzájárulás |
| 15 | `plans/015-toast-notification.md` | Toast notification rendszer |
| 16 | `plans/016-notification-retention.md` | Notification retention |
| 17 | `plans/017-starfield-realism.md` | Élethűbb csillagmező (Starfield realizmus) |
| 18 | `plans/018-nextjs-migration.md` | Next.js 16 migráció |
| 19 | `plans/019-intro-deterministic-layout.md` | Determinisztikus intró-elrendezés |
| 20 | `plans/020-mobile-camera-orientation.md` | Mobil/tablet kamera orientáció-kompenzáció |
| 21 | `plans/021-stripe-fraud-defense.md` | Stripe csalásvédelem |
| 22 | `plans/022-stripe-tax-compliance.md` | Stripe adózás és ÁFA-megfelelőség |
| 23 | `plans/023-stripe-go-live.md` | Stripe élesítés |
