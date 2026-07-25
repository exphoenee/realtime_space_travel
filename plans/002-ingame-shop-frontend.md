---
title: "Helyi működésű áruház (frontend-only) terve – mock katalógus + localStorage"
slug: 002-ingame-shop-frontend
type: plan
category: shop
status: implemented
implemented: true
implemented_at: "2026-07-25"
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

**Cél:** a Főmenü „Áruház" gombja mögé egy **teljesen kliensoldali** (backend nélküli) webshop, ahol a játékos **kreditcsomagokat** (valós pénz → in-game kredit), valamint **exobolygókat**, **űrhajókat** és **zenéket** vásárolhat **in-game kreditből**. A katalógus **mock-adat**, a kredit-egyenleg és a birtoklás **localStorage-ban** perzisztál (Zustand `persist`).

> ### 🔗 Fázis-sorrend (fontos)
> Ez a fázis a Firebase ([[003-firebase-auth-settings]]) és a Strapi+Stripe ([[004-ingame-shop-strapi-stripe]]) bekötése **ELŐTT** valósult meg, **tisztán helyi** mock-adattal és localStorage-perzisztenciával. A későbbi fázisok **erre a frontendre épülnek**:
> - **[[003-firebase-auth-settings]]** — a helyi kredit + birtoklás + beállítások **per-felhasználós Firebase-mentése** (a localStorage csak offline tükör lesz). **A kredit-egyenleg forrása a Firebase RTDB lesz.**
> - **[[004-ingame-shop-strapi-stripe]]** — a **mock kreditcsomag-vásárlást Stripe-ra** cseréli (Strapi hook-kal); a mock katalógus és kosár (termékekre) **megmarad**; a bolt-UI és a bekötési pontok megmaradnak.
>
> Vagyis ez a terv **egyszer** megépíti a bolt-UI-t, az adatmodellt és a tulajdon-perzisztenciát; a következő két fázis csak az adat- és fizetési **forrást** cseréli le mögötte. A **birtokolt tartalmak játékmenetbe kötése** (hajó-sebesség, zene-lejátszó, exobolygó-küldetés) — lásd a 9. szekciót.

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
| Fizetés hatása (termék) | Kredit levonása, tételek **birtokoltra** állítása (localStorage), kosár ürítése, „sikeres vásárlás" képernyő |
| Fizetés hatása (kredit) | Kredit **hozzáadása** az egyenleghez (nincs levonás, nincs birtoklás). Mock „sikeres fizetés" → egyenleg frissül. |
| Kosárban lévő tétel gombja | **„Eltávolítás"** (piros gomb) — a tétel eltávolítása a kosárból (korábban „Kosárban ✓" zöld gomb) |
| Kredithiány (termék) | „Fizetés" letiltva + figyelmeztetés; birtokolt tétel „Birtokolt" jelzéssel, nem tehető kosárba |
| Perzisztencia | **`useShopStore`** (Zustand `persist`), kulcs: **`space-travel-shop`** (nem ütközik: `space-travel-game/ui/lang`) |
| Kredit forrása | Ebben a fázisban `localStorage`. A [[003-firebase-auth-settings]] után a **Firebase RTDB a mérvadó** (a store csak offline tükör). |
| Exobolygó adat helye | `src/data/exoplanets.json` (a `output/exoplanets.json` generátor-kimenet másolata) — Vite JSON-import `src/`-ből; mapper alakítja tétellé + procedurális ár |
| Katalógus (hajó+zene) helye | `src/constants/shopCatalog.ts` — kézzel írt statikus katalógus (a `universeData.ts` mintájára) |
| Exobolygók | Mind a **100** a `src/data/exoplanets.json`-ból; görgethető rács + **keresőmező**; **procedurális, determinisztikus ár** |
| Alap exobolygók (előre birtokolt) | **3 bolygó** (Proxima Centauri, Wolf 424, Ross 780) — a `BASE_EXOPLANETS` tömbben, `priceCredits: 0`, a shopban „Birtokolt" státusszal jelennek meg, a küldetésválasztóban is láthatók |
| Űrhajók | **3 mock hajó** eltérő sebességgel — csak katalógus-adat (sebesség flavor); az alap hajó `SHIP_SPEED_KM_PER_SECOND = 191` **alapként elérhető** |
| Zenék | A meglévő **5** fájl `public/music`-ból, **kisbetűsre + `_`-re átnevezve**; boltban **belehallgatás** (preview) |
| Háttérzene a boltban | **NEM szól** a háttérzene (`shouldPlayMusic` kizárja a `"shop"` fázist) |
| Zenei előnézet | Egyszerre **csak 1 előnézet** szólhat (modul-szintű `globalStopPreview` singleton + store-beli `activePreviewId` követés) |
| Generikus komponensek | `Modal` és `Tabs` kiszervezve `src/components/ui/`-be, újrahasznosítható, shop ezeket használja |
| Grid scroll | Csak a `.productGrid` container scrollázik — a fülek + kereső fixek maradnak (flex scroll chain) |
| Keresés | **Minden** termék tabon (exobolygók, űrhajók, zenék) — név szerinti szűrés |
| Kredit vásárlás layout | Azonos layout mint a többi tab: `productGrid` + `productCard` osztályok, arany border módosítóval |
| Info gomb (küldetésválasztó) | `ℹ` gomb minden küldetéskártyán → `MissionExoplanetModal` (JSON bolygóknál teljes adat, alap bolygóknál név+táv+jutalom) |
| Ship Select (küldetés után) | Küldetésválasztás után **ShipSelectScreen** (új `shipSelect` GamePhase): alap hajó (191 km/s) + birtokolt hajók a shopból listázva. Minden hajókártyán `ℹ Info` gomb → `ShipInfoModal` (műszaki adatok: sebesség, gyártó, kapacitás, hatótáv). Hajó kiválasztásakor az utazási idő újraszámolva: `travelYears = baseTravelYears / (shipSpeed / 191)`. Kamera ellenőrzés a destination kiválasztás után, de a `startMission` előtt történik (a shipSelect fázis előtt). |
| Debug reset gomb | `↺ Reset` gomb az áruház fejlécében (csak `VITE_DEBUG_MODE=true`); kitörli a birtoklást és visszaállítja a 9000 kreditet, a localStorage-ból is törli a persist adatot |
| Zeneválasztó (Settings) | A Beállítások menüben **zeneválasztó** (custom `<select>` dropdown): alap `main_theme` + birtokolt zeneszámok. **Letiltva** (`opacity`, `cursor: not-allowed`) ha nincs megvett zene. A kiválasztott track URL-je a `useAudio`-ba kerül, a `useAudio` dinamikusan váltja a lejátszott audio fájlt |

---

## ✅ Haladás (TODO)

> Jelölés: `[ ]` hátravan · `[~]` folyamatban · `[x]` kész.

**A rész — adat + állapot**
- [x] `output/exoplanets.json` bemásolása `src/data/exoplanets.json`-ba (100 elem, Vite JSON-import) + típus (`ExoplanetRaw`)
- [x] `src/constants/shopCatalog.ts`: `CREDITS_PER_EUR`, `CREDIT_PACKS` (4 csomag), `STARTING_CREDITS` (0), `DEBUG_STARTING_CREDITS` (9000), `SHOP_SHIPS` (3 mock hajó), `SHOP_MUSIC` (5 sáv), ár-/wage-képletek, `mapExoplanet`
- [x] `BASE_EXOPLANETS` + `BASE_EXOPLANET_IDS`: 3 alap exobolygó (Proxima Centauri, Wolf 424, Ross 780) előre birtokoltként
- [x] Termék-típusok a `src/types/index.ts`-be (`ShopCategory` bővítve `"credits"`-szel, `CreditPack`, `ShopProduct`, `ShipProduct`, `MusicProduct`, `ExoplanetProduct`, `CartItem`, `OwnedItems`)
- [x] `useShopStore` (Zustand + persist `space-travel-shop`): `credits` (kezdő: 0 normál / 9000 debug), `owned` (alap exobolygók előre betöltve), `cart`, `isPreviewing`, `activePreviewId` + akciók (`addToCart`, `removeFromCart`, `checkout`, `isOwned`, `buyCredits`, `setActivePreviewId`)
- [x] **Debug-kredit:** a kezdő egyenleg `VITE_DEBUG_MODE=true` esetén `DEBUG_STARTING_CREDITS` (9000 ⭐), különben `STARTING_CREDITS` (**0 ⭐**) — a `useShopStore` inicializálásában

**B rész — bolt-UI + navigáció**
- [x] `GamePhase: "shop"` a `types/index.ts`-be + `phaseToFlags` (pre-game, szüneteltetett — mint `mainMenu`/`settings`) + `App.isPreGame`
- [x] `ScreenRouter` új ág: `shop → ShopScreen`
- [x] `MainMenu` „Áruház" gomb: `mainMenu.shopComingSoon` placeholder helyett `transitionTo("shop")`
- [x] `ShopScreen` (fejléc: cím, kredit-egyenleg, kosár-ikon+tételszám, „← Vissza"; belső nézet-váltó: böngészés/kosár/siker/kreditvásárlás)
- [x] `ShopTabs` generikus `Tabs` komponenssel (Exobolygók / Űrhajók / Zenék / **Kredit vásárlás**)
- [x] `ProductGrid` + `ProductCard` (kép/név/ár ⭐ (€), „Kosárba" / „Birtokolt" / „Eltávolítás")
- [x] Kereső mező **minden** termék tabon (exobolygók, űrhajók, zenék)
- [x] Exobolygó preview modal (`ExoplanetPreviewModal`) — képek, csillag info, bolygó info, felfedezés, linkek
- [x] Űrhajó preview modal (`ShipPreviewModal`) — specifikációk (sebesség, gyártó, kapacitás, hatótáv), leírás
- [x] Alap exobolygók (3 db) a shop ProductGrid-ben lapos elemként, „Birtokolt" státusszal
- [x] Zenék átnevezése kisbetűsre `_`-rel a `public/music`-ban + a `shopCatalog.ts` metaadat az új nevekre mutat
- [x] `MusicPreviewButton` (play/pause) — singleton `globalStopPreview`, store `activePreviewId` követés, **egyszerre csak 1 előnézet**
- [x] Háttérzene szüneteltetése a shopban (`shouldPlayMusic` kizárja a `"shop"` fázist)
- [x] `CartView` (tétel-lista, „Eltávolítás" piros gomb, végösszeg ⭐+€, „Fizetés" gomb, kredithiány-állapot)
- [x] `CheckoutSuccess` (mock siker; kredit-levonás + birtoklás + kosár-ürítés a store-ban)
- [x] `CreditShopView` — **azonos layout** mint a termék tabok (`productGrid` + `productCard`), arany border módosító, középre igazított tartalom
- [x] `CreditSuccess` — mock „sikeres kreditvásárlás" képernyő
- [x] **Dupla ⭐ javítás:** `CreditBalance`-ben eltávolítva a hardcodeolt ⭐ (a fordítási kulcs már tartalmazza)
- [x] **Kártya magasság javítás:** `grid-auto-rows: min-content` + `align-items: start` a `.productGrid`-ben
- [x] **Kredit kártya magasság javítás:** `justify-content: center`, `gap: 0.75rem`, `margin-top: 0` override a `.productCardActions`-on
- [x] **Scroll javítás:** flex scroll chain — csak a `.productGrid` scrollázik, fülek + kereső fixek
- [x] **Generikus komponensek kiszervezése:** `Modal` + `Tabs` → `src/components/ui/`, shop ezeket használja
- [x] **`project-conventions.md` frissítése** az új mappastruktúrával (`ui/`, `screens/`, `shop/`)

**C rész — játékmenet-bekötés (részben megvalósítva)**
- [x] **Birtokolt exobolygók a küldetésválasztóban:** `MissionSelector` most olvassa a `useShopStore.owned.exoplanets`-et, és a JSON adatokból `mapExoplanet`-tel képzett célokat jeleníti meg az alap 3 mellett
- [x] **Info gomb a küldetéskártyákon:** `ℹ` gomb → `MissionExoplanetModal` (JSON bolygóknál teljes adat képekkel/linkekkel, alap bolygóknál név+táv+jutalom)
- [x] **Debug reset gomb** — `↺ Reset` az áruház fejlécében (csak debug módban); `resetShop` akció + localStorage törlés + persist újramentés
- [x] **Info gomb pozíció javítás** — a kártya tetejéről (ahol rálógott a névre) a kártya aljára, teljes szélességű sávként
- [x] **Zenék bekötése (SettingsScreen)** — `useUIStore.activeMusicId` perszisztált állapot; `useAudio(activeMusicId)` paraméterrel dinamikus track-váltás; SettingsScreen-ben custom `<select>` dropdown (alap + birtokolt zenék), letiltva ha nincs megvett zene
- [x] **Settings zeneválasztó custom select dropdown** — `appearance:none` stílusos dark `<select>` (segmented gombsor helyett, ami 4+ gombbal lelógott a panelről). `__default__` sentinel érték a null kezelésére
- [x] **i18n settings.musicTrack + settings.musicDefault kulcsok** — mind az 5 nyelvhez hozzáadva (hu: Zeneválasztás/Alapértelmezett, en: Music Selection/Default, stb.)
- [x] **Exobolygó kép renderelés javítás** — `extractImageUrl()` helper (kezeli a JSON nested `{url, type, source}` objektumokat), `onError` handler 🌌 fallback placeholder. A links mező string URL-eket tartalmaz, nem objektumokat, így ott nincs hiba.
- [x] **Python scraper dokumentálva** — a `exoplanets.py` NASA Images API + Wikimedia Commons hívásokkal próbál képeket keresni, de 0/100 találat (nincs artista koncepciórajz a 100 legközelebbi exobolygóra). ESA linkek is csak keresőoldalak, nem közvetlen képek.
- [x] **MP3 fájlok átnevezése** — `public/music/*.mp3` fájlok kisbetűsre + `_`-re átnevezve (pl. `Dust on the Highway.mp3` → `dust_on_the_highway.mp3`), a kód hivatkozásai már az új nevekre mutattak
- [x] **Űrhajók bekötése (ShipSelectScreen)** — `shipSelect` GamePhase: alap hajó (191 km/s) + birtokolt shop hajók listája. `ShipSelectScreen` (grid layout, hajókártyák info gombbal + indítás gombbal). `ShipInfoModal` (read-only műszaki adatok: sebesség, gyártó, kapacitás, hatótáv). Hajó kiválasztásakor `travelYears` újraszámolva: gyorsabb hajó = rövidebb utazási idő.
- [x] **i18n shipSelect kulcsok** — mind az 5 nyelvhez: `shipSelect.title`, `.subtitle`, `.default`, `.info`, `.launch`, `.launchWith`, `.defaultDesc`
- [x] **Kamera ellenőrzés flow** — MissionSelector `onSelectDestination` prop → App.tsx `handleSelectDestination` (kamera check) → `selectDestinationForShip` → `shipSelect` fázis → hajó választás → `startMission` → `loading` |  

**D rész — i18n + validáció**
- [x] i18n `shop.*` kulcsok mind az 5 nyelven (kreditvásárlás kulcsokkal együtt)
- [x] Ellenőrzés: `tsc`, `build` — tiszta
- [ ] Vitest: `useShopStore` (kosár, checkout, kredithiány, birtoklás, `buyCredits`), ár-/wage-képlet determinizmus, debug-kredit inicializálás (TODO, a tesztek még hiányoznak)

---

## 1. Képernyő-folyamat (GamePhase)

Új fázis a `src/types/index.ts` `GamePhase`-be: **`shop`**. A bolton belüli al-nézetek (böngészés / kosár / sikeres fizetés) **nem** külön `GamePhase`-ek, hanem a `ShopScreen` belső nézet-állapota (`useState`).

```
mainMenu ──(Áruház)────▶ shop
   ▲                      │  ├─ view: "browse"    (fülek: Exobolygók / Űrhajók / Zenék / Kredit vásárlás)
   │                      │  │   └─ minden fülön keresőmező (exobolygók, űrhajók, zenék)
   │                      │  │   └─ "Kredit vásárlás" fül → CreditShopView (azonos layout)
   │                      │  ├─ view: "cart"      (kosár tételek + "Eltávolítás" + végösszeg + Fizetés)
   │                      │  ├─ view: "success"   (mock sikeres termék-fizetés)
   └──(← Vissza)──────────┘  └─ view: "creditSuccess" (mock sikeres kreditvásárlás)

MissionSelector ──(ℹ Info)──▶ MissionExoplanetModal (read-only exobolygó adatok)

MissionSelector ──(cél kiválasztás)──▶ kamera ellenőrzés ──▶ shipSelect
   ▲                                                              │
   │                                              ┌─ Alap hajó (mindig)
   │              ┌─ ShipInfoModal (ℹ) ──┐        ├─ Birtokolt hajó #1
   │              │                      │        ├─ Birtokolt hajó #2
   │              ▼                      ▼        └─ ...
   │         shipCard ──(Indítás)──▶ startMission
   │                                    │
   └────────────────────────────────────┘
                                       └──▶ loading → playing
```

- `phaseToFlags("shop")` = **ugyanaz a szüneteltetett pre-game állapot**, mint `mainMenu`/`missionSelect`/`settings` (`showIntro:false, isPaused:true, …`).
- `App.isPreGame` bővül a `shop` fázissal. A háttérzene **NEM szól** a shopban (`shouldPlayMusic` kizárja).
- „← Vissza" a boltból → `transitionTo("mainMenu")`.

---

## 2. Komponensek (mind + `.module.css`)

```
src/
  components/
    ui/                                           # Generikus, újrahasznosítható komponensek
      Modal.tsx                                   # Modál: overlay, header (cím+bezárás), body (scroll), footer; Escape
      Modal.module.css
      Tabs.tsx                                    # Tab komponens: TabDefinition[], activeKey, onChange
      Tabs.module.css
    shop/                                         # Shop-specifikus komponensek
      ShopScreen.tsx                              # Fő nézet: fejléc + fülek/kosár/siker/kredit váltó
      ShopScreen.module.css
      ShopTabs.tsx                                # Kategória-fülek (generikus Tabs-ra építve)
      ProductGrid.tsx                             # Görgethető rács (keresőmező MINDEN tabon) + exobolygó + hajó preview modal
      ProductCard.tsx                             # Egy termék: kép/név/ár + gomb (Kosárba / Birtokolt / Eltávolítás)
      ExoplanetPreviewModal.tsx                   # Exobolygó preview (képek, csillag, bolygó, felfedezés, linkek)
      ShipPreviewModal.tsx                        # Űrhajó preview (specifikációk)
      CartButton.tsx                              # Fejléc kosár-ikon + tételszám badge
      CartView.tsx                                # Kosár: tétel-lista + "Eltávolítás" + végösszeg + Fizetés
      CheckoutSuccess.tsx                         # Mock „sikeres fizetés" képernyő
      MusicPreviewButton.tsx                      # Play/pause belehallgatás (singleton, 1 előnézet egyszerre)
      CreditBalance.tsx                           # Kredit-egyenleg kijelző (⭐ N)
      CreditShopView.tsx                          # Kreditcsomagok (productGrid + productCard layout)
      CreditSuccess.tsx                           # Mock „sikeres kreditvásárlás" képernyő
    screens/                                      # Képernyő-szintű komponensek
      MissionSelector.tsx                         # Küldetésválasztó (info gombbal + exobolygó modal)
      MissionSelector.module.css                  # (info gomb, info modal, missionCard wrapper)
      MissionExoplanetModal.tsx                   # Read-only exobolygó info modal (küldetésválasztóhoz)
      ShipSelectScreen.tsx                        # Hajókiválasztó (alap hajó + birtokolt hajók)
      ShipSelectScreen.module.css                 # (shipCard, info modal, grid layout)
      ShipInfoModal.tsx                           # Read-only hajó info modal (küldetésválasztó stílusban)
```

### `ShopScreen.tsx`
- **Fejléc:** cím (`shop.title`), `CreditBalance` (⭐ egyenleg), `CartButton` (tételszám badge), „← Vissza" gomb → `mainMenu`.
- **Törzs:** a belső `view` szerint:
  - `"browse"` → `ShopTabs` + `ProductGrid` (termék fülek) **vagy** `CreditShopView` („Kredit vásárlás" fül)
  - `"cart"` → `CartView`
  - `"success"` → `CheckoutSuccess`
  - `"creditSuccess"` → kreditvásárlás siker képernyő

### `ProductGrid.tsx`
- **Keresőmező:** MINDEN termék tabon (exobolygók, űrhajók, zenék) — név szerinti szűrés. A kredit tabon nincs kereső.
- **Exobolygók:** 100 JSON-ból + 3 alap bolygó (`BASE_EXOPLANETS`) lapos elemként
- **Scroll chain:** `.productGridWrapper` (flex column) → kereső (flex-shrink: 0) → `.productGrid` (flex:1, overflow-y:auto)
- **Preview modal-ok:** `ExoplanetPreviewModal` (JSON bolygók) + `ShipPreviewModal` (hajók). Alap bolygóknak nincs preview.

### `ProductCard.tsx`
- Kép/ikon, név, leírás/meta, ár **⭐ `priceCredits`** és zárójelben **`(€ priceEur)`**.
- Gomb-állapotok: **„Kosárba"** (alap) · **„Eltávolítás"** (piros gomb, ha már kosárban) · **„Birtokolt"** (letiltva, ha `isOwned`).
- Zenekártyán ezen felül `MusicPreviewButton`.

### `CartView.tsx`
- Tétel-lista (kép/név/ár, **„Eltávolítás"** piros gomb).
- **Végösszeg:** ⭐ összeg + `(€ összeg)`.
- **„Fizetés"** gomb → `useShopStore.checkout()` → `view: "success"`.
- **Kredithiány:** ha `cartTotalCredits > credits` → a „Fizetés" letiltva + figyelmeztetés.

### `CreditShopView.tsx`
- A **4. fül** tartalma („Kredit vásárlás").
- **Azonos layout** mint a termék tabok: `styles.productGrid` + `styles.productCard` (+ `.creditCard` módosító arany border).
- 4 kreditcsomag kártyákon, középre igazított tartalom, „Megveszem" gomb `width: 100%`.
- **„Megveszem"** gomb → `useShopStore.buyCredits(packId)` → mock fizetés:
  1. Kredit hozzáadása az egyenleghez (`credits += pack.credits`)
  2. `view: "creditSuccess"`

### `MusicPreviewButton.tsx`
- Saját `HTMLAudioElement` a `${BASE_URL}music/<fájl>.mp3` sávra.
- **Egyszerre csak 1 előnézet:** modul-szintű `globalStopPreview` singleton + store-beli `activePreviewId` követés.
- Ha másik gombra kattintasz, az előző előnézet leáll.
- **Háttérzene:** a shopban NEM szól (`shouldPlayMusic` kizárja a `"shop"` fázist).

### `MissionExoplanetModal.tsx` (új)
- Read-only exobolygó info modal (nincs kosár/vásárlás akció).
- **JSON exobolygók:** teljes adat (képek, koordináták, csillag info, bolygó info, felfedezés, linkek).
- **Alap bolygók** (Proxima Centauri, Wolf 424, Ross 780): név, távolság, jutalom (kevesebb adat).

---

## 3. Állapot (`useShopStore`)

Új Zustand store `persist`-tel, **`space-travel-shop`** kulccsal.

```ts
interface OwnedItems {
  ships: string[];        // birtokolt hajó-id-k
  music: string[];        // birtokolt zene-id-k
  exoplanets: string[];   // birtokolt exobolygó-id-k (induláskor BASE_EXOPLANET_IDS-el töltve)
}

interface CartItem {
  id: string;
  category: ShopCategory; // "exoplanet" | "ship" | "music"
  priceCredits: number;
}

interface CreditPack {
  id: string;
  nameKey: string;
  priceEur: number;
  credits: number;
}

interface ShopState {
  credits: number;
  owned: OwnedItems;
  cart: CartItem[];
  isPreviewing: boolean;        // belehallgatás fut-e
  activePreviewId: string | null;  // melyik zene játszik (globális követéshez)

  isOwned: (category: ShopCategory, id: string) => boolean;
  isInCart: (id: string) => boolean;
  addToCart: (item: CartItem) => void;
  removeFromCart: (id: string) => void;
  cartTotalCredits: () => number;
  checkout: () => { ok: boolean };
  buyCredits: (packId: string) => void;
  setPreviewing: (v: boolean) => void;
  setActivePreviewId: (id: string | null) => void;
}
```

- **Kezdő egyenleg:** `import.meta.env.VITE_DEBUG_MODE === "true"` esetén `DEBUG_STARTING_CREDITS` (9000 ⭐), különben `STARTING_CREDITS` (**0 ⭐**).
- **Kezdő birtoklás:** `owned.exoplanets: [...BASE_EXOPLANET_IDS]` — a 3 alap exobolygó induláskor birtokolt.
- **Kosárból eltávolítás:** a `removeFromCart` eltávolítja a tételt a kosárból. A UI gombja piros „Eltávolítás".
- `checkout()`: ha `credits >= cartTotalCredits()`, kredit levonás, tételek a `owned`-ba, kosár ürítés.
- `buyCredits(packId)`: `credits += pack.credits` (mock fizetés).
- `persist.partialize`: `credits`, `owned` (`cart`, `isPreviewing`, `activePreviewId` **nem** perzisztált).
- `activePreviewId` és `setActivePreviewId`: **nem perzisztált** — munkamenet-állapot. A `MusicPreviewButton` ezt használja a globális előnézet-követéshez.

---

## 4. Adatmodell + mock adat

### 4.0 Adattárolás / fájlszerkezet

| Adat | Hely | Forma | Megjegyzés |
|------|------|-------|-----------|
| **Exobolygó nyers adat** (100) | `src/data/exoplanets.json` | JSON (Vite JSON-import) | Az `output/exoplanets.json` generátor-kimenet **másolata** |
| **Alap exobolygók** (3) | `src/constants/shopCatalog.ts` | `BASE_EXOPLANETS: ExoplanetProduct[]` | Proxima Centauri, Wolf 424, Ross 780; `priceCredits: 0` |
| **Űrhajó katalógus** (3 mock) | `src/constants/shopCatalog.ts` | Kézzel írt statikus TS | Név, ár, sebesség/kapacitás/hatótáv/gyártó flavor |
| **Zene metaadat** (5 sáv) | `src/constants/shopCatalog.ts` | Kézzel írt statikus TS | Név, ár, **fájlnév** (a `public/music/` audiofájlra mutat) |
| **Zene audiofájlok** (5) | `public/music/*.mp3` | Bináris | Kisbetűsre + `_`-re átnevezve |
| **Birtoklás + kredit-egyenleg** | `useShopStore` | Zustand + `persist` | Kulcs: `space-travel-shop` (localStorage) |
| **Konstansok / képletek** | `src/constants/shopCatalog.ts` | TS | `CREDITS_PER_EUR`, `STARTING_CREDITS`, `DEBUG_STARTING_CREDITS`, ár-/wage-képlet, `mapExoplanet` |
| **Generikus UI** | `src/components/ui/` | `Modal.tsx`, `Tabs.tsx` | Újrahasznosítható, független a feature-öktől |

### 4.1 Termék-típusok (`src/types/index.ts`)

```ts
export type ShopCategory = "exoplanet" | "ship" | "music" | "credits";

export interface ShopProductBase {
  id: string;
  category: ShopCategory;
  name: string;
  priceCredits: number;
  priceEur: number;
}

export interface CreditPack {
  id: string;
  nameKey: string;
  priceEur: number;
  credits: number;
}

export interface ShipProduct extends ShopProductBase {
  category: "ship";
  speedKmPerSecond: number;
  manufacturer: string;
  capacity: number;
  rangeLy: number;
  descriptionKey: string;
}

export interface MusicProduct extends ShopProductBase {
  category: "music";
  file: string;
  title: string;
}

export interface ExoplanetProduct extends ShopProductBase {
  category: "exoplanet";
  distanceLy: number;
  wage: number;
  starName: string;
  temperatureK: number | null;
  massEarth: number | null;
}
```

### 4.2 A 3 alap exobolygó (`BASE_EXOPLANETS`)

A játékos induláskor birtokolja őket. A shopban „Birtokolt" státusszal jelennek meg, nem vásárolhatók. A küldetésválasztóban az alap 3 célállomásként jelennek meg.

| id | Név | Távolság (ly) | Jutalom (⭐) | Ár |
|----|-----|--------------|-------------|-----|
| `exo-proxima-centauri` | Proxima Centauri | 4.24 | 50 | 0 (birtokolt) |
| `exo-wolf-424` | Wolf 424 | 14.31 | 250 | 0 (birtokolt) |
| `exo-ross-780` | Ross 780 | 15.34 | 1000 | 0 (birtokolt) |

---

## 5. A vásárlás hatása — birtoklás + exobolygók bekötése

A `checkout` ebben a fázisban:
1. levonja a kreditet (`useShopStore.credits`),
2. a megvett tételt a `useShopStore.owned` megfelelő listájába teszi — localStorage-ban perzisztálva,
3. üríti a kosarat, és megjeleníti a „sikeres vásárlás" képernyőt.

**Exobolygók → küldetésválasztó (MEGVALÓSÍTVA):** a `MissionSelector` most beolvassa a `useShopStore.owned.exoplanets`-et, és a birtokolt JSON exobolygókat (`mapExoplanet` + `exoplanetsData`) megjeleníti az alap 3 mellett. Minden küldetéskártyán van egy `ℹ` info gomb, ami a `MissionExoplanetModal`-ban mutatja a bolygó adatait (képek, csillag info, bolygó info, felfedezés, linkek). A JSON `images` mezői nested objektumok `{url, type, source}` formátumban — az `extractImageUrl()` helper kezeli ezt, `onError` fallback 🌌 placeholderekkel.

**Python scraper dokumentálva:** a NASA Images API + Wikimedia Commons hívások 0/100 találatot adtak a 100 legközelebbi exobolygóra. ESA linkek is keresőoldalak, nem közvetlen képfájlok.

**MEGVALÓSÍTVA:**
- **Zenék bekötése a SettingsScreen-be:** `useUIStore.activeMusicId` (perszisztált állapot) tárolja a kiválasztott zenét (`null` = `main_theme.mp3`, különben a shopban vett zeneszám ID-ja). A `useAudio(activeMusicId)` paramétere dinamikusan váltja a lejátszott audio fájlt (`getTrackUrl` helper → `SHOP_MUSIC` katalógusból). A Beállítások menüben egy új sor jelenik meg a hangerőcsúszka alatt: **custom `<select>` dropdown** az alapértelmezett és a birtokolt zeneszámok között. A segmented gombsor 4+ gombbal lelógott a panelről, ezért lett select-re cserélve. Ha nincs megvásárolt zene, a dropdown **letiltva** (`opacity: 0.4`, `cursor: not-allowed`).
- **i18n kulcsok:** `settings.musicTrack` („Zeneválasztás") és `settings.musicDefault` („Alapértelmezett") — mind az 5 nyelvre.
- **MP3 fájlok átnevezése:** `public/music/*.mp3` fájlok kisbetűsre + `_`-re (pl. `Dust on the Highway.mp3` → `dust_on_the_highway.mp3`).

**NINCS még megvalósítva:**
- Űrhajók bekötése (hajóválasztó / sebesség módosítás)

---

## 6. i18n kulcslista (`shop.*`)

Mind az 5 nyelven (hu, en, fr, de, es). A tényleges fordítások a `src/i18n/locales/{en,hu,fr,de,es}/translation.json`-ben.

```
shop.title                    # „Áruház"
shop.back                     # „← Vissza"
shop.creditsLabel             # „⭐ {{count}} kredit" (string, nem ütközik a shop.credits object namespace-szel)
shop.balance                  # „Egyenleg: ⭐ {{count}}"
shop.tab.exoplanets           # „Exobolygók"
shop.tab.ships                # „Űrhajók"
shop.tab.music                # „Zenék"
shop.tab.credits              # „Kredit vásárlás"
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
shop.preview.play             # „Belehallgatás"
shop.preview.stop             # „Leállítás"
shop.ship.speedLabel          # Sebesség
shop.ship.manufacturerLabel   # Gyártó
shop.ship.capacityLabel       # Kapacitás
shop.ship.rangeLabel          # Hatótáv
shop.ship.crew                # fő
shop.ship.ly                  # fényév
shop.ship.modal.close         # Bezárás
shop.ship.modal.specs         # Specifikációk
shop.exoplanet.modal.close    # Bezárás
shop.exoplanet.modal.distance # Távolság
shop.exoplanet.modal.coordinates # Koordináták
shop.exoplanet.modal.temperature # Hőmérséklet
shop.exoplanet.modal.mass     # Tömeg
shop.exoplanet.modal.radius   # Sugár
shop.exoplanet.modal.links    # Külső linkek
shop.exoplanet.modal.section.star     # Csillag adatai
shop.exoplanet.modal.section.planet   # Bolygó adatai
shop.exoplanet.modal.section.discovery # Felfedezés

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

> **Figyelem:** a `shop.credits` kulcs **nem használható stringként**, mert object namespace (`shop.credits.title`, `shop.credits.starter`, stb.). A kredit-egyenleg kijelző a `shop.creditsLabel` kulcsot használja.

---

## 7. Érintett / új fájlok

**Új:**
- `src/components/shop/*.tsx` (ShopScreen, ShopTabs, ProductGrid, ProductCard, CartButton, CartView, CheckoutSuccess, MusicPreviewButton, CreditBalance, CreditShopView, CreditSuccess, ExoplanetPreviewModal, ShipPreviewModal)
- `src/components/ui/Modal.tsx` (+.module.css) — **generikus** modál komponens
- `src/components/ui/Tabs.tsx` (+.module.css) — **generikus** tab komponens
- `src/components/screens/MissionExoplanetModal.tsx` — read-only exobolygó info modal
- `src/state/useShopStore.ts` (+ `useShopStore.test.ts`)
- `src/constants/shopCatalog.ts` (konstansok, CREDIT_PACKS, BASE_EXOPLANETS, debug-kredit, 3 hajó, 5 zene, ár-/wage-képletek, mapExoplanet)
- `src/data/exoplanets.json` (a `output/exoplanets.json` másolata, 100 elem)

**Módosított:**
- `src/types/index.ts` — `GamePhase` (`shop`), `ShopCategory`, `ShopProduct*`, `CartItem`, `OwnedItems`
- `src/state/useGameStore.ts` — `phaseToFlags` (`shop` a pre-game `case`-hez)
- `src/App.tsx` — `isPreGame` bővítés (`shop`) + `shouldPlayMusic` kizárja a shopot
- `src/components/routing/ScreenRouter.tsx` — új `case "shop": return <ShopScreen />`
- `src/components/screens/MainMenu.tsx` — „Áruház" gomb: placeholder helyett `transitionTo("shop")`
- `src/components/screens/MissionSelector.tsx` — birtokolt exobolygók megjelenítése + info gomb
- `src/components/screens/MissionSelector.module.css` — info gomb + info modal stílusok
- `public/music/*` — 5 fájl átnevezése kisbetűsre `_`-rel
- `src/i18n/locales/{en,hu,fr,de,es}/translation.json` — `shop.*` kulcsok
- `.claude/references/project-conventions.md` — új mappastruktúra (`ui/`, `screens/`, `shop/`)

---

## 8. Kockázatok / figyelmeztetések

- **`SHIP_SPEED_KM_PER_SECOND` (CLAUDE.md):** a konstans **nem módosul** ebben a fázisban. A hajó `speedKmPerSecond` csak katalógus-flavor. A tényleges sebesség-integráció a jövőbeli bekötési fázisban történik.
- **Preview vs. háttérzene:** a shopban a háttérzene NEM szól (`shouldPlayMusic` kizárja a `"shop"` fázist). A zenei előnézet singleton `globalStopPreview`-t használ — egyszerre csak 1 előnézet.
- **Fájl-átnevezés:** a `public/music` fájlok kisbetűs `_`-es nevekre lettek átnevezve; minden hivatkozás az új névre mutat.
- **Persist-kulcs:** `space-travel-shop` — nem ütközik a `space-travel-game/ui/lang` kulcsokkal.
- **Determinisztikus ár:** az ár-/wage-képlet tiszta függvény — a Strapi-seed ugyanezt reprodukálja.
- **Debug-kredit:** `DEBUG_STARTING_CREDITS` (9000 ⭐) csak `VITE_DEBUG_MODE=true` esetén. Normál módban **0 ⭐**.
- **Anti-cheat:** a kredit/birtoklás kliensoldali (localStorage) — ez tudatos, ideiglenes kompromisszum. A Firebase-fázis hozza a szerver-írt forrást.
- **`shop.credits` kulcsütközés:** a `shop.credits` egyszerre volt string és object namespace — megoldva: a string kulcs `shop.creditsLabel`-re lett nevezve.
- **Grid scroll:** a `.productGrid` flex scroll chain segítségével csak a grid scrollázik, a fülek és kereső fixek maradnak.

---

## 9. Kapcsolat a következő fázisokkal

- **✅ Exobolygók → küldetésválasztó (MEGVALÓSÍTVA):** a birtokolt exobolygók megjelennek a `MissionSelector`-ban, info modalban (`MissionExoplanetModal`) megtekinthetők képekkel és linkekkel.
- **✅ Exobolygó kép renderelés (JAVÍTVA):** a JSON `images` mezői nested objektumok `{url, type, source}` formátumban → `extractImageUrl()` helper + `onError` 🌌 fallback. A `links` mező string URL-eket tartalmaz, ott nincs hiba.
- **✅ Python scraper dokumentálva:** a NASA Images API + Wikimedia Commons hívások 0/100 találatot adtak a 100 legközelebbi exobolygóra. ESA linkek is keresőoldalak, nem közvetlen képfájlok.
- **✅ Űrhajók bekötése (MEGVALÓSÍTVA)** — `shipSelect` GamePhase: alap hajó (191 km/s) + birtokolt shop hajók. `ShipSelectScreen` grid layout, minden hajókártyán `ℹ` info gomb → `ShipInfoModal` (műszaki adatok). Hajó kiválasztáskor az utazási idő újraszámolva: `travelYears = baseTravelYears / (shipSpeed / SHIP_SPEED_KM_PER_SECOND)`. Kamera ellenőrzés a destination kiválasztás után történik (App.tsx `handleSelectDestination`), a `startMission` előtt.
- **✅ Zenék bekötése (MEGVALÓSÍTVA)** — a Beállítások zene-lejátszója: a birtokolt sáv aktiválása → a `useAudio` háttérzene-URL cseréje. `useUIStore.activeMusicId` perszisztál, `useAudio(activeMusicId)` dinamikusan vált.
- **[[003-firebase-auth-settings]]** — a helyi `credits` + `owned` **per-felhasználós Firebase-mentése** (RTDB `wallet`/`inventory`).
- **[[004-ingame-shop-strapi-stripe]]** — a **mock kreditcsomag-vásárlást Stripe-ra** cseréli (Strapi webhook → Firebase kredit hozzáadás).
- **[[000-i18n-nyelvesites]]** — a `shop.*` kulcsok a meglévő nyelvi rétegbe illeszkednek.
- **[[001-main-menu-settings]]** — a „Áruház" gomb most valódi `shop` fázisra visz.

---

## 10. Becsült ráfordítás (nagyságrend)

| Rész | Nagyságrend |
|------|-------------|
| Adat + állapot (`useShopStore`, `CREDIT_PACKS`, `BASE_EXOPLANETS`, exoplanets import, típusok) | ✅ Kész |
| Bolt-UI (ShopScreen + fülek + kártyák + kosár + checkout + preview + CreditShopView + CreditSuccess) | ✅ Kész |
| Generikus komponensek (Modal, Tabs) | ✅ Kész |
| Játékmenet-bekötés (exobolygók a MissionSelector-ban + info modal) | ✅ Kész |
| Zenék játékmenet-bekötése (SettingsScreen zeneválasztó) | ✅ Kész |
| Űrhajók játékmenet-bekötése (ShipSelectScreen) | ✅ Kész |
| i18n kulcsok (5 nyelv) + validáció | ✅ Kész (kivéve Vitest tesztek) |

**Kész definíció elérve:** a Főmenü „Áruház" gombja a `shop` fázisra visz; a játékos **4 fül** között választhat: (1) Exobolygók + kereső, (2) Űrhajók + kereső, (3) Zenék + kereső, (4) **Kredit vásárlás** (azonos layout). 100 exobolygó (JSON) + 3 alap exobolygó (Birtokolt), 3 űrhajó preview-vel, 5 zene singleton-preview-val. Kosár „Eltávolítás" gombbal. **Normál induló egyenleg: 0 ⭐**. Debug módban 9000 ⭐, reset gombbal. Háttérzene nem szól a shopban. Csak a grid scrollázik. Birtokolt exobolygók a küldetésválasztóban, info gombbal (a kártya alján). Generikus Modal/Tabs komponensek `src/components/ui/`-ben. A Beállítások menüben **zeneválasztó** (alap + birtokolt zenék), letiltva ha nincs megvett zene. `useAudio` dinamikus track-váltással. ActiveMusicId perszisztálva `useUIStore`-ban. **Ship Select** (`shipSelect` GamePhase): küldetésválasztás után hajókiválasztás (alap hajó + birtokolt shop hajók), info modal műszaki adatokkal, sebesség alapján újraszámolt utazási idő. Kamera ellenőrzés a destination kiválasztás után történik.

---

## 11. Kapcsolódó tervek
- [[001-main-menu-settings]] – az „Áruház" gomb, a `GamePhase`/`ScreenRouter`/`phaseToFlags` minta.
- [[003-firebase-auth-settings]] – a kredit/birtoklás/beállítás per-felhasználós Firebase-mentése.
- [[004-ingame-shop-strapi-stripe]] – a mock katalógus → Strapi, a mock checkout → Stripe.
- [[000-i18n-nyelvesites]] – a `shop.*` nyelvi réteg; a tulajdonnevek nem fordítandók.
