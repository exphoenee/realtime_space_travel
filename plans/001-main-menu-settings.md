---
title: "Főmenü + Beállítások képernyő terve"
slug: 001-main-menu-settings
type: plan
category: ui
status: implemented
implemented: true
implemented_at: "2026-07-25"
created_at: "2026-07-25"
updated_at: "2026-07-26"
author: exphoenee
step: 1
phases: []
dependencies:
  - 000-i18n-nyelvesites
related_plans:
  - 002-ingame-shop-frontend
  - 003-firebase-auth-settings
  - 005-ingame-shop-strapi-stripe
tags:
  - ui
  - main-menu
  - settings
  - i18n
  - difficulty
---

# Főmenü + Beállítások képernyő terve

**Cél:** az intro után, a **küldetésválasztó előtt** egy **Főmenü** (`mainMenu`), ahonnan:
- **Bejelentkezés** (placeholder — a login a Firebase fázisban kerül bekötésre),
- **Játék indítása** (→ küldetésválasztó, `missionSelect`),
- **Áruház** (placeholder — a bolt-fázisban kerül bekötésre),
- **Beállítások** (→ Beállítások képernyő, `settings`),
- **Intro megtekintése** (→ az intro újralejátszása).

A **Beállítások képernyőn** (`SettingsScreen`) a játékos **zene hangerőt** állíthat, **nehézséget** (könnyű/közepes/nehéz) és **nyelvet** választhat. A korábbi **sarok-nyelvváltó és a „harangocska" (zene-némító gomb) megszűnt** — ezek helyét a Beállítások képernyő veszi át.

> **Állapot:** ez a fázis **implementálva** van (UI + helyi működés). A **login**, az **áruház** és a **nehézség játékmenetbe kötése**, valamint a **beállítások per-felhasználós mentése** szándékosan **nincs** bekötve — ezeket a következő fázisok végzik.

## Döntések (egyeztetve)

| Kérdés | Választás |
|--------|-----------|
| Új menü helye | Az intro **után**, a küldetésválasztó **előtt** |
| Főmenü gombjai | Játék indítása · Áruház · Beállítások · Intro megtekintése · Bejelentkezés |
| Beállítások tartalma | Zene hangerő (csúszka) · Nehézség (könnyű/közepes/nehéz) · Nyelvválasztó |
| Login / áruház / mentés / nehézség-hatás | **Most nem** — későbbi fázisokban |
| Sarok-nyelvváltó + harang | **Megszűnt** — a Beállítások képernyőre került |

---

## 1. Képernyő-folyamat (GamePhase)

Új fázisok a `src/types/index.ts` `GamePhase`-be: **`mainMenu`** és **`settings`**; a korábbi küldetésválasztó fázis **`menu` → `missionSelect`**-re átnevezve.

```
intro ──(skip / auto)──▶ mainMenu ──(Játék indítása)──▶ missionSelect ──▶ loading ──▶ playing
   ▲                      │  ▲   ▲
   └──(Intro megtekintése)┘  │   │(← Vissza)
                (Beállítások)│   │
                             ▼   │
                          settings
```

- `intro` vége → **`mainMenu`** (`App.handleSkipIntro`).
- `mainMenu`: „Játék indítása" → `missionSelect`; „Beállítások" → `settings`; „Intro megtekintése" → `intro`; „Bejelentkezés"/„Áruház" → placeholder értesítés.
- `settings` → „Vissza" → `mainMenu`.
- `missionSelect` (küldetésválasztó) „← Vissza" gomb → `mainMenu`.
- Küldetés vége → „Vissza a főmenübe" → `resetToMenu` → **`mainMenu`**.
- `useGameStore.phaseToFlags`: `mainMenu`/`missionSelect`/`settings` = szüneteltetett pre-game állapot.
- `App.isPreGame` kibővítve; a `ScreenRouter` ágai: `mainMenu → MainMenu`, `missionSelect → MissionSelector`, `settings → SettingsScreen`.

---

## 2. Komponensek

### `MainMenu.tsx` (+ `.module.css`) — a Főmenü
- Cím (`intro.headline`) + mottó (`intro.motto`).
- Gombok: `mainMenu.start` (elsődleges), `mainMenu.shop`, `mainMenu.settings`, `mainMenu.intro`, `mainMenu.login`.
- Navigáció közvetlenül a store-ból (`transitionTo`).
- **Login/Áruház:** kattintásra `mainMenu.loginComingSoon` / `mainMenu.shopComingSoon` értesítés (nincs valódi funkció).

### `MissionSelector.tsx` (+ `.module.css`) — a küldetésválasztó
- A korábbi `MainMenu` átnevezve; a küldetéskártyák + DLC-szöveg változatlan.
- „← Vissza" gomb → `mainMenu`.

### `SettingsScreen.tsx` (+ `.module.css`)
- **Zene hangerő:** `<input type="range">` 0–1, `useUIStore.musicVolume`. Egyedi, kitöltött csúszka (`--fill` CSS változó), hangerő-ikon (🔇/🔉/🔊), százalék.
- **Nehézség:** szegmentált kapcsoló (könnyű/közepes/nehéz), `useUIStore.difficulty`. **A játékmenetbe még nincs bekötve.**
- **Nyelv:** a `LanguageSwitcher` komponens (ide költözött a sarokból).
- **Vissza** → `mainMenu`.

---

## 3. Állapot (useUIStore)

- **`musicVolume`** (0..1, alap = `MUSIC_ACTIVE_VOLUME`), `setMusicVolume` (0..1-re vágva).
- **`difficulty`** (`easy`|`medium`|`hard`, alap `medium`), `setDifficulty`.
- Mindkettő **helyi** `localStorage` persist (`space-travel-ui`) — a **per-felhasználós Firebase mentés a következő fázis**.
- `useAudio.playMusic(shouldPlay, isMuted, volume)` — a hangerőt fogadja; a csúszka **élőben** módosítja a zenét (pre-game alatt szól, mert nincs `destination`).
- A **harang** (`bellOverlay`, `handleToggleMusic`, `musicButton`) eltávolítva; a némítás a hangerő 0-ra állításával érhető el.

---

## 4. Nyelvesítés (i18n)

Új/átnevezett kulcsok mind az 5 nyelvben:
```
mainMenu.login / start / shop / settings / intro / loginComingSoon / shopComingSoon
settings.title / musicVolume / back / difficulty
difficulty.easy / medium / hard
```
A `LanguageSwitcher` a Beállítások képernyőn él.

---

## 5. Egyéb módosítás — intro

- **Blokk-megjelenítés javítva:** `scroll` esemény helyett `requestAnimationFrame` polling, mert a CSS transform-animáció nem vált ki scroll eseményt (korábban csak a főcím jelent meg).
- **Lassabb görgetés:** a debug-módú `--intro-scroll-duration` 60s → **120s**.

---

## 6. Kapcsolat a következő fázisokkal

- **[[003-firebase-auth-settings]]**: a **Bejelentkezés** gomb valódi Google/Anonymous auth-ra cserélődik; a hangerő + nehézség + nyelv **Firebase `settings`-be** ment/onnan tölt; a Beállítások kap egy **Fiók** szekciót.
- **[[002-ingame-shop-frontend]]**: az **Áruház** gomb a `mainMenu.shopComingSoon` placeholder helyett a valódi **helyi (frontend-only) `shop` fázisra** visz; a `SettingsScreen` bővül a **zeneválasztóval** (birtokolt sávok).
- **[[005-ingame-shop-strapi-stripe]]**: a bolt **backend-bekötése** (Strapi katalógus + Stripe fizetés) — a [[002-ingame-shop-frontend]] mock katalógusát/checkoutját cseréli le.
- **Nehézség**: a `difficulty` a játékmenetbe köthető (pl. figyelem-időzítők, `INACTIVITY_LIMIT_SECONDS` skálázása).

---

## 7. Érintett/új fájlok

**Új:** `MainMenu.tsx(+css)` (Főmenü), `SettingsScreen.tsx(+css)`.
**Átnevezett:** régi `MainMenu` → `MissionSelector.tsx(+css)`; `StartMenu` → `MainMenu`.
**Módosított:** `types/index.ts` (GamePhase + `Difficulty`), `useGameStore.ts` (phaseToFlags, resetToMenu → mainMenu), `useUIStore.ts` (musicVolume, difficulty), `useAudio.ts` (volume param), `App.tsx` (isPreGame, handleSkipIntro, harang eltávolítás, playMusic volume), `ScreenRouter.tsx`, `IntroScreen.tsx` (rAF-fix + lassítás), az 5 `translation.json`.

---

## 8. Haladás (TODO)

> Jelölés: `[ ]` hátravan · `[~]` folyamatban · `[x]` kész.

- [x] `GamePhase: mainMenu` + `settings`; `menu → missionSelect` átnevezés; `phaseToFlags`; `App.isPreGame`
- [x] `MainMenu` (Játék indítása / Áruház / Beállítások / Intro megtekintése / Bejelentkezés)
- [x] `MissionSelector` (átnevezés + „← Vissza")
- [x] `SettingsScreen` (hangerő + nehézség + nyelv + Vissza)
- [x] `useUIStore.musicVolume` + `difficulty`; `useAudio` hangerő-paraméter; `App` bekötés
- [x] Sarok-nyelvváltó és harang eltávolítása; `LanguageSwitcher` a Beállításokba
- [x] i18n kulcsok mind az 5 nyelven (`mainMenu.*`, `settings.*`, `difficulty.*`)
- [x] Intro: rAF-blokkfix + lassabb görgetés (120s)
- [x] Ellenőrzés: tsc, 14/14 teszt, build, kulcs-paritás (109/nyelv)
- [ ] **Login bekötése** (Firebase) → [[003-firebase-auth-settings]]
- [ ] **Áruház gomb bekötése** → [[002-ingame-shop-frontend]] (helyi bolt), később backend: [[005-ingame-shop-strapi-stripe]]
- [ ] **Nehézség hatása a játékmenetre** (későbbi)
- [ ] **Beállítások per-felhasználós mentése** (Firebase) → [[003-firebase-auth-settings]]

---

## 9. Kapcsolódó tervek
- [[003-firebase-auth-settings]] – login, per-felhasználós beállítás-mentés, Fiók-szekció.
- [[000-i18n-nyelvesites]] – a nyelvi réteg; a `LanguageSwitcher` most a Beállításokban.
- [[002-ingame-shop-frontend]] – az Áruház gomb valódi (helyi) célja; a Beállítások zeneválasztója.
- [[005-ingame-shop-strapi-stripe]] – a bolt későbbi backend-bekötése (Strapi + Stripe).
