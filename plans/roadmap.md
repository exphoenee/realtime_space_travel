---
# Auto-generated from plan files — do not edit manually
# Single source of truth: ./plans/ directory
# Regenerate with: python .claude/scripts/generate_roadmap.py
generated_at: "2026-07-25"
total_plans: 4
implemented: 2
in_progress: 0
not_started: 2
tasks_done: 29
tasks_total: 67
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
    slug: "002-firebase-auth-settings"
    status: "not-started"
    category: "auth"
    tasks_done: 0
    tasks_total: 14
    dependencies: [000-i18n-nyelvesites, 001-main-menu-settings]
  - step: 3
    slug: "003-ingame-shop-strapi-stripe"
    status: "not-started"
    category: "shop"
    tasks_done: 0
    tasks_total: 19
    dependencies: [002-firebase-auth-settings]
---

# Roadmap

> Auto-generated from `./plans/` — **do not edit by hand**. Regenerate before reading:
> `python .claude/scripts/generate_roadmap.py`
> Last generated: 2026-07-25

## Project Status

- **Plans:** 2 implemented · 0 in progress · 2 not started (of 4)
- **Tasks:** 29/67 done (43%)

## Overview

| Step | Plan | Status | Progress | Phase | Category | Depends on |
|------|------|--------|----------|-------|----------|-----------|
| 0 | Nyelvesítési terv | ✅ Implemented | 20/21 | 0 | i18n | — |
| 1 | Főmenü + Beállítások képernyő terve | ✅ Implemented | 9/13 | — | ui | 0 |
| 2 | Firebase bejelentkezés + perzisztens felhasználói beállítások terve | ⬜ Not started | 0/14 | 1–2 | auth | 0, 1 |
| 3 | Játékon belüli áruház terve | ⬜ Not started | 0/19 | 3–4 | shop | 2 |

## Next Open Tasks

> The next unchecked TODO in each unfinished plan (the live work front).

- **Step 0 — Nyelvesítési terv** (20/21): Firebase `settings.language` szinkron bekötése (Fázis 1 után — lásd [[002-firebase-auth-settings]])
- **Step 1 — Főmenü + Beállítások képernyő terve** (9/13): **Login bekötése** (Firebase) → [[002-firebase-auth-settings]]
- **Step 2 — Firebase bejelentkezés + perzisztens felhasználói beállítások terve** (0/14): Firebase projekt + Auth (Google, Anonymous) + Realtime Database + env változók
- **Step 3 — Játékon belüli áruház terve** (0/19): Strapi projekt (külön repo vagy `/server`) + adatbázis

## Insertion Guide

> To place a **new plan**: it goes after the highest step of its dependencies and before the
> lowest step of anything that must depend on it. `manage-roadmap` then renumbers the rest
> (step 0 and 1 are stable). Slugs are shown so dependencies can be wired directly.

| Step | Slug | Category | Depends on (slugs) | Required by (steps) |
|------|------|----------|--------------------|---------------------|
| 0 | `000-i18n-nyelvesites` | i18n | — | 1, 2 |
| 1 | `001-main-menu-settings` | ui | 000-i18n-nyelvesites | 2 |
| 2 | `002-firebase-auth-settings` | auth | 000-i18n-nyelvesites, 001-main-menu-settings | 3 |
| 3 | `003-ingame-shop-strapi-stripe` | shop | 002-firebase-auth-settings | — |

## Phase Details

> Full descriptions, decisions, and architecture live in the individual plan files.

| Step | Plan File | Title |
|------|-----------|-------|
| 0 | `plans/000-i18n-nyelvesites.md` | Nyelvesítési terv |
| 1 | `plans/001-main-menu-settings.md` | Főmenü + Beállítások képernyő terve |
| 2 | `plans/002-firebase-auth-settings.md` | Firebase bejelentkezés + perzisztens felhasználói beállítások terve |
| 3 | `plans/003-ingame-shop-strapi-stripe.md` | Játékon belüli áruház terve |
