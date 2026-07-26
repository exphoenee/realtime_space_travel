# Firebase tanulságok

## Auth

### Auth bootstrap singleton (StrictMode safety)

**Probléma:** A React StrictMode duplán mountolja az `App.tsx` effect-jét, így két párhuzamos auth lifecycle indul. A második példány `signInAnonymous`-t hívhat a Google user fölé, új anonim uid-et létrehozva.

**Megoldás:** Modul-scope singleton `authBootstrap.ts`-ben: `started`, `anonInit`, `redirectCheckDone` flagek. Az első hívás beállítja `started = true`-t, a második `if (started) return`-nel kilép. A flag-ek a modul scope-jában élnek, nem a React closure-ben.

**Forrás:** `src/firebase/authBootstrap.ts`

### `startGoogleAuth` — unified entry point Google belépéshez

**Probléma:** Két külön gomb (`MainMenu` + `Settings`) két külön függvényt hívott (`signInWithGoogle` vs `linkAnonymousToGoogle`), ami eltérő viselkedéshez vezetett.

**Megoldás:** Egyetlen `startGoogleAuth()` függvény, ami:
1. Anonymous user → `linkWithPopup` (uid megmarad)
2. Nem anonim → `signInWithPopup`
3. `auth/credential-already-in-use` → `signInWithCredential` (a másik fiókba lép be)
4. Popup blokk → redirect fallback (`linkWithRedirect` / `signInWithRedirect`)

**Forrás:** `src/firebase/auth.ts`

### `getAuthErrorMessage` — i18n-alapú hibaüzenetek

**Minta:** Minden auth/RTDB hibát a `getAuthErrorMessage(err)` függvényen keresztül kell futtatni, ami i18n kulcsot ad vissza (`login.error.*`). A UI ezt a kulcsot használja a `t()` függvénnyel. A `console.error` a hiba logolására szolgál, a `setAuthError(getAuthErrorMessage(err))` a felhasználói üzenetre.

**Forrás:** `src/firebase/auth.ts` `getAuthErrorMessage`

### COOP/COEP headerek blokkolják a Firebase Auth popup-ot

**Probléma:** A `vite.config.ts` `Cross-Origin-Opener-Policy: same-origin` és `Cross-Origin-Embedder-Policy: require-corp` headerei blokkolják a Firebase Auth popup window és az auth iframe közötti kommunikációt. Ez a `window.closed` hívásnál COOP warningot, a popup utáni credential átadásnál hibát okoz.

**Megoldás:** Mindkét header ELTÁVOLÍTVA a dev server konfigurációból. A prod (`firebase.json` headers) csak a `**/*.wasm`-ra küldi ezeket a headereket, így a dokumentum ott sem cross-origin isolated. Ha a jövőben SharedArrayBuffer kellene a MediaPipe-hoz, az ütközne a popup authtal — akkor a redirect út marad.

**Forrás:** `vite.config.ts`, `firebase.json` hosting headers

### Device-based guest identitás (localStorage UUID)

**Minta:** Guest user azonosítása `localStorage`-ban tárolt UUID-vel (`deviceId`), nem Firebase Anonymous UID-val. A guest adat `users/{deviceId}` alatt van, a `device_map/{deviceId}→{firebaseUid}` mapping vezeti át a security rules-t. Kijelentkezés után új anonim UID → device_map frissítés → ugyanaz a `users/{deviceId}`.

**Rotáció / törlés migráció után:** Ha a guest Google-lal belép, a guest adat migrálódik `users/{googleUid}` alá, a `users/{deviceId}` gyermekei törlődnek (profile, settings, wallet, inventory, stats → `null`), a `device_map/{deviceId}` törlődik, és a `deviceId` **törlődik** a localStorage-ból (`clearDeviceId()` → `removeItem` + új UUID generálás + `setItem`). A `removeItem` explicit hívása megakadályozza, hogy a régi deviceId bármilyen formában visszaállítható legyen.

Fontos: a guest node adatai include FIREBASE AUTH USER — a `linkWithPopup` miatt az anonim Auth user maga LESZ a Google user (ugyanaz az uid, fejlesztve), így Auth oldalról nincs mit törölni. A teljes körű takarítás az RTDB + localStorage szinten történik.

**Forrás:** `src/firebase/deviceId.ts` (`clearDeviceId`), `src/firebase/userData.ts` (`migrateGuestData`), `src/firebase/authBootstrap.ts`

---

## RTDB

### `set` vs `update` a gyerek-szintű write szabályoknál

**Probléma:** A `set(userRef, defaults)` a `users/$uid` szintre ír, de a Security Rules `.write` csak a gyerek node-okon van (profile, settings, wallet, stb.). A szabályok lefelé kaszkádolnak, felfelé nem → PERMISSION_DENIED.

**Megoldás:** `update(userRef, defaults)` használata, ami minden top-level kulcsot külön gyerek-path-ként értékel ki.

**Forrás:** `src/firebase/userData.ts` `ensureUserNode` függvény

### `ensureUserNode` re-login-nél ne írja felül a custom mezőket

**Probléma:** A re-login-kor futó `ensureUserNode` a teljes profile-t (displayName, photoURL, stb.) felülírta volna a Google adataival, ezzel törölve a felhasználó által beállított nickname-et.

**Megoldás:** A meglévő node frissítésekor csak az auth-ból jövő mezők kerülnek update-re; a `nickname` (és más user-set mezők) nem. A kommentben jelezzük, hogy ez szándékos.

### RTDB = single source of truth kredithez + `creditsLoaded` flag

**Probléma:** A `useShopStore` lokális kezdőértéke volt (`STARTING_CREDITS`), és a debug módban 9000 kredittel indult. Az RTDB-ből érkező adat nem mindig írta felül ezt, mert a PERMISSION_DENIED miatt a szinkron el sem indul.

**Megoldás:**
- `credits: 0` induló érték a store-ban (nincs lokális debug-elágazás)
- `creditsLoaded: boolean` — `false` amíg az RTDB első adata meg nem érkezik
- A kreditkijelzők `creditsLoaded === false` esetén `—`-t mutatnak (nem `0`-t)
- `setCredits()` egyszerre állítja a `credits`-et és a `creditsLoaded`-et `true`-ra
- A `getDefaultUserNode` kapja a debug 9000-et (az RTDB-be íródik), nem a store

**Forrás:** `src/state/useShopStore.ts`, `src/App.tsx` `handleUserData`, `src/firebase/userData.ts` `getDefaultUserNode`

### Security Rules Phase-1 vs Phase-2 deployment strategy

**Fázisok:**
- **Phase-1 (jelenleg):** `wallet` és `inventory` is kliens-írható (`.write`: `auth != null && auth.uid == $uid`). Ez tudatos, átmeneti kompromisszum, amíg nincsenek Cloud Functionök.
- **Phase-2 (jövő):** `wallet` és `inventory` → `.write: false` (csak Admin SDK / Cloud Function írhat). A váltás a `purchaseWithCredits` és `awardWage` CF-ek után.

**Forrás:** `security.rules.json` DEPLOYMENT PHASES szekció, `database.rules.json`

### `rtdbKey` store mező — guest vs authenticated kulcs

**Minta:** A `useAuthStore` tartalmaz egy `rtdbKey` mezőt, ami guest session esetén a `deviceId` (localStorage UUID), authenticated (Google) user esetén a Firebase `uid`. Minden RTDB hívás ezt a kulcsot használja. A `setUser` automatikusan beállítja a megfelelő értékre.

**Forrás:** `src/state/useAuthStore.ts`

### Guest→Google adatmigráció — merge stratégia

**Probléma:** Guest user adatai (`users/{deviceId}` alatt) eltűnnek Google belépéskor, hacsak át nem másoljuk a Google user alá (`users/{uid}`).

**Megoldás:** `migrateGuestData(deviceId, targetUid)`:
1. **Kredit:** guest + Google kreditek **összeadódnak** (semmi sem vész el)
2. **Inventory:** **egyesül** — mindkét fél birtokolt tételei megmaradnak
3. **Stats:** a **jobb érték marad** (`Math.max`)
4. **Settings:** guest settings **nyernek** (aktívan játszott)

**Fontos:** Az írás `update`-tal történik (nem `set`-tel), mert a security rules `.write` csak a gyerek node-okon van, nem a `users/$key` szülőn. Ugyanez a törlésre is: `update(guestRef, { profile: null, settings: null, ... })` — nem `set(guestRef, null)`.

**Forrás:** `src/firebase/userData.ts` `migrateGuestData`

### `device_map` ordering dependency

**Probléma:** A security rules `users/$key` `.read`/`.write` feltétele ellenőrzi `device_map/$key == auth.uid`-t. Ha a `device_map` bejegyzés nem létezik a `users/{deviceId}` első írásakor, a hozzáférés PERMISSION_DENIED.

**Megoldás:** `ensureDeviceMap(deviceId, firebaseAuthUid)` hívása **MINDEN** `users/{deviceId}` olvasás/írás ELŐTT. A hívások sorrendje az `onAuthChange` callback-ben:

```
1. ensureDeviceMap(deviceId, authUid)    // mapping létrehozása
2. migrateGuestData(deviceId, uid)       // ha Google user
3. rotateDeviceId()                       // ha volt migráció
4. ensureUserNode(user, provider, rtdbKey)  // node biztosítása
5. subscribeUser(rtdbKey, callback)       // listener indítása
```

**Forrás:** `src/firebase/authBootstrap.ts`, `src/firebase/userData.ts` `ensureDeviceMap`

### `subscribeUser` exponential backoff retry

**Probléma:** A Firebase RTDB `onValue` WebSocket néha még nem kapta meg az auth tokent az első listen küldésekor. Ilyenkor `permission_denied`-et dob, annak ellenére, hogy a REST-alapú `get()`/`update()` hívások (amik inline tokent küldenek) sikeresek. Ez egy ismert Firebase RTDB race condition.

**Megoldás:** Exponenciális backoff retry (1s, 2s, 4s, 8s), `cancelled` flag + `clearTimeout` a cleanup-ban:
```ts
let retryCount = 0;
let cancelled = false;
let timerId: ReturnType<typeof setTimeout> | null = null;

const attempt = () => {
  if (cancelled) return;
  unsub = onValue(userRef, onSuccess, (error) => {
    if (isPermissionDenied && retryCount < maxRetries) {
      retryCount++;
      const delay = baseDelayMs * Math.pow(2, retryCount - 1);
      timerId = setTimeout(attempt, delay);
    } else {
      callback(null);
    }
  });
};

// Cleanup:
return () => {
  cancelled = true;
  if (timerId !== null) clearTimeout(timerId);
  if (unsub) unsub();
};
```

**Forrás:** `src/firebase/userData.ts` `subscribeUser`

### Auth bootstrap singleton NOT torn down by App.tsx

**Megfontolás:** Az `App.tsx` useEffect cleanup-ja szándékosan **nem** hívja meg `stopAuthBootstrap()`-t. Ennek oka: a React StrictMode duplán mountol → effect cleanup → remount. Ha a cleanup meghívná `stopAuthBootstrap`-ot, a singleton flag-ek (`started`, `anonInit`, `redirectCheckDone`) nullázódnának, és a remount-kor **újabb auth lifecycle indulna** — pont azt a StrictMode race-t okozva, amit a singleton-nak meg kellene akadályoznia.

**Szabály:** A `startAuthBootstrap` singleton flag-jeit SOHA nem szabad resetelni az App root cleanup-jában. A `stopAuthBootstrap` csak tesztekből / HMR-ből hívható.

**Forrás:** `src/firebase/authBootstrap.ts`, `src/App.tsx`

### Stale bundle — hard reload required after deployment

**Probléma:** Vite HMR néha nem frissít minden modult deployment után. Ha a konzolban `users/{firebaseUid}` path-ek jelennek meg (nem `users/{UUID}`), vagy régi hibák térnek vissza, akkor a böngészőben elavult JavaScript fut.

**Megoldás:** Ctrl+Shift+R (hard reload). Tiszta inkognitó ablak a legegyszerűbb.

**Forrás:** Többször előfordult a 004-es terv során.

### Stripe visszatérés — SPA route kezelés

**Probléma:** Az app Zustand `gamePhase`-et használ, nem URL route-okat. A Stripe Payment Link `after_completion.redirect.url` (`/shop/success`) nem feleltethető meg egy GamePhase-nek — a visszatéréskor az app az intróval indul, a ShopScreen sosem mountol, a `sessionStorage` ellenőrzés nem fut le.

**Megoldás (3 rétegű):**

1. **URL detektálás App.tsx-ben:** Ha `window.location.pathname.includes("/shop/success")`, `queueMicrotask`-ban `transitionTo("shop")` — az intro átugrásra kerül, a ShopScreen mountol.

2. **localStorage + sessionStorage dupla írás:** A `CreditShopView.handleBuy` mindkét storage-ba elmenti a függőben lévő vásárlást. A `localStorage` a Stripe átirányítás + visszatérés teljes page load ciklusán át életben marad (ugyanazon az origin-en). A `sessionStorage` per-tab, page load-kor elveszik — egyedül nem elég.

3. **Kettős olvasás ShopScreen-ben:** `sessionStorage` elsődleges, `localStorage` fallback. Közös `clear()` helper törli mindkettőt minden ágon (siker, lejárt, érvénytelen).

**Korlát:** Cross-origin (localhost → Firebase Hosting) esetén a localStorage adat nem érhető el (per-origin). Ilyenkor a kredit csak lokálisan kerül hozzáadásra, az RTDB írás elmarad → page reload után elveszik. Productionben (Firebase Hosting → Stripe → Firebase Hosting) rendben van.

**Forrás:** `src/App.tsx`, `src/components/shop/CreditShopView.tsx`, `src/components/shop/ShopScreen.tsx`

---

## Cloud Functions (tervezett)

### `update` vs `set` rule (újra)

**Ugyanaz a szabály mint a kliens oldalon:** A Cloud Function-ök is `update`-ot használjanak, ha a security rules-ban nincs `.write` a szülő node-on. Ez különösen fontos Phase-2-ben, amikor `wallet`/`inventory` → `.write: false` (csak Admin SDK / CF írhat).

**Forrás:** `src/firebase/userData.ts` `ensureUserNode`, `migrateGuestData`

---

## Tesztelés

### Permission_denied nem mindig igazi hiba

Az `onValue` WebSocket `permission_denied` hibája gyakran **race condition** (a token még nem érkezett meg), nem tényleges security rules probléma. A retry mechanizmus ezt oldja fel. Ha a retry-k után is `permission_denied` marad, akkor kell a rules-t vizsgálni.

**Diagnózis:** Ha a `get()` hívások (REST) sikeresek, de az `onValue` (WebSocket) hibázik, az race condition → retry segít. Ha a `get()` is hibázik, az valódi rules hiba → Console → Rules Playground.

### Migráció tesztelése

1. Inkognitó ablak → guest vásárol
2. Google belépés → kredit összeadódott? inventory egyesült?
3. Kijelentkezés → új guest session → deviceId **más** (rotált!)
4. Új Google belépés → nincs duplikáció (a régi deviceId adata törölve, az új deviceId alatt nincs migrálható adat)
