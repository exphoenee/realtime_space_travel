---
title: "Kamera hozzájárulás – UI screen + Firebase perzisztencia + böngésző engedély kezelés"
slug: 014-camera-consent
type: plan
category: ui
status: implemented
implemented: true
implemented_at: "2026-07-29"
created_at: "2026-07-28"
updated_at: "2026-07-29"  # frissítve: három belépési pont (boot / start / settings) + cameraConsentOrigin, kettős kapu (tárolt consent + böngésző engedély, services/cameraPermission.ts), getUserMedia a persist ELŐTT, és a jóváhagyás utáni lánc javítása (checkCamera getUserMedia nélkül, useCamera retry, useFaceDetection isInitializing, loading-hibakártya); +related_plans: [[015-toast-notification]]. **L. blokk (2026-07-29):** böngésző-szintű `denied` kezelése a Settingsben — CameraHelpModal (böngésző-specifikus feloldási lépések + újratöltés), háromállapotú kamera-sor, settings.cameraBlocked + settings.cameraHelp.* i18n (5 nyelv). A K. blokk manuális böngészős tesztjei még NEM futottak le
author: exphoenee
step: 14
phases: []
dependencies:
  - 001-main-menu-settings
  - 003-firebase-auth-settings
related_plans:
  - 002-ingame-shop-frontend
  - 007-state-persist-page-refresh
  - 011-difficulty-event-system
  - 013-social-multiplayer
  - 015-toast-notification
tags:
  - ui
  - camera
  - privacy
  - consent
  - i18n
  - settings
  - firebase
---

# Kamera hozzájárulás – UI screen + Firebase perzisztencia + böngésző engedély kezelés

**Cél:** Egy teljes képernyős **Camera Consent Screen** (GamePhase-alapú oldal, nem modál) tájékoztatja a felhasználót, hogy a játék arcfelismerést használ, és beszerzi hozzá a böngésző engedélyét. A consent állapot **Firebase RTDB-be** kerül mentésre (`users/{rtdbKey}/settings/cameraConsent`), hogy oldalfrissítés után is megmaradjon, és vendég (`isAnonymous`) usereknél is ugyanúgy működjön. A screen **három belépési pontról** hívható, és a `cameraConsentOrigin` dönti el, hova tér vissza — a küldetés **kizárólag** akkor indulhat, ha a user a Start gombra kattintott.

**Folyamat:**

1. **Első betöltés, intró után** (`App.handleSkipIntro`): ha `introReplay === false` → `needsCameraConsent(cameraConsent)`
   - kell engedély → `setCameraConsentOrigin("boot")` + `transitionTo("cameraConsent")`
   - nem kell → `transitionTo("mainMenu")`
   - jóváhagyás után **főmenü** — a játék NEM indul magától
2. **Menü „Intro" gomb** (`MainMenu.handleIntro`): `setIntroReplay(true)` → `intro` fázis. Az intró végén **mindig** `mainMenu`, semmilyen engedélykérés nincs, akkor sem, ha nincs engedély
3. **Főmenü Start gomb** (`MainMenu.handleStart`, `async`): `needsCameraConsent(cameraConsent)`
   - kell engedély → `setCameraConsentOrigin("start")` + `cameraConsent` fázis → jóváhagyás után **`missionSelect`**
   - nem kell → egyből `transitionTo("missionSelect")`
4. **Settings kamera-sor** — három állapot, a böngészőtől kérdezve (`getCameraPermissionState()`), nem a tárolt consentből:
   - böngésző engedély `"denied"` → „Kamera letiltva a böngészőben" + **„Hogyan engedélyezzem?"** gomb → `CameraHelpModal`. **NEM** a consent screen: onnan nincs kiút (lásd 11. fejezet)
   - tárolt consent `"granted"` → ✅ „Kamera elérhető"
   - egyébként → „Kamera engedélyezése" gomb: `setCameraConsentOrigin("settings")` → `cameraConsent` fázis → jóváhagyás után **`mainMenu`**
5. A screenen **Engedélyez** → `getUserMedia({ video: true })` (böngésző natív prompt) → siker esetén `persistCameraConsent("granted")` (fire-and-forget) → navigáció az origin szerint
6. **Elutasít** (UI szinten) vagy böngészőben elutasított prompt → `persistCameraConsent("denied")` (+ hiba esetén error toast) → `mainMenu`
7. **F5 oldalfrissítés**: mivel GamePhase (`"cameraConsent"`), a Zustand persist megőrzi a fázist → ugyanazt az oldalt látja újra. A `cameraConsentOrigin` NEM perzisztált, tehát F5 után `"boot"`-ra esik vissza → a jóváhagyás a főmenübe visz, nem indít küldetést

> ⚠️ **Különbség a korábbi implementációhoz képest:**
> 1. A consent állapot már nem csak `useUIStore`-ben (lokális Zustand state) él, hanem a `users/{rtdbKey}/settings/cameraConsent` RTDB mező a source of truth; a `useUIStore` lokális gyorsítótár.
> 2. A tárolt consent **önmagában nem elég** — a `needsCameraConsent` a böngésző engedélyét is megkérdezi (lásd 4. fejezet).
> 3. A CameraConsentScreen **navigálhat `missionSelect`-be**, de kizárólag `origin === "start"` esetén.

---

## Döntések

| Kérdés | Választás |
|--------|-----------|
| Elhelyezés a roadmapen | **14. lépés** — a 013-social-multiplayer után, a 015-toast-notification / 019 előtt |
| Hol él a consent állapot? | **Firebase RTDB** `users/{rtdbKey}/settings/cameraConsent` — a `useUIStore.cameraConsent` lokális cache |
| Milyen típusú a screen? | **Teljes képernyős GamePhase oldal** (`"cameraConsent"` fázis), nem modál. F5 után is ugyanaz az oldal jön vissza |
| Mikor jelenik meg? | Ha `needsCameraConsent()` igazat ad: a tárolt consent nem `"granted"`, **vagy** a böngésző engedélye `"denied"` / `"prompt"` |
| Honnan lehet ide jutni? | **Három belépési pont:** intró utáni első betöltés (`"boot"`), főmenü Start gomb (`"start"`), Settings „Kamera engedélyezése" (`"settings"`) |
| Honnan tudja, hova térjen vissza? | `useUIStore.cameraConsentOrigin` (`CameraConsentOrigin` típus). **Nem perzisztált** — F5 után a biztonságos `"boot"` default |
| Mi történik ha a böngésző promptot ENGEDÉLYEZI? | `origin === "start"` → **`missionSelect`** (a user maga nyomta a Startot). `origin === "boot"` vagy `"settings"` → **`mainMenu`** |
| Indulhat-e a játék magától? | **Nem.** Csak `origin === "start"` esetén megy tovább a hajó-/küldetésválasztóra; minden más út a főmenübe tér vissza |
| Mi történik UI "Elutasítás" után? | `persistCameraConsent("denied")` → `mainMenu`. A következő Start gomb újra ide navigál |
| Mi történik ha a böngésző promptot ELUTASÍTJA? | `persistCameraConsent("denied")` + error toast (`app.camera.*`, 7000 ms) → `mainMenu` (a böngészőszintű tiltás felülírja az UI szándékot) |
| Milyen sorrendben fut a prompt és a mentés? | **Előbb `getUserMedia`** (a kattintás user gesture-én belül — Safari követelmény), **utána** `persistCameraConsent` fire-and-forget. Az RTDB round tripre nem vár a navigáció |
| Start gomb viselkedése ha nincs engedély | **Nem** letiltás, hanem `origin = "start"` + `transitionTo("cameraConsent")` → a user újra látja a teljes képernyős tájékoztatót és újra dönthet |
| Start gomb viselkedése ha van engedély | Egyből `transitionTo("missionSelect")` — nincs felesleges prompt |
| „Intro" gomb a menüből | `setIntroReplay(true)` → az intró végén mindig `mainMenu`, **soha nincs engedélykérés** (a visszanézés nem játékindítás) |
| Elég-e a tárolt `"granted"`? | **Nem.** A consent az account minden eszközén ugyanaz; mondhatja azt, hogy `"granted"` egy olyan böngészőben, ami sosem adott engedélyt. Ezért **kettős kapu**: tárolt consent + Permissions API |
| Permissions API hiánya (Firefox/Safari) | `getCameraPermissionState()` → `"unknown"` → a tárolt consentre hagyatkozunk (nem blokkolunk feleslegesen) |
| Hányszor nyílik meg a kamera a jóváhagyástól a cockpitig? | **Kettő:** consent screen (prompt, azonnal lezárt stream) + `useCamera` élő stream. A korábbi harmadik nyitás (`App.checkCamera`) törölve |
| Settings gomb "Kamera engedélyezése" | Ha `cameraConsent !== "granted"` → `origin = "settings"` + `transitionTo("cameraConsent")`. `"granted"` esetén ✅ + „Kamera elérhető" |
| **Böngésző-szintű `denied` a Settingsben** (2026-07-29, L. blokk) | **Nem** a consent screen, hanem **súgó modal** (`CameraHelpModal`). Indok: `denied` állapotból a `getUserMedia` **prompt nélkül**, azonnal `NotAllowedError`-ral dob → az „Engedélyez" gomb zsákutca (elutasítás → toast → visszapattanás a főmenübe), és a user nem tudja meg, mit kellene tennie |
| Honnan tudja a Settings, hogy `denied`? | **A böngészőtől kérdezi**, mountkor `getCameraPermissionState()`-tel — nem a tárolt `cameraConsent`-ből. A kettő eltérhet (a consent az account minden eszközén ugyanaz, a böngésző engedély origin- és eszközfüggő) |
| A Settings kamera-sor állapotai | **Három**, ebben a prioritásban: `denied` (böngésző) → „Hogyan engedélyezzem?" · `cameraConsent === "granted"` → ✅ · egyébként → „Kamera engedélyezése" |
| Mit tartalmaz a súgó modal? | Böngésző-specifikus **3 lépés** a tényleg látható menüpontok nevével, `navigator.userAgent` alapján: `chrome` (Chrome/Edge/Brave/Opera — közös Chromium site-settings UI), `firefox`, `safari`, `generic` fallback |
| UA-sniffing — miért megengedett itt? | Mert **nem funkció-döntést** hoz (arra a feature detection való), hanem **menüneveket ír ki**. A legrosszabb eset egy félrenevezett menüpont, nem törött működés |
| Modal footer | „Bezárás" + **„Oldal újratöltése"** (`window.location.reload()`) — a böngészőben módosított engedély csak újratöltés után látszik a lapon |
| Modal alapja | A meglévő `src/components/ui/Modal.tsx` (Escape-zárás, overlay-kattintás, footer slot) — nem új modal-infrastruktúra |
| Vendég (anonim) user | **Ugyanúgy működik.** A `rtdbKey` vendégnél a `deviceId`, a `users/{deviceId}/settings/cameraConsent` alá ír. Nincs különbség a flow-ban |
| Perzisztencia oldalfrissítéskor | A `useGameStore` partialize menti a `gamePhase`-t, így F5 után a `"cameraConsent"` fázis visszaáll. A `useAuthStore` betöltése után a `cameraConsent` a Firebase-ből szinkronizálódik a `useUIStore`-ba |
| i18n | `app.cameraConsent.*` + `app.camera.*` + `settings.enableCamera` / `settings.cameraGranted` + `mainMenu.cameraRequired` kulcsok mind az 5 nyelven |

---

## ✅ Haladás (TODO)

> Jelölés: `[ ]` hátravan · `[~]` folyamatban · `[x]` kész.

**A. Firebase UserNode bővítése — cameraConsent mező**
- [x] `src/firebase/userData.ts`: `UserNode.settings` kibővítése `cameraConsent` mezővel
- [x] `src/firebase/userData.ts`: `getDefaultUserNode()`-ban `settings.cameraConsent = "undecided"` alapértelmezett
- [x] `src/firebase/userData.ts`: `updateUserSettings`-ben `cameraConsent` mező támogatása

**B. useUIStore — cameraConsent local cache + Firebase sync helper**
- [x] `cameraConsent` mező megtartva (lokális cache)
- [x] Új `persistCameraConsent(status)` action — ír a Firebase-be + frissíti a lokális state-et
- [x] `CameraConsent` típus exportálva
- [x] Új `cameraConsentOrigin` mező + `setCameraConsentOrigin` setter, default `"boot"` (**nem** perzisztált)
- [x] `CameraConsentOrigin` típus exportálva (`"boot" | "start" | "settings"`)
- [x] Új `introReplay` mező + `setIntroReplay` setter, default `false` (**nem** perzisztált)

**C. CameraConsentScreen komponens (új, teljes oldal)**
- [x] `CameraConsentScreen.tsx` + `CameraConsentScreen.module.css` létrehozva
- [x] Elrendezés: full-screen dark gradient háttér + starfield animáció, középen glass-morphism panel
- [x] Tartalom: 📷 ikon, cím, leírás (adatvédelem, arcfelismerés, képek nem kerülnek szerverre)
- [x] Két gomb: "Engedélyez" (primary, kék gradient) és "Elutasít" (secondary, szürke)
- [x] Engedélyez flow **új sorrendben**: `getUserMedia` (user gesture-ön belül) → track-ek leállítása → `void persistCameraConsent("granted")` → navigáció
- [x] Navigáció origin szerint: `origin === "start"` → `missionSelect`, egyébként `mainMenu`
- [x] Hiba flow: `getUserMedia` hiba esetén konkrét ok (NotAllowedError / NotFoundError / NotReadableError) → `app.camera.*` error toast (7000 ms) → `persistCameraConsent("denied")` → `mainMenu`
- [x] Hiba banner ELTÁVOLÍTVA (helyette toast notification — 2026-07-29 refactor)
- [x] `addToast` a `useToastStore`-ból importálva
- [x] `useEffect` a régi error tisztításra ELTÁVOLÍTVA (a toast magától eltűnik)
- [x] LanguageSwitcher a jobb felső sarokban (a user a saját nyelvén olvashatja a tájékoztatót)
- [x] Spinner processing állapot (`isProcessing` state)
- [x] Animációk: fadeIn + slideUp, star twinkle
- [x] Reszponzív: mobile-on flex-direction: column a gomboknak

**D. GamePhase + routing — cameraConsent fázis**
- [x] `GamePhase` típusban `"cameraConsent"` már szerepelt ✅
- [x] `phaseToFlags("cameraConsent")` már megvolt ✅
- [x] `ScreenRouter.tsx`: `"cameraConsent"` → `<CameraConsentScreen />` (modál helyett)

**E. App.tsx — belépési pontok + Firebase sync**
- [x] `handleSkipIntro`: `introReplay === true` → `setIntroReplay(false)` + `mainMenu` (nincs engedélykérés)
- [x] `handleSkipIntro`: első betöltésnél `needsCameraConsent()` → origin `"boot"` + `cameraConsent` fázis, egyébként `mainMenu`
- [x] `handleUserData` callback: ha `data.settings.cameraConsent` létezik, szinkronizálja `useUIStore`-ba
- [x] Rehidratálás: auto-check `persistCameraConsent("granted")`-t használ (Firebase-be is ír)
- [x] `isPreGame` listában `"cameraConsent"` már szerepelt ✅

**F. MainMenu — Start és Intro gomb**
- [x] `handleStart` **async**: `await needsCameraConsent(ui.cameraConsent)` → ha kell, origin `"start"` + `transitionTo("cameraConsent")`, egyébként `transitionTo("missionSelect")`
- [x] Start gomb SOHA nincs disabled — mindig kattintható
- [x] Tooltip és disabled prop eltávolítva (gomb mindig működik)
- [x] `handleIntro`: `setIntroReplay(true)` → `transitionTo("intro")`

**G. Settings — Kamera engedélyezése gomb**
- [x] `handleEnableCamera`: `setCameraConsentOrigin("settings")` → `transitionTo("cameraConsent")`
- [x] Ha `cameraConsent === "granted"`: ✅ ikon + "Kamera elérhető" szöveg
- [x] Ha `cameraConsent !== "granted"`: "Kamera engedélyezése" gomb

**H. Kettős kapu — `services/cameraPermission.ts` (ÚJ)**
- [x] `getCameraPermissionState()` — Permissions API `camera` descriptor, hiány/throw esetén `"unknown"`
- [x] `needsCameraConsent(consent)` — a tárolt consent + a böngésző engedély együttes vizsgálata
- [x] Bekötve: `App.handleSkipIntro`, `MainMenu.handleStart`, `App.checkCamera` (csak `"denied"` blokkol)

**I. Jóváhagyás utáni lánc — a „nem indul el a játék" hiba javítása**
- [x] `App.checkCamera`: `getUserMedia` hívás **eltávolítva**; marad `navigator.mediaDevices` + `window.FaceDetection` ellenőrzés + `getCameraPermissionState() === "denied"`
- [x] `App.checkCamera`: `failWith` helper — minden hibaág `setCameraError` **és** error toast (a `cameraError` overlay pre-game nem látszik)
- [x] `src/constants/constants.ts`: új `CAMERA_OPEN_RETRY_DELAYS_MS = [300, 700]`
- [x] `useCamera.openStream()`: retry **kizárólag** `NotReadableError` / `AbortError` esetén, minden várakozás után `isCancelled` ellenőrzés
- [x] `useCamera`: hardkódolt magyar hibaszövegek helyett `i18n.t("app.camera.*")`
- [x] `useFaceDetection`: `cameraError` feliratkozott érték (`useUIStore((s) => s.cameraError)`) + dep-listában
- [x] `useFaceDetection`: a korai ág `setIsInitializing(false)`-t hív, ha `!destination || cameraError` (különben a LoadingScreen örökké pörög)
- [x] `App.tsx` pre-game ág: `gamePhase === "loading" && cameraError` → blokkoló hibakártya „Vissza a menübe" gombbal (`setCameraError(null)` + `resetToMenu()`)

**J. i18n — kulcsok (léteznek, ellenőrizve)**
- [x] `app.cameraConsent.*` névtér megléte ellenőrizve mind az 5 locale-ban (en, hu, fr, de, es) ✅
- [x] `app.camera.noSupport` / `noModel` / `needAccess` / `denied` / `notFound` / `notReadable` — mind az 5 nyelven léteznek ✅
- [x] `settings.enableCamera`, `settings.cameraGranted` — léteznek
- [x] `mainMenu.cameraRequired` — létezik

**K. Tesztek + validáció**
- [x] `npx tsc --noEmit` tiszta ✅
- [x] `npm run test` zöld — 84/84 ✅
- [x] `npm run build` sikeres ✅ (2,791 kB chunk warning — pre-existing)
- [ ] CameraConsentScreen megjelenik intro után (manuális teszt)
- [ ] F5 a consent screen-en → ugyanazt a screen-t látod, és jóváhagyás után **főmenü** (origin `"boot"`-ra esett vissza)
- [ ] Intró utáni engedélyezés → **mainMenu**, a játék nem indul magától
- [ ] Menü „Intro" gomb → intró → **mainMenu**, semmilyen engedélykérés (engedély nélkül is)
- [ ] Start gomb engedély nélkül → consent screen → grant → **missionSelect** → küldetés indul, cockpit megjelenik
- [ ] Start gomb meglévő engedéllyel → egyből missionSelect, nincs prompt
- [ ] Böngészőben visszavont engedély + tárolt `"granted"` → Start gomb újra a consent screenre visz (kettős kapu)
- [ ] Elutasítás → mainMenu, Start → vissza a consent screen-re
- [ ] Vendég (anonymous) user → ugyanaz a flow
- [ ] Settings "Kamera engedélyezése" → consent screen → grant → **mainMenu**
- [ ] Kamera hiba a `loading` fázisban → blokkoló hibakártya, nem végtelen spinner

**L. Böngésző-szintű `denied` feloldása — kamera súgó modal a Settingsben (2026-07-29)**

> **Tünet:** ha a böngésző `denied` állapotba tette a kamerát erre az originre, a Settings „Kamera engedélyezése" gombja a consent screenre vitt, ahol az „Engedélyez" **azonnal** elbukott (`NotAllowedError`, prompt nélkül) → error toast → vissza a főmenübe. Zsákutca, és a user nem tudta meg, hogyan oldható fel.
> **Ok:** a `denied` engedélyt **JavaScriptből nem lehet visszakérni** — a `getUserMedia` prompt nélkül, azonnal elutasít. Kizárólag a felhasználó tudja feloldani a böngésző saját felületén. Részletek: 11. fejezet.

- [x] **Új fájl:** `src/components/screens/CameraHelpModal.tsx` — a meglévő `ui/Modal.tsx`-re épül (Escape-zárás, overlay-kattintás, footer slot)
- [x] **Új fájl:** `src/components/screens/CameraHelpModal.module.css` (`.intro`, `.browserName`, `.steps`, `.note`, `.primaryBtn`, `.secondaryBtn`)
- [x] `detectBrowser()` — `navigator.userAgent` alapú `BrowserKind` (`chrome` | `firefox` | `safari` | `generic`); Chromium-forkok (Edge/Brave/Opera) a `chrome` ágon. `useMemo`-val egyszer fut
- [x] Kódkommentben rögzítve, **miért helyénvaló itt a UA-sniffing**: nem funkció-döntés, hanem menünevek kiírása
- [x] Tartalom: `intro` bekezdés + böngésző neve + **3 lépéses `<ol>`** + `reloadNote` megjegyzés
- [x] Footer: „Bezárás" (`onClose`) + „Oldal újratöltése" (`window.location.reload()`)
- [x] `SettingsScreen.tsx` — új `cameraPermission` state (`CameraPermissionState`, default `"unknown"`), mountkor `getCameraPermissionState()`-tel feltöltve, `cancelled` őrrel az unmount ellen
- [x] `SettingsScreen.tsx` — új `cameraHelpOpen` state + `<CameraHelpModal>` render a képernyő végén
- [x] `SettingsScreen.tsx` — `isCameraBlocked = cameraPermission === "denied"`; a kamera-sor **háromállapotú** (label + control egyaránt)
- [x] `denied` ág: „Kamera letiltva a böngészőben" + „Hogyan engedélyezzem?" gomb → modal (**NEM** `transitionTo("cameraConsent")`)
- [x] A `granted` (✅) és a „Kamera engedélyezése" ág változatlan (`handleEnableCamera` → origin `"settings"`)
- [x] i18n: új `settings.cameraBlocked` kulcs mind az 5 nyelven
- [x] i18n: új `settings.cameraHelp.*` névtér — `button`, `title`, `intro`, `reloadNote`, `close`, `reload`, valamint `chrome` | `firefox` | `safari` | `generic` × `name` / `step1` / `step2` / `step3`
- [x] i18n paritás ellenőrizve: **396/396 kulcs nyelvenként** (en, hu, fr, de, es)
- [x] `npx tsc --noEmit` tiszta ✅ · `npm run test` **84/84** zöld ✅ · `npm run build` sikeres ✅
- [ ] Manuális teszt: böngészőben letiltott kamera → Settings → „Hogyan engedélyezzem?" → a **saját** böngésző lépései jelennek meg
- [ ] Manuális teszt: feloldás a böngészőben → „Oldal újratöltése" → a kamera-sor visszavált „Kamera engedélyezése"-re

---

## 1. Flow diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│           HÁROM BELÉPÉSI PONT — a cameraConsentOrigin dönt                │
│                                                                          │
│  ① BOOT (első betöltés)     ② START gomb          ③ SETTINGS gomb        │
│  ┌────────┐                 ┌──────────┐          ┌──────────┐           │
│  │ Intro  │                 │ MainMenu │          │ Settings │           │
│  └───┬────┘                 └────┬─────┘          └────┬─────┘           │
│      │ introReplay?              │ handleStart          │ handleEnable-  │
│      │                           │  (async)             │  Camera        │
│      ├── true ──→ mainMenu       │                      │                │
│      │   (setIntroReplay(false), │                      │                │
│      │    SEMMI engedélykérés)   │                      │                │
│      │                           │                      │                │
│      └── false                   │                      │                │
│          ↓                       ↓                      ↓                │
│    needsCameraConsent()    needsCameraConsent()   origin="settings"      │
│          │                       │                      │                │
│     nem kell → mainMenu     nem kell → missionSelect     │               │
│          │                       │                      │                │
│     origin="boot"           origin="start"               │               │
│          └───────────────┬───────┴──────────────────────┘                │
│                          ▼                                               │
│              ┌────────────────────────┐                                  │
│              │  CameraConsentScreen   │                                  │
│              └───────┬────────┬───────┘                                  │
│                  Allow        Deny                                       │
│                      │          │                                        │
│                      ▼          ▼                                        │
│           ┌──────────────────┐  persist("denied") → mainMenu             │
│           │ getUserMedia()   │  (a user gesture-ön belül fut)            │
│           │ böngésző prompt  │                                           │
│           └───┬──────────┬───┘                                           │
│        Granted│          │Denied / hiba                                  │
│               ▼          ▼                                               │
│  void persist("granted")  addToast(app.camera.*) +                       │
│               │           void persist("denied") → mainMenu              │
│               ▼                                                          │
│      origin === "start" ? missionSelect : mainMenu                       │
│                                                                          │
│ FONTOS: a küldetés CSAK akkor indulhat, ha a user maga nyomta a Startot   │
│ (origin === "start"). Minden más belépési pont a főmenübe tér vissza,     │
│ és az F5 utáni "boot" default miatt frissítés sem indíthat játékot.       │
└──────────────────────────────────────────────────────────────────────────┘
```

## 2. Firebase UserNode bővítés

```typescript
// src/firebase/userData.ts
interface Settings {
  activeShipId: string | null;
  activeMusicId: string | null;
  musicMuted: boolean;
  musicVolume: number;
  difficulty: string;
  language: string;
  cameraConsent: "undecided" | "granted" | "denied";  // ← NEW
}
```

## 3. useUIStore bővítés

```typescript
export type CameraConsent = "undecided" | "granted" | "denied";

/** Mi vitte a consent screenre — ez dönti el, hova tér vissza. */
export type CameraConsentOrigin = "boot" | "start" | "settings";

interface UIState {
  cameraConsent: CameraConsent;                    // local cache (RTDB a source of truth)
  cameraConsentOrigin: CameraConsentOrigin;        // NEM perzisztált, default "boot"
  introReplay: boolean;                            // NEM perzisztált, default false

  setCameraConsent: (status: CameraConsent) => void;             // local only
  persistCameraConsent: (status: CameraConsent) => Promise<void>; // local + Firebase
  setCameraConsentOrigin: (origin: CameraConsentOrigin) => void;
  setIntroReplay: (replay: boolean) => void;
  // ...
}
```

Miért nem perzisztált az origin: F5 után a consent screenen a szándék elveszik. Ha a `"start"` origin túlélné a frissítést, egy oldalújratöltés magától küldetésbe dobná a játékost. A `"boot"` default a biztonságos: legrosszabb esetben a user még egyszer megnyomja a Startot.

`persistCameraConsent` implementáció:
```typescript
persistCameraConsent: async (status) => {
  set({ cameraConsent: status });                 // 1. lokális state azonnal
  const rtdbKey = getRtdbKey();
  if (rtdbKey) {
    try {
      await updateUserSettings(rtdbKey, { cameraConsent: status });  // 2. RTDB
    } catch (err) {
      console.error("Failed to persist cameraConsent:", err);
    }
  }
}
```

## 4. Kettős kapu — `src/services/cameraPermission.ts` (ÚJ)

A `cameraConsent` az RTDB-ben él, tehát az **account minden eszközén ugyanaz**. Ezért mondhatja azt, hogy `"granted"` egy olyan böngészőben, amelyik sosem adott engedélyt (új gép, másik böngésző, visszavont engedély). Korábban pontosan ez vitte a felhasználót néma hibába: a Start gomb átengedte, majd a küldetésindítás csendben elhalt.

```typescript
export type CameraPermissionState = "granted" | "denied" | "prompt" | "unknown";

/** A böngésző saját kamera-engedélye erre az origin-ra. */
export const getCameraPermissionState = async (): Promise<CameraPermissionState> => {
  if (!navigator.permissions?.query) return "unknown";
  try {
    const status = await navigator.permissions.query({ name: "camera" as PermissionName });
    return status.state as CameraPermissionState;
  } catch {
    return "unknown";   // Firefox / régebbi Safari: nincs "camera" descriptor
  }
};

/** Kell-e consent screen, mielőtt a játék futhat? */
export const needsCameraConsent = async (consent: CameraConsent): Promise<boolean> => {
  if (consent !== "granted") return true;          // 1. kapu: tárolt UI consent
  const state = await getCameraPermissionState();  // 2. kapu: böngésző engedély
  return state === "denied" || state === "prompt";
};
```

- `"unknown"` (Permissions API hiánya) → **nem** blokkolunk: a tárolt consentre hagyatkozunk, a `getUserMedia` úgyis eldönti a kérdést.
- Hívók: `App.handleSkipIntro`, `MainMenu.handleStart`. Az `App.checkCamera` csak a `getCameraPermissionState()`-et használja, és kizárólag a `"denied"` állapotra blokkol.
- **2026-07-29 (L. blokk):** a `getCameraPermissionState()` harmadik hívója a `SettingsScreen` — mountkor, hogy a kamera-sor meg tudja különböztetni a „még nem döntött" és a „böngésző letiltotta" esetet (11.3). Ez az egyetlen hely, ahol a `"denied"` állapotnak **saját UI-ja** van.

## 5. CameraConsentScreen komponens (teljes oldal)

```tsx
const handleAllow = async () => {
  if (isProcessing) return;
  setIsProcessing(true);

  // A böngésző prompt megy ELŐSZÖR. A kattintás user gesture-én belül kell
  // futnia (Safari követelmény), és egy megelőző `await persistCameraConsent`
  // késleltetheti — akadó kapcsolatnál el is nyelheti — a promptot.
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    stream.getTracks().forEach((track) => track.stop());
  } catch (err) {
    let errorKey = "app.camera.needAccess";
    if (err instanceof DOMException) {
      switch (err.name) {
        case "NotAllowedError":  errorKey = "app.camera.denied";      break;
        case "NotFoundError":    errorKey = "app.camera.notFound";    break;
        case "NotReadableError": errorKey = "app.camera.notReadable"; break;
      }
    }
    addToast("error", t(errorKey), 7000);
    void persistCameraConsent("denied");   // a következő Start újra idehoz
    setIsProcessing(false);
    transitionTo("mainMenu");
    return;
  }

  // Mindkét kapu nyitva. Az RTDB írás fire-and-forget: a lokális state
  // szinkron frissül, a navigációnak nem kell megvárnia a round tripet.
  void persistCameraConsent("granted");

  // Csak a Start gombról érkező jóváhagyás mehet tovább a játékba.
  transitionTo(consentOrigin === "start" ? "missionSelect" : "mainMenu");
};

const handleDeny = () => {
  if (isProcessing) return;
  void persistCameraConsent("denied");
  transitionTo("mainMenu");
};
```

A screen tartalma változatlan: starfield háttér, glass-morphism panel, 📷 ikon, `app.cameraConsent.title` / `.description`, jobb felső sarokban LanguageSwitcher, két gomb spinnerrel.

## 6. Belépési pontok kódja

```tsx
// MainMenu.tsx — Start gomb (async!)
const handleStart = async () => {
  const ui = useUIStore.getState();
  if (await needsCameraConsent(ui.cameraConsent)) {
    ui.setCameraConsentOrigin("start");   // a jóváhagyás után indulhat a küldetés
    transitionTo("cameraConsent");
    return;
  }
  transitionTo("missionSelect");
};

// MainMenu.tsx — Intro gomb: visszanézés, nem játékindítás
const handleIntro = () => {
  useUIStore.getState().setIntroReplay(true);
  transitionTo("intro");
};

// App.tsx — handleSkipIntro
const handleSkipIntro = useCallback(() => {
  const ui = useUIStore.getState();
  if (ui.introReplay) {                    // menüből visszanézett intró
    ui.setIntroReplay(false);
    useGameStore.getState().transitionTo("mainMenu");
    return;                                // SEMMILYEN engedélykérés
  }
  needsCameraConsent(ui.cameraConsent).then((needed) => {
    if (needed) {
      ui.setCameraConsentOrigin("boot");
      useGameStore.getState().transitionTo("cameraConsent");
    } else {
      useGameStore.getState().transitionTo("mainMenu");
    }
  });
}, []);

// SettingsScreen.tsx
const handleEnableCamera = useCallback(() => {
  useUIStore.getState().setCameraConsentOrigin("settings");
  transitionTo("cameraConsent");
}, [transitionTo]);
```

> ℹ️ **A `handleEnableCamera` maga változatlan, de már csak a harmadik ágon fut.** Ha a böngésző engedélye `"denied"`, a Settings **nem** ide navigál, hanem a `CameraHelpModal`-t nyitja — onnan a consent screen zsákutca lenne (11. fejezet).

## 7. A jóváhagyás UTÁNI lánc — a valódi „nem indul el a játék" hiba

**Tünet:** a user engedélyezte a kamerát, kiválasztotta a küldetést, majd a LoadingScreen **végtelenül pörgött**, hibaüzenet nélkül.

**Ok — háromszoros kameranyitás:**

| # | Hol | Mit csinált |
|---|-----|-------------|
| 1 | `CameraConsentScreen.handleAllow` | `getUserMedia` → azonnal `stop()` (prompt kiváltása) |
| 2 | `App.checkCamera` (hajóválasztó) | `getUserMedia` → azonnal `stop()` (puszta ellenőrzés) |
| 3 | `useCamera` | élő stream a cockpithoz |

Windows alatt a webcam **nem szabadul fel azonnal** az előző handle lezárása után → a 3. nyitás `NotReadableError` / `AbortError`-ral bukott. Ilyenkor `isStreamReady` false maradt, a `useFaceDetection` korai ága pedig a `setIsInitializing(false)`-t az `if (!destination)` mögött tartotta → `isInitializing` **örökre true** → a LoadingScreen soha nem tűnt el. A `cameraError` overlay ráadásul csak a játék ágban renderelődött, a `loading` viszont `isPreGame` → **semmilyen hibaüzenet nem jelent meg**.

**Javítások:**

1. **`src/App.tsx` — `checkCamera`:** nincs többé `getUserMedia`. Marad a `navigator.mediaDevices` + `window.FaceDetection` ellenőrzés, plusz `getCameraPermissionState() === "denied"` → hiba. Minden hibaág **toastot is dob** (`failWith` helper), mert a `cameraError` overlay pre-game nem látszik:
   ```typescript
   const failWith = (message: string) => {
     setCameraError(message);
     useToastStore.getState().addToast("error", message, 7000);
     return false;
   };
   ```
2. **`src/constants/constants.ts`:** új `CAMERA_OPEN_RETRY_DELAYS_MS = [300, 700]` — a lista hossza a retry-k száma.
3. **`src/hooks/useCamera.ts`:** `openStream()` retry **kizárólag** `NotReadableError` / `AbortError` esetén (a megtagadott engedély vagy hiányzó eszköz végleges, első próbálkozásra dob); minden várakozás után `isCancelled` ellenőrzés. A hardkódolt magyar hibaszövegek helyett `i18n.t("app.camera.*")` — a hook nem komponens, ugyanaz az `i18n.t()` minta, mint az `ErrorBoundary`-nál.
4. **`src/hooks/useFaceDetection.ts`:** a `cameraError` mostantól **feliratkozott** érték (`useUIStore((s) => s.cameraError)`) és benne van a useEffect dep-listájában; a korai ág `setIsInitializing(false)`-t hív, ha `!destination || cameraError`.
5. **`src/App.tsx` pre-game ág:** `gamePhase === "loading" && cameraError` esetén blokkoló hibakártya „Vissza a menübe" gombbal (`setCameraError(null)` + `resetToMenu()`). A többi pre-game képernyő toastot használ és használható marad, ezért csak a loading kap blokkoló kártyát.

**Eredmény:** a jóváhagyástól a cockpitig már csak **két** kameranyitás van (consent screen + élő stream), a maradék device-busy ütközést pedig a retry hidalja át. Ha mégis végleges a hiba, a felhasználó **látja** és vissza tud lépni a menübe.

## 8. Biztonság

- A `getUserMedia` hívás **soha** nem küld adatot szerverre — csak a böngésző biztonsági sandbox-jában fut
- A `cameraConsent` Firebase-ben tárolása csak az állapotot rögzíti, nem a kameraképet
- A settings írásához `auth.uid` szükséges — vendégnél `device_map/{deviceId}` → `auth.uid` mapping alapján
- Ha a user később visszavonja a böngésző szintű engedélyt, a `needsCameraConsent` kettős kapuja ezt a **következő Start gombnál** elkapja (nem csak a `getUserMedia` hibájából derül ki), és a flow újraindul
- A consent screen a prompt után **azonnal lezárja** a stream track-eket — a kamera nem marad nyitva a menüben

## 9. Függőségek

- **Előfeltétel:** [[001-main-menu-settings]] — MainMenu és SettingsScreen komponensek
- **Előfeltétel:** [[003-firebase-auth-settings]] — Firebase auth + RTDB user node
- **Használja:** [[015-toast-notification]] toast rendszerét a kamera-hibák jelzésére (a pre-game `cameraError` overlay nem látszik)
- **Használja (L. blokk):** a meglévő `src/components/ui/Modal.tsx` generikus modalt a `CameraHelpModal` alapjaként ([[001-main-menu-settings]] UI-készlete) — nincs új modal-infrastruktúra
- **Nem függ:** shop-tól, social funkcióktól
- **Blokkolja:** a játék indítását (nincs kamera consent → nincs játék)

## 10. Kockázatok

- **iOS Safari user gesture:** a `getUserMedia` csak user gesture-ből hívható. Ezért fut a prompt a `handleAllow` **elején**, minden `await` előtt — egy megelőző RTDB írás megszakítaná a gesture-láncot
- **Permissions API hiánya (Firefox / régebbi Safari):** `"unknown"` → a tárolt consentre hagyatkozunk, és a `getUserMedia` hibájából derül ki a valóság. Ilyen böngészőben a kettős kapu felső fele nem véd
- **Device-busy retry:** a `[300, 700]` ms backoff empirikus. Ha egy másik alkalmazás **tartósan** fogja a kamerát, a retry sem segít — ilyenkor a `notReadable` hiba a loading hibakártyán jelenik meg
- **Vendég user:** a `rtdbKey` = `deviceId`, a `users/{deviceId}/settings` írásához a `device_map/{deviceId}` szükséges. Az auth bootstrap (`ensureDeviceMap`) ezt garantálja
- **Fire-and-forget persist:** a `void persistCameraConsent("granted")` után azonnal navigálunk. Ha az RTDB írás elbukik, a lokális state akkor is `"granted"` — a következő betöltéskor a Firebase-ből érkező érték felülírhatja. Elfogadott: a kettős kapu miatt legrosszabb esetben egyszer újra megjelenik a consent screen
- **Konkurens írás:** a `persistCameraConsent` nem használ tranzakciót — két tab egyidejű consent váltása ritka, elfogadott kockázat
- **A súgó lépések elavulhatnak (L. blokk):** a `settings.cameraHelp.*` szövegek konkrét böngésző-menüpontokra hivatkoznak, amiket a gyártók verzióról verzióra átneveznek. A hiba **néma**: a modal megjelenik, csak rossz menüpontot nevez meg. Enyhítés: a lépések végén mindig ott az „engedélyek visszaállítása / alapértelmezett" általánosabb út, és a `generic` fallback nem hivatkozik konkrét feliratra
- **UA-sniffing sorrendfüggése (L. blokk):** a `Safari/` teszt **csak** a Chromium-ág után futhat (a Chromium UA-ja is tartalmazza a `Safari/`-t). Egy sorrendcsere némán Safari-lépéseket adna a Chrome-os felhasználóknak
- **`"unknown"` engedély-állapot (L. blokk):** Permissions API nélküli böngészőben a Settings nem tudja, hogy `denied` — a súgó modal ott nem érhető el, a felhasználó a consent screen hibatoastjánál ragad. Elfogadott, a régi viselkedéssel azonos
- **F5 utáni állapot:** a `useGameStore` partialize menti a `gamePhase`-t. Ha `"cameraConsent"` fázisban történik az F5, a fázis visszaáll, az origin viszont `"boot"`-ra esik — a jóváhagyás a főmenübe visz. Szándékos: frissítés nem indíthat küldetést

## 11. Kamera súgó modal — a `denied` zsákutca feloldása (L. blokk, 2026-07-29)

### 11.1 Miért nem elég a consent screen

A böngésző kamera-engedélyének **három** állapota van, és a harmadikkal a consent screen nem tud mit kezdeni:

| Böngésző engedély | `getUserMedia` viselkedése | Mit tehet a consent screen? |
|---|---|---|
| `"prompt"` | Natív engedélykérő ablakot nyit | ✅ Ez a képernyő dolga |
| `"granted"` | Azonnal ad streamet | ✅ Átenged |
| `"denied"` | **Prompt nélkül**, azonnal `NotAllowedError` | ❌ **Semmit** — a JS nem tudja újra kérni |

A `denied` **origin-szintű, ragadós** állapot: a böngésző megjegyzi, és csak a felhasználó törölheti a saját felületén. Ezért a korábbi út (`Settings → cameraConsent → Engedélyez`) egy **zárt kör** volt:

```
Settings „Kamera engedélyezése"
      ↓
CameraConsentScreen  →  Engedélyez  →  getUserMedia()
                                            ↓  (prompt SOHA nem jelenik meg)
                                       NotAllowedError
                                            ↓
                         error toast + persist("denied")  →  mainMenu
                                            ↓
                         a user pontosan ott van, ahol volt — csak most már tanácstalan
```

**A megoldás nem lehet technikai, csak tájékoztató:** meg kell mondani a felhasználónak, hogy a böngészője melyik menüpontjában oldhatja fel. Ehhez viszont **tudni kell, melyik böngészőben ül**.

### 11.2 `CameraHelpModal` — böngésző-specifikus lépések

```tsx
// src/components/screens/CameraHelpModal.tsx
type BrowserKind = "chrome" | "firefox" | "safari" | "generic";

const detectBrowser = (): BrowserKind => {
  const ua = navigator.userAgent;
  if (/Firefox\//.test(ua)) return "firefox";
  if (/Edg\/|Chrome\/|Chromium\//.test(ua)) return "chrome";
  if (/Safari\//.test(ua)) return "safari";
  return "generic";
};
```

> ⚠️ **UA-sniffing — itt szándékos, és nem a szokásos hiba.** Az általános tilalom oka az, hogy a UA-ból *képességre* következtetni törékeny (arra a feature detection való). Ez a modal viszont **nem hoz funkció-döntést**: menüpont-neveket ír ki. A `Safari/` teszt a `chrome` ág **után** fut, mert a Chromium is `Safari/`-t tesz a UA-jába. A legrosszabb eset egy félrenevezett menüpont a `generic` fallback helyett — nem törött működés.
>
> Chromium-forkok (Edge, Brave, Opera) **ugyanazt** a site-settings felületet használják, mint a Chrome, ezért egy ágon vannak. A `name` kulcs ki is írja mind a négyet, hogy a user felismerje a sajátját.

A modal a meglévő `src/components/ui/Modal.tsx`-re épül — abból jön az Escape-zárás, az overlay-kattintás és a footer slot; nem készült új modal-infrastruktúra.

**Tartalom:** `intro` (miért nem tudja a játék újra kérni) → böngésző neve → **3 lépéses `<ol>`** → `reloadNote`.
**Footer:** „Bezárás" + **„Oldal újratöltése"** (`window.location.reload()`). Az újratöltés gomb nem díszítés: a böngészőben átállított engedélyt a már betöltött lap **nem** veszi észre magától.

### 11.3 A Settings kamera-sor — három állapot

```tsx
// SettingsScreen.tsx — a böngészőt kérdezzük, nem a tárolt consentet
useEffect(() => {
  let cancelled = false;
  getCameraPermissionState().then((state) => {
    if (!cancelled) setCameraPermission(state);
  });
  return () => { cancelled = true; };
}, []);

const isCameraBlocked = cameraPermission === "denied";
```

| Sorrend | Feltétel | Felirat | Vezérlő |
|---|---|---|---|
| 1. | `cameraPermission === "denied"` | `settings.cameraBlocked` | „Hogyan engedélyezzem?" gomb → `CameraHelpModal` |
| 2. | `cameraConsent === "granted"` | `settings.cameraGranted` | ✅ |
| 3. | egyébként | `settings.enableCamera` | „Kamera engedélyezése" → `origin = "settings"` + `cameraConsent` fázis |

**Miért a böngészőtől kérdezünk?** Mert a `cameraConsent` az RTDB-ben él, tehát az account **minden eszközén ugyanaz** (4. fejezet). Egy `"granted"` tárolt consent mellett is állhat `denied`-en a böngésző — pont ez a kettős kapu létjogosultsága, és pont ez a sor prioritása is: a böngésző szava az erősebb.

**`"unknown"` (Permissions API hiánya, Firefox / régebbi Safari):** nem `denied` → a 2./3. ág fut, ugyanúgy, mint eddig. Ilyen böngészőben a súgó modal a Settingsből nem érhető el; a felhasználó a consent screen hibatoastját kapja. Elfogadott: a `getCameraPermissionState()` `"unknown"`-ja mindenhol a régi viselkedést jelenti.

### 11.4 i18n — új kulcsok

```
settings.cameraBlocked
settings.cameraHelp.button        # „Hogyan engedélyezzem?"
settings.cameraHelp.title
settings.cameraHelp.intro
settings.cameraHelp.reloadNote
settings.cameraHelp.close
settings.cameraHelp.reload
settings.cameraHelp.{chrome|firefox|safari|generic}.name
settings.cameraHelp.{chrome|firefox|safari|generic}.step{1,2,3}
```

Mind az 5 nyelven (`en`, `hu`, `fr`, `de`, `es`), paritás ellenőrizve: **396/396 kulcs nyelvenként**.

> ⚠️ **Fordítási buktató:** a `step*` szövegek **böngésző-menüpontokra hivatkoznak**. A fordítás akkor jó, ha az adott nyelvű böngésző **tényleges** menüfeliratát használja (pl. HU Chrome: „Engedélyek visszaállítása"), nem szó szerinti fordítást. Új nyelv felvételekor ezt külön ellenőrizni kell.

## 12. Érintett fájlok

```
src/services/cameraPermission.ts                  (ÚJ — getCameraPermissionState + needsCameraConsent)
src/components/screens/CameraConsentScreen.tsx    (ÚJ — teljes oldal, modál helyett; origin-alapú navigáció, getUserMedia elsőként)
src/components/screens/CameraConsentScreen.module.css  (ÚJ)
src/components/screens/CameraHelpModal.tsx        (ÚJ, L. blokk — böngésző-specifikus feloldási lépések + „Oldal újratöltése"; ui/Modal.tsx-re épül)
src/components/screens/CameraHelpModal.module.css (ÚJ, L. blokk)
src/components/features/CameraConsentModal.tsx    (TÖRLÉS — helyette CameraConsentScreen)
src/components/features/CameraConsentModal.module.css  (TÖRLÉS)
src/components/routing/ScreenRouter.tsx           (cameraConsent case → CameraConsentScreen)
src/components/screens/MainMenu.tsx               (handleStart async + needsCameraConsent + origin "start"; handleIntro → introReplay)
src/components/screens/SettingsScreen.tsx         (handleEnableCamera → origin "settings" + cameraConsent fázis;
                                                   L. blokk: +cameraPermission state (getCameraPermissionState mountkor, cancelled őr),
                                                   +cameraHelpOpen state, háromállapotú kamera-sor, <CameraHelpModal> render)
src/state/useUIStore.ts                           (+persistCameraConsent, +cameraConsentOrigin, +introReplay, CameraConsentOrigin típus)
src/firebase/userData.ts                          (UserNode.settings + updateUserSettings bővítés)
src/App.tsx                                       (handleSkipIntro introReplay/origin "boot"; checkCamera getUserMedia nélkül + failWith toast; loading-fázisú cameraError hibakártya)
src/hooks/useCamera.ts                            (openStream retry NotReadable/Abort esetén; i18n hibaszövegek)
src/hooks/useFaceDetection.ts                     (cameraError feliratkozás + dep; setIsInitializing(false) hibánál)
src/constants/constants.ts                        (+CAMERA_OPEN_RETRY_DELAYS_MS)
src/types/index.ts                                (GamePhase már tartalmazza a "cameraConsent"-et)
src/components/ui/Modal.tsx                       (VÁLTOZATLAN — a CameraHelpModal alapja: Escape-zárás, overlay, footer slot)
src/i18n/locales/{en,hu,fr,de,es}/translation.json (app.cameraConsent.*, app.camera.* — léteznek;
                                                   L. blokk: +settings.cameraBlocked, +settings.cameraHelp.* — 396/396 kulcs paritás)
```
