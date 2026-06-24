# 🏗️ Architekturális áttekintés — Realtime Space Travel

> Generálva: 2026. június 24.
> Utolsó frissítés: 2026. június 24.

---

## Összefoglaló

Ez egy **React + TypeScript** SPA, amely egy **valós idejű űrutazás szimulátort** valósít meg webkamerás arcfelismeréssel. A felhasználó figyeli a "műszerfalat", az alkalmazás pedig a MediaPipe/TensorFlow.js segítségével detektálja, hogy a felhasználó a képernyőre néz-e. Ha nem, a játék szünetel, majd a legénység odavész.

---

## Tech Stack

| Technológia | Szerep |
|---|---|
| **React 18** | UI komponensek |
| **TypeScript (strict)** | Típusbiztonság |
| **Vite 5** | Build eszköz |
| **Zustand** | Globális állapotkezelés (persist middleware) |
| **TensorFlow.js + MediaPipe** | Arc detektálás a böngészőben |
| **CSS Modules** | Stílusok, scoped class-ok |
| **Vitest + jsdom** | Unit tesztek |
| **GitHub Actions** | CI/CD → GitHub Pages |

---

## Projekt struktúra

```
realtime_space_travel/
├── index.html
├── index.tsx              # Entry point
├── index.css              # Globális stílusok
├── package.json
├── tsconfig.json
├── vite.config.ts
├── metadata.json
├── README.md
├── ToDo.md
├── plans/
│   └── architekturalis-attekintes.md  # ← EZ A FÁJL
├── .github/
│   └── workflows/
│       └── deploy.yml
├── public/mediapipe/
├── src/
│   ├── App.tsx
│   ├── App.module.css
│   ├── components/
│   │   ├── ScreenRouter.tsx       # ✨ NEW — gamePhase alapú router
│   │   ├── Dashboard.tsx
│   │   ├── Dashboard.module.css
│   │   ├── Starfield.tsx
│   │   ├── IntroScreen.tsx
│   │   ├── IntroScreen.module.css
│   │   ├── MainMenu.tsx
│   │   ├── MainMenu.module.css
│   │   ├── PauseMenu.tsx
│   │   ├── PauseMenu.module.css
│   │   ├── ErrorBoundary.tsx
│   │   └── ScreenCheck.tsx
│   ├── hooks/
│   ├── services/
│   ├── state/
│   │   └── useGameStore.ts
│   ├── constants/
│   ├── types/
│   │   └── index.ts               # GamePhase típus hozzáadva
│   ├── stubs/
│   └── test/
```

---

## Adatfolyam

```
Felhasználói input → App.tsx → ScreenRouter → Komponens újrarender
                          ↕
                  Zustand Store (gamePhase + legacy booleans)
                          ↕
                  Custom Hook-ok (useCamera, useAudio, useWeather)
                          ↕
                  Böngésző API-k (Webcam, TF.js, Web Audio)
```

---

## Explicit állapotgép ✅ BEVEZETVE

A korábbi 6+ boolean flag helyett a `GamePhase` típus és `transitionTo` metódus szolgál elsődleges állapotforrásként:

```typescript
export type GamePhase =
  | "intro"            // Nyitó sztori
  | "menu"             // Főmenü
  | "loading"          // Kamera/modell betöltés
  | "playing"          // Aktív utazás
  | "paused"           // Figyelemkiesés → szünet
  | "countdown"        // 60 mp countdown
  | "crewLost"         // Game over
  | "missionComplete"; // Sikeres érkezés
```

A `phaseToFlags()` függvény biztosítja a visszafelé kompatibilitást a legacy boolean-ekkel.

### ScreenRouter

Az `ScreenRouter` komponens a `gamePhase` alapján dönti el, melyik képernyő jelenjen meg:
- `'intro'` → `IntroScreen`
- `'menu'` → `MainMenu`
- Minden más → játék nézet (children)

### Store átmenetek

| Metódus | Új fázis | Hatás |
|---|---|---|
| `transitionTo('menu')` | menu | Intro átugrása, menü megjelenítése |
| `startMission(dest)` | loading | Küldetés indítás + kamera init |
| `transitionTo('playing')` | playing | Kamera készen, játék fut |
| `transitionTo('paused')` | paused | Figyelemkiesés miatti szünet |
| `transitionTo('countdown')` | countdown | 60 mp countdown indul |
| `transitionTo('crewLost')` | crewLost | Legénység elveszett |
| `transitionTo('missionComplete')` | missionComplete | Sikeres érkezés |
| `resetToMenu()` | menu | Vissza a főmenübe |

---

## Erősségek ✅

1. **Tiszta rétegelés** — komponensek, hook-ok, szolgáltatások, állapot, konstansok szétválasztva
2. **CSS Modules** — nincs globális stílus ütközés, nincs CSS-in-JS overhead
3. **Zustand persist middleware** — a játékállapot mentés automatikus
4. **TypeScript strict mode** — teljes típusbiztonság
5. **CI/CD** — automatikus deploy GitHub Pages-re
6. **Error Boundary** — a teljes appot körbeveszi
7. **On-device ML** — MediaPipe arc detektálás, nincs szerver oldali feldolgozás
8. **✅ Explicit állapotgép** — már nem boolean flag-ekre épül a képernyő logika

---

## Gyengeségek & Javaslatok ❌

### 🔴 Kritikus — MEGOLDVA

| Probléma | Állapot |
|---|---|
| **App.tsx God komponens** → ScreenRouter bevezetve | ✅ KÉSZ |
| **Boolean flag-ekből álló állapotgép** → GamePhase + transitionTo | ✅ KÉSZ |
| **Nincs route-olás** → ScreenRouter komponenssel részben megoldva | ✅ KÉSZ |
| **Nincsenek komponens tesztek** | ❌ MÉG NEM |

### 🟡 Közepes

| Probléma | Javaslat | Állapot |
|---|---|---|
| **Egyetlen Zustand store** | Bontsd szét domain store-okra | ⏳ Tervezve (Fázis 2) |
| **CSS bug**: `translateY(70)` → `translateY(calc(87.5vh))` | ✅ JAVÍTVA | ✅ KÉSZ |
| **useCamera hook túl sok felelősség** | Válaszd szét 3 hook-ra | ⏳ Tervezve (Fázis 2) |
| **Nincs loading/skeleton UI** | Adj hozzá loading screen-t | ❌ MÉG NEM |
| **Nincs hiba kezelés a kamera indításnál** | try-catch + error UI | Van, de lehet bővíteni |
| **Nincs reszponzivitás** | Használj relative egységeket | ❌ MÉG NEM |

### 🟢 Apró

| Probléma | Állapot |
|---|---|
| `translateY(70)` → `translateY(calc(87.5vh))` | ✅ KÉSZ |
| `console.log` eldobott kód a store-ban | ❌ MÉG NEM |
| Nincs favicon | ❌ MÉG NEM |
| README.md-ben nincs screenshot | ❌ MÉG NEM |

---

## Függőségek elemzése

### `package.json` — dependenciák

```json
{
  "dependencies": {
    "@mediapipe/face_detection": "^0.0.3",
    "@tensorflow-models/face-detection": "^1.0.2",
    "@tensorflow/tfjs-core": "^4.21.0",
    "@tensorflow/tfjs-backend-webgl": "^4.21.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "zustand": "^4.5.5"
  },
  "devDependencies": {
    "@testing-library/react": "^16.0.1",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.4",
    "jsdom": "^25.0.1",
    "typescript": "^5.6.3",
    "vite": "^5.4.11",
    "vitest": "^2.1.5"
  }
}
```

---

## Tesztlefedettség

- ✅ `useGameStore.test.ts` — store működés tesztelve (7 teszt)
- ✅ `faceRecognition.test.ts` — arc felismerés logika tesztelve (4 teszt)
- ❌ Nincs komponens teszt (Dashboard, MainMenu, stb.)
- ❌ Nincs integritási teszt (teljes flow)
- ❌ Nincs E2E teszt

---

## CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml
on: push to main
jobs:
  build:
    - npm ci
    - npm run build
    - deploy to GitHub Pages
```

- Egyszerű, működő pipeline
- Csak a `main` branch-en fut
- Nincs teszt futtatás a deploy előtt
- Nincs Preview deploy

---

## Javasolt fejlesztési ütemterv — ÁLLAPOT

### Fázis 1 — Azonnal (1-2 nap) ✅ KÉSZ

| # | Feladat | Állapot | Megjegyzés |
|---|---|---|---|
| 1 | Explicit állapotgép (`GamePhase` + transitionTo) | ✅ KÉSZ | types/index.ts, useGameStore.ts |
| 2 | ScreenRouter komponens + App.tsx refaktor | ✅ KÉSZ | ScreenRouter.tsx, App.tsx |
| 3 | CSS `translateY(70)` javítás | ✅ KÉSZ | IntroScreen.module.css |

### Fázis 2 — Rövid táv (1 hét) ⏳

| # | Feladat | Állapot |
|---|---|---|
| 4 | Store szétbontása domain-ek szerint | ⏳ Tervezve |
| 5 | useCamera hook szétválasztása (3 hook) | ⏳ Tervezve |
| 6 | Komponens tesztek hozzáadása | ❌ |
| 7 | React Router bevezetése | ❌ |

### Fázis 3 — Középtáv (2-4 hét) 📅

| # | Feladat | Állapot |
|---|---|---|
| 8 | Reszponzív design | ❌ |
| 9 | Loading/skeleton UI | ❌ |
| 10 | E2E tesztek | ❌ |
| 11 | Preview deploy környezet | ❌ |

---

## Összegzés

A projekt **alapvetően jó architektúrájú**: tiszta rétegelés, TypeScript, Zustand, CSS Modules, CI/CD — minden adott egy skálázható alkalmazáshoz. A **Phase 1 refaktorálás elkészült**: az explicit állapotgép (`GamePhase` + `transitionTo`) és a `ScreenRouter` komponens bevezetésre került, a CSS hiba javításra. A következő lépés a Phase 2 feladatai (store szétbontása, useCamera szétválasztása, tesztek).
