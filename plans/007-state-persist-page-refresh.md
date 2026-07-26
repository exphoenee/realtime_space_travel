---
title: "Játékállapot perzisztálása oldalfrissítésnél (F5/Ctrl+R)"
slug: 007-state-persist-page-refresh
type: plan
category: core
status: not-started
implemented: false
implemented_at: null
created_at: "2026-07-26"
updated_at: "2026-07-26"
author: exphoenee
step: 7
phases:
  - 4
dependencies:
  - 004-firebase-auth-bugfix
related_plans:
  - 002-ingame-shop-frontend
  - 003-firebase-auth-settings
  - 005-ingame-shop-strapi-stripe
tags:
  - state
  - persist
  - localStorage
  - page-refresh
  - visibility-change
---

# Játékállapot perzisztálása oldalfrissítésnél (F5/Ctrl+R)

**Cél:** a játékos bármikor frissíthesse az oldalt (F5, Ctrl+R, böngésző gomb) anélkül, hogy elveszítené a játék aktuális állapotát. Frissítés után abba az állapotba kerüljön vissza, ahol a frissítés előtt volt. Ezen felül: ha játék közben a felhasználó elhagyja az oldalat (másik tab, böngésző minimalizálás) és 60 másodpercnél tovább távol van, a játék érjen véget (crewLost); ha 60 másodpercen belül visszatér, a visszaszámláló folytatódjon a ténylegesen eltelt idővel.

## Döntések (egyeztetve)

| Kérdés | Választás |
|--------|-----------|
| Függőség más tervektől | **Független** — új terv (step 7) |
| Storage mechanizmus | **Zustand persist middleware** kiterjesztése (localStorage) a meglévő store-okhoz |
| Page leave detektálás | `document.visibilitychange` + `window.beforeunload` |
| Stripe visszatérés | Már kezelve a [[005-ingame-shop-strapi-stripe]] tervben (URL detektálás → shop) |

---

## ✅ Haladás (TODO)

> Jelölés: `[ ]` hátravan · `[~]` folyamatban · `[x]` kész.

**A. useGameStore persist middleware hozzáadása**
- [ ] `zustand/middleware` → `persist` import
- [ ] Perzisztálandó mezők: `gamePhase`, `destination`, `pendingDestination`, `remainingYears`, `shipSpeedKmPerSecond`, `serviceSeconds`, `inactivitySeconds`, `bestServiceSeconds`
- [ ] Nem perzisztálandó: `crewLost`, `crewLostReason`, `missionComplete`, `isAttentionLost`, `isPaused`, `isInitializing`, `debugIgnoreAttention` (származtatott vagy munkamenet-specifikus)
- [ ] LocalStorage kulcs: `space-travel-game`
- [ ] `partialize` opció a nem kívánt mezők kizárására
- [ ] `onRehydrateStorage` callback a visszatöltés utáni logika futtatásához

**B. Page leave detektálás (visibilitychange + beforeunload)**
- [ ] `usePageLeave` hook létrehozása (`src/hooks/usePageLeave.ts`)
- [ ] `document.visibilitychange` esemény: amikor `hidden` → timestamp mentés localStorage-ba
- [ ] `window.beforeunload` esemény: ugyanaz a timestamp mentés
- [ ] Amikor `visible` vissza → eltelt idő kiszámítása

**C. Visszatérési logika**
- [ ] Ha eltelt idő ≤ 60 másodperc → `inactivitySeconds` beállítása az eltelt időre → `gamePhase = "paused"` (a countdown automatikusan indul az `ATTENTION_INTERVAL_MS` tick-ben)
- [ ] Ha eltelt idő > 60 másodperc → `gamePhase = "crewLost"` + `crewLostReason = "attention"`
- [ ] Ha nem játék fázisban volt a user (intro, mainMenu, settings, shop) → nem kell page leave logika (csak a phase perzisztálás elég)

**D. App.tsx integráció**
- [ ] `usePageLeave` hook bekötése
- [ ] Persist rehidratáció utáni fázis helyreállítás: ha a mentett `gamePhase` nem `"intro"`, akkor `transitionTo(mentettPhase)` az auth bootstrap után
- [ ] Edge case: ha nincs mentett állapot → intro (alapértelmezett)

**E. Tesztelés**
- [ ] F5 frissítés főmenüben → főmenü marad
- [ ] F5 frissítés shopban → shop marad
- [ ] F5 frissítés játék közben → játék folytatódik (ugyanaz a destination, remainingYears)
- [ ] Tab váltás 30 másodpercre → visszaszámláló a maradék 30 másodperccel
- [ ] Tab váltás 90 másodpercre → game over (crewLost)
- [ ] Stripe fizetés utáni visszatérés → shop (már a 005-ös tervben)

---

## 1. Architektúra

```
┌─────────────────────────────────────────────┐
│  Zustand Store (useGameStore)                │
│  ┌───────────────────────────────────────┐   │
│  │  persist middleware (localStorage)     │   │
│  │  Kulcs: "space-travel-game"           │   │
│  │  Perzisztált: gamePhase, destination, │   │
│  │  remainingYears, serviceSeconds,       │   │
│  │  inactivitySeconds, ...                │   │
│  │  Kihagyva: crewLost, missionComplete,  │   │
│  │  isAttentionLost (származtatott)       │   │
│  └───────────────────────────────────────┘   │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│  usePageLeave hook                           │
│  ┌───────────────────────────────────────┐   │
│  │  visibilitychange → timestamp        │   │
│  │  beforeunload → timestamp            │   │
│  │  visible → calculate elapsed         │   │
│  │  elapsed ≤ 60s → restore countdown  │   │
│  │  elapsed > 60s → crewLost           │   │
│  └───────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

**Flow (F5 frissítés):**
1. User F5 → oldal újratöltődik
2. React app mount → Zustand persist middleware visszatölti a localStorage-ból a mentett state-t
3. `onRehydrateStorage` → ha `gamePhase !== "intro"`, App.tsx `transitionTo(mentettPhase)` hív
4. Auth bootstrap lefut (párhuzamosan)
5. User ugyanott folytatja, ahol abbahagyta

**Flow (tab váltás / oldal elhagyás):**
1. `visibilitychange` → `hidden` → timestamp mentés localStorage-ba
2. User eltávolodik a géptől
3. `visibilitychange` → `visible` → eltelt idő kiszámítása
4. Ha `gamePhase` nem játék fázis (intro/mainMenu/shop/stb.) → nincs teendő
5. Ha `gamePhase === "playing"`:
   - ≤ 60s: `inactivitySeconds = elapsed`, `gamePhase = "paused"` → a meglévő `ATTENTION_INTERVAL_MS` tick felveszi és átvált countdown-ba
   - > 60s: `gamePhase = "crewLost"`, `crewLostReason = "attention"`

---

## 2. Adatmodell

### Perzisztálandó mezők (useGameStore)

```ts
interface PersistedGameState {
  gamePhase: GamePhase;
  destination: Destination | null;
  pendingDestination: Destination | null;
  remainingYears: number;
  shipSpeedKmPerSecond: number;
  serviceSeconds: number;
  bestServiceSeconds: number;
}
```

### Nem perzisztálandó (származtatott / munkamenet)

```ts
// Ezeket a phaseToFlags() állítja elő a gamePhase-ből:
isPaused: boolean;
isAttentionLost: boolean;
crewLost: boolean;
crewLostReason: CrewLostReason;
missionComplete: boolean;
isInitializing: boolean;

// Ezek munkamenet-specifikusak:
inactivitySeconds: number;  // page leave után újraszámolva
debugIgnoreAttention: boolean;
```

### Page leave timestamp (localStorage, nem Zustand)

```ts
const PAGE_LEAVE_KEY = "space-travel-page-leave-timestamp";
// Érték: Date.now() amikor a page elhagyásra kerül
// Törölve: amikor a page leave logika lefutott a visszatéréskor
```

---

## 3. Módosított / új fájlok

| Fájl | Módosítás |
|------|-----------|
| `src/state/useGameStore.ts` | `persist` middleware hozzáadása, `partialize` a nem kívánt mezők kizárására |
| `src/hooks/usePageLeave.ts` | **ÚJ** — `visibilitychange` + `beforeunload` kezelés, eltelt idő számítás, crewLost/countdown logika |
| `src/App.tsx` | `usePageLeave` bekötése, persist rehidratáció utáni fázis helyreállítás |

### Nem módosul (már működik)
- `useUIStore` — a settings perzisztálása Firebase RTDB-n keresztül történik
- `useShopStore` — a kredit/birtoklás Firebase RTDB-ből jön
- `App.tsx` Stripe URL detektálás — már megvan a [[005-ingame-shop-strapi-stripe]]-ben

---

## 4. Megvalósítási lépések (sorrend)

1. `useGameStore` persist middleware hozzáadása (`partialize` + `onRehydrateStorage`)
2. `usePageLeave` hook létrehozása (visibilitychange + beforeunload)
3. `App.tsx` integráció: hook bekötés + rehidratáció utáni fázis helyreállítás
4. Tesztelés: F5, tab váltás, Stripe visszatérés

---

## 5. Ismert kockázatok / korlátok

- **Persist aszinkron:** A Zustand persist middleware aszinkron módon rehidratál a localStorage-ból (a `create` hívás után egy microtask-kal). Ezért a store kezdeti értéke a default, és csak később cserélődik le a mentett értékekre. Az `onRehydrateStorage` callback-ben kell a helyreállítási logikát futtatni.
- **beforeunload vs visibilitychange:** A `beforeunload` nem minden böngészőben megbízható (pl. mobilon). A `visibilitychange` robusztusabb. Mindkettőt használjuk, de a `visibilitychange` az elsődleges.
- **Tab háttérben futó időzítők:** A `setInterval` és `setTimeout` pontatlanná válhat háttérben futó tab-oknál. A page leave timestamp mentése megoldja ezt — a visszatéréskor a tényleges eltelt időt számoljuk.
- **Stripe visszatérés:** A Stripe-ról visszatéréskor az URL path detektálás (`/shop/success`) már működik a [[005-ingame-shop-strapi-stripe]] tervben. A phase persist nem írja felül ezt — a Stripe return magasabb prioritású.

---

## 6. Kapcsolódó tervek

- [[005-ingame-shop-strapi-stripe]] – Stripe visszatérés URL detektálás (az App.tsx-ben)
- [[003-firebase-auth-settings]] – auth, RTDB séma (a kredit perzisztálása itt történik)
- [[002-ingame-shop-frontend]] – shop UI (a phase persist a shop fázist is megőrzi)
