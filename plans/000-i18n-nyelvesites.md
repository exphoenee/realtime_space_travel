---
title: "Nyelvesítési terv – Realtime Space Travel"
slug: 000-i18n-nyelvesites
type: plan
category: i18n
status: implemented
implemented: true
implemented_at: "2026-07-25"
created_at: "2026-07-25"
updated_at: "2026-07-26"
author: exphoenee
step: 0
phases:
  - 0
dependencies: []
related_plans:
  - 001-main-menu-settings
  - 002-ingame-shop-frontend
  - 003-firebase-auth-settings
  - 004-firebase-auth-bugfix
  - 005-ingame-shop-strapi-stripe
  - 019-intro-deterministic-layout
tags:
  - i18n
  - localization
  - react-i18next
  - frontend
---

# Nyelvesítési terv – Realtime Space Travel

**Cél:** az alkalmazás támogasson 5 nyelvet: **angol (en)**, **magyar (hu)**, **francia (fr)**, **német (de)**, **spanyol (es)**.

**Jelenlegi állapot:** minden felhasználói szöveg magyarul, hardcode-olva a komponensekben. Nincs i18n réteg. Az app kicsi (React 18 + Vite + Zustand + persist), a szövegek jól körülhatárolhatók.

## Döntések (egyeztetve)

| Kérdés | Választás |
|--------|-----------|
| i18n eszköz | **react-i18next** (i18next + react-i18next + i18next-browser-languagedetector) |
| Alapértelmezett nyelv | **Böngésző-felismerés** (`navigator.language`), fallback: **angol** |
| Nyelvváltó | Látható **nyelvváltó UI**: bejelentkezés előtt a főmenüben/introban, valamint a **Settings menüben** (lásd [[003-firebase-auth-settings]]) |
| Perzisztálás | Kijelentkezve `localStorage` (`space-travel-lang`); **bejelentkezve a Firebase `settings.language` a mérvadó** |

> **Kánon-illeszkedés:** ez a terv a felület nyelvi rétegét adja. A **felhasználóhoz kötött nyelv** a [[003-firebase-auth-settings]] `settings.language` mezőjében perzisztál; a Strapi katalógus szövegeit a Strapi i18n plugin lokalizálja (lásd [[005-ingame-shop-strapi-stripe]]).

---

## ✅ Haladás (TODO)

> Jelölés: `[ ]` hátravan · `[~]` folyamatban · `[x]` kész. Implementáció közben itt vezetjük, hol tartunk, hogy félbeszakadás után folytatható legyen. Részletek a lenti szekciókban.

- [x] Függőségek telepítése (`i18next`, `react-i18next`, `i18next-browser-languagedetector`)
- [x] `src/i18n/index.ts` + 5 `translation.json` (detector, fallback, `<html lang>` szinkron)
- [x] `index.tsx`: `import "./src/i18n"` a render előtt + `<html lang>` szinkron
- [x] `hu/translation.json` feltöltése (forrás, 1:1 a mostani szöveggel)
- [x] Komponensek átírása `t()` / `<Trans>`-re: `MainMenu`
- [x] … `Dashboard`
- [x] … `IntroScreen`
- [x] … `LoadingScreen`
- [x] … `PauseMenu`
- [x] … `App` (overlay-ek, kamera-hibák, statisztika)
- [x] … `ScreenCheck`
- [x] … `ErrorBoundary` (`i18n.t()` a class komponensben)
- [x] … `DebugOverlay`
- [x] `useWeather` / `universeData` kulcsalapúvá alakítása (`WeatherCondition {key,temp}`)
- [x] `LanguageSwitcher` komponens + beépítés (főmenü/intro)
- [x] Tesztek igazítása (Vitest setup i18n init) — 14/14 zöld, tsc+build tiszta
- [ ] Firebase `settings.language` szinkron bekötése (Fázis 1 után — lásd [[003-firebase-auth-settings]])
- [x] **Fordítások:** `en` (teljes — a fallback nyelve)
- [x] **Fordítások:** `fr` (teljes, 95 kulcs, helyőrző-paritás ✓)
- [x] **Fordítások:** `de` (teljes, 95 kulcs, helyőrző-paritás ✓)
- [x] **Fordítások:** `es` (teljes, 95 kulcs, helyőrző-paritás ✓)

---

## 1. Függőségek

```bash
npm install i18next react-i18next i18next-browser-languagedetector
```

- `i18next` – mag
- `react-i18next` – React kötés (`useTranslation`, `Trans`)
- `i18next-browser-languagedetector` – `navigator.language` + `localStorage` felismerés

---

## 2. Fájlstruktúra

```
src/
  i18n/
    index.ts              # i18next inicializálás (detector, fallback, resources)
    locales/
      en/translation.json
      hu/translation.json
      fr/translation.json
      de/translation.json
      es/translation.json
  components/
    LanguageSwitcher.tsx      # új: nyelvváltó gombsor
    LanguageSwitcher.module.css
```

**Namespace:** egyetlen `translation` namespace elég (kicsi az app). Kulcsok logikai csoportokba szervezve (lásd 4. pont).

---

## 3. i18next inicializálás (`src/i18n/index.ts`)

```ts
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import en from "./locales/en/translation.json";
import hu from "./locales/hu/translation.json";
import fr from "./locales/fr/translation.json";
import de from "./locales/de/translation.json";
import es from "./locales/es/translation.json";

export const SUPPORTED_LANGUAGES = ["en", "hu", "fr", "de", "es"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      hu: { translation: hu },
      fr: { translation: fr },
      de: { translation: de },
      es: { translation: es },
    },
    fallbackLng: "en",
    supportedLngs: SUPPORTED_LANGUAGES,
    interpolation: { escapeValue: false }, // React már escapel
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "space-travel-lang",
    },
  });

export default i18n;
```

**Belépési pont (`index.tsx`):** `import "./src/i18n";` a `ReactDOM.createRoot` előtt, hogy a fordítások a render előtt betöltődjenek. (Statikus import → nincs suspense/aszinkron betöltés, nem kell `<Suspense>` fallback.)

---

## 4. Szövegleltár és kulcsstruktúra

Az összes lefordítandó string az alábbi komponensekben található. Javasolt kulcsséma (`translation.json`):

### `menu` – `MainMenu.tsx`
- `menu.title` – „Válassz egy küldetést!"
- `menu.lightYears` – „{{count}} fényév" (interpoláció)
- `menu.reward` – „Jutalom {{amount}}$"
- `menu.dlcMilkyWay` – „Vedd meg a **Tejút DLC**-t $19.99-ért további csillagrendszerekért!" (→ `<Trans>` a `<span>` miatt)
- `menu.dlcComingSoon` – „Hamarosan további DLC-k érkeznek!"

> A célállomások nevei (`Proxima Centauri`, `Wolf 424`, `Ross 780`) tulajdonnevek → **nem** fordítjuk.

### `dashboard` – `Dashboard.tsx`
- `dashboard.title` – „Csillagközi Utazás"
- `dashboard.status` – „Státusz: Minden rendszer működik"
- `dashboard.speed` – „Sebesség: {{value}} km/s"
- `dashboard.destination` – „Cél"
- `dashboard.localWeather` – „Helyi időjárás"
- `dashboard.arrival` – „Érkezés a célrendszerbe"
- `dashboard.earthYears` – „Földi év"

### `intro` – `IntroScreen.tsx`
- `intro.headline` – „Realtime Space Travel" (megtartható, márkanév)
- `intro.motto` – „Az életedre szóló élmény!"
- `intro.paragraph1`, `intro.paragraph2`
- `intro.sectionTitle` – „A Feladataid – A Küldetés Legszigorúbb Protokolljai"
- `intro.rule1`..`intro.rule4` – a 4 szabály (mind `<strong>` bevezetővel → `<Trans>` vagy külön `*Title`/`*Body` kulcspár)
- `intro.continue` – „Kattints vagy nyomj meg bármilyen gombot a folytatáshoz."

### `loading` – `LoadingScreen.tsx`
- `loading.title` – „Rendszerek inicializálása"
- `loading.subtitle` – „A hajó fedélzeti számítógépe ellenőrzi a rendszereket"
- `loading.step.camera` / `.model` / `.calibration` / `.ready` – a 4 lépés címkéje
- `loading.status.done` – „Kész"
- `loading.status.inProgress` – „Folyamatban"
- `loading.readyTitle` – „Minden készen áll"
- `loading.readySubtitle` – „Nézz a képernyőre az utazás megkezdéséhez"

### `pause` – `PauseMenu.tsx`
- `pause.attentionTitle` – „Figyelem!"
- `pause.countdownSub` – „Még {{count}} másodperced van visszanézni…" (interpoláció + többesszám)
- `pause.seconds` – „másodperc"
- `pause.blame` – „Mert te nem végzed a feladatod…"
- `pause.disconnectedTitle` – „Kapcsolat megszakadt"
- `pause.disconnectedSub` – „A fedélzeti rendszerek nem érzékelik a jelenlétedet."
- `pause.disconnectedWarning` – „**60 másodperced** van visszatérni…" (`<Trans>`)

### `app` – `App.tsx` (overlay-ek, hibák, statisztika)
- `app.missionComplete.title` – „Megérkeztél!"
- `app.missionComplete.text` – „Megérkeztél! Az uticélod a jobb oldalon van!"
- `app.backToMenu` – „Vissza a főmenübe"
- `app.gameOver.title` – „Vége a játéknak"
- `app.crewLost.buttons` – „Az egész hibernált legénység elpusztult, mert piszkáltad a gombokat!"
- `app.crewLost.attention` – „Vége játéknak, a teljes legénység meghalt, mert nem figyeltél oda."
- `app.exitConfirm.title` – „Biztosan kilépsz?"
- `app.exitConfirm.text` – „A játék nem menti az eddigi elért eredményeidet!"
- `app.yes` / `app.no` – „Igen" / „Nem"
- `app.error.title` – „Hiba"
- `app.retry` – „Próbáld újra"
- `app.exit` – „Kilépés"
- `app.exitAria` – „Kilépés a küldetésből"
- `app.serviceTime` – „Szolgálati idő: {{minutes}} perc"
- `app.record` – „Rekord: {{minutes}} perc"
- `app.music.mute` / `app.music.unmute` – „Zene némítása" / „Zene bekapcsolása" (aria-label)
- Kamera-hibaüzenetek (5 db):
  - `app.camera.noSupport`, `app.camera.noModel`, `app.camera.needAccess`,
    `app.camera.denied`, `app.camera.notFound`, `app.camera.notReadable`

### `screenCheck` – `ScreenCheck.tsx`
- `screenCheck.portraitTitle` – „Fekvő nézet szükséges"
- `screenCheck.portraitText` – „Kérjük, fordítsd el a készülékedet…"
- `screenCheck.tooSmallTitle` – „Túl kicsi képernyő"
- `screenCheck.tooSmallText` – „Legalább **900×530** felbontás szükséges." (`<Trans>`)
- `screenCheck.current` – „Jelenlegi: {{width}}×{{height}}"

> **Figyelem:** a `ScreenCheck` az `ErrorBoundary`-n belül, de az `App`-on kívül renderel. Az i18next statikus init miatt ez rendben lesz, mert a `t` globálisan elérhető.

### `errorBoundary` – `ErrorBoundary.tsx`
- `errorBoundary.title` – „Hiba történt"
- `errorBoundary.text` – „Váratlan hiba történt az alkalmazásban."
- `errorBoundary.reload` – „Újratöltés"

> **Class komponens** → nem használhat hookot. Megoldás: `withTranslation()` HOC, vagy a `i18n.t()` közvetlen hívása az importált `i18n` példányról. (Az `ErrorBoundary`-nak class-nak kell maradnia a `componentDidCatch` miatt.)

### `weather` – `universeData.ts` + `useWeather.ts`
- 10 időjárás-string (pl. „25 °C napsütés"). Javaslat: a nyers stringeket **kulcsokká** alakítani (`weather.sunny`, `weather.rainy`, …), a hőmérsékletet interpolációval: `weather.sunny` = „{{temp}} °C napsütés". A `useWeather` hook a kulcsot + hőmérsékletet adja vissza, a `Dashboard` fordítja. Egyszerűbb alternatíva: a `weatherConditions` tömböt nyelvenként tartani a fordításfájlban (`weather.conditions` mint tömb), és a hook indexet választ.

### `index.html` – statikus meta
- `<html lang="hu">` → alapból `en`, majd JS-ből a felismert nyelvre állítva (`i18n.on("languageChanged", lng => document.documentElement.lang = lng)`).
- `<title>` és `og`/`twitter` `description` – a `<title>` a márkanév, maradhat. A `description` fordítható JS-ből (opcionális, SEO-hoz), vagy angolra írható. **Első körben elég a `lang` attribútum dinamikus állítása.**

---

## 5. Nyelvváltó komponens (`LanguageSwitcher.tsx`)

- Gombsor: `[HU] [EN] [FR] [DE] [ES]` (zászló emoji vagy nyelvkód).
- Aktív nyelv kiemelve.
- Kattintásra `i18n.changeLanguage(code)` → **kijelentkezve** a detector `localStorage`-ba menti (`space-travel-lang`); **bejelentkezve** a Firebase `settings.language`-be is íródik (lásd [[003-firebase-auth-settings]]), és a real-time listener onnan állítja vissza más eszközön.
- Elhelyezés: bejelentkezés előtt a **főmenü** (`MainMenu`) és az **intro** sarka; a játékon belül a **Settings menü** „Nyelv" szekciójában (a Settings menü a korábbi harang gomb helyén — lásd [[003-firebase-auth-settings]] 4. pont).
- Stílus: a projekt `*.module.css` konvenciója szerint.

> **Nyelv-forrás prioritás:** (1) Firebase `settings.language`, ha bejelentkezett; (2) `localStorage` `space-travel-lang`; (3) `navigator.language`; (4) `en` fallback. Bejelentkezéskor az RTDB nyelv felülírja a helyit; a `LanguageSwitcher` mindkét helyre ír, hogy konzisztens maradjon.

---

## 6. Megvalósítási lépések (sorrend)

1. **Függőségek telepítése** (3 csomag).
2. **`src/i18n/index.ts`** + 5 üres `translation.json` váz létrehozása.
3. **`index.tsx`**: `import "./src/i18n";` a render előtt; `lang` attribútum szinkron.
4. **Magyar `hu/translation.json` feltöltése** a jelenlegi stringekkel (ez a „forrás" fordítás, 1:1 a mostani szöveggel).
5. **Komponensek átírása** hardcode → `t("kulcs")` / `<Trans>` (interpolációk, `<strong>`/`<span>` beágyazások kezelése):
   - `MainMenu`, `Dashboard`, `IntroScreen`, `LoadingScreen`, `PauseMenu`, `App`, `ScreenCheck`, `ErrorBoundary` (HOC), `DebugOverlay` (opcionális, csak DEBUG módban látszik).
6. **`useWeather` / `universeData`** kulcsalapúvá alakítása.
7. **`LanguageSwitcher`** komponens + beépítés a menübe és introba.
8. **Fordítások elkészítése**: `en`, `fr`, `de`, `es` a magyar forrásból. (Az intro hosszú, elbeszélő szöveg → gondos, kontextushű fordítás.)
9. **Tesztek**: a meglévő Vitest tesztek átnézése — ha van szöveg-alapú assert, `t`-alapúra vagy kulcsra váltani. A tesztkörnyezetben az i18n-t inicializálni kell (setup fájlban `import "../i18n"`), vagy mockolni.

---

## 7. Interpoláció / többesszám tudnivalók

- **Interpoláció:** `t("menu.reward", { amount: dest.wage })` → `"Jutalom {{amount}}$"`.
- **Beágyazott jelölés** (`<strong>`, `<span>`): `<Trans i18nKey="…">` használata, a JSON-ban `<0>…</0>` vagy elnevezett komponensekkel.
- **Többesszám** (fr/de/es fontos): pl. a másodperc-visszaszámláló – i18next `_one`/`_other` szuffixek, `t("pause.seconds", { count })`.
- **Számformátum:** a `toFixed()` marad; ha lokalizált tizedesjel kell (fr/de vessző), később `Intl.NumberFormat` bevezethető — **első körben nem szükséges**.

---

## 8. Nem fordítandó

- Célállomások nevei (`Proxima Centauri`, `Wolf 424`, `Ross 780`) – tulajdonnevek.
- „Realtime Space Travel" márkanév (headline, title).
- Mértékegységek (`km/s`, `°C`, `$`, `LY`).
- Debug metrikák belső címkéi (opcionális, csak fejlesztői mód).

---

## 9. Kockázatok / figyelmeztetések

- **`ErrorBoundary` (class)** és **`ScreenCheck` inline stílusok**: hook helyett HOC / `i18n.t()`.
- **Statikus import** a fordításokhoz → nincs késleltetett betöltés, de a bundle-méret nő (~kis JSON-ok, elhanyagolható).
- **Persist-ütközés:** a nyelv `localStorage` kulcsa (`space-travel-lang`) különbözzön a meglévő `space-travel-ui` / `space-travel-game` (és a tervezett `space-travel-shop` / Firebase-cache) kulcsoktól — nincs ütközés.
- **Firebase-szinkron sorrend:** bejelentkezéskor az RTDB `settings.language` felülírja a helyi nyelvet; kerülendő a „villódzás", ha az auth-betöltés a render után fut — érdemes a nyelvet az auth-listener első adatával beállítani (lásd [[003-firebase-auth-settings]] 3. pont).
- **SSR nincs** (Vite SPA), így a detector kliensoldalon gond nélkül fut.

---

## 10. Kapcsolódó tervek

- [[003-firebase-auth-settings]] – **kánon**: a felhasználóhoz kötött nyelv (`settings.language`) itt perzisztál; a nyelvváltó a Settings menüben is megjelenik.
- [[005-ingame-shop-strapi-stripe]] – a termékkatalógus szövegei a Strapi i18n pluginjén, ezzel a nyelvi réteggel összhangban lokalizáltak.

---

## 10. Becsült ráfordítás

| Feladat | Nagyságrend |
|---------|-------------|
| Infrastruktúra (i18n init, switcher, kulcskiszervezés) | ~fél–1 nap |
| Komponensek átírása `t()`-re | ~fél nap |
| 4 nyelv fordítása (en/fr/de/es), intro-szöveggel | ~fél–1 nap |
| Tesztek + finomhangolás | ~fél nap |

**Kész definíció:** mind az 5 nyelv váltható a menüből, a választás újratöltés után is megmarad, minden felhasználói szöveg (menü, dashboard, intro, loading, pause, overlay-ek, hibák, képernyő-ellenőrzés) lefordítva, a `<html lang>` a kiválasztott nyelvet tükrözi.
