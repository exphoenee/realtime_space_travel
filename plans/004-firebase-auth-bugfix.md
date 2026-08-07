---
title: "Firebase Google bejelentkezés bugfix – uid-megőrzés, RTDB rules, deploy"
slug: 004-firebase-auth-bugfix
type: plan
category: auth
status: implemented
implemented: true
implemented_at: "2026-07-26"
created_at: "2026-07-26"
updated_at: "2026-07-26"
author: exphoenee
step: 4
phases:
  - 1
dependencies:
  - 003-firebase-auth-settings
related_plans:
  - 000-i18n-nyelvesites
  - 002-ingame-shop-frontend
  - 005-ingame-shop-strapi-stripe
  - 006-editable-displayname
tags:
  - firebase
  - auth
  - rtdb
  - bugfix
  - security-rules
  - deploy
  - device-id
  - stale-bundle
---

# Firebase Google bejelentkezés bugfix – uid-megőrzés, RTDB rules, deploy

**Cél:** a Google bejelentkezés végre **működjön** mindkét deployon (Firebase Hosting + GitHub Pages) úgy, hogy a névtelen játékos uid-je és a hozzá tartozó kredit/birtoklás **nem vész el**. A hiba nem egy bug, hanem **hat egymást elfedő hiba** — mindegyiket javítani kell, önmagában egyik javítás sem elég.

## Tünet

Google bejelentkezéskor a játékos anonim fiókja (uid `hJ9MWfvxZKXP6cj8FrIsPKmIDnr1`, **7804 kredit**) elvész: a kredit **9000**-re ugrik (a debug-mód lokális alapértéke), a megjelenített User ID **`null`** lesz.

### Megerősített konzol-hibák

| Környezet | Hiba |
|---|---|
| Firebase deploy | `set at /users/UkJoNld9AjavJ1INwtCyY3lRT1P2 failed: permission_denied` → `Firebase sync failed: PERMISSION_DENIED` |
| GitHub Pages | `auth/invalid-api-key` + `Firebase config missing` |
| GitHub Pages | `GET https://exphoenee.github.io/mediapipe/face_detection/face_detection.js 404` |
| Firebase Console | Nincs Hosting/App Hosting a projektben provisionálva |

## Döntések (egyeztetve)

| Kérdés | Választás |
|--------|-----------|
| Auth mechanizmus | **Popup-first + redirect fallback** (`signInWithPopup` / `linkWithPopup`, popup-blokk esetén redirect) — így a GitHub Pages **és** a Firebase Hosting is működik |
| Célkörnyezet | **Mindkettő** működjön (Firebase Hosting bekapcsolása + GitHub Pages marad) |
| Security Rules deploy | **CLI + CI** (`database.rules.json` javítás, `firebase.json` `database` szekció, workflow `--only hosting,database`) |
| Kredit forrása | **RTDB az egyetlen forrás** — `credits: 0` induló érték + `creditsLoaded` flag; a debug 9000 a `getDefaultUserNode`-ba kerül, nem lokális defaultként |
| Elárvult 7804 kredit | **Mentsük** — dokumentált kézi Firebase Console lépés |
| MediaPipe 404 | **A terv része** (az arcfelismerés a játék fő mechanikája) |
| Phase-2 rules (`".write": false`) | **Nem most** — csak az `awardWage` / `purchaseWithCredits` Cloud Functionök után ([[003-firebase-auth-settings]] 6. pont) |
| Guest azonosítás | **localStorage UUID (`deviceId`)** — ahelyett, hogy minden vendég user random Firebase Anonymous UID-t kapna, egy localStorage-beli UUID a stabil azonosító (`device_map/{deviceId}→{firebaseUid}`) |
| Guest→Google migráció | **Adatmigráció:** guest adatok (`users/{deviceId}`) → Google user (`users/{googleUid}`), utána guest adat + device_map törölve |
| Kredit duplikáció védelem | **deviceId rotáció:** migráció után új UUID a localStorage-ban, a régi többé nem használható |

---

## ✅ Haladás (TODO)

> Jelölés: `[ ]` hátravan · `[~]` folyamatban · `[x]` kész.

**A. RTDB Security Rules deploy (ez oldja fel a PERMISSION_DENIED-et — ELSŐ lépés)**
- [x] `security.rules.json` — dokumentált (kommentelt) forrás létrehozása/frissítése a Phase-1 szabályokkal + a generáló one-liner a fejlécbe
- [x] `database.rules.json` — a Phase-1 (kommentmentes) szabályok: `profile`/`settings`/`wallet`/`inventory`/`stats` → `auth != null && auth.uid == $uid`
- [x] `firebase.json` → `"database": { "rules": "database.rules.json" }` szekció
- [x] `.github/workflows/deploy-firebase.yml` → `npx firebase-tools deploy --only hosting,database`
- [x] Kézi deploy: `npx firebase-tools deploy --only database` + Rules Playground ellenőrzés
- [x] **device_map + $key==auth.uid szabályok** hozzáadása (lásd L. + O. blokk)

**B. Firebase Hosting bekapcsolása**
- [x] Console → Hosting → Get started (default site: `realtimespacetravel-e74e3.web.app`)
- [x] Console → Authentication → Settings → Authorized domains: `localhost`, `realtimespacetravel-e74e3.web.app`, `exphoenee.github.io`
- [x] A korábbi GitHub Actions deploy-log ellenőrzése (a bukás oka a hiányzó site volt-e)

**C. Egységes `startGoogleAuth()` (a #3 hiba gyökere)**
- [x] `src/firebase/auth.ts` → `startGoogleAuth()` (popup-first, link ha anonim, redirect fallback, `credential-already-in-use` ág)
- [x] `MainMenu.tsx` **és** `SettingsScreen.tsx` ugyanezt hívja (a `signInWithGoogle` + `linkAnonymousToGoogle` páros kivezetése)
- [x] `credential-already-in-use` esethez felhasználói üzenet (a vendég-kredit nem vihető át)

**D. Auth bootstrap singleton (StrictMode dupla-init race)**
- [x] Új `src/firebase/authBootstrap.ts` — modul-szintű `started` / `anonInit` / `redirectCheckDone` flagek
- [x] `signInAnonymous` csak `auth.currentUser == null` esetén; hibánál `anonInit = false` (újrapróbálható)
- [x] `subscribeUser` **kikerül** az `ensureUserNode` `try`-jából — mindig lefut
- [x] `App.tsx` effect már csak `startAuthBootstrap(handleUserData)`-t hív

**E. Hibák felszínre hozása (ez rejtette el az egész bugot)**
- [x] `checkRedirectResult` ne nyelje el a hibát → `{ user, error }` visszatérés
- [x] `useAuthStore` → `authError: string | null` + `setAuthError`
- [x] `getAuthErrorMessage` bekötése minden auth/RTDB hibaágra (`console.error` **mellé**, nem helyette)
- [x] `SettingsScreen` hibasáv újrahasznosítása + hibasáv a `MainMenu`-ben
- [x] `useAuthStore.clearUser` holt kód felszámolása: Kijelentkezés gomb bekötése vagy törlés

**F. RTDB = egyetlen kredit-forrás**
- [x] `useShopStore` → `credits: 0` induló érték (lokális debug-elágazás törlése) + `creditsLoaded: boolean`
- [x] `getDefaultUserNode` → debug 9000 **ide** + `exoplanets: BASE_EXOPLANET_IDS` (külön bug: ma üres inventory-val jön létre a node)
- [x] `handleUserData` → RTDB mérvadó hiányzó ág esetén is (`data.wallet?.credits ?? 0`, `mergeInventory` → `[]` / `BASE_EXOPLANET_IDS`), + `setDisplayName` szinkron
- [x] Kreditkijelzők (`SettingsScreen`, `CreditBalance`, `ShopScreen`) `creditsLoaded === false` → `—`

**G. Dev headerek + deploy konfigurációk**
- [x] `vite.config.ts` → a `Cross-Origin-Opener-Policy` + `Cross-Origin-Embedder-Policy` dev headerek **törlése**
- [x] `.github/workflows/deploy.yml` → mind a 8 `${{ vars.VITE_FIREBASE_* }}` sor a `Build for GitHub Pages` step `env:` blokkjába
- [x] `.env.example` létrehozása a dokumentált env változókkal

**H. MediaPipe 404**
- [x] `faceRecognition.ts` → futásidejű `solutionPath` (`new URL(..., document.baseURI)`)
- [x] `index.html` `<script src="mediapipe/...">` + `__BASE_HREF__` viszony ellenőrzése mindkét base path-on — feltárva: a `<base href>` hardcodeolva volt `/`-ra, nem `__BASE_HREF__`; javítva
- [x] Ellenőrzés: a GH Pages-re nem a `build:firebase` (base `/`) kimenete került-e ki — mindkét workflow (deploy.yml + deploy-firebase.yml) saját env-vel épít, nincs átfedés
- [x] `vite.config.ts` MediaPipe **alias** vizsgálata: prodban is a stub épül-e be → ha igen, az alias a `test` szekcióba költözik

**I. Adatmentés (egyszeri, kézi — az A–D deploy UTÁN)**
- [x] `users/hJ9MWfvxZKXP6cj8FrIsPKmIDnr1` export JSON (ha létezik)
- [x] Auth → Users: az árva Google uid azonosítása (gyanús: `UkJoNld9AjavJ1INwtCyY3lRT1P2`)
- [x] `users/<google-uid>/wallet/credits = 7804` + inventory átmásolás
- [x] Az árva anonim fiók törlése (Auth + RTDB node)

**J. i18n**
- [x] `login.error.*` kulcsok mind az 5 nyelven (en, hu, fr, de, es)
- [x] `settings.logout` mind az 5 nyelven
- [x] `settings.uidCopied` mind az 5 nyelven (en, hu, fr, de, es)

**K. Ellenőrzés**
- [x] A 12 pontos ellenőrzési terv (7. szekció) végigfuttatva
- [x] `npm run test` (14 passed) + `npm run build` + `npm run build:gh-pages`
- [x] `tsc --noEmit` — többször lefuttatva, mindig clean

**L. Device-based guest identitás (localStorage UUID)**
- [x] `src/firebase/deviceId.ts` — új utility: `getDeviceId()` (UUID generálás/olvasás localStorage-ból)
- [x] `src/state/useAuthStore.ts` — +`deviceId` mező (kezdőérték: `getDeviceId()`), +`setDisplayName` action
- [x] `src/firebase/userData.ts` — +`ensureDeviceMap(deviceId, firebaseUid)`; `ensureUserNode` 3. param: `deviceId` → `users/${deviceId}` path
- [x] `src/firebase/authBootstrap.ts` — `ensureDeviceMap` hívása MINDEN auth-user előtt; `subscribeUser(deviceId, …)`; `getDeviceId()` használata
- [x] **Minden RTDB írás (shop, settings, stats) átállítva** `uid`→`deviceId`: `App.tsx`, `useShopStore.ts`, `SettingsScreen.tsx`
- [x] `database.rules.json` — `device_map` szekció: `".write": "auth != null && newData.val() == auth.uid"`; `/users/$deviceId` rules: `device_map/$deviceId == auth.uid` ellenőrzés
- [x] `security.rules.json` — ugyanaz kommentekkel

**M. `subscribeUser` retry + cleanup**
- [x] `subscribeUser` exponenciális backoff retry (1s, 2s, 4s, 8s) `permission_denied` esetén
- [x] `cancelled` flag + `clearTimeout` a cleanup-ban (megakadályozza a retry-t az unsubscribe után)
- [x] Kijelentkezéskor `unsubUser()` hívása a `!user` ágban (authBootstrap.ts) — a régi listener nem marad aktív
- [x] `handleCopyUid` dependency fix: `[uid]` → `[deviceId]`

**N. SettingsScreen UI javítások**
- [x] **DisplayName szinkron:** `handleUserData` `profile.displayName` szinkronizálása a store-ba `setDisplayName()`-nel (megoldja, hogy `authUser.displayName` null legyen linkelt Google fióknál)
- [x] **Account section layout:** full-width vertical stack (`.accountSection`) — név + badge balra, kredit jobbra → nickname editor → device ID → logout gomb
- [x] **Custom Select komponens:** `src/components/ui/CustomSelect.tsx + .module.css` — `role="combobox"`, billentyűzet nav, ARIA, dark téma, scrollbar styling
- [x] Natív `<select>` kivezetve a SettingsScreen-ből, CustomSelect-re cserélve
- [x] `uid` dead code eltávolítva (`deviceId` váltotta ki)
- [x] `<label htmlFor="music-track">` visszaállítva (accessibility)

**O. Guest adat migráció Google belépéskor**
- [x] `src/state/useAuthStore.ts` — +`rtdbKey` mező (deviceId guest, uid authenticated); +`setRtdbKey` + `setDeviceId` action; `clearUser` deviceId frissítés
- [x] `src/firebase/userData.ts` — +`migrateGuestData(deviceId, targetUid)`:
  - Olvassa `users/{deviceId}` guest adatokat
  - **`update`-tal** írja `users/{googleUid}` gyerekeire (ugyanaz a `set`→`update` minta, ami az eredeti PERMISSION_DENIED-et javította)
  - Kredit merge: guest + Google kreditek **összeadódnak** (nem vesznek el)
  - Inventory merge: **egyesül** (mindkettő megmarad)
  - Stats: a **jobb érték marad**
  - Guest adat törlés: gyerekenként `update(..., null)` (mert a szülőn nincs `.write`)
  - device_map törlés: `set(mapRef, null)` (az új `data.val() == auth.uid` szabály engedi)
- [x] `src/firebase/authBootstrap.ts` — migráció hívása Google auth után (minden egyes belépéskor); sikeres migráció után `rotateDeviceId()` + store frissítés; hiba esetén fallback `deviceId`-re
- [x] `database.rules.json` + `security.rules.json` — `$deviceId` → `$key` paraméter; `.read`/`.write` engedi mind a `device_map/$key == auth.uid` (guest), mind a `$key == auth.uid` (authenticated) feltételt; `device_map` write rule `data.val() == auth.uid` (törlés engedély)
- [x] **Minden RTDB hívás átállítva:** `deviceId` → `rtdbKey` a store-ból (`useShopStore.ts`, `SettingsScreen.tsx`, `App.tsx`)

**P. DeviceId rotáció (kredit duplikáció védelem)**
- [x] `src/firebase/deviceId.ts` — +`rotateDeviceId()`: új UUID generálás + localStorage felülírás
- [x] `src/state/useAuthStore.ts` — +`setDeviceId(id)` action; `clearUser` most `deviceId: getDeviceId()`-t is állít (a rotált értéket olvassa)
- [x] `src/firebase/authBootstrap.ts` — sikeres migráció után: `rotateDeviceId()` + `store.setDeviceId(newDeviceId)` (a régi deviceId égett, nem használható újra)

> ⚠️ **Az O. és P. blokkot utólag javítja [[009-firebase-identity-split-bugfix]].** Az O. blokk migrációs `catch`-ága (`setRtdbKey(deviceId)`) élesben identitás-szétválást okozott, a P. blokk rotációja pedig felderíthetetlenné teszi az árva node-okat. A `rtdbKey` derivált értékké válik, a `setRtdbKey` action megszűnik, a rotáció kikerül a migrációs útból. **Ne ezt a két blokkot vedd referenciának — a 009-es tervet.**

---

## 0. Kiindulási állapot (fontos a végrehajtónak)

- **A terv a `develop` branch állapotára épül** (`e03aa4d firebase integration`). A `main` ág **még nem** tartalmazza a Firebase integrációt, ezért a végrehajtás **`develop`-on** történjen — `main`-en a lenti fájlok nagy része nem is létezik.
- **Minden fájl- és sorhivatkozás a `develop` munkafára érvényes** (`src/firebase/auth.ts`, `src/firebase/userData.ts`, `src/App.tsx`, `src/state/useShopStore.ts`, `database.rules.json`, `security.rules.json`, `index.tsx`). A redirect flow, a `checkRedirectResult`, a `getAuthErrorMessage`, az `ensureUserNode`/`subscribeUser` és mindkét rules-fájl **létezik** — ezek a feladatok tehát **javítások**, nem nulláról írás.
- **Egyetlen ténylegesen hiányzó fájl a `.env.example`** — ezt létre kell hozni (a [[003-firebase-auth-settings]] nyitott TODO-ja).
- A H. blokk `document.baseURI`-alapú MediaPipe-megoldása **illeszkedik** az `index.tsx:2-13` már meglévő `setBaseHref()` futásidejű logikájához: a `<base href>` futásidőben áll be, így a build-időben fixált `import.meta.env.BASE_URL` helyett a `document.baseURI` a helyes forrás.

---

## 1. Architektúra — a hat hiba és az összefüggésük

```
[1] PERMISSION_DENIED ──▶ ensureUserNode dob ──▶ ugyanabban a try-ban lévő
                                                  subscribeUser SOHA nem fut
                                                        │
                                                        ▼
                                          semmilyen RTDB adat nem érkezik
                                                        │
[2] useShopStore lokális default (debug 9000) ◀─────────┘ (nincs mi felülírja)
                                                        │
[3] MainMenu: signInWithGoogle (NEM link) ──▶ ÚJ uid ──▶ a 7804 kredit árván marad
                                                        │
[4] redirect flow nem tud visszatérni (COEP + storage partícionálás)
    + catch { return null } ──▶ setUser(null) ──▶ uid = null
                                                        │
[5] StrictMode dupla effect ──▶ 2. példány signInAnonymous-t hív a friss
    Google user FÖLÉ ──▶ újabb anonim uid
                                                        │
[6] rules soha nem deployolva + GH Pages env hiány ──▶ [1] és auth/invalid-api-key
```

**A javítás sorrendje kötött:** A (rules) → B (hosting) → C/D/E (kliens auth) → F (kredit-forrás) → G (deploy) → H (mediapipe) → I (adatmentés). Az L–P blokkok párhuzamosan haladhatnak az előzőekkel.

### 1.1 `[1]` PERMISSION_DENIED megöli a read-utat

`src/App.tsx` (auth effect): az `ensureUserNode` dob, és a `subscribeUser` **ugyanabban a `try`-ban** van utána → soha nem fut le → semmilyen RTDB adat nem érkezik a store-okba.

### 1.2 `[2]` `credits: 9000` lokális modul-default

`src/state/useShopStore.ts`:

```ts
const initialCredits =
  import.meta.env.VITE_DEBUG_MODE === "true" ? DEBUG_STARTING_CREDITS : STARTING_CREDITS;
```

A zustand persist eltávolítása után ([[003-firebase-auth-settings]] TODO) az RTDB-szinkron az egyetlen forrás — de az elhasal (#1) → **minden oldalbetöltés 9000-re esik vissza**. A redirect-es login = teljes oldalbetöltés → innen a „login után 9000".

### 1.3 `[3]` A MainMenu login eldobja az anonim fiókot

| Komponens | Hívás | Következmény |
|---|---|---|
| `MainMenu.tsx` `handleLogin` | `signInWithGoogle()` | **új uid**, a régi anonim uid + kredit árván marad |
| `SettingsScreen.tsx` `handleGoogleLogin` | `linkAnonymousToGoogle()` ha anonim | **megőrzi** az uid-et |

A két gomb más viselkedésű — ez a bug egyik gyökere.

### 1.4 `[4]` A redirect flow nem tud visszatérni

A `getRedirectResult` egy `https://<authDomain>/__/auth/iframe` **cross-origin iframe**-ből olvassa a credentialt. Ezt:

- (a) a `vite.config.ts` `Cross-Origin-Embedder-Policy: require-corp` headere **blokkolja**;
- (b) a böngésző **storage-particionálása** elvágja (az iframe partícionált tárolót lát, nem azt, amibe a handler írt).

A hibát a `checkRedirectResult` `catch { return null }` **elnyeli** → megkülönbözhetetlen a „nem volt redirect" esettől → `setUser(null)` → **uid `null`**.

### 1.5 `[5]` StrictMode dupla-init race

`index.tsx` `<React.StrictMode>` miatt az `App.tsx` auth-effectje kétszer fut, saját **closure-beli** `anonInit` / `redirectCheckDone` változókkal. A 2. példány `getRedirectResult`-ja `null`-t kap (az 1. már elfogyasztotta) → `signInAnonymous()`-t hív a frissen belépett Google user **fölé**, új anonim uid-et létrehozva.

Ráadásul az `anonInit = true` a `try` **ELŐTT** áll be → ha a `signInAnonymous` dob, **soha nincs újrapróbálkozás**, az uid örökre `null` marad.

### 1.6 `[6]` Deploy-konfigurációs hiányok

- `firebase.json`-ban nincs `"database"` szekció → a rules soha nem lett deployolva CLI-ből.
- `database.rules.json` a **rossz, Phase-2** szabályokat tartalmazza (`wallet` és `inventory` → `".write": false`), miközben a kliens ír ezekre a `useShopStore.checkout` / `buyCredits` / `resetShop`-ból.
- `.github/workflows/deploy.yml` `Build for GitHub Pages` step `env:` blokkja **csak** `VITE_DEBUG_MODE`-ot tartalmaz. A repo variables mind a 8 `VITE_FIREBASE_*` kulcsra be vannak állítva, de a GitHub Actions a `vars`-t **nem** teszi automatikusan env-be — expliciten kell hivatkozni `${{ vars.VITE_FIREBASE_* }}` formában. **Ez a GH Pages-es `auth/invalid-api-key` teljes oka.**
- Nincs Firebase Hosting site provisionálva.

### 1.7 Továbbfejlesztések (a terv során merültek fel)

**L. Device-based guest identitás:** A Google bejelentkezés linkelése megőrzi az uid-et, de kijelentkezéskor az anonim session megsemmisül → új anonim UID → elvész a guest adat. A localStorage UUID (`deviceId`) stabil azonosítót ad.

**M. `subscribeUser` retry:** Az `onValue` WebSocket kapcsolat nem mindig kapja meg időben az auth tokent → `permission_denied`. A retry mechanizmus (1s, 2s, 4s, 8s backoff) ezt hidalja át. Kijelentkezéskor az `unsubUser()` cleanup megakadályozza a retry-cascade-ot.

**N. SettingsScreen UI:** A displayName nem jelent meg Google linkelés után, mert `authUser.displayName` null volt. Az account section vertical stack layout-ra váltott, Custom Select komponens a zenékhez.

**O. Guest→Google adatmigráció:** Guest adatok (`users/{deviceId}`) átmásolása a Google user alá (`users/{googleUid}`) belépéskor, `rtdbKey` store mező (guest = deviceId, authenticated = googleUid).

**P. DeviceId rotáció:** Migráció után új UUID generálása, hogy a régi deviceId többé ne legyen használható — megakadályozza a kredit duplikációt.

---

## 2. Fájlstruktúra

### Új fájlok
```
src/firebase/authBootstrap.ts         # modul-szintű auth bootstrap singleton
database.rules.json                   # DEPLOYOLT RTDB rules (Phase-1, kommentmentes)
security.rules.json                   # dokumentált forrás (kommentekkel) + generáló one-liner
.env.example                          # dokumentált env változók (003-as terv nyitott TODO-ja)
src/firebase/deviceId.ts              # device-alapú guest azonosító (UUID + rotateDeviceId)
src/components/ui/CustomSelect.tsx    # custom dropdown komponens (Settings zenékhez)
src/components/ui/CustomSelect.module.css
```

### Módosuló fájlok
```
src/firebase/auth.ts                              # startGoogleAuth + checkRedirectResult({user,error}) + getAuthErrorMessage
src/firebase/userData.ts                          # ensureDeviceMap, ensureUserNode(deviceId), subscribeUser retry,
                                                  #   migrateGuestData(deviceId, targetUid)
src/firebase/authBootstrap.ts                     # deviceId integráció, device_map, unsubscribe cleanup,
                                                  #   migrateGuestData hívás, rotateDeviceId Google belépéskor
src/state/useAuthStore.ts                         # authError, deviceId, setDisplayName, rtdbKey, setRtdbKey, setDeviceId
src/state/useShopStore.ts                         # credits: 0 + creditsLoaded + rtdbKey RTDB (deviceId→rtdbKey)
src/App.tsx                                       # startAuthBootstrap(handleUserData), deviceId→rtdbKey, displayName sync
src/components/screens/MainMenu.tsx               # startGoogleAuth + hibasáv
src/components/screens/SettingsScreen.tsx         # startGoogleAuth + deviceId→rtdbKey + DisplayName + layout + CustomSelect
src/components/screens/SettingsScreen.module.css  # vertical stack layout (accountSection)
src/components/shop/CreditBalance.tsx             # creditsLoaded === false → "—"
src/components/shop/ShopScreen.tsx                # creditsLoaded === false → "—"
src/services/faceRecognition.ts                   # futásidejű solutionPath
vite.config.ts                                    # COOP/COEP dev headerek törlése; mediapipe alias vizsgálat
firebase.json                                     # "database" szekció
.github/workflows/deploy.yml                      # 8 db VITE_FIREBASE_* env
.github/workflows/deploy-firebase.yml             # --only hosting,database
src/i18n/locales/{en,hu,fr,de,es}/translation.json  # login.error.* + settings.logout + uidCopied
index.html                                        # <base href="__BASE_HREF__" />
database.rules.json                               # device_map + $key==auth.uid + device_map törlés engedély
security.rules.json                               # ugyanaz kommentekkel (GUEST DATA MIGRATION szekció)
```

---

## 3. Megvalósítási lépések

### 3.A RTDB Security Rules deploy (első és legfontosabb)

**`database.rules.json` (Phase-1 — kliens-írható `wallet`/`inventory`, device_map, $key==auth.uid):**

```json
{
  "rules": {
    "device_map": {
      "$deviceId": {
        ".write": "auth != null && (newData.val() == auth.uid || data.val() == auth.uid)",
        ".read": false
      }
    },
    "users": {
      "$key": {
        ".read": "auth != null && (root.child('device_map').child($key).val() == auth.uid || $key == auth.uid)",
        "profile":   { ".write": "auth != null && (root.child('device_map').child($key).val() == auth.uid || $key == auth.uid)" },
        "settings":  { ".write": "auth != null && (root.child('device_map').child($key).val() == auth.uid || $key == auth.uid)" },
        "wallet":    { ".write": "auth != null && (root.child('device_map').child($key).val() == auth.uid || $key == auth.uid)" },
        "inventory": { ".write": "auth != null && (root.child('device_map').child($key).val() == auth.uid || $key == auth.uid)" },
        "stats":     { ".write": "auth != null && (root.child('device_map').child($key).val() == auth.uid || $key == auth.uid)" }
      }
    }
  }
}
```

- A `$key == auth.uid` feltétel engedi a direkt UID-alapú hozzáférést (migráció után).
- `device_map` write: `data.val() == auth.uid` engedi a törlést (migrációkor).
- `security.rules.json` marad a **dokumentált forrás** (kommentekkel + GUEST DATA MIGRATION szekció).
- `deploy-firebase.yml`: `npx firebase-tools deploy --only hosting,database`

### 3.B Firebase Hosting bekapcsolása

1. Console → **Hosting → Get started** (default site: `realtimespacetravel-e74e3.web.app`). A `firebase.json` `hosting` szekciója és a `.firebaserc` (`realtimespacetravel-e74e3`) **már készen áll**.
2. A korábbi GitHub Actions log ellenőrzése: a deploy azért bukott-e, mert nem volt site.
3. Console → **Authentication → Settings → Authorized domains**: `localhost`, `realtimespacetravel-e74e3.web.app`, `exphoenee.github.io`.

### 3.C Egységes `startGoogleAuth()`

Váltja ki a mostani `signInWithGoogle` + `linkAnonymousToGoogle` párost — a `src/firebase/auth.ts`-ben implementálva.

### 3.D `src/firebase/authBootstrap.ts` — bootstrap singleton

Modul-szintű `started` / `anonInit` / `redirectCheckDone` flagek. Google auth után:
1. `ensureDeviceMap` (mapping)
2. **`migrateGuestData`** (ha nem anonim)
3. Sikeres migráció → **`rotateDeviceId()`** + `store.setDeviceId()`
4. `ensureUserNode` (`rtdbKey`-val)
5. `subscribeUser` (`rtdbKey`-val)

### 3.E Hibák felszínre hozása

- `checkRedirectResult` → `{ user, error }` (nem nyel el)
- `useAuthStore` → `authError: string | null` + `setAuthError`
- `getAuthErrorMessage` i18n-kulcsok minden auth/RTDB hibaágra
- `clearUser` bekötve kijelentkezés gombra

### 3.F RTDB = egyetlen kredit-forrás

- `credits: 0` + `creditsLoaded`; kredit 9000 a `getDefaultUserNode`-ban
- `handleUserData`: `data.wallet?.credits ?? 0`, `mergeInventory` fallback `[]`/`BASE_EXOPLANET_IDS`
- `profile.displayName` szinkron → `setDisplayName`
- Kreditkijelzők: `creditsLoaded === false` → `—`

### 3.G Dev headerek + deploy konfigurációk

- `server.headers` törölve; `.github/workflows/deploy.yml` env blokk; `.env.example`

### 3.H MediaPipe 404

- `new URL("mediapipe/face_detection", document.baseURI).href` futásidejű feloldás

### 3.I Adatmentés: a 7804 kredit (egyszeri kézi lépés)

- Export, árva uid azonosítás, kézi RTDB írás, fiók törlés

### 3.L Device-based guest identitás

```ts
// src/firebase/deviceId.ts
getDeviceId() → localStorage UUID (első látogatáskor generálva)
```

### 3.M `subscribeUser` retry + cleanup

Exponenciális backoff (1s, 2s, 4s, 8s), `cancelled` flag, cleanup kijelentkezéskor.

### 3.N SettingsScreen UI

DisplayName szinkron, vertical stack layout, CustomSelect komponens.

### 3.O Guest→Google adatmigráció

```ts
// src/firebase/userData.ts
migrateGuestData(deviceId, targetUid):
  1. Olvas: get(users/{deviceId})
  2. Ha létezik → update(users/{targetUid}, 5 child) (update-tel, nem set-tel!)
     - Kredit: guest + google (összeadva)
     - Inventory: egyesítve
     - Stats: max
  3. update(users/{deviceId}, 5 child → null) (törlés)
  4. set(device_map/{deviceId}, null) (törlés)
  5. return true (volt guest adat)
```

**Flow `authBootstrap.ts`-ben:**
```ts
const deviceId = getDeviceId();
await ensureDeviceMap(deviceId, user.uid);

if (!user.isAnonymous) {
  const migrated = await migrateGuestData(deviceId, user.uid);
  if (migrated) {
    rotateDeviceId();          // új UUID a localStorage-ba
    setDeviceId(newDeviceId);  // store frissítés
  }
}

const rtdbKey = useAuthStore.getState().rtdbKey;
await ensureUserNode(user, "google", rtdbKey);
unsubUser = subscribeUser(rtdbKey, handleUserData);
```

### 3.P DeviceId rotáció (kredit duplikáció védelem)

**Probléma:** Migráció után a guest deviceId ugyanaz maradt a localStorage-ban. Kijelentkezés után új guest session ugyanazzal a deviceId-val → `ensureUserNode` új krediteket ad → új Google belépés → újabb migráció → kreditek duplikálódnak.

**Megoldás:** `rotateDeviceId()` minden sikeres migráció után:
```ts
// src/firebase/deviceId.ts
rotateDeviceId(): string {
  const newId = crypto.randomUUID();
  localStorage.setItem(DEVICE_ID_KEY, newId);
  return newId;
}
```

**Eredmény:**
```
1. Guest: 2000 kredit → Google belépés → migráció → Google: +2000 ✅
2. deviceId rotáció: "abc" → "xyz"
3. Kijelentkezés → új guest → deviceId = "xyz" (új, tiszta)
4. ensureUserNode("xyz") → új alapadatok (nincs régi guest adat)
5. Ha újra belép: migrateGuestData("xyz", uid) → nincs adat → false
6. Nincs duplikáció! ✅
```

---

## 4. Függőségek

- **Előfeltétel:** [[003-firebase-auth-settings]] Fázis 1 (Firebase projekt, Auth providerek, RTDB, `firebase/config.ts`, `auth.ts`, `userData.ts`, `useAuthStore`) — ezek megvannak, ez a terv **javítja** őket.
- **Kézi (nem kódolható) lépések:** Firebase Console (Hosting provisioning, Authorized domains, adatmentés), GitHub repo variables (már beállítva).
- **Blokkolja:** [[005-ingame-shop-strapi-stripe]] — a kredit **írási** útja (Stripe → CF → `wallet.credits`) csak működő auth + működő RTDB-olvasás felett építhető.

### Mely [[003-firebase-auth-settings]] TODO-k pipálhatók ki utána

| 003-as TODO | Állapot e terv után |
|---|---|
| **Security Rules** (`wallet`/`inventory` szerver-only; `settings`/`stats` user-írható) | **Részben** — a Phase-1 (kliens-írható) rules deployolva; a Phase-2 (`".write": false`) továbbra is nyitva marad a Cloud Functionökig |
| `useAuthStore` + anonymous auto-login + `onAuthStateChanged` | **Kipipálható** (a bootstrap singletonnal stabil) |
| `ensureUserNode` + `subscribeUser` → store-feltöltés | **Kipipálható** (a `subscribeUser` kikerül a `try`-ból, a `handleUserData` mérvadó) |
| Google-belépés + Anonymous→Google **linkelés** | **Kipipálható** (`startGoogleAuth` mindkét gombon) |
| env változók dokumentálása (`.env.example`) | **Kipipálható** |
| `settings.activeShipId` validáció az `inventory.ships` ellen | **Nem** — külön feladat marad |
| Cloud Function `awardWage`, Stripe híd | **Nem** — [[005-ingame-shop-strapi-stripe]] |

---

## 5. i18n

| Kulcs | Tartalom (hu) |
|---|---|
| `login.error.popupBlocked` | „A böngésző letiltotta a bejelentkező ablakot. Engedélyezd a felugró ablakokat, vagy próbáld újra." |
| `login.error.alreadyInUse` | „Ez a Google-fiók már egy másik játékoshoz tartozik. A vendég-haladatod (kredit, birtokolt tartalmak) **nem vihető át**." |
| `login.error.accountExists` | „Ehhez az e-mail-címhez már tartozik fiók másik bejelentkezési módszerrel." |
| `login.error.cancelled` | „A bejelentkezést megszakítottad." |
| `login.error.network` | „Hálózati hiba a bejelentkezés közben. Ellenőrizd a kapcsolatot." |
| `login.error.generic` | „A bejelentkezés nem sikerült. Próbáld újra később." |
| `settings.logout` | „Kijelentkezés" |
| `settings.uidCopied` | „Másolva!" |

> **Teljes paritás kötelező** mind az 5 nyelven ([[000-i18n-nyelvesites]] konvenció).

---

## 6. Kockázatok / figyelmeztetések

- **COOP eltávolítás vs. cross-origin isolation:** a popup-flow-hoz a `Cross-Origin-Opener-Policy: same-origin` dev header eltávolítása **kötelező**.
- **Phase-1 rules = kredit-hamisítás lehetséges:** a `wallet`/`inventory` kliens-írható. **Tudatos, átmeneti** kompromisszum.
- **GitHub Pages korlát:** statikus hoszt, nincs proxy → **nem tud** same-origin `/__/auth/*` handlert adni.
- **`creditsLoaded` és a shop UX:** amíg `false`, a vásárlás gombok legyenek letiltva.
- **Adatmentés = destruktív lépés:** Export **előbb**, törlés **utoljára**.
- **Stale bundle probléma:** Vite HMR néha nem frissít minden modult. Ha a konzolban `users/{firebaseUid}` path-ek jelennek meg (nem `users/{UUID}`), akkor a böngészőben régi JavaScript fut. Megoldás: **Ctrl+Shift+R** (hard reload).
- **`migrateGuestData` `update`-ot használ, nem `set`-et:** A `set` a `users/$key` szülőre írna, ahol nincs `.write` szabály → PERMISSION_DENIED (ugyanaz a bug, mint az eredeti). Az `update` gyerekenként értékelődik ki.
- **`ensureDeviceMap` felesleges Google user-eknél:** A migráció után a felhasználó `$key == auth.uid` alatt fér hozzá az adatokhoz, a `device_map` nem kell. De a hívás ártalmatlan — kijelentkezéskor felülíródik az új anonim UID-val.

---

## 7. Ellenőrzési terv

1. `npx firebase-tools deploy --only database`, majd Console → **Rules Playground**: `users/<uid>/wallet` write, `auth.uid = $uid` → **allow**.
2. `npm run dev` → DevTools Console: **nincs** `PERMISSION_DENIED`.
3. **Friss inkognitó ablak** → a deviceId nem változik oldalfrissítés után.
4. **Vásárlás a shopban** → a kredit csökken → **F5** → a csökkentett érték marad.
5. **Linkelés:** anonim deviceId + kredit feljegyzése → Settings → Login → Google → **ugyanaz a kredit**, displayName megjelenik. **Ugyanez a MainMenu login gombbal is**.
6. **Logout** → ugyanazzal a Google-fiókkal újra be → a kredit és az inventory megmarad.
7. **Redirect fallback:** popup-blokkoló bekapcsolva → a login redirectre vált.
8. **Hibaút:** `".write": false` a `wallet`-re → a login működjön, shop írási hiba látható üzenet.
9. **MediaPipe:** mindkét deployon induljon el az arcfelismerés **404 nélkül**.
10. `npm run test` + `npm run build` + `npm run build:gh-pages`.
11. **DeviceId perzisztencia:** kijelentkezés → F5 → ugyanaz a deviceId a Settings-ben.
12. **Custom Select:** billentyűzet navigáció (Enter, Escape, ArrowUp/Down) működik.
13. **Kredit duplikáció teszt:** guest vásárol → Google login → kijelentkezés → új guest vásárol → Google login → **nincs duplikáció** (a deviceId rotált, a második guest friss adatokat hoz).
14. **Migráció után deviceId rotáció:** a Settings-ben a deviceId megváltozik Google login után.

---

## 8. Becsült ráfordítás

| Feladat | Nagyságrend |
|---------|-------------|
| A. Rules + `firebase.json` + workflow deploy | ~1–2 óra |
| B. Hosting bekapcsolás + authorized domains | ~30 perc (Console) |
| C. `startGoogleAuth` + a két gomb egységesítése | ~2–3 óra |
| D. `authBootstrap.ts` singleton + `subscribeUser` kimentése | ~2–3 óra |
| E. Hibakezelés (`authError`, hibasávok) | ~1–2 óra |
| F. `creditsLoaded` + `getDefaultUserNode` + `handleUserData` | ~2–3 óra |
| G. Dev headerek + GH Pages env + `.env.example` | ~1 óra |
| H. MediaPipe base path + alias vizsgálat | ~1–2 óra |
| I. Adatmentés (kézi) | ~30 perc |
| J. i18n (kulcsok × 5 nyelv) | ~1 óra |
| K. Ellenőrzés (14 pont, 2 deploy) | ~2 óra |
| L. Device-based guest identitás | ~3–4 óra |
| M. Retry + cleanup | ~1–2 óra |
| N. SettingsScreen UI (displayName, layout, CustomSelect) | ~2–3 óra |
| O. Guest→Google adatmigráció | ~3–4 óra |
| P. DeviceId rotáció (kredit duplikáció védelem) | ~1 óra |

**Összesen:** ~4 fejlesztői nap.

**Kész definíció:** a játékos névtelenül azonnal játszik; a Google bejelentkezés **ugyanazt a deviceId-t** tartja meg, a kredit és a birtoklás az **RTDB-ből** jön, oldalfrissítés és kijelentkezés után is; nincs `PERMISSION_DENIED` és nincs `auth/invalid-api-key`; az arcfelismerés **mindkét** deployon 404 nélkül indul; minden auth-hiba **látható** üzenetként jelenik meg mind az 5 nyelven; a displayName megjelenik a Settings-ben; a zenék dropdown Custom Select-komponenssel működik; a guest adat **migrálódik Google user alá** belépéskor; a **deviceId rotáció** megakadályozza a kredit duplikációt.

---

## 9. Kapcsolódó tervek

- [[003-firebase-auth-settings]] — **közvetlen előfeltétel.** Phase-2 rules és Cloud Functionök ott maradnak.
- [[005-ingame-shop-strapi-stripe]] — **erre a tervre épül:** a kredit írási útja (Stripe → Cloud Function → `wallet.credits`) csak működő auth + RTDB felett építhető.
- [[002-ingame-shop-frontend]] — a `useShopStore` kredit/birtoklás modellje itt változik.
- [[000-i18n-nyelvesites]] — a `login.error.*` és `settings.logout`/`uidCopied` kulcsok mind az 5 nyelven.
- [[006-editable-displayname]] — a store `setNickname`/`setDisplayName` mechanizmus erre épül.
- [[009-firebase-identity-split-bugfix]] — **az itt bevezetett O. és P. blokk hibáinak javítása.** A `migrateGuestData` `catch`-ágán lévő `setRtdbKey(deviceId)` „non-fatal fallback" (`authBootstrap.ts:128-132`) élesben **identitás-szétválást** okozott: ugyanaz a Google fiók két RTDB node-ot kapott (`users/{uid}` és `users/{deviceId}`), külön kredittel. A kiváltó crash a `userData.ts:176` bal oldali `?.` nélküli `guestData.wallet.credits = …` írás volt. A 009-es terv: a fallback törlése, az `rtdbKey` **derivált értékké** tétele (a `setRtdbKey` action megszűnik), null-safe + atomikus + idempotens `migrateGuestData`, a `deviceId`-rotáció (**P. blokk**) kivezetése a migrációs útból, valamint az `ensureUserNode` `createdAt`-javítása.
- [[021-stripe-fraud-defense]] — az itt bevezetett **Phase-1 rules** (`database.rules.json`, kliens-írható `wallet`, `device_map` alapú `rtdbKey`) **additív szigorítása**: `wallet.credits` írásonkénti növekmény-limit + `lastTopUpAt` ütemkorlát, valamint új `credit_claims/$sessionId` node. A `device_map` logika változatlan marad.
