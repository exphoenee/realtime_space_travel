# Claude – Segédútmutató a Realtime Space Travel projekthez

> Ez a fájl arra szolgál, hogy az AI asszisztensek (Claude, stb.) gyorsan megértsék a projekt kontextusát, konvencióit és a jelenlegi állapotot.

## Projekt összefoglaló

A **Realtime Space Travel** egy valós idejű űrutazás-szimulátor, ahol a játékos egy csillagközi utazást felügyel webkamerás arcfelismeréssel. A játékosnak folyamatosan a képernyő előtt kell ülnie — ha nem figyel, a legénység elpusztul.

**Koncepció:** „Az életedre szóló élmény!" — egy AFK (Away From Keyboard) játék, ahol a legfontosabb képesség a türelem és a fegyelem.

## Technológiai stack

| Technológia | Verzió | Szerep |
|---|---|---|
| React | 18.x | UI keretrendszer |
| TypeScript | 5.x | Típusbiztos kód |
| Vite | 5.x | Build eszköz + dev szerver |
| Zustand | 4.x | Állapotkezelés (persist middleware-rel) |
| i18next / react-i18next | — | Nemzetköziesítés (5 nyelv) |
| TensorFlow.js + MediaPipe | — | Webkamerás arcfelismerés |
| CSS Modules | — | Stíluskezelés |
| Vitest | 4.x | Tesztelés |

## Projekt szerkezet

```
src/
├── App.tsx                  # Fő komponens – logikai központ
├── components/
│   ├── screens/             # Teljes képernyős GamePhase nézetek
│   │   ├── IntroScreen.tsx
│   │   ├── MainMenu.tsx
│   │   ├── MissionSelector.tsx
│   │   ├── MissionExoplanetModal.tsx   # Read-only exobolygó info
│   │   ├── SettingsScreen.tsx
│   │   └── LoadingScreen.tsx
│   ├── features/            # Játék közbeni funkciók
│   │   ├── Dashboard.tsx
│   │   ├── PauseMenu.tsx
│   │   └── DebugOverlay.tsx
│   ├── shop/                # Áruház (mock, 10+ komponens)
│   │   ├── ShopScreen.tsx   # Fő nézet
│   │   ├── ShopTabs.tsx     # Kategória fülek
│   │   ├── ProductGrid.tsx  # Görgethető rács + kereső
│   │   ├── ProductCard.tsx  # Termékkártya
│   │   ├── CartButton.tsx   # Kosár ikon + badge
│   │   ├── CartView.tsx     # Kosár nézet
│   │   ├── CheckoutSuccess.tsx
│   │   ├── CreditBalance.tsx
│   │   ├── CreditShopView.tsx
│   │   ├── CreditSuccess.tsx
│   │   ├── ExoplanetPreviewModal.tsx
│   │   ├── ShipPreviewModal.tsx
│   │   └── MusicPreviewButton.tsx
│   ├── ui/                  # Generikus újrahasznosítható UI
│   │   ├── Modal.tsx
│   │   ├── Tabs.tsx
│   │   ├── LanguageSwitcher.tsx
│   │   ├── Starfield.tsx
│   │   ├── ScreenCheck.tsx
│   │   └── ErrorBoundary.tsx
│   └── routing/
│       └── ScreenRouter.tsx # GamePhase alapján routing
├── hooks/
│   ├── useAudio.ts          # Háttérzene (track-váltással, fade-del)
│   ├── useCamera.ts         # Webkamera stream
│   ├── useFaceDetection.ts  # Arcfelismerés (MediaPipe)
│   ├── useAttentionMonitor.ts # Figyelemfigyelés
│   └── useWeather.ts        # Időjárás szimuláció
├── services/
│   └── faceRecognition.ts   # Arc keypoint analízis
├── state/
│   ├── useGameStore.ts      # Játékállapot (Zustand + persist)
│   ├── useUIStore.ts        # UI állapot (hangerő, nehézség, activeMusicId, kamera hiba)
│   ├── useShopStore.ts      # Áruház (kredit, birtoklás, kosár — persist)
│   └── utils.ts             # State updater segédfüggvény
├── constants/
│   ├── constants.ts         # Időzítések, sebességek, küszöbértékek
│   ├── shopCatalog.ts       # Katalógus (termékek, kreditcsomagok, árak)
│   └── universeData.ts      # Célok + időjárás
├── data/
│   └── exoplanets.json      # 100 exobolygó adat (Vite JSON import)
├── i18n/
│   ├── index.ts             # i18next inicializálás
│   └── locales/             # Fordítások (en, hu, fr, de, es)
├── types/
│   └── index.ts             # TypeScript típusok (GamePhase, Shop*, stb.)
├── stubs/
│   └── mediapipe-stub.ts    # MediaPipe stub teszteléshez
└── test/
    └── setup.ts             # Vitest beállítások

public/
└── music/                   # Audio fájlok (kisbetűs, underscore)
    ├── main_theme.mp3
    ├── dust_on_the_highway.mp3
    ├── late_night_urgency.mp3
    ├── neon_heartbeat.mp3
    ├── neon_static.mp3
    └── rust_in_the_gears.mp3
```

## Kulcs koncepciók

### GamePhase állapotgép

A játék fázisait a `GamePhase` típus határozza meg:

```
intro → mainMenu → missionSelect → [loading] → playing ↔ paused
                  → shop
                  → settings
                                      → countdown → crewLost
                                                   → missionComplete
```

- `phaseToFlags` → boolean flag-ek (backward compat)
- `transitionTo(phase)` → fő átmeneti függvény
- `shop` fázis is pre-game (mint mainMenu) — háttérzene NEM szól

### Állapotkezelés (Zustand)

- **`useGameStore`** – játékállapot (gamePhase, destination, remainingYears, figyelés, stb.)
  - Persist: `space-travel-game`
- **`useUIStore`** – UI állapot (cameraError, musicVolume, difficulty, **activeMusicId**)
  - Persist: `space-travel-ui`
- **`useShopStore`** – áruház (credits, owned, cart, activePreviewId)
  - Persist: `space-travel-shop`
  - Normál: 0⭐, Debug: 9000⭐
  - 3 alap exobolygó előre birtokolt

### Arcfelismerés és figyelemfigyelés

1. `useCamera` → webkamera stream
2. `useFaceDetection` → MediaPipe periodikus arc-detectálás
3. `useAttentionMonitor` → arc nem látható → `paused` → `countdown` → `crewLost`
4. **Zéró beavatkozás elve:** bármilyen billentyű → `crewLost` (ok: `buttons`)

### Áruház (shop)

- **4 fül:** Exobolygók, Űrhajók, Zenék, Kredit vásárlás
- **Kereső:** exobolygók, űrhajók, zenék tabokon (kreditnél nincs)
- **Scroll:** csak a grid scrollázik, tabok + kereső fix
- **Kredit:** `CREDIT_PACKS` (10€→100⭐, 25€→300⭐, 50€→700⭐, 100€→2000⭐)
- **Zenei előnézet:** singleton `globalStopPreview`, egyszerre csak 1
- **Debug reset:** `↺ Reset` gomb debug módban
- **Checkout:** kredit levonás → birtoklás → kosár ürítés → siker képernyő

### Zene rendszer

- `useAudio(activeMusicId)` — dinamikus track-váltás
- `null` = `main_theme.mp3` (alap)
- Beállítások menüben custom `<select>` dropdown (letiltva ha nincs megvett zene)
- Shopban NEM szól háttérzene
- Minden fájl: `public/music/*.mp3`, kisbetűs, underscore

### Nemzetköziesítés (i18n)

- 5 nyelv: `en`, `hu`, `fr`, `de`, `es`
- `react-i18next` + `i18next-browser-languagedetector`
- Kulcs csoportok: `menu.*`, `dashboard.*`, `intro.*`, `loading.*`, `pause.*`, `app.*`, `screenCheck.*`, `errorBoundary.*`, `weather.*`, `shop.*`, `settings.*`
- Vigyázat: `shop.credits` object namespace — stringhez `shop.creditsLabel` használandó

## Konvenciók

- **CSS Modules**: minden komponens mellé `*.module.css` fájl
- **Hook-ok**: `use` előtag, `src/hooks/` mappa
- **Store-ok**: `use*Store` minta, Zustand create + persist
- **Típusok**: `src/types/index.ts` központi fájlban
- **i18n kulcsok**: logikai csoportok, teljes paritás mind az 5 nyelven
- **Tesztek**: `*.test.ts` ugyanabban a mappában
- **`.claude/lessons-learned.md`** — dokumentált tanulságok

## Környezeti változók

| Változó | Leírás | Alapértelmezett |
|---|---|---|
| `VITE_DEBUG_MODE` | Debug mód (`true`/`false`) | `false` |

## Hasznos parancsok

```bash
npm run dev          # Fejlesztői szerver (localhost:5173/realtime_space_travel/)
npm run build        # Termelési build (tsc + vite build)
npm run test         # Tesztek futtatása
npm run test:watch   # Tesztek figyelése
python .claude/scripts/generate_roadmap.py  # Roadmap újragenerálás
```

## Fejlesztési munkafolyamat (skillek + agentek)

A projekt a Claude Code natív **skill** és **agent (subagent)** mechanizmusát használja. Részletek: [`agents.md`](./agents.md).

> ⚠️ **Kötelező szabályok:** [`.claude/rules/planning-workflow.md`](./.claude/rules/planning-workflow.md) — terv **kizárólag** a `./plans/`-ba, **kizárólag** a `plan` skillen és a `planner` agenten keresztül; a `roadmap.md` generált, csak a `manage-roadmap` agent nyúlhat hozzá.

- **Skillek** (`.claude/skills/`): `dev` (implementációs orchestrátor) és `plan` (új terv)
- **Agentek** (`.claude/agents/`): `react-dev`, `i18n`, `manage-roadmap`, `planner`
- **Single source of truth:** `./plans/`; `roadmap.md` **scripttel generált**
- **Referenciák:** `.claude/references/`; Tanulságok: `.claude/lessons-learned.md`
- **Tool használat:** preferált a `spawn_agents` párhuzamos indításhoz; a `str_replace`-nél figyelni kell a JSON escape-ekre

## Figyelmeztetések

- **Ne módosítsd a `SHIP_SPEED_KM_PER_SECOND` konstanst** anélkül, hogy frissítenéd a `Dashboard` és a `MissionSelector` számításait
- **Az `ErrorBoundary` class komponens** maradnia kell — i18n-hoz `i18n.t()` használata
- **A webkamera elengedhetetlen** a játékhoz
- **A `base href`** `/realtime_space_travel/`
- **Persist kulcsok**: `space-travel-game`, `space-travel-ui`, `space-travel-shop`, `space-travel-lang` — ne ütközzenek
- **Az összes MP3** `public/music/`-ben legyen (még a `main_theme.mp3` is!)
- **Fájlnevek:** csupa kisbetű, space helyett `_`
