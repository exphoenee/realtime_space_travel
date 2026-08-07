---
title: "Játékállapot perzisztálása oldalfrissítésnél (F5/Ctrl+R)"
slug: 007-state-persist-page-refresh
type: plan
category: core
status: implemented
implemented: true
implemented_at: "2026-07-26"
created_at: "2026-07-26"
updated_at: "2026-07-28"  # frissítve: fiókhoz kötött adat kikerült a localStorage-ból (G. blokk)
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
  - 012-wall-of-shame
  - 013-social-multiplayer
tags:
  - state
  - persist
  - localStorage
  - page-refresh
  - visibility-change
  - rtdb
  - identity
  - privacy
  - bugfix
---

# Játékállapot perzisztálása oldalfrissítésnél (F5/Ctrl+R)

**Cél:** a játékos bármikor frissíthesse az oldalt (F5, Ctrl+R, böngésző gomb) anélkül, hogy elveszítené a játék aktuális állapotát. Frissítés után abba az állapotba kerüljön vissza, ahol a frissítés előtt volt. Ezen felül: ha játék közben a felhasználó elhagyja az oldalat (másik tab, böngésző minimalizálás) és 60 másodpercnél tovább távol van, a játék érjen véget (crewLost); ha 60 másodpercen belül visszatér, a visszaszámláló folytatódjon a ténylegesen eltelt idővel.

## Döntések (egyeztetve)

| Kérdés | Választás |
|--------|-----------|
| Függőség más tervektől | **Független** — új terv (step 7) |
| Storage mechanizmus | **Zustand persist middleware** kiterjesztése (localStorage) a meglévő store-okhoz |
| Shop aktív tab perzisztálása | `useShopStore` kiterjesztése `persist` middleware-rel, külön localStorage kulccsal (`space-travel-shop`) |
| Page leave detektálás | `document.visibilitychange` + `window.beforeunload` |
| Stripe visszatérés | Már kezelve a [[005-ingame-shop-strapi-stripe]] tervben (URL detektálás → shop) |
| **Mi kerülhet localStorage-ba?** (2026-07-28, G. blokk) | **Kizárólag eszközszintű adat** (fázis, aktív tab, hangerő, nyelv, nehézség, kamera-hozzájárulás). **Minden fiókhoz kötött adat RTDB-ből jön** — a localStorage a böngészőhöz tartozik, nem a felhasználóhoz, és minden fiók osztozik rajta. |
| Kijelentkezéskori takarítás | **Lokális-only** `clearUserScopedData()` helper — nem hív RTDB-írást (nem `resetShop()`), hogy az elhagyott fiók szerveroldali adatát ne rongálja |
| Identitásváltás definíciója | Csak a **regisztrált (nem anonim) uid** váltása számít. Vendég → Google = **session-upgrade, nincs törlés**; Google → kijelentkezés vagy másik Google fiók = **törlés** |

---

## ✅ Haladás (TODO)

> Jelölés: `[ ]` hátravan · `[~]` folyamatban · `[x]` kész.

**A. useGameStore persist middleware hozzáadása**
- [x] `zustand/middleware` → `persist` import
- [x] Perzisztálandó mezők: `gamePhase`, `destination`, `pendingDestination`, `remainingYears`, `shipSpeedKmPerSecond`, `serviceSeconds`, `bestServiceSeconds`
- [x] Nem perzisztálandó: `crewLost`, `crewLostReason`, `missionComplete`, `isAttentionLost`, `isPaused`, `isInitializing`, `debugIgnoreAttention` (származtatott vagy munkamenet-specifikus)
- [x] LocalStorage kulcs: `space-travel-game`
- [x] `partialize` opció a nem kívánt mezők kizárására
- [x] `onRehydrateStorage` callback — helyette `setTimeout(0)` + `transitionTo` App.tsx-ben (egyszerűbb)

**B. Page leave detektálás (visibilitychange + beforeunload)**
- [x] `usePageLeave` hook létrehozása (`src/hooks/usePageLeave.ts`)
- [x] `document.visibilitychange` esemény: amikor `hidden` → timestamp mentés localStorage-ba
- [x] `window.beforeunload` esemény: ugyanaz a timestamp mentés
- [x] Amikor `visible` vissza → eltelt idő kiszámítása

**C. Visszatérési logika**
- [x] Ha eltelt idő ≤ 60 másodperc → `inactivitySeconds` beállítása az eltelt időre → `gamePhase = "paused"` (a countdown automatikusan indul az `ATTENTION_INTERVAL_MS` tick-ben)
- [x] Ha eltelt idő > 60 másodperc → `gamePhase = "crewLost"` + `crewLostReason = "attention"`
- [x] Ha nem játék fázisban volt a user (intro, mainMenu, settings, shop) → nem kell page leave logika (csak a phase perzisztálás elég)

**D. App.tsx integráció**
- [x] `usePageLeave` hook bekötése
- [x] Persist rehidratáció utáni fázis helyreállítás: `setTimeout(0)` → `transitionTo(mentettPhase)`
- [x] Edge case: ha nincs mentett állapot → intro (alapértelmezett)

**E. useShopStore aktív tab perzisztálása**
- [x] `zustand/middleware` → `persist` import hozzáadása a `useShopStore`-hoz
- [x] `activeShopTab` mező létrehozása a store-ban (típus: `string`, alapértelmezett: `"exoplanets"`)
- [x] `setActiveShopTab` action létrehozása
- [x] `partialize` opció: csak `activeShopTab` mezőt perzisztáljuk
- [x] LocalStorage kulcs: `space-travel-shop` (külön kulcs, mert a shop állapot független a játékállapottól)
- [x] `ShopScreen.tsx` átállítása: `useState` → `useShopStore` (`activeShopTab` + `setActiveShopTab`)

**F. Tesztelés**
- [x] F5 frissítés főmenüben → főmenü marad
- [x] F5 frissítés shopban (exoplanets tab) → shop marad, exoplanets tab aktív
- [x] F5 frissítés shopban (credits tab) → shop marad, credits tab aktív
- [x] F5 frissítés shopban (ships tab) → shop marad, ships tab aktív
- [x] F5 frissítés játék közben → játék folytatódik (ugyanaz a destination, remainingYears)
- [x] Tab váltás 30 másodpercre → visszaszámláló a maradék 30 másodperccel
- [x] Tab váltás 90 másodpercre → game over (crewLost)
- [x] Stripe fizetés utáni visszatérés → shop (már a 005-ös tervben)

**G. Fiókhoz kötött adat kivezetése a localStorage-ból + identitásváltás-takarítás (2026-07-28)**

> Kiváltó tünet: kijelentkezés után a szégyenfal és az áruház vásárlási előzményei az **előző user** adatait mutatták, és a szégyenfal statisztikái (sikerráta, leggyakoribb halálok, összes utazott év) is beszámították azokat az új usernek. Részletes hibaelemzés: [[012-wall-of-shame]] R. blokk.

- [x] **Elv rögzítve:** localStorage-ban **csak eszközszintű** adat; minden fiókhoz kötött adat RTDB-ből jön
- [x] `useGameStore.partialize` — **kikerült**: `failureRecords`, `successRecords`, `bestServiceSeconds`
- [x] Indoklás kommentben is rögzítve a `useGameStore`-ban: mindhárom megvan RTDB-ben (`walls/{rtdbKey}`, `users/{rtdbKey}/stats`) és onnan is töltődik (szégyenfal-képernyő feliratkozása, illetve `handleUserData` max-merge)
- [x] `useShopStore.partialize` — **kikerült**: `purchaseHistory` (RTDB: `users/{uid}/purchases`, lásd [[002-ingame-shop-frontend]] E. rész)
- [x] `useShopStore.partialize` — **maradt**: `activeShopTab` (eszközszintű) és `boughtCreditPacks` (unlock-szintű)
- [x] **Új:** `useGameStore.clearUserScopedData()` action — `failureRecords`, `successRecords`, `bestServiceSeconds`, `missionEventLog`, `friendWallTarget*`, `chatTarget*` nullázása
- [x] **Új fájl:** `src/state/clearUserScopedData.ts` — a store-action hívása + a shop lokális állapotának ürítése (`credits`, `creditsLoaded`, `owned` → `BASE_EXOPLANET_IDS`, `cart`, `purchaseHistory`)
- [x] **Szándékosan lokális-only:** nem a `useShopStore.resetShop()` fut, mert az RTDB-be is kiírná a resetet, és az **elhagyott fiók szerveroldali adatát rongálná**
- [x] Az **eszközszintű beállítások megmaradnak** (hangerő, nyelv, nehézség, kamera-hozzájárulás) — a böngészőhöz tartoznak, nem a userhez
- [x] `App.tsx` identitás-figyelő (`useAuthStore.subscribe`): csak a **regisztrált (nem anonim)** uid-t követi
- [x] Vendég → Google bejelentkezés = **NINCS** törlés (ugyanaz az ember session-upgrade közben; a `migrateGuestData` épp átvitte az adatait — [[010-firebase-guest-merge-single-gate]])
- [x] Google → kijelentkezés vagy másik Google fiók = **törlés**
- [x] Oldalfrissítés bejelentkezve = **nincs** törlés: a kiindulási `lastAuthedUid` a store **aktuális** állapotából jön, nem `null`-ról indul, így az auth aszinkron feloldódása nem számít váltásnak
- [x] Ellenőrzés: `tsc --noEmit` tiszta · `npm run test` **77/77** zöld · `npm run build` sikeres

---

## 1. Architektúra

```
┌─────────────────────────────────────────────┐   ┌─────────────────────────────────────────────┐
│  Zustand Store (useGameStore)                │   │  Zustand Store (useShopStore)                 │
│  ┌───────────────────────────────────────┐   │   │  ┌───────────────────────────────────────┐   │
│  │  persist middleware (localStorage)     │   │   │  │  persist middleware (localStorage)     │   │
│  │  Kulcs: "space-travel-game"           │   │   │  │  Kulcs: "space-travel-shop"           │   │
│  │  Perzisztált: gamePhase, destination, │   │   │  │  Perzisztált: activeShopTab           │   │
│  │  remainingYears, serviceSeconds,       │   │   │  └───────────────────────────────────────┘   │
│  │  inactivitySeconds, ...                │   │   └─────────────────────────────────────────────┘
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

**Flow (F5 frissítés — játékállapot):**
1. User F5 → oldal újratöltődik
2. React app mount → Zustand persist middleware visszatölti a localStorage-ból a mentett state-t
3. `setTimeout(0)` → ha `gamePhase !== "intro"`, App.tsx `transitionTo(mentettPhase)` hív
4. Auth bootstrap lefut (párhuzamosan)
5. User ugyanott folytatja, ahol abbahagyta

**Flow (F5 frissítés — shop tab):**
1. User F5 a shop böngészése közben → oldal újratöltődik
2. A `gamePhase` perzisztálás miatt a shop fázisba kerül vissza a user → `ShopScreen` komponens mountol
3. `ShopScreen` a `useShopStore.activeShopTab` értéket olvassa (visszatöltve localStorage-ból)
4. Az a tab jelenik meg, amelyiken a user a frissítés előtt volt

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
  // Social célpontok — a perzisztált fázis helyreállításához kellenek
  friendWallTargetUid: string | null;    // [[013-social-multiplayer]] I. blokk
  friendWallTargetName: string | null;
  chatTargetUid: string | null;          // [[013-social-multiplayer]] M. blokk
  chatTargetName: string | null;
  // ❌ bestServiceSeconds — KIKERÜLT (2026-07-28, G. blokk): fiókhoz kötött,
  //    RTDB-ben él (users/{rtdbKey}/stats) és onnan max-merge-dzsel töltődik
  // ❌ failureRecords / successRecords — KIKERÜLT (2026-07-28, G. blokk):
  //    RTDB walls/{rtdbKey}/failures|successes
}
```

### Perzisztálandó mezők (useShopStore)

```ts
interface PersistedShopState {
  activeShopTab: string;       // "exoplanets" | "ships" | "music" | "credits" — eszközszintű
  boughtCreditPacks: string[]; // unlock-szintű (whale ship láthatóság)
}
```

### Perzisztálási elv (2026-07-28, G. blokk) — mi maradhat localStorage-ban?

> **localStorage = eszköz. RTDB = fiók.** A localStorage origin-szintű, és a böngészőt használó **minden** fiók osztozik rajta. Ezért fiókhoz kötött adat nem kerülhet bele — különben a következő felhasználó látja (és a statisztikái beszámítják) az előzőét.

| Adat | Hol él | Perzisztál localStorage-ba? |
|---|---|---|
| `gamePhase`, `destination`, `remainingYears`, `serviceSeconds`, `shipSpeedKmPerSecond` | munkamenet | ✅ igen (eszköz/munkamenet) |
| `activeShopTab`, `boughtCreditPacks` | eszköz / unlock | ✅ igen |
| `musicVolume`, `language`, `difficulty`, `cameraConsent` (`useUIStore`) | eszköz | ✅ igen |
| `failureRecords`, `successRecords` | **RTDB** `walls/{rtdbKey}/failures\|successes` | ❌ **nem** (2026-07-28 óta) |
| `bestServiceSeconds` | **RTDB** `users/{rtdbKey}/stats` | ❌ **nem** (2026-07-28 óta) |
| `purchaseHistory` | **RTDB** `users/{uid}/purchases` | ❌ **nem** (2026-07-28 óta) |
| `credits`, `owned` | **RTDB** `wallet` / `inventory` | ❌ nem (már a [[004-firebase-auth-bugfix]] óta) |

**Ára:** a szégyenfal listája és a vásárlási előzmény pár száz ms-mal a képernyő megnyitása **után** jelenik meg (RTDB `onValue`), nem azonnal. Ezt a tervezet **tudatosan** vállalja: a helyes adat késve jobb, mint az idegen adat azonnal.

### Fiókváltáskori takarítás (`src/state/clearUserScopedData.ts`)

```
useAuthStore.subscribe  →  authedUid = user && !user.isAnonymous ? user.uid : null
        │
        ├── lastAuthedUid === null          → nincs teendő (vendég → Google = session-upgrade)
        ├── lastAuthedUid === authedUid     → nincs teendő (F5, aszinkron auth-feloldás)
        └── lastAuthedUid !== authedUid     → clearUserScopedData()
                                                 ├── useGameStore.clearUserScopedData()
                                                 │     failureRecords / successRecords /
                                                 │     bestServiceSeconds / missionEventLog /
                                                 │     friendWallTarget* / chatTarget*
                                                 └── useShopStore.setState (LOKÁLIS-ONLY)
                                                       credits / creditsLoaded / owned /
                                                       cart / purchaseHistory
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
| `src/state/useShopStore.ts` | `persist` middleware hozzáadása, `activeShopTab` + `setActiveShopTab`, `partialize` |
| `src/components/shop/ShopScreen.tsx` | `useState` → `useShopStore` (activeShopTab + setActiveShopTab) |
| `src/hooks/usePageLeave.ts` | **ÚJ** — `visibilitychange` + `beforeunload` kezelés, eltelt idő számítás, crewLost/countdown logika |
| `src/App.tsx` | `usePageLeave` bekötése, persist rehidratáció utáni fázis helyreállítás |

### Módosuló / új fájlok — G. blokk (2026-07-28)

| Fájl | Módosítás |
|------|-----------|
| `src/state/clearUserScopedData.ts` | **ÚJ** — fiókhoz kötött lokális állapot ürítése (game store action + shop `setState`), **RTDB-írás nélkül** |
| `src/state/useGameStore.ts` | +`clearUserScopedData()` action; `partialize`-ból **kikerült** a `failureRecords`, `successRecords`, `bestServiceSeconds` (+ indoklás kommentben) |
| `src/state/useShopStore.ts` | `partialize`-ból **kikerült** a `purchaseHistory`; maradt `activeShopTab` + `boughtCreditPacks` |
| `src/App.tsx` | +identitás-figyelő `useAuthStore.subscribe` → `clearUserScopedData()` regisztrált uid váltásakor |

### Nem módosul (már működik)
- `useUIStore` — a settings perzisztálása Firebase RTDB-n keresztül történik
- `App.tsx` Stripe URL detektálás — már megvan a [[005-ingame-shop-strapi-stripe]]-ben

---

## 4. Megvalósítási lépések (sorrend)

1. `useGameStore` persist middleware hozzáadása (`partialize`)
2. `useShopStore` persist middleware hozzáadása, `activeShopTab` + `setActiveShopTab` action
3. `ShopScreen.tsx` átállítása: `useState` → `useShopStore` az aktív tabhoz
4. `usePageLeave` hook létrehozása (visibilitychange + beforeunload)
5. `App.tsx` integráció: hook bekötés + rehidratáció utáni fázis helyreállítás
6. Tesztelés: F5 (főmenü, shop különböző tabokkal, játék közben), tab váltás, Stripe visszatérés

---

## 5. Ismert kockázatok / korlátok

- **Persist aszinkron:** A Zustand persist middleware aszinkron módon rehidratál a localStorage-ból (a `create` hívás után egy microtask-kal). Ezért a store kezdeti értéke a default, és csak később cserélődik le a mentett értékekre. Az `onRehydrateStorage` callback-ben kell a helyreállítási logikát futtatni.
- **beforeunload vs visibilitychange:** A `beforeunload` nem minden böngészőben megbízható (pl. mobilon). A `visibilitychange` robusztusabb. Mindkettőt használjuk, de a `visibilitychange` az elsődleges.
- **Tab háttérben futó időzítők:** A `setInterval` és `setTimeout` pontatlanná válhat háttérben futó tab-oknál. A page leave timestamp mentése megoldja ezt — a visszatéréskor a tényleges eltelt időt számoljuk.
- **Stripe visszatérés:** A Stripe-ról visszatéréskor az URL path detektálás (`/shop/success`) már működik a [[005-ingame-shop-strapi-stripe]] tervben. A phase persist nem írja felül ezt — a Stripe return magasabb prioritású.
- **Shop tab perzisztálás nem érinti a kredit/birtoklás logikát:** A `useShopStore` csak `activeShopTab`-t (és a `boughtCreditPacks`-ot) perzisztál — a kredit, owned, cart, purchaseHistory adatok Firebase RTDB-ből és munkamenetből jönnek. A két rendszer független.

### Kockázatok — G. blokk (2026-07-28)

- **A localStorage a böngészőhöz tartozik, nem a felhasználóhoz.** Bármilyen fiókhoz kötött érték perzisztálása **adatszivárgás** a következő felhasználó felé. Új `partialize` mező felvétele előtt kötelező a kérdés: *ez az adat az eszközhöz vagy a fiókhoz tartozik?*
- **Az „append-only" mezők a legveszélyesebbek.** A `failureRecords` / `successRecords` sosem **cserélődik**, csak hozzáfűződik (`id` szerinti dedupe-merge, [[012-wall-of-shame]] P. blokk) — ezért ott az idegen adat nem íródott felül a bejelentkezéskor, hanem **véglegesen** ottragadt, és a statisztikákba (sikerráta, leggyakoribb halálok, összes utazott év) is beszámított.
- **A takarítás nem írhat RTDB-be.** A `clearUserScopedData` szándékosan **nem** a `useShopStore.resetShop()`-ot használja: az a resetet a szerverre is kiírná, és az **épp elhagyott** fiók walletjét/inventoryját nullázná.
- **A vendég→Google váltás nem identitásváltás.** Ugyanaz az ember frissíti a munkamenetét; a `migrateGuestData` ([[010-firebase-guest-merge-single-gate]]) épp ekkor viszi át az adatait. Ha itt is törölnénk, a frissen migrált adat tűnne el a képernyőről.
- **Az auth aszinkron feloldódása nem lehet „váltás".** Az `App.tsx` figyelő kiindulási értéke a store **aktuális** állapotából jön, nem `null`-ról indul — enélkül minden oldalfrissítés törlésnek látszana a bejelentkezett játékosnál.
- **Késleltetett első render:** RTDB-ből érkező listáknál a képernyő rövid ideig üres. Minden ilyen felületnek **empty state**-je van, és minden subscription-nek **error callbackje** (néma `PERMISSION_DENIED` elkerülése, [[013-social-multiplayer]] N. blokk) — különben a „még tölt" és a „nincs adat" megkülönböztethetetlen.

---

## 6. Kapcsolódó tervek

- [[005-ingame-shop-strapi-stripe]] – Stripe visszatérés URL detektálás (az App.tsx-ben)
- [[003-firebase-auth-settings]] – auth, RTDB séma (a kredit perzisztálása itt történik)
- [[002-ingame-shop-frontend]] – shop UI (a phase persist a shop fázist is megőrzi, a shop tab perzisztálás kiegészíti ezt). **G. blokk:** a `purchaseHistory` kikerült a `partialize`-ból, és RTDB-be került (`users/{uid}/purchases`).
- [[012-wall-of-shame]] – a `failureRecords` / `successRecords` / `bestServiceSeconds` **kikerült** a persistből; a szégyenfal az RTDB-ből tölt (R. blokk ott írja le a kiváltó adatszivárgást).
- [[013-social-multiplayer]] – a `chatTarget*` / `friendWallTarget*` **továbbra is** perzisztált (fázis-helyreállítás), de fiókváltáskor a `clearUserScopedData` nullázza őket, mert az előző fiók barát-gráfjára mutatnak.
- [[010-firebase-guest-merge-single-gate]] – a vendég→Google váltás **nem** vált ki takarítást; a guest adatait a `migrateGuestData` viszi át.
- [[009-firebase-identity-split-bugfix]] – ugyanaz az alapelv másik oldalról: az identitás forrása kizárólag a `getRtdbKey()`; a lokális gyorsítótár sosem lehet igazságforrás.
- [[020-nextjs-migration]] – **a persist mechanizmus SSR-védelme.** A Next.js migráció után a `localStorage` már nem érhető el minden környezetben (szerveroldali modul-kiértékelés), ezért a `space-travel-game` és a `space-travel-shop` store `skipHydration: true` opciót kap + kliensoldali `rehydrate()`-et, a teljes `src/` fa pedig egy `dynamic(..., { ssr: false })` határ mögé kerül. ⚠️ **Ez a terv a mérce:** a migráció után az F5-viselkedésnek **bitre azonosnak** kell lennie az itt rögzítettel — bármilyen eltérés (villanásnyi `intro`, elveszett fázis, elveszett `chatTarget*`) **regresszió**. A migráció a `partialize` listákhoz **nem nyúl**, és a persist kulcsneveket **nem változtatja**. ⚠️ Külön figyelendő: a domainváltás (Firebase Hosting → Vercel) miatt a **localStorage nem vándorol**, tehát a **be nem jelentkezett vendégek** elveszítik a lokális haladásukat és új `deviceId`-t kapnak (020 7.8) — ez nem a persist logika hibája, hanem a böngésző origin-izolációja.

---

## 7. Kész definíció — bővítés (2026-07-28, G. blokk)

- A `space-travel-game` és a `space-travel-shop` localStorage kulcs **egyetlen fiókhoz kötött mezőt sem** tartalmaz: a `failureRecords`, `successRecords`, `bestServiceSeconds` és `purchaseHistory` kikerült a `partialize`-ból.
- Kijelentkezés (vagy másik Google fiókba lépés) után a szégyenfal, a szégyenfal-statisztikák és a vásárlási előzmény **üres**, majd az új fiók RTDB-adataival töltődik fel.
- A vendég → Google bejelentkezés **nem** törli a lokális állapotot, és az oldalfrissítés sem.
- Az eszközszintű beállítások (hangerő, nyelv, nehézség, kamera-hozzájárulás) a váltást **túlélik**.
- A takarítás **nem ír RTDB-be** — az elhagyott fiók szerveroldali adata érintetlen marad.
- `tsc --noEmit` tiszta · `npm run test` **77/77** zöld · `npm run build` sikeres.
