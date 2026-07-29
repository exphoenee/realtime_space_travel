---
title: "Nehézségi szintek + eseményrendszer – random interakciók a játékban"
slug: 011-difficulty-event-system
type: plan
category: core
status: implemented
implemented: true
implemented_at: "2026-07-29"
created_at: "2026-07-27"
updated_at: "2026-07-29"  # lezárva: az event.doom holt kulcstérkép-bejegyzés törölve (K. blokk)
author: exphoenee
step: 11
phases: []
dependencies:
  - 001-main-menu-settings
related_plans:
  - 007-state-persist-page-refresh
tags:
  - difficulty
  - events
  - gameplay
  - debug
  - ui
  - i18n
  - doom
  - documentation
---

# Nehézségi szintek + eseményrendszer – random interakciók a játékban

**Cél:** A meglévő `difficulty` beállítás (`easy` / `medium` / `hard`) bekötése a játékmenetbe rendszertelen időközönként felbukkanó eseményekkel, amelyek interakciót kívánnak a játékostól. Debug módban az események gyorsabban következnek be, és egy gombsorral azonnal triggerelhetők. Easy módban a jelenlegi játékmenet marad (nincs extra esemény).

> ⚠️ **Ez a terv a jelenlegi játékmenetet bővíti, nem függ Stripe/auth backendtől.** A `difficulty` mező már létezik a `useUIStore`-ban, de nincs bekötve. Az események kliensoldaliak (nincs RTDB-függőség).

---

## Döntések (egyeztetve)

| Kérdés | Választás |
|--------|-----------|
| Elhelyezés a roadmapen | **11. lépés** — a 010 után, a 013-social-multiplayer előtt. Független a Stripe/auth backendtől, párhuzamosan is dolgozható. |
| Események UI-ja | **Külön modal** — minden esemény egy központi `EventModal` komponensben jelenik meg, ami áttetsző háttérrel ráborul a dashboardra. |
| Büntetés rossz válasz esetén | **Vegyes:** kis eseményeknél (pl. kürt, aszteroida) időbüntetés (+útidő), ritka eseményeknél (napkitörés) a meglévő `crewLost` mechanika aktiválódik. |
| Debug mód event sebesség | Az események időközei 3× gyorsabbak (pl. 3-5 perc → 1-1.6 perc). |
| Space rover öröklése | A rover nem szerezhető meg örökre — csak az adott küldetésben használható. |

---

## ✅ Haladás (TODO)

> Jelölés: `[ ]` hátravan · `[~]` folyamatban · `[x]` kész.

**A. Esemény rendszer alap architektúra**
- [x] `src/hooks/useEventSystem.ts` — **új hook**: esemény ütemezés, random időközök, minimum 3-5 perc bármely két esemény között
- [x] Esemény típusok: `EventDefinition` interface (id, type, difficulty, minInterval, duration, penalty, i18nKey)
- [x] `useGameStore.ts` — esemény állapot: +`activeEvent: EventInstance | null`, +`eventPenaltyYears: number`, +`triggerEvent(eventId)`, +`resolveEvent(success: boolean)`, +`dismissEvent()`
- [x] Esemény generálás medium/hard módban (easy = nincs generálás)
- [x] `isPaused` / `isAttentionLost` állapotban az eseményóra **nem** ketyeg

**B. EventModal UI komponens**
- [x] `src/components/features/EventModal.tsx` + `EventModal.module.css` — központi modal, ráborul a dashboardra
- [x] Esemény típusonként eltérő tartalom: gombos interakció, időzített gombnyomás, döntési fa
- [x] Animáció: slide-in/fade-in belépéskor, vészjelző keret (piros pulzálás) hard módban
- [x] Hamis instrukciók kezelése hard módban: az EventModal trükkös, de logikus szöveggel jelenik meg

**C. Esemény típusok implementációja**
- [x] **Kürtszó (`horn`):** egyszerű gombnyomás, vagy időzített (nyomva tartás egy pillanatig), vagy több lépéses
- [x] **Mentőhajó átszállás (`rescue-transfer`):** felugró opció → másik műszerfalra vált (Dashboard tartalom váltás + cockpitVariant), új interakciók, a teljes út továbbra is az új hajó sebességéből számolva
- [x] **Aszteroida (`asteroid`):** üzenet a műszerfalon + figyelmeztető sáv, időben reagálni kell (gombnyomás); késés → +útidő
- [x] **Napkitörés (`solar-flare`):** ritka (10-20 percenként), kemény döntés; sikertelen → `crewLost`
- [x] **Űrajáró (`rover`):** felugró lehetőség a rover használatára; az adott küldetésben használható, nem szerezhető meg örökre
- [x] Minden esemény típushoz: siker-ág, kudarc-ág (időbüntetés vagy crewLost)
- [x] **Végzet (`doom`) — pszeudo-esemény (2026-07-28-i dokumentálás, lásd K. blokk):** nem interaktív esemény és **nem** a poolból jön; a `rescue-transfer` figyelmen kívül hagyása után a `scheduleDestruction(delayMs)` állítja be. Csak visszaszámlálásként létezik: `pendingDestructionAt` + `nextScheduledEvent = { eventType: "doom", triggerAt }`. Az `App.tsx` másodperces intervalluma a lejáratkor `crewLost` + `crewLostReason: "event"` állapotba visz.

**D. Esemény ütemezés logika**
- [x] Esemény pool medium módhoz: `horn`, `asteroid`, `rescue-transfer`, `rover` (3-5 percenként)
- [x] Esemény pool hard módhoz: medium események + `solar-flare` + hamis instrukciók
- [x] Ritka események (`solar-flare`, `rescue-transfer`): 10-20 percenként, de minimum 3-5 perc bármely más eseménytől
- [x] Hamis instrukciók hard módban: 5-10 percenként, de 3-5 perc távolság bármely más eseménytől; logikus, trükkös szöveg, nem random
- [x] Minimum 3-5 perc gap minden esemény között (a legutóbbi esemény + random 3-5 perc)
- [x] Az ütemező egyetlen `setTimeout` láncon fut (nincs párhuzamos timer)
- [x] `useEffect` cleanup: az ütemező leáll, ha a játék fázis elhagyja a `playing`-et

**E. Debug mód — gyorsított események + trigger gombsor**
- [x] `VITE_DEBUG_MODE=true` esetén az események időközei 3× gyorsabbak
- [x] `src/components/features/DebugEventBar.tsx` + `DebugEventBar.module.css` — gombsor a jobb felső sarokban
- [x] Minden esemény típushoz egy gomb: `Horn`, `Asteroid`, `Rescue`, `Flare`, `Rover`, `Fake`
- [x] Debug gombsor csak `VITE_DEBUG_MODE=true` és `gamePhase === "playing"` esetén látszik
- [x] Gombok tooltip: "Trigger [esemény] (debug)"

**F. Nehézségi szint bekötése**
- [x] `useUIStore.difficulty` meglévő mező — nincs változtatás, már perzisztál
- [x] **Easy:** `useEventSystem` nem generál semmit — a meglévő figyelem/arcfigyelés mechanika fut
- [x] **Medium:** események 3-5 percenként; nincs hamis instrukció
- [x] **Hard:** események 3-5 percenként + hamis instrukciók 5-10 percenként
- [x] Nehézség váltás (Settings-ben) azonnal érvényesül: ha `gamePhase !== "playing"`, nincs hatása; ha `playing`, az ütemező újraindul az új paraméterekkel

**G. Dashboard integráció**
- [x] `Dashboard.tsx` — EventModal overlay megjelenítése, ha `activeEvent !== null`
- [x] `Dashboard.tsx` — mentőhajó átszálláskor másik cockpit kép + eltérő műszerfal tartalom (cockpitVariant)
- [x] `Dashboard.tsx` — aszteroida esetén figyelmeztető sáv/panel (asteroidWarning)
- [x] `App.tsx` — `DebugEventBar` megjelenítése, ha debug mód + playing

**H. i18n — ÚJ kulcsok mind az 5 nyelven (`en`, `hu`, `fr`, `de`, `es`)**
- [x] `event.horn.title` / `.desc` / `.success` / `.fail`
- [x] `event.asteroid.title` / `.desc` / `.success` / `.fail`
- [x] `event.rescueTransfer.title` / `.desc` / `.success` / `.fail`
- [x] `event.solarFlare.title` / `.desc` / `.success` / `.fail`
- [x] `event.rover.title` / `.desc` / `.success` / `.fail`
- [x] `event.fake.*` / `.title` / `.desc` / `.trapAction` (hard mód, trükkös szövegek)
- [x] `event.penalty.timeAdded` / `event.penalty.crewLost`
- [x] `event.*` (timeLeft, confirm, transfer, activate.shields, deploy, ignore, evasiveManeuver, fakeBadge)
- [x] `event.rescueTransfer.active` / `.rescueShip` — Dashboard mentőhajó banner + cockpit alt
- [x] Teljes paritás mind az 5 fájlban

**I. Tesztek**
- [x] `src/hooks/useEventSystem.test.ts` — 15 teszt: easy → nincs esemény; triggerManualEvent minden típushoz; medium/hard pool; isPaused/isAttentionLost szüneteltetés; EVENT_DEFINITIONS validáció
- [x] `src/state/useGameStore.test.ts` — bővítés: 15 teszt: `triggerEvent` (3), `resolveEvent` (7), `dismissEvent`, `startMission` reset, `resetToMenu` cleanup, penalty accumulation
- [x] `tsc --noEmit` ✅ + `npm run test` ✅ (40/40) + `npm run build` — zöld

**J. Dokumentáció**
- [x] `security.rules.json` — nincs változás (nem érint Firebase-t)
- [x] `.claude/lessons-learned.md` — bejegyzés az eseményrendszer architektúráról (isAttentionLost guard bug, setTimeout lánc, determinisztikus tesztelés, Dashboard integráció)

**K. `doom` — a hetedik `EventType` (utólagos dokumentálás, 2026-07-28)**

> A megvalósítás során egy hetedik eseménytípus is bekerült a kódba, amit a terv eddig **nem említett**. Ez a blokk **nem új munka** — a meglévő implementációt vezeti át a tervbe, hogy az fedje a valóságot.

- [x] `src/types/index.ts` — `EventType` bővítve: `"horn" | "asteroid" | "rescue-transfer" | "solar-flare" | "rover" | "fake-instruction" | "doom"`
- [x] `useGameStore` — +`pendingDestructionAt: number | null`, +`scheduleDestruction(delayMs)`, +`cancelDestruction()`
- [x] `scheduleDestruction` beállítja a `pendingDestructionAt`-ot **és** a `nextScheduledEvent`-et `{ eventType: "doom", triggerAt: pendingAt }` értékre (a debug sáv innen olvassa a visszaszámlálást)
- [x] `EventModal` — a `rescue-transfer` **figyelmen kívül hagyása** (ignore) `resolveEvent(false)` + esemény-napló bejegyzés után `scheduleDestruction(delayMs)`-t hív
- [x] `useEventSystem` — ha `pendingDestructionAt` be van állítva, **nem ütemez** új eseményt (a visszaszámlálás alatt nincs más esemény)
- [x] `App.tsx` — másodperces `setInterval`: ha `Date.now() >= pendingDestructionAt` és `gamePhase === "playing"` → `transitionTo("crewLost")` + `setCrewLostReason("event")` + `cancelDestruction()`
- [x] `DebugEventBar` — `eventLabel("doom") → "☠️ Doom"` (a következő ütemezett esemény kijelzésében)
- [x] `resetToMenu` / `startMission` — a `pendingDestructionAt` nullázódik (nem szivárog át küldetések között)
- [x] `WallOfShame` — `EVENT_EMOJI` térkép `doom: "💀"` (védekező teljesség; a naplóba a `rescue-transfer` fail kerül, lásd 5.5)
- [x] **`event.doom` holt kulcstérkép-bejegyzés törölve (2026-07-29, (a) opció).** Az `EventModal.tsx` `I18N_MAP`-jából kikerült a `doom: "event.doom"` bejegyzés, a térkép típusa `Record<EventType, string>` → `Partial<Record<EventType, string>>`. A hívási hely (`I18N_MAP[event.id] ?? "event.horn"`) már eleve tartalmazott fallbacket, így nem kellett módosítani. Az `event.doom` i18n kulcsokat **szándékosan nem pótoltuk**: a `doom` sosem éri el ezt a modalt — csak `nextScheduledEvent.eventType` jelölő, amit a `scheduleDestruction()` ír (debug sáv visszaszámláló + szégyenfal 💀 ikon), a `triggerEvent` pedig kizárólag `EVENT_DEFINITIONS`-beli definícióval hívódik, és a `doom` nincs benne. Az indoklás kommentben is rögzítve a fájlban. Ellenőrzés: `tsc --noEmit` tiszta, `npm run test` 77/77 zöld.

---

## 1. Architektúra

### 1.1 Esemény rendszer áttekintés

```
useEventSystem (hook)
  │
  ├── Timer lánc (setTimeout)
  │     ├── Easy: NEM indul
  │     ├── Medium: 3-5 percenként random esemény
  │     └── Hard: 3-5 percenként + fake instruction 5-10 percenként
  │
  ├── useGameStore.triggerEvent(id) ──▶ activeEvent = { id, type, data }
  │                                           │
  │                                           ▼
  │                                     EventModal (overlay)
  │                                           │
  │                              ┌────────────┼────────────┐
  │                              ▼            ▼            ▼
  │                         Siker-ág    Kudarc-ág    Elutasítás
  │                         (időbünt.)  (crewLost)   (időbünt.)
  │                              │            │            │
  │                              ▼            ▼            ▼
  │                         useGameStore.resolveEvent(success)
  │
  └── useGameStore.isPaused / isAttentionLost ──▶ timer szünetel
```

### 1.2 Adatmodellek

```ts
interface EventDefinition {
  id: string;
  // A "doom" NEM szerepel EventDefinition-ként — pszeudo-esemény, lásd 1.6
  type: EventType;          // "horn" | "asteroid" | "rescue-transfer" | "solar-flare" | "rover" | "fake-instruction" | "doom"
  minDifficulty: Difficulty; // "medium" | "hard"
  minIntervalMs: number;    // minimum 180000 (3 perc)
  baseIntervalMs: number;   // 180000-300000 medium, 300000-600000 fake hard
  durationMs: number;       // meddig vár a játékos válaszára
  penaltyType: "time" | "crewLost";
  penaltyAmount: number;    // időbüntetés években (pl. 5-15)
  i18nKey: string;          // prefix a fordítási kulcshoz
  isRare: boolean;          // true = 10-20 percenként
}

interface EventInstance {
  id: string;
  definition: EventDefinition;
  triggeredAt: number;      // Date.now()
  data?: Record<string, unknown>; // esemény-specifikus adatok
}
```

### 1.3 Esemény ütemező algoritmus

```
1. nextEventTime = Date.now() + random(baseIntervalMs ± jitter)
   A jitter: medium esetén 3-5 perc (180000-300000 ms),
             hard esetén 3-5 perc eseményekre,
             fake instruction 5-10 perc (300000-600000 ms)

2. setTimeout(nextEventTime):
   a. Kiválaszt egy eseményt a poolból (random, de nem ismétlődő egymás után)
   b. rare események: 10-20% eséllyel, ha a legutóbbi rare óta eltelt 10-20 perc
   c. useGameStore.triggerEvent(selectedEvent.id)

3. A játékos válasza után:
   a. Sikeres → timer folytatódik, nextEventTime = now + random gap
   b. Sikertelen → penalty alkalmazva, timer folytatódik
   c. Időtúllépés → automatikus kudarc

4. Minimum gap enforcement:
   nextEventTime = max(nextEventTime, lastEventTime + minIntervalMs)
   ahol minIntervalMs = 180000 (3 perc)
```

### 1.4 Hamis instrukciók hard módban

A hamis instrukciók nem véletlenszerű szövegek, hanem a képernyőn lévő jelzésekből logikusan kikövetkeztethető trükkös utasítások. Példa:

- A dashboardon egy "⚠️ MAGNETIC STORM" felirat jelenik meg → a hamis instrukció: "Press EMERGENCY SHUTDOWN (red button)" — miközben a helyes válasz a "SHIELD ACTIVATE (blue button)", amit a képernyő sarkában lévő kis ikon jelez.
- A hamis instrukció UI-ja megegyezik a valódi eseményekével, csak a szöveg és a gomb címke félrevezető.

### 1.5 Mentőhajó átszállás

A mentőhajó esemény működése:
1. Felugró modal: "Mentőhajó érkezett! Átszállsz?" → [Igen] [Nem]
2. Igen esetén: a Dashboard egy másik cockpit képre vált (másik `shipImageUrl`), és új/módosult műszerfal elemek jelennek meg
3. Az út továbbra is az **új hajó sebességéből** számolódik (a mentőhajó sebessége megegyezik az aktuális hajóéval, vagy egy előre definiált érték)
4. Az átszállás után `event.rescueTransfer.success` szöveg jelenik meg, majd a játékos visszakapja az eredeti műszerfalát
5. **Ha a játékos figyelmen kívül hagyja / elutasítja** → a hajó sorsa megpecsételődik: `scheduleDestruction(delayMs)` → **`doom` visszaszámlálás** (1.6)

### 1.6 `doom` — a végzet-visszaszámlálás (pszeudo-esemény, 2026-07-28-i dokumentálás)

A `doom` a hetedik `EventType`, de **nem interaktív esemény**: nincs `EventDefinition`-je, nincs a poolban, és **soha nem lesz `activeEvent`**. Kizárólag a mentőhajó elutasítása utáni **halasztott pusztulás** megjelenítésére és követésére szolgál.

```
EventModal — rescue-transfer „Ignore"
        │  resolveEvent(false) + missionEventLog += { type: "rescue-transfer", result: "fail" }
        ▼
useGameStore.scheduleDestruction(delayMs)
        ├── pendingDestructionAt = Date.now() + delayMs
        └── nextScheduledEvent  = { eventType: "doom", triggerAt: pendingDestructionAt }
                    │                                   │
                    │                                   └──▶ DebugEventBar: „☠️ Doom" + visszaszámlálás
                    ▼
useEventSystem: ha pendingDestructionAt !== null → ÚJ ESEMÉNYT NEM ÜTEMEZ
                    │
                    ▼
App.tsx (1 mp-es interval): Date.now() >= pendingDestructionAt && gamePhase === "playing"
        └──▶ transitionTo("crewLost") + setCrewLostReason("event") + cancelDestruction()
```

- **Miért külön `EventType`?** Hogy a `nextScheduledEvent` (debug kijelző) egységesen tudja ábrázolni: „mi jön legközelebb" — akkor is, ha az nem esemény, hanem a vég.
- **Nem szivárog át küldetések közt:** a `startMission` és a `resetToMenu` is nullázza a `pendingDestructionAt`-ot.
- **Szégyenfal:** a naplóba a **`rescue-transfer` / fail** bejegyzés kerül (nem `doom`); a kudarc oka `crewLostReason: "event"`. A `WallOfShame` `EVENT_EMOJI` térképe védekezésből tartalmaz `doom: "💀"` bejegyzést ([[012-wall-of-shame]]).
- **i18n (lezárva, 2026-07-29):** az `EventModal` `I18N_MAP`-jában korábban szerepelt egy `doom: "event.doom"` bejegyzés, de az `event.doom` névtér egyetlen locale-ban sem létezett. Mivel a `doom` sosem renderelődik modalként, a bejegyzés **törölve** lett (a térkép típusa `Partial<Record<EventType, string>>`), az `event.doom` kulcsokat pedig szándékosan nem pótoltuk. A hívási hely `?? "event.horn"` fallbackje változatlan.

---

## 2. Fájlstruktúra

### Új fájlok
```
src/hooks/useEventSystem.ts                 # Esemény ütemező hook
src/components/features/EventModal.tsx       # Esemény modal
src/components/features/EventModal.module.css
src/components/features/DebugEventBar.tsx    # Debug gombsor
src/components/features/DebugEventBar.module.css
```

### Módosuló fájlok
```
src/types/index.ts                          # EventType: +"doom" (pszeudo-esemény, K. blokk)
src/state/useGameStore.ts                   # +activeEvent, +eventPenaltyYears, +triggerEvent, +resolveEvent, +dismissEvent
                                            # +pendingDestructionAt, +scheduleDestruction(), +cancelDestruction(),
                                            #  +nextScheduledEvent (a debug sáv „következő esemény" kijelzőjéhez)
src/components/features/Dashboard.tsx        # EventModal integráció, mentőhajó UI váltás, aszteroida figyelmeztetés
src/App.tsx                                  # DebugEventBar integráció; +1 mp-es interval a pendingDestructionAt
                                             #  lejáratára → crewLost + crewLostReason "event" (K. blokk)
src/hooks/useAttentionMonitor.ts            # Ha szükséges: esemény alatti figyelem kivétel
src/i18n/locales/{en,hu,fr,de,es}/translation.json  # ~15 új kulcs
```

### Tesztfájlok
```
src/hooks/useEventSystem.test.ts            # Ütemezés logika tesztek
```

---

## 3. Függőségek

- **Előfeltétel:** [[001-main-menu-settings]] — a `difficulty` mező a `useUIStore`-ban, a SettingsScreen nehézség választó
- **Független:** auth, Stripe, Firebase — az eseményrendszer teljesen kliensoldali
- **Érinti:** [[007-state-persist-page-refresh]] — az esemény állapot (`activeEvent`) nem perzisztálódik (a timer újraindul oldalfrissítéskor); a `pendingDestructionAt` sem — a `doom` visszaszámlálás oldalfrissítéskor **elvész**
- **Kiszolgálja:** [[012-wall-of-shame]] — a `missionEventLog` az itteni `resolveEvent`-ből töltődik; a fal `EVENT_EMOJI` térképe a `doom` típust is lefedi
- **Érinti:** [[013-social-multiplayer]] — a multiplayer event-kiosztás (F blokk) **csak interaktív** eseményeket oszthat ki; a `doom` pszeudo-esemény **nem** kerülhet a kiosztásba

---

## 4. i18n — ÚJ kulcsok (mind az 5 nyelv)

> Teljes paritás kötelező (`en`, `hu`, `fr`, `de`, `es`).

| Kulcs | en | hu |
|---|---|---|
| `event.horn.title` | Horn signal! | Kürtszó! |
| `event.horn.desc` | Press the button immediately! | Nyomd meg a gombot azonnal! |
| `event.horn.success` | Horn acknowledged | Kürt elfogadva |
| `event.horn.fail` | You missed the horn signal! | Elkéstél a kürtszóval! |
| `event.asteroid.title` | Asteroid on trajectory! | Aszteroida a pályán! |
| `event.asteroid.desc` | Evasive maneuver required! Change course now! | Kitérő manőver szükséges! Változtass irányt azonnal! |
| `event.asteroid.success` | Asteroid avoided | Aszteroida elkerülve |
| `event.asteroid.fail` | Collision! Travel time increased by {years} years | Ütközés! Az útidő {years} évvel megnőtt |
| `event.rescueTransfer.title` | Rescue ship detected! | Mentőhajó érzékelve! |
| `event.rescueTransfer.desc` | A rescue ship is nearby. Do you want to transfer? | Egy mentőhajó van a közelben. Átszállsz? |
| `event.rescueTransfer.success` | Successfully transferred to rescue ship | Sikeres átszállás a mentőhajóra |
| `event.rescueTransfer.fail` | Transfer failed — you missed the window | Az átszállás sikertelen — lekésted az ablakot |
| `event.solarFlare.title` | ⚠️ SOLAR FLARE WARNING ⚠️ | ⚠️ NAPKITÖRÉS FIGYELMEZTETÉS ⚠️ |
| `event.solarFlare.desc` | Critical: activate shields immediately! | Kritikus: aktiváld a pajzsokat azonnal! |
| `event.solarFlare.success` | Shields held — ship survived | Pajzsok kitartottak — a hajó túlélte |
| `event.solarFlare.fail` | The solar flare overwhelmed the ship. Crew lost! | A napkitörés elborította a hajót. A legénység odaveszett! |
| `event.rover.title` | Space rover available! | Űrajáró elérhető! |
| `event.rover.desc` | A rover is available for this mission. Deploy it? | Egy űrajáró elérhető ehhez a küldetéshez. Beveted? |
| `event.rover.success` | Rover deployed — bonus objective unlocked | Rover bevetve — bónusz feladat elérhető |
| `event.rover.fail` | Rover deployment failed | A rover bevetése sikertelen |
| `event.fake.horn` | Hold the EMERGENCY STOP button for 10 seconds | Tartsd lenyomva a VÉSZLEÁLLÍTÓ gombot 10 másodpercig |
| `event.fake.asteroid` | Ignore the asteroid — maintain current course | Hagyd figyelmen kívül az aszteroidát — tartsd az irányt |
| `event.fake.rescueTransfer` | Stay on current ship — the rescue ship is a trap | Maradj az aktuális hajón — a mentőhajó csapda |
| `event.penalty.timeAdded` | +{years} years added to travel time | +{years} év hozzáadva az útidőhöz |
| `event.penalty.crewLost` | Crew lost! | Legénység elveszett! |
| `event.confirm` | Confirm | Megerősítés |
| `event.transfer` | Transfer | Átszállás |
| `event.activate` | Activate | Aktiválás |
| `event.deploy` | Deploy | Bevetés |
| `event.ignore` | Ignore | Figyelmen kívül hagyás |

> ℹ️ **`event.doom` — nem készül (lezárva 2026-07-29, K. blokk).** Az `EventModal` kulcstérképéből a `doom: "event.doom"` bejegyzés **törölve**; az `event.doom.title` / `.desc` kulcsokat **szándékosan nem pótoltuk**, mert a `doom` sosem lesz `activeEvent`. Emlékeztető a jövőre: a kulcsparitás-ellenőrzés a **mindenhonnan** hiányzó kulcsot nem találja meg ([[002-ingame-shop-frontend]] G rész) — ezért kell az ilyen holt hivatkozást a kódból kivezetni, nem csak a fordításokat ellenőrizni.

---

## 5. Kockázatok / figyelmeztetések

### 5.1 Regresszió kockázatok

- **Dashboard módosítások:** a meglévő Dashboard funkciók (sebesség, idő, időjárás) nem sérülhetnek. Az EventModal overlay-ként jelenik meg, nem váltja ki a dashboard tartalmát (kivéve mentőhajó átszállás).
- **Timer race:** az esemény ütemező `setTimeout` lánca és a meglévő játék timer (`serviceSeconds`, `remainingYears`) között nincs versenyhelyzet — az esemény timer független.
- **StrictMode dupla mount:** a `useEffect` cleanup (`clearTimeout`) megakadályozza a dupla timer indulást.
- **Debug mód:** a debug gombsor csak `VITE_DEBUG_MODE=true` esetén jelenik meg — éles buildben nincs hatása.

### 5.2 Teljesítmény

- Az esemény ütemező egyetlen `setTimeout`-ot tart fenn egyszerre → elhanyagolható CPU hatás.
- Az EventModal csak akkor mountolódik, ha `activeEvent !== null`.
- A mentőhajó átszállásnál a Dashboard re-renderelődik (más cockpit kép), de ez ritka esemény → nem probléma.

### 5.3 UX kockázatok

- **Hard mód frusztráció:** a hamis instrukciók frusztrálóak lehetnek. A trükkös instrukcióknak logikusnak kell lenniük — a játékosnak a képernyőn lévő jelzésekből ki kell tudnia következtetni a helyes választ.
- **Esemény gyakoriság:** a 3-5 perces minimum gap biztosítja, hogy a játékos ne legyen túlterhelve. Medium módban ez átlagosan ~4 percenként egy eseményt jelent.
- **Ritka események:** a napkitörés (crewLost kockázattal) csak 10-20 percenként jön, így nem unfair.

### 5.4a `doom` — kockázatok és tanulságok (2026-07-28, K. blokk)

- **A terv és a kód eltérése önmagában kockázat.** A `doom` eseménytípus a megvalósítás során került be, de a terv C blokkja hét hónapig csak öt eseményt + fake-instructiont említett. Egy nem dokumentált típus a jövőbeli bővítéseknél (multiplayer event-kiosztás, [[013-social-multiplayer]] F blokk) **kihagyható vagy hibásan kezelhető** — a `doom` sosem osztható ki játékosnak, mert nem interaktív.
- **Kimerítő `switch`-ek:** a `DebugEventBar.eventLabel` és a `WallOfShame.EVENT_EMOJI` `EventType`-onként teljes leképezést vár. Új típus felvétele **minden** ilyen helyet érint — a `doom` ezt már be is szedte, de a következő típusnál újra ellenőrizni kell.
- **✅ `event.doom` i18n hiány — lezárva (2026-07-29):** az `EventModal` kulcstérképe hivatkozott egy sehol nem létező névtérre. Ártalmatlan volt (holt ág), de ha a `doom` valaha modalként jelenne meg, a felhasználó **nyers kulcsot** látott volna — pontosan úgy, ahogy a `shop.sort.*` esetében történt ([[002-ingame-shop-frontend]] G rész). **Döntés: törlés** — a holt bejegyzés kikerült, a térkép `Partial<Record<EventType, string>>` lett, a hívási hely `?? "event.horn"` fallbackje pedig továbbra is védi az esetleges jövőbeli hiányt.
- **Az `App.tsx` 1 mp-es intervalja a lejárat egyetlen őre.** Ha a `gamePhase` nem `playing` a lejáratkor (pl. szünet), a pusztulás **nem** következik be azonnal — a visszaszámlálás gyakorlatilag felfüggesztődik, amíg a játékos vissza nem tér. Ez a jelenlegi (szándékolt) viselkedés, de érdemes tudatosan kezelni, ha a szünet-szabályok változnak.

### 5.4 Mentőhajó Dashboard váltás

A mentőhajó átszállásnál a Dashboard másik cockpit képre vált. Ehhez:
- A Dashboard kap egy `cockpitVariant: string` prop-ot vagy state-et
- Alapértelmezett: `cockpitVariant = "default"`
- Átszálláskor: `cockpitVariant = "rescue"` → másik `shipImageUrl`, esetleg más színösszeállítás
- Az útidő számítás változatlan (a mentőhajó sebessége megegyezik az aktuális hajóéval)

---

## 6. Kész definíció

- A `difficulty` beállítás (**easy** / **medium** / **hard**) bekötve a játékmenetbe
- **Easy mód:** a meglévő figyelem/arcfigyelés mechanika fut, nincs extra esemény
- **Medium mód:** random események 3-5 percenként (kürt, aszteroida, mentőhajó)
- **Hard mód:** medium események + hamis instrukciók 5-10 percenként + napkitörés 10-20 percenként
- Minimum 3-5 perc gap bármely két esemény között
- Események: kürt, aszteroida, mentőhajó átszállás, napkitörés, űrajáró (+ hard módban hamis instrukció)
- **`doom` visszaszámlálás:** a mentőhajó elutasítása után halasztott pusztulás (`pendingDestructionAt`), a debug sávban „☠️ Doom" kijelzéssel; lejáratkor `crewLost` / `crewLostReason: "event"` (1.6, K. blokk)
- Debug mód (`VITE_DEBUG_MODE=true`): események 3× gyorsabbak + gombsor a jobb felső sarokban minden esemény azonnali triggereléséhez
- Büntetés: kis események → időbüntetés (+útidő), napkitörés → crewLost
- `EventModal` overlay: minden esemény egy központi modalban jelenik meg
- Hamis instrukciók hard módban: logikus, trükkös szövegek, nem random
- Mentőhajó átszállás: másik cockpit kép + műszerfal, az út az új hajó sebességéből számolva
- Space rover: csak az adott küldetésben használható, nem szerezhető meg örökre
- `npm run test` + `npm run build` + `tsc --noEmit` — zöld
- i18n: mind az 5 nyelven teljes paritás (20+ új kulcs)
- **`event.doom` lezárva (2026-07-29):** az `EventModal` `I18N_MAP`-jából a holt `doom: "event.doom"` bejegyzés törölve (`Partial<Record<EventType, string>>` típus, meglévő `?? "event.horn"` fallback); az `event.doom` kulcsok szándékosan nem készültek el, mert a `doom` sosem renderelődik modalként
