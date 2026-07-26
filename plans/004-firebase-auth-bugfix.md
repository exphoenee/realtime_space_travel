---
title: "Firebase Google bejelentkezés bugfix – uid-megőrzés, RTDB rules, deploy"
slug: 004-firebase-auth-bugfix
type: plan
category: auth
status: not-started
implemented: false
implemented_at: null
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
tags:
  - firebase
  - auth
  - rtdb
  - bugfix
  - security-rules
  - deploy
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

---

## ✅ Haladás (TODO)

> Jelölés: `[ ]` hátravan · `[~]` folyamatban · `[x]` kész.

**A. RTDB Security Rules deploy (ez oldja fel a PERMISSION_DENIED-et — ELSŐ lépés)**
- [ ] `security.rules.json` — dokumentált (kommentelt) forrás létrehozása/frissítése a Phase-1 szabályokkal + a generáló one-liner a fejlécbe
- [ ] `database.rules.json` — a Phase-1 (kommentmentes) szabályok: `profile`/`settings`/`wallet`/`inventory`/`stats` → `auth != null && auth.uid == $uid`
- [ ] `firebase.json` → `"database": { "rules": "database.rules.json" }` szekció
- [ ] `.github/workflows/deploy-firebase.yml` → `npx firebase-tools deploy --only hosting,database`
- [ ] Kézi deploy: `npx firebase-tools deploy --only database` + Rules Playground ellenőrzés

**B. Firebase Hosting bekapcsolása**
- [ ] Console → Hosting → Get started (default site: `realtimespacetravel-e74e3.web.app`)
- [ ] Console → Authentication → Settings → Authorized domains: `localhost`, `realtimespacetravel-e74e3.web.app`, `exphoenee.github.io`
- [ ] A korábbi GitHub Actions deploy-log ellenőrzése (a bukás oka a hiányzó site volt-e)

**C. Egységes `startGoogleAuth()` (a #3 hiba gyökere)**
- [ ] `src/firebase/auth.ts` → `startGoogleAuth()` (popup-first, link ha anonim, redirect fallback, `credential-already-in-use` ág)
- [ ] `MainMenu.tsx` **és** `SettingsScreen.tsx` ugyanezt hívja (a `signInWithGoogle` + `linkAnonymousToGoogle` páros kivezetése)
- [ ] `credential-already-in-use` esethez felhasználói üzenet (a vendég-kredit nem vihető át)

**D. Auth bootstrap singleton (StrictMode dupla-init race)**
- [ ] Új `src/firebase/authBootstrap.ts` — modul-szintű `started` / `anonInit` / `redirectCheckDone` flagek
- [ ] `signInAnonymous` csak `auth.currentUser == null` esetén; hibánál `anonInit = false` (újrapróbálható)
- [ ] `subscribeUser` **kikerül** az `ensureUserNode` `try`-jából — mindig lefut
- [ ] `App.tsx` effect már csak `startAuthBootstrap(handleUserData)`-t hív

**E. Hibák felszínre hozása (ez rejtette el az egész bugot)**
- [ ] `checkRedirectResult` ne nyelje el a hibát → `{ user, error }` visszatérés
- [ ] `useAuthStore` → `authError: string | null` + `setAuthError`
- [ ] `getAuthErrorMessage` bekötése minden auth/RTDB hibaágra (`console.error` **mellé**, nem helyette)
- [ ] `SettingsScreen` hibasáv újrahasznosítása + hibasáv a `MainMenu`-ben
- [ ] `useAuthStore.clearUser` holt kód felszámolása: Kijelentkezés gomb bekötése vagy törlés

**F. RTDB = egyetlen kredit-forrás**
- [ ] `useShopStore` → `credits: 0` induló érték (lokális debug-elágazás törlése) + `creditsLoaded: boolean`
- [ ] `getDefaultUserNode` → debug 9000 **ide** + `exoplanets: BASE_EXOPLANET_IDS` (külön bug: ma üres inventory-val jön létre a node)
- [ ] `handleUserData` → RTDB mérvadó hiányzó ág esetén is (`data.wallet?.credits ?? 0`, `mergeInventory` → `[]` / `BASE_EXOPLANET_IDS`)
- [ ] Kreditkijelzők (`SettingsScreen`, `CreditBalance`, `ShopScreen`) `creditsLoaded === false` → `—`

**G. Dev headerek + deploy konfigurációk**
- [ ] `vite.config.ts` → a `Cross-Origin-Opener-Policy` + `Cross-Origin-Embedder-Policy` dev headerek **törlése**
- [ ] `.github/workflows/deploy.yml` → mind a 8 `${{ vars.VITE_FIREBASE_* }}` sor a `Build for GitHub Pages` step `env:` blokkjába
- [ ] `.env.example` létrehozása a dokumentált env változókkal

**H. MediaPipe 404**
- [ ] `faceRecognition.ts` → futásidejű `solutionPath` (`new URL(..., document.baseURI)`)
- [ ] `index.html` `<script src="mediapipe/...">` + `__BASE_HREF__` viszony ellenőrzése mindkét base path-on
- [ ] Ellenőrzés: a GH Pages-re nem a `build:firebase` (base `/`) kimenete került-e ki
- [ ] `vite.config.ts` MediaPipe **alias** vizsgálata: prodban is a stub épül-e be → ha igen, az alias a `test` szekcióba költözik

**I. Adatmentés (egyszeri, kézi — az A–D deploy UTÁN)**
- [ ] `users/hJ9MWfvxZKXP6cj8FrIsPKmIDnr1` export JSON (ha létezik)
- [ ] Auth → Users: az árva Google uid azonosítása (gyanús: `UkJoNld9AjavJ1INwtCyY3lRT1P2`)
- [ ] `users/<google-uid>/wallet/credits = 7804` + inventory átmásolás
- [ ] Az árva anonim fiók törlése (Auth + RTDB node)

**J. i18n**
- [ ] `login.error.*` kulcsok mind az 5 nyelven (en, hu, fr, de, es)
- [ ] Kredit „betöltés alatt" jelölés (`settings.creditsLoading`) mind az 5 nyelven

**K. Ellenőrzés**
- [ ] A 10 pontos ellenőrzési terv (7. szekció) végigfuttatása
- [ ] `npm run test` + `npm run build` + `npm run build:gh-pages`

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

**A javítás sorrendje kötött:** A (rules) → B (hosting) → C/D/E (kliens auth) → F (kredit-forrás) → G (deploy) → H (mediapipe) → I (adatmentés).

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

---

## 2. Fájlstruktúra

### Új fájlok
```
src/firebase/authBootstrap.ts     # modul-szintű auth bootstrap singleton
database.rules.json               # DEPLOYOLT RTDB rules (Phase-1, kommentmentes)
security.rules.json               # dokumentált forrás (kommentekkel) + generáló one-liner
.env.example                      # dokumentált env változók (003-as terv nyitott TODO-ja)
```

### Módosuló fájlok
```
src/firebase/auth.ts                        # startGoogleAuth + checkRedirectResult({user,error}) + getAuthErrorMessage
src/firebase/userData.ts                    # getDefaultUserNode: debug kredit + BASE_EXOPLANET_IDS
src/state/useAuthStore.ts                   # authError + setAuthError; clearUser bekötése/törlése
src/state/useShopStore.ts                   # credits: 0 + creditsLoaded
src/App.tsx                                 # az auth effect → startAuthBootstrap(handleUserData)
src/components/screens/MainMenu.tsx         # startGoogleAuth + hibasáv
src/components/screens/SettingsScreen.tsx   # startGoogleAuth + hibasáv + creditsLoaded kijelzés
src/components/shop/CreditBalance.tsx       # creditsLoaded === false → "—"
src/components/shop/ShopScreen.tsx          # creditsLoaded === false → "—"
src/services/faceRecognition.ts             # futásidejű solutionPath
vite.config.ts                              # COOP/COEP dev headerek törlése; mediapipe alias vizsgálat
firebase.json                               # "database" szekció
.github/workflows/deploy.yml                # 8 db VITE_FIREBASE_* env
.github/workflows/deploy-firebase.yml       # --only hosting,database
src/i18n/locales/{en,hu,fr,de,es}/translation.json  # login.error.* + settings.creditsLoading
```

---

## 3. Megvalósítási lépések

### 3.A RTDB Security Rules deploy (első és legfontosabb)

**`database.rules.json` (Phase-1 — kliens-írható `wallet`/`inventory`):**

```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read":  "auth != null && auth.uid == $uid",
        "profile":   { ".write": "auth != null && auth.uid == $uid" },
        "settings":  { ".write": "auth != null && auth.uid == $uid" },
        "wallet":    { ".write": "auth != null && auth.uid == $uid" },
        "inventory": { ".write": "auth != null && auth.uid == $uid" },
        "stats":     { ".write": "auth != null && auth.uid == $uid" }
      }
    }
  }
}
```

- `security.rules.json` marad a **dokumentált forrás** (kommentekkel); a fejlécébe kerüljön be, hogy a `database.rules.json` a **generált párja**, a generáló one-linerrel együtt.
- `firebase.json`:
  ```json
  "database": { "rules": "database.rules.json" }
  ```
- `deploy-firebase.yml`: `npx firebase-tools deploy --only hosting,database`
- **Phase-2** (`wallet`/`inventory` → `".write": false`) csak az `awardWage` / `purchaseWithCredits` Cloud Functionök megléte után élesíthető — ez a [[003-firebase-auth-settings]] „Kredit-út" TODO-ja, nem ezé a tervé.

### 3.B Firebase Hosting bekapcsolása

1. Console → **Hosting → Get started** (default site: `realtimespacetravel-e74e3.web.app`). A `firebase.json` `hosting` szekciója és a `.firebaserc` (`realtimespacetravel-e74e3`) **már készen áll**.
2. A korábbi GitHub Actions log ellenőrzése: a deploy azért bukott-e, mert nem volt site.
3. Console → **Authentication → Settings → Authorized domains**: `localhost`, `realtimespacetravel-e74e3.web.app`, `exphoenee.github.io`.

### 3.C Egységes `startGoogleAuth()`

Váltja ki a mostani `signInWithGoogle` + `linkAnonymousToGoogle` párost:

```ts
export const startGoogleAuth = async (): Promise<User | null> => {
  const auth = getFirebaseAuth();
  const provider = new GoogleAuthProvider();
  const current = auth.currentUser;
  try {
    // Anonim → LINK: az uid és az összes RTDB adat megmarad
    const cred = current?.isAnonymous
      ? await linkWithPopup(current, provider)
      : await signInWithPopup(auth, provider);
    return cred.user;
  } catch (err) {
    const code = (err as { code?: string }).code;
    // A Google-fiók már létezik másik uid alatt → belépés abba (a vendég-haladat nem vihető át)
    if (code === "auth/credential-already-in-use") {
      const credential = GoogleAuthProvider.credentialFromError(err as AuthError);
      if (credential) return (await signInWithCredential(auth, credential)).user;
    }
    // Popup blokkolva / nem támogatott → redirect fallback (a lap elnavigál)
    if (code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment") {
      current?.isAnonymous
        ? await linkWithRedirect(current, provider)
        : await signInWithRedirect(auth, provider);
      return null;
    }
    throw err;
  }
};
```

- A **`MainMenu.tsx` ÉS a `SettingsScreen.tsx` ugyanezt hívja** — ez a `[3]` hiba gyökere.
- A popup-út **szinkron** eredményt ad, nincs oldalbetöltés → ettől a `[2]` tünet („login után 9000") már önmagában eltűnik.
- `credential-already-in-use` → i18n üzenet: a vendég-kredit nem vihető át.

### 3.D `src/firebase/authBootstrap.ts` — bootstrap singleton

```ts
let started = false;
let anonInit = false;
let redirectCheckDone = false;
let unsubAuth: (() => void) | null = null;
let unsubUser: (() => void) | null = null;

export const startAuthBootstrap = (handleUserData: (data: UserNode | null) => void) => {
  if (started) return;           // StrictMode dupla-mount védelem (MODUL-scope!)
  started = true;
  // ... checkRedirectResult → onAuthChange → (currentUser == null) ? signInAnonymous : ...
};
```

- `signInAnonymous` **csak** akkor, ha `auth.currentUser == null`.
- Hiba esetén `anonInit = false` (újrapróbálkozás lehetősége) — az `anonInit = true` **soha** ne a `try` előtt álljon be.
- A `subscribeUser` kerüljön ki a `try`-ból:

```ts
try {
  await ensureUserNode(user, user.isAnonymous ? "anonymous" : "google");
} catch (err) {
  setAuthError(getAuthErrorMessage(err));
}
unsubUser = subscribeUser(user.uid, handleUserData); // MINDIG lefut
```

- Az `App.tsx` effect csak ezt hívja; a `handleUserData` **marad** az `App.tsx`-ben.

### 3.E Hibák felszínre hozása

- `checkRedirectResult` ne nyelje el a hibát → `{ user: User | null; error: unknown | null }`.
- `useAuthStore` → új `authError: string | null` + `setAuthError`.
- `getAuthErrorMessage` i18n-kulcsokat ad (`login.error.*`) — minden hibaágon `console.error` **mellé** `setAuthError` is.
- A `SettingsScreen` meglévő `loginError` sávja újrahasznosítható; a `MainMenu`-ben új sáv kell.
- `useAuthStore.clearUser` ma **holt kód** (soha nincs hívva) → kössük be a Kijelentkezés gombra a `SettingsScreen` fiók-blokkjában, vagy töröljük.

### 3.F RTDB = egyetlen kredit-forrás

- `useShopStore` → `credits: 0` induló érték (az `initialCredits` debug-elágazás **törlése**) + új `creditsLoaded: boolean`. A `resetShop` debug-elágazása maradhat.
- `getDefaultUserNode` → **ide** kerül a debug 9000 és az alap exobolygó-készlet:
  ```ts
  wallet: { credits: DEBUG_MODE ? DEBUG_STARTING_CREDITS : STARTING_CREDITS },
  inventory: {
    ships: {},
    music: {},
    exoplanets: Object.fromEntries(BASE_EXOPLANET_IDS.map((id) => [id, true])),
  },
  ```
  > **Ez külön bug:** ma a node üres `exoplanets`-szel jön létre, így az első sikeres RTDB-szinkronnál a játékos **elveszti a 3 alap exobolygóját**.
- `handleUserData` → az RTDB legyen mérvadó akkor is, ha hiányzik az ág. **Az RTDB nem tárol üres objektumot**, tehát friss usernél a `data.inventory` `undefined`:
  - `data.wallet?.credits ?? 0`
  - `mergeInventory` hiányzó ág esetén `[]`-t adjon vissza (exobolygóknál `BASE_EXOPLANET_IDS`) — **ne** a lokális értéket tartsa meg (ma: `if (!rtdbItems) return localItems;`)
  - a `creditsLoaded` **itt** áll `true`-ra
- Kreditkijelzők (`SettingsScreen`, `CreditBalance`, `ShopScreen`): `creditsLoaded === false` → `—`, **ne** `0`.

### 3.G Dev headerek + deploy konfigurációk

- `vite.config.ts` → a `server.headers` **teljes törlése**:
  - a `Cross-Origin-Opener-Policy: same-origin` elvágja a `window.opener`-t → **megöli a popupot**;
  - a `Cross-Origin-Embedder-Policy: require-corp` **blokkolja az auth iframe-et**;
  - a prod (`firebase.json` headers) csak `**/*.wasm`-ra küldi őket, tehát a dokumentum ott sem cross-origin isolated — a **dev feleslegesen volt szigorúbb a prodnál**.
- `.github/workflows/deploy.yml` → a `Build for GitHub Pages` step `env:` blokkjába mind a 8 sor, a `deploy-firebase.yml` mintájára:
  ```yaml
  env:
    VITE_DEBUG_MODE: "false"
    VITE_FIREBASE_API_KEY: ${{ vars.VITE_FIREBASE_API_KEY }}
    VITE_FIREBASE_AUTH_DOMAIN: ${{ vars.VITE_FIREBASE_AUTH_DOMAIN }}
    VITE_FIREBASE_DATABASE_URL: ${{ vars.VITE_FIREBASE_DATABASE_URL }}
    VITE_FIREBASE_PROJECT_ID: ${{ vars.VITE_FIREBASE_PROJECT_ID }}
    VITE_FIREBASE_STORAGE_BUCKET: ${{ vars.VITE_FIREBASE_STORAGE_BUCKET }}
    VITE_FIREBASE_MESSAGING_SENDER_ID: ${{ vars.VITE_FIREBASE_MESSAGING_SENDER_ID }}
    VITE_FIREBASE_APP_ID: ${{ vars.VITE_FIREBASE_APP_ID }}
    VITE_FIREBASE_MEASUREMENT_ID: ${{ vars.VITE_FIREBASE_MEASUREMENT_ID }}
  ```
- `.env.example` létrehozása a dokumentált env változókkal (a [[003-firebase-auth-settings]] nyitott TODO-ja).

### 3.H MediaPipe 404

- Az assetek megvannak: `public/mediapipe/face_detection/` (`face_detection.js`, `.binarypb`, `.tflite`, wasm).
- `src/services/faceRecognition.ts`:
  ```ts
  const solutionPath = `${import.meta.env.BASE_URL}mediapipe/face_detection`;
  ```
  Az `import.meta.env.BASE_URL` **build-időben fixálódik**, így ugyanaz a bundle nem szolgálható ki két különböző base path alól (Firebase `/`, GH Pages `/realtime_space_travel/`). A 404-es URL root-relatív volt → a `BASE_URL` `/` volt.
- **Javítás:** futásidejű feloldás
  ```ts
  const solutionPath = new URL("mediapipe/face_detection", document.baseURI).href;
  ```
  Ez összhangban van az `index.html` `<base href="__BASE_HREF__">` mechanizmusával (a build script helyettesíti be a `VITE_BASE_PATH` szerint).
- Ellenőrizendő, hogy a GH Pages-re **nem a `build:firebase`** (base `/`) kimenete került-e ki — a két workflow ugyanarra a `dist/`-re épít.
- **Külön nyitott pont:** a `vite.config.ts` a `@mediapipe/face_detection`-t **minden** buildben a teszt-stubra (`src/stubs/mediapipe-stub.ts`) aliasolja, nem csak a `test` configban. Ellenőrizendő, hogy prodban nem rontja-e el a detektort — ha igen, az alias **költözzön a `test` szekcióba**.

### 3.I Adatmentés: a 7804 kredit (egyszeri kézi lépés)

Az **A–D pont deployja UTÁN**, amikor a linkelés már megőrzi az uid-et:

1. Console → Realtime Database → `users/hJ9MWfvxZKXP6cj8FrIsPKmIDnr1` → **Export JSON**.
   *(Ha a node nem létezik, a 7804 sosem került be az RTDB-be a PERMISSION_DENIED miatt — ekkor csak a `wallet/credits` kézi beírása marad.)*
2. Authentication → Users: létrejött-e külön Google uid? (gyanús: `UkJoNld9AjavJ1INwtCyY3lRT1P2`)
3. `users/<google-uid>/wallet/credits` → `7804`, és az `inventory` ágak átmásolása az exportból.
4. Az árva anonim fiók törlése az Auth Users listából **és** a node az RTDB-ből.

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

A `getAuthErrorMessage` által visszaadott kulcsok **hiányoznak a fordításokból** — mind az 5 nyelvre (en, hu, fr, de, es) fel kell venni. Új **top-level `login`** namespace (a meglévő `mainMenu.login` string **nem** ütközik vele):

| Kulcs | Tartalom (hu) |
|---|---|
| `login.error.popupBlocked` | „A böngésző letiltotta a bejelentkező ablakot. Engedélyezd a felugró ablakokat, vagy próbáld újra." |
| `login.error.alreadyInUse` | „Ez a Google-fiók már egy másik játékoshoz tartozik. A vendég-haladatod (kredit, birtokolt tartalmak) **nem vihető át**." |
| `login.error.accountExists` | „Ehhez az e-mail-címhez már tartozik fiók másik bejelentkezési módszerrel." |
| `login.error.cancelled` | „A bejelentkezést megszakítottad." |
| `login.error.network` | „Hálózati hiba a bejelentkezés közben. Ellenőrizd a kapcsolatot." |
| `login.error.generic` | „A bejelentkezés nem sikerült. Próbáld újra később." |
| `settings.creditsLoading` | `—` / „Betöltés…" (a kredit-kijelző `creditsLoaded === false` állapota) |

> **Teljes paritás kötelező** mind az 5 nyelven ([[000-i18n-nyelvesites]] konvenció). A `settings.creditsLoading` csak akkor kell, ha a `—` helyett szöveges jelölést használunk — a kompakt kijelzőkben (`CreditBalance`) a `—` az elsődleges.

---

## 6. Kockázatok / figyelmeztetések

- **COOP eltávolítás vs. cross-origin isolation:** a popup-flow-hoz a `Cross-Origin-Opener-Policy: same-origin` dev header eltávolítása **kötelező**. Ha a jövőben `SharedArrayBuffer`/cross-origin isolation kellene a MediaPipe-hoz, az **ütközik** a popup-alapú authtal — akkor a redirect-út marad, same-origin `/__/auth/*` handlerrel Firebase Hostingon.
- **`auth/credential-already-in-use`:** ha a Google-fiók már létezik másik uid alatt, a vendég-haladat **nem vihető át automatikusan** — a felhasználót tájékoztatni kell ([[003-firebase-auth-settings]] él eset).
- **Phase-1 rules = kredit-hamisítás lehetséges:** a `wallet`/`inventory` kliens-írható. Ez **tudatos, átmeneti** kompromisszum a Cloud Functionök megjelenéséig; a Phase-2 átállás a [[003-firebase-auth-settings]] 6. pontja / [[005-ingame-shop-strapi-stripe]] hatásköre.
- **GitHub Pages korlát:** statikus hoszt, nincs proxy → **nem tud** same-origin `/__/auth/*` handlert adni. Ott a **popup az egyetlen működő út**, redirect fallback nélkül. A redirect fallback gyakorlatilag csak Firebase Hostingon értelmes.
- **`creditsLoaded` és a shop UX:** amíg `false`, a vásárlás gombok legyenek letiltva, különben a játékos 0 kredittel próbál vásárolni.
- **Adatmentés = destruktív lépés:** a 3.I pont kézi RTDB-írás. Export **előbb**, törlés **utoljára**.
- **A `useShopStore` persist eltávolítása** offline-módban elveszti a helyi állapotot — a kredit ekkor `—` marad. Ez elfogadott (RTDB = egyetlen forrás).

---

## 7. Ellenőrzési terv

1. `npx firebase-tools deploy --only database`, majd Console → **Rules Playground**: `users/<uid>/wallet` write, `auth.uid = $uid` → **allow**.
2. `npm run dev` → DevTools Console: **nincs** `PERMISSION_DENIED`, a `users/{uid}` node létrejön.
3. **Friss inkognitó ablak** → a User ID **nem** `null`, a kredit debug módban 9000, és **oldalfrissítés után is ugyanaz az uid + kredit** (ma ez bukik).
4. **Vásárlás a shopban** → a kredit csökken → **F5** → a csökkentett érték marad (RTDB-ből).
5. **Linkelés (a lényeg):** anonim uid + kredit feljegyzése → Settings → Login → Google → **ugyanaz az uid**, **ugyanaz a kredit**, a név megjelenik. **Ugyanez a MainMenu login gombbal is** — a két gomb ugyanúgy viselkedjen.
6. **Logout** → ugyanazzal a Google-fiókkal újra be → a kredit és az inventory megmarad.
7. **Redirect fallback:** popup-blokkoló bekapcsolva → a login redirectre vált, és visszatérés után is bejelentkezve marad.
8. **Hibaút:** ideiglenesen `".write": false` a `wallet`-re → a login **működjön**, az egyenleg **töltődjön be** (a read él), és a shop írási hibája **látható** üzenet legyen, ne néma konzol-log.
9. **MediaPipe:** mindkét deployon induljon el az arcfelismerés **404 nélkül**.
10. `npm run test` + `npm run build` + `npm run build:gh-pages`.

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
| J. i18n (7 kulcs × 5 nyelv) | ~1 óra |
| K. Ellenőrzés (10 pont, 2 deploy) | ~2 óra |

**Összesen:** ~2 fejlesztői nap.

**Kész definíció:** a játékos névtelenül azonnal játszik; a Google bejelentkezés **ugyanazt az uid-et** tartja meg (linkelés), a kredit és a birtoklás az **RTDB-ből** jön, oldalfrissítés és redirect után is; nincs `PERMISSION_DENIED` és nincs `auth/invalid-api-key`; az arcfelismerés **mindkét** deployon 404 nélkül indul; minden auth-hiba **látható** üzenetként jelenik meg mind az 5 nyelven; a 7804 kredit visszakerült a játékos fiókjára.

---

## 9. Kapcsolódó tervek

- [[003-firebase-auth-settings]] — **közvetlen előfeltétel.** Ez a terv annak megvalósított részét javítja, és több nyitott TODO-ját lezárja (Security Rules deploy Phase-1 szinten, `.env.example`, auth-bootstrap, linkelés). A Phase-2 rules és a Cloud Functionök ott maradnak.
- [[005-ingame-shop-strapi-stripe]] — **erre a tervre épül:** a kredit írási útja (Stripe → Cloud Function → `wallet.credits`) csak működő auth és működő RTDB-olvasás felett építhető. A Phase-2 (`".write": false`) rules átállás ott történik.
- [[002-ingame-shop-frontend]] — a `useShopStore` kredit/birtoklás modellje **itt változik**: `credits: 0` + `creditsLoaded`, a lokális debug-9000 megszűnik (átkerül a `getDefaultUserNode`-ba).
- [[000-i18n-nyelvesites]] — a `login.error.*` kulcsok mind az 5 nyelven.
