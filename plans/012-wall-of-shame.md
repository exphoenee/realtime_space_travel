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
  - 007-state-persist-page-refresh
tags:
  - wall-of-shame
  - ui
  - stats
  - firebase
  - persistence
  - i18n
  - success-records
  - debug
---

# Szégyenfal – küldetésnapló (kudarcok és sikerek)

**Cél:** A főmenüből elérhető "Szégyenfal" képernyő, amely naplózza a játékos összes küldetését — sikereit és kudarcait egyaránt. Kudarc esetén: melyik hajóval indult, hová tartott, mennyi ideig bírta, milyen eseményekkel találkozott és miért vesztette el a legénységet. Siker esetén: hajó, cél, út időtartam, eseménynapló. Az adatok Firebase RTDB-ben tárolódnak (kudarcok), a sikerek localStorage-ba perzisztálódnak. Debug módban egy gombnyomással szimulálható sikeres érkezés.

---

## Döntések (egyeztetve)

| Kérdés | Választás |
|--------|-----------|
| Tárolás (kudarc) | **Firebase RTDB** (`users/{uid}/failures/{pushId}`) + localStorage (Zustand persist) |
| Tárolás (siker) | **Firebase RTDB** (`users/{uid}/successes/{pushId}`) + localStorage (Zustand persist) |
| Kinézet | **Díszfal / tabló** stílus — vörös akcentusos "sírkövek" a kudarcoknak, zöld akcentusos "trófeák" a sikereknek |
| Tartalom | Alap adatok (hajó, cél, idő, ok, **travelYears**) + collapsible részletek (események) + **rewardCredits** a sikereknél |
| Törlés | **Nincs** — a szégyen örök, a dicsőség is |
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
- [x] `partialize` — `failureRecords` perzisztálása localStorage-ba

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

### 1.6 Firebase RTDB struktúra

```
users/{uid}/
  failures/
    {pushId}:
      id: "fail-..."
      shipName: "Nomad X1"
      destinationName: "Proxima Centauri"
      launchedAt: 1234567890
      failedAt: 1234567899
      serviceSeconds: 342
      crewLostReason: "attention"
      events:
        - type: "horn"
          result: "success"
          timestamp: 1234567895
```

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

---

## 3. Függőségek

- **Előfeltétel:** [[011-difficulty-event-system]] — a `missionEventLog` az eseményrendszer `resolveEvent`-jében töltődik
- **Érinti:** [[001-main-menu-settings]] — főmenü gomb
- **Érinti:** [[007-state-persist-page-refresh]] — `failureRecords` + `successRecords` localStorage perzisztálás
- **Érinti:** aktuális implementációs kör — a `recordMissionComplete()` az App.tsx `remainingYears <= 0` ágában került meghívásra

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
- Mindkét adatsor localStorage-ben perzisztálódik (Zustand persist)

### 5.3 Biztonság

- A Firebase RTDB security rules jelenleg lehetővé teszik a `users/{uid}/failures` írást/olvasást a hitelesített felhasználók számára
- Nincs érzékeny adat a failure/success rekordokban
- A success rekordok nem kerülnek RTDB-be (csak localStorage), így nincs extra biztonsági felület

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
- **Tárolás:** csak localStorage (nincs RTDB szinkron a sikerekhez)
- `tsc --noEmit` ✅ — tiszta