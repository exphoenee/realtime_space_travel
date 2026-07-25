# Jelenlegi Architektúra

> Ez a fájl a Realtime Space Travel projekt **jelenlegi** (implementált) architektúráját dokumentálja.

## Áttekintés

```
┌─────────────────────────────────────────────────────────────────┐
│                        React SPA (Vite)                         │
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │  ScreenRouter │    │   App.tsx    │    │   Starfield.tsx  │  │
│  │  (fázis alapján)│  │  (logikai    │    │   (Canvas csillag │  │
│  │              │    │   központ)    │    │    mező animáció) │  │
│  └──────┬───────┘    └──────┬───────┘    └──────────────────┘  │
│         │                   │                                   │
│  ┌──────▼───────┐    ┌──────▼───────┐                          │
│  │ Komponensek  │    │   Hook-ok    │                          │
│  │ (UI réteg)   │    │  (logika)    │                          │
│  └──────────────┘    └──────────────┘                          │
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │ useGameStore │    │  useUIStore  │    │   i18n (5 nyelv) │  │
│  │ (Zustand)    │    │  (Zustand)   │    │   react-i18next  │  │
│  └──────────────┘    └──────────────┘    └──────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
         │
         │ Webkamera + TensorFlow.js
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    MediaPipe Face Detection                     │
│  ┌──────────────┐    ┌──────────────┐                          │
│  │ useCamera    │    │useFaceDetect │                          │
│  │ (stream)     │───▶│ (periodikus) │                          │
│  └──────────────┘    └──────┬───────┘                          │
│                             │                                   │
│                     ┌───────▼────────┐                          │
│                     │useAttentionMon │                          │
│                     │ (arc → figyelem)│                         │
│                     └────────────────┘                          │
└─────────────────────────────────────────────────────────────────┘
```

## Adatfolyamat

### 1. Játék indítása

```
MainMenu → MissionSelector → handleSelectDestination()
  → kamera ellenőrzés (getUserMedia)
  → startMission(destination) → loading fázis
  → LoadingScreen (kamera + modell init)
  → playing fázis
```

### 2. Figyelemfigyelés ciklusa

```
playing → useFaceDetection (periodikus, FACE_DETECTION_INTERVAL_MS)
  → arc detektálva? → igen → playing folytatás
  → arc detektálva? → nem → paused → countdown (60 mp)
    → 60 mp alatt visszatért? → playing
    → 60 mp lejárt? → crewLost (ok: attention)
```

### 3. Billentyűzet beavatkozás

```
playing → bármilyen billentyű (kivéve Ctrl/Alt/Meta/F/Esc/Tab)
  → azonnali crewLost (ok: buttons)
```

### 4. Küldetés befejezése

```
playing → remainingYears ≤ 0 → missionComplete
  → vissza a főmenübe (resetToMenu)
```

## Állapotkezelés

### useGameStore (Zustand)

**Tartalom:**
- `gamePhase` – jelenlegi fázis (GamePhase típus)
- `destination` – kiválasztott cél (name + travelYears)
- `remainingYears` – hátralévő utazási idő (földi év)
- `serviceSeconds` – szolgálati idő (játékidő)
- `bestServiceSeconds` – rekord (persistált)
- `isPaused`, `isAttentionLost`, `inactivitySeconds`
- `crewLost`, `crewLostReason` (`"attention"` | `"buttons"`)
- `missionComplete`

**Műveletek:**
- `transitionTo(phase)` – fázisváltás + flag-ek frissítése
- `startMission(destination)` – küldetés indítása
- `resetToMenu()` – vissza a főmenübe

**Persist:** `bestServiceSeconds` → `localStorage` (`space-travel-game`)

### useUIStore (Zustand)

**Tartalom:**
- `cameraError` – kamera hibaüzenet
- `showExitConfirm` – kilépés megerősítő dialógus
- `isMusicMuted` – zene némítva
- `musicVolume` – zene hangerő (0..1)
- `difficulty` – nehézség (`easy` | `medium` | `hard`)

**Persist:** teljes store → `localStorage` (`space-travel-ui`)

## Konfiguráció és konstansok

### constants.ts

| Konstans | Érték | Leírás |
|---|---|---|
| `SHIP_SPEED_KM_PER_SECOND` | 191 | Űrhajó sebessége km/s-ben |
| `TRAVEL_YEARS_PER_SECOND` | 0.001 | Hány földi év telik el játékmásodpercenként |
| `INACTIVITY_LIMIT_SECONDS` | 60 | Figyelmen kívül hagyás időkorlátja |
| `ATTENTION_INTERVAL_MS` | 1000 | Arcfelismerési ciklus időköze |
| `FACE_DETECTION_INTERVAL_MS` | 100 | Arcdetektálás gyakorisága |
| `SERVICE_UPDATE_INTERVAL_MS` | 1000 | Szolgálati idő frissítési gyakorisága |

### universeData.ts

| Célnév | Távolság (LY) | Jutalom |
|---|---|---|
| Proxima Centauri | 4.24 | 500$ |
| Wolf 424 | 14.3 | 2000$ |
| Ross 780 | 16.6 | 3000$ |

## Nemzetköziesítés (i18n)

- **Nyelvek:** `en`, `hu`, `fr`, `de`, `es`
- **Eszköz:** `react-i18next` + `i18next-browser-languagedetector`
- **Fallback:** `en`
- **Persist:** `localStorage` (`space-travel-lang`)
- **Kulcsok:** logikai csoportok (`menu.*`, `dashboard.*`, `pause.*`, `app.*`, stb.)
- **Speciális:** `ErrorBoundary` (class) → `i18n.t()` közvetlen hívása (nem hook)

## Képernyőorientáció és felbontás

- **Minimális felbontás:** 900×530
- **Orientáció:** Fekvő (landscape)
- `ScreenCheck` komponens a `ErrorBoundary`-n belül
- `ScreenRouter` az `App`-on kívül renderel (az `ErrorBoundary` kezeli)

## Fejlesztői mód

A `VITE_DEBUG_MODE=true` környezeti változóval:
- Kamera előnézet látható (`DebugOverlay`)
- Arcfelismerési metrikák megjelennek
- `debugIgnoreAttention` kapcsoló (figyelemfigyelés kikapcsolása)
- Intro görgetés sebessége lassabb (120s)

## Tesztelés

- **Teszt keret:** Vitest
- **Setup:** `src/test/setup.ts` (i18n inicializálás, global setup)
- **Minta:** `useGameStore.test.ts`, `faceRecognition.test.ts`
- **Futtatás:** `npm run test` (egyszeri) / `npm run test:watch` (figyelés)

## Build és Deployment

- **Build:** `tsc && vite build`
- **Output:** `dist/` mappa
- **Base href:** `/realtime_space_travel/`
- **GitHub Actions:** `.github/workflows/deploy.yml`
