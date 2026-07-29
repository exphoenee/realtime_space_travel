---
title: "Főmenü + Beállítások képernyő terve"
slug: 001-main-menu-settings
type: plan
category: ui
status: implemented
implemented: true
implemented_at: "2026-07-28"
created_at: "2026-07-25"
updated_at: "2026-07-29"  # frissítve: cím banner (title.webp), „Meet the creator" link, vendég-zár a Barátok/Áruház gombon; a vendég-tájékoztató 2026-07-29 óta toast ([[015-toast-notification]] H. blokk)
author: exphoenee
step: 1
phases: []
dependencies:
  - 000-i18n-nyelvesites
related_plans:
  - 002-ingame-shop-frontend
  - 003-firebase-auth-settings
  - 005-ingame-shop-strapi-stripe
  - 012-wall-of-shame
  - 013-social-multiplayer
  - 014-camera-consent
tags:
  - ui
  - main-menu
  - settings
  - i18n
  - difficulty
  - branding
  - css
  - a11y
---

# Főmenü + Beállítások képernyő terve

**Cél:** az intro után, a **küldetésválasztó előtt** egy **Főmenü** (`mainMenu`), ahonnan:
- **Bejelentkezés** (placeholder — a login a Firebase fázisban kerül bekötésre),
- **Játék indítása** (→ küldetésválasztó, `missionSelect`),
- **Áruház** (placeholder — a bolt-fázisban kerül bekötésre),
- **Beállítások** (→ Beállítások képernyő, `settings`),
- **Intro megtekintése** (→ az intro újralejátszása).

A **Beállítások képernyőn** (`SettingsScreen`) a játékos **zene hangerőt** állíthat, **nehézséget** (könnyű/közepes/nehéz) és **nyelvet** választhat. A korábbi **sarok-nyelvváltó és a „harangocska" (zene-némító gomb) megszűnt** — ezek helyét a Beállítások képernyő veszi át.

> **Állapot:** ez a fázis **implementálva** van (UI + helyi működés). A **login**, az **áruház** és a **nehézség játékmenetbe kötése**, valamint a **beállítások per-felhasználós mentése** szándékosan **nincs** bekötve — ezeket a következő fázisok végzik.

## Döntések (egyeztetve)

| Kérdés | Választás |
|--------|-----------|
| Új menü helye | Az intro **után**, a küldetésválasztó **előtt** |
| Főmenü gombjai | Játék indítása · Áruház · Beállítások · Intro megtekintése · Bejelentkezés |
| Beállítások tartalma | Zene hangerő (csúszka) · Nehézség (könnyű/közepes/nehéz) · Nyelvválasztó |
| Login / áruház / mentés / nehézség-hatás | **Most nem** — későbbi fázisokban |
| Sarok-nyelvváltó + harang | **Megszűnt** — a Beállítások képernyőre került |
| **Cím banner** (2026-07-28) | `public/title.webp` — két oldalt egy-egy figura (űrhajós balra, rakétás tehén jobbra), középen üres sáv a szövegnek |
| A banner szerepe | **Dekoratív** (`alt=""`, `aria-hidden="true"`) — a headline és a mottó **valódi szöveg** marad (`intro.headline`, `intro.motto`), így követi a választott nyelvet |
| Szövegméretezés a banneren | **Container query** — `.titleBanner { container-type: inline-size }`, a szöveg `cqw`-ben (`6cqw` / `2.8cqw`). A **bannerhez** skálázódik, nem a viewporthoz → a figurák és a felirat aránya minden panelszélességen ugyanaz |
| „Meet the creator" link | Háttér nélküli, kis betűs **szöveglink** a főmenü overlay **jobb alsó sarkában** → `https://viktor.bozzay.online`, `target="_blank"` + `rel="noopener noreferrer"` |

---

## 1. Képernyő-folyamat (GamePhase)

Új fázisok a `src/types/index.ts` `GamePhase`-be: **`mainMenu`** és **`settings`**; a korábbi küldetésválasztó fázis **`menu` → `missionSelect`**-re átnevezve.

```
intro ──(skip / auto)──▶ mainMenu ──(Játék indítása)──▶ missionSelect ──▶ loading ──▶ playing
   ▲                      │  ▲   ▲
   └──(Intro megtekintése)┘  │   │(← Vissza)
                (Beállítások)│   │
                             ▼   │
                          settings
```

- `intro` vége → **`mainMenu`** (`App.handleSkipIntro`).
- `mainMenu`: „Játék indítása" → `missionSelect`; „Beállítások" → `settings`; „Intro megtekintése" → `intro`; „Bejelentkezés"/„Áruház" → placeholder értesítés.
- `settings` → „Vissza" → `mainMenu`.
- `missionSelect` (küldetésválasztó) „← Vissza" gomb → `mainMenu`.
- Küldetés vége → „Vissza a főmenübe" → `resetToMenu` → **`mainMenu`**.
- `useGameStore.phaseToFlags`: `mainMenu`/`missionSelect`/`settings` = szüneteltetett pre-game állapot.
- `App.isPreGame` kibővítve; a `ScreenRouter` ágai: `mainMenu → MainMenu`, `missionSelect → MissionSelector`, `settings → SettingsScreen`.

---

## 2. Komponensek

### `MainMenu.tsx` (+ `.module.css`) — a Főmenü
- Cím (`intro.headline`) + mottó (`intro.motto`).
- Gombok: `mainMenu.start` (elsődleges), `mainMenu.shop`, `mainMenu.settings`, `mainMenu.intro`, `mainMenu.login`.
- Navigáció közvetlenül a store-ból (`transitionTo`).
- **Login/Áruház:** kattintásra `mainMenu.loginComingSoon` / `mainMenu.shopComingSoon` értesítés (nincs valódi funkció).

#### Cím banner + „Meet the creator" link (2026-07-28)

```
.overlay (position: absolute, inset: 0)
 ├── .panel  (max-width: 560px → 760px — a banner miatt; a gombok 320px-nél maradnak)
 │    ├── .titleBanner            container-type: inline-size; max-width: 720px
 │    │    ├── <img .titleImage>  src={BASE_URL}title.webp · alt="" · aria-hidden="true"
 │    │    └── .titleOverlay      inset: 0; flex column center
 │    │         ├── h1 .title     {t("intro.headline")}  font-size: 6cqw
 │    │         └── p  .motto     {t("intro.motto")}     font-size: 2.8cqw
 │    │         └── padding: 0 21% 0 25%   ← a bal oldali űrhajós és a jobb oldali
 │    │                                       rakétás tehén kikerülése
 │    └── .actions … (gombok)
 └── <a .creatorLink>  jobb alsó sarok · https://viktor.bozzay.online
                       target="_blank" rel="noopener noreferrer"
                       {t("mainMenu.meetCreator")}
```

- **A kép dekoratív:** `alt=""` + `aria-hidden="true"` — a képernyőolvasó a valódi szöveget (`h1` + `p`) olvassa, nem a grafikát. Ez az oka annak is, hogy a felirat **nincs beleégetve** a képbe: így követi a nyelvváltást.
- **`cqw` és nem `vw`:** a `container-type: inline-size` miatt a szöveg a **banner** szélességéhez skálázódik. Viewport-alapú méretezésnél a felirat és a figurák aránya panelszélességenként elcsúszna, és a szöveg rálógna a figurákra.
- **Olvashatóság:** `text-shadow` a `.title`-en és a `.motto`-n (`0 0 12px` / `0 0 10px`, sötét halo).
- **`.creatorLink`:** háttér és keret nélküli, `0.75rem`, halvány `rgba(125, 211, 252, 0.55)` szín; hoveren/`:focus-visible`-en `#67e8f9` + aláhúzás. Az `.overlay`-hez képest abszolút pozicionált (`right: 1.25rem; bottom: 1rem`), tehát nem tolja el a menüpanelt.

### `MissionSelector.tsx` (+ `.module.css`) — a küldetésválasztó
- A korábbi `MainMenu` átnevezve; a küldetéskártyák + DLC-szöveg változatlan.
- „← Vissza" gomb → `mainMenu`.

### `SettingsScreen.tsx` (+ `.module.css`)
- **Zene hangerő:** `<input type="range">` 0–1, `useUIStore.musicVolume`. Egyedi, kitöltött csúszka (`--fill` CSS változó), hangerő-ikon (🔇/🔉/🔊), százalék.
- **Nehézség:** szegmentált kapcsoló (könnyű/közepes/nehéz), `useUIStore.difficulty`. **A játékmenetbe még nincs bekötve.**
- **Nyelv:** a `LanguageSwitcher` komponens (ide költözött a sarokból).
- **Vissza** → `mainMenu`.

---

## 3. Állapot (useUIStore)

- **`musicVolume`** (0..1, alap = `MUSIC_ACTIVE_VOLUME`), `setMusicVolume` (0..1-re vágva).
- **`difficulty`** (`easy`|`medium`|`hard`, alap `medium`), `setDifficulty`.
- Mindkettő **helyi** `localStorage` persist (`space-travel-ui`) — a **per-felhasználós Firebase mentés a következő fázis**.
- `useAudio.playMusic(shouldPlay, isMuted, volume)` — a hangerőt fogadja; a csúszka **élőben** módosítja a zenét (pre-game alatt szól, mert nincs `destination`).
- A **harang** (`bellOverlay`, `handleToggleMusic`, `musicButton`) eltávolítva; a némítás a hangerő 0-ra állításával érhető el.

---

## 4. Nyelvesítés (i18n)

Új/átnevezett kulcsok mind az 5 nyelvben:
```
mainMenu.login / start / shop / settings / intro / loginComingSoon / shopComingSoon
settings.title / musicVolume / back / difficulty
difficulty.easy / medium / hard
```
A `LanguageSwitcher` a Beállítások képernyőn él.

**Bővítés (2026-07-28):**

| Kulcs | en | hu | fr | de | es |
|---|---|---|---|---|---|
| `mainMenu.meetCreator` | Meet the creator | A készítőről | Rencontrer le créateur | Über den Entwickler | Conoce al creador |

> A `title.webp` **nem** tartalmaz feliratot — a headline (`intro.headline`) és a mottó (`intro.motto`) a meglévő i18n kulcsokból jön, ezért a banner **nyelvfüggetlen eszköz**, és nem kell nyelvenkénti képváltozat.

---

## 5. Egyéb módosítás — intro

- **Blokk-megjelenítés javítva:** `scroll` esemény helyett `requestAnimationFrame` polling, mert a CSS transform-animáció nem vált ki scroll eseményt (korábban csak a főcím jelent meg).
- **Lassabb görgetés:** a debug-módú `--intro-scroll-duration` 60s → **120s**.

---

## 6. Kapcsolat a következő fázisokkal

- **[[003-firebase-auth-settings]]**: a **Bejelentkezés** gomb valódi Google/Anonymous auth-ra cserélődik; a hangerő + nehézség + nyelv **Firebase `settings`-be** ment/onnan tölt; a Beállítások kap egy **Fiók** szekciót.
- **[[002-ingame-shop-frontend]]**: az **Áruház** gomb a `mainMenu.shopComingSoon` placeholder helyett a valódi **helyi (frontend-only) `shop` fázisra** visz; a `SettingsScreen` bővül a **zeneválasztóval** (birtokolt sávok).
- **[[005-ingame-shop-strapi-stripe]]**: a bolt **backend-bekötése** (Strapi katalógus + Stripe fizetés) — a [[002-ingame-shop-frontend]] mock katalógusát/checkoutját cseréli le.
- **Nehézség**: a `difficulty` a játékmenetbe köthető (pl. figyelem-időzítők, `INACTIVITY_LIMIT_SECONDS` skálázása).

---

## 7. Érintett/új fájlok

**Új:** `MainMenu.tsx(+css)` (Főmenü), `SettingsScreen.tsx(+css)`, `src/components/ui/CustomSelect.tsx(+css)` (custom dropdown a Settings zenéihez), **`public/title.webp`** (cím banner asset, 2026-07-28).
**Átnevezett:** régi `MainMenu` → `MissionSelector.tsx(+css)`; `StartMenu` → `MainMenu`.
**Módosított:** `types/index.ts` (GamePhase + `Difficulty`), `useGameStore.ts` (phaseToFlags, resetToMenu → mainMenu), `useUIStore.ts` (musicVolume, difficulty), `useAudio.ts` (volume param), `App.tsx` (isPreGame, handleSkipIntro, harang eltávolítás, playMusic volume), `ScreenRouter.tsx`, `IntroScreen.tsx` (rAF-fix + lassítás), az 5 `translation.json`.

---

## 8. Haladás (TODO)

> Jelölés: `[ ]` hátravan · `[~]` folyamatban · `[x]` kész.

- [x] `GamePhase: mainMenu` + `settings`; `menu → missionSelect` átnevezés; `phaseToFlags`; `App.isPreGame`
- [x] `MainMenu` (Játék indítása / Áruház / Beállítások / Intro megtekintése / Bejelentkezés)
- [x] `MissionSelector` (átnevezés + „← Vissza")
- [x] `SettingsScreen` (hangerő + nehézség + nyelv + Vissza)
- [x] `useUIStore.musicVolume` + `difficulty`; `useAudio` hangerő-paraméter; `App` bekötés
- [x] Sarok-nyelvváltó és harang eltávolítása; `LanguageSwitcher` a Beállításokba
- [x] i18n kulcsok mind az 5 nyelven (`mainMenu.*`, `settings.*`, `difficulty.*`)
- [x] Intro: rAF-blokkfix + lassabb görgetés (120s)
- [x] **CustomSelect komponens:** `src/components/ui/CustomSelect.tsx + .module.css` — natív `<select>` helyett egyedi dropdown `role="combobox"`, billentyűzet navigáció (Enter/Escape/ArrowUp/Down), ARIA attribútumok, dark téma scrollbar. A Settings zenekiválasztója ezt használja.
- [x] Ellenőrzés: tsc, 14/14 teszt, build, kulcs-paritás (109/nyelv)

**Bővítés (2026-07-28) — cím banner + „Meet the creator" link**
- [x] `public/title.webp` banner asset (űrhajós balra, rakétás tehén jobbra, középen üres sáv)
- [x] `MainMenu.tsx` — `.titleBanner` wrapper: dekoratív `<img alt="" aria-hidden="true">` + `.titleOverlay` a valódi szöveggel (`intro.headline` + `intro.motto`) → **követi a nyelvváltást**
- [x] `MainMenu.module.css` — `.titleBanner { container-type: inline-size }`, `.title { font-size: 6cqw }`, `.motto { font-size: 2.8cqw }` — a **bannerhez** skálázódik, nem a viewporthoz
- [x] `MainMenu.module.css` — `.titleOverlay { padding: 0 21% 0 25% }` a figurák kikerülésére + `text-shadow` az olvashatóságért
- [x] `MainMenu.module.css` — `.panel` `max-width: 560px → 760px` (a gombok továbbra is 320px-nél maradnak)
- [x] `MainMenu.tsx` + `.module.css` — új `.creatorLink`: háttér nélküli, kis betűs szöveglink az overlay **jobb alsó** sarkában, `<a target="_blank" rel="noopener noreferrer">` a `https://viktor.bozzay.online` címre
- [x] i18n: új `mainMenu.meetCreator` kulcs **mind az 5 nyelven**
- [x] Ellenőrzés: `tsc --noEmit` tiszta · `npm run test` **77/77** zöld · `npm run build` sikeres

**Bővítés (2026-07-28) — vendég-tájékoztató a Barátok és az Áruház gombnál**

> ℹ️ **Frissítve (2026-07-29):** a tájékoztató **megjelenítése** időközben megváltozott — a gombok alatti beágyazott bekezdés helyett **toastként** jelenik meg a bal felső sarokban. A kanonikus leírás: [[015-toast-notification]] H. blokk / 0.9. Az alábbi tételek szövege ezt már követi; a 🔒 prefix, a `title` tooltip és az i18n kulcsok változatlanok.

- [x] A Barátok gomb vendégnél 🔒 prefixet kap + `friends.guestNotice` üzenetet mutat — a részletes leírás és indoklás: [[013-social-multiplayer]] O. blokk
- [x] Ugyanez az **Áruház** gombra is: 🔒 prefix + `shop.guestNotice` — indoklás: a vásárlásnak túl kell élnie egy eldobható vendég-sessiont ([[002-ingame-shop-frontend]] F rész)
- [x] **Közös minta a `MainMenu`-ben:** `guardedNav(phase, noticeKey)` helper adja mindkét gomb `onClick`-jét; a korábbi `handleShop` helper megszűnt. Vendégnél navigáció helyett `addToast("warning", t(noticeKey), GUEST_NOTICE_DURATION_MS)` fut ([[015-toast-notification]] H. blokk) — a `GUEST_NOTICE_DURATION_MS = 7000` azért hosszabb az 5 mp-es alapértelmezésnél, mert ezek kétmondatos üzenetek. A korábbi `guestNoticeKey: string | null` state, a hozzá tartozó „bejelentkezéskor tüntesd el" `useEffect` és a `MainMenu.module.css` `.guestNotice` osztálya **megszűnt**; a toast magától eltűnik, ismételt kattintásra pedig az `addToast` duplikáció-védelme miatt nem áll sorba több egyforma üzenet.
- [ ] **Login bekötése** (Firebase) → [[003-firebase-auth-settings]]
- [ ] **Áruház gomb bekötése** → [[002-ingame-shop-frontend]] (helyi bolt), később backend: [[005-ingame-shop-strapi-stripe]]
- [ ] **Nehézség hatása a játékmenetre** (későbbi)
- [ ] **Beállítások per-felhasználós mentése** (Firebase) → [[003-firebase-auth-settings]]

---

## 9. Kapcsolódó tervek
- [[003-firebase-auth-settings]] – login, per-felhasználós beállítás-mentés, Fiók-szekció.
- [[000-i18n-nyelvesites]] – a nyelvi réteg; a `LanguageSwitcher` most a Beállításokban. A `mainMenu.meetCreator` kulcs is teljes paritással került be mind az 5 nyelvbe.
- [[002-ingame-shop-frontend]] – az Áruház gomb valódi (helyi) célja; a Beállítások zeneválasztója. **2026-07-28 óta a gomb vendégnél zárt** (🔒 + `shop.guestNotice`), a `guardedNav` helperrel közösen a Barátok gombbal.
- [[005-ingame-shop-strapi-stripe]] – a bolt későbbi backend-bekötése (Strapi + Stripe).
- [[012-wall-of-shame]] – a „Szégyenfal" gomb belépési pontja a főmenüben.
- [[013-social-multiplayer]] – a „Barátok" gomb; **vendégnél letiltva** (🔒 + `friends.guestNotice`), a `ScreenRouter` vendég-őrével együtt (O. blokk).
- [[014-camera-consent]] – a „Játék indítása" gomb kamera-hozzájárulás nélküli letiltása ugyanezen a panelen.
- [[015-toast-notification]] – **a vendég-tájékoztató megjelenítésének kanonikus forrása (2026-07-29).** A `guardedNav` a beágyazott bekezdés helyett `addToast("warning", …, GUEST_NOTICE_DURATION_MS)`-t hív; a `.guestNotice` CSS osztály és a `guestNoticeKey` state megszűnt (H. blokk / 0.9).

---

## 10. Kockázatok / figyelmeztetések (2026-07-28)

- **A banner dekoratív, a szöveg nem lehet beleégetve.** Ha a felirat a képbe kerülne, a főmenü elveszítené a nyelvfüggetlenségét (5 nyelv × 1 asset), és a képernyőolvasó számára is olvashatatlan lenne. Ezért `alt=""` + `aria-hidden="true"`, és a `h1`/`p` valódi i18n szöveg.
- **`cqw`, nem `vw`.** A `container-type: inline-size` nélkül a felirat a viewporthoz skálázódna, és keskeny panelen **rálógna a figurákra**. A `padding: 0 21% 0 25%` aszimmetrikus — a bal oldali űrhajós szélesebb helyet foglal, mint a jobb oldali rakétás tehén; a kép cseréjekor ezt az arányt **újra kell mérni**.
- **A `.panel` szélesítése (560px → 760px) globális a főmenüre.** A gombok `max-width: 320px` korlátja tartja a régi arányt — ezt nem szabad eltávolítani, különben a gombsor a banner szélességére nyúlik.
- **Külső link:** a `target="_blank"` mellé **kötelező** a `rel="noopener noreferrer"` (tabnabbing + referrer-szivárgás). A link elhagyja az alkalmazást — játék közben nem érhető el, csak a főmenüben.
- **Asset-útvonal:** a kép `import.meta.env.BASE_URL` alapján töltődik (`${BASE_URL}title.webp`), mert a `base href` `/realtime_space_travel/`. Hardcodeolt `/title.webp` a GitHub Pages buildben 404-et adna.
