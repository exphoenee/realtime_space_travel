---
title: "Kamera hozzájárulás – UI screen + Firebase perzisztencia + böngésző engedély kezelés"
slug: 014-camera-consent
type: plan
category: ui
status: implemented
implemented: true
implemented_at: "2026-07-29"
created_at: "2026-07-28"
updated_at: "2026-07-29"
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

**Cél:** Az intro után egy teljes képernyős **Camera Consent Screen** (GamePhase-alapú oldal, nem modál) tájékoztatja a felhasználót, hogy a játék arcfelismerést használ. A consent állapot **Firebase RTDB-be** kerül mentésre (`users/{rtdbKey}/settings/cameraConsent`), hogy oldalfrissítés után is megmaradjon, és vendég (`isAnonymous`) usereknél is ugyanúgy működjön.

**Folyamat:**
1. Intro → ha a DB-ben `cameraConsent` **nincs** vagy `"undecided"` → **CameraConsentScreen** (teljes oldal)
2. Két választás: **Engedélyez** vagy **Elutasít** (UI szintű hozzájárulás)
3. **Engedélyez** → `getUserMedia({ video: true })` → böngésző natív prompt
   - **Böngészőben Engedélyezve** → `cameraConsent = "granted"` DB-be → `transitionTo("mainMenu")` (Start gomb aktív)
   - **Böngészőben Elutasítva** → `cameraConsent = "denied"` DB-be → `transitionTo("mainMenu")` (Start gomb inaktív)
4. **Elutasít** (UI szinten) → `cameraConsent = "denied"` DB-be → `transitionTo("mainMenu")` (Start gomb inaktív)
5. **Főmenü Start gomb**: ha `cameraConsent !== "granted"` → **átnavigál** a CameraConsentScreen-re (nem csak letiltja a gombot!)
6. **Settings**: "Kamera engedélyezése" gomb ha `cameraConsent === "denied"` → újra megnyitja a CameraConsentScreen-t
7. **F5 oldalfrissítés**: mivel GamePhase (`"cameraConsent"`), a Zustand persist megőrzi a fázist → ugyanazt az oldalt látja újra

> ⚠️ **Különbség a korábbi implementációhoz képest:** A korábbi verzió a consent állapotot csak `useUIStore`-ben (Zustand lokális state) tárolta, NEM Firebase-ben. Ezentúl a `users/{rtdbKey}/settings/cameraConsent` RTDB mező a source of truth. A `useUIStore` lokális gyorsítótárként szolgál, és a Firebase-ből való betöltéskor szinkronizálódik.

---

## Döntések

| Kérdés | Választás |
|--------|-----------|
| Elhelyezés a roadmapen | **14. lépés** — a 013-social-multiplayer után, a 015-toast-notification / 016 előtt |
| Hol él a consent állapot? | **Firebase RTDB** `users/{rtdbKey}/settings/cameraConsent` — a `useUIStore.cameraConsent` lokális cache |
| Milyen típusú a screen? | **Teljes képernyős GamePhase oldal** (`"cameraConsent"` fázis), nem modál. F5 után is ugyanaz az oldal jön vissza |
| Mikor jelenik meg? | Intro után, ha `cameraConsent !== "granted"` a DB-ben (azaz `"undecided"` vagy `"denied"`) |
| Mi történik UI "Elutasítás" után? | `cameraConsent = "denied"` DB-be → főmenü, Start gomb átnavigál a CameraConsentScreen-re |
| Mi történik UI "Engedélyezés" után? | `getUserMedia` hívás → böngésző prompt |
| Mi történik ha a böngésző promptot ELUTASÍTJA? | `cameraConsent = "denied"` DB-be → főmenü (a böngészőszintű tiltás felülírja az UI szándékot) |
| Mi történik ha a böngésző promptot ENGEDÉLYEZI? | `cameraConsent = "granted"` DB-be → főmenü, Start gomb működik |
| Start gomb viselkedése `"denied"` esetén? | **Nem** csak letiltja a gombot, hanem átnavigál a `"cameraConsent"` fázisra → a user újra látja a teljes képernyős tájékoztatót és újra dönthet |
| Start gomb viselkedése `"granted"` esetén? | Normál: `transitionTo("missionSelect")` |
| Settings gomb "Kamera engedélyezése" | Ha `cameraConsent === "denied"` → `transitionTo("cameraConsent")` — ugyanaz a screen |
| Vendég (anonim) user | **Ugyanúgy működik.** A `rtdbKey` vendégnél a `deviceId`, a `users/{deviceId}/settings/cameraConsent` alá ír. Nincs különbség a flow-ban |
| Perzisztencia oldalfrissítéskor | A `useGameStore` partialize menti a `gamePhase`-t, így F5 után a `"cameraConsent"` fázis visszaáll. A `useAuthStore` betöltése után a `cameraConsent` a Firebase-ből szinkronizálódik a `useUIStore`-ba |
| i18n | `cameraConsent.*` + `settings.enableCamera` + `mainMenu.cameraRequired` kulcsok mind az 5 nyelven |

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

**C. CameraConsentScreen komponens (új, teljes oldal)**
- [x] `CameraConsentScreen.tsx` + `CameraConsentScreen.module.css` létrehozva
- [x] Elrendezés: full-screen dark gradient háttér + starfield animáció, középen glass-morphism panel
- [x] Tartalom: 📷 ikon, cím, leírás (adatvédelem, arcfelismerés, képek nem kerülnek szerverre)
- [x] Két gomb: "Engedélyez" (primary, kék gradient) és "Elutasít" (secondary, szürke)
- [x] Engedélyez flow: `getUserMedia` → siker esetén `persistCameraConsent("granted")` → `mainMenu`
- [x] Hiba flow: `persistCameraConsent("denied")` + hibaüzenet → `mainMenu`
- [x] Elutasít flow: `persistCameraConsent("denied")` → `mainMenu`
- [x] Hiba banner (shake animációval), spinner processing állapot
- [x] Animációk: fadeIn + slideUp, star twinkle
- [x] Reszponzív: mobile-on flex-direction: column a gomboknak

**D. GamePhase + routing — cameraConsent fázis**
- [x] `GamePhase` típusban `"cameraConsent"` már szerepelt ✅
- [x] `phaseToFlags("cameraConsent")` már megvolt ✅
- [x] `ScreenRouter.tsx`: `"cameraConsent"` → `<CameraConsentScreen />` (modál helyett)
- [x] Átmenet: Intro → `transitionTo("cameraConsent")` ha `cameraConsent !== "granted"` → MainMenu

**E. App.tsx — kapcsolódás + Firebase sync**
- [x] `handleSkipIntro`: ha `cameraConsent !== "granted"` → `"cameraConsent"` fázis, egyébként `mainMenu`
- [x] `handleUserData` callback: ha `data.settings.cameraConsent` létezik, szinkronizálja `useUIStore`-ba
- [x] Rehidratálás: auto-check `persistCameraConsent("granted")`-t használ (Firebase-be is ír)
- [x] `isPreGame` listában `"cameraConsent"` már szerepelt ✅

**F. MainMenu — Start gomb új viselkedése**
- [x] Start gomb `handleStart`: ha `cameraConsent !== "granted"` → `transitionTo("cameraConsent")`, egyébként `transitionTo("missionSelect")`
- [x] Start gomb SOHA nincs disabled — mindig kattintható
- [x] Tooltip és disabled prop eltávolítva (gomb mindig működik)

**G. Settings — Kamera engedélyezése gomb**
- [x] Kamera gomb `onClick`: `transitionTo("cameraConsent")` — teljes flow újra
- [x] Ha `cameraConsent === "granted"`: ✅ ikon + "Kamera elérhető" szöveg
- [x] Ha `cameraConsent !== "granted"`: "Kamera engedélyezése" gomb

**H. i18n — kulcsok (már léteznek, ellenőrizve)**
- [x] `cameraConsent.*` névtér megléte ellenőrizve mind az 5 locale-ban (en, hu, fr, de, es) — mindegyikben létezik ✅
- [x] `settings.enableCamera`, `settings.cameraGranted` — léteznek
- [x] `mainMenu.cameraRequired` — létezik

**I. Tesztek + validáció**
- [x] `npx tsc --noEmit` tiszta ✅
- [x] `npm run build` sikeres ✅ (2,791 kB chunk warning — pre-existing)
- [ ] `npm run test` zöld
- [ ] CameraConsentScreen megjelenik intro után (manuális teszt)
- [ ] F5 a consent screen-en → ugyanazt a screen-t látod (manuális teszt)
- [ ] Engedélyezés → böngésző prompt → grant → mainMenu, Start működik
- [ ] Engedélyezés → böngésző prompt → deny → mainMenu, Start → vissza a consent screen-re
- [ ] Elutasítás → mainMenu, Start → vissza a consent screen-re
- [ ] Vendég (anonymous) user → ugyanaz a flow
- [ ] Settings "Kamera engedélyezése" → consent screen

---

## 1. Flow diagram

```
┌─────────┐     ┌──────────────────────┐     ┌──────────┐
│  Intro   │ ──→ │ CameraConsentScreen  │ ──→ │ MainMenu  │
└─────────┘     │ (teljes képernyő)     │     └──────────┘
                 └──────────────────────┘          │
                           │                  ┌────┴────┐
                      ┌────┴────┐             │         │
                      │         │          Start      Settings
                   Allow      Deny        (ha denied)   │
                      │         │             │    ┌────┴────┐
                      ▼         │             ▼    │         │
              getUserMedia      │      transitionTo  cameraConsent
                      │         │      ("cameraConsent")
                 ┌────┴────┐    │             │
             Granted   Denied  │             │
                 │         │   │             │
                 ▼         ▼   │             │
          persistCamera   persistCamera       │
          Consent("granted") Consent("denied") │
                 │         │   │             │
                 ▼         ▼   ▼             ▼
             MainMenu    MainMenu         CameraConsentScreen
          (Start ✅)   (Start → camera   (újra a teljes folyamat)
                        consent screen)
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

interface UIState {
  cameraConsent: CameraConsent;                    // local cache
  persistCameraConsent: (status: CameraConsent) => void;  // Firebase + local
  setCameraConsent: (status: CameraConsent) => void;      // local only
  // ...
}
```

`persistCameraConsent` implementáció:
```typescript
persistCameraConsent: async (status) => {
  // 1. Frissítsd a lokális state-et
  set({ cameraConsent: status });
  // 2. Írj Firebase-be
  const rtdbKey = getRtdbKey();
  if (rtdbKey) {
    await updateUserSettings(rtdbKey, { cameraConsent: status });
  }
}
```

## 4. CameraConsentScreen komponens (teljes oldal)

```tsx
const CameraConsentScreen: React.FC = () => {
  const { t } = useTranslation();
  const transitionTo = useGameStore((s) => s.transitionTo);
  const persistCameraConsent = useUIStore((s) => s.persistCameraConsent);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleAllow = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((track) => track.stop());
      await persistCameraConsent("granted");
      transitionTo("mainMenu");
    } catch (err) {
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        setError(t("cameraConsent.browserDenied"));
      } else {
        setError(t("cameraConsent.error"));
      }
      await persistCameraConsent("denied");
      setIsProcessing(false);
      transitionTo("mainMenu");
    }
  };

  const handleDeny = async () => {
    await persistCameraConsent("denied");
    transitionTo("mainMenu");
  };

  return (
    <div className={styles.screen}>
      {/* Starfield background */}
      <div className={styles.starfield} />
      <div className={styles.panel}>
        <div className={styles.icon}>📷</div>
        <h1 className={styles.title}>{t("cameraConsent.title")}</h1>
        <p className={styles.description}>{t("cameraConsent.description")}</p>
        {error && <p className={styles.error}>{error}</p>}
        <div className={styles.actions}>
          <button onClick={handleAllow} className={styles.allowBtn} disabled={isProcessing}>
            {isProcessing ? "..." : t("cameraConsent.allow")}
          </button>
          <button onClick={handleDeny} className={styles.denyBtn} disabled={isProcessing}>
            {t("cameraConsent.deny")}
          </button>
        </div>
      </div>
    </div>
  );
};
```

## 5. MainMenu Start gomb új logikája

```tsx
// Start gomb SOHA nincs disabled — mindig kattintható
const handleStart = () => {
  const cc = useUIStore.getState().cameraConsent;
  if (cc === "granted") {
    transitionTo("missionSelect");
  } else {
    transitionTo("cameraConsent");
  }
};

<button onClick={handleStart}>
  {t("mainMenu.start")}
</button>
```

## 6. Biztonság

- A `getUserMedia` hívás **soha** nem küld adatot szerverre — csak a böngésző biztonsági sandbox-jában fut
- A `cameraConsent` Firebase-ben tárolása csak az állapotot rögzíti, nem a kameraképet
- A settings írásához `auth.uid` szükséges — vendégnél `device_map/{deviceId}` → `auth.uid` mapping alapján
- Ha a user később visszavonja a böngésző szintű engedélyt, a `getUserMedia` hiba esetén a `cameraConsent` `"denied"`-re áll → a flow újraindul

## 7. Függőségek

- **Előfeltétel:** [[001-main-menu-settings]] — MainMenu és SettingsScreen komponensek
- **Előfeltétel:** [[003-firebase-auth-settings]] — Firebase auth + RTDB user node
- **Nem függ:** shop-tól, social funkcióktól
- **Blokkolja:** a játék indítását (nincs kamera consent → nincs játék)

## 8. Kockázatok

- **iOS Safari:** a `getUserMedia` csak user gesture-ből hívható → a gombra kattintás pont ilyen gesture, OK
- **Permissions API hiánya (Safari):** fallback: mindig megpróbáljuk a `getUserMedia`-t, és a hiba alapján döntünk
- **Vendég user:** a `rtdbKey` = `deviceId`, a `users/{deviceId}/settings` írásához a `device_map/{deviceId}` szükséges. Az auth bootstrap (`ensureDeviceMap`) ezt garantálja
- **Konkurens írás:** a `persistCameraConsent` íráskor nem használ tranzakciót — két tab egyidejű consent váltása ritka, elfogadott kockázat
- **F5 utáni állapot:** a `useGameStore` partialize menti a `gamePhase`-t. Ha `"cameraConsent"` fázisban történik az F5, a gamePhase visszaáll, de a `cameraConsent` a Firebase-ből töltődik be a `handleUserData` callback-ben → a screen helyesen jelenik meg

## 9. Érintett fájlok

```
src/components/screens/CameraConsentScreen.tsx    (ÚJ — teljes oldal, modál helyett)
src/components/screens/CameraConsentScreen.module.css  (ÚJ)
src/components/features/CameraConsentModal.tsx    (TÖRLÉS — helyette CameraConsentScreen)
src/components/features/CameraConsentModal.module.css  (TÖRLÉS)
src/components/routing/ScreenRouter.tsx           (cameraConsent case → CameraConsentScreen)
src/components/screens/MainMenu.tsx               (Start gomb: denied esetén → cameraConsent fázis)
src/components/screens/SettingsScreen.tsx         (Kamera engedélyezése gomb → cameraConsent fázis)
src/firebase/userData.ts                          (UserNode.settings + updateUserSettings bővítés)
src/state/useUIStore.ts                          (+persistCameraConsent action)
src/App.tsx                                       (intro utáni navigáció + Firebase sync)
src/types/index.ts                                (GamePhase már tartalmazza)
```
