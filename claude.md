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
├── components/              # UI komponensek
│   ├── ScreenRouter.tsx     # GamePhase alapján routingolja a képernyőket
│   ├── IntroScreen.tsx      # Bevezető képernyő (Star Wars-szerű csillagmező scroll)
│   ├── MainMenu.tsx         # Főmenü (Játék / Áruház / Beállítások / Intro / Login)
│   ├── MissionSelector.tsx  # Küldetésválasztó (Proxima Centauri, Wolf 424, Ross 780)
│   ├── SettingsScreen.tsx   # Beállítások (zene, nehézség, nyelv)
│   ├── PauseMenu.tsx        # Szünet + figyelmeztető menü
│   ├── LoadingScreen.tsx    # Betöltő képernyő (kamera + modell inicializálás)
│   ├── Dashboard.tsx        # Műszerfal (sebesség, cél, időjárás, hátralévő idő)
│   ├── Starfield.tsx        # Canvas-alapú csillagmező animáció
│   ├── DebugOverlay.tsx     # Debug mód overlay (kamera, metrikák)
│   ├── LanguageSwitcher.tsx # Nyelvváltó gombsor (5 nyelv)
│   ├── ErrorBoundary.tsx    # Hiba határ komponens
│   └── ScreenCheck.tsx      # Képernyő orientáció/felbontás ellenőrzés
├── hooks/
│   ├── useAudio.ts          # Háttérzene kezelés
│   ├── useCamera.ts         # Webkamera stream kezelés
│   ├── useFaceDetection.ts  # Arcfelismerési ciklus (MediaPipe)
│   ├── useAttentionMonitor.ts # Arc alapú figyelemfigyelés
│   └── useWeather.ts        # Szimulált időjárás a célrendszeren
├── services/
│   └── faceRecognition.ts   # Arcfelismerés logika (keypoint analízis)
├── state/
│   ├── useGameStore.ts      # Játékállapot (Zustand + persist)
│   ├── useUIStore.ts        # UI állapot (hangerő, nehézség, kamera hiba)
│   └── utils.ts             # State updater segédfüggvény
├── constants/
│   ├── constants.ts         # Időzítések, sebességek, küszöbértékek
│   └── universeData.ts      # Célok (Proxima, Wolf 424, Ross 780) + időjárás
├── i18n/
│   ├── index.ts             # i18next inicializálás
│   └── locales/             # Fordítások (en, hu, fr, de, es)
├── types/
│   └── index.ts             # TypeScript típusok (GamePhase, Destination, stb.)
├── stubs/
│   └── mediapipe-stub.ts    # MediaPipe stub teszteléshez
└── test/
    └── setup.ts             # Vitest beállítások
```

## Kulcs koncepciók

### GamePhase állapotgép

A játék fázisait a `GamePhase` típus határozza meg:

```
intro → mainMenu → missionSelect → [shipSelect] → loading → playing ↔ paused → countdown → crewLost
                                                                                       → missionComplete
```

- `phaseToFlags` a `useGameStore`-ban képezi le a fázisokat boolean flag-ekre (backward compat).
- `transitionTo(phase)` a fő átmeneti függvény.
- `startMission(destination)` → `loading` fázis.
- `resetToMenu()` → `mainMenu` fázis, destination nullázva.

### Állapotkezelés (Zustand)

- **`useGameStore`** – játékállapot (gamePhase, destination, remainingYears, figyelés, stb.).
  - `persist` middleware: `bestServiceSeconds` mentése `localStorage`-ba (`space-travel-game`).
- **`useUIStore`** – UI állapot (cameraError, showExitConfirm, musicVolume, difficulty).
  - `persist` middleware: `space-travel-ui` kulcs.

### Arcfelismerés és figyelemfigyelés

1. `useCamera` → webkamera stream indítása.
2. `useFaceDetection` → MediaPipe model betöltése, periodikus arc-detectálás.
3. `useAttentionMonitor` → ha az arc nem látható, `paused` → `countdown` → `crewLost` átmenet.
4. **Zéró beavatkozás elve:** bármilyen billentyű lenyomása (kivéve Ctrl/Alt/Meta/F/Esc/Tab) → azonnali `crewLost` (ok: `buttons`).

### Nemzetköziesítés (i18n)

- 5 nyelv: `en`, `hu`, `fr`, `de`, `es`.
- `react-i18next` + `i18next-browser-languagedetector`.
- Nyelv localStorage-ban: `space-travel-lang`.
- `LanguageSwitcher` komponens a `SettingsScreen`-ben.
- `ErrorBoundary` class komponens → `i18n.t()` közvetlen hívása (nem hook).

### Útvonalterelés

A `ScreenRouter` komponens a `gamePhase` alapján dönt:
- `intro` → `IntroScreen`
- `mainMenu` → `MainMenu`
- `missionSelect` → `MissionSelector`
- `settings` → `SettingsScreen`
- `loading` → `LoadingScreen`
- Egyéb (playing, paused, stb.) → `children` (a játék nézet overlay-ekkel)

## Konvenciók

- **CSS Modules**: minden komponens mellé `*.module.css` fájl.
- **Hooke-ok**: `use` előtag, kis驼峰, külön mappában (`src/hooks/`).
- **Store-ok**: `use*Store` minta, Zustand create + persist.
- **Típusok**: `src/types/index.ts` központi fájlban.
- **i18n kulcsok**: logikai csoportok (`menu.*`, `dashboard.*`, `pause.*`, stb.).
- **Tesztek**: `*.test.ts` ugyanabban a mappában, mint a tesztelt fájl.
- **Fordítások**: mind az 5 nyelvben szinkronban kell tartani a kulcsokat.

## Környezeti változók

| Változó | Leírás | Alapértelmezett |
|---|---|---|
| `VITE_DEBUG_MODE` | Debug mód engedélyezése (`true`/`false`) | `false` |

## Hasznos parancsok

```bash
npm run dev          # Fejlesztői szerver (localhost:5173/realtime_space_travel/)
npm run build        # Termelési build (tsc + vite build)
npm run test         # Tesztek futtatása
npm run test:watch   # Tesztek figyelése
```

## Figyelmeztetések

- **Ne módosítsd a `SHIP_SPEED_KM_PER_SECOND` konstanst** anélkül, hogy frissítenéd a `Dashboard` és a `MissionSelector` számításait.
- **Az `ErrorBoundary` class komponens** maradnie kell (componentDidCatch) — i18n-hoz `i18n.t()` használata.
- **A webkamera elengedhetetlen** a játékhoz — a kamera hibaoverlay-et jelenít meg, ha nem elérhető.
- **A `base href`** `/realtime_space_travel/` — a fejlesztői szerver URL-je is ezzel végződik.
- **Persist kulcsok**: `space-travel-game`, `space-travel-ui`, `space-travel-lang` — ne ütközzenek.
