---
title: "Helyi működésű áruház (frontend-only) terve – mock katalógus + localStorage"
slug: 002-ingame-shop-frontend
type: plan
category: shop
status: not-started
implemented: false
implemented_at: null
created_at: "2026-07-25"
updated_at: "2026-07-25"
author: exphoenee
step: 2
phase: null
dependencies:
  - 001-main-menu-settings
related_plans:
  - 000-i18n-nyelvesites
  - 001-main-menu-settings
  - 003-firebase-auth-settings
  - 004-ingame-shop-strapi-stripe
tags:
  - shop
  - frontend
  - localstorage
  - zustand
  - mock
  - exoplanets
  - ships
  - music
---

# Helyi működésű áruház (frontend-only) terve – mock katalógus + localStorage

**Cél:** a Főmenü „Áruház" gombja mögé egy **teljesen kliensoldali** (backend nélküli) webshop, ahol a játékos **kreditcsomagokat** (valós pénz → in-game kredit), valamint **exobolygókat**, **űrhajókat** és **zenéket** vásárolhat **in-game kreditből**. A katalógus **mock-adat**, a kredit-egyenleg és a birtoklás **localStorage-ban** perzisztál (Zustand `persist`). **Ebben a fázisban a vásárlás CSAK a birtoklást menti** (a tétel „birtokolt" állapotba kerül, kosárba nem tehető újra); a **játékmenetbe kötés** (megvett hajó a küldetésindításban, zene a lejátszóban, exobolygó mint küldetés) **szándékosan NEM része** ennek a fázisnak — az egy **későbbi fázis** feladata (lásd 9. szekció).

> ### 🔗 Fázis-sorrend (fontos)
> Ez a fázis a Firebase ([[003-firebase-auth-settings]]) és a Strapi+Stripe ([[004-ingame-shop-strapi-stripe]]) bekötése **ELŐTT** valósul meg, **tisztán helyi** mock-adattal és localStorage-perzisztenciával. A későbbi fázisok **erre a frontendre épülnek**:
> - **[[003-firebase-auth-settings]]** — a helyi kredit + birtoklás + beállítások **per-felhasználós Firebase-mentése** (a localStorage csak offline tükör lesz). **A kredit-egyenleg forrása a Firebase RTDB lesz.**
> - **[[004-ingame-shop-strapi-stripe]]** — a **mock kreditcsomag-vásárlást Stripe-ra** cseréli (Strapi hook-kal); a mock katalógus és kosár (termékekre) **megmarad**; a bolt-UI és a bekötési pontok megmaradnak.
>
> Vagyis ez a terv **egyszer** megépíti a bolt-UI-t, az adatmodellt és a tulajdon-perzisztenciát; a következő két fázis csak az adat- és fizetési **forrást** cseréli le mögötte. A **birtokolt tartalmak játékmenetbe kötése** (hajó-sebesség, zene-lejátszó, exobolygó-küldetés) **külön, későbbi fázis** — itt nincs scope-ban.

## Döntések (egyeztetve)

| Kérdés | Választás |
|--------|-----------|
| Backend | **Nincs** — tisztán frontend, mock katalógus, `localStorage` perzisztencia |
| Fizetőeszköz | **In-game kredit** (⭐) — a termékeket kreditből veszed, a kreditet valós pénzért (€) veszed |
| Kreditcsomagok (€ → ⭐) | **4 csomag**: 10 € → 100 ⭐, 25 € → 300 ⭐, 50 € → 700 ⭐, 100 € → 2000 ⭐ |
| Kreditvásárlás | A bolt 4. füle: **„Kredit vásárlás"** — mock fizetés (később Stripe), kredit azonnal jóváírva. A Strapi később csak a kreditfeltöltést végzi. |
| Kezdő egyenleg | **Normál mód:** `STARTING_CREDITS = 0` ⭐ (játékosnak nincs kreditje induláskor — vennie kell). **Debug mód** (`VITE_DEBUG_MODE=true`): `DEBUG_STARTING_CREDITS = 9000` ⭐ (teszteléshez) |
| Kredit→€ átváltás termékeknél | `priceEur = priceCredits / CREDITS_PER_EUR` (`CREDITS_PER_EUR = 100`) — csak tájékoztató jellegű |
| Kategóriák | **4**: exobolygók · űrhajók · zenék · **kreditvásárlás** |
| Mennyiség | **Csak 1 db** minden termékből (nincs mennyiség — a user 1-et birtokolhat). Kreditcsomagokból **korlátlanul** lehet venni. |
| Kosár / checkout (termék) | Kosár-ikon a fejlécben tételszámmal → kosár nézet (tétel-lista + végösszeg) → **Fizetés** → mock siker |
| Fizetés hatása (termék) | Kredit levonása, tételek **birtokoltra** állítása (localStorage), kosár ürítése, „sikeres vásárlás" képernyő. **Játékmenetbe kötés NINCS** (későbbi fázis) |
| Fizetés hatása (kredit) | Kredit **hozzáadása** az egyenleghez (nincs levonás, nincs birtoklás). Mock „sikeres fizetés" → egyenleg frissül. |
| Játékmenet-bekötés | **NINCS ebben a fázisban** — a megvett hajó/zene/exobolygó egyelőre csak birtokolt tétel a boltban; a tényleges használat (hajóválasztó, zene-lejátszó, küldetés) **későbbi fázis** |
| Kredithiány (termék) | „Fizetés" letiltva + figyelmeztetés; birtokolt tétel „Birtokolt" jelzéssel, nem tehető kosárba |
| Perzisztencia | **`useShopStore`** (Zustand `persist`), kulcs: **`space-travel-shop`** (nem ütközik: `space-travel-game/ui/lang`) |
| Kredit forrása | Ebben a fázisban `localStorage`. A [[003-firebase-auth-settings]] után a **Firebase RTDB a mérvadó** (a store csak offline tükör). |
| Exobolygó adat helye | `src/data/exoplanets.json` (a `output/exoplanets.json` generátor-kimenet másolata) — Vite JSON-import `src/`-ből; mapper alakítja tétellé + procedurális ár |
| Katalógus (hajó+zene) helye | `src/constants/shopCatalog.ts` — kézzel írt statikus katalógus (a `universeData.ts` mintájára) |
| Exobolygók | Mind a **100** a `src/data/exoplanets.json`-ból; görgethető rács + keresőmező; **procedurális, determinisztikus ár** |
| Űrhajók | **3 mock hajó** eltérő sebességgel — csak katalógus-adat (sebesség flavor); az alap hajó `SHIP_SPEED_KM_PER_SECOND = 191` **marad, nem módosul** |
| Zenék | A meglévő **5** fájl `public/music`-ból, **kisbetűsre + `_`-re átnevezve**; boltban **belehallgatás** (preview) |

---

## ✅ Haladás (TODO)

> Jelölés: `[ ]` hátravan · `[~]` folyamatban · `[x]` kész. Implementáció közben itt vezetjük, hol tartunk, hogy félbeszakadás után folytatható legyen. Részletek a lenti szekciókban.

**A rész — adat + állapot**
- [ ] `output/exoplanets.json` bemásolása `src/data/exoplanets.json`-ba (100 elem, Vite JSON-import) + típus (`ExoplanetRaw`)
- [ ] `src/constants/shopCatalog.ts`: `CREDITS_PER_EUR`, `CREDIT_PACKS` (4 csomag), `STARTING_CREDITS` (0), `DEBUG_STARTING_CREDITS` (9000), `SHOP_SHIPS` (3 mock hajó), `SHOP_MUSIC` (5 sáv), ár-/wage-képletek, `mapExoplanet`
- [ ] Termék-típusok a `src/types/index.ts`-be (`ShopCategory` bővítve `"credits"`-szel, `CreditPack`, `ShopProduct`, `ShipProduct`, `MusicProduct`, `ExoplanetProduct`, `CartItem`, `OwnedItems`)
- [ ] `useShopStore` (Zustand + persist `space-travel-shop`): `credits` (kezdő: 0 normál / 9000 debug), `owned`, `cart`, `isPreviewing` + akciók (`addToCart`, `removeFromCart`, `checkout`, `isOwned`, `buyCredits`)
- [ ] **Debug-kredit:** a kezdő egyenleg `VITE_DEBUG_MODE=true` esetén `DEBUG_STARTING_CREDITS` (9000 ⭐), különben `STARTING_CREDITS` (**0 ⭐**) — a `useShopStore` inicializálásában

**B rész — bolt-UI + navigáció**
- [ ] `GamePhase: "shop"` a `types/index.ts`-be + `phaseToFlags` (pre-game, szüneteltetett — mint `mainMenu`/`settings`) + `App.isPreGame`
- [ ] `ScreenRouter` új ág: `shop → ShopScreen`
- [ ] `MainMenu` „Áruház" gomb: `mainMenu.shopComingSoon` placeholder helyett `transitionTo("shop")`
- [ ] `ShopScreen` (fejléc: cím, kredit-egyenleg, kosár-ikon+tételszám, „← Vissza"; belső nézet-váltó: böngészés/kosár/siker/kreditvásárlás)
- [ ] `ShopTabs` (Exobolygók / Űrhajók / Zenék / **Kredit vásárlás**) + `ProductGrid` + `ProductCard` (kép/név/ár ⭐ (€), „Kosárba" / „Birtokolt")
- [ ] Exobolygó fül: görgethető rács + **keresőmező** (név szerinti szűrés)
- [ ] Zenék átnevezése kisbetűsre `_`-rel a `public/music`-ban + a `shopCatalog.ts` metaadat az új nevekre mutat
- [ ] `MusicPreviewButton` (play/pause) — a háttérzene szüneteltetése preview alatt (`isPreviewing` flag → `App`)
- [ ] `CartView` (tétel-lista, eltávolítás, végösszeg ⭐+€, „Fizetés" gomb, kredithiány-állapot)
- [ ] `CheckoutSuccess` (mock siker; kredit-levonás + birtoklás + kosár-ürítés a store-ban)
- [ ] **`CreditShopView`** — új komponens a 4. fülhöz: kreditcsomagok listája (€ ár, ⭐ mennyiség), mindegyiknél „Megveszem" gomb → mock fizetés → kredit jóváírás

**C rész — i18n + validáció**
- [ ] i18n `shop.*` kulcsok mind az 5 nyelven (kreditvásárlás kulcsokkal együtt) (a fordítást az `i18n` agent végzi a /dev fázisban)
- [ ] Vitest: `useShopStore` (kosár, checkout, kredithiány, birtoklás, `buyCredits`), ár-/wage-képlet determinizmus, debug-kredit inicializálás
- [ ] Ellenőrzés: `tsc`, tesztek, `build`, kulcs-paritás (5 nyelv)

---

## 1. Képernyő-folyamat (GamePhase)

Új fázis a `src/types/index.ts` `GamePhase`-be: **`shop`**. A bolton belüli al-nézetek (böngészés / kosár / sikeres fizetés) **nem** külön `GamePhase`-ek, hanem a `ShopScreen` belső nézet-állapota (`useShopStore.view` vagy helyi `useState`) — így a `ScreenRouter` és a `phaseToFlags` egyszerű marad, és a bolt egyetlen pre-game overlay.

```
mainMenu ──(Áruház)──▶ shop
   ▲                    │  ├─ view: "browse"    (fülek: Exobolygók / Űrhajók / Zenék / Kredit vásárlás)
   │                    │  │   └─ "Kredit vásárlás" fül → CreditShopView (csomagok listája)
   │                    │  ├─ view: "cart"      (kosár tételek + végösszeg + Fizetés)
   │                    │  ├─ view: "success"   (mock sikeres termék-fizetés)
   └──(← Vissza)────────┘  └─ view: "creditSuccess" (mock sikeres kreditvásárlás)
```

- `phaseToFlags("shop")` = **ugyanaz a szüneteltetett pre-game állapot**, mint `mainMenu`/`missionSelect`/`settings` (`showIntro:false, isPaused:true, …`). A `useGameStore` `phaseToFlags` `case`-ébe a `shop` a `mainMenu`/`missionSelect`/`settings` mellé kerül.
- `App.isPreGame` bővül a `shop` fázissal (a `MissionSelector`/`SettingsScreen` mintájára — háttérzene szól, kamera nem kell).
- „← Vissza" a boltból → `transitionTo("mainMenu")`.

---

## 2. Komponensek (mind + `.module.css`)

```
src/
  components/
    shop/
      ShopScreen.tsx         # fő nézet: fejléc + fülek/kosár/siker/kredit váltó
      ShopScreen.module.css
      ShopTabs.tsx           # kategória-fülek (Exobolygók / Űrhajók / Zenék / Kredit vásárlás)
      ProductGrid.tsx        # görgethető rács (+ exobolygóknál keresőmező)
      ProductCard.tsx        # egy termék: kép/név/ár ⭐(€) + gomb (Kosárba / Birtokolt / Kosárban)
      CartButton.tsx         # fejléc kosár-ikon + tételszám badge
      CartView.tsx           # kosár: tétel-lista + eltávolítás + végösszeg + Fizetés
      CheckoutSuccess.tsx    # mock „sikeres fizetés" képernyő
      MusicPreviewButton.tsx # play/pause belehallgatás (háttérzenét szünetelteti)
      CreditBalance.tsx      # kredit-egyenleg kijelző (⭐ N)
      CreditShopView.tsx     # kreditcsomagok: €-ár, ⭐ mennyiség, "Megveszem" gomb
      CreditShopView.module.css
      CreditSuccess.tsx      # mock „sikeres kreditvásárlás" képernyő
```

### `ShopScreen.tsx`
- **Fejléc:** cím (`shop.title`), `CreditBalance` (⭐ egyenleg), `CartButton` (tételszám badge), „← Vissza" gomb → `mainMenu`.
- **Törzs:** a belső `view` szerint:
  - `"browse"` → `ShopTabs` + `ProductGrid` (termék fülek) **vagy** `CreditShopView` („Kredit vásárlás" fül)
  - `"cart"` → `CartView`
  - `"success"` → `CheckoutSuccess`
  - `"creditSuccess"` → kreditvásárlás siker képernyő
- Navigáció közvetlenül a `useShopStore`-ból + `useGameStore.transitionTo`.

### `ProductCard.tsx`
- Kép/ikon, név, leírás/meta, ár **⭐ `priceCredits`** és zárójelben **`(€ priceEur)`**.
- Gomb-állapotok: **„Kosárba"** (alap) · **„Kosárban ✓"** (már a kosárban, eltávolítható) · **„Birtokolt"** (letiltva, ha `isOwned`).
- Zenekártyán ezen felül `MusicPreviewButton`.

### `CartView.tsx`
- Tétel-lista (kép/név/ár, „Eltávolítás").
- **Végösszeg:** ⭐ összeg + `(€ összeg)`.
- **„Fizetés"** gomb → `useShopStore.checkout()` → `view: "success"`.
- **Kredithiány:** ha `cartTotalCredits > credits` → a „Fizetés" letiltva + `shop.notEnoughCredits` figyelmeztetés + javaslat: „Vegyél kreditet a Kredit vásárlás fülön!".

### `CreditShopView.tsx`
- A **4. fül** tartalma („Kredit vásárlás").
- Megjeleníti a 4 kreditcsomagot kártyákon:
  - Csomag név (pl. „Kezdő csomag", „Haladó csomag")
  - **€-ár** (10 / 25 / 50 / 100)
  - **⭐ mennyiség** (100 / 300 / 700 / 2000)
  - **„Megveszem"** gomb
- **„Megveszem"** gomb → `useShopStore.buyCredits(packId)` → mock fizetés:
  1. Kredit hozzáadása az egyenleghez (`credits += pack.credits`)
  2. `view: "creditSuccess"`
- Nincs kosár, nincs birtoklás — a kredit azonnal jóváíródik.

### `CreditSuccess.tsx`
- Mock „sikeres kreditvásárlás" képernyő.
- Mutatja: mennyi kreditet vettél, új egyenleg.
- **„Vissza a boltba"** gomb → `view: "browse"`.

### `MusicPreviewButton.tsx`
- Saját `HTMLAudioElement` a `${BASE_URL}music/<fájl>.mp3` sávra (a `base href` `/realtime_space_travel/`).
- **Ütközés-kezelés a háttérzenével:** preview indításakor a háttérzenét **szüneteltetni** kell. Mivel a `useAudio` hangereje az `App`-ból jön (pre-game alatt szól), a preview idejére egy egyszerű megoldás: a `ShopScreen` a preview alatt `musicVolume`-ot 0-ra fade-eli (vagy egy `previewActive` flaget állít, amit az `App` figyel), leállás után visszaáll. A terv a **flag-alapú** megoldást javasolja (`useShopStore.isPreviewing` → `App` a háttérzenét szünetelteti), hogy ne csússzon szét a két audio-forrás.

---

## 3. Állapot (`useShopStore`)

Új Zustand store `persist`-tel, **`space-travel-shop`** kulccsal (nem ütközik: `space-travel-game`, `space-travel-ui`, `space-travel-lang`).

```ts
interface OwnedItems {
  ships: string[];       // birtokolt hajó-id-k (az alap hajó nincs benne – mindig elérhető)
  music: string[];       // birtokolt zene-id-k
  exoplanets: string[];  // birtokolt exobolygó-id-k (küldetésként választhatók)
}

interface CartItem {
  id: string;
  category: ShopCategory; // "exoplanet" | "ship" | "music"
  priceCredits: number;
}

interface CreditPack {
  id: string;               // "credits-starter" | "credits-advanced" | "credits-premium" | "credits-ultra"
  name: string;             // i18n kulcs vagy nyers név
  priceEur: number;         // €-ban kifejezett ár (valós pénz)
  credits: number;          // kapott kredit mennyiség
}

interface ShopState {
  credits: number;              // kezdő: debug módban DEBUG_STARTING_CREDITS (9000), különben STARTING_CREDITS (0)
  owned: OwnedItems;
  cart: CartItem[];
  isPreviewing: boolean;        // belehallgatás fut-e (háttérzene szüneteltetéshez)

  isOwned: (category: ShopCategory, id: string) => boolean;
  isInCart: (id: string) => boolean;
  addToCart: (item: CartItem) => void;      // csak ha nincs birtokolva és nincs a kosárban (1 db)
  removeFromCart: (id: string) => void;
  cartTotalCredits: () => number;
  checkout: () => { ok: boolean };          // ha credits >= összeg: levon + birtoklásba tesz + üríti a kosarat
  buyCredits: (packId: string) => void;     // kreditcsomag vétele: credits += pack.credits (mock, nincs valós fizetés)
  setPreviewing: (v: boolean) => void;
}
```

- **Kezdő egyenleg:** a `credits` kezdőértéke a `VITE_DEBUG_MODE` env-változóból:
  ```ts
  const initialCredits =
    import.meta.env.VITE_DEBUG_MODE === "true" ? DEBUG_STARTING_CREDITS : STARTING_CREDITS;
  ```
  **Normál módban 0 ⭐** — a játékosnak kreditet kell vennie, mielőtt bármit vásárolhat. Debug módban 9000 ⭐. (Ha persist-elt egyenleg létezik, az felülírja a kezdőértéket.)
- `checkout()`: ha `credits >= cartTotalCredits()`, akkor `credits -= összeg`, a kosár tételeit a `owned` megfelelő kategóriájába teszi, `cart = []`, visszaad `{ ok: true }`; különben `{ ok: false }` (a UI kredithiányt jelez).
- `buyCredits(packId)`: megkeresi a `CREDIT_PACKS`-ban a csomagot, `credits += pack.credits`. **Maga a fizetés mock** (nincs Stripe, nincs valós pénz). Ez a későbbi [[004-ingame-shop-strapi-stripe]] fázisban kap valós Stripe-integrációt.
- `persist.partialize`: `credits`, `owned` (a `cart`, `isPreviewing` **nem** perzisztált — munkamenet-állapot).

> **Migrációs megjegyzés ([[003-firebase-auth-settings]] + [[004-ingame-shop-strapi-stripe]]):** a Firebase-fázisban a `credits` + `owned` mérvadó forrása az RTDB `wallet`/`inventory` lesz (szerver-írt), a `useShopStore` localStorage pedig offline tükör. A `checkout` kredit-levonása akkor **Cloud Functionre** (`purchaseWithCredits`) cserélődik. A `buyCredits` a [[004-ingame-shop-strapi-stripe]] fázisban kap valós Stripe fizetést (Strapi webhook → Firebase kredit hozzáadás). A store publikus API-ja úgy tervezendő, hogy a forrás lecserélhető legyen.

---

## 4. Adatmodell + mock adat

### 4.0 Adattárolás / fájlszerkezet

| Adat | Hely | Forma | Megjegyzés |
|------|------|-------|-----------|
| **Exobolygó nyers adat** (100) | `src/data/exoplanets.json` | JSON (Vite JSON-import) | Az `output/exoplanets.json` generátor-kimenet **másolata**; a shop `src/`-ből importál, egy `mapExoplanet` alakítja tétellé + procedurális ár |
| **Űrhajó katalógus** (3 mock) | `src/constants/shopCatalog.ts` | Kézzel írt statikus TS | Név, ár, sebesség/kapacitás/hatótáv/gyártó flavor (a `universeData.ts` mintájára) |
| **Zene metaadat** (5 sáv) | `src/constants/shopCatalog.ts` | Kézzel írt statikus TS | Név, ár, **fájlnév** (a `public/music/` audiofájlra mutat) |
| **Zene audiofájlok** (5) | `public/music/*.mp3` | Bináris | Kisbetűsre + `_`-re átnevezve; a metaadat hivatkozza `${BASE_URL}music/<fájl>.mp3` |
| **Birtoklás + kredit-egyenleg** | `useShopStore` | Zustand + `persist` | Kulcs: `space-travel-shop` (localStorage) |
| **Konstansok / képletek** | `src/constants/shopCatalog.ts` | TS | `CREDITS_PER_EUR`, `STARTING_CREDITS`, `DEBUG_STARTING_CREDITS`, ár-/wage-képlet, `mapExoplanet` |

> **Miért `src/data/` az exobolygóknak és `src/constants/` a katalógusnak?** Az `output/exoplanets.json` egy generátor **kimenete** (nem forrás), ezért a shop egy verziózott `src/data/` másolatból importál (statikus Vite JSON-import, nem futásidejű `fetch`). A kézzel karbantartott hajó-/zene-katalógus a meglévő `constants/universeData.ts` mintáját követi.

### 4.1 Termék-típusok (`src/types/index.ts`)

```ts
export type ShopCategory = "exoplanet" | "ship" | "music" | "credits";

export interface ShopProductBase {
  id: string;
  category: ShopCategory;
  /** i18n kulcs vagy nyers név (bolygó/hajó/zene) */
  name: string;
  priceCredits: number;
  /** priceCredits / CREDITS_PER_EUR – megjelenítéshez */
  priceEur: number;
}

export interface CreditPack {
  id: string;               // "credits-starter" | "credits-advanced" | "credits-premium" | "credits-ultra"
  nameKey: string;          // i18n kulcs a csomag nevéhez
  priceEur: number;         // €-ban kifejezett valós ár
  credits: number;          // kapott kredit mennyiség ⭐
}

export interface ShipProduct extends ShopProductBase {
  category: "ship";
  speedKmPerSecond: number;   // csak katalógus-flavor ebben a fázisban (nem hat a játékra)
  manufacturer: string;       // flavor
  capacity: number;           // fő
  rangeLy: number;            // hatótáv (flavor)
  descriptionKey: string;     // i18n kulcs a leíráshoz
}

export interface MusicProduct extends ShopProductBase {
  category: "music";
  file: string;               // pl. "neon_heartbeat.mp3" (public/music/ alatt)
  title: string;              // megjelenített cím
}

export interface ExoplanetProduct extends ShopProductBase {
  category: "exoplanet";
  distanceLy: number;         // distance.lightYears
  wage: number;               // procedurális jutalom-mező (jövőbeli küldetés-bekötéshez, most csak adat)
  starName: string;
  temperatureK: number | null;
  massEarth: number | null;
}
```

### 4.2 Konstansok és képletek (`src/constants/shopCatalog.ts`)

```ts
export const CREDITS_PER_EUR = 100;          // 100 ⭐ = 1 € (tájékoztató jellegű)
export const STARTING_CREDITS = 0;           // kezdő egyenleg normál módban — nulláról indul!
export const DEBUG_STARTING_CREDITS = 9000;  // kezdő egyenleg VITE_DEBUG_MODE=true esetén (teszteléshez)

export const eurFromCredits = (c: number) => Math.round((c / CREDITS_PER_EUR) * 100) / 100;

export const CREDIT_PACKS: CreditPack[] = [
  { id: "credits-starter",  nameKey: "shop.credits.starter",  priceEur: 10,  credits: 100  },
  { id: "credits-advanced", nameKey: "shop.credits.advanced", priceEur: 25,  credits: 300  },
  { id: "credits-premium",  nameKey: "shop.credits.premium",  priceEur: 50,  credits: 700  },
  { id: "credits-ultra",    nameKey: "shop.credits.ultra",    priceEur: 100, credits: 2000 },
];
```

**Exobolygó ár-képlet (determinisztikus, csak a bolygó-adatból):**

```ts
// distanceLy = distance.lightYears; massEarth ?? 1; temperatureK ?? 288 (földi átlag)
priceCredits = Math.round(
  200                                   // alap
  + distanceLy * 25                     // távolság-prémium
  + (massEarth ?? 1) * 60               // tömeg-prémium
  + Math.abs((temperatureK ?? 288) - 288) * 0.8  // szélsőséges hőmérséklet-prémium
);
```

**Exobolygó wage (küldetés-jutalom, determinisztikus):**

```ts
wage = Math.round(distanceLy * 15 + (massEarth ?? 1) * 5);
```

> A képletek **tiszta függvények** a bolygó-adatból → stabil, reprodukálható ár (nincs random). Ugyanez a determinizmus teszi lehetővé, hogy a [[004-ingame-shop-strapi-stripe]] fázisban a Strapi-katalógusba **ugyanazokat az árakat** seedeljük.

### 4.3 A 3 mock űrhajó (`SHOP_SHIPS`)

> A `speedKmPerSecond` ebben a fázisban **csak megjelenített katalógus-adat / flavor** (a kártyán látszik) — **NEM** hat a játékmenetre. Az alap hajó `SHIP_SPEED_KM_PER_SECOND = 191` km/s konstans **változatlan** marad; a bolti hajók sebességének tényleges bekötése a küldetésindításba **későbbi fázis** (lásd 9. szekció). Így a CLAUDE.md figyelmeztetése (`SHIP_SPEED_KM_PER_SECOND` + `Dashboard`/`MissionSelector`) ebben a fázisban **nem érintett**.

| id | Név | Gyártó | Sebesség (km/s) | Kapacitás | Hatótáv (LY) | Ár ⭐ | € |
|----|-----|--------|-----------------|-----------|--------------|------|---|
| `ship-nomad-x1` | Nomad X1 | Orion Shipyards | **380** | 4 | 20 | **1200** | 12.00 |
| `ship-vega-runner` | Vega Runner | Helios Dynamics | **920** | 8 | 60 | **4500** | 45.00 |
| `ship-aether-titan` | Aether Titan | Nova Consortium | **2400** | 20 | 200 | **12000** | 120.00 |

Flavor-leírások i18n kulccsal (`shop.ship.nomadX1.desc`, stb.). A `priceEur` a `CREDITS_PER_EUR`-ból számolt.

### 4.4 A 5 zene (`SHOP_MUSIC`)

A meglévő fájlok `public/music`-ban **átnevezendők** kisbetűsre, szóköz → `_`:

| Régi fájlnév | Új fájlnév | id | Ár ⭐ | € |
|--------------|-----------|----|------|---|
| `Dust on the Highway.mp3` | `dust_on_the_highway.mp3` | `music-dust-on-the-highway` | 300 | 3.00 |
| `Late Night Urgency.mp3` | `late_night_urgency.mp3` | `music-late-night-urgency` | 300 | 3.00 |
| `Neon Heartbeat.mp3` | `neon_heartbeat.mp3` | `music-neon-heartbeat` | 300 | 3.00 |
| `Neon Static.mp3` | `neon_static.mp3` | `music-neon-static` | 300 | 3.00 |
| `Rust in the Gears.mp3` | `rust_in_the_gears.mp3` | `music-rust-in-the-gears` | 300 | 3.00 |

> **Fájlnév-hivatkozások:** a `public/music` fájlokat a bolt-preview (`MusicPreviewButton`) és a háttérzene-választó (`useAudio` aktív zene URL) hivatkozza `${import.meta.env.BASE_URL}music/<fájl>.mp3` formában (base href `/realtime_space_travel/`). Az alap háttérzene továbbra is a `${BASE_URL}main_theme.mp3` (a `useAudio`-ban jelenleg hardcode-olt) — a bolti sávok ezt **egészítik ki**, nem cserélik.

### 4.5 Exobolygó adat (`src/data/exoplanets.json`)

- Az `E:\Projects\realtime_space_travel\output\exoplanets.json` (100 elem) **bemásolandó** a `src/data/exoplanets.json`-ba. Az `output/` egy generátor-kimenet; a shop a verziózott `src/data/` másolatból importál **statikus Vite JSON-importtal** (nem futásidejű `fetch`, nem `public/`), a bundle-méret elhanyagolható.
- Szerkezet (a JSON szerint): `name`, `distance.{parsec,lightYears}`, `coordinates`, `star.{name,temperature,mass,radius,age,spectralType}`, `planet.{massEarth,radiusEarth,density,orbitalPeriodDays,semiMajorAxisAU,eccentricity,temperatureK,insolationEarth}`, `discovery.{year,method,facility}`, `images`, `links`.
- Egy `mapExoplanet(raw, index)` segédfüggvény alakítja `ExoplanetProduct`-tá: `id = "exo-" + slug(name)` (ütközésnél `+ index`), `distanceLy = distance.lightYears`, ár/wage a 4.2 képletekből, `name`/`starName`/`temperatureK`/`massEarth` a nyers adatból.
- **Kép:** ha `images.ESA/NASA/Wikipedia` URL létezik → azt használjuk; egyébként **procedurális placeholder** (pl. a `spectralType`/`temperatureK` alapján színezett CSS-gradiens „bolygó-korong"). A terv a placeholder-fallbacket javasolja, hogy ne függjünk külső képek elérhetőségétől.
- **Nem fordítjuk** a bolygó- és csillagneveket (tulajdonnevek — összhangban a [[000-i18n-nyelvesites]] „Nem fordítandó" szakaszával).

---

## 5. A vásárlás hatása — CSAK birtoklás (nincs játékmenet-bekötés)

Ebben a fázisban a `checkout` **kizárólag**:
1. levonja a kreditet (`useShopStore.credits`),
2. a megvett tételt a `useShopStore.owned` megfelelő listájába teszi (`ships` / `music` / `exoplanets`) — localStorage-ban perzisztálva,
3. üríti a kosarat, és megjeleníti a „sikeres vásárlás" képernyőt.

A birtokolt tétel a boltban **„Birtokolt"** jelzést kap és nem tehető újra kosárba. **Ezen túl semmi nem történik** — a megvett hajó/zene/exobolygó egyelőre **nem** hat a játékmenetre:

- **NINCS** hajóválasztóba / küldetésindításba kötés (a hajó `speedKmPerSecond` csak katalógus-flavor; a `SHIP_SPEED_KM_PER_SECOND` konstans, a `Dashboard` és a `MissionSelector` számítása **érintetlen**).
- **NINCS** zene a Beállítások lejátszójában (a boltban csak **belehallgatás/preview** van, ami nem állítja át a háttérzenét; a `SettingsScreen` és a `useAudio` háttérzene-logikája **érintetlen**).
- **NINCS** exobolygó mint választható küldetés (a `MissionSelector`, a `universeData` és a `baseDestinations` **érintetlen** marad).

> A `MusicPreviewButton` **kivétel** a „nincs hatás" alól, de az is csak ideiglenes, izolált előnézet-lejátszás (a preview idejére a háttérzene szünetel az `isPreviewing` flag alapján), **nem** a játék háttérzenéjét cseréli.

A **birtokolt tartalmak tényleges játékmenetbe kötése** (hajó-sebesség a küldetésindításban, zene-sáv a lejátszóban, exobolygó mint küldetés) **külön, későbbi fázis** feladata — lásd a 9. szekciót. Ezért az adatmodellben már megvannak a szükséges mezők (`speedKmPerSecond`, `file`, `distanceLy`, `wage`), hogy a jövőbeli bekötés adat-oldalról előkészített legyen.

---

## 6. i18n kulcslista (`shop.*`)

Mind az 5 nyelven (hu, en, fr, de, es). **Az itt felsorolt a kulcslista; a tényleges fordítást az `i18n` agent végzi a /dev fázisban.** A bolygó-/csillag-/hajó-tulajdonnevek nem fordítandók (lásd [[000-i18n-nyelvesites]]).

```
shop.title                    # „Áruház"
shop.back                     # „← Vissza"
shop.credits                  # „⭐ {{count}} kredit"
shop.balance                  # „Egyenleg: ⭐ {{count}}"
shop.priceCredits             # „⭐ {{credits}}"
shop.priceEur                 # „(€ {{eur}})"
shop.tab.exoplanets           # „Exobolygók"
shop.tab.ships                # „Űrhajók"
shop.tab.music                # „Zenék"
shop.search                   # „Keresés név szerint…"
shop.searchNoResult           # „Nincs találat"
shop.addToCart                # „Kosárba"
shop.inCart                   # „Kosárban ✓"
shop.owned                    # „Birtokolt"
shop.remove                   # „Eltávolítás"
shop.cart.title               # „Kosár"
shop.cart.empty               # „A kosár üres"
shop.cart.total               # „Végösszeg"
shop.cart.checkout            # „Fizetés"
shop.notEnoughCredits         # „Nincs elég kredit ehhez a vásárláshoz."
shop.success.title            # „Sikeres vásárlás!"
shop.success.text             # „A tételeket jóváírtuk. Jó utazást!"
shop.success.continue         # „Vissza a boltba"
shop.cartCount                # „{{count}} tétel"
shop.preview.play             # „Belehallgatás" (aria)
shop.preview.stop             # „Leállítás" (aria)
shop.ship.speed               # „Sebesség: {{value}} km/s"
shop.ship.capacity            # „Kapacitás: {{count}} fő"
shop.ship.range               # „Hatótáv: {{value}} fényév"
shop.ship.manufacturer        # „Gyártó: {{name}}"
shop.ship.nomadX1.desc        # a Nomad X1 leírása
shop.ship.vegaRunner.desc     # a Vega Runner leírása
shop.ship.aetherTitan.desc    # az Aether Titan leírása
shop.exoplanet.distance       # „{{value}} fényév"
shop.exoplanet.star           # „Csillag: {{name}}"
```

> **Elmaradó kulcsok:** a hajó-aktiválás (`shop.activeShip`/`baseShip`/`selectShip`), a Beállítások-zeneválasztó (`settings.musicTrack`/`defaultTrack`) és az exobolygó-jutalom (`shop.exoplanet.wage`) kulcsokra **ebben a fázisban nincs szükség**, mert nincs játékmenet-bekötés — ezek a jövőbeli bekötési fázishoz tartoznak (9. szekció).

### Kreditcsomag i18n kulcsok

```
shop.credits.title            # „Kredit vásárlás"
shop.credits.starter          # „Kezdő csomag"
shop.credits.advanced         # „Haladó csomag"
shop.credits.premium          # „Prémium csomag"
shop.credits.ultra            # „Ultra csomag"
shop.credits.price            # „€ {{price}}"
shop.credits.amount           # „⭐ {{count}} kredit"
shop.credits.buy              # „Megveszem"
shop.credits.successTitle     # „Sikeres kreditvásárlás!"
shop.credits.successText      # „{{credits}} ⭐ kreditet vettél!"
shop.credits.newBalance       # „Új egyenleg: ⭐ {{balance}}"
shop.credits.back             # „Vissza a boltba"
shop.credits.notEnoughCreditsHint  # „Nincs elég kredit. Vegyél kreditet a 'Kredit vásárlás' fülön!"
```

> A `mainMenu.shopComingSoon` kulcs **megmarad** (visszafelé kompatibilitás), de a „Áruház" gomb már nem ezt használja — a placeholder helyett `transitionTo("shop")`.

---

## 7. Érintett / új fájlok

**Új:**
- `src/components/shop/ShopScreen.tsx (+.module.css)`, `ShopTabs.tsx`, `ProductGrid.tsx`, `ProductCard.tsx (+.module.css)`, `CartButton.tsx`, `CartView.tsx`, `CheckoutSuccess.tsx`, `MusicPreviewButton.tsx`, `CreditBalance.tsx (+.module.css)`
- `src/components/shop/CreditShopView.tsx (+.module.css)` — **új**: kreditcsomagok listája
- `src/components/shop/CreditSuccess.tsx` — **új**: sikeres kreditvásárlás képernyő
- `src/state/useShopStore.ts` (+ `useShopStore.test.ts`)
- `src/constants/shopCatalog.ts` (konstansok, `CREDIT_PACKS` (4 csomag), debug-kredit, 3 hajó, 5 zene, ár-/wage-képletek, `mapExoplanet`)
- `src/data/exoplanets.json` (a `output/exoplanets.json` másolata, 100 elem)

**Módosított:**
- `src/types/index.ts` — `GamePhase` (`shop`), `ShopCategory`, `ShopProduct*`, `CartItem`, `OwnedItems`
- `src/state/useGameStore.ts` — `phaseToFlags` (`shop` a pre-game `case`-hez)
- `src/App.tsx` — `isPreGame` bővítés (`shop`) + a preview-flag (`isPreviewing`) figyelése a háttérzene szüneteltetéséhez
- `src/components/routing/ScreenRouter.tsx` — új `case "shop": return <ShopScreen />`
- `src/components/screens/MainMenu.tsx` — „Áruház" gomb: placeholder helyett `transitionTo("shop")`
- `public/music/*` — 5 fájl átnevezése kisbetűsre `_`-rel
- `src/i18n/locales/{en,hu,fr,de,es}/translation.json` — `shop.*` kulcsok

> **Érintetlen (nincs játékmenet-bekötés ebben a fázisban):** `MissionSelector.tsx`, `Dashboard.tsx`, `SettingsScreen.tsx`, `useAudio.ts`, `constants.ts` (`SHIP_SPEED_KM_PER_SECOND`), `universeData.ts`. Ezek módosítása a **jövőbeli bekötési fázishoz** tartozik (9. szekció).

---

## 8. Kockázatok / figyelmeztetések

- **`SHIP_SPEED_KM_PER_SECOND` (CLAUDE.md):** a konstans **nem módosul**, és mivel ebben a fázisban **nincs hajó-sebesség bekötés**, a `Dashboard`/`MissionSelector` számítása is **érintetlen**. A hajó `speedKmPerSecond` csak megjelenített katalógus-flavor. (A tényleges sebesség-integráció a jövőbeli bekötési fázisban, a CLAUDE.md figyelmeztetését betartva történik.)
- **Preview vs. háttérzene:** a belehallgatás és a `useAudio` háttérzene **ne szóljon egyszerre** — `isPreviewing` flag alapján az `App` szünetelteti a háttérzenét, preview leállásakor visszaáll.
- **Fájl-átnevezés:** a `public/music` átnevezés után **minden** hivatkozásnak (preview, aktív zene URL) az új, kisbetűs `_`-es névre kell mutatnia; a régi nevekre nincs több hivatkozás. A `base href` (`/realtime_space_travel/`) miatt az URL `${BASE_URL}music/<fájl>.mp3`.
- **Persist-kulcs:** `space-travel-shop` — nem ütközhet a `space-travel-game/ui/lang` (és a tervezett Firebase-cache) kulcsokkal.
- **Adatméret:** a 100 exobolygó statikus importja elhanyagolható a bundle-ben; a rács **virtualizáció nélkül** is elbírja, de nagy lista esetén érdemes lazy/paginált renderre figyelni (első körben egyszerű görgetés + keresőszűrés elég).
- **Determinisztikus ár:** az ár-/wage-képlet tiszta függvény — a [[004-ingame-shop-strapi-stripe]] Strapi-seed ugyanezt reprodukálja, hogy ne ugorjanak az árak a backend bekötésekor.
- **Debug-kredit:** a `DEBUG_STARTING_CREDITS` (9000 ⭐) csak `VITE_DEBUG_MODE=true` esetén az induló egyenleg. Normál módban **0 ⭐** — első látogatáskor a bolt üres egyenleggel vár. A felhasználónak a Kredit vásárlás fülön kell induló kreditet vennie.
- **Migráció Firebase-re:** a `useShopStore` API-ja (isOwned/checkout/credits/owned/buyCredits) úgy tervezendő, hogy a [[003-firebase-auth-settings]] a **forrást** cserélje (localStorage → RTDB), ne az UI-t. A kredit-levonás és -jóváírás akkor Cloud Functionre vált.
- **Anti-cheat:** ebben a fázisban a kredit/birtoklás **kliensoldali** (localStorage) → hamisítható. Ez **tudatos, ideiglenes** kompromisszum; a mérvadó, szerver-írt forrást a [[003-firebase-auth-settings]] + [[004-ingame-shop-strapi-stripe]] hozza. A bolt-UI nem feltételezhet szerveroldali igazságot itt.
- **Kreditcsomag árazás:** a 4 csomag aránya tudatosan nem lineáris (10€→100⭐ = 10⭐/€, 100€→2000⭐ = 20⭐/€) — ösztönzi a nagyobb csomag vásárlását. Ez a mock adatban is így marad, a Strapi ugyanezeket az árakat használja majd.

---

## 9. Kapcsolat a következő fázisokkal

- **🔜 Birtokolt tartalmak játékmenetbe kötése (későbbi, külön fázis)** — ez a fázis **csak a birtoklást** menti; a tényleges bekötés **jövőbeli lépés**:
  - **Űrhajók** → hajóválasztó / küldetésindítás: az aktív hajó `speedKmPerSecond`-je felülírja a `SHIP_SPEED_KM_PER_SECOND`-t a `travelYears`/`Dashboard`/`MissionSelector` számításban (a CLAUDE.md figyelmeztetését betartva). Ez összefügg a [[003-firebase-auth-settings]] `shipSelect` fázisával.
  - **Zenék** → a Beállítások zene-lejátszója: a birtokolt sáv aktiválása → a `useAudio` háttérzene-URL cseréje (az alap `main_theme.mp3` helyett).
  - **Exobolygók** → küldetésválasztó: a birtokolt bolygók megjelennek a `MissionSelector`-ban választható úticélként (`baseDestinations` + birtokolt bolygók), a `wage`/`distanceLy` mezőkkel.
  - Az adatmodell ezt **előkészíti** (a mezők már megvannak), de a bekötő kód (`activeShipId`/`activeMusicId`, `MissionSelector`/`Dashboard`/`useAudio`/`SettingsScreen` módosítás) **nem** ebben a fázisban készül.
- **[[003-firebase-auth-settings]]** — a helyi `credits` + `owned` **per-felhasználós Firebase-mentése** (RTDB `wallet`/`inventory`); a `checkout` kredit-levonása → `purchaseWithCredits` Cloud Function; a localStorage offline tükörré válik. A fenti játékmenet-bekötés (aktív hajó/zene) itt/ezután kap Firebase-forrást (`settings`).
- **[[004-ingame-shop-strapi-stripe]]** — a **mock kreditcsomag-vásárlást Stripe-ra** cseréli (Strapi webhook → Firebase kredit hozzáadás). A **mock katalógus és kosár** (termékekre) **megmarad** (a Strapi csak a fizetési utat kezeli). A `ShopScreen`/`ProductCard`/`CartView`/`CreditShopView` UI **megmarad**; a `CreditShopView` „Megveszem" gombja valós Stripe fizetésre vált (Strapi Checkout Session → webhook → Firebase `wallet.credits` növelés). A termék-katalógus (hajók, zenék, exobolygók) továbbra is mock marad — a Strapi **nem** a termék-katalógust, hanem **kizárólag a kreditfeltöltést** végzi.
- **[[000-i18n-nyelvesites]]** — a `shop.*` kulcsok a meglévő nyelvi rétegbe illeszkednek; a tulajdonnevek (bolygó/csillag/hajó) nem fordítandók.
- **[[001-main-menu-settings]]** — a „Áruház" gomb (eddig placeholder) most valódi `shop` fázisra visz; a `GamePhase`/`ScreenRouter`/`phaseToFlags` mintát innen örökli. (A `SettingsScreen` zeneválasztó-bővítése a jövőbeli bekötési fázis.)

---

## 10. Becsült ráfordítás (nagyságrend)

| Rész | Nagyságrend |
|------|-------------|
| Adat + állapot (`useShopStore`, `CREDIT_PACKS`, `shopData.ts`, exoplanets import, típusok) | ~1 nap |
| Bolt-UI (ShopScreen + fülek + kártyák + kosár + checkout + preview + **CreditShopView + CreditSuccess**) | ~2–3 nap |
| Bekötés a játékba (hajó-sebesség, zeneválasztó, exobolygó-küldetések, fájl-átnevezés) | ~1–2 nap |
| i18n kulcsok (5 nyelv) + Vitest + validáció | ~1 nap |

**Kész definíció:** a Főmenü „Áruház" gombja a `shop` fázisra visz; a játékos **4 fül** között választhat: (1) Exobolygók, (2) Űrhajók, (3) Zenék, (4) **Kredit vásárlás**. A termékfülekben 100 exobolygó keresővel, 3 űrhajó, 5 zene böngészhető; egyenként 1 db kosárba tehető, majd in-game kreditből fizethető. A **Kredit vásárlás** fülön 4 kreditcsomag (10€→100⭐, 25€→300⭐, 50€→700⭐, 100€→2000⭐) vehető mock fizetéssel — a kredit azonnal jóváíródik. **Normál induló egyenleg: 0 ⭐**. Debug módban 9000 ⭐. A mock checkout levonja a kreditet, birtokoltra állítja a tételeket és üríti a kosarat. Minden birtoklás és a kredit-egyenleg `localStorage`-ban (`space-travel-shop`) perzisztál. A `SHIP_SPEED_KM_PER_SECOND` konstans változatlan.

---

## 11. Kapcsolódó tervek
- [[001-main-menu-settings]] – az „Áruház" gomb, a `GamePhase`/`ScreenRouter`/`phaseToFlags` minta, a `SettingsScreen`.
- [[003-firebase-auth-settings]] – a kredit/birtoklás/beállítás per-felhasználós Firebase-mentése; közös hajó-sebesség és zeneválasztó integráció.
- [[004-ingame-shop-strapi-stripe]] – a mock katalógus → Strapi, a mock checkout → Stripe; erre a frontend-fázisra épül.
- [[000-i18n-nyelvesites]] – a `shop.*` nyelvi réteg; a tulajdonnevek nem fordítandók.
