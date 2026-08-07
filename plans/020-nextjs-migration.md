---
title: "Next.js 16 migráció – Vite SPA → Next.js App Router Vercelen, a Stripe szerveroldal megteremtéséért"
slug: 020-nextjs-migration
type: plan
category: core
status: not-started
implemented: false
implemented_at: null
created_at: "2026-07-30"
updated_at: "2026-08-06"
author: exphoenee
step: 20
phases: []
dependencies:
  - 003-firebase-auth-settings
  - 005-ingame-shop-strapi-stripe
  - 007-state-persist-page-refresh
related_plans:
  - 016-notification-retention
  - 017-starfield-realism
  - 018-intro-deterministic-layout
tags:
  - nextjs
  - migration
  - vercel
  - infrastructure
  - build
  - ssr
  - hydration
  - mediapipe
  - deploy
  - api-routes
---

# Next.js migráció – Vite SPA → Next.js App Router Vercelen (a hiányzó szerveroldal megteremtése)

**Cél:** a ma tisztán kliensoldali Vite SPA teljes átköltöztetése **Next.js App Routerre**, Vercel hosztolással, hogy a projekt **szerveroldali futtatókörnyezetet** kapjon. A Firebase (Auth + Realtime Database) háttérszolgáltatásként megmarad; a GitHub Pages deployment megszűnik.

> 🎯 **Miért készül ez a terv — egy mondatban.** A [[021-stripe-fraud-defense]] és a [[024-stripe-go-live]] **nem fejezhető be szerveroldal nélkül**: nincs hova tenni a Stripe titkos kulcsot, nincs mi fogadja a webhookot, és nincs mi írja a pénztárcát szerveroldalról. A [[005-ingame-shop-strapi-stripe]] pontosan azért választotta a Payment Link megoldást, mert a Firebase **Spark** csomagon nincs Cloud Functions. Ez a migráció **nem a Stripe-ot valósítja meg**, hanem **megteremti a helyet**, ahol a 021 F fázisa és a 024 végre elvégezhető.

> ⚠️ **Ez a migráció NEM SSR-előnyökért történik.** A játék lényegében teljes egészében kliensoldali: canvas + `requestAnimationFrame` + webkamera + `getUserMedia` + Web Audio + `localStorage`. A szerveroldali renderelésnek **nulla haszna** és **jelentős kockázata** van itt (hidratálási eltérések). A cél **kizárólag** az API route-ok (`app/api/**`) és a szerveroldali titokkezelés. **Egy későbbi olvasó ne kezdje el szerverkomponensesíteni a játékot** — a 9. szekció ezt tételesen kimondja.

> ⚠️ **A migráció legkockázatosabb pontja a MediaPipe arcfelismerés (E. blokk).** A webkamera és az arcfelismerés a játék **létfeltétele** — ha ez elbukik, a termék nem működik. A jelenlegi mechanizmus egy `index.html`-beli `<script>` tagre és egy Vite aliasra épül, és Next.js-ben **nincs `index.html`**. Erre külön blokk, külön commit és külön ellenőrzés van.

---

## Döntések (egyeztetve)

| Kérdés | Választás |
|--------|-----------|
| Migráció jellege | **Teljes.** Az egész alkalmazás átköltözik Vite-ról Next.js-re (App Router). ❌ Nem hibrid, ❌ nem külön backend projekt a Vite SPA mellé |
| Deploy cél | **Vercel.** A Firebase **megmarad** háttérszolgáltatásnak (Auth + Realtime Database), de az alkalmazás-hosztolás Vercelre kerül |
| GitHub Pages | **Megszűnik.** A `.github/workflows/deploy.yml` **törlendő** |
| Firebase Hosting | Az alkalmazás-hosztolás megszűnik. A `firebase.json` `hosting` szekciója **átalakul**: vagy törlődik, vagy egy 301-es átirányításra csupaszodik a Vercel domainre (lásd 7.9 — ez a **Payment Link redirect URL** miatt fontos) |
| RTDB Security Rules deploy | **Marad GitHub Actionben**, de egy **lecsupaszított** workflow-ban: csak `firebase deploy --only database`, build és env változók nélkül |
| App Router vs. Pages Router | **App Router** — az API route-ok (`app/api/**/route.ts`), a `next/script` `beforeInteractive` és a jövőbeli szerveroldali kód mind ezt feltételezi |
| Renderelési mód | **`ssr: false` kliens-only mountolás.** A teljes `src/` fa egyetlen `dynamic(..., { ssr: false })` határ mögé kerül. Nincs szerveroldali React-renderelés a játékból |
| Statikus export (`output: "export"`) | ❌ **Nem** — az kizárná az API route-okat, azaz pont a migráció célját |
| Zustand persist | **Kettős védelem:** `ssr: false` határ (elsődleges) + `skipHydration: true` + kliensoldali `rehydrate()` a két perzisztált store-on (másodlagos) |
| i18next | **Kliensoldali init marad**, `i18next-browser-languagedetector`-ral. ❌ Nincs Next-natív i18n útvonal (`/hu/...` szegmensek) — indoklás: 1.6 |
| Tesztek | **Vitest marad.** 147 zöld teszt / 9 fájl nem kockáztatható. A `vite.config.ts` `test` blokkja külön `vitest.config.ts`-be költözik |
| Path alias (`@/…`) | ❌ **Nem vezetünk be.** A relatív importok maradnak, hogy a 92 forrásfájl importsorai **ne módosuljanak**. A migráció így kizárólag env- és asset-útvonal-jellegű változás a `src/`-ben |
| MediaPipe betöltés | **`next/script` `beforeInteractive`** a root layoutban + **lusta (lazy) stub**. A ma eager `window.FaceDetection` olvasás Next-ben **kötelezően** lustává alakítandó (7.3) |
| MediaPipe alias | **webpack alias** a `next.config.ts`-ben (`config.resolve.alias`), a mai `vite.config.ts` alias 1:1 megfelelője. Turbopack esetén `turbopack.resolveAlias` **is** kell |
| Cross-origin isolation (COEP/COOP) | ❌ **Nem** kerül dokumentum-szintre. A mai `firebase.json` a headereket csak a `.wasm` **assetre** teszi (tehát ma sincs valódi izoláció). Dokumentum-szintű COEP **elrontaná a `signInWithPopup` Google bejelentkezést** (7.5) |
| Routing | **Catch-all `app/[[...slug]]/page.tsx`** — pontosan a mai `firebase.json` `"**" → /index.html` SPA-fallback szemantikája. Így a `/shop/success` és a 024 jövőbeli `/legal/*` mély linkjei **külön fájl nélkül** működnek |
| Debug mód | **Vercel környezetenkénti env:** Production `NEXT_PUBLIC_DEBUG_MODE=false`, Preview `true`, Development `true`. Ez pótolja azt, amit a GitHub Pages build adott |
| Stripe kulcs helye | **`STRIPE_SECRET_KEY`, `NEXT_PUBLIC_` prefix NÉLKÜL**, Vercel env változóként. Fizikailag képtelen a bundle-be kerülni — ez oldja fel a [[021-stripe-fraud-defense]] 3.0 ellentmondását |
| API route-ok ebben a tervben | **Csak egy füstteszt** (`app/api/health/route.ts`). A Stripe Checkout Session és webhook route-ok a [[021-stripe-fraud-defense]] F fázisához és a [[024-stripe-go-live]]-hoz tartoznak — itt csak a **hely és a minta** készül el |
| i18n kulcsok | **Nulla új kulcs.** A paritás mind az 5 nyelven változatlan — a `dev` skill **ne indítsa** az `i18n` agentet |

---

## ✅ Haladás (TODO)

> Jelölés: `[ ]` hátravan · `[~]` folyamatban · `[x]` kész.

**A. Baseline rögzítése — ezt NE hagyd ki**

> ⚠️ A [[017-starfield-realism]] A. blokkja kimaradt, és emiatt a K. blokk hangolása **nem tudott mihez mérni**. Egy build-rendszer cseréjénél ez sokkal drágább hiba: a „régen is ilyen volt?" kérdés minden egyes furcsaságnál fel fog merülni.

- [ ] `npm run test` lefuttatva a migráció **előtt**, a pontos szám rögzítve (elvárt: **147 teszt / 9 fájl**, mind zöld)
- [ ] `npm run build` (Firebase target) lefuttatva, a `dist/assets/*.js` **bundle-méret** rögzítve (későbbi összevetéshez)
- [ ] A futó játékról képernyőkép: főmenü, küldetésválasztó, játék közbeni HUD + csillagmező, shop (mind a 4 fül)
- [ ] A DevTools Network fülön rögzítve, **mely MediaPipe fájlok töltődnek be** és milyen sorrendben (`face_detection.js`, `*_solution_simd_wasm_bin.js`, `.wasm`, `.data`, `.binarypb`, `.tflite`)
- [ ] A `public/mediapipe/` mappa **összmérete** megmérve (a Vercel deployment-méretkorlát miatt — 7.6)
- [ ] Git: a migráció **külön ágon** indul (`feat/nextjs-migration`), nem a `develop`-on közvetlenül
- [ ] ✅ **Ellenőrzési pont:** a régi állapotról van mérés és képanyag; a visszaállás (`git checkout develop`) egyetlen paranccsal lehetséges

**B. Next.js váz felállítása** *(a `src/` még hozzá sem nyúlunk)*

- [ ] Verzió-döntés rögzítése: **Next.js 16.x (App Router)** + **React 19.x**. A `react` / `react-dom` `18.x` → `19.x` frissítés **része a migrációnak**. A kockázatot és a mérést lásd 7.2. *(✅ **Eldőlt (2026-07-30):** a felhasználó vállalta a React 19-et — lásd 12.2.)*
- [ ] ⚠️ **Verzió-ellenőrzés a registry-ben, ne emlékezetből.** A terv első változata Next 15-öt írt elő, mert az AI asszisztens tudásbázisa elavult volt; a `npm view next version` **16.2.12**-t adott (2026-07-31). Az implementáció **első lépése** legyen `npm view next version` és `npm view react version` — a verziószámot a registry döntse el, ne a terv szövege
- [ ] `npm i next@15 react@19 react-dom@19` + `npm i -D @types/react@19 @types/react-dom@19 eslint-config-next`
- [ ] `npm uninstall @vitejs/plugin-react` **NEM** — marad devDependencyként, mert a Vitest React-teszteket futtat (I. blokk)
- [ ] `next.config.ts` (**ÚJ**) — üres vázzal indul, a webpack alias és a headerek az E. blokkban kerülnek bele
- [ ] `app/layout.tsx` (**ÚJ**, szerver komponens) — `<html lang="en" suppressHydrationWarning>`, `<body>`, `metadata` export
- [ ] `app/layout.tsx`: a mai `index.html` **összes** `<meta>` / `<link>` tagje átvezetve Next `metadata` objektumba (title, description, icons, manifest, themeColor, openGraph, twitter)
- [ ] `app/layout.tsx`: `metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://<vercel-domain>")` — ez váltja ki a `scripts/build.mjs` `__OG_DOMAIN__` helyettesítését
- [ ] `app/globals.css` (**ÚJ**) — a gyökérben lévő `index.css` **áthelyezve**, importálva a `layout.tsx`-ben
- [ ] `app/AppShell.tsx` (**ÚJ**, `"use client"`) — `const App = dynamic(() => import("../src/App"), { ssr: false })`, körülötte az `ErrorBoundary` + `ScreenCheck` (a mai `index.tsx` render-fája)
- [ ] ⚠️ Az `AppShell` **kliens komponens kell legyen**: a `dynamic(..., { ssr: false })` szerver komponensben **hibát dob**. ⚠️ Ez az állítás Next **15**-re lett ellenőrizve — a Next 16 upgrade guide alapján **újra igazolandó** (12.2)
- [ ] `app/[[...slug]]/page.tsx` (**ÚJ**, szerver komponens) — mindössze `<AppShell />`-t renderel. ⚠️ **Nem** jön létre `app/page.tsx`, mert az ütközne az opcionális catch-all route-tal
- [ ] `app/api/health/route.ts` (**ÚJ**) — `export const runtime = "nodejs"`, `GET` → `{ ok: true, env: process.env.VERCEL_ENV ?? "local" }`. Ez a **szerveroldal füstteszte**, egyben a Stripe route-ok mintája
- [ ] `tsconfig.json` frissítése: `"jsx": "preserve"`, `"moduleResolution": "bundler"`, `"plugins": [{ "name": "next" }]`, `"incremental": true`, `include`-ba `next-env.d.ts` és `.next/types/**/*.ts`
- [ ] ⚠️ `src/css.d.ts` **TÖRLENDŐ** — a `next-env.d.ts` már deklarálja a `*.module.css` modult, a kettő azonos nevű `default` exportja **`Duplicate identifier 'default'` TS hibát** ad
- [ ] `package.json` scriptek: `"dev": "next dev"`, `"build": "next build"`, `"start": "next start"`, `"lint": "next lint"`, `"typecheck": "tsc --noEmit"`, `"test": "vitest run"`
- [ ] `package.json`: a `build:firebase` és `build:gh-pages` scriptek **törlendők**
- [ ] `.gitignore`: `.next/`, `next-env.d.ts` (utóbbi generált, de a Next dokumentáció szerint **commitolandó** — döntés rögzítve)
- [ ] ✅ **Ellenőrzési pont:** `npm run dev` elindul, a `/` üres/hibás oldalt ad (ez még rendben van), a `/api/health` **JSON-t válaszol** — a szerveroldal él

**C. Env változó átvezetés — tételes** *(3.1 tábla, 27 előfordulás, 17 fájl)*

- [ ] `.env.example` átírva: mind a 8 `VITE_FIREBASE_*` → `NEXT_PUBLIC_FIREBASE_*`, `VITE_DEBUG_MODE` → `NEXT_PUBLIC_DEBUG_MODE`
- [ ] `.env.example`: `VITE_STRIPE_SECRET_KEY` → **`STRIPE_SECRET_KEY`** (prefix nélkül) + a komment átírása: „**szerveroldali** változó, `NEXT_PUBLIC_` prefix nélkül fizikailag nem kerülhet a kliens bundle-be" (ez a [[021-stripe-fraud-defense]] A fázisának egy tételét **elvégzi**)
- [ ] `.env.example`: új `NEXT_PUBLIC_SITE_URL` sor (a `metadataBase`-hez)
- [ ] Helyi `.env` átnevezése `.env.local`-ra (Next konvenció; a `.env` is működik, de a `.env.local` gitignore-olt alapból)
- [ ] `src/firebase/config.ts` — **8 sor** (6, 7, 8, 9, 23, 24, 25, 26): `import.meta.env.VITE_FIREBASE_*` → `process.env.NEXT_PUBLIC_FIREBASE_*`
- [ ] `src/firebase/userData.ts:11` — `VITE_DEBUG_MODE` → `NEXT_PUBLIC_DEBUG_MODE`
- [ ] `src/state/useUIStore.ts:76` — idem
- [ ] `src/state/useShopStore.ts:255` — idem
- [ ] `src/hooks/useEventSystem.ts:26` — idem
- [ ] `src/components/shop/ShopScreen.tsx:142` — idem
- [ ] `src/components/screens/IntroScreen.tsx:9` — idem
- [ ] `src/components/screens/MainMenu.tsx:13` — idem
- [ ] `src/constants/shopCatalog.ts:54` — `import.meta.env.DEV` → `process.env.NODE_ENV !== "production"`. ⚠️ **Viselkedés-jegyzet:** a Vercel **preview** build is production build (`NODE_ENV === "production"`), tehát a preview a **prod** Payment Linket használja — pontosan úgy, ahogy ma a GitHub Pages build. A [[024-stripe-go-live]] élesítéskor ezt **explicit kapcsolóra** akarhatja cserélni (3.4)
- [ ] ⚠️ **Nem szabad** `process.env`-et objektumként destrukturálni vagy dinamikusan indexelni (`process.env[key]`) — a Next build-idejű behelyettesítése **csak a szó szerinti `process.env.NEXT_PUBLIC_X` alakot** ismeri fel
- [ ] Ellenőrzés grepnel: `import.meta` **nulla** előfordulás a `src/`-ben és a gyökérben (a `plans/` és a `.claude/` találatok dokumentációk, azok maradnak)
- [ ] ✅ **Ellenőrzési pont:** `npm run typecheck` hibamentes; `npm run dev` → a Firebase inicializálódik (nincs „Missing Firebase config" hiba), a debug mód a `.env.local` szerint kapcsol

**D. `BASE_URL` kiiktatás — tételes** *(3.2 tábla, 11 előfordulás, 9 fájl)*

> A base path `/realtime_space_travel/` a GitHub Pages öröksége. Vercelen az app a **gyökéren** fut, tehát minden asset-hivatkozás abszolút gyökér-relatív lesz.

- [ ] `src/App.tsx:777` — `${import.meta.env.BASE_URL}spaceships/${…}` → `/spaceships/${…}`
- [ ] `src/components/ui/Starfield.tsx:120` — cockpit fallback → `/spaceships/russian1.webp` *(⚠️ a [[017-starfield-realism]] által frissen írt kódrégió — a diff itt ütközhet, ha a 017 még nem mergelt)*
- [ ] `src/hooks/useAudio.ts:9` — `main_theme.mp3` fallback → `/music/main_theme.mp3`
- [ ] `src/hooks/useAudio.ts:11` — ugyanaz a fallback a nem talált terméknél
- [ ] `src/hooks/useAudio.ts:12` — `/music/${product.file}`
- [ ] `src/components/shop/ShipPreviewModal.tsx:90` — `/spaceships/${product.image}`
- [ ] `src/components/shop/ProductCard.tsx:44` — `/spaceships/${ship.image}`
- [ ] `src/components/shop/MusicPreviewButton.tsx:150` — `/music/${file}`
- [ ] `src/components/screens/MainMenu.tsx:146` — `/title.webp`
- [ ] `src/components/screens/ShipInfoModal.tsx:36` — `/spaceships/${ship.image}`
- [ ] `src/components/screens/ShipSelectScreen.tsx:28` — `/spaceships/${ship.image}`
- [ ] `index.tsx` **TÖRLENDŐ** — benne a `setBaseHref()` futásidejű logika (`/realtime_space_travel/` vs `/`) tárgytalanná válik
- [ ] `index.html` **TÖRLENDŐ** — a `<base href="__BASE_HREF__">`-fel együtt
- [ ] `vite.config.ts` **TÖRLENDŐ** (a `test` blokkja az I. blokkban `vitest.config.ts`-be költözik) — benne a `base: process.env.VITE_BASE_PATH || "/realtime_space_travel/"`
- [ ] `scripts/build.mjs` **TÖRLENDŐ** — a `__BASE_HREF__` / `__OG_DOMAIN__` helyettesítést a Next `metadata` váltja ki
- [ ] `src/services/faceRecognition.ts:115` — a `new URL("mediapipe/face_detection", document.baseURI)` → **`"/mediapipe/face_detection"`** (abszolút). A `document.baseURI` a `<base href>` eltűnésével az oldal URL-jét adná vissza, ami mély linken (`/shop/success`) **rossz útvonalat** képezne. A régi kommentblokk (GitHub Pages vs. Firebase) törlendő
- [ ] ⚠️ Az `<img src>` hivatkozások **maradnak natív `<img>`-nek** — ❌ **nem** cseréljük `next/image`-re (indoklás: 9. szekció)
- [ ] Ellenőrzés grepnel: `BASE_URL`, `baseURI`, `realtime_space_travel/` → **nulla** előfordulás a `src/`-ben
- [ ] ✅ **Ellenőrzési pont:** `npm run dev` → a főmenü címképe, az összes űrhajókép és a zenék betöltődnek; a Network fülön **nulla 404**

**E. MediaPipe újrahuzalozás** ⚠️ *a terv legkockázatosabb blokkja — külön commit, külön ellenőrzés*

- [ ] `public/mediapipe/**` **változatlanul marad** — Vercelen a `public/` gyökér-relatívan szolgálódik ki (`/mediapipe/face_detection/…`), ugyanaz az útvonal, mint ma a Firebase Hostingon
- [ ] `app/layout.tsx`: `import Script from "next/script"` + `<Script src="/mediapipe/face_detection/face_detection.js" strategy="beforeInteractive" />` a `<body>`-ban
- [ ] ⚠️ A `beforeInteractive` **kizárólag a root layoutban** működik App Routerben — máshova téve némán `afterInteractive`-ként viselkedik
- [ ] `src/stubs/mediapipe-stub.ts` **átírása lustára** — a mai `export const FaceDetection = (window as any).FaceDetection;` **modulkiértékeléskor** olvassa a globált. Ez Next-ben két külön okból bukik: (a) szerveroldalon `window is not defined`, (b) kliensen a script tag lefutása **előtti** kiértékelésnél `undefined`, ami **később sem javul ki**. Megoldás: `Proxy`-alapú lusta feloldás (kód: 1.4.2)
- [ ] `next.config.ts`: `webpack: (config) => { config.resolve.alias["@mediapipe/face_detection"] = path.resolve(__dirname, "src/stubs/mediapipe-stub.ts"); return config; }` — a mai `vite.config.ts` aliasának 1:1 megfelelője
- [ ] `next.config.ts`: **Turbopack-alias is** felvéve (`turbopack: { resolveAlias: { "@mediapipe/face_detection": "./src/stubs/mediapipe-stub.ts" } }`), különben `next dev --turbopack` alatt más modult old fel, mint `next build` alatt — ez a legalattomosabb fajta „nálam működik" hiba
- [ ] `next.config.ts`: `transpilePackages` / `serverExternalPackages` szükségességének ellenőrzése a `@tensorflow/tfjs` és `@tensorflow-models/face-detection` csomagokra
- [ ] ⚠️ A `vite.config.ts` `optimizeDeps.exclude: ["@mediapipe/face_detection"]` beállításának **nincs Next-megfelelője és nem is kell** — a webpack az aliast követi, nincs előre-bundlelés
- [ ] `next.config.ts` `headers()`: a `/mediapipe/:path*` útvonalra a mai `firebase.json` `.wasm` headerei (`Cross-Origin-Embedder-Policy: require-corp`, `Cross-Origin-Opener-Policy: same-origin`) **asset-szinten** átvezetve
- [ ] ⚠️ **Tilos** ugyanezeket a headereket a **dokumentumra** (`/:path*`) tenni: a dokumentum-szintű COEP/COOP elvágná a `signInWithPopup` ablak-kommunikációt, azaz **elrontaná a Google bejelentkezést** (`src/firebase/auth.ts:38`). Ma sincs valódi cross-origin izoláció, és nem is kell (7.5)
- [ ] A `.wasm`, `.binarypb`, `.data`, `.tflite` fájlok **MIME típusa** ellenőrizve a Vercel preview deploymenten (a `.binarypb` `application/octet-stream`-ként érkezhet — a MediaPipe ezt elfogadja, de meg kell nézni)
- [ ] ✅ **Ellenőrzési pont 1 (fejlesztői):** `npm run dev` → böngésző konzol → `typeof window.FaceDetection === "function"` **még a React mount előtt**
- [ ] ✅ **Ellenőrzési pont 2 (fejlesztői):** kamera engedélyezése → az arcfelismerés elindul, a DebugOverlay arc-adatokat mutat, elfordulásra a játék `paused` → `countdown` felé megy
- [ ] ✅ **Ellenőrzési pont 3 (prod build):** `npm run build && npm start` → **ugyanez** működik. ⚠️ Ezt **kötelező** külön ellenőrizni: a dev és a prod bundling máshogy oldja fel az aliast
- [ ] ✅ **Ellenőrzési pont 4 (Vercel preview):** a **deployolt** URL-en, HTTPS-en, valódi webkamerával működik az arcfelismerés

**F. Zustand persist + SSR hidratálás**

> A CLAUDE.md négy perzisztált store-t említ; a **tényleges** állapot ettől eltér (lásd 1.5) — ez a blokk a valóság szerinti **négy localStorage-érintkezési pontot** kezeli.

- [ ] Az elsődleges védelem az **`ssr: false` határ** (B. blokk `AppShell`): a `src/` fa a szerveren **soha nem értékelődik ki**, tehát a `localStorage` hozzáférés nem fut le szerveroldalon
- [ ] `src/state/useGameStore.ts` (persist `space-travel-game`): `skipHydration: true` a persist opciókhoz
- [ ] `src/state/useShopStore.ts` (persist `space-travel-shop`): `skipHydration: true`
- [ ] `app/AppShell.tsx` vagy `src/App.tsx`: egyszeri `useEffect`-ben `useGameStore.persist.rehydrate()` és `useShopStore.persist.rehydrate()`
- [ ] ⚠️ A rehidratálás **a `src/App.tsx` első render-jénél korábban** kell megtörténjen ott, ahol a perzisztált `gamePhase` dönt a képernyőről — különben egy villanásnyi `intro` látszik, mielőtt a mentett fázis visszaáll. Ha ez zavaró: rehidratálás előtt `null` renderelése (rövid `LoadingScreen`)
- [ ] `src/state/useAuthStore.ts:61` — a `getDeviceId()` hívás **modul-kiértékeléskor** fut (`localStorage` + `crypto.randomUUID`). Az `ssr: false` határ ezt lefedi, de **defence-in-depth**ként a `src/firebase/deviceId.ts` kapjon `typeof window === "undefined"` őrt (szerveren üres string), mert a store-t egy jövőbeli API route-segédmodul is importálhatja
- [ ] `src/i18n/index.ts` — a `space-travel-lang` localStorage kulcsot az `i18next-browser-languagedetector` írja; a G. blokk kezeli
- [ ] `realtime_space_travel_device_id` (nyers localStorage kulcs) és a `realtime_space_travel_pending_credit` (`sessionStorage` + `localStorage`, [[005-ingame-shop-strapi-stripe]]) — ellenőrizve, hogy mindkettő **kizárólag** kliens-only kódútvonalon íródik
- [ ] Ellenőrzés: a persist kulcsok **változatlanok** (`space-travel-game`, `space-travel-shop`, `space-travel-lang`) — a migráció után a **meglévő játékosok állapota megmarad**, ha a domain ugyanaz. ⚠️ **Domainváltásnál a localStorage NEM vándorol** (7.10)
- [ ] ✅ **Ellenőrzési pont:** a böngésző konzoljában **nulla** „Hydration failed" / „Text content did not match" figyelmeztetés; F5 után a játék ugyanabba a fázisba tér vissza, mint eddig ([[007-state-persist-page-refresh]] viselkedése változatlan)

**G. i18next kliensoldali init**

- [ ] `src/i18n/index.ts` **logikája változatlan** — ugyanaz az 5 nyelv, ugyanaz a `LanguageDetector`, ugyanaz a `space-travel-lang` kulcs, ugyanazok a JSON importok
- [ ] Az `import "./src/i18n"` side-effect import a törölt `index.tsx`-ből átkerül a `app/AppShell.tsx`-be (vagy marad a `src/App.tsx` meglévő `import i18n from "./i18n/index"` sorában)
- [ ] `src/i18n/index.ts`: a `.use(LanguageDetector)` ág kapjon `typeof window !== "undefined"` őrt (defence-in-depth; szerveren `fallbackLng: "en"` fix nyelvre inicializálna)
- [ ] `app/layout.tsx`: `<html lang="en" suppressHydrationWarning>` — a `document.documentElement.lang` futásidejű felülírását (`applyDocumentLang`) a React nem tekinti eltérésnek, de az őr így is indokolt
- [ ] Ellenőrzés: a `src/i18n/locales/**` **egyetlen fájlja sem módosul**; a kulcsparitás mind az 5 nyelven **változatlan**
- [ ] ✅ **Ellenőrzési pont:** nyelvváltás a `LanguageSwitcher`-rel működik; F5 után a választott nyelv megmarad; nincs nyelv-eltérésből fakadó hidratálási figyelmeztetés

**H. `"use client"` határok + routing**

- [ ] A szerver/kliens határ **egyetlen ponton** húzódik: `app/[[...slug]]/page.tsx` (szerver) → `app/AppShell.tsx` (`"use client"`, `ssr: false`) → `src/**` (minden kliens)
- [ ] ⚠️ A `src/` alatti **egyetlen fájlba sem** kerül `"use client"` direktíva — a határt az `AppShell` húzza meg, és a direktíva onnan öröklődik. 92 fájl fejlécének módosítása felesleges zaj lenne
- [ ] `src/components/ui/ErrorBoundary.tsx` — **class komponens marad** (CLAUDE.md kötelezi); a kliens határ mögött ez teljesen rendben van
- [ ] `/shop/success` mély link ellenőrizve: az `src/App.tsx:275` `window.location.pathname.includes("/shop/success")` detektálás **változatlanul működik** a catch-all route alatt
- [ ] `src/components/shop/ShopScreen.tsx:119-122` — a `window.history.replaceState` URL-tisztítás **változatlanul működik** (nem Next router, hanem natív History API — ez itt előny, nem hiba)
- [ ] ⚠️ **Nem vezetünk be `next/navigation` routert.** A játék belső navigációja `GamePhase` állapotgéppel megy, nem URL-lel — ez így marad
- [ ] A catch-all route következménye rögzítve: ismeretlen URL **200**-at ad 404 helyett, pontosan úgy, mint ma az SPA-fallback
- [ ] Forward-compat jegyzet a [[024-stripe-go-live]] C fázisához: a `/legal/terms`, `/legal/privacy`, `/legal/refund`, `/legal/imprint` mély linkek a catch-all alatt **külön route-fájl nélkül** működni fognak
- [ ] ✅ **Ellenőrzési pont:** `/`, `/shop/success?session_id=cs_test_x`, `/legal/terms`, `/tetszoleges/url` — mind a játékot tölti be, a `session_id` query paraméter **megérkezik** a kliensre

**I. Tesztek — Vitest megtartása**

- [ ] `vitest.config.ts` (**ÚJ**) — a `vite.config.ts` `test` blokkjából: `globals: true`, `environment: "jsdom"`, `setupFiles: ["./src/test/setup.ts"]`, `plugins: [react()]`
- [ ] `vitest.config.ts`: a **MediaPipe alias átvezetve** (`"@mediapipe/face_detection"` → `src/stubs/mediapipe-stub.ts`) — enélkül a `faceRecognition.test.ts` elbukik
- [ ] `vitest.config.ts`: `test.env` blokk a determinisztikus env-hez (`NEXT_PUBLIC_DEBUG_MODE: "false"`, `NEXT_PUBLIC_FIREBASE_*` dummy értékek)
- [ ] ⚠️ **Előny, nem hátrány:** a `process.env` a Vitest alatt natívan létezik, míg az `import.meta.env` eddig Vite-specifikus behelyettesítés volt — a tesztkörnyezet ettől **egyszerűbb** lesz
- [ ] A lusta MediaPipe stub (E. blokk) tesztkompatibilitása ellenőrizve: a `Proxy` nem szabad, hogy **puszta importra** dobjon — csak tényleges használatkor (`construct` / `get`)
- [ ] A `vite` és `@vitejs/plugin-react` **devDependencyként marad** (a Vitest belül Vite-ot használ)
- [ ] ✅ **Ellenőrzési pont:** `npm run test` → **147/147 zöld, 9 fájl** — pontosan a baseline szám. **Egyetlen teszt elvesztése sem elfogadható**

**J. Deploy pipeline**

- [ ] `.github/workflows/deploy.yml` **TÖRLENDŐ** (GitHub Pages)
- [ ] GitHub repository beállítás: Settings → Pages → a Pages forrás kikapcsolása / a `github-pages` environment törlése
- [ ] `.github/workflows/deploy-firebase.yml` **átalakítása** `deploy-database-rules.yml`-lé: csak `npx firebase-tools deploy --only database`; ❌ nincs `npm install`, ❌ nincs build, ❌ **nincs egyetlen env változó sem**
- [ ] Az új workflow triggere szűkítve: `on: push: branches: [main], paths: ["database.rules.json", "firebase.json"]` + `workflow_dispatch`
- [ ] ⚠️ A `FIREBASE_TOKEN` (`firebase login:ci`) **elavult** — javasolt átállás service accountra (`GOOGLE_APPLICATION_CREDENTIALS` + `--project`). Ha most nem, akkor felvéve követendő adósságként
- [ ] GitHub repository secrets/vars takarítás: a `VITE_FIREBASE_*` **repository variables** és a `VITE_STRIPE_SECRET_KEY` secret már nem kell a CI-nak (Vercelbe költöznek) — ⚠️ **csak az új Vercel deploy zöldre váltása UTÁN** törlendők
- [ ] Vercel projekt létrehozása, összekötve a GitHub repóval; **git-integrációs deploy** (❌ nem GitHub Action) — a `main` → Production, minden más ág → Preview
- [ ] Vercel env változók — **Production**: mind a 8 `NEXT_PUBLIC_FIREBASE_*`, `NEXT_PUBLIC_DEBUG_MODE=false`, `NEXT_PUBLIC_SITE_URL`
- [ ] Vercel env változók — **Preview**: ugyanaz, de `NEXT_PUBLIC_DEBUG_MODE=true`
- [ ] Vercel env változó — **`STRIPE_SECRET_KEY` (`NEXT_PUBLIC_` prefix NÉLKÜL)**, csak Production. ⭐ **Ez a migráció legfontosabb egyetlen eredménye** (1.8)
- [ ] Vercel: Node.js verzió **20** (a mai workflow-kkal egyezően)
- [ ] **Firebase Console → Authentication → Settings → Authorized domains**: a Vercel production domain **és** a stabil branch-preview domain felvéve. ⚠️ A Firebase **nem támogat wildcard domaint** — minden random preview URL-en `auth/unauthorized-domain` lesz (7.7)
- [ ] `firebase.json`: a `hosting` szekció sorsáról döntés — **javaslat:** megtartva, de a tartalma egy `redirects` blokkra cserélve, ami a Vercel domainre irányít (301, query string megőrzéssel), amíg a Stripe Payment Linkek redirect URL-je át nem áll (7.9)
- [ ] ⚠️ **Cross-plan blokkoló:** a 8 meglévő Stripe Payment Link redirect URL-je a `https://realtimespacetravel-e74e3.web.app/shop/success` címre mutat. A migráció után ezeket **újra kell generálni** a Vercel domainre — vagy a Firebase Hosting redirectnek kell megőriznie a `?session_id` query stringet. Ez a [[021-stripe-fraud-defense]] D fázisának és a [[024-stripe-go-live]]-nak közvetlen érintettsége
- [ ] `README` / `CLAUDE.md` frissítése: `npm run dev` port **3000** (nem 5173), nincs `/realtime_space_travel/` base path, nincs `build:gh-pages`
- [ ] ✅ **Ellenőrzési pont:** a `main`-re pusholva a Vercel production deploy zöld; a `/api/health` a production domainen válaszol; a `database.rules.json` módosítása kiváltja a rules-deploy workflow-t (és **semmi mást**)

**K. Debug mód — a GitHub Pages pótlása**

- [ ] Rögzítve, mit veszítünk: ma a **GitHub Pages** build volt az egyetlen `VITE_DEBUG_MODE=true` környezet (`deploy.yml:38`), a Firebase build hard-kódolva `false` (`deploy-firebase.yml:36`)
- [ ] A pótlás: **Vercel Preview deployment** `NEXT_PUBLIC_DEBUG_MODE=true`-val; **Production** `false`
- [ ] Egy **stabil** debug URL biztosítása: a `develop` ághoz tartozó Vercel branch-domain (`…-git-develop-….vercel.app`) — ez nem változik commitonként, tehát felvehető a Firebase authorized domains listájára
- [ ] ⚠️ A Vercel preview deploymentek alapból **publikusak**. Ma a GH Pages debug build is publikus volt, tehát ez nem romlás — de ha zavaró: Vercel **Deployment Protection** (Pro funkció) bekapcsolása
- [ ] Keresztellenőrzés: a debug mód **soha ne** derüljön ki `NODE_ENV`-ből — a `NEXT_PUBLIC_VERCEL_ENV` csak **auditra** használható, a kapcsoló marad explicit
- [ ] ✅ **Ellenőrzési pont:** a production domainen a DebugOverlay, a DebugEventBar és a shop `↺ Reset` gombja **nem látszik**, a kezdő kredit **0⭐**; a preview domainen mindhárom látszik és a kezdő kredit **9000⭐**

**L. Validáció**

- [ ] `npm run typecheck` (`tsc --noEmit`) hibamentes
- [ ] `npm run lint` (`next lint`) hibamentes vagy tudatosan konfigurált kivételekkel
- [ ] `npm run test` → **147/147 zöld**
- [ ] `npm run build` sikeres; a build log **nem** tartalmaz „use client" / hidratálási figyelmeztetést
- [ ] `npm run build` után a `.next/` bundle **átvizsgálva Stripe-kulcsra**: `Select-String -Path .next\static\chunks\*.js -Pattern "sk_test_|sk_live_|rk_"` → **0 találat** (ez a [[021-stripe-fraud-defense]] `check_secrets.mjs` tételének Next-változata)
- [ ] A 8. szekció **mind a 14 kézi forgatókönyve** lefuttatva a Vercel **preview** deploymenten
- [ ] A 8. szekció kritikus forgatókönyvei (1, 2, 3, 9, 12) megismételve a **production** deploymenten
- [ ] Bundle-méret összevetés a baseline-nal (A. blokk) — nagyságrendi növekedés esetén vizsgálat
- [ ] ✅ **Ellenőrzési pont:** a `develop` → `main` merge után az éles oldalon a játék **teljes körben** játszható: bejelentkezés → küldetésválasztás → kamera → arcfelismerés → küldetés → shop

**M. Takarítás és dokumentáció**

- [ ] `CLAUDE.md` frissítése: technológiai stack tábla (Vite → Next.js), projekt szerkezet (`app/` mappa), hasznos parancsok, figyelmeztetések (a `base href /realtime_space_travel/` sor **törlendő**)
- [ ] `CLAUDE.md` javítása mellékesen: a „Persist kulcsok" felsorolás ma **négy zustand store-t sugall**, valójában **kettő** perzisztált zustand store van (`space-travel-game`, `space-travel-shop`) + az i18next `space-travel-lang` + a nyers `realtime_space_travel_device_id` (1.5)
- [ ] `.claude/memory/project-conventions.md`: a `${import.meta.env.BASE_URL}spaceships/${ship.image}` konvenció átírva `/spaceships/${ship.image}`-re
- [ ] `metadata.json` (repo gyökér) sorsáról döntés — a Next `metadata` export kiváltja-e
- [ ] `.claude/lessons-learned.md` bővítése a migráció során felmerült tanulságokkal
- [ ] A `feat/nextjs-migration` ág mergelése; a régi Firebase Hosting deploy **kikapcsolva vagy redirectre állítva**

**N. Ellenőrzött nem-tételek** *(tudatosan kimaradó hatókör — lásd 9. szekció)*

- [ ] Ellenőrizve: **nulla új i18n kulcs**, a `src/i18n/locales/**` egyetlen fájlja sem módosult
- [ ] Ellenőrizve: **nincs `next/image`** használat — a natív `<img>` maradt mindenhol
- [ ] Ellenőrizve: **nincs szerver komponens** a `src/` alatt; nincs `async` React komponens; nincs `fetch`-alapú szerveroldali adatbetöltés
- [ ] Ellenőrizve: **nincs `next/navigation`** használat — a `GamePhase` állapotgép változatlan
- [ ] Ellenőrizve: **nincs `@/…` path alias** — a relatív importok változatlanok
- [ ] Ellenőrizve: **nincs Stripe Checkout Session / webhook route** ebben a tervben — csak az `app/api/health/route.ts` füstteszt
- [ ] Ellenőrizve: **nincs Firebase Admin SDK függőség** hozzáadva — a 021 F fázisa hozza be
- [ ] Ellenőrizve: a `GamePhase` állapotgép, a `useAttentionMonitor` logika, a Starfield renderelés és a shop üzleti logikája **egyetlen sorral sem** változott üzletileg (csak env/asset-útvonal szinten)

---

## 1. Architektúra

### 1.1 A jelenlegi felállás

```
index.html  (<base href="__BASE_HREF__">, <script src="mediapipe/…">)
   │
   └─ index.tsx  (setBaseHref() → "/realtime_space_travel/" vagy "/")
        └─ ErrorBoundary → ScreenCheck → App
                                          └─ ScreenRouter (GamePhase alapján)

vite.config.ts   base + @mediapipe alias + vitest config (HÁRMAS szerep)
scripts/build.mjs  tsc + vite build + __BASE_HREF__/__OG_DOMAIN__ csere
   ├─ firebase  → BASE_PATH "/"                    → Firebase Hosting
   └─ gh-pages  → BASE_PATH "/realtime_space_travel/" → GitHub Pages (DEBUG=true)
```

**Ami hiányzik:** bármilyen szerveroldali futtatókörnyezet. Nincs hova tenni a Stripe titkos kulcsot, nincs mi fogadja a webhookot, nincs mi írja a `wallet`-et szerverként.

### 1.2 A cél-felállás

```
app/
├── layout.tsx               SZERVER — <html>, metadata (OG/Twitter/icons),
│                            <Script src="/mediapipe/…" beforeInteractive />
├── globals.css              (az eddigi index.css)
├── [[...slug]]/page.tsx     SZERVER — vékony; csak <AppShell />
├── AppShell.tsx             "use client" — dynamic(() => import("../src/App"),
│                                                   { ssr: false })
└── api/
    └── health/route.ts      SZERVER — runtime: "nodejs"  ← A SZERVEROLDAL
                                                             (füstteszt)
        ▼ ide jön később
    stripe/checkout/route.ts   ← [[024-stripe-go-live]]
    stripe/webhook/route.ts    ← [[021-stripe-fraud-defense]] F fázis

src/**                       VÁLTOZATLAN szerkezet, kliensoldali
                             (csak env- és asset-útvonal átvezetés)
next.config.ts               webpack/turbopack alias + headers
vitest.config.ts             a régi vite.config.ts `test` blokkja
```

**A migráció alapelve:** a `src/` fa **szerkezetileg érintetlen marad**. A változás három típusra korlátozódik: (1) env változó nevek, (2) asset-útvonalak, (3) három pontszerű SSR-védelem (persist skipHydration, lusta MediaPipe stub, deviceId őr). Ezért nem vezetünk be path aliast és nem szórunk `"use client"` direktívákat.

### 1.3 A szerver/kliens határ — pontosan hol húzódik

| Réteg | Környezet | Miért |
|---|---|---|
| `app/layout.tsx` | **szerver** | Metadata, `<html>` váz, MediaPipe script tag. Nincs benne állapot |
| `app/[[...slug]]/page.tsx` | **szerver** | Vékony belépő. Nincs benne logika |
| `app/AppShell.tsx` | **kliens** | Itt van a `"use client"` és a `dynamic(..., { ssr: false })`. **Ez a határ** |
| `src/**` (92 fájl) | **kliens** | Öröklődik az `AppShell`-től |
| `app/api/**` | **szerver** | Node runtime; ide kerül a Stripe és később a Firebase Admin |

**Miért `ssr: false` és nem szerverkomponensesítés.** A `src/` alatt canvas + `requestAnimationFrame` + `getUserMedia` + `HTMLAudioElement` + `localStorage` + `matchMedia` van. Ezek egyike sem létezik szerveroldalon. Egy szerveroldali „első festés" legfeljebb egy üres fekete képernyőt tudna kirajzolni — pontosan azt, amit a `dynamic` `loading` állapota is ad, **hidratálási kockázat nélkül**.

### 1.4 MediaPipe — a legkockázatosabb pont

#### 1.4.1 A jelenlegi mechanizmus három lába

1. **`index.html:34`** — `<script src="mediapipe/face_detection/face_detection.js">` (a `<base href>`-hez relatívan). Ez állítja be a `window.FaceDetection` globált.
2. **`vite.config.ts:15-18`** — alias: `@mediapipe/face_detection` → `src/stubs/mediapipe-stub.ts`. A stub a globálhoz hidalja az npm importot, amit a `@tensorflow-models/face-detection` végez. A config kommentje kiemeli: **„It is the PRODUCTION mechanism (not test-only)".**
3. **`src/services/faceRecognition.ts:115`** — `solutionPath = new URL("mediapipe/face_detection", document.baseURI).href`, hogy a MediaPipe futásidőben megtalálja a `.wasm` / `.binarypb` / `.tflite` fájlokat.

Next.js-ben **nincs `index.html`**, és **nincs `<base href>`** — mindhárom láb átalakul.

#### 1.4.2 A lusta stub — ez a blokk kulcsa

A mai stub **modulkiértékeléskor** olvas:

```ts
// src/stubs/mediapipe-stub.ts — MAI ÁLLAPOT
export const FaceDetection = (window as any).FaceDetection;
export default FaceDetection;
```

Ez Next-ben **két külön okból** bukik:

| Ok | Tünet |
|---|---|
| A modul szerveroldalon értékelődik ki (prerender, vagy egy jövőbeli API route importlánca) | `ReferenceError: window is not defined` — **build/prerender hiba** |
| A modul a script tag lefutása **előtt** értékelődik ki (pl. `afterInteractive` stratégia mellett) | `FaceDetection === undefined` **véglegesen** — a modul-szintű const soha nem frissül újra |

A megoldás egy **lusta feloldás**, ami a globált a **tényleges használat** pillanatában olvassa:

```ts
// src/stubs/mediapipe-stub.ts — CÉLÁLLAPOT
type FaceDetectionCtor = new (config: unknown) => unknown;

const resolve = (): FaceDetectionCtor => {
  if (typeof window === "undefined") {
    throw new Error("MediaPipe FaceDetection is browser-only");
  }
  const ctor = (window as unknown as { FaceDetection?: FaceDetectionCtor })
    .FaceDetection;
  if (!ctor) {
    throw new Error(
      "window.FaceDetection missing — the /mediapipe/face_detection/face_detection.js script has not loaded",
    );
  }
  return ctor;
};

// A @tensorflow-models/face-detection csak a detektor létrehozásakor hívja
// meg `new FaceDetection(...)`-t, tehát a globál AKKOR olvasódik ki, nem
// a modul betöltésekor.
export const FaceDetection = new Proxy(
  function () {} as unknown as FaceDetectionCtor,
  {
    construct: (_t, args) => Reflect.construct(resolve() as never, args as never),
    get: (_t, prop) => (resolve() as never)[prop as never],
  },
);
export default FaceDetection;
```

⚠️ **A `Proxy` puszta importra nem dobhat** — csak `construct`/`get` esetén. Ezt az I. blokk tesztje ellenőrzi, mert a `faceRecognition.test.ts` importlánca érinti a stubot.

#### 1.4.3 Az útvonalak

| Mai | Új |
|---|---|
| `<script src="mediapipe/face_detection/face_detection.js">` az `index.html`-ben | `<Script src="/mediapipe/face_detection/face_detection.js" strategy="beforeInteractive" />` az `app/layout.tsx`-ben |
| `new URL("mediapipe/face_detection", document.baseURI).href` | `"/mediapipe/face_detection"` (abszolút, gyökér-relatív) |
| `vite.config.ts` alias | `next.config.ts` `webpack.resolve.alias` **+** `turbopack.resolveAlias` |
| `firebase.json` `**/*.wasm` COEP/COOP headerek | `next.config.ts` `headers()` a `/mediapipe/:path*`-ra |

### 1.5 Perzisztencia és hidratálás — a valós helyzet

> 📌 **Pontosítás.** A CLAUDE.md négy perzisztált store-t sugall (`space-travel-game`, `space-travel-ui`, `space-travel-shop`, `space-travel-lang`). A kódban a **`useUIStore` nincs `persist`-be csomagolva** (nincs `space-travel-ui` kulcs sehol a `src/`-ben). A tényleges localStorage-érintkezés:

| # | Érintkezési pont | Mechanizmus | SSR-kockázat | Kezelés |
|---|---|---|---|---|
| 1 | `space-travel-game` | `useGameStore` + zustand `persist` | Hidratálási eltérés a `gamePhase`-en (szerver `intro`, kliens `playing`) | `ssr: false` + `skipHydration` + `rehydrate()` |
| 2 | `space-travel-shop` | `useShopStore` + zustand `persist` | Hidratálási eltérés a krediten és a birtokolt tételeken | `ssr: false` + `skipHydration` + `rehydrate()` |
| 3 | `space-travel-lang` | `i18next-browser-languagedetector` cache | A szerver `en`-t, a kliens `hu`-t választaná → **minden szöveg** eltér | Kliensoldali init (G. blokk) |
| 4 | `realtime_space_travel_device_id` | nyers `localStorage` a `deviceId.ts`-ben, **modul-kiértékeléskor** hívva (`useAuthStore.ts:61`) | `ReferenceError` szerveroldalon | `ssr: false` + `typeof window` őr |

Az `useUIStore` (hangerő, nehézség, kamera-hozzájárulás) ma **memóriában él** és F5-re elveszik — ez **meglévő viselkedés**, a migráció nem változtat rajta, és **nem is ennek a tervnek a dolga** megjavítani.

### 1.6 i18n — miért kliensoldali init

| Szempont | Kliensoldali init (**választott**) | Next-natív i18n (`[lang]` szegmens) |
|---|---|---|
| URL-szerkezet | változatlan (`/`) | `/hu/`, `/en/` … — **minden mély link átíródik** |
| Stripe redirect URL | változatlan | újragenerálandó, nyelvenként vagy nyelvsemlegesen |
| Hidratálási eltérés | nincs (a fa `ssr: false`) | kezelendő |
| Nyelvdetektálás | `navigator.language` + localStorage, ahogy ma | `Accept-Language` fejléc szerveren |
| SEO haszon | nincs | lenne, de **irreleváns**: a játék tartalma bejelentkezés és webkamera mögött van |
| Kód-változás | ~2 sor őr | teljes routing-refaktor |

**Döntés:** kliensoldali init. Az egyetlen ok, ami a Next-natív utat indokolná, a nyelvenkénti SEO — ez egy webkamerás AFK-játéknál nem szempont. A [[024-stripe-go-live]] jogi oldalai (`/legal/*`) esetleg indexelhetőek lennének, de azok is elérhetők maradnak egyetlen nyelvsemleges URL-en.

### 1.7 Routing — catch-all, nem `next/navigation`

A játék belső navigációja a `GamePhase` állapotgép (`intro → mainMenu → missionSelect → …`), **nem az URL**. Ez a migráció után is így marad. Az URL-nek mindössze **két** szerepe van:

1. `/shop/success` — a Stripe Payment Link visszatérése ([[005-ingame-shop-strapi-stripe]]).
2. `/legal/*` — a [[024-stripe-go-live]] C fázisának tervezett mély linkjei.

A mai `firebase.json` ezt egy `"**" → /index.html` rewrite-tal oldja meg. A Next-megfelelője az **opcionális catch-all** `app/[[...slug]]/page.tsx`, ami minden útvonalra ugyanazt a klienst tölti be — az `app/api/**` route handlerek **elsőbbséget élveznek**, tehát az API nem esik a catch-all alá.

### 1.8 ⭐ Amit a migráció MEGOLD — ez a terv értelme

#### (a) A Stripe titkos kulcs végre legitim helyre kerül

| Ma (Vite SPA) | A migráció után (Next.js + Vercel) |
|---|---|
| `VITE_STRIPE_SECRET_KEY` a `.env`-ben és **mindkét deploy workflow `env:` blokkjában** | `STRIPE_SECRET_KEY` **Vercel env változó**, `NEXT_PUBLIC_` prefix nélkül |
| A `VITE_` prefix **szándéknyilatkozat**: „ez a böngészőbe való" — egyetlen `import.meta.env.VITE_STRIPE_SECRET_KEY` sor **némán** kiszivárogtatná ([[021-stripe-fraud-defense]] 3.0) | A prefix nélküli változó a kliens bundle-be **fizikailag képtelen** bekerülni: a Next build-idejű behelyettesítése kizárólag `NEXT_PUBLIC_`-ra vonatkozik |
| A kulcsnak **nincs legitim szerepe** egy kizárólag kliensoldali buildben (a 021 3.0 „tágabb következtetése") | A kulcsnak **van** hova mennie: az API route futásidejű környezete |

Ez **feloldja** a [[021-stripe-fraud-defense]] 3.0 és a [[024-stripe-go-live]] A fázisa közti rögzített ellentmondást (megtartani átnevezve **vagy** eltávolítani): a helyes válasz **egyikük sem** volt, hanem **átköltöztetni szerveroldalra** — ami eddig nem létezett. A migráció után:

- a `.env` / GitHub secret / workflow `env:` blokk **egyike sem** tartalmaz Stripe kulcsot,
- a kulcs egyetlen példánya a Vercel env store-ban él,
- a `scripts/create_payment_links.mjs` továbbra is lokálisan, egyszeri `$env:`-vel futtatható.

#### (b) Checkout Session + webhook a Payment Link helyett

| Payment Link (ma) | Checkout Session + webhook (a migráció után lehetséges) |
|---|---|
| Nincs szerveroldali visszaigazolás | `checkout.session.completed` webhook, `Stripe-Signature` ellenőrzéssel |
| A jóváírás **kizárólag** a localStorage tartalmán alapul (021 „kritikus rés") | A jóváírás a Stripe **aláírt** eseményéből származik |
| A refund után a kredit **nem vonódik vissza** ([[024-stripe-go-live]] 14. szekció) | `charge.refunded` esemény kezelhető |
| A `session_id` valódisága kliensről **nem ellenőrizhető** (021 11. tábla) | `stripe.checkout.sessions.retrieve(id)` szerveroldalon |

⚠️ **Webhook-implementációs jegyzet a 021 F fázisának:** az App Router route handlerben az aláírás-ellenőrzéshez a **nyers body** kell — `await req.text()`, **soha nem** `await req.json()`. A route-nak `export const runtime = "nodejs"` kell (az Edge runtime nem viszi a `stripe` SDK-t és a `firebase-admin`-t).

#### (c) Firebase Admin SDK → RTDB „Phase-2" szabályok

A [[003-firebase-auth-settings]] 6. pontja és a [[021-stripe-fraud-defense]] 6.2 architektúrája ugyanazt a hiányzó darabot írja le: egy **szerveroldali író**, ami a `users/{key}/wallet`-et frissíti, hogy a kliens írási joga megvonható legyen:

```jsonc
"wallet": { ".write": false }   // Phase-2 — csak a szerver írhat
```

A `firebase-admin` egy Next API route-ban (Node runtime, service account a Vercel env-ben) ezt **közvetlenül** megteszi — Cloud Functions és Blaze terv **nélkül**. Ez a 021 csalásvédelmének **legfontosabb hiányzó építőköve**: az „ingyen kredit" rés (021 5. szekció) így nem csak **szűkül**, hanem **megszűnik**.

> A 021 6.3 táblája Cloudflare Workerst ajánlott külső futtatónak, mert a Firebase Spark nem enged Cloud Functionst. Ez a migráció **jobb megoldást ad ugyanarra**: nem egy külön üzemeltetendő komponens, hanem ugyanaz a deploy, ugyanaz a repó, ugyanaz a TypeScript kódbázis. A 021 F fázisának Worker-specifikus tételei ennek megfelelően **egyszerűsödnek**.

---

## 2. Fájlstruktúra

### 2.1 Új fájlok

| Fájl | Szerep |
|---|---|
| `app/layout.tsx` | Root layout (szerver): `<html>`, `metadata`, MediaPipe `<Script beforeInteractive>` |
| `app/globals.css` | Az eddigi gyökér `index.css` |
| `app/[[...slug]]/page.tsx` | Catch-all belépő (szerver), csak `<AppShell />` |
| `app/AppShell.tsx` | `"use client"` határ + `dynamic(..., { ssr: false })` + ErrorBoundary/ScreenCheck |
| `app/api/health/route.ts` | Szerveroldal-füstteszt, `runtime: "nodejs"` |
| `next.config.ts` | webpack + turbopack alias, `headers()`, `metadataBase`-hez tartozó beállítások |
| `vitest.config.ts` | A `vite.config.ts` `test` blokkja + a MediaPipe alias |
| `next-env.d.ts` | Generált (commitolandó) |
| `.github/workflows/deploy-database-rules.yml` | Lecsupaszított RTDB rules deploy |

### 2.2 Törlendő fájlok

| Fájl | Miért |
|---|---|
| `index.html` | Nincs App Routerben; a `<base href>` és a script tag átköltözik |
| `index.tsx` | A `setBaseHref()` tárgytalan; a render-fa az `AppShell`-be költözik |
| `vite.config.ts` | A `base` és az alias átkerül; a `test` blokk `vitest.config.ts`-be |
| `scripts/build.mjs` | A `__BASE_HREF__` / `__OG_DOMAIN__` csere feleslegessé válik |
| `src/css.d.ts` | A `next-env.d.ts` már deklarálja → `Duplicate identifier 'default'` |
| `.github/workflows/deploy.yml` | A GitHub Pages deployment megszűnik |
| `index.css` (gyökér) | Áthelyezve `app/globals.css`-be |

### 2.3 Módosuló fájlok

| Fájl | Változás | Blokk |
|---|---|---|
| `package.json` | Next + React 19 függőségek, scriptek átírása, `build:gh-pages` törlése | B |
| `tsconfig.json` | `jsx: preserve`, `moduleResolution: bundler`, Next plugin, `include` | B |
| `.env.example` | `VITE_*` → `NEXT_PUBLIC_*`; `VITE_STRIPE_SECRET_KEY` → `STRIPE_SECRET_KEY` | C |
| `src/firebase/config.ts` | 8 env hivatkozás | C |
| `src/firebase/userData.ts` · `src/state/useUIStore.ts` · `src/state/useShopStore.ts` · `src/hooks/useEventSystem.ts` · `src/components/shop/ShopScreen.tsx` · `src/components/screens/IntroScreen.tsx` · `src/components/screens/MainMenu.tsx` | `VITE_DEBUG_MODE` → `NEXT_PUBLIC_DEBUG_MODE` | C |
| `src/constants/shopCatalog.ts` | `import.meta.env.DEV` → `process.env.NODE_ENV !== "production"` | C |
| `src/App.tsx` · `src/components/ui/Starfield.tsx` · `src/hooks/useAudio.ts` · `src/components/shop/{ShipPreviewModal,ProductCard,MusicPreviewButton}.tsx` · `src/components/screens/{MainMenu,ShipInfoModal,ShipSelectScreen}.tsx` | `BASE_URL` → gyökér-relatív útvonal | D |
| `src/services/faceRecognition.ts` | `document.baseURI` → `"/mediapipe/face_detection"` | D |
| `src/stubs/mediapipe-stub.ts` | Eager → **lusta** `Proxy` | E |
| `src/state/useGameStore.ts` · `src/state/useShopStore.ts` | `skipHydration: true` | F |
| `src/firebase/deviceId.ts` | `typeof window` őr | F |
| `src/i18n/index.ts` | `typeof window` őr a LanguageDetectoron | G |
| `firebase.json` | `hosting` szekció → redirect vagy törlés; a `database` marad | J |
| `CLAUDE.md` · `.claude/memory/project-conventions.md` | Stack, szerkezet, parancsok, konvenciók | M |

---

## 3. Tételes átvezetési táblák

> A [[017-starfield-realism]] 3.2 táblája (16 tétel `canvas.width` → `logicalWidth`) bevált mintát adott: a tételes leltár nélkül **garantáltan** marad ki előfordulás, és a hiba **néma**. Ugyanez itt kétszeres tétel, mert az env-hibák nagy része `undefined`-ként csendben tovább fut.

### 3.1 Env változó leltár — 27 előfordulás, 17 fájl

| # | Fájl | Sor | Mai | Új |
|---|---|---|---|---|
| 1 | `src/firebase/config.ts` | 6 | `import.meta.env.VITE_FIREBASE_API_KEY` | `process.env.NEXT_PUBLIC_FIREBASE_API_KEY` |
| 2 | `src/firebase/config.ts` | 7 | `…VITE_FIREBASE_AUTH_DOMAIN` | `…NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` |
| 3 | `src/firebase/config.ts` | 8 | `…VITE_FIREBASE_DATABASE_URL` | `…NEXT_PUBLIC_FIREBASE_DATABASE_URL` |
| 4 | `src/firebase/config.ts` | 9 | `…VITE_FIREBASE_PROJECT_ID` | `…NEXT_PUBLIC_FIREBASE_PROJECT_ID` |
| 5 | `src/firebase/config.ts` | 23 | `…VITE_FIREBASE_STORAGE_BUCKET` | `…NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` |
| 6 | `src/firebase/config.ts` | 24 | `…VITE_FIREBASE_MESSAGING_SENDER_ID` | `…NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` |
| 7 | `src/firebase/config.ts` | 25 | `…VITE_FIREBASE_APP_ID` | `…NEXT_PUBLIC_FIREBASE_APP_ID` |
| 8 | `src/firebase/config.ts` | 26 | `…VITE_FIREBASE_MEASUREMENT_ID` | `…NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` |
| 9 | `src/firebase/userData.ts` | 11 | `…VITE_DEBUG_MODE` | `…NEXT_PUBLIC_DEBUG_MODE` |
| 10 | `src/state/useUIStore.ts` | 76 | `…VITE_DEBUG_MODE` | `…NEXT_PUBLIC_DEBUG_MODE` |
| 11 | `src/state/useShopStore.ts` | 255 | `…VITE_DEBUG_MODE` | `…NEXT_PUBLIC_DEBUG_MODE` |
| 12 | `src/hooks/useEventSystem.ts` | 26 | `…VITE_DEBUG_MODE` | `…NEXT_PUBLIC_DEBUG_MODE` |
| 13 | `src/components/shop/ShopScreen.tsx` | 142 | `…VITE_DEBUG_MODE` | `…NEXT_PUBLIC_DEBUG_MODE` |
| 14 | `src/components/screens/IntroScreen.tsx` | 9 | `…VITE_DEBUG_MODE` | `…NEXT_PUBLIC_DEBUG_MODE` |
| 15 | `src/components/screens/MainMenu.tsx` | 13 | `…VITE_DEBUG_MODE` | `…NEXT_PUBLIC_DEBUG_MODE` |
| 16 | `src/constants/shopCatalog.ts` | 54 | `import.meta.env.DEV` | `process.env.NODE_ENV !== "production"` |
| 17 | `src/App.tsx` | 777 | `${import.meta.env.BASE_URL}spaceships/…` | `/spaceships/…` |
| 18 | `src/components/ui/Starfield.tsx` | 120 | `${…BASE_URL}spaceships/russian1.webp` | `/spaceships/russian1.webp` |
| 19 | `src/hooks/useAudio.ts` | 9 | `${…BASE_URL}music/main_theme.mp3` | `/music/main_theme.mp3` |
| 20 | `src/hooks/useAudio.ts` | 11 | `${…BASE_URL}music/main_theme.mp3` | `/music/main_theme.mp3` |
| 21 | `src/hooks/useAudio.ts` | 12 | `${…BASE_URL}music/${product.file}` | `/music/${product.file}` |
| 22 | `src/components/shop/ShipPreviewModal.tsx` | 90 | `${…BASE_URL}spaceships/…` | `/spaceships/…` |
| 23 | `src/components/shop/ProductCard.tsx` | 44 | `${…BASE_URL}spaceships/…` | `/spaceships/…` |
| 24 | `src/components/shop/MusicPreviewButton.tsx` | 150 | `${…BASE_URL}music/${file}` | `/music/${file}` |
| 25 | `src/components/screens/MainMenu.tsx` | 146 | `${…BASE_URL}title.webp` | `/title.webp` |
| 26 | `src/components/screens/ShipInfoModal.tsx` | 36 | `${…BASE_URL}spaceships/…` | `/spaceships/…` |
| 27 | `src/components/screens/ShipSelectScreen.tsx` | 28 | `${…BASE_URL}spaceships/…` | `/spaceships/…` |

**Összesítés:** 8 db `VITE_FIREBASE_*` · 7 db `VITE_DEBUG_MODE` · 1 db `import.meta.env.DEV` · **11 db `BASE_URL`**.

> ⚠️ A sorszámok a `develop` ág `0c1cc4d` commitjához tartoznak. Ha a [[017-starfield-realism]] utáni további commitok elmozdítják őket, a **grep az irányadó**, nem a sorszám. Zárókontroll: `import.meta` → **nulla** találat a `src/`-ben.

### 3.2 Base path / asset-útvonal leltár — a `src/`-en kívül

| # | Hely | Mai | Teendő |
|---|---|---|---|
| 1 | `index.html` | 5 | `<base href="__BASE_HREF__" />` | fájl **törlendő** |
| 2 | `index.html` | 34 | `<script src="mediapipe/face_detection/face_detection.js">` | → `next/script` a layoutban |
| 3 | `index.html` | 21, 24, 33 | `__OG_DOMAIN__` | → Next `metadata` + `metadataBase` |
| 4 | `index.tsx` | 1-13 | `setBaseHref()` futásidejű base váltás | fájl **törlendő** |
| 5 | `vite.config.ts` | 7 | `base: … \|\| "/realtime_space_travel/"` | fájl **törlendő** |
| 6 | `scripts/build.mjs` | 14-23 | `configs.firebase` / `configs["gh-pages"]` BASE_PATH | fájl **törlendő** |
| 7 | `src/services/faceRecognition.ts` | 115 | `new URL("mediapipe/face_detection", document.baseURI).href` | `"/mediapipe/face_detection"` |
| 8 | `firebase.json` | 12-17 | `rewrites: "**" → /index.html` | → catch-all route (Next); a `firebase.json`-ban a `hosting` szekció átalakul |
| 9 | `firebase.json` | 28-40 | `.wasm` COEP/COOP headerek | → `next.config.ts` `headers()` |

### 3.3 „Mi történik, ha egy tétel kimarad" — tünet-tábla

| Kimaradó tétel | Tünet | Zajszint |
|---|---|---|
| `VITE_FIREBASE_API_KEY` / `AUTH_DOMAIN` / `DATABASE_URL` / `PROJECT_ID` | A `config.ts:11` guard elkapja → az app **hangosan** panaszkodik, az auth nem indul | 🔊 **hangos** — azonnal látszik |
| `STORAGE_BUCKET` / `MESSAGING_SENDER_ID` / `APP_ID` / `MEASUREMENT_ID` | Nincs guard → `undefined` kerül a configba. Az Auth és az RTDB **működik**, csak az analytics/messaging hal el | 🔇 **néma** — hetekig észrevétlen |
| Bármelyik `VITE_DEBUG_MODE` | `undefined === "true"` → `false`. A **preview** buildben eltűnik a DebugOverlay / DebugEventBar / shop reset, a kezdő kredit 9000 helyett 0 | 🔇 **néma** |
| `import.meta.env.DEV` (shopCatalog) | Az `import.meta` a Next webpack-buildjében nem kap `env` mezőt → **futásidejű TypeError** a modul betöltésekor → **fehér képernyő** | 🔊 hangos, de **csak a shop megnyitásakor** |
| Bármelyik `BASE_URL` | `undefined` a stringben → `undefinedspaceships/x.webp` → **404**. Kép nem jelenik meg; a `useAudio`-nál **néma háttérzene** | 🔇 félig néma — a zene hiánya nem dob hibát |
| MediaPipe script tag | `window.FaceDetection` nincs → a stub dob → `createFaceDetector` elszáll | 🔊 **a játék indíthatatlan** |
| Lusta stub (marad az eager) | Szerveroldalon `window is not defined`; kliensen véglegesen `undefined` | 🔊 build hiba vagy indíthatatlan játék |
| `skipHydration` / `ssr: false` | „Hydration failed" konzol-figyelmeztetés; a perzisztált `gamePhase` elveszhet → a játékos az `intro`-ban ébred egy futó küldetés helyett | 🔇 könnyen félreérthető |
| i18next szerveroldali init | A szerver `en`, a kliens `hu` → **minden szöveg** eltér hidratáláskor | 🔊 hangos, de zavarba ejtő |
| Firebase authorized domain | `auth/unauthorized-domain` → **Google bejelentkezés nem működik** a Vercel domainen | 🔊 hangos |
| Payment Link redirect URL | A Stripe a **régi** Firebase Hosting URL-re tér vissza → a kredit a régi oldalon íródik jóvá, vagy sehol | 🔇 néma, és **valós pénzt érint** |
| `src/css.d.ts` meghagyása | `tsc`: `Duplicate identifier 'default'` | 🔊 hangos |

### 3.4 Jegyzet: `NODE_ENV` és a Stripe dev/prod link-választás

A `shopCatalog.ts:54` ma `import.meta.env.DEV` alapján választ dev vagy prod Payment Linket. A Next-megfelelő `process.env.NODE_ENV !== "production"`:

| Környezet | Mai (`import.meta.env.DEV`) | Új (`NODE_ENV !== "production"`) | Link |
|---|---|---|---|
| `npm run dev` | `true` | `true` | dev (localhost redirect) |
| GH Pages debug build | `false` | — (megszűnik) | prod |
| Vercel **preview** build | — | `false` | **prod** |
| Vercel **production** build | — | `false` | prod |

**Viselkedési paritás megvan** (a GH Pages debug build is a prod linket használta). ⚠️ De a [[024-stripe-go-live]] élesítése után a preview deployment **valós pénzes** Payment Linkre mutatna. A 024-nek ezt kezelnie kell: javasolt egy explicit `NEXT_PUBLIC_STRIPE_MODE` (`test` | `live`) env változó, környezetenként állítva — **ez nem ennek a tervnek a feladata**, de itt kerül rögzítésre.

---

## 4. Megvalósítási lépések és commit-stratégia

| # | Blokk | Commit | Visszaállíthatóság |
|---|---|---|---|
| 1 | A | *(nincs kód)* | — |
| 2 | B | `chore: next.js scaffold alongside vite` | Teljes: a Vite build még működik |
| 3 | C | `refactor: import.meta.env → process.env.NEXT_PUBLIC_*` | ⚠️ Ez a commit **elrontja a Vite buildet** — innentől egyirányú |
| 4 | D | `refactor: drop BASE_URL, absolute asset paths` | Egyirányú |
| 5 | **E** | `feat: mediapipe via next/script + lazy stub` | ⚠️ **Külön commit, külön ellenőrzés.** Ha itt bukik, az egész migráció megáll |
| 6 | F | `fix: zustand persist hydration under next` | — |
| 7 | G | `fix: client-only i18next init` | — |
| 8 | H | `feat: catch-all route + client boundary` | — |
| 9 | I | `test: vitest config split from vite config` | **Kapu: 147/147 zöld** |
| 10 | J | `ci: vercel deploy, drop gh-pages, rules-only workflow` | — |
| 11 | K | `ci: debug mode via vercel preview env` | — |
| 12 | L, M | `docs: update CLAUDE.md for next.js` | — |

**Sorrend-indoklás:** a B. blokk után a Vite és a Next **egymás mellett** él (a `src/` még érintetlen) — itt még kockázatmentes a visszaállás. A C. blokktól kezdve egyirányú az út, ezért fontos, hogy a legkockázatosabb blokk (E, MediaPipe) **korán**, még a finomhangolás előtt kiderüljön. Az I. blokk (147 zöld teszt) a **kapu**: enélkül nem megyünk tovább a deploy felé.

---

## 5. Függőségek

### 5.1 Terv-függőségek

| Terv | Viszony |
|---|---|
| [[005-ingame-shop-strapi-stripe]] | **Előfeltétel.** Az itt megépített Payment Link út és a `/shop/success` redirect a migráció routing-követelménye. A redirect URL a migráció után **újragenerálandó** |
| [[003-firebase-auth-settings]] | **Előfeltétel.** A Firebase Auth + RTDB séma, ami a migráció után **változatlanul** marad. Az itt felvázolt „Phase-2" szerveroldali szabályokat a migráció **teszi lehetővé** |
| [[007-state-persist-page-refresh]] | **Előfeltétel.** A `space-travel-game` persist viselkedése a hidratálási munka **referenciája**: a migráció után az F5-viselkedésnek bitre azonosnak kell lennie |
| [[021-stripe-fraud-defense]] | **Ráépülő.** Az F fázisa (webhook backend) ezután Vercel API route-tal, nem Cloudflare Workerrel valósul meg. Az A fázis kulcs-átnevezés tételét a migráció C. blokkja **elvégzi** |
| [[024-stripe-go-live]] | **Ráépülő.** Az A fázis 021-tal való ütközését a migráció **feloldja**; a C fázis `/legal/*` mély linkjei a catch-all route alatt működnek |
| [[017-starfield-realism]] | **Kódütközés.** A `Starfield.tsx:120` `BASE_URL` sora a 017 által frissen írt régióban van — a D. blokk diffje itt ütközhet, ha a 017 nincs mergelve |

### 5.2 Technikai függőségek

| Függőség | Verzió | Megjegyzés |
|---|---|---|
| `next` | **^16** (ellenőrizve: 16.2.12, 2026-07-31) | App Router. ⚠️ Peer range: `react: ^18.2.0 \|\| ^19.0.0` — tehát a React 19 **nem kényszer**, hanem választás |
| `react` / `react-dom` | 18 → **19** (legfrissebb: 19.2.8) | **Választott** frissítés, nem a Next követelménye — lásd 7.2 és 12.2 |
| `zustand` | ^4.5 (marad) | A `persist` `skipHydration` opciója 4.x-ben elérhető |
| `i18next` / `react-i18next` | marad | A `react-i18next` 17 támogatja a React 19-et |
| `@tensorflow/tfjs` · `@tensorflow-models/face-detection` | marad | Kliens-only, `ssr: false` mögött |
| `firebase` | ^12 (marad) | A kliens SDK; a `firebase-admin` **később**, a 021 F fázisában |
| `vitest` · `vite` · `@vitejs/plugin-react` | marad devDependencyként | A Vitest belül Vite-ot használ |
| `stripe` | marad | Ma csak a `scripts/create_payment_links.mjs` használja |

### 5.3 Külső / fiók-szintű függőségek

- **Vercel fiók + projekt** a GitHub repóhoz kötve.
- ⚠️ **Vercel csomag:** a Hobby ToS **tiltja a kereskedelmi használatot** — valós pénzes fizetést kiszolgáló deploymenthez **Pro csomag** kell. ✅ **Eldőlt (2026-07-30): Hobby-n maradunk, valós pénzes fizetés nélkül** — lásd 12.1. A migráció és a teszt módú Stripe ezzel nem ütközik; a [[021-stripe-fraud-defense]] 6.3 táblájának Vercel-kizárása **kizárólag a valós pénzes endpointra** marad érvényben, azaz a [[024-stripe-go-live]] külön Pro-döntést igényel
- **Firebase Console** hozzáférés az authorized domains bővítéséhez.
- **Stripe Dashboard** hozzáférés a Payment Link redirect URL-ek újragenerálásához.

---

## 6. i18n

**Nulla új kulcs.** A migráció nem hoz új felhasználói szöveget, nem hoz új képernyőt és nem távolít el kulcsot. A `src/i18n/locales/{en,hu,fr,de,es}/translation.json` fájlok **egyike sem módosul**, a kulcsparitás mind az 5 nyelven **változatlan**.

> A `dev` skill **ne indítsa** az `i18n` agentet ehhez a tervhez.

**Ami mégis változik — az inicializálás:**

| Elem | Ma | A migráció után |
|---|---|---|
| Belépési pont | `index.tsx:20` — `import "./src/i18n"` side-effect | `app/AppShell.tsx` (vagy a meglévő `src/App.tsx:31` import) |
| Init időzítése | Modul-kiértékeléskor, a React mount **előtt** | Ugyanaz, de a **kliens** bundle-ben, az `ssr: false` határ mögött |
| `LanguageDetector` | Feltétel nélkül `.use()`-olva | `typeof window !== "undefined"` őrrel (defence-in-depth) |
| `space-travel-lang` localStorage kulcs | változatlan | **változatlan** — a játékosok nyelvválasztása megmarad |
| `<html lang>` | `index.html`-ben `hu`, futásidőben felülírva | `app/layout.tsx`-ben `en` + `suppressHydrationWarning`, futásidőben felülírva |
| `document.documentElement.lang` szinkron | `applyDocumentLang` + `languageChanged` listener | **változatlan** (már ma is `typeof document` őrrel) |

**Ellenőrzés (N. blokk):** a `git diff --stat src/i18n/` a migráció után legfeljebb az `index.ts` őr-sorait mutathatja; a `locales/` alatt **nulla** módosított fájl.

---

## 7. Kockázatok / figyelmeztetések

### 7.1 ⚠️ A MediaPipe a játék létfeltétele — ez a blokk nem bukhat el

A webkamerás arcfelismerés nélkül nincs játék: a `useAttentionMonitor` a teljes játékmenet motorja. A kockázatot háromszorosan csökkentjük: (a) a lusta stub kifejezetten **hangos** hibaüzenetet ad, ha a globál hiányzik, (b) az E. blokk **négy** külön ellenőrzési pontot ír elő (dev, prod build, HTTPS preview, valódi kamera), (c) a blokk **külön commit**, tehát izoláltan visszavonható.

**Tartalék megoldás, ha a `beforeInteractive` nem megbízható:** a script tag helyett egy promise-alapú, egyszeri betöltő a `createFaceDetector()`-ban:

```ts
let loader: Promise<void> | null = null;
const ensureMediaPipeScript = () =>
  (loader ??= new Promise<void>((resolve, reject) => {
    if ((window as any).FaceDetection) return resolve();
    const s = document.createElement("script");
    s.src = "/mediapipe/face_detection/face_detection.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("MediaPipe script failed to load"));
    document.head.appendChild(s);
  }));
```

Ez **robusztusabb** (nem függ a Next script-stratégiájától), de a betöltést a detektor létrehozásáig halasztja. Ha az E. blokk 1. ellenőrzési pontja megbízhatatlannak bizonyul, **erre kell váltani** — a lusta stub mindkét megoldással működik.

### 7.2 ⚠️ React 18 → 19 — rejtett költség a migrációban

⚠️ **Javítva 2026-07-31:** a terv első változata azt állította, hogy a Next App Router **megköveteli** a React 19-et. A `next@16.2.12` peer range-e (`react: ^18.2.0 || ^19.0.0`) szerint ez **nem igaz** — a React 18 is elfogadott. A React 19 tehát **tudatos választás** (12.2), nem a keretrendszer kényszere. Ez a különbség számít: a visszalépés nem igényel Next-major visszalépést is.

A mérés szerint a kódbázis **jól áll**:

| React 19 töréspont | Érintettség itt |
|---|---|
| `useRef()` argumentum nélkül TS-hibát ad | ✅ **Nulla** találat (`useRef()` sehol) |
| `ReactDOM.render` eltávolítva | ✅ Már `createRoot`-ot használ (`index.tsx:28`) |
| `propTypes` / `defaultProps` függvénykomponensen | ✅ Nincs használatban |
| Ref-as-prop (a `forwardRef` opcionálissá válik) | ✅ Visszafelé kompatibilis |
| StrictMode dupla-effekt szigorúbb | ⚠️ **Figyelendő** — a `useCamera`, `useFaceDetection`, `useAudio` és a `Starfield` rAF-hurka mind cleanup-érzékeny |
| `@testing-library/react` React 19 kompatibilitás | ⚠️ A 16.3.2 támogatja, de a 147 teszt a bizonyíték |

**Ha a React 19 váratlanul sok problémát okoz:** a visszavonulási út **React 18 a Next 16 alatt** — a peer range ezt megengedi, tehát a Next major verziót **nem** kell visszaléptetni. Ez lényegesen olcsóbb visszaút, mint amit a terv első változata feltételezett (Next 14-re esés). A 12.2 szerint ez **nem** az alapterv, hanem kizárólag tartalék — a döntés a **Next 16 + React 19**.

### 7.3 ⚠️ Az eager `window` olvasás a stubban — a legalattomosabb hiba

Részletesen: 1.4.2. Röviden: a mai `export const FaceDetection = (window as any).FaceDetection;` egy modul-szintű pillanatfelvétel. Ha a script tag később fut le, a konstans **soha nem javul ki** — a hiba nem a betöltéskor, hanem a kamera bekapcsolásakor jelentkezik, ami félrevezetően a kamera-jogosultságra tereli a diagnózist.

### 7.4 ⚠️ A `process.env` behelyettesítés csak szó szerinti alakot ismer

A Next build-időben **szövegszerűen** cseréli a `process.env.NEXT_PUBLIC_X` előfordulásokat. Az alábbiak **nem** működnek a kliensben:

```ts
const { NEXT_PUBLIC_DEBUG_MODE } = process.env;   // ❌ undefined
const key = "NEXT_PUBLIC_DEBUG_MODE";
process.env[key];                                  // ❌ undefined
console.log(process.env);                          // ❌ üres/részleges objektum
```

Ez egyben **előny**: pontosan ez teszi lehetetlenné, hogy a `STRIPE_SECRET_KEY` véletlenül kiszivárogjon (a Vite-nál ez a [[021-stripe-fraud-defense]] 3.1 táblájában dokumentált footgun volt).

### 7.5 ⚠️ Dokumentum-szintű COEP elrontaná a Google bejelentkezést

A `firebase.json` ma COEP/COOP headereket ad a `**/*.wasm` **assetre**. Ez **nem** hoz létre cross-origin izolációt (ahhoz a headereknek a **dokumentumon** kellene lenniük), tehát a MediaPipe ma a nem-izolált úton fut, és **működik**.

Ha a migráció során bárki „rendbe teszi" ezt azzal, hogy a headereket a `/:path*`-ra teszi, akkor:

- a `signInWithPopup` (`src/firebase/auth.ts:38`) és a `linkWithPopup` (`:37`) ablak-kommunikációja megszakad (`COOP: same-origin`),
- a `crossorigin` attribútum nélküli külső képek és iframe-ek blokkolódnak (`COEP: require-corp`),
- a Google bejelentkezés a redirect-fallbackre esik (`:56`) — vagy egyszerűen elhal.

**Szabály:** a COEP/COOP header **kizárólag** a `/mediapipe/:path*` útvonalra kerül, sehova máshova.

### 7.6 Vercel deployment-méret és a MediaPipe assetek

A `public/mediapipe/face_detection/` több MB-nyi `.wasm` / `.data` / `.tflite` / `.binarypb` fájlt tartalmaz. Ezek a Vercel statikus asseteibe kerülnek. Az A. blokk megméri; ha közel van a limithez, alternatíva a jsDelivr CDN-ről töltés (`solutionPath` átállítása) — ⚠️ **de ez külső függőséget és adatvédelmi kérdést hozna be**, ezért csak végszükség esetén.

### 7.7 ⚠️ Firebase authorized domains — a preview deploymentek buktatója

A Firebase Auth `authorized domains` listája **nem támogat wildcardot**. A Vercel minden commithoz **új, random** preview URL-t generál (`…-abc123-team.vercel.app`), amelyeken a Google bejelentkezés `auth/unauthorized-domain` hibát ad.

**Megoldás:** a **branch-domain** (`…-git-<branch>-<team>.vercel.app`) **stabil** — ezt kell felvenni a Firebase listájára a `develop` (debug) és a production domain mellé. Az egyedi commit-preview URL-eken a bejelentkezés **nem fog működni**, és ez így **elfogadott** — dokumentálandó, hogy senki ne kezdje debuggolni.

### 7.8 A `localStorage` nem vándorol domainváltásnál

A meglévő játékosok állapota (`space-travel-game`, `space-travel-shop`, `space-travel-lang`, `realtime_space_travel_device_id`) a **régi origin** (`realtimespacetravel-e74e3.web.app`) alatt él. Az új Vercel domainen **üres** localStorage-dzsel indulnak.

| Adat | Elveszik? | Miért |
|---|---|---|
| Kredit, birtokolt tételek | ❌ nem | RTDB-ben él, a bejelentkezés visszahozza |
| Küldetésnapló (Wall of Shame) | ❌ nem | RTDB-ben él ([[012-wall-of-shame]] szerinti szinkron) |
| **Vendég (deviceId) identitás** | ⚠️ **igen** | A `realtime_space_travel_device_id` új UUID-t kap → **új, üres vendég-fiók** |
| Aktuális, félbehagyott küldetés fázisa | ⚠️ igen | Csak localStorage-ban van |
| Nyelvválasztás | ⚠️ igen | Újradetektálódik a böngészőből |

**Következmény:** a **be nem jelentkezett vendégek** elveszítik a haladásukat a domainváltással. Ez a migráció **elfogadott ára** — de kommunikálandó, és érv amellett, hogy a Firebase Hosting egy ideig **redirectként** éljen tovább, hogy legalább a régi URL ne legyen halott link.

### 7.9 ⚠️ A Stripe Payment Link redirect URL-ek a régi domainre mutatnak

A 8 létező (teszt módú) Payment Link `after_completion.redirect.url` mezője a `https://realtimespacetravel-e74e3.web.app/shop/success` címre mutat ([[005-ingame-shop-strapi-stripe]]). Migráció után ez a régi origin, ahol **nincs** alkalmazás.

Két út:

- **(a) Újragenerálás** (ajánlott): `scripts/create_payment_links.mjs --redirect=https://<vercel-domain>/shop/success`, majd a `src/constants/shopCatalog.ts` URL-jeinek frissítése. ⚠️ Ez a lépés **együtt mehet** a [[021-stripe-fraud-defense]] D fázisának `?session_id={CHECKOUT_SESSION_ID}` toldalékával — egy körben, nem kétszer.
- **(b) Firebase Hosting 301** a Vercel domainre, query string megőrzésével. Átmeneti megoldásnak jó, de egy fizetési út **két hosztoló közti redirectre** építése törékeny.

### 7.10 A dev port és minden dokumentált parancs megváltozik

`localhost:5173/realtime_space_travel/` → **`localhost:3000`**. Ez a CLAUDE.md-ben, a README-ben és minden korábbi terv „hasznos parancsok" szekciójában szerepel. A **korábbi terveket nem írjuk át** (azok a maguk idejének állapotát rögzítik), de a CLAUDE.md **kötelezően** frissül (M. blokk).

### 7.11 A `next lint` új szabályokat hoz be

Az `eslint-config-next` olyan szabályokat aktivál, amiket a projekt eddig nem futtatott (pl. `@next/next/no-img-element` — pont az `<img>`-kre, amiket **szándékosan** megtartunk). A lint kimenete **ne blokkolja** a migrációt: a `no-img-element` szabály tudatosan kikapcsolandó, indokkal (9. szekció).

### 7.12 A `metadata.json` és a `site.webmanifest`

A gyökérben lévő `metadata.json` és a `public/site.webmanifest` szerepe tisztázandó. A `site.webmanifest` marad a `public/`-ban (a `metadata.manifest` mező hivatkozik rá); a `metadata.json` sorsáról az M. blokk dönt.

### 7.13 Ne írjuk át a játéklogikát „amíg úgyis hozzányúlunk"

A migráció **27 env/asset-sort** és **3 SSR-védelmet** érint. Minden ezen felüli módosítás (refaktor, típusrendezés, komponens-átnevezés) **rontja a diff olvashatóságát** és megnehezíti a hibakeresést, amikor valami nem működik. A [[017-starfield-realism]] tanulsága, hogy a scope-bővítés akkor legitim, ha **ugyanazt a kódrégiót** írja — itt ez nem áll fenn.

---

## 8. Kézi teszt-forgatókönyvek

> Mindegyik lefuttatandó a **Vercel preview** deploymenten (L. blokk); az 1, 2, 3, 9, 12 a **production** deploymenten is.

| # | Forgatókönyv | Elvárt eredmény |
|---|---|---|
| 1 | **Hidegindítás:** a production URL megnyitása üres böngészőprofilban | Intro lejátszódik → főmenü; **nulla** konzol-hiba, **nulla** hidratálási figyelmeztetés, **nulla** 404 a Network fülön |
| 2 | **Google bejelentkezés:** főmenü → bejelentkezés | A popup megnyílik, a bejelentkezés sikeres, a becenév és a kredit betöltődik az RTDB-ből. ⚠️ Ha `auth/unauthorized-domain`: 7.7 |
| 3 | **Kamera + arcfelismerés:** küldetés indítása → kamera-hozzájárulás → játék | A kamera elindul, az arcfelismerés fut; elfordulásra `paused` → `countdown`; visszafordulásra folytatódik |
| 4 | **Arcfelismerés hibaág:** a `/mediapipe/face_detection/face_detection.js` blokkolása a DevTools-ban → játékindítás | **Hangos**, érthető hibaüzenet (a lusta stub `Error`-ja), nem néma fagyás |
| 5 | **Assetek:** minden képernyő végigkattintva (főmenü, küldetésválasztó, hajóválasztó, shop 4 fül, beállítások, Wall of Shame, barátok, chat) | Minden kép betöltődik; **nulla** 404 |
| 6 | **Zene:** háttérzene a menüben; zenei előnézet a shopban; zeneváltás a beállításokban | Mindhárom szól; a shopban **nincs** háttérzene (a `shop` pre-game fázis) |
| 7 | **Csillagmező:** a [[017-starfield-realism]] viselkedése (színes csillagok, magnitúdó, warp-csíkok, kitérő manőver forgással), HiDPI kijelzőn is | Változatlan a migráció előttihez képest |
| 8 | **F5 a játék közben:** futó küldetés → oldalfrissítés | A [[007-state-persist-page-refresh]] szerinti viselkedés **bitre** ugyanaz; a játék ugyanabban a fázisban folytatódik |
| 9 | **Mély link:** `/shop/success?session_id=cs_test_abc123` közvetlen megnyitása | A shop képernyő nyílik meg; a `session_id` elérhető a kliensen; az URL a `history.replaceState` után `/`-re tisztul |
| 10 | **Ismeretlen URL:** `/valami/random` | A játék betöltődik (mint ma az SPA-fallbacknél), nem 404-oldal |
| 11 | **Nyelvváltás:** `LanguageSwitcher` → mind az 5 nyelv, majd F5 | A választott nyelv megmarad; a `<html lang>` követi; nincs eltérés-figyelmeztetés |
| 12 | **Debug paritás:** production URL vs. preview URL | Production: nincs DebugOverlay/DebugEventBar/shop-reset, kezdő kredit **0⭐**. Preview: mindhárom van, kezdő kredit **9000⭐** |
| 13 | **Szerveroldal:** `GET /api/health` a production domainen | `200` + JSON, `env: "production"` |
| 14 | **Titok-szivárgás:** a production `.next/static/chunks/*.js` átvizsgálása `sk_`, `rk_`, `whsec_` mintára | **0 találat** |
| 15 | **Mobil / tablet:** a `ScreenCheck` orientációs viselkedés + a reszponzív képernyők | Változatlan (`355e1bc`, `0c1cc4d` commitok viselkedése) |
| 16 | **RTDB rules deploy:** a `database.rules.json` triviális módosítása + push | Az új workflow lefut, **semmi más** workflow nem indul, a rules deployolódik |

---

## 9. Tudatosan kimaradó hatókör

> Ezek a tételek **szándékosan** nem részei a tervnek. Egy későbbi session **ne „javítsa be" őket** a migráció ürügyén.

| # | Nem-tétel | Indoklás |
|---|---|---|
| 1 | **Szerverkomponensesítés / SSR** | A migráció célja az API route-ok, nem a szerveroldali renderelés (1.3). A játék canvas + kamera + audio + localStorage — SSR-ből **nulla** haszna van, hidratálási kockázata viszont jelentős |
| 2 | **`next/image`** | A képek statikus, ismert méretű `public/` assetek, jórészt canvasra vagy modálba rajzolva. A `next/image` optimalizálása itt költséget (Vercel Image Optimization kvóta) hozna érték nélkül, és a `Starfield` `drawImage` útvonalán **nem is használható** |
| 3 | **`next/font`** | A projekt nem tölt be webfontot |
| 4 | **`next/navigation` router** | A navigáció `GamePhase` állapotgép, nem URL (1.7) |
| 5 | **`@/…` path alias bevezetése** | 92 fájl importsorát írná át, nulla funkcionális haszonért; a migráció diffjét olvashatatlanná tenné |
| 6 | **Stripe Checkout Session / webhook route** | A [[021-stripe-fraud-defense]] F fázisa és a [[024-stripe-go-live]] hatóköre. Itt csak a **hely** készül el (`app/api/health/route.ts` mintaként) |
| 7 | **`firebase-admin` bevezetése** | Ugyanaz — a 021 F fázisa hozza be, a service account kezelésével együtt |
| 8 | **RTDB „Phase-2" rules (`wallet.write = false`)** | Csak akkor kapcsolható be, ha **van** szerveroldali író. A migráció ezt **lehetővé teszi**, de nem vezeti be |
| 9 | **A `useUIStore` perzisztálása** | A hangerő/nehézség ma is elveszik F5-re; ez **meglévő viselkedés**, nem migrációs regresszió. Külön terv tárgya |
| 10 | **Tesztkeretrendszer-váltás (Playwright / Jest)** | 147 zöld teszt nem kockáztatható egy build-migráció közben (I. blokk) |
| 11 | **Vitest → `next/jest`** | Ugyanaz az indok; a Vitest jól működik Next mellett |
| 12 | **A `firebase.json` `hosting` szekció azonnali törlése** | A Payment Link redirect URL-ek miatt átmenetileg kell (7.9) |
| 13 | **Játéklogikai refaktor** | 7.13 |

---

## 10. Becsült ráfordítás

| Blokk | Tartalom | Nagyságrend |
|---|---|---|
| A | Baseline (mérés, képernyőképek, ág létrehozása) | ~1 óra |
| B | Next váz, layout, metadata, catch-all, AppShell, tsconfig, package.json | ~3–4 óra |
| C | Env átvezetés (27 tétel) + `.env.example` | ~1–2 óra |
| D | `BASE_URL` kiiktatás (11 tétel) + a 4 build-fájl törlése | ~1–2 óra |
| **E** | **MediaPipe** (script, lusta stub, alias ×2, headerek, 4 ellenőrzési pont) | **~0,5–1 nap** ⚠️ |
| F | Zustand persist + hidratálás | ~2–3 óra |
| G | i18next kliensoldali init | ~1 óra |
| H | Kliens/szerver határ + routing ellenőrzés | ~1–2 óra |
| I | Vitest szétválasztás + 147 teszt zöldre | ~2–4 óra (a React 19 kompatibilitástól függ) |
| J | Deploy pipeline (Vercel, workflow-k, Firebase domains, Payment Linkek) | ~0,5 nap |
| K | Debug mód környezetenként | ~1 óra |
| L | Validáció (16 kézi forgatókönyv ×2 környezet) | ~0,5 nap |
| M | Dokumentáció (CLAUDE.md, konvenciók, lessons-learned) | ~2 óra |

**Összesen: ~3–5 munkanap**, ebből a legnagyobb szórást az **E. blokk (MediaPipe)** és az **I. blokk (React 19 + tesztek)** adja. Ha a React 19 kompatibilitás problémás, a React 18-ra visszalépés **a Next 16 megtartásával** (7.2) további ~fél napot jelent.

---

**Kész definíció:** az alkalmazás Next.js App Routeren fut Vercelen; a `/` és minden mély link (`/shop/success`, `/legal/*`, tetszőleges URL) a játékot tölti be; a webkamerás arcfelismerés **HTTPS production deploymenten, valódi kamerával** működik; `npm run test` **147/147 zöld**; `tsc --noEmit` és `next build` hibamentes; a böngésző konzolján **nulla** hidratálási figyelmeztetés; a Google bejelentkezés, az RTDB olvasás/írás, a zene, az összes kép és a [[007-state-persist-page-refresh]] szerinti F5-viselkedés változatlan; a production buildben nincs debug felület és a kezdő kredit 0⭐, a preview buildben van debug és 9000⭐; a `/api/health` a production domainen JSON-t ad; a `.next/static` bundle **nem tartalmaz** Stripe-kulcs-mintát; a `STRIPE_SECRET_KEY` **`NEXT_PUBLIC_` prefix nélkül**, kizárólag a Vercel env store-ban létezik; a `.github/workflows/deploy.yml` törölve, a rules-deploy workflow build és env nélkül fut; a `src/i18n/locales/**` **egyetlen fájlja sem módosult**.

---

## 11. Kapcsolódó tervek

- [[021-stripe-fraud-defense]] – **A migráció legfontosabb haszonélvezője.** A 3.0 szekció „tágabb következtetése" kimondja, hogy *„egy titkos kulcsnak egy kizárólag kliensoldali buildben nincs legitim szerepe"*, és hogy a kulcs tényleges használatához *„előbb szerveroldali futtatókörnyezet kell"* — **ezt a környezetet teremti meg ez a terv**. A 021 A fázisának `VITE_STRIPE_SECRET_KEY` → `STRIPE_SECRET_KEY` átnevezését a migráció C. blokkja **elvégzi** (a workflow-kból a kulcs egyszerűen eltűnik, mert maguk a workflow-k szűnnek meg vagy csupaszodnak le). A 021 **F fázisa** (Cloudflare Worker + webhook + RTDB REST) a migráció után **egyszerűsödik**: ugyanabban a repóban, ugyanabban a deployban, `app/api/stripe/webhook/route.ts`-ként valósul meg, `firebase-admin`-nal. Ezzel a 021 5.1 „amit backend nélkül NEM lehet elérni" listája **teljes egészében megoldhatóvá válik**, és a `wallet` „Phase-2" szabálya (`".write": false`) bevezethető. ⚠️ **Ütközés:** a 021 6.3 táblája a **Vercel Hobby ToS** miatt zárta ki a Vercelt kereskedelmi endpointként — lásd 12.1.
- [[024-stripe-go-live]] – **Blokkoló előfeltétele lesz ennek a tervnek.** A 024 A fázisa és a 021 3.0 közti, ott kifejezetten „egyeztetendő eltérésként" jelölt ellentmondás (a Stripe kulcs a workflow `env:` blokkjában **maradjon átnevezve** vagy **tűnjön el**) a migrációval **feloldódik**: a kérdés tárgytalanná válik, mert a build-workflow-k megszűnnek, a kulcs pedig szerveroldali env változóvá lép elő. A 024 C fázisának `/legal/terms`, `/legal/privacy`, `/legal/refund`, `/legal/imprint` **mély linkjei** a catch-all route alatt külön route-fájl nélkül működnek (1.7). A 024-nek a migráció után kezelnie kell: (a) a Payment Linkek **újragenerálását** a Vercel domainre (7.9), (b) a Stripe Dashboard **weboldal URL / ToS URL / Privacy URL** mezőinek átállítását, (c) a dev/prod link-választás explicit kapcsolóját (3.4).
- [[005-ingame-shop-strapi-stripe]] – **Előfeltétel.** Az itt megépített Payment Link út `/shop/success` redirectje a migráció routing-követelménye (H. blokk), az `import.meta.env.DEV` alapú dev/prod link-választás pedig a C. blokk 16. tétele. A 005 „Ismert korlátok" táblájának *„Nincs webhook → nincs automatikus verifikáció"* sora **ezzel a tervvel válik feloldhatóvá**. ⚠️ A cross-origin localStorage korlát (localhost ↔ hosztolt origin) a migráció után **localhost ↔ Vercel domain** relációra változik — a jelenség változatlan.
- [[017-starfield-realism]] – **Kódütközés és minta.** Ütközés: a `Starfield.tsx:120` cockpit-fallback `BASE_URL` sora a 017 által frissen írt régióban van (D. blokk 2. tétel). Minta: a 017 3.2 tételes átvezetési táblája és a „mi történik, ha kimarad" megközelítése ebben a tervben a 3.1–3.3 táblákban folytatódik; a 017 A. blokkjának elmaradt baseline-jából levont tanulság indokolja az itteni A. blokk kötelezővé tételét.
- [[003-firebase-auth-settings]] – **Előfeltétel és haszonélvező.** A Firebase Auth + RTDB séma változatlanul marad; a migráció **egyetlen** Firebase-érintettsége az authorized domains bővítése (7.7) és a `NEXT_PUBLIC_FIREBASE_*` átnevezés. A 003 6. pontjában felvázolt szerveroldali `awardWage` / `purchaseWithCredits` (ott Cloud Functionökkel, Blaze tervvel) a migráció után **Vercel API route-ként**, Blaze terv nélkül valósítható meg.
- [[007-state-persist-page-refresh]] – **Előfeltétel és referencia.** A `space-travel-game` persist viselkedése a hidratálási munka (F. blokk) mércéje: a migráció után az F5-viselkedésnek **bitre azonosnak** kell lennie. A `skipHydration` bevezetése technikai védelem, nem viselkedésváltás — ha bármi eltérés adódik, az **regresszió**.
- [[012-wall-of-shame]] – **Érintett közvetve.** A küldetésnapló RTDB-ben él, tehát a domainváltás (7.8) nem érinti a bejelentkezett felhasználóknál; a **vendégek** viszont új `deviceId`-t kapnak az új originen, tehát a naplójuk „eltűnik". Kommunikálandó.
- [[018-intro-deterministic-layout]] – ⚠️ **Kódütközés, egyik irányban sem függőség.** A C. blokk **3.1 táblájának 14. tétele** (`src/components/screens/IntroScreen.tsx` · `VITE_DEBUG_MODE` → `NEXT_PUBLIC_DEBUG_MODE`) **pontosan azt a sort** érinti (`IntroScreen.tsx:10`), amit a 018 G. blokkja is átír a komponens jelentős átalakítása közben. **Feloldás:** ha a 018 **előbb** fut, a 14. tétel változatlanul elvégezhető, csak a sor környezete néz ki másképp; ha a migráció fut előbb, a 018-nak a már átírt `process.env`-es formát kell megtartania. Mindkét irányban **egyetlen sor**. ⚠️ A 018 `dependencies: []` — **nem** vár erre a migrációra, és ez a migráció sem vár rá. **Két ellenőrzési pont a migráció után** (ha a 018 már megvan): (a) a 018 `useIntroLayout` hookja **kliens-only** (`document.fonts`, `window.innerHeight`), tehát a `ssr: false` határ mögé kell essen — a `document.fonts` szerveroldalon nem létezik; (b) a React 18 → 19 **StrictMode dupla-effekt** viselkedése a hook `await document.fonts.ready` utáni `setState`-jét érinti, ott cleanup-védelem kell. A 018 tiszta moduljai (`src/services/introLayout.ts`, `introFit.ts`) keretrendszer-függetlenek, tehát a migráció **nem érinti** őket.
- [[016-notification-retention]] – **Nem érintett**, de megjegyzendő: a `notifications/{uid}` node takarítása a migráció után szintén **szerveroldalról** (Vercel API route + cron) elvégezhető, nem csak kliensoldali TTL-lel. Ez a 016 hatókörét bővítő lehetőség, nem ennek a tervnek a feladata.

---

## 12. Eldöntött kérdések

> ✅ **A 12.1–12.4 kérdések 2026-07-30-án eldőltek** (a felhasználó döntései a `dev` skill hangoló körében). A szekciók megtartják az eredeti indoklást, mert az magyarázza, **miért** így dőlt el — de mindegyik alatt ott a végleges döntés. Ezek a pontok **nem** nyitottak.

### 12.1 ✅ Vercel Hobby — valós pénzes fizetés nélkül

A [[021-stripe-fraud-defense]] 6.3 táblája a serverless futtatók összevetésénél a Vercelt **kifejezetten kizárta**:

> | **Vercel Hobby** | bőséges | ⚠️ **NEM** — a Hobby ToS tiltja a kereskedelmi használatot | Valós pénzes fizetést kiszolgáló endpointhoz **Pro** csomag kellene |

A felhasználó a Vercelt választotta deploy célként. A migráció **önmagában** (fizetés nélkül) Hobby csomagon is fut, de amint a [[024-stripe-go-live]] élesedik, a valós pénzt kiszolgáló endpoint **Pro csomagot** igényel (~20 USD/hó/felhasználó).

**✅ DÖNTÉS (2026-07-30): Hobby csomagon maradunk, valós pénzes fizetés nélkül.** A Vercel Pro (~20 USD/hó) **nincs vállalva**.

Mit jelent ez a gyakorlatban:

| Terület | Hobby-n megvalósítható? |
|---|---|
| A migráció maga (A–N blokkok) | ✅ **Igen**, teljes egészében |
| Stripe **teszt módú** Checkout Session + webhook | ✅ **Igen** — a teszt mód nem kereskedelmi használat, a Hobby ToS nem tiltja |
| A Stripe titkos kulcs szerveroldali env-be költöztetése | ✅ **Igen** |
| `firebase-admin` szerveroldalon + a **Phase-2** RTDB szabályok (szerver-only wallet/inventory írás) | ✅ **Igen** — és ez a [[021-stripe-fraud-defense]] legfontosabb hiányzó építőköve |
| **Valós pénz** átvétele ([[024-stripe-go-live]]) | ❌ **Nem** — ehhez Pro kell |

**Következmény a roadmapre:** a [[024-stripe-go-live]] végrehajtása egy **külön, későbbi Pro-döntéshez** van kötve. Ez jól illeszkedik ahhoz, hogy a 024 a lista utolsó eleme. A [[021-stripe-fraud-defense]] viszont **nem** blokkolt: a csalásvédelem érdemi része (Admin SDK, Phase-2 szabályok, a kliensoldali egyenlegírás megszüntetése) független attól, hogy valós pénz mozog-e — ma ugyanis a **kliens írja a saját egyenlegét**, és ez a rés Hobby-n is bezárható.

⚠️ Aki a 024-hez ér, annak **először** a Vercel Pro (vagy egy alternatív futtató — a 021 6.3 táblája Cloudflare Workerst ajánlott) kérdését kell eldöntenie. A 021 6.3 táblájának Vercel-kizárása tehát **érvényben marad a valós pénzes endpointra**, és nincs ellentmondásban ezzel a migrációval.

### 12.2 ✅ Next 16 + React 19

A brief nem rendelkezett a verzióról. A terv **React 19**-et javasol (jövőálló út; a kódbázis mérés szerint jól áll — 7.2), de ez a migráció hatókörét egy **React major frissítéssel** bővíti.

**✅ DÖNTÉS (2026-07-30): React 19.** A React major frissítés **a migráció hatókörének része**.

⚠️ **Verzió-korrekció (2026-07-31).** A döntés eredetileg „Next 15 + React 19" néven került rögzítésre. A registry ellenőrzése (`npm view next version` → **16.2.12**) kimutatta, hogy a Next legfrissebb stabil majorja a **16**, nem a 15 — a terv azért írt 15-öt, mert az AI asszisztens tudásbázisa elavult volt, és a verziót senki nem ellenőrizte a forrásnál. A felhasználó döntése (React 19, a legfrissebb támogatott úton) **változatlan**; a Next major **15 → 16**-ra javítva.

⚠️ **Ebből következő átvizsgálási kötelezettség:** a terv Next-verzióhoz kötött állításai **15-ös feltételezéssel** íródtak. Az implementáció előtt a hivatalos Next 16 upgrade guide alapján **újra kell ellenőrizni** legalább ezeket:
- a `dynamic(..., { ssr: false })` viselkedése szerver komponensben (3.2 / B. blokk),
- a Turbopack alapértelmezettsége és a webpack-alias továbbélése (az E. blokk MediaPipe-megoldásának alapja),
- a `next/script` `beforeInteractive` stratégia szerződése,
- az aszinkron request API-k (`cookies`, `headers`, `params`) és a caching alapértelmezések,
- a `node` engine követelmény (`>=20.9.0`) a CI `node-version` beállításához képest.

A döntés alapja a 7.2-es mérés: a kódbázis jól áll (nulla argumentum nélküli `useRef()`, már `createRoot`, nincs `propTypes`). A vállalt kockázat két ponton koncentrálódik, mindkettőnek külön ellenőrzési pont jár:

- **StrictMode dupla-effekt** — a projektben több modul-szintű singleton véd ellene (`authBootstrap.ts`), ezek viselkedését React 19 alatt újra igazolni kell.
- **A 147 meglévő teszt** — ezek ma zöldek; a migráció után is zöldnek kell lenniük. Ha a React 19 miatt bukik közülük bármelyik, azt **javítani** kell, nem kikapcsolni.

### 12.3 ✅ A Firebase Hosting sorsa — saját domén később, külön

Három lehetőség: (a) teljes leállítás, (b) 301 redirect a Vercel domainre, (c) párhuzamos üzem egy ideig. A terv **(b)**-t javasolja átmenetileg, a Payment Link redirect URL-ek miatt (7.9).

**✅ DÖNTÉS (2026-07-30): a saját domén NEM ebben a körben jön.** A migráció a Vercel által adott aldoménre megy; a redirect-változat **(b)** marad érvényben a Payment Link visszatérési címek miatt (7.9).

⚠️ **Tudatosan vállalt következmény:** a `localStorage` nem vándorol doménváltásnál, ezért a **be nem jelentkezett vendégek kétszer** veszítik el a haladásukat — egyszer most, a Vercelre költözéskor, és még egyszer a későbbi saját doménre váltáskor. A felhasználó ezt a kérdés ismeretében fogadta el.

Ebből két teendő következik:

- A 7.8-as enyhítés (a doménváltás előtti figyelmeztetés / bejelentkezésre buzdítás a vendégeknek) **mindkét** alkalommal esedékes, nem csak egyszer — a migráció **nem** oldja meg véglegesen ezt a problémát.
- Amikor a saját domén mégis megjön, az **külön terv** lesz, és a Payment Link visszatérési címeket (8 db) **másodszor is** át kell állítani. Ezt a majdani terv nyitó tételeként kell rögzíteni.

> A vesztés csak a **vendégeket** érinti: a bejelentkezett felhasználók adatai az RTDB-ben vannak, ami doménfüggetlen.

### 12.4 ✅ A `category` mező — `core`

A brief `core` vagy `infra` kategóriát javasolt. A projektben ma használt kategóriák: `i18n`, `ui`, `shop`, `auth`, `core`, `security`, `payments` — **`infra` nem létezik**. A terv ezért **`core`**-t használ. **✅ Eldőlt:** a `manage-roadmap` agent az átszámozáskor a `core`-t hagyta érvényben — új `infra` kategória **nem** jön létre.
