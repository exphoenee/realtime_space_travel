---
title: "Nehézségi szintek + eseményrendszer – random interakciók a játékban"
slug: 011-difficulty-event-system
type: plan
category: core
status: in-progress
implemented: false
implemented_at: null
created_at: "2026-07-27"
updated_at: "2026-07-27"
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
---

# Nehézségi szintek + eseményrendszer – random interakciók a játékban

**Cél:** A meglévő `difficulty` beállítás (`easy` / `medium` / `hard`) bekötése a játékmenetbe rendszertelen időközönként felbukkanó eseményekkel, amelyek interakciót kívánnak a játékostól. Debug módban az események gyorsabban következnek be, és egy gombsorral azonnal triggerelhetők. Easy módban a jelenlegi játékmenet marad (nincs extra esemény).

> ⚠️ **Ez a terv a jelenlegi játékmenetet bővíti, nem függ Stripe/auth backendtől.** A `difficulty` mező már létezik a `useUIStore`-ban, de nincs bekötve. Az események kliensoldaliak (nincs RTDB-függőség).

---

## Döntések (egyeztetve)

| Kérdés | Választás |
|--------|-----------|
| Elhelyezés a roadmapen | **11. lépés** — a 010 után, a 012-social-multiplayer előtt. Független a Stripe/auth backendtől, párhuzamosan is dolgozható. |
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
  type: EventType;          // "horn" | "asteroid" | "rescue-transfer" | "solar-flare" | "rover" | "fake-instruction"
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
src/state/useGameStore.ts                   # +activeEvent, +eventPenaltyYears, +triggerEvent, +resolveEvent, +dismissEvent
src/components/features/Dashboard.tsx        # EventModal integráció, mentőhajó UI váltás, aszteroida figyelmeztetés
src/App.tsx                                  # DebugEventBar integráció
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
- **Érinti:** [[007-state-persist-page-refresh]] — az esemény állapot (`activeEvent`) nem perzisztálódik (a timer újraindul oldalfrissítéskor)

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
- Események: kürt, aszteroida, mentőhajó átszállás, napkitörés, űrajáró
- Debug mód (`VITE_DEBUG_MODE=true`): események 3× gyorsabbak + gombsor a jobb felső sarokban minden esemény azonnali triggereléséhez
- Büntetés: kis események → időbüntetés (+útidő), napkitörés → crewLost
- `EventModal` overlay: minden esemény egy központi modalban jelenik meg
- Hamis instrukciók hard módban: logikus, trükkös szövegek, nem random
- Mentőhajó átszállás: másik cockpit kép + műszerfal, az út az új hajó sebességéből számolva
- Space rover: csak az adott küldetésben használható, nem szerezhető meg örökre
- `npm run test` + `npm run build` + `tsc --noEmit` — zöld
- i18n: mind az 5 nyelven teljes paritás (20+ új kulcs)
