---
title: "Kamera hozzájárulás – adatvédelmi tudatosítás és engedélykezelés"
slug: 014-camera-consent
type: plan
category: ui
status: not-started
implemented: false
implemented_at: null
created_at: "2026-07-28"
updated_at: "2026-07-28"
author: exphoenee
step: 14
phases: []
dependencies:
  - 001-main-menu-settings
related_plans:
  - 005-ingame-shop-strapi-stripe
  - 011-difficulty-event-system
tags:
  - ui
  - camera
  - privacy
  - consent
  - i18n
  - settings
---

# Kamera hozzájárulás – adatvédelmi tudatosítás és engedélykezelés

**Cél:** Az intro után, de a főmenü megjelenése előtt egy felvilágosító modál tájékoztatja a felhasználót, hogy a játék arcfelismerést használ, a képek nem kerülnek továbbküldésre vagy feldolgozásra, kizárólag a játék céljából használódnak fel. Két gomb: **Engedélyez** vagy **Elutasít**. Ha a user elutasítja, a főmenüben minden gomb elérhető, kivéve a **Start** (játék indítása). A Settings-ben ilyenkor megjelenik egy "Kamera engedélyezése" gomb. Ha a user az engedélyezést választja, az app meghívja a `getUserMedia`-t, ami a böngésző natív promptját triggereli — a user már felkészülten, az app-beli tájékoztató után látja azt.

> ⚠️ **Technikai korlát:** A böngésző natív kamera promptja (`getUserMedia`) nem kerülhető meg teljesen — ez biztonsági funkció. Az app-beli modál felkészíti a usert, mielőtt a böngésző promptja megjelenne. Ha a user az app-ban "Elutasít"-ra kattint, a `getUserMedia` SOHA nem hívódik meg → a böngésző promptja sem jelenik meg soha.
>
> ⚠️ **Ez a terv a [[001-main-menu-settings]] tervre épül** — a főmenüt és a Settings képernyőt módosítja. Új GamePhase-t is bevezet (`cameraConsent`).

---

## Döntések

| Kérdés | Választás |
|--------|-----------|
| Elhelyezés a roadmapen | **14. lépés** — a 013-social-multiplayer után, a 014-stripe-fraud-defense ELŐTT (átszámozva 015-re) |
| Mikor jelenik meg a modál? | Az **intro után**, a **főmenü előtt** — egy új `cameraConsent` GamePhase-ben |
| Mi történik "Elutasítás" után? | A főmenü minden gombja elérhető, kivéve **Start**; Settings-ben "Kamera engedélyezése" gomb |
| Mi történik "Engedélyezés" után? | `getUserMedia({ video: true })` meghívódik → böngésző prompt → ha engedélyezi, a stream leáll és a játék normálisan folytatódik |
| Settings gomb viselkedése | Ha `cameraConsent` === `denied`, megjelenik egy "Kamera engedélyezése" gomb → `getUserMedia` újrapróbálkozás |
| Elutasítás után újra lehet próbálni? | Igen — a Settings-ben bármikor, és a Start gomb is újra próbálkozhat (a Settings-en keresztül) |
| Állapot tárolása | `useUIStore.cameraConsent: "undecided" | "granted" | "denied"` — alapértelmezett `"undecided"` |
| Böngésző szintű tiltás detektálása | `navigator.permissions.query({ name: 'camera' })` — ha `denied`, a user értesítést kap, hogy a böngésző beállításaiban engedélyezze |
| i18n | `cameraConsent.*` kulcsok mind az 5 nyelven |

---

## ✅ Haladás (TODO)

> Jelölés: `[ ]` hátravan · `[~]` folyamatban · `[x]` kész.

**A. useUIStore bővítése — cameraConsent állapot**
- [ ] `src/state/useUIStore.ts`: új `cameraConsent: "undecided" | "granted" | "denied"` mező (default: `"undecided"`)
- [ ] `src/state/useUIStore.ts`: `setCameraConsent(status)` action
- [ ] Permissions API helper: `checkCameraPermission(): Promise<"granted" | "denied" | "prompt">` — `navigator.permissions.query()` (vagy `"prompt"` fallback ha nem támogatott)

**B. CameraConsentModal komponens**
- [ ] `src/components/features/CameraConsentModal.tsx` (ÚJ) — a modál komponens
- [ ] `src/components/features/CameraConsentModal.module.css` (ÚJ) — stílusok
- [ ] Modal tartalma: tájékoztató szöveg (arcfelismerés, adatvédelem, képek nem kerülnek továbbküldésre)
- [ ] Két gomb: "Engedélyez" (`primary`) és "Elutasít" (`secondary`)
- [ ] Ha Engedélyez: `getUserMedia({ video: true })` hívása → stream azonnali leállítása → `setCameraConsent("granted")` → `transitionTo("mainMenu")`
- [ ] Ha Elutasít: `setCameraConsent("denied")` → `transitionTo("mainMenu")`
- [ ] Ha a `getUserMedia` hibát dob: hibaüzenet mutatása a modálban + `setCameraConsent("denied")`

**C. GamePhase + routing — cameraConsent fázis**
- [ ] `src/types/index.ts`: `GamePhase` típushoz `"cameraConsent"` hozzáadva
- [ ] `src/state/useGameStore.ts`: `phaseToFlags("cameraConsent")` — `showIntro: false, isPreGame: true, showCameraConsent: true`
- [ ] `src/components/routing/ScreenRouter.tsx`: `case "cameraConsent"` → `<CameraConsentModal />`
- [ ] Átmenet: Intro → `transitionTo("cameraConsent")` → MainMenu

**D. App.tsx — kapcsolódás**
- [ ] `src/App.tsx`: a `startAuthBootstrap` callback után, ha `cameraConsent === "undecided"` és nincs mentett állapot, akkor `transitionTo("cameraConsent")`
- [ ] `src/App.tsx`: az `isPreGame` feltételhez `gamePhase === "cameraConsent"` hozzáadása
- [ ] `src/App.tsx`: `handleCameraConsentGranted` callback — `useUIStore.setCameraConsent("granted")` + stream kezelés

**E. MainMenu — Start gomb letiltása**
- [ ] `src/components/screens/MainMenu.tsx`: a Start gomb `disabled` ha `cameraConsent !== "granted"`
- [ ] `src/components/screens/MainMenu.tsx`: tooltip vagy kis szöveg: "Kamera engedélyezése szükséges a játék indításához"
- [ ] `src/components/screens/MainMenu.module.css`: `.startDisabled` stílus (halványabb, tiltott kurzor)

**F. Settings — Kamera engedélyezése gomb**
- [ ] `src/components/screens/SettingsScreen.tsx`: új gomb "Kamera engedélyezése" — csak akkor látható, ha `cameraConsent === "denied"`
- [ ] Gomb onClick: `getUserMedia({ video: true })` → ha sikerül → `setCameraConsent("granted")` + success visszajelzés; ha hibázik → hibaüzenet
- [ ] `src/components/screens/SettingsScreen.module.css`: `.cameraBtn` stílus

**G. i18n — ÚJ kulcsok mind az 5 nyelven**
- [ ] `cameraConsent.title` — "Kamera hozzáférés"
- [ ] `cameraConsent.description` — tájékoztató szöveg az arcfelismerésről, adatvédelemről
- [ ] `cameraConsent.allow` — "Engedélyez"
- [ ] `cameraConsent.deny` — "Elutasít"
- [ ] `cameraConsent.browserDenied` — "A kamera hozzáférés le van tiltva a böngésződben. Kérjük, engedélyezd a böngésző beállításaiban."
- [ ] `cameraConsent.error` — "Nem sikerült elindítani a kamerát"
- [ ] `settings.enableCamera` — "Kamera engedélyezése"
- [ ] `settings.cameraGranted` — "Kamera elérhető"
- [ ] `mainMenu.cameraRequired` — "Kamera szükséges a játékhoz"
- [ ] Teljes paritás mind az 5 fájlban

**H. Tesztek + validáció**
- [ ] `src/state/useUIStore.test.ts` — cameraConsent állapot tesztelése
- [ ] `tsc --noEmit`
- [ ] `npm run test`
- [ ] `npm run build`

---

## 1. Flow diagram

```
┌─────────┐     ┌──────────────────┐     ┌──────────┐
│  Intro   │ ──→ │ CameraConsentModal│ ──→ │ MainMenu  │
└─────────┘     └──────────────────┘     └──────────┘
                        │                        │
                   ┌────┴────┐              ┌────┴────┐
                   │         │              │         │
               Allow      Deny          Start      Settings
                   │         │          disabled    (ha denied)
                   ▼         ▼              │       ▼
           getUserMedia   cameraConsent     │    getUserMedia
               │         = "denied"         │       │
          ┌────┴────┐     └→ MainMenu       │   ┌────┴────┐
     Granted   Denied      (Start ⛔)        │  Granted  Denied
          │       │                         │      │       │
     cameraConsent browserDenied            │  cameraConsent browserDenied
     = "granted"  hibaüzenet                │  = "granted" hibaüzenet
          │       │                         │      │
          ▼       ▼                         ▼      ▼
      MainMenu   MainMenu              transitionTo("missionSelect")
      (Start ✅)  (Start ⛔ + Settings gomb)
```

## 2. useUIStore bővítés

```typescript
interface UIState {
  // ... existing fields
  
  /** Camera consent state */
  cameraConsent: "undecided" | "granted" | "denied";
  
  setCameraConsent: (status: "undecided" | "granted" | "denied") => void;
}
```

## 3. GamePhase bővítés

```typescript
export type GamePhase =
  | "intro"
  | "cameraConsent"       // ← NEW
  | "mainMenu"
  // ... rest unchanged
```

`phaseToFlags("cameraConsent")`:
```typescript
case "cameraConsent":
  return {
    showIntro: false,
    isPreGame: true,
    showCameraConsent: true,  // ← új flag, ha valahol kell
  };
```

## 4. CameraConsentModal komponens

```tsx
const CameraConsentModal: React.FC = () => {
  const { t } = useTranslation();
  const transitionTo = useGameStore((s) => s.transitionTo);
  const setCameraConsent = useUIStore((s) => s.setCameraConsent);
  const [error, setError] = useState<string | null>(null);

  const handleAllow = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      // Immediately stop the stream — we just need the permission
      stream.getTracks().forEach((track) => track.stop());
      setCameraConsent("granted");
      transitionTo("mainMenu");
    } catch (err) {
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        setError(t("cameraConsent.browserDenied"));
      } else {
        setError(t("cameraConsent.error"));
      }
      setCameraConsent("denied");
      transitionTo("mainMenu");
    }
  };

  const handleDeny = () => {
    setCameraConsent("denied");
    transitionTo("mainMenu");
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <h2>{t("cameraConsent.title")}</h2>
        <p>{t("cameraConsent.description")}</p>
        {error && <p className={styles.error}>{error}</p>}
        <div className={styles.actions}>
          <button onClick={handleAllow} className={styles.allowBtn}>
            {t("cameraConsent.allow")}
          </button>
          <button onClick={handleDeny} className={styles.denyBtn}>
            {t("cameraConsent.deny")}
          </button>
        </div>
      </div>
    </div>
  );
};
```

## 5. Biztonság

- A `cameraConsent` állapot **nem perzisztálódik Firebase-ben** — minden session-ben újra kell döntenie a usernek (vagy localStorage-ban cache-elhető)
- A `getUserMedia` hívás **soha** nem küld adatot szerverre — csak a böngésző biztonsági sandbox-jában fut
- A Permissions API csak az állapot lekérdezésére szolgál, nem módosítja azt

## 6. Függőségek

- **Előfeltétel:** [[001-main-menu-settings]] — a MainMenu és SettingsScreen meglévő komponenseit módosítja
- **Nem függ:** Firebase-től (nincs backend írás)
- **Blokkolja:** semmit — a kamera használata opcionális (bár a játékélményhez erősen ajánlott)

## 7. Kockázatok

- **Permissions API nem támogatott minden böngészőben** (Safari) — fallback: mindig `"prompt"` státusz
- **getUserMedia hívás elsődleges stream:** a modálban rögtön leállítjuk a streamet, hogy ne foglalja a kamerát feleslegesen. A tényleges játékbeli stream később indul (`useCamera` hook).
- **iOS Safari:** a `getUserMedia` csak user gesture-ből hívható — a gombra kattintás pont ilyen gesture, szóval OK
- **Elutasítás után újra próbálkozás:** ha a user a böngésző promptjában is elutasította, a `getUserMedia` újra `NotAllowedError`-t dob → de a Settings gombbal újra lehet próbálkozni (a Permissions API nem tudja feloldani, de a user legalább értesítést kap, hogy a böngésző beállításaiban kell engedélyeznie)
