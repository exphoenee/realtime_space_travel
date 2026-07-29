---
title: "Szégyenfal – küldetésnapló (kudarcok és sikerek)"
slug: 012-wall-of-shame
type: plan
category: ui
status: implemented
implemented: true
implemented_at: "2026-07-28"
created_at: "2026-07-28"
updated_at: "2026-07-28"
author: exphoenee
step: 12
phases: []
dependencies:
  - 011-difficulty-event-system
related_plans:
  - 001-main-menu-settings
  - 002-ingame-shop-frontend
  - 003-firebase-auth-settings
  - 007-state-persist-page-refresh
  - 009-firebase-identity-split-bugfix
  - 010-firebase-guest-merge-single-gate
  - 015-toast-notification
tags:
  - wall-of-shame
  - ui
  - stats
  - firebase
  - persistence
  - i18n
  - success-records
  - debug
  - rtdb
  - walls
  - guest-merge
  - migration
  - identity
  - privacy
  - data-leak
---

# Szégyenfal – küldetésnapló (kudarcok és sikerek)

**Cél:** A főmenüből elérhető "Szégyenfal" képernyő, amely naplózza a játékos összes küldetését — sikereit és kudarcait egyaránt. Kudarc esetén: melyik hajóval indult, hová tartott, mennyi ideig bírta, milyen eseményekkel találkozott és miért vesztette el a legénységet. Siker esetén: hajó, cél, út időtartam, eseménynapló. **Az adatok — kudarcok ÉS sikerek egyaránt — Firebase RTDB-ben tárolódnak** a `walls/{uid}` node alatt, a localStorage (Zustand persist) offline gyorsítótárként/kiegészítésként szolgál. Debug módban egy gombnyomással szimulálható sikeres érkezés.

---

## Döntések (egyeztetve)

| Kérdés | Választás |
|--------|-----------|
| Tárolás (kudarc) | **Firebase RTDB** (`walls/{uid}/failures/{pushId}`) + localStorage (Zustand persist) — *korábban `users/{uid}/failures`, lásd O. blokk* |
| Tárolás (siker) | **Firebase RTDB** (`walls/{uid}/successes/{pushId}`) + localStorage (Zustand persist) — *korábban `users/{uid}/successes`, lásd O. blokk* |
| Miért külön top-level `walls` node? | A `users/$key/.read` **szülő szinten** blokkolja a barát-hozzáférést, ezért a falnak külön, **barát-barát olvasási szabállyal** rendelkező node kell ([[013-social-multiplayer]] I. blokk) |
| Régi (`users/…`) adatok sorsa | **Egyszeri, idempotens migráció** (`migrateWallData`) a tulajdonos saját faltárának megnyitásakor + **legacy fallback olvasás** barát módban |
| Vendég (anonymous) fal | Támogatott: a `walls/$uid` írás/olvasás a `device_map` tulajdonlást is elfogadja; guest→Google váltáskor a fal is átmigrál |
| Kinézet | **Díszfal / tabló** stílus — vörös akcentusos "sírkövek" a kudarcoknak, zöld akcentusos "trófeák" a sikereknek |
| Tartalom | Alap adatok (hajó, cél, idő, ok, **travelYears**) + collapsible részletek (események) + **rewardCredits** a sikereknél |
| Törlés | **Nincs** — a szégyen örök, a dicsőség is |
| Lokális gyorsítótár sorsa (2026-07-28, R. blokk) | **Megszűnt** — a `failureRecords` / `successRecords` / `bestServiceSeconds` **kikerült** a `useGameStore.partialize`-ból. Egyetlen forrás az RTDB (`walls/{rtdbKey}`, `users/{rtdbKey}/stats`). Ára: a lista pár száz ms-mal a képernyő megnyitása után jelenik meg. |
| Fiókváltáskori takarítás | `clearUserScopedData()` — **lokális-only**, nem ír RTDB-be (részletek: [[007-state-persist-page-refresh]] G. blokk) |
| Debug | `addDummySuccessRecord()`, `addDummyFailureRecord()` action-ök; `🎲 Generate Arrival` + `💀 Generate Failure` gombok a WallOfShame-on |
| Elhelyezés | Főmenü gomb → `wallOfShame` GamePhase |

---

## ✅ Haladás (TODO)

**A. Típusok és adatmodell**
- [x] `FailureRecord` interfész: id, shipName, shipId, destinationName, launchedAt, failedAt, serviceSeconds, crewLostReason, events[]
- [x] `EventLogEntry` interfész: type, result (success/fail), timestamp
- [x] `"wallOfShame"` GamePhase hozzáadása

**B. Generikus Collapse komponens**
- [x] `src/components/ui/Collapse.tsx` — újrahasználható accordion, CSS grid animációval
- [x] `Collapse.module.css` — badge támogatás, sima animáció

**C. Game Store — események követése és kudarc rögzítés**
- [x] `failureRecords: FailureRecord[]` a store-ban (persisted)
- [x] `missionEventLog: EventLogEntry[]` — aktuális küldetés eseményeinek naplója
- [x] `launchTimestamp`, `selectedShipName`, `selectedShipId` — indítási adatok
- [x] `recordFailure()` action — rögzíti a kudarcot a teljes állapotból
- [x] `startMission` — menti a hajó adatait és nullázza az event log-ot
- [x] `resolveEvent` — naplózza az események kimenetelét (siker/kudarc + típus)
- [x] `resetToMenu` — törli a küldetés-specifikus mezőket
- [x] `partialize` — `failureRecords` perzisztálása localStorage-ba — ⚠️ **visszavonva az R. blokkban (2026-07-28):** fiókhoz kötött adat nem maradhat localStorage-ban, az RTDB az egyetlen forrás

**D. Firebase RTDB szinkron**
- [x] `saveFailureRecord()` — push() mentés a `users/{uid}/failures/{pushId}` alá
- [x] `subscribeFailures()` — onValue subscription a failure rekordokra, deduplikációval
- [x] App.tsx subscription: automatikus kudarc rögzítés + RTDB mentés, amikor `gamePhase → "crewLost"`

**E. Szégyenfal képernyő**
- [x] `WallOfShame.tsx` + `WallOfShame.module.css`
- [x] Díszes tabló stílus: vörös akcentusos "sírkövek" lineáris gradients éllel
- [x] Collapsible event részletek a generikus Collapse komponenssel
- [x] Event típusonként eltérő emoji ikonok
- [x] Halálok badge-ek (attention/buttons/event) színes címkékkel
- [x] Dátum/idő formázás + időtartam formázás
- [x] Empty state: trófea ikon + "Nincs kudarc" üzenet
- [x] RTDB szinkron a megnyitáskor (deduplikáció rekord ID alapján)
- [x] Összesítő statisztikák a tetején: összes kudarc, leggyakoribb halálok, leggyakrabban használt hajó, leghosszabb/legrövidebb szolgálati idő

**F. Útvonaltervezés + Főmenü**
- [x] `ScreenRouter` — wallOfShame fázis → `WallOfShame` komponens
- [x] `MainMenu` — "Szégyenfal" gomb hozzáadva

**G. i18n — ÚJ kulcsok mind az 5 nyelven**
- [x] `mainMenu.wallOfShame` — gomb szöveg
- [x] `wallOfShame.title` / `.subtitle` / `.empty` / `.events`
- [x] `wallOfShame.success` / `.fail`
- [x] `wallOfShame.reason.*` (attention, buttons, event, unknown)
- [x] `wallOfShame.stat.*` (total, solved, failed)
- [x] `wallOfShame.stats.*` (totalFailures, mostCommonDeath, mostUsedShip, longestService, shortestService)

**H. Extra: cockpitVariant bugfix**
- [x] Rescue-transfer siker esetén `cockpitVariant = "rescue"` (pre-existáló hiba javítva)

**I. Sikeres küldetések (SuccessRecord) — ÚJ (2026-07-28)**
- [x] `SuccessRecord` típus: id, shipName, shipId, destinationName, launchedAt, completedAt, **travelYears**, events[], rewardCredits?
- [x] `successRecords: SuccessRecord[]` a store-ban (persisted)
- [x] `recordMissionComplete()` action — rögzíti a sikeres érkezést + wage-alapú rewardCredits
- [x] `addDummySuccessRecord()` action — debug: random adatokkal + 5–8 eseménnyel + travelYears + wage-alapú reward
- [x] App.tsx: `recordMissionComplete()` meghívása, amikor `remainingYears <= 0`
- [x] WallOfShame refactor: mindkét típus (failure + success) egyesítve, timestamp szerint rendezve
- [x] `FailureEntry` (💀) — piros gradient, halál ok badge, **travelYears** megjelenítés
- [x] `SuccessEntry` (🏆) — zöld gradient, "Arrived" badge, **travelYears** + **rewardCredits** megjelenítés
- [x] Statisztikák: totalMissions, totalFailures, totalSuccesses, successRate, **totalDistance** (travelYears összege)
- [x] Új i18n kulcsok: `emptyMissions`, `reason.success`, `stats.totalMissions`, `stats.totalSuccesses`, `stats.successRate`, `stats.totalDistance`

**J. travelYears bővítés (2026-07-28)**
- [x] `FailureRecord.travelYears: number` — kötelező mező
- [x] `SuccessRecord.travelYears: number` — kötelező mező
- [x] `recordFailure()`, `exitMission()`, `addDummyFailureRecord()` — mindhárom beállítja a `travelYears`-t
- [x] `recordMissionComplete()`, `addDummySuccessRecord()` — beállítják a `travelYears`-t
- [x] `getDestinationWage()` helper a `universeData.ts`-ben — név alapján keres a baseDestinations-ben (50/250/1000⭐), ismeretlenre `travelYears × 0.05` képlet
- [x] `formatYears()` formázó függvény + null guard (`years == null`)
- [x] Kártyákon `🚀 {formatYears(record.travelYears)}` mindkét entry típusnál
- [x] Statisztikában `shortestService` → `totalDistance` csere

**K. rewardCredits — wage-alapú jutalom (2026-07-28)**
- [x] `SuccessRecord.rewardCredits?: number` — opcionális mező
- [x] `recordMissionComplete()`: `rewardCredits = getDestinationWage(destinationName, travelYears)`
- [x] `addDummySuccessRecord()`: ugyanaz a wage lookup (nem random 30-100)
- [x] Debug gomb kattintásra: `incrementUserWallet(Firebase)` + `useShopStore.setState` (lokális)
- [x] `⭐ +{rewardCredits}` arany badge a siker kártyán

**L. Debug failure generátor (2026-07-28)**
- [x] `addDummyFailureRecord()` action a store-ban
- [x] `💀 Generate Failure` gomb a WallOfShame-on (piros `.debugBtnFail` CSS)
- [x] Firebase mentés: `saveFailureRecord(rtdbKey, latest)`
- [x] Random travelYears, death reason, 5–8 esemény

**M. Firebase szinkron bővítés (2026-07-28)**
- [x] `saveSuccessRecord()` + `subscribeSuccesses()` a `userData.ts`-ben
- [x] `saveFailureRecord()` exportálva (már megvolt, de használatba véve debug-nál)
- [x] `incrementUserWallet` használata reward kredit hozzáadásához

**N. `formatYears` null guard (2026-07-28)**
- [x] `formatYears(years)` most `years == null || years <= 0` ellenőrzéssel indul
- [x] Megakadályozza a `Cannot read properties of undefined (reading 'toLocaleString')` crash-t régi rekordoknál

**O. `walls/{uid}` útvonalváltás + legacy fallback (2026-07-28)**
- [x] A szégyenfal adatai `users/{uid}/failures|successes` → **`walls/{uid}/failures|successes`** (top-level node)
- [x] Indok: a `users/$key/.read` szabály **szülő szinten** blokkolja a barát-hozzáférést, ezért kellett külön, **barát-barát olvasási szabállyal** rendelkező node ([[013-social-multiplayer]] I. blokk)
- [x] `database.rules.json` — `walls/$uid` `.read`: tulajdonos (`$uid == auth.uid`) **VAGY** `device_map` tulajdonos **VAGY** barát (`root.child('friends').child(auth.uid).child($uid).val() === true`)
- [x] `migrateWallData(uid)` — **egyszeri, idempotens** migráció a régi útról az újra; **csak akkor fut**, ha az új út üres ÉS a régin van adat; a tulajdonos **saját** faltárának megnyitásakor hívódik
- [x] Új közös helper a `userData.ts`-ben: `subscribeWallRecords<T>(path, timestampOf, callback)` — push-ID → tömb konverzió, `id` normalizálás (`record.id || pushId`), időbélyeg szerinti **csökkenő** rendezés
- [x] `subscribeFailures` és `subscribeSuccesses` átírva a közös helperre
- [x] **Error callback:** hiba (pl. `PERMISSION_DENIED`) esetén a subscription **üres listát** ad vissza a néma hallgatás helyett — enélkül egy megtagadott olvasás callback nélkül maradna, és a UI „nincs adat" helyett örökre üresen állna

**P. Saját `successes` betöltése RTDB-ből — BUGFIX (2026-07-28)**
- [x] Tünet: self módban a `WallOfShame` **csak** a `subscribeFailures`-re iratkozott fel, a `subscribeSuccesses`-re nem → a sikeres küldetések kizárólag a lokális Zustand persist store-ból jöttek, így **új gépen/böngészőben eltűntek**, pedig az `App.tsx` már mentette őket RTDB-be
- [x] Javítás: self módban **mindkét** subscription fut (`subscribeFailures` + `subscribeSuccesses`)
- [x] `id` alapú **dedupe merge** a store-ba: failures `failedAt`, successes `completedAt` szerint csökkenően rendezve
- [x] A terv **5.3** és **6.** szekciója javítva: a „success rekordok nem kerülnek RTDB-be (csak localStorage)" állítás **elavult** — a sikerek is RTDB-ben tárolódnak (M. blokk `saveSuccessRecord` óta)

**Q. Vendég (anonymous) userek fala — BUGFIX (2026-07-28)**
- [x] Tünet: vendégnél a `getRtdbKey()` a localStorage-alapú `deviceId`-t adja, a `walls/$uid/failures` írási szabály viszont `$uid == auth.uid`-ot követelt → **minden mentés `PERMISSION_DENIED`** volt, a vendégnek egyáltalán **nem íródott fal**
- [x] `database.rules.json` — a `walls/$uid` **olvasás ÉS írás** mostantól elfogadja a `device_map` tulajdonlást is (`root.child('device_map').child($uid).val() == auth.uid`), ahogy a `users` ág már régóta ([[010-firebase-guest-merge-single-gate]], [[009-firebase-identity-split-bugfix]])
- [x] `migrateGuestData()` bővítése: a guest→Google váltáskor a **fal is átkerül** `walls/{deviceId}` → `walls/{targetUid}`, **eredeti push ID-kkal** (idempotens overwrite), a forrás ág törlésével — enélkül a vendég fala a váltás után láthatatlan maradna, mert a barát-rendszer **auth uid-del** kulcsol
- [x] Új helper: `collectGuestWallUpdates(db, deviceId, targetUid)` a `userData.ts`-ben
- [x] A fal **akkor is migrál**, ha a guest `users/{deviceId}` node már nem létezik
- [x] A fő atomi írás bukása esetén a fal külön **retry**-t kap az `executeAtomicUpdate` fallback ágában
- [x] A falrekordok **nem „valuta"** → a `"blocked"` (már claimelt) merge-ágban is átmigrálnak, nem esnek az `orphanDiscardedCredits` mintájú elhagyás alá
- [x] `src/firebase/userData.test.ts` — 2 új eset: *„moves the guest Wall of Shame to the target uid"*, *„migrates the wall even when the guest user node is gone"*
- [x] `mockGet` mostantól **explicit alapértelmezettel** indul `beforeEach`-ben — eddig egy korábbi teszt implementációja szivárgott át a többire (teszt-izolációs hiba)
- [x] `tsc --noEmit` tiszta · `npm run test` **77/77** zöld · `npm run build` sikeres

**R. Identitásváltáskori adatszivárgás — BUGFIX (biztonsági/adatvédelmi) (2026-07-28)**
- [x] **Tünet:** kijelentkezés után a szégyenfal az **előző user** küldetéseit mutatta, és a **statisztikák** (sikerráta, leggyakoribb halálok, összes utazott év, leghosszabb szolgálat) is beszámították azokat az új usernek. Ugyanez az áruház vásárlási előzményénél ([[002-ingame-shop-frontend]] E. rész).
- [x] **Ok #1 — a kijelentkezés nem takarított:** a `SettingsScreen.handleLogout` (`signOut()` + `clearUser()`) **csak az auth store-t** ürítette. A `space-travel-game` és a `space-travel-shop` localStorage kulcs fiókhoz kötött adata érintetlen maradt.
- [x] **Ok #2 — a fal append-only:** a `failureRecords` / `successRecords` sosem **cserélődik**, csak hozzáfűződik (`id` szerinti dedupe-merge, P. blokk) → az idegen rekordokat a következő user RTDB-adata **nem írta felül**, azok **véglegesen** ottragadtak, és a statisztikákba is beszámítottak.
- [x] **Javítás 1. réteg:** `useGameStore.clearUserScopedData()` action — `failureRecords`, `successRecords`, `bestServiceSeconds`, `missionEventLog`, `friendWallTargetUid/Name`, `chatTargetUid/Name` nullázása
- [x] **Javítás 2. réteg:** új `src/state/clearUserScopedData.ts` helper — hívja a fenti actiont **és** üríti a shop lokális állapotát (`credits`, `creditsLoaded`, `owned` → `BASE_EXOPLANET_IDS`, `cart`, `purchaseHistory`)
- [x] **Szándékosan lokális-only:** nem a `useShopStore.resetShop()` fut, mert az **RTDB-be is kiírná** a resetet, és az **épp elhagyott** fiók szerveroldali walletjét/inventoryját rongálná
- [x] Az **eszközszintű beállítások megmaradnak** (hangerő, nyelv, nehézség, kamera-hozzájárulás) — a böngészőhöz tartoznak, nem a userhez
- [x] **Javítás 3. réteg:** `App.tsx` identitás-figyelő (`useAuthStore.subscribe`) — csak a **regisztrált (nem anonim)** uid-t követi
  - [x] Google → kijelentkezés **vagy** másik Google fiók = **törlés**
  - [x] Vendég → Google bejelentkezés = **NINCS** törlés (ugyanaz az ember session-upgrade közben; a `migrateGuestData` épp átvitte az adatait — [[010-firebase-guest-merge-single-gate]])
  - [x] Oldalfrissítés bejelentkezve = **nincs** törlés: a kiindulási érték a store **aktuális** állapotából jön, nem `null`-ról indul, így az auth aszinkron feloldódása nem számít váltásnak
- [x] **Strukturális megoldás (hogy ne kelljen „emlékezni a törlésre"):** a `useGameStore.partialize`-ból **kikerült** a `failureRecords`, `successRecords`, `bestServiceSeconds` — mind megvan RTDB-ben (`walls/{rtdbKey}`, `users/{rtdbKey}/stats`) és onnan is töltődik (a fal képernyő feliratkozása, illetve a `handleUserData` `stats` max-merge). Az elv teljes leírása: [[007-state-persist-page-refresh]] G. blokk.
- [x] **Vállalt ár:** a fal listája pár száz ms-mal a képernyő megnyitása **után** jelenik meg, nem azonnal
- [x] `tsc --noEmit` tiszta · `npm run test` **77/77** zöld · `npm run build` sikeres

**S. `record.events` undefined — szégyenfal crash (BUGFIX) (2026-07-28)**
- [x] **Tünet:** `TypeError: Cannot read properties of undefined (reading 'length')` a `FailureEntry`-ben a szégyenfal **megnyitásakor**; az `ErrorBoundary` kapta el (a képernyő nem renderelt)
- [x] **Ok:** **az RTDB nem tárol üres tömböt.** Az `events: []` mezővel mentett rekord az `events` kulcs **NÉLKÜL** jön vissza, a fogyasztók viszont `record.events.length`-et hívnak.
- [x] **Miért csak most jött elő?** Korábban a fal a **localStorage-ból** renderelt, ahol a `[]` megmaradt (a JSON-perzisztálás megőrzi az üres tömböt). Az R. blokk persist-kivezetése után az **RTDB lett az egyetlen forrás**, és a látens adatmodell-hiba azonnal felszínre jött.
- [x] **Tanulság:** a persist kivezetése nem „csak" tárolási változás — **felfedi a szerveroldali adatmodell eddig elrejtett hiányosságait**. Minden RTDB-ből érkező mezőnél számolni kell azzal, hogy az üres tömb/objektum **hiányzó kulcsként** jön vissza.
- [x] **Javítás 1. réteg (forrásnál):** `subscribeWallRecords` **normalizál** — `events: record.events ?? []` a push-ID → tömb konverzió során; a generikus paraméter `T extends { id: string; events: EventLogEntry[] }`-re szűkítve, hogy a normalizálás típusszinten is kikényszeríthető legyen
- [x] **Javítás 2. réteg (fogyasztónál):** a `FailureEntry` és a `SuccessEntry` is defenzív `const events = record.events ?? []`-t használ, és a render (`events.length`, event-lista bejárás) **ezt** a tömböt járja be
- [x] Miért **két** réteg? A forrás-normalizálás a `subscribeWallRecords`-on átmenő minden rekordot lefed, de a store-ba **más úton** (lokálisan generált rekord, debug generátor, legacy merge) is kerülhet adat — a komponens-szintű guard ezt is állja
- [x] `tsc --noEmit` tiszta · `npm run test` **77/77** zöld · `npm run build` sikeres · i18n paritás **366/366**

---

## 1. Architektúra

### 1.1 Adatfolyam — kudarcok

```
          startMission                              resolveEvent
               │                                        │
               ▼                                        ▼
         launchTimestamp                          missionEventLog[]
         selectedShipName                    [{ type, result, timestamp }]
         selectedShipId                              │
               │                                     │
               └─────────────────┬──────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │  gamePhase → "crewLost"  │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │    recordFailure()       │
                    │  → FailureRecord         │
                    │  → failureRecords[] +1   │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │  saveFailureRecord()     │
                    │  → RTDB push             │
                    └─────────────────────────┘
```

### 1.3 Adatfolyam — sikerek

```
                    remainingYears <= 0
                           │
                    ┌──────▼──────┐
                    │             │
              updateBestServiceTime()
                    │
                    ▼
            recordMissionComplete()
                    │
              ┌─────▼─────┐
              │ SuccessRecord │
              │  → successRecords[] +1 │
              └─────┬─────┘
                    │
                    ▼
          transitionTo("missionComplete")

   Debug módban:
   DebugEventBar → 🎉 Arrival gomb
                    │
                    ▼
          addDummySuccessRecord()
              ┌─────▼─────┐
              │ random dest, │
              │ random time  │
              │ → successRecords[] +1 │
              └───────────┘
```

### 1.4 Adatmodellek

```ts
// Kudarc (bővítve travelYears-szal)
interface FailureRecord {
  id: string;
  shipName: string;
  shipId: string | null;
  destinationName: string;
  launchedAt: number;
  failedAt: number;
  serviceSeconds: number;
  travelYears: number;               // ← ÚJ: tervezett út hossza években
  crewLostReason: CrewLostReason;
  events: EventLogEntry[];
}

// Siker (bővítve travelYears + rewardCredits-szel)
interface SuccessRecord {
  id: string;
  shipName: string;
  shipId: string | null;
  destinationName: string;
  launchedAt: number;
  completedAt: number;
  serviceSeconds: number;
  travelYears: number;               // ← ÚJ: tervezett út hossza években
  events: EventLogEntry[];
  rewardCredits?: number;            // ← ÚJ: küldetés jutalom (wage-alapú)
}

// Eseménynapló (közös)
interface EventLogEntry {
  type: EventType;
  result: "success" | "fail";
  timestamp: number;
}
```

### 1.5 Display modell (WallOfShame.tsx)

```ts
type DisplayRecord =
  | { kind: "failure"; data: FailureRecord }
  | { kind: "success"; data: SuccessRecord };
```

A `WallOfShame` mindkét típust egyesíti egy `allRecords` tömbben (`useMemo`), timestamp szerint csökkenően rendezve. A `FailureEntry` és `SuccessEntry` külön al-komponensek.

### 1.6 Firebase RTDB struktúra (aktuális — `walls/{uid}`)

```
walls/{uid}/                      # ← TOP-LEVEL node (2026-07-28, O. blokk)
  failures/
    {pushId}:
      id: "fail-..."
      shipName: "Nomad X1"
      destinationName: "Proxima Centauri"
      launchedAt: 1234567890
      failedAt: 1234567899
      serviceSeconds: 342
      travelYears: 4.24
      crewLostReason: "attention"
      events:
        - type: "horn"
          result: "success"
          timestamp: 1234567895
  successes/
    {pushId}:
      id: "success-..."
      completedAt: 1234567899
      travelYears: 4.24
      rewardCredits: 250
      events: [...]
```

**Security rules (`database.rules.json`):**

```jsonc
"walls": {
  "$uid": {
    // tulajdonos VAGY device_map tulajdonos (guest) VAGY barát
    ".read": "auth != null && ($uid == auth.uid
              || root.child('device_map').child($uid).val() == auth.uid
              || root.child('friends').child(auth.uid).child($uid).val() === true)",
    "failures":  { ".write": "auth != null && (root.child('device_map').child($uid).val() == auth.uid || $uid == auth.uid)" },
    "successes": { ".write": "auth != null && (root.child('device_map').child($uid).val() == auth.uid || $uid == auth.uid)" }
  }
}
```

- Az **olvasás** a `walls/$uid` **szintjén** van megadva, nem a gyerekeken — az RTDB-ben a lekérdezett node-on vagy **felette** kell a `.read`, a gyerekszabály nem engedélyez szülő-listázást (ugyanez a hibaosztály okozta a chat-üzenetek betöltési hibáját, [[013-social-multiplayer]] N. blokk).
- Az **írás** `device_map`-tulajdonlást is elfogad → a **vendég (anonymous)** játékosnak is íródik fal (Q. blokk). Enélkül `getRtdbKey()` a `deviceId`-t adja, és minden mentés `PERMISSION_DENIED`-be futott.

### 1.7 Legacy útvonal és migráció

**Régi (elavult) séma:** `users/{uid}/failures|successes/{pushId}` — ugyanaz a rekord-alak.

```
Tulajdonos megnyitja a saját falát
        │
        ▼
migrateWallData(uid)            # idempotens
        │
        ├── walls/{uid} NEM üres  → no-op
        ├── users/{uid}/… üres    → no-op
        └── különben: másolás walls/{uid} alá (VÁLTOZATLAN id-vel) + forrás törlés
        │
        ▼
subscribeFailures / subscribeSuccesses  →  walls/{uid}/…

Barát megnyitja MÁS falát (013 L. blokk)
        │
        ├── subscribeFailures(friendUid)        →  walls/{friendUid}/failures
        ├── subscribeSuccesses(friendUid)       →  walls/{friendUid}/successes
        ├── subscribeLegacyFailures(friendUid)  →  users/{friendUid}/failures     ← fallback
        └── subscribeLegacySuccesses(friendUid) →  users/{friendUid}/successes    ← fallback
                                 │
                                 ▼
                        mergeById(primary, legacy)   # id szerinti dedup
```

A barát **nem tud** a másik nevében migrálni (a `walls/$uid` írás `$uid == auth.uid`-hez kötött), ezért ott fallback **olvasás** a megoldás. Mivel a migráció **változatlan `id`-vel** másol, egy félig migrált usernél sem keletkezik duplikátum.

### 1.8 Vendég fal migrálása a guest→Google váltásnál

A [[010-firebase-guest-merge-single-gate]] `migrateGuestData()` függvénye kiegészült a fal áthelyezésével:

```
collectGuestWallUpdates(db, deviceId, targetUid)
  → walls/{targetUid}/failures/{pushId}  = <rekord>   # eredeti push ID
  → walls/{targetUid}/successes/{pushId} = <rekord>
  → walls/{deviceId}                     = null
```

- **Idempotens overwrite** (azonos push ID-k) → többszöri futás sem duplikál.
- **Nem valuta:** a falrekordok a `"blocked"` (már claimelt) merge-ágban **is** átmigrálnak — a `guestMergeClaimed` kapu csak a kreditre/tárgyakra vonatkozik.
- **A guest user node hiánya nem akadály:** a fal akkor is migrál, ha `users/{deviceId}` már nem létezik.
- Az `executeAtomicUpdate` fallback ágában külön **retry** védi a fal-írást, ha a fő atomi multi-path update elhasal.

---

## 2. Fájlstruktúra

### Új fájlok
```
src/types/index.ts                              # +FailureRecord, +EventLogEntry, +"wallOfShame" GamePhase, +SuccessRecord
src/components/ui/Collapse.tsx                  # Generikus accordion komponens
src/components/ui/Collapse.module.css
src/components/screens/WallOfShame.tsx           # Szégyenfal képernyő (failure + success)
src/components/screens/WallOfShame.module.css
```

### Módosuló fájlok
```
src/state/useGameStore.ts                        # +failureRecords, +successRecords, +missionEventLog, +launchTimestamp, +selectedShipName, +selectedShipId, +recordFailure(), +recordMissionComplete(), +addDummySuccessRecord()
src/firebase/userData.ts                         # +saveFailureRecord(), +subscribeFailures()
src/App.tsx                                      # +kudarc automatikus rögzítés subscription, +recordMissionComplete() meghívás
src/components/routing/ScreenRouter.tsx           # +wallOfShame routing
src/components/screens/MainMenu.tsx               # +"Szégyenfal" gomb
src/components/features/DebugEventBar.tsx         # +"🎉 Arrival" gomb
src/components/features/DebugEventBar.module.css  # +.btnSuccess stílus
src/i18n/locales/{en,hu,fr,de,es}/translation.json  # ~20 új kulcs
```

### Módosuló fájlok — O./P./Q. blokk (2026-07-28)
```
src/firebase/userData.ts                # +subscribeWallRecords<T>() közös helper (push-ID → tömb, id normalizálás,
                                        #  csökkenő rendezés, error callback → üres lista)
                                        # subscribeFailures/subscribeSuccesses → walls/{uid}/…
                                        # +subscribeLegacyFailures/+subscribeLegacySuccesses (users/{uid}/… fallback, 013 L.)
                                        # +migrateWallData(uid) — egyszeri, idempotens users/… → walls/…
                                        # +collectGuestWallUpdates(db, deviceId, targetUid)
                                        # migrateGuestData() — a fal is átkerül (merged ÉS blocked ágon)
src/components/screens/WallOfShame.tsx  # self mód: subscribeSuccesses is fut (BUGFIX); migrateWallData() a megnyitáskor;
                                        # barát mód: 4 subscription + mergeById() dedup
src/firebase/userData.test.ts           # +2 guest-fal migrációs eset; mockGet explicit default beforeEach-ben
database.rules.json                     # +walls/$uid node (.read: tulaj | device_map | barát;
                                        #  .write failures/successes: tulaj | device_map)
security.rules.json                     # séma-komment: walls/{uid}/failures|successes; users/{uid}/failures|successes DEPRECATED (legacy)
```

### Módosuló / új fájlok — R. blokk (2026-07-28)
```
src/state/clearUserScopedData.ts  # ÚJ — fiókhoz kötött LOKÁLIS állapot ürítése (game store action +
                                  #  shop setState), RTDB-írás NÉLKÜL (nem resetShop!)
src/state/useGameStore.ts         # +clearUserScopedData() action; partialize-ból KIKERÜLT a
                                  #  failureRecords, successRecords, bestServiceSeconds
src/state/useShopStore.ts         # partialize-ból KIKERÜLT a purchaseHistory (002 E. rész)
src/App.tsx                       # +identitás-figyelő useAuthStore.subscribe → clearUserScopedData()
                                  #  (csak REGISZTRÁLT uid váltásakor)
```

### Módosuló fájlok — S. blokk (2026-07-28)
```
src/firebase/userData.ts               # subscribeWallRecords<T extends { id: string; events: EventLogEntry[] }>
                                       #  → events: record.events ?? []  (az RTDB nem tárol üres tömböt)
src/components/screens/WallOfShame.tsx # FailureEntry + SuccessEntry: const events = record.events ?? [];
                                       #  a render ezt a tömböt járja be (events.length, esemény-lista)
```

---

## 3. Függőségek

- **Előfeltétel:** [[011-difficulty-event-system]] — a `missionEventLog` az eseményrendszer `resolveEvent`-jében töltődik
- **Érinti:** [[001-main-menu-settings]] — főmenü gomb
- **Érinti:** [[007-state-persist-page-refresh]] — `failureRecords` + `successRecords` localStorage perzisztálás. **Fontos:** az O./P. blokk óta az RTDB (`walls/{uid}`) az elsődleges forrás, a persist store már csak kiegészítő/offline gyorsítótár; a betöltés `id` alapú dedupe merge-dzsel egyesíti a kettőt. **Az R. blokk (2026-07-28) óta a lokális gyorsítótár teljesen megszűnt:** a `failureRecords`, `successRecords` és `bestServiceSeconds` **kikerült** a `partialize`-ból — fiókhoz kötött adat nem élhet a böngésző-szintű localStorage-ban.
- **Érinti:** aktuális implementációs kör — a `recordMissionComplete()` az App.tsx `remainingYears <= 0` ágában került meghívásra
- **Érinti:** [[010-firebase-guest-merge-single-gate]] — a `migrateGuestData()` kiegészült a `walls/{deviceId}` → `walls/{targetUid}` áthelyezéssel (Q. blokk, 1.8); a `collectGuestWallUpdates` az ottani atomikus multi-path update-be és annak fallback ágába illeszkedik
- **Érinti:** [[009-firebase-identity-split-bugfix]] — a `getRtdbKey()` invariáns adja a fal kulcsát: bejelentkezve `auth.uid`, vendégként `deviceId`. A `walls/$uid` szabálynak **mindkettőt** engednie kell (Q. blokk) — ez ugyanaz a `device_map`-alapú tulajdonlási minta, amit a `users` ág használ.
- **Kiszolgálja:** [[013-social-multiplayer]] — a barát szégyenfala (I. blokk) a `walls/{friendUid}` node barát-olvasási szabályára épül; a legacy fallback olvasás (013 L. blokk) az O. blokk migrációjának hiányosságát fedi le

---

## 4. i18n — ÖSSZES kulcs (mind az 5 nyelv)

> Teljes paritás kötelező (`en`, `hu`, `fr`, `de`, `es`).

| Kulcs | en | hu |
|---|---|---|
| `mainMenu.wallOfShame` | Wall of Shame | Szégyenfal |
| `wallOfShame.title` | Wall of Shame | Szégyenfal |
| `wallOfShame.subtitle` | {{count}} mission(s) recorded | {{count}} küldetés rögzítve |
| `wallOfShame.emptyMissions` ⭐ | No missions yet. Launch a mission to see it here! | Még nincs küldetés. Indíts egy küldetést, hogy itt lássad! |
| `wallOfShame.empty` | No failures yet. The Wall remains empty... for now. | Még nincs kudarc. A fal üres... egyelőre. |
| `wallOfShame.events` | Events ({{count}}) | Események ({{count}}) |
| `wallOfShame.success` | ✓ Success | ✓ Siker |
| `wallOfShame.fail` | ✗ Fail | ✗ Kudarc |
| `wallOfShame.reason.attention` | Lost Attention | Figyelem elvesztése |
| `wallOfShame.reason.buttons` | Button Tampering | Gombok piszkálása |
| `wallOfShame.reason.event` | Critical Event | Kritikus Esemény |
| `wallOfShame.reason.exit` | Abandoned Ship | Hajó elhagyása |
| `wallOfShame.reason.success` ⭐ | Arrived | Megérkezett |
| `wallOfShame.reason.unknown` | Unknown | Ismeretlen |
| `wallOfShame.stat.total` | Total | Összesen |
| `wallOfShame.stat.solved` | Solved | Megoldott |
| `wallOfShame.stat.failed` | Failed | Elbukott |
| `wallOfShame.stats.totalMissions` ⭐ | Total Missions | Összes küldetés |
| `wallOfShame.stats.totalFailures` | Total Failures | Összes kudarc |
| `wallOfShame.stats.totalSuccesses` ⭐ | Successful | Sikeres |
| `wallOfShame.stats.successRate` ⭐ | Success Rate | Sikerráta |
| `wallOfShame.stats.totalDistance` ⭐⭐ | Total Distance | Teljes távolság |
| `wallOfShame.stats.mostCommonDeath` | Most Common Cause | Gyakori halálok |
| `wallOfShame.stats.mostUsedShip` | Most Used Ship | Legtöbbet használt hajó |
| `wallOfShame.stats.longestService` | Longest Service | Leghosszabb szolgálat |

> ⭐ = 1. bővítés (SuccessRecord + debug); ⭐⭐ = 2. bővítés (travelYears, rewardCredits, totalDistance, failure debug)

---

## 5. Kockázatok / figyelmeztetések

### 5.1 Regresszió kockázatok

- **Kudarcok:** a `recordFailure()` csak akkor fut, ha `gamePhase === "crewLost"` — nem hoz létre hamis rekordokat
- **Sikerek:** a `recordMissionComplete()` csak akkor fut, ha `remainingYears <= 0` és `destination` létezik — nem hoz létre hamis siker rekordokat
- **Debug:** az `addDummySuccessRecord()` csak debug módban érhető el a `DebugEventBar`-ban

### 5.2 Teljesítmény

- A failure + success rekordok száma korlátlan lehet → érdemes lehet később limitet bevezetni
- A Szégyenfal csak akkor mountolódik, amikor a játékos rákattint — nincs hatása a játékmenetre
- ~~Mindkét adatsor localStorage-ben perzisztálódik (Zustand persist)~~ → **R. blokk (2026-07-28): egyik sem perzisztálódik.** A lista RTDB-ből tölt, ezért a képernyő megnyitása után **pár száz ms késéssel** jelenik meg. Ez tudatosan vállalt ár az adatszivárgás kiküszöböléséért.
- Barát módban **négy** párhuzamos `onValue` subscription fut (2 új út + 2 legacy). Ez a fal képernyő élettartamára korlátozódik, és a legacy ág idővel elhal (lásd 5.4).

### 5.3 Biztonság (frissítve — 2026-07-28, O./P./Q. blokk)

- A fal adatai a top-level **`walls/{uid}`** node alatt vannak. Olvasás: **tulajdonos** (`$uid == auth.uid`), **`device_map` tulajdonos** (vendég), vagy **barát** (`friends/{auth.uid}/{$uid} === true`). Írás (`failures`/`successes`): csak tulajdonos vagy `device_map` tulajdonos.
- **A success rekordok IS RTDB-be kerülnek** (`saveSuccessRecord`, M. blokk) — a terv korábbi „csak localStorage" állítása **elavult**, és a biztonsági felület is ennek megfelelően értékelendő: a barát a sikereket **és** a kudarcokat is látja.
- Nincs érzékeny adat a failure/success rekordokban (hajónév, célpont, időbélyegek, eseménynapló).
- **Írás-szigorúság:** a `walls/$uid/failures|successes` írását senki nem végezheti más nevében — a barát-grant **kizárólag olvasási**.
- A legacy `users/{uid}/failures|successes` szabályok **maradnak** olvashatóak a barátoknak (kaszkádolás miatt a `users/$key/.read: false` nem vonja vissza a gyerek-szintű grantet, [[013-social-multiplayer]] L. blokk) — a fallback olvasás enélkül nem működne.
- **Néma megtagadás elkerülése:** minden fal-subscription rendelkezik error callbackkel; hiba esetén **üres lista** megy vissza, nem marad el a callback. Enélkül egy `PERMISSION_DENIED` megkülönböztethetetlen lenne az „üres fal"-tól, és a UI örökre a betöltési/üres állapotban ragadna.

### 5.4 Migrációs kockázatok (2026-07-28)

- **A `migrateWallData` csak a tulajdonos saját faltárának megnyitásakor fut.** Aki soha nem nyitja meg a saját falát, annak az adata a legacy úton marad → a barát csak a **fallback olvasás** miatt látja. A legacy ág **nem törölhető**, amíg minden aktív user át nem migrált.
- **Idempotencia:** a migráció csak akkor ír, ha az új út **üres** és a régin **van** adat; a másolás **változatlan `id`**-vel történik → a `mergeById` félig migrált állapotban sem duplikál.
- **Vendég→Google váltás:** a fal a `migrateGuestData()`-ban kerül át (1.8). Ha ez elmarad, a vendég fala láthatatlan marad, mert a barát-rendszer `auth.uid`-del kulcsol. Ezért migrál a `"blocked"` (már claimelt) ágon is, és ezért van külön retry az `executeAtomicUpdate` fallbackben.
- **Teszt-izoláció:** a `userData.test.ts` `mockGet`-je `beforeEach`-ben **explicit alapértelmezettet** kap — korábban egy korábbi teszt implementációja átszivárgott a többire, ami álzöld/álpiros eredményeket okozhatott.

### 5.5 Identitásváltás és lokális gyorsítótár (2026-07-28, R. blokk)

- **A localStorage a böngészőhöz tartozik, nem a felhasználóhoz.** A `space-travel-game` kulcson minden fiók osztozik → bármely fiókhoz kötött mező perzisztálása **adatszivárgás** a következő felhasználó felé. Ez a fal esetében **adatvédelmi**, a statisztikák esetében **helyességi** hiba is volt.
- **Az append-only merge a legveszélyesebb minta.** A `mergeById` sosem **cserél**, csak hozzáfűz — ezért az idegen rekordokat semmilyen későbbi RTDB-betöltés nem takarította el. Az ilyen mezőknél a takarítás **nem opcionális**, hanem az egyetlen kiút.
- **A takarítás nem írhat RTDB-be.** A `clearUserScopedData` szándékosan nem hívja a `resetShop()`-ot: az a resetet a szerverre is kiírná, és az **épp elhagyott** fiók adatát rongálná. Ugyanez vonatkozik minden jövőbeli „kijelentkezéskor ürítsd" logikára.
- **A vendég→Google váltás nem identitásváltás.** Ugyanaz az ember; a `migrateGuestData` ([[010-firebase-guest-merge-single-gate]]) épp ekkor viszi át a falát is (Q. blokk, 1.8). Ha ekkor törölnénk, a frissen migrált fal tűnne el a képernyőről.
- **Az auth aszinkron feloldódása nem lehet „váltás".** A figyelő kiindulási értéke a store **aktuális** állapotából jön, nem `null`-ról indul — enélkül minden oldalfrissítés törlésnek látszana. Ugyanaz a hibaosztály, mint a [[013-social-multiplayer]] vendég-őrénél (`status === "loading"` nem vendég).
- **Késleltetett első render:** a fal az `empty state`-tel indul, és a subscription **error callbackje** (O. blokk) biztosítja, hogy a „még tölt" ne váljon megkülönböztethetetlenné a néma `PERMISSION_DENIED`-től.

### 5.6 Az RTDB nem tárol üres tömböt (2026-07-28, S. blokk)

- **`events: []` → az `events` kulcs hiányzik a visszaolvasáskor.** Az RTDB az üres tömböt/objektumot **nem tárolja**, a mező egyszerűen nincs a snapshotban. Minden `record.events.length` jellegű hívás ilyenkor `TypeError`-t dob. Ugyanez vonatkozik minden jövőbeli tömb-mezőre a fal-rekordokban.
- **A persist kivezetése látens hibát hozott felszínre.** A localStorage megőrizte a `[]`-t, ezért a hiba addig rejtve maradt, amíg a fal onnan (is) renderelt. **Tanulság:** egy tárolási réteg eltávolítása nem szemantikamentes lépés — az eddig „elnyelt" adatmodell-eltérések azonnal láthatóvá válnak. Perzisztálás kivezetésekor **végig kell nézni**, mely mezők jöhetnek hiányzóként a szerverről.
- **Két rétegű védelem.** A normalizálás a `subscribeWallRecords`-ban történik (minden RTDB-ből jövő rekordra), a `FailureEntry` / `SuccessEntry` pedig **defenzíven** is `record.events ?? []`-t használ — a store-ba lokálisan generált, debug- és legacy-merge úton is kerülhet rekord.
- **Típusszintű kikényszerítés:** a `subscribeWallRecords` generikus paramétere `T extends { id: string; events: EventLogEntry[] }` — így a normalizálandó mezők jelenléte a helperben ellenőrzött, nem konvenció kérdése.
- **`formatYears` precedens:** ugyanez a hibaosztály korábban a `travelYears`-nél jelentkezett (N. blokk null guard). A fal-rekordok **minden** mezőjét „opcionálisként" kell kezelni a rendereléskor, mert régi rekordok és RTDB-sajátosságok is hiányt okozhatnak.

---

## 6. Kész definíció

### Alap (eredeti)
- Főmenüből elérhető "Szégyenfal" gomb
- A játékos minden elbukott küldetése rögzítésre kerül: hajó, cél, indítás ideje, kudarc ideje, szolgálati idő, halálok
- Az eseményrendszer minden eseménye naplózva (típus + siker/kudarc)
- Firebase RTDB szinkron bejelentkezett felhasználók számára
- Díszes tabló nézet vörös akcentusokkal
- Összesítő statisztikák a tetején
- Collapsible esemény részletek a generikus Collapse komponenssel
- Nincs törlési lehetőség — a szégyen örök

### Bővítés (2026-07-28) — Sikeres küldetések
- **`SuccessRecord`** típus: `completedAt` mezővel (nem `failedAt`), `crewLostReason` nélkül
- **`recordMissionComplete()`** action a store-ban, meghívva App.tsx-ből amikor `remainingYears <= 0`
- **`SuccessEntry`** (🏆 trófea) a WallOfShame-ban: zöld gradient, "Arrived" badge, collapsible event részletek
- **Statisztikák kibővítve:** totalMissions, totalFailures, totalSuccesses, successRate
- **Debug gomb:** `🎉 Arrival` a `DebugEventBar`-ban, `addDummySuccessRecord()` action-t hív
- **CSS:** `.entrySuccess` (zöld border/gradient), `.reasonSuccess` zöld badge, `.btnSuccess` zöld gomb
- **i18n:** 5 új kulcs mind az 5 nyelven
- **Tárolás:** ~~csak localStorage (nincs RTDB szinkron a sikerekhez)~~ → **RTDB + localStorage** (M. blokk: `saveSuccessRecord` / `subscribeSuccesses`; P. blokk: a self-mód betöltés is olvassa)
- `tsc --noEmit` ✅ — tiszta

### Bővítés (2026-07-28) — `walls/{uid}` útvonal, vendég-fal, legacy fallback (O./P./Q. blokk)

- A fal adatai a top-level **`walls/{uid}/failures|successes`** node alatt élnek; a `walls/$uid` `.read` a **tulajdonost**, a **`device_map` tulajdonost** és a **barátot** engedi, az írás csak az első kettőt.
- **`migrateWallData(uid)`** egyszeri, idempotens migrációt végez a legacy `users/{uid}/…` útról, amikor a tulajdonos megnyitja a **saját** falát; a rekord `id`-je változatlan marad.
- **Saját fal betöltése:** self módban a `subscribeFailures` **és** a `subscribeSuccesses` is fut; a rekordok `id` alapú dedupe merge-dzsel kerülnek a store-ba (failures `failedAt`, successes `completedAt` szerint csökkenően). **Új gépen/böngészőben sem vesznek el a sikerek.**
- **Barát fala:** négy subscription (`walls` + legacy × failures/successes) + `mergeById` dedup — a még nem migrált barát fala is látszik ([[013-social-multiplayer]] L. blokk).
- **Vendég (anonymous) fal:** a `device_map` tulajdonlás elfogadása után a vendégnek **is íródik** fal (korábban minden mentés `PERMISSION_DENIED` volt); guest→Google váltáskor a `migrateGuestData()` a falat is átviszi eredeti push ID-kkal, a `"blocked"` merge-ágon is, a guest user node hiánya esetén is, és a fő atomi írás bukásakor külön retryval.
- **Közös helper:** `subscribeWallRecords<T>()` — push-ID → tömb, `id` normalizálás, csökkenő rendezés, **error callback → üres lista** (nincs néma megtagadás).
- **Tesztek:** 2 új guest-fal migrációs eset; a `mockGet` explicit alapértelmezettel indul `beforeEach`-ben (teszt-izoláció).
- **Ellenőrzés:** `tsc --noEmit` tiszta · `npm run test` **77/77** zöld · `npm run build` sikeres.

### Bővítés (2026-07-28) — identitásváltáskori adatszivárgás megszüntetése (R. blokk)

- **Kijelentkezés vagy fiókváltás után a fal üres**, majd az új fiók RTDB-adataival töltődik fel. Az előző user küldetései sem a listában, sem a **statisztikákban** (sikerráta, leggyakoribb halálok, összes utazott év, leghosszabb szolgálat) nem jelennek meg.
- **A `failureRecords` / `successRecords` / `bestServiceSeconds` nem perzisztálódik localStorage-ba** — egyetlen forrás az RTDB (`walls/{rtdbKey}`, `users/{rtdbKey}/stats`).
- **Kétrétegű takarítás:** `useGameStore.clearUserScopedData()` + `src/state/clearUserScopedData.ts` (shop lokális állapot is), **RTDB-írás nélkül** — az elhagyott fiók szerveroldali adata érintetlen.
- **Az identitás-figyelő csak a regisztrált uid váltását tekinti fiókváltásnak:** vendég→Google **nem** törli az adatot, az oldalfrissítés sem.
- **Az eszközszintű beállítások megmaradnak** (hangerő, nyelv, nehézség, kamera-hozzájárulás).
- **Ellenőrzés:** `tsc --noEmit` tiszta · `npm run test` **77/77** zöld · `npm run build` sikeres.

### Bővítés (2026-07-28) — `record.events` normalizálás (S. blokk)

- **A szégyenfal nem omlik össze hiányzó `events` mezőn.** Az RTDB nem tárol üres tömböt, ezért az `events: []`-vel mentett rekord az `events` kulcs nélkül tér vissza — a `subscribeWallRecords` `events: record.events ?? []`-re normalizál, a `FailureEntry` / `SuccessEntry` pedig defenzíven is ezt teszi.
- **A `subscribeWallRecords` generikusa `T extends { id: string; events: EventLogEntry[] }`** — a normalizálandó mezők típusszinten kötöttek.
- **Ellenőrzés:** `tsc --noEmit` tiszta · `npm run test` **77/77** zöld · `npm run build` sikeres · i18n paritás **366/366**.

---

## 7. Kapcsolódó tervek

- [[013-social-multiplayer]] — a barát szégyenfala (I. blokk) ezt a képernyőt használja újra read-only módban, és a `walls/{uid}` barát-olvasási szabályára épül. A legacy fallback olvasás (013 L. blokk) az O. blokk migrációjának hatóköri korlátját (csak a tulajdonos migrál) fedi le.
- [[010-firebase-guest-merge-single-gate]] — a `migrateGuestData()` itt bővült a `walls/{deviceId}` → `walls/{targetUid}` áthelyezéssel; a falrekordok **nem valuta**, ezért a `guestMergeClaimed` kapu **nem** blokkolja őket.
- [[009-firebase-identity-split-bugfix]] — a `getRtdbKey()` invariáns (bejelentkezve `auth.uid`, vendégként `deviceId`) határozza meg, melyik `walls/{uid}` node-ra írunk; a `device_map`-alapú tulajdonlás ugyanaz a minta, mint a `users` ágon.
- [[007-state-persist-page-refresh]] — ~~a `failureRecords`/`successRecords` persist továbbra is működik, de már **kiegészítő** szerepben~~ → **az R. blokk (2026-07-28) óta a persist megszűnt**: a 007 G. blokkja mondja ki az elvet („localStorage-ban csak eszközszintű adat"), és ott él a `clearUserScopedData` teljes leírása. Az RTDB az egyetlen igazságforrás, a merge `id` alapján dedupál.
- [[002-ingame-shop-frontend]] — ugyanaz az adatszivárgás érintette a `purchaseHistory`-t; ott a javítás **plusz** egy szerveroldali ág bevezetésével járt (`users/{uid}/purchases`, E. rész).
- [[011-difficulty-event-system]] — az eseménynapló forrása (`resolveEvent`). A fal `EVENT_EMOJI` térképe a `doom` pszeudo-eseményt is lefedi (💀), és az `EventLogEntry[]` üres esetét az S. blokk normalizálja.
- [[001-main-menu-settings]] — a főmenü belépési pont.