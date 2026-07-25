# Jelenlegi Architektúra

> Ez a fájl a Realtime Space Travel projekt **jelenlegi** (implementált) architektúráját dokumentálja.

## Áttekintés

```
┌─────────────────────────────────────────────────────────────────────┐
│                         React SPA (Vite)                            │
│                                                                     │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐  │
│  │  ScreenRouter │    │   App.tsx    │    │   Starfield.tsx      │  │
│  │  (fázis alapján)│  │  (logikai    │    │   (Canvas csillag     │  │
│  │               │    │   központ)    │    │    mező animáció)     │  │
│  └──────┬───────┘    └──────┬───────┘    └──────────────────────┘  │
│         │                   │                                       │
│  ┌──────▼───────────────────▼───────────────┐                      │
│  │  Komponensek                              │                      │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ │                      │
│  │  │ screens/ │ │ features/│ │  shop/   │ │                      │
│  │  │ (full    │ │ (in-game)│ │ (10+     │ │                      │
│  │  │  page)   │ │          │ │  files)  │ │                      │
│  │  └──────────┘ └──────────┘ └──────────┘ │                      │
│  │  ┌──────────┐ ┌──────────┐              │                      │
│  │  │   ui/    │ │ routing/ │              │                      │
│  │  │ (generic)│ │          │              │                      │
│  │  └──────────┘ └──────────┘              │                      │
│  └─────────────────────────────────────────┘                      │
│                                                                     │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐  │
│  │ useGameStore │    │  useUIStore  │    │  useShopStore        │  │
│  │ (Zustand)    │    │  (Zustand)   │    │  (Zustand + persist)  │  │
│  │ game fasek   │    │  UI állapot  │    │  kredit + birtoklás   │  │
│  │ destination  │    │  hangerő     │    │  + kosár             │  │
│  │ timer        │    │  nehézség    │    │  activePreviewId     │  │
│  │ figyelés     │    │  activeMusic │    │                      │  │
│  └──────────────┘    └──────────────┘    └──────────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  i18n (5 nyelv: en, hu, fr, de, es)                         │  │
│  │  react-i18next + i18next-browser-languagedetector            │  │
│  │  Lokalizációs kulcsok: menu, dashboard, intro, loading,      │  │
│  │  pause, app, screenCheck, errorBoundary, shop, settings      │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
         │
         │ Webkamera + TensorFlow.js
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    MediaPipe Face Detection                          │
│  ┌──────────────┐    ┌──────────────┐                              │
│  │ useCamera    │    │useFaceDetect │                              │
│  │ (stream)     │───▶│ (periodikus) │                              │
│  └──────────────┘    └──────┬───────┘                              │
│                             │                                       │
│                     ┌───────▼────────┐                              │
│                     │useAttentionMon │                              │
│                     │ (arc → figyelem)│                             │
│                     └────────────────┘                              │
└─────────────────────────────────────────────────────────────────────┘
```

## Komponens struktúra

```
src/components/
├── screens/               # Teljes képernyős GamePhase nézetek
│   ├── IntroScreen.tsx
│   ├── MainMenu.tsx
│   ├── MissionSelector.tsx
│   ├── MissionExoplanetModal.tsx  # Read-only exobolygó info modal
│   ├── SettingsScreen.tsx
│   └── LoadingScreen.tsx
├── features/              # Játék közbeni funkciók
│   ├── Dashboard.tsx
│   ├── PauseMenu.tsx
│   └── DebugOverlay.tsx
├── shop/                  # Áruház (mock, 10+ komponens)
│   ├── ShopScreen.tsx       # Fő nézet
│   ├── ShopTabs.tsx         # Kategória fülek
│   ├── ProductGrid.tsx      # Görgethető rács + kereső
│   ├── ProductCard.tsx      # Termékkártya
│   ├── CartButton.tsx       # Kosár ikon + badge
│   ├── CartView.tsx         # Kosár nézet
│   ├── CheckoutSuccess.tsx  # Sikeres fizetés
│   ├── CreditBalance.tsx    # Kredit egyenleg
│   ├── CreditShopView.tsx   # Kredit vásárlás
│   ├── CreditSuccess.tsx    # Sikeres kreditvásárlás
│   ├── ExoplanetPreviewModal.tsx
│   ├── ShipPreviewModal.tsx
│   └── MusicPreviewButton.tsx
├── ui/                    # Generikus újrahasznosítható UI
│   ├── Modal.tsx
│   ├── Tabs.tsx
│   ├── LanguageSwitcher.tsx
│   ├── Starfield.tsx
│   ├── ScreenCheck.tsx
│   └── ErrorBoundary.tsx
└── routing/
    └── ScreenRouter.tsx     # GamePhase alapján routing
```

## Állapotkezelés

### useGameStore (Zustand + persist)

| Mező | Típus | Leírás |
|------|-------|--------|
| `gamePhase` | `GamePhase` | Jelenlegi fázis |
| `destination` | `{name, travelYears} \| null` | Kiválasztott cél |
| `remainingYears` | `number` | Hátralévő utazási idő |
| `serviceSeconds` | `number` | Szolgálati idő |
| `bestServiceSeconds` | `number` | Rekord (persistált) |
| `isPaused`, `isAttentionLost` | `boolean` | Szünet / figyelem állapotok |
| `crewLost`, `crewLostReason` | `boolean, string` | Legénység elveszett |
| `missionComplete` | `boolean` | Küldetés teljesítve |

### useUIStore (Zustand + persist)

| Mező | Típus | Leírás |
|------|-------|--------|
| `cameraError` | `string \| null` | Kamera hiba |
| `showExitConfirm` | `boolean` | Kilépés megerősítés |
| `isMusicMuted` | `boolean` | Zene némítva |
| `musicVolume` | `number` (0..1) | Hangerő |
| `difficulty` | `"easy"\|"medium"\|"hard"` | Nehézség |
| `activeMusicId` | `string \| null` | Aktív zene ID (null = main_theme) |
| `setActiveMusicId(id)` | akció | Zene váltás |

### useShopStore (Zustand + persist, kulcs: `space-travel-shop`)

| Mező | Típus | Leírás |
|------|-------|--------|
| `credits` | `number` | Kredit egyenleg (0 normál / 9000 debug) |
| `owned` | `OwnedItems` | Birtokolt tételek (ships, music, exoplanets) |
| `cart` | `CartItem[]` | Kosár tartalma |
| `isPreviewing` | `boolean` | Zenei előnézet állapota (NEM persistálva) |
| `activePreviewId` | `string \| null` | Aktív előnézet ID (NEM persistálva) |

**Akciók:** `addToCart`, `removeFromCart`, `checkout`, `buyCredits`, `isOwned`, `isInCart`, `setPreviewing`, `setActivePreviewId`, `resetShop`

### GamePhase állapotgép

```
intro → mainMenu → missionSelect / shop / settings
  → loading → playing ↔ paused → countdown → crewLost
                                             → missionComplete
```

`phaseToFlags` függvény képezi le boolean flag-ekre:
- `shop` = pre-game (mint mainMenu/settings) — háttérzene NEM szól

## Katalógus és adat

| Adat | Hely | Forma |
|------|------|-------|
| Exobolygók (100) | `src/data/exoplanets.json` | JSON (Vite import) |
| Alap exobolygók (3) | `src/constants/shopCatalog.ts` | `BASE_EXOPLANETS` |
| Űrhajók (3 mock) | `src/constants/shopCatalog.ts` | `SHOP_SHIPS` |
| Zenék (5 + main_theme) | `src/constants/shopCatalog.ts` | `SHOP_MUSIC`, fájlok: `public/music/*.mp3` |
| Kreditcsomagok (4) | `src/constants/shopCatalog.ts` | `CREDIT_PACKS` |
| Konstansok | `src/constants/shopCatalog.ts` | `CREDITS_PER_EUR`=100, `STARTING_CREDITS`=0, `DEBUG_STARTING_CREDITS`=9000 |

## Nemzetköziesítés (i18n)

- **Nyelvek:** `en`, `hu`, `fr`, `de`, `es`
- **Eszköz:** `react-i18next` + `i18next-browser-languagedetector`
- **Fallback:** `en`
- **Persist:** `localStorage` (`space-travel-lang`)
- **Kulcs csoportok:** `menu.*`, `dashboard.*`, `intro.*`, `loading.*`, `pause.*`, `app.*`, `screenCheck.*`, `errorBoundary.*`, `weather.*`, `shop.*`, `settings.*`

## Zene rendszer

- **Háttérzene:** `useAudio(activeMusicId)` a `App.tsx`-ben
  - `null` = `main_theme.mp3` (alap)
  - Egyéb = a kiválasztott zene a birtokolt `SHOP_MUSIC`-ból
  - Fade in/out hangerő átmenettel
  - Shopban NEM szól háttérzene
- **Zenei előnézet shopban:** Singleton `globalStopPreview`, store-beli `activePreviewId`
- **Minden audio fájl:** `public/music/*.mp3`, kisbetűs, underscore

## Képernyőorientáció és felbontás

- **Minimális felbontás:** 900×530
- **Orientáció:** Fekvő (landscape)
- `ScreenCheck` komponens a `ErrorBoundary`-n belül

## Fejlesztői mód

`VITE_DEBUG_MODE=true` környezeti változóval:
- Kamera előnézet (`DebugOverlay`)
- Arcfelismerési metrikák
- `debugIgnoreAttention` kapcsoló
- **Shopban:** `↺ Reset` gomb, `DEBUG_STARTING_CREDITS` = 9000⭐
- Lassabb intro scroll

## Konfiguráció

### constants.ts

| Konstans | Érték | Leírás |
|---|---|---|
| `SHIP_SPEED_KM_PER_SECOND` | 191 | Hajó sebesség km/s |
| `INACTIVITY_LIMIT_SECONDS` | 60 | Figyelem időkorlát |
| `FACE_DETECTION_INTERVAL_MS` | 1000 | Arcdetektálás gyakoriság |
| `SERVICE_UPDATE_INTERVAL_MS` | 50 | Idő frissítés gyakoriság |

### Környezeti változók

| Változó | Leírás | Alapértelmezett |
|---|---|---|
| `VITE_DEBUG_MODE` | Debug mód (`true`/`false`) | `false` |

## Tesztelés

- **Teszt keret:** Vitest
- **Setup:** `src/test/setup.ts` (i18n init)
- **Tesztek:** `useGameStore.test.ts`, `faceRecognition.test.ts` (+ useShopStore test TODO)
- **Futtatás:** `npm run test`

## Build és Deployment

- **Build:** `tsc && vite build`
- **Output:** `dist/`
- **Base href:** `/realtime_space_travel/`
- **GitHub Actions:** `.github/workflows/deploy.yml`
