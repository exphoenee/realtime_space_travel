---
title: "Helyi működésű áruház (frontend-only) terve – mock katalógus + localStorage"
slug: 002-ingame-shop-frontend
type: plan
category: shop
status: implemented
implemented: true
implemented_at: "2026-07-25"
created_at: "2026-07-25"
updated_at: "2026-07-29"  # frissítve: vásárlási előzmény RTDB-be, identitásváltás-takarítás, vendég-zár, shop.sort i18n (E–G rész); a vendég-tájékoztató 2026-07-29 óta toast ([[015-toast-notification]] H. blokk)
author: exphoenee
step: 2
phases: []
dependencies:
  - 001-main-menu-settings
related_plans:
  - 000-i18n-nyelvesites
  - 003-firebase-auth-settings
  - 004-firebase-auth-bugfix
  - 005-ingame-shop-strapi-stripe
  - 007-state-persist-page-refresh
  - 012-wall-of-shame
  - 013-social-multiplayer
  - 017-starfield-realism
tags:
  - shop
  - frontend
  - localstorage
  - zustand
  - mock
  - exoplanets
  - ships
  - music
  - rtdb
  - purchase-history
  - identity
  - privacy
  - guest
  - access-control
  - i18n
  - bugfix
---

# Helyi működésű áruház (frontend-only) terve – mock katalógus + localStorage

**Cél:** a Főmenü „Áruház" gombja mögé egy **teljesen kliensoldali** (backend nélküli) webshop, ahol a játékos **kreditcsomagokat** (valós pénz → in-game kredit), valamint **exobolygókat**, **űrhajókat** és **zenéket** vásárolhat **in-game kreditből**. A katalógus **mock-adat**, a kredit-egyenleg és a birtoklás **localStorage-ban** perzisztál (Zustand `persist`).

> ### 🔗 Fázis-sorrend (fontos)
> Ez a fázis a Firebase ([[003-firebase-auth-settings]]) és a Strapi+Stripe ([[005-ingame-shop-strapi-stripe]]) bekötése **ELŐTT** valósult meg, **tisztán helyi** mock-adattal és localStorage-perzisztenciával. A későbbi fázisok **erre a frontendre épülnek**:
> - **[[003-firebase-auth-settings]]** — a helyi kredit + birtoklás + beállítások **per-felhasználós Firebase-mentése** (a localStorage csak offline tükör lesz). **A kredit-egyenleg forrása a Firebase RTDB lesz.**
> - **[[005-ingame-shop-strapi-stripe]]** — a **mock kreditcsomag-vásárlást Stripe-ra** cseréli (Strapi hook-kal); a mock katalógus és kosár (termékekre) **megmarad**; a bolt-UI és a bekötési pontok megmaradnak.
>
> Vagyis ez a terv **egyszer** megépíti a bolt-UI-t, az adatmodellt és a tulajdon-perzisztenciát; a következő két fázis csak az adat- és fizetési **forrást** cseréli le mögötte. A **birtokolt tartalmak játékmenetbe kötése** (hajó-sebesség, zene-lejátszó, exobolygó-küldetés) — lásd a 9. szekciót.

## Döntések (egyeztetve)

| Kérdés | Választás |
|--------|-----------|
| Backend | **Nincs** — tisztán frontend, mock katalógus, `localStorage` perzisztencia |
| Fizetőeszköz | **In-game kredit** (⭐) — a termékeket kreditből veszed, a kreditet valós pénzért (€) veszed |
| Kreditcsomagok (€ → ⭐) | **4 csomag**: **5 € → 100 ⭐**, **10 € → 300 ⭐**, **25 € → 700 ⭐**, **100 € → 2000 ⭐** |
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
| Exobolygók | Mind a **100** a `src/data/exoplanets.json`-ból; görgethető rács + **keresőmező**; **procedurális, determinisztikus ár**; a 3 alap bolygó (`BASE_EXOPLANETS`) a lista **elején** jelenik meg |
| Alap exobolygók (előre birtokolt) | **3 bolygó** (Proxima Centauri, Wolf 424, Ross 780) — a `BASE_EXOPLANETS` tömbben, `priceCredits: 0`, a shopban „Birtokolt" státusszal jelennek meg, a küldetésválasztóban is láthatók |
| Űrhajók | **3 mock hajó** eltérő sebességgel — `priceCredits` arányos a sebességgel, a legdrágább **1000 ⭐**; a shopban **olcsó → drága** sorrendben jelennek meg (`sort` by price asc); az alap hajó `SHIP_SPEED_KM_PER_SECOND = 191` **alapként elérhető** |
| Zenék | A meglévő **5** fájl `public/music`-ból, **kisbetűsre + `_`-re átnevezve**; boltban **belehallgatás** (preview) |
| Háttérzene a boltban | **NEM szól** a háttérzene (`shouldPlayMusic` kizárja a `"shop"` fázist) |
| Zenei előnézet | Egyszerre **csak 1 előnézet** szólhat (modul-szintű `globalStopPreview` singleton + store-beli `activePreviewId` követés) |
| Generikus komponensek | `Modal` és `Tabs` kiszervezve `src/components/ui/`-be, újrahasznosítható, shop ezeket használja |
| Grid scroll | Csak a `.productGrid` container scrollázik — a fülek + kereső fixek maradnak (flex scroll chain) |
| Kosár gomb a kredit lapon | A kosár gomb `visibility: hidden`-nel láthatatlan (nem `display: none`), hogy a fejléc ne ugorjon átméretezéskor |
| Gombok túlcsordulás mentes | `.productButton`: `min-width: 0` + `overflow: hidden` + `text-overflow: ellipsis` + `white-space: nowrap` — a „Birtokolt" gomb nem lóg le a kártyáról |
| Keresés | **Minden** termék tabon (exobolygók, űrhajók, zenék) — név szerinti szűrés |
| Kredit vásárlás layout | Azonos layout mint a többi tab: `productGrid` + `productCard` osztályok, arany border módosítóval |
| Info gomb (küldetésválasztó) | `ℹ` gomb minden küldetéskártyán → `MissionExoplanetModal` (JSON bolygóknál teljes adat, alap bolygóknál név+táv+jutalom) |
| Ship Select (küldetés után) | Küldetésválasztás után **ShipSelectScreen** (új `shipSelect` GamePhase): alap hajó (191 km/s) + birtokolt hajók a shopból listázva. Minden hajókártyán `ℹ Info` gomb → `ShipInfoModal` (műszaki adatok: sebesség, gyártó, kapacitás, hatótáv). Hajó kiválasztásakor az utazási idő újraszámolva: `travelYears = baseTravelYears / (shipSpeed / 191)`. Kamera ellenőrzés a destination kiválasztás után, de a `startMission` előtt történik (a shipSelect fázis előtt). |
| Debug reset gomb | `↺ Reset` gomb az áruház fejlécében (csak `VITE_DEBUG_MODE=true`); kitörli a birtoklást és visszaállítja a 9000 kreditet, a localStorage-ból is törli a persist adatot |
| Zeneválasztó (Settings) | A Beállítások menüben **zeneválasztó** (custom `<select>` dropdown): alap `main_theme` + birtokolt zeneszámok. **Letiltva** (`opacity`, `cursor: not-allowed`) ha nincs megvett zene. A kiválasztott track URL-je a `useAudio`-ba kerül, a `useAudio` dinamikusan váltja a lejátszott audio fájlt |
| **Vásárlási előzmény tárolása** (2026-07-28, E rész) | **RTDB `users/{uid}/purchases/{pushId}`** — korábban SEMMILYEN szerveroldali párja nem volt, csak localStorage-ban élt (más gépen/böngészőben nem is látszott) |
| Miért nincs külön top-level node? | A vásárlási előzmény **privát**, nincs barát-nézete → nem kell barát-olvasási szabály, ellentétben a `walls`-szal ([[012-wall-of-shame]] O. blokk) |
| Külön RTDB subscription? | **Nem kell** — a `subscribeUser` a **teljes** `users/{uid}` node-ot olvassa, így az új ág magától érkezik az élő frissítésekkel |
| `purchaseHistory` perzisztálás | **Megszűnt** a `partialize`-ból — fiókhoz kötött adat nem élhet a böngésző-szintű localStorage-ban ([[007-state-persist-page-refresh]] G. blokk) |
| Kijelentkezéskori shop-takarítás | **Lokális-only** `setState` (`credits`, `creditsLoaded`, `owned`, `cart`, `purchaseHistory`) — **nem** `resetShop()`, mert az RTDB-be is kiírná a resetet és az elhagyott fiók walletjét rongálná |
| **Vendég hozzáférése az áruházhoz** (2026-07-28, F rész) | **Nincs.** A vásárlásoknak **túl kell élniük egy eldobható vendég-sessiont**, ezért az áruház regisztrált (Google) fiókot igényel — ugyanaz a kétrétegű minta, mint a barátoknál ([[013-social-multiplayer]] O. blokk) |
| Vendég visszajelzése | A Áruház gomb **🔒 prefixet** kap; kattintásra **nem navigál**, hanem a `shop.guestNotice` üzenetet mutatja, ugyanez a szöveg a gomb `title` tooltipjében. **2026-07-29 óta** az üzenet **warning toast** a bal felső sarokban, nem beágyazott bekezdés ([[015-toast-notification]] H. blokk) |
| Perzisztált `shop` fázis vendégnél | A `ScreenRouter` a `shop`-ot is a „regisztrált fiókot igénylő" listára teszi (`friends`, `chat`, `friendWall`, `shop`) → vendégnél vissza a főmenübe |

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
- [x] **Árak csökkentése:** legdrágább hajó 1000 ⭐ (Aether Titan), arányos árak (Nomad: 150 ⭐, Vega: 400 ⭐); zenék: 30 ⭐/db; exobolygó formula olcsóbb (`50 + dist*5 + mass*10 + temp*0.2`); wage formula arányosan csökkentve (`dist*3 + mass*2`)
- [x] **Kredit pakkok frissítése:** 5€/100kr, 10€/300kr, 25€/700kr, 100€/2000kr
- [x] **Sorrendezés a shopban:** `BASE_EXOPLANETS` a lista elején; hajók `priceCredits` szerint növekvő sorrendben
- [x] **Kosár gomb láthatatlanság:** kredit lapon `visibility: hidden` (nem `display: none`) — a fejléc nem ugrik átméretezéskor
- [x] **Gomb túlcsordulás javítás:** `.productButton`: `min-width:0`, `overflow:hidden`, `text-overflow:ellipsis`, `white-space:nowrap` — a „Birtokolt" gomb nem lóg le a kártyáról

**C rész — játékmenet-bekötés + Firebase szinkron**
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
- [x] **i18n shipSelect kulcsok** — mind az 5 nyelvhez: `shipSelect.title`, `.subtitle`, `.default`, `.info`, `.launch`, `.launchWith`, `.defaultDesc`, `.owned`
- [x] **i18n `settings.musicTrack` + `settings.musicDefault`** — mind az 5 nyelvhez
- [x] **useShopStore Firebase RTDB szinkron:** `setCredits` + `setOwned` akciók; `checkout()` / `buyCredits()` / `resetShop()` RTDB write (`updateUserWallet` + `updateUserInventory`)
- [x] **App.tsx `handleUserData`:** wallet+inventory RTDB-ből → `useShopStore` READ szinkron (JSON.stringify védelem a loop-ok ellen)
- [x] **`setCredits` + `setOwned`** akciók exportálva a `useShopStore`-ban

**D rész — i18n + validáció**
- [x] i18n `shop.*` kulcsok mind az 5 nyelven (kreditvásárlás kulcsokkal együtt)
- [x] Ellenőrzés: `tsc`, `build` — tiszta
- [ ] Vitest: `useShopStore` (kosár, checkout, kredithiány, birtoklás, `buyCredits`), ár-/wage-képlet determinizmus, debug-kredit inicializálás (TODO, a tesztek még hiányoznak)

**E rész — Vásárlási előzmény RTDB-be + identitásváltás-takarítás (2026-07-28)**

> **Kiváltó tünet:** kijelentkezés után az áruház vásárlási előzménye az **előző user** vásárlásait mutatta. Ugyanaz a hibaosztály, mint a szégyenfalnál ([[012-wall-of-shame]] R. blokk); az elvet a [[007-state-persist-page-refresh]] G. blokkja rögzíti.
>
> **Ok:** a `purchaseHistory`-nak **semmilyen szerveroldali párja nem volt** — kizárólag a `space-travel-shop` localStorage kulcson élt, amin a böngésző **minden** fiókja osztozik. Mellékhatásként más gépen/böngészőben egyáltalán nem is látszott.

- [x] **Új RTDB ág:** `users/{uid}/purchases/{pushId}` (privát — nincs barát-nézet, ezért nem kapott külön top-level node-ot)
- [x] `userData.ts` — `savePurchaseRecord(uid, record)`: `push()`; a rekord **megtartja a lokálisan generált `id`-jét**, így az RTDB-visszhang az optimista lokális bejegyzést **lecseréli**, nem duplikálja
- [x] `userData.ts` — `mapPurchases(data)`: push-ID → tömb konverzió (`record.id || pushId` normalizálás), `purchasedAt` szerint **csökkenő** rendezés
- [x] `userData.ts` — `UserNode` bővítve: `purchases?: Record<string, PurchaseRecord>`
- [x] `useShopStore` — új **modul-szintű** `persistPurchases()` helper: `getRtdbKey()` + `savePurchaseRecord` minden új rekordra
- [x] `persistPurchases()` mindhárom keletkezési ágból hívva: `checkout()`, `buyCredits()`, `recordPurchase()`
- [x] `useShopStore` — új `setPurchaseHistory(history)` action a szinkronhoz („az RTDB a mérvadó, a lokális tömb optimista nézet")
- [x] `App.tsx` `handleUserData` — `shop.setPurchaseHistory(mapPurchases(data.purchases))`
- [x] **Külön subscription NEM kellett:** a `subscribeUser` az egész `users/{uid}` node-ot olvassa, így az új ág magától jön az élő frissítésekkel
- [x] `database.rules.json` — új `users/$key/purchases` **írási** szabály, ugyanazzal a `device_map`/uid feltétellel, mint a többi ág (`auth != null && (root.child('device_map').child($key).val() == auth.uid || $key == auth.uid)`) — ⚠️ **deployt igényel**
- [x] `useShopStore.partialize` — a `purchaseHistory` **kikerült**; maradt `activeShopTab` (eszközszintű) + `boughtCreditPacks` (unlock-szintű)
- [x] `src/state/clearUserScopedData.ts` (új, [[007-state-persist-page-refresh]] G. blokk) — fiókváltáskor a shop lokális állapota is ürül: `credits`, `creditsLoaded`, `owned` → `BASE_EXOPLANET_IDS`, `cart`, `purchaseHistory`
- [x] **Szándékosan lokális-only:** nem `resetShop()` — az RTDB-be is kiírná a resetet, és az **épp elhagyott** fiók walletjét/inventoryját nullázná
- [x] Ellenőrzés: `tsc --noEmit` tiszta · `npm run test` **77/77** zöld · `npm run build` sikeres

**F rész — Áruház letiltása nem regisztrált usereknél (2026-07-28)**

> A [[013-social-multiplayer]] O. blokkjában bevezetett vendég-őr **kiterjesztése** a `shop` fázisra. **Indok:** a vásárlásoknak túl kell élniük egy eldobható vendég-sessiont — vendégként vett tartalom a session elvesztésével elveszne, valós pénzért vett kredit esetén ez elfogadhatatlan ([[020-stripe-go-live]]).
>
> ℹ️ **Frissítve (2026-07-29):** az üzenet **megjelenítése** azóta megváltozott — beágyazott bekezdés helyett **warning toast**. Kanonikus leírás: [[015-toast-notification]] H. blokk / 0.9. A `shop.guestNotice` kulcs, a 🔒 prefix, a `title` tooltip és a `ScreenRouter` `needsAccount` listája **változatlan**.

- [x] **Vendég definíció (közös):** `!authUser || authUser.isAnonymous`
- [x] `MainMenu.tsx` — az Áruház gomb **🔒 prefixet** kap vendégnél
- [x] `MainMenu.tsx` — kattintás vendégként **nem navigál**, hanem a `shop.guestNotice` üzenetet mutatja — **2026-07-29 óta** `addToast("warning", t("shop.guestNotice"), GUEST_NOTICE_DURATION_MS)` a bal felső sarokban (korábban `<p role="status">` a gombok alatt)
- [x] `MainMenu.tsx` — ugyanaz a szöveg a gomb `title` tooltipjében
- [x] **Refaktor:** a `showGuestNotice: boolean` state → `guestNoticeKey: string | null`, mert már **két** különböző üzenet van (`shop.guestNotice`, `friends.guestNotice`). ⚠️ **Elavult:** a `guestNoticeKey` state 2026-07-29-én **megszűnt** — a kulcsot a `guardedNav` közvetlenül adja át az `addToast`-nak
- [x] **Refaktor:** új `guardedNav(phase: "shop" | "friends", noticeKey: string)` helper adja a gomb `onClick`-jét — vendégnél `addToast("warning", t(noticeKey), GUEST_NOTICE_DURATION_MS)`, egyébként `transitionTo(phase)`
- [x] A korábbi `handleShop` helper **megszűnt** (a `guardedNav("shop", "shop.guestNotice")` váltotta ki)
- [x] A tájékoztató magától eltűnik (toast auto-dismiss, 7000 ms). A korábbi „bejelentkezéskor tüntesd el" `useEffect(!isGuest)` **megszűnt** — nincs mit takarítani
- [x] `ScreenRouter.tsx` — a `shop` felkerült a **regisztrált fiókot igénylő** fázisok listájára: `needsAccount = friends | chat | friendWall | shop`; vendégnél `transitionTo("mainMenu")` + `<MainMenu />` (a `blockSocial` átnevezve `blockPhase`-re)
- [x] `ScreenRouter.tsx` — a `status === "loading"` továbbra **sem** vendég (az auth aszinkron feloldódása nem dobhatja ki a bejelentkezett játékost oldalfrissítéskor)
- [x] i18n: új `shop.guestNotice` kulcs **mind az 5 nyelven**
- [x] Ellenőrzés: `tsc --noEmit` tiszta · `npm run test` **77/77** zöld · `npm run build` sikeres · i18n paritás **366/366** mind az 5 nyelven

**G rész — Hiányzó `shop.sort.*` i18n névtér — BUGFIX (2026-07-28)**

- [x] **Tünet:** a `ProductGrid` rendezés-dropdownjában a felhasználó a **nyers kulcsokat** látta (`shop.sort.priceAsc`, …) a fordítások helyett
- [x] **Ok:** a `ProductGrid.tsx` 6 kulcsot használ (`shop.sort.priceAsc` / `.priceDesc` / `.speedAsc` / `.speedDesc` / `.distanceAsc` / `.distanceDesc`), de a `shop.sort` objektum **EGYIK nyelvi fájlban sem létezett**
- [x] **Javítás:** a `shop.sort` névtér mind a 6 kulccsal pótolva **mind az 5 nyelven**
- [x] **Tanulság (kockázatként rögzítve, 8.2):** a kulcsparitás-ellenőrzés csak a **meglévő** kulcsokat veti össze a nyelvek között — egy **mindenhonnan** hiányzó kulcsot **nem talál meg**. A komponensekben hivatkozott kulcsok létezését külön kellene ellenőrizni.
- [x] Ellenőrzés: i18n paritás **366/366** mind az 5 nyelven · `tsc --noEmit` tiszta · `npm run test` **77/77** zöld · `npm run build` sikeres

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

> ### 🔒 Vendég-zár (2026-07-28, F rész)
>
> ```
> mainMenu ──(Áruház)──▶  isGuest ?  ──igen──▶  addToast("warning", t("shop.guestNotice"), 7000)
>                            │                   (🔒 gomb + title tooltip + toast a bal felső sarokban)
>                            └──nem───▶  transitionTo("shop")
>
> ScreenRouter:  needsAccount = friends | chat | friendWall | shop
>                blockPhase   = isGuest && needsAccount        # a perzisztált fázis miatt
>                    └──▶ transitionTo("mainMenu") + <MainMenu />
>                isGuest = authStatus !== "loading" && (!authUser || authUser.isAnonymous)
> ```
>
> A `MainMenu` egyetlen `guardedNav(phase, noticeKey)` helperrel kezeli az Áruház és a Barátok gombot is; a kulcsot közvetlenül az `addToast`-nak adja át. **2026-07-29 óta** nincs `guestNoticeKey` state és nincs beágyazott `<p role="status">` — a tájékoztató toast, `GUEST_NOTICE_DURATION_MS = 7000` élettartammal ([[015-toast-notification]] H. blokk).

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
- `persist.partialize`: `credits`, `owned` (`cart`, `isPreviewing`, `activePreviewId` **nem** perzisztált). ⚠️ **Elavult** — lásd a 3.1-et: a `credits`/`owned` a [[004-firebase-auth-bugfix]] óta, a `purchaseHistory` a 2026-07-28-i E rész óta nem perzisztálódik.
- `activePreviewId` és `setActivePreviewId`: **nem perzisztált** — munkamenet-állapot. A `MusicPreviewButton` ezt használja a globális előnézet-követéshez.

### 3.1 Vásárlási előzmény (`purchaseHistory`) — RTDB-alapú (2026-07-28, E rész)

```ts
export interface PurchaseRecord {
  id: string;           // lokálisan generált — az RTDB push ID NEM ez
  itemName: string;
  category: string;     // "ship" | "music" | "exoplanet" | "credits"
  credits: number;      // elköltött (vagy kredit-pakknál a kapott) kredit
  purchasedAt: number;  // timestamp
  packId?: string;      // kreditcsomagnál a pack ID
}

// useShopStore — modul-szintű helper, NEM store-action:
const persistPurchases = (records: PurchaseRecord[]): void => { /* getRtdbKey() + savePurchaseRecord */ };
```

**Adatfolyam:**

```
checkout() / buyCredits() / recordPurchase()
        │  (optimista lokális bejegyzés)
        ▼
persistPurchases(records)  ──►  savePurchaseRecord(rtdbKey, record)
                                       │  push → users/{uid}/purchases/{pushId}
                                       ▼
                                subscribeUser(users/{uid})     # a TELJES node — nincs külön subscription
                                       │
                                       ▼
                         handleUserData → shop.setPurchaseHistory(mapPurchases(data.purchases))
                                       │  (RTDB az igazságforrás; id || pushId normalizálás,
                                       │   purchasedAt szerint csökkenő)
                                       ▼
                                 PurchaseHistory.tsx
```

- **Nincs duplikáció:** a rekord az RTDB-ben is a **lokálisan generált `id`**-t viszi, ezért az RTDB-visszhang az optimista bejegyzést lecseréli, nem mellé teszi.
- **Perzisztálás:** `purchaseHistory` **nincs** a `partialize`-ban — fiókhoz kötött adat ([[007-state-persist-page-refresh]] G. blokk).
- **Miért nincs top-level `purchases` node?** Mert privát; nincs barát-nézete, tehát nem kell barát-olvasási szabály — ellentétben a `walls`-szal ([[012-wall-of-shame]] O. blokk).

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
| `exo-proxima-centauri` | Proxima Centauri | 4.24 | **15** | 0 (birtokolt) |
| `exo-wolf-424` | Wolf 424 | 14.31 | **45** | 0 (birtokolt) |
| `exo-ross-780` | Ross 780 | 15.34 | **50** | 0 (birtokolt) |

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

# --- G rész (2026-07-28): a ProductGrid rendezés-dropdownja használta, de EGYIK nyelvben sem létezett ---
shop.sort.priceAsc            # „Ár: növekvő"        (en: Price: low to high)
shop.sort.priceDesc           # „Ár: csökkenő"       (en: Price: high to low)
shop.sort.speedAsc            # „Sebesség: növekvő"  (en: Speed: slow to fast)
shop.sort.speedDesc           # „Sebesség: csökkenő" (en: Speed: fast to slow)
shop.sort.distanceAsc         # „Távolság: növekvő"  (en: Distance: near to far)
shop.sort.distanceDesc        # „Távolság: csökkenő" (en: Distance: far to near)

# --- F rész (2026-07-28): vendég-zár ---
shop.guestNotice              # „Az áruházhoz be kell jelentkezned. Jelentkezz be Google-fiókkal, hogy
                              #   vásárolhass és a krediteid megmaradjanak!"
                              #  (en: „The shop requires an account. Sign in with Google to make
                              #   purchases and keep your credits!")
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

### E rész — új / módosuló fájlok (2026-07-28)

```
src/state/clearUserScopedData.ts   # ÚJ — fiókváltáskori LOKÁLIS takarítás (RTDB-írás nélkül)
src/firebase/userData.ts           # +savePurchaseRecord(uid, record)  (push, id megőrzésével)
                                   # +mapPurchases(data)               (push-ID → tömb, purchasedAt desc)
                                   # UserNode +purchases?: Record<string, PurchaseRecord>
src/state/useShopStore.ts          # +persistPurchases() modul-szintű helper (checkout / buyCredits /
                                   #  recordPurchase mindhárom ágából), +setPurchaseHistory() action,
                                   #  partialize-ból KIKERÜLT a purchaseHistory
src/App.tsx                        # handleUserData: shop.setPurchaseHistory(mapPurchases(data.purchases));
                                   # +identitás-figyelő → clearUserScopedData()
database.rules.json                # +users/$key/purchases .write (device_map | uid) — DEPLOYT IGÉNYEL
```

### F / G rész — módosuló fájlok (2026-07-28)

```
src/components/screens/MainMenu.tsx        # Áruház gomb: 🔒 prefix + title tooltip vendégnél;
                                           # +guardedNav(phase, noticeKey) helper; handleShop MEGSZŰNT
                                           # 2026-07-29: a notice toastból jön (addToast, 7000 ms) —
                                           #   a guestNoticeKey state + a hozzá tartozó useEffect és a
                                           #   MainMenu.module.css .guestNotice osztálya TÖRÖLVE
                                           #   (015-toast-notification H. blokk)
src/components/routing/ScreenRouter.tsx    # needsAccount: +"shop" (friends | chat | friendWall | shop);
                                           # blockSocial → blockPhase átnevezés
src/i18n/locales/{en,hu,fr,de,es}/translation.json
                                           # +shop.guestNotice (F rész)
                                           # +shop.sort.{priceAsc,priceDesc,speedAsc,speedDesc,
                                           #             distanceAsc,distanceDesc} (G rész — hiányzó névtér)
```

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

### 8.1 Kockázatok — E rész (2026-07-28)

- **⚠️ Rules-deploy kötelezettség:** a `database.rules.json` `users/$key/purchases` ága **csak deploy után** hat. Deploy nélkül minden `savePurchaseRecord` `PERMISSION_DENIED`-be fut, és — mivel a lokális állapot optimista — a UI **helyesnek** látszik, amíg a felhasználó nem frissít. Ugyanaz a néma-megtagadás hibaosztály, mint a [[013-social-multiplayer]] N. blokkjában.
- **A push ID nem azonos a rekord `id`-jével.** A rekord szándékosan viszi magával a lokálisan generált `id`-t; a `mapPurchases` `record.id || pushId` normalizálást végez. Ha ez elmaradna, minden RTDB-visszhang **duplikátumot** hozna létre a listában.
- **Nincs külön subscription.** A `purchases` ág a `subscribeUser` teljes `users/{uid}` olvasásával érkezik. Ez azt is jelenti, hogy **minden** vásárlás az egész user node-ot újraküldi a klienseknek — a jelenlegi rekordszámnál elhanyagolható, de a lista **korlátlanul nőhet** (mint a szégyenfal rekordjai), ezért később limit / lapozás megfontolandó.
- **A lokális takarítás nem írhat RTDB-be.** A `clearUserScopedData` **nem** a `resetShop()`-ot hívja: az a resetet a szerverre is kiírná, és az **épp elhagyott** fiók walletjét/inventoryját nullázná. Minden jövőbeli „kijelentkezéskor ürítsd" logikának ezt a szétválasztást kell követnie.
- **A `partialize` bővítése tiltott fiókhoz kötött mezővel.** A `space-travel-shop` kulcson a böngésző minden fiókja osztozik — új mező felvétele előtt kötelező a kérdés: *eszközhöz vagy fiókhoz tartozik?* ([[007-state-persist-page-refresh]] G. blokk).

### 8.2 Kockázatok — F / G rész (2026-07-28)

- **⚠️ A vendég kreditje elérhetetlenné vált a shop felől.** A vendégnek **van** pénztárcája (`users/{deviceId}/wallet`, kezdő kredittel), és a `migrateGuestData` a bejelentkezéskor **átviszi** a kreditjeit ([[010-firebase-guest-merge-single-gate]]) — de **vásárolni nem tud**, amíg be nem jelentkezik. Ez **tudatosan vállalt következmény** (a vásárlásnak túl kell élnie egy eldobható sessiont), viszont azt jelenti, hogy a guest-merge kredit-logikája a shop felől **jelenleg nem elérhető**: vendég nem tud kreditet elkölteni, csak örökölni. Ha a vendég-vásárlás valaha visszatérne, a merge-politikát ([[009-firebase-identity-split-bugfix]] wallet-politika) újra kell értékelni.
- **Két helyen kell karbantartani a fázislistát.** A `MainMenu` gombja és a `ScreenRouter` `needsAccount` listája **külön** kód — egy új, fiókot igénylő fázis felvételekor **mindkettőt** módosítani kell, különben vagy a gomb enged be, vagy a perzisztált fázis kerüli meg a zárat.
- **A vendég-tájékoztatót i18n kulcs azonosítja, nem külön state.** Új vendég-zárt kapó képernyőnél csak egy új i18n kulcs kell (a `guardedNav` továbbadja az `addToast`-nak) — de a kulcsnak **léteznie kell** (lásd a következő pontot). *(2026-07-29: a korábbi `guestNoticeKey: string | null` state megszűnt, [[015-toast-notification]] H. blokk.)*
- **Toast-zaj a zárt gombnál.** A tájékoztató toast ismételt kattintásra nem duplikálódik: az `addToast` no-op, ha azonos típusú és szövegű toast még látható. Erre a védelemre **jelenleg nincs teszt** ([[015-toast-notification]] H. blokk, nyitott tétel).
- **⚠️ A kulcsparitás-ellenőrzés nem fogja meg a mindenhonnan hiányzó kulcsot.** A `shop.sort` névtér **egyik** nyelvben sem létezett, mégis „paritásban" volt — a felhasználó a nyers kulcsokat látta a `<select>`-ben. A paritás-ellenőrzés a nyelveket **egymáshoz** méri, nem a kódhoz. **Külön ellenőrzés kellene** arra, hogy a komponensekben hivatkozott `t("…")` kulcsok léteznek-e a locale-okban. Ugyanez a hibaosztály bármelyik új névtérnél megismételhető (lásd [[011-difficulty-event-system]]: `event.doom` a `EventModal` kulcstérképében szerepel, de egyetlen locale-ban sincs).

---

## 9. Kapcsolat a következő fázisokkal

- **✅ Exobolygók → küldetésválasztó (MEGVALÓSÍTVA):** a birtokolt exobolygók megjelennek a `MissionSelector`-ban, info modalban (`MissionExoplanetModal`) megtekinthetők képekkel és linkekkel.
- **✅ Exobolygó kép renderelés (JAVÍTVA):** a JSON `images` mezői nested objektumok `{url, type, source}` formátumban → `extractImageUrl()` helper + `onError` 🌌 fallback. A `links` mező string URL-eket tartalmaz, ott nincs hiba.
- **✅ Python scraper dokumentálva:** a NASA Images API + Wikimedia Commons hívások 0/100 találatot adtak a 100 legközelebbi exobolygóra. ESA linkek is keresőoldalak, nem közvetlen képfájlok.
- **✅ Űrhajók bekötése (MEGVALÓSÍTVA)** — `shipSelect` GamePhase: alap hajó (191 km/s) + birtokolt shop hajók. `ShipSelectScreen` grid layout, minden hajókártyán `ℹ` info gomb → `ShipInfoModal` (műszaki adatok). Hajó kiválasztáskor az utazási idő újraszámolva: `travelYears = baseTravelYears / (shipSpeed / SHIP_SPEED_KM_PER_SECOND)`. Kamera ellenőrzés a destination kiválasztás után történik (App.tsx `handleSelectDestination`), a `startMission` előtt.
- **✅ Zenék bekötése (MEGVALÓSÍTVA)** — a Beállítások zene-lejátszója: a birtokolt sáv aktiválása → a `useAudio` háttérzene-URL cseréje. `useUIStore.activeMusicId` perszisztál, `useAudio(activeMusicId)` dinamikusan vált.
- **[[003-firebase-auth-settings]]** — a helyi `credits` + `owned` **per-felhasználós Firebase-mentése** (RTDB `wallet`/`inventory`).
- **[[005-ingame-shop-strapi-stripe]]** — a **mock kreditcsomag-vásárlást Stripe-ra** cseréli (Strapi webhook → Firebase kredit hozzáadás).
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

| Vásárlási előzmény RTDB-be + identitásváltás-takarítás (E rész) | ✅ Kész (2026-07-28) |
| Áruház vendég-zár (F rész) + `shop.sort.*` i18n pótlás (G rész) | ✅ Kész (2026-07-28) |

**Kész definíció — bővítés (2026-07-28, E rész):** a vásárlási előzmény a **`users/{uid}/purchases/{pushId}`** ágban él, minden keletkezési ágból (`checkout`, `buyCredits`, `recordPurchase`) mentődik, és a `subscribeUser` élő frissítésével — **külön subscription nélkül** — érkezik vissza a kliensre. A rekord megtartja a lokális `id`-jét, így az RTDB-visszhang nem duplikál. A `purchaseHistory` **nem** perzisztálódik localStorage-ba, és fiókváltáskor a `clearUserScopedData` **lokálisan** üríti a shop állapotát (RTDB-írás nélkül). A `database.rules.json` `users/$key/purchases` írási szabálya **deployt igényel**. `tsc --noEmit` tiszta · `npm run test` 77/77 zöld · `npm run build` sikeres.

**Kész definíció — bővítés (2026-07-28, F / G rész):** az áruház **regisztrált (Google) fiókot igényel**. Vendégnél a főmenü Áruház gombja 🔒 prefixet kap, kattintásra a `shop.guestNotice` üzenetet mutatja (`title` tooltip + tájékoztató üzenet) navigáció helyett, a `ScreenRouter` pedig a **perzisztált** `shop` fázisból is visszairányít a főmenübe (`needsAccount = friends | chat | friendWall | shop`; a `status === "loading"` nem vendég). A `MainMenu` a `guardedNav(phase, noticeKey)` helperrel kezeli mindkét zárt gombot. **2026-07-29 óta** az üzenet **warning toast** a bal felső sarokban (`GUEST_NOTICE_DURATION_MS = 7000`), nem beágyazott `<p role="status">` — a `guestNoticeKey` state és a `.guestNotice` CSS osztály megszűnt ([[015-toast-notification]] H. blokk). A `shop.sort.*` névtér (6 kulcs) pótolva mind az 5 nyelven — korábban a rendezés-dropdown nyers kulcsokat mutatott. i18n paritás **366/366** · `tsc --noEmit` tiszta · `npm run test` 77/77 zöld · `npm run build` sikeres.

**Kész definíció elérve:** a Főmenü „Áruház" gombja a `shop` fázisra visz; a játékos **4 fül** között választhat: (1) Exobolygók + kereső, (2) Űrhajók + kereső, (3) Zenék + kereső, (4) **Kredit vásárlás** (azonos layout). 100 exobolygó (JSON) + 3 alap exobolygó (Birtokolt), 3 űrhajó preview-vel, 5 zene singleton-preview-val. Kosár „Eltávolítás" gombbal. **Normál induló egyenleg: 0 ⭐**. Debug módban 9000 ⭐, reset gombbal. Háttérzene nem szól a shopban. Csak a grid scrollázik. Birtokolt exobolygók a küldetésválasztóban, info gombbal (a kártya alján). Generikus Modal/Tabs komponensek `src/components/ui/`-ben. A Beállítások menüben **zeneválasztó** (alap + birtokolt zenék), letiltva ha nincs megvett zene. `useAudio` dinamikus track-váltással. ActiveMusicId perszisztálva `useUIStore`-ban. **Ship Select** (`shipSelect` GamePhase): küldetésválasztás után hajókiválasztás (alap hajó + birtokolt shop hajók), info modal műszaki adatokkal, sebesség alapján újraszámolt utazási idő. Kamera ellenőrzés a destination kiválasztás után történik.

---

## 11. Kapcsolódó tervek
- [[004-firebase-auth-bugfix]] – **a `useShopStore` kredit-modellje itt változik meg.** Az induló egyenleg lokális `initialCredits` elágazása (normál `0` ⭐ / debug `9000` ⭐) **megszűnik**: a store `credits: 0`-val indul, és új `creditsLoaded: boolean` flag jelzi, megérkezett-e már az RTDB-adat (amíg `false`, a kreditkijelzők `—`-t mutatnak `0` helyett, a vásárlás gombok pedig letiltottak). A debug 9000 a Firebase `getDefaultUserNode`-jába költözik, a 3 alap exobolygó pedig az induló `inventory.exoplanets`-be. **Az RTDB az egyetlen kredit- és birtoklás-forrás** (a `persist` már eltávolítva).
- [[001-main-menu-settings]] – az „Áruház" gomb, a `GamePhase`/`ScreenRouter`/`phaseToFlags` minta.
- [[003-firebase-auth-settings]] – a kredit/birtoklás/beállítás per-felhasználós Firebase-mentése.
- [[005-ingame-shop-strapi-stripe]] – a mock katalógus → Strapi, a mock checkout → Stripe.
- [[000-i18n-nyelvesites]] – a `shop.*` nyelvi réteg; a tulajdonnevek nem fordítandók.
- [[007-state-persist-page-refresh]] – a `partialize` elve: **localStorage-ban csak eszközszintű adat**. Az E rész ennek megfelelően vezette ki a `purchaseHistory`-t, és itt él a `clearUserScopedData` teljes leírása (G. blokk).
- [[013-social-multiplayer]] – **a vendég-őr forrása.** Az O. blokk vezette be a kétrétegű mintát (MainMenu gomb + `ScreenRouter` fázis-őr) a `friends` / `chat` / `friendWall` fázisokra; az itteni F rész terjesztette ki a `shop`-ra, közös `guardedNav` helperrel.
- [[015-toast-notification]] – **a vendég-tájékoztató megjelenítésének kanonikus forrása (2026-07-29).** A `guardedNav` a `shop.guestNotice` üzenetet `addToast("warning", …, GUEST_NOTICE_DURATION_MS)`-szal jeleníti meg; a `guestNoticeKey` state és a `.guestNotice` CSS osztály megszűnt (H. blokk / 0.9).
- [[010-firebase-guest-merge-single-gate]] – a vendég **örökölheti** a kreditjét bejelentkezéskor, de vendégként **nem költheti el** (F rész, 8.2 kockázat).
- [[012-wall-of-shame]] – **ugyanaz a hibaosztály** (fiókhoz kötött adat a böngésző-szintű localStorage-ban). A fal R. blokkja írja le a kiváltó tünetet; a shopnál a javítás **plusz** egy új szerveroldali ág (`users/{uid}/purchases`) bevezetésével járt, mert korábban semmilyen RTDB-pár nem létezett.
- [[017-starfield-realism]] – **a katalógus két mezője a `Starfield` renderelését vezérli.** A `ShipProduct.image` a cockpit képet adja (`cockpitImageUrl`), a `speedKmPerSecond` pedig a warp-csík hosszát (`getStretchFactor`). A 017 HiDPI-átvezetése a cockpit `drawImage` méretezését is átírja logikai koordinátákra — a képnek utána is élesen és pontosan ugyanúgy kell fednie; a hajósebesség-küszöbök (250 / 500 / 1000 km/s) **nem változnak**.
- [[019-stripe-fraud-defense]] – a `useShopStore.buyCredits` / `checkout` kredit-mozgásainak visszaélés-védelme. Fontos határfeltétel: a `checkout` **levon** a `wallet.credits`-ből, ezért az RTDB rules nem tehet „csak nőhet" megkötést — helyette írásonkénti növekmény-limit lép be. Új `shop.credits.claim*` i18n kulcsok mind az 5 nyelven.
