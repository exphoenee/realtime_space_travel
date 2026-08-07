---
title: "Firebase bejelentkezés + perzisztens felhasználói beállítások terve"
slug: 003-firebase-auth-settings
type: plan
category: auth
status: implemented
implemented: true
implemented_at: "2026-07-26"
created_at: "2026-07-25"
updated_at: "2026-07-28"  # frissítve: users/{uid}/purchases séma-ág + kijelentkezéskori lokális takarítás
author: exphoenee
step: 3
phases:
  - 1
  - 2
dependencies:
  - 000-i18n-nyelvesites
  - 001-main-menu-settings
related_plans:
  - 002-ingame-shop-frontend
  - 004-firebase-auth-bugfix
  - 005-ingame-shop-strapi-stripe
  - 007-state-persist-page-refresh
  - 012-wall-of-shame
tags:
  - firebase
  - auth
  - rtdb
  - settings
  - ship-select
  - cloud-functions
---

# Firebase bejelentkezés + perzisztens felhasználói beállítások terve

**Cél:**
1. **Firebase bejelentkezés** (Google + névtelen → fiókká léptetés).
2. Minden felhasználónak **perzisztens beállításai** legyenek a **Firebase Realtime Database**-ben: aktív **zene**, aktív **űrhajó**, **kredit-egyenleg**, birtokolt tartalmak, rekord stb.
3. Bejelentkezéskor a játék **betölti** ezeket az RTDB-ből és feltölti a helyi állapotot.
4. A jelenlegi **kis harangocska** (zene némító gomb) helyett egy **Settings menü**.
5. **Küldetésválasztás után** a játékos **űrhajót is választhat**; ha még nincs saját űrhajója, csak az **alap** hajót választhatja.

## Döntések (egyeztetve)

| Kérdés | Választás |
|--------|-----------|
| Bejelentkezési módok | **Google OAuth** + **Anonymous** (névtelen → később fiókká léptethető) |
| Backend-felelősség | **Firebase** = auth + beállítások (RTDB); **Strapi/Stripe** = valós pénzes fizetés |

---

## 0. Architekturális kontextus (fontos)

Két backend lesz, **tiszta felelősség-határral**, hogy ne ütközzenek (lásd [[005-ingame-shop-strapi-stripe]]):

- **Firebase = a játék olvasási modellje.** A kliens **kizárólag a Firebase-ből olvas** minden felhasználói adatot (beállítások, kredit, birtokolt hajók/zenék, rekord). Bejelentkezéskor ez tölt be.
- **Strapi + Stripe = a fizetés írási útja.** Valós pénzes vásárláskor a Stripe webhook → Strapi → **Firebase Admin SDK** beírja a megvett tételt a felhasználó Firebase csomópontjába. Így a Firebase marad az egyetlen olvasási forrás a játék számára, a Strapi csak a pénzügyi tranzakciót intézi.

Ez a terv a **Firebase oldalt** részletezi (auth, RTDB séma, betöltés, Settings menü, hajóválasztó). A fizetési híd a bolt-tervben él.

> **Ez a terv a kánon.** Felülírja a [[005-ingame-shop-strapi-stripe]] korábbi verziójának azon részeit, ahol a Strapi kezelte az autentikációt, a vendég-tokent (`/api/guest`, `/api/guest/upgrade`), a `User.credits`-et és az `Entitlement` content type-ot. Ezek helyett: **auth = Firebase**, **vendég→fiók = Anonymous→Google linkelés**, **kredit/birtoklás = RTDB (szerver-írt)**. A bolt-terv frissítve lett ehhez.

---

## ✅ Haladás (TODO)

> Jelölés: `[ ]` hátravan · `[~]` folyamatban · `[x]` kész. Implementáció közben itt vezetjük, hol tartunk, hogy félbeszakadás után folytatható legyen. Részletek a lenti szekciókban.

**Fázis 1 — auth + RTDB + Settings menü**
- [x] Firebase projekt + Auth (Google, Anonymous) + Realtime Database + env változók
- [x] `firebase/config.ts`, `firebase/auth.ts`, `firebase/userData.ts`
- [x] `useAuthStore` + anonymous auto-login + `onAuthStateChanged`
- [x] `ensureUserNode` + `subscribeUser` → `handleUserData` szinkron (settings, stats, wallet, inventory)
- [x] `SettingsScreen` + AccountSection (login, Google link, zeneválasztó, nehézség, hangerő)
- [x] Google-belépés + Anonymous→Google **linkelés** (redirect-based: `linkWithRedirect`/`signInWithRedirect`)
- [x] Redirect timing fix (`redirectCheckDone` flag) + skip intro OAuth visszatéréskor
- [x] Nyelv → RTDB write (`i18n.on("languageChanged")` → `updateUserSettings`)
- [x] Wallet + Inventory → RTDB szinkron (READ: `handleUserData`, WRITE: `checkout`/`buyCredits`/`resetShop`)
- [x] Zeneválasztás → `settings.activeMusicId` RTDB write (`SettingsScreen`)
- [x] `musicMuted` → RTDB `settings.musicMuted` write irány (`App.tsx` `useEffect`)
- [x] `musicVolume` + `difficulty` → RTDB write (SettingsScreen slider + gombok) + READ (`handleUserData`)
- [x] Kredit-egyenleg kijelzés a Settings `AccountSection`-ban
- [x] User displayName megjelenítés a Settingsben (authenticated user)
- [x] Zustand `persist` teljesen eltávolítva minden store-ból → **Firebase RTDB = single source of truth**
- [x] `security.rules.json` létrehozva (Phase 1: client write engedélyezve; Phase 2 migrációs út dokumentálva)
- [ ] **Security Rules deploy** a Firebase Console-ba (másold be a `security.rules.json` tartalmát a Realtime Database → Rules oldalon)
- [x] `activeShipId` validáció az `inventory.ships` ellenében — **MEGVALÓSÍTVA** az `App.tsx` `handleUserData`-ban: ha a mentett `activeShipId` nincs az RTDB `inventory.ships`-ben, `null`-ra állítja és visszaírja
- [ ] `.env.example` létrehozása dokumentált env változókkal (`VITE_DEBUG_MODE=true`)

> ⚠️ **A Fázis 1 auth jelenleg HIBÁS.** A Google bejelentkezés eldobja a névtelen uid-et (a kredit és a birtoklás árván marad), a User ID `null` lesz, és `PERMISSION_DENIED` jön az RTDB-ből (a Security Rules soha nem lett deployolva). A teljes hibaanalízis és a javítás a **[[004-firebase-auth-bugfix]]** tervben van — **azt kell előbb végrehajtani**, mielőtt a lenti nyitott TODO-k bármelyike lezárható lenne.

### Mit zár le a [[004-firebase-auth-bugfix]] ebből a tervből

| 003-as TODO | Állapot a bugfix után |
|---|---|
| **Security Rules deploy** a Firebase Console-ba | **Kipipálható** — a bugfix a `database.rules.json` + `firebase.json` `database` szekció + CI (`--only hosting,database`) úton deployolja a **Phase-1** (kliens-írható `wallet`/`inventory`) szabályokat. A **Phase-2** (`".write": false`) továbbra is nyitva marad a Cloud Functionökig (lásd 6. pont). |
| **`.env.example` létrehozása** dokumentált env változókkal | **Kipipálható** — a bugfix G. blokkja hozza létre. |
| `activeShipId` validáció az `inventory.ships` ellenében | ✅ **Már implementálva** — az `App.tsx` `handleUserData` callbackjében. |

**Fázis 2 — hajóválasztó + sebesség (✅ MEGVALÓSÍTVA a [[002-ingame-shop-frontend]]-ben)**
- [x] `GamePhase: "shipSelect"` + `screens/MissionSelector` pending destination + `routing/ScreenRouter` ág
- [x] `ShipSelectScreen` komponens (alap hajó mindig; birtokolt hajók `useShopStore.owned.ships`-ből)
- [x] Sebesség-integráció (`shipSpeedKmPerSecond` a `useGameStore`-ban; `Dashboard` használja) — **közös** [[005-ingame-shop-strapi-stripe]]
- [x] Zene-integráció: `useAudio` az aktív zene URL-jével; zeneválasztó a `SettingsScreen`-ben
- [x] **Firebase bekötés:** `useShopStore` wallet/inventory RTDB-ből szinkronizálva (`handleUserData`); `useGameStore.shipSpeedKmPerSecond`
- [x] **Flow átszervezés:** kamera-ellenőrzés áthelyezése a hajóválasztás UTÁN (`ShipSelectScreen.handleSelectShip` → kamera → `startMission`) — **MEGVALÓSÍTVA** az `App.tsx` `handleSelectDestination` csak `selectDestinationForShip`-et hív, a kamera ellenőrzés a `ShipSelectScreen.handleSelectShip`-ben történik

**Kredit-út — ❌ KIVÉVE: lásd alább**

> ⚠️ **Tervváltozás (2026-07-26):** Az alábbi 3 pont **NEM része** ennek a tervnek. A Spark (ingyenes) Firebase terv nem támogatja a Cloud Functionöket, ezért az architektúra megváltozott:
> - **`awardWage`** + **`purchaseWithCredits`** Cloud Functionök → ❌ **Eltávolítva.** A kliensoldali kredites vásárlás és a küldetés végi wage jóváírás a Phase-1 RTDB rules alatt, kliens-írható `wallet`-tel működik. A Phase-2 rules (`wallet.write = false`) és a szerveroldali validáció a [[021-stripe-fraud-defense]] terv opcionális (F) fázisa — Cloudflare Workerrel vagy Blaze tervre váltással.
> - **Stripe→Firebase híd** (Stripe webhook → Admin SDK → `inventory`) → ❌ **Eltávolítva.** Helyette a [[005-ingame-shop-strapi-stripe]] terv **Stripe Payment Links + kliensoldali jóváírás** architektúrát használ, amihez nincs szükség backendre.
>
> **Követő tervek:** [[005-ingame-shop-strapi-stripe]] (Stripe Payment Links, kliensoldali kredit-írás), [[021-stripe-fraud-defense]] (Spark-kompatibilis csalásvédelem, opcionális serverless webhook)

- [~] `awardWage` + `purchaseWithCredits` Cloud Functionök → ~~eltávolítva, lásd [[005-ingame-shop-strapi-stripe]] + [[021-stripe-fraud-defense]]~~
- [~] Stripe→Firebase híd → ~~eltávolítva, lásd [[005-ingame-shop-strapi-stripe]]~~

---

## 1. Függőségek és projekt-beállítás

```bash
npm install firebase
```

- **Firebase projekt** létrehozása a konzolon; **Authentication** (Google + Anonymous provider engedélyezése); **Realtime Database** (nem Firestore — a kérésnek megfelelően RTDB) létrehozása.
- Konfiguráció Vite env változókból (soha nem hardcode-olva):
  `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_DATABASE_URL`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`.
- `.env` a `.gitignore`-ba; `env.d.ts` bővítése a típusokkal.

### Új fájlok
```
src/
  firebase/
    config.ts            # initializeApp + getAuth + getDatabase
    auth.ts              # signInWithGoogle, signInAnonymously, linkAnonymousToGoogle, signOut, onAuthStateChanged wrapper
    userData.ts          # RTDB olvasás/írás: subscribeUser, updateSettings, ensureUserNode
  state/
    useAuthStore.ts      # user (uid, displayName, isAnonymous), authStatus
    useSettingsStore.ts  # activeShipId, activeMusicId, musicMuted, language (RTDB-vel szinkronban)
    useInventoryStore.ts # ownedShips, ownedMusic, ownedDlc, credits, bestServiceSeconds (RTDB read-only tükör)
  components/
    features/
      SettingsMenu.tsx     # a harang helyett: fogaskerék gomb + panel
      SettingsMenu.module.css
      AccountSection.tsx   # login/logout/link Google, felhasználó kijelzés
    screens/
      ShipSelect.tsx       # küldetés utáni hajóválasztó képernyő
      ShipSelect.module.css
```

---

## 2. Realtime Database séma

```
users/
  {uid}/
    profile:   { displayName, photoURL, provider, isAnonymous, createdAt, lastLoginAt }
    settings:  { activeShipId, activeMusicId, musicMuted, language }   # a user írhatja
    wallet:    { credits }                                             # CSAK szerver írhatja
    inventory:
      ships:   { <shipId>: true, ... }                                # CSAK szerver írhatja
      music:   { <musicId>: true, ... }
      dlc:     { <dlcId>: true, ... }
    stats:     { bestServiceSeconds }                                 # szerver-validált írás
```

> **Séma-bővítés (2026-07-28):** `users/{uid}/purchases/{pushId}` — vásárlási előzmény. **Privát ág** (nincs barát-nézete, ezért nem kapott top-level node-ot, szemben a `walls`-szal). Írási szabálya ugyanaz a `device_map`/uid feltétel, mint a többi ágé. Részletek: [[002-ingame-shop-frontend]] E rész.

### Firebase Security Rules (kulcsfontosságú)
```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read":  "auth != null && auth.uid == $uid",
        "profile":   { ".write": "auth != null && auth.uid == $uid" },
        "settings":  { ".write": "auth != null && auth.uid == $uid" },
        "wallet":    { ".write": false },
        "inventory": { ".write": false },
        "stats":     { ".write": "auth != null && auth.uid == $uid" }
      }
    }
  }
}
```

- **`settings`** (aktív hajó/zene, némítás, nyelv) — a felhasználó írhatja (preferencia).
- **`wallet` (kredit)** és **`inventory` (birtoklás)** — **csak szerver** (Firebase Admin SDK / Cloud Function / Strapi híd) írhatja. Ez akadályozza meg a kredit- és tulajdon-hamisítást a kliens `localStorage`/RTDB felől.
- A `settings.activeShipId`-t a **játék validálja** betöltéskor: ha a hivatkozott hajó nincs az `inventory.ships`-ben (a szerver-írt igazságforrásban), visszaáll az alap hajóra.

> **Alap hajó:** nincs az `inventory`-ban tárolva — mindig elérhető konstansként (a jelenlegi `SHIP_SPEED_KM_PER_SECOND = 191`). „Nincs saját hajó" = üres `inventory.ships`.

---

## 3. Bejelentkezés (auth) folyamat

- **App indulás:** `onAuthStateChanged` figyelő. Ha nincs user → **`signInAnonymously`** (azonnal játszható login nélkül, a korábbi vendég→fiók döntés szerint). Anonymous uid alatt is jön létre RTDB csomópont.
- **„Bejelentkezés Google-lel"** (Settings menüből):
  - Ha jelenleg **anonymous** → `linkWithCredential` (Google) → a névtelen fiók **fiókká léptetése**, a meglévő uid és minden RTDB adat megmarad.
  - Ha nincs aktív session → sima `signInWithPopup(googleProvider)`.
- **Kijelentkezés** → `signOut`, majd újra anonymous session.
  - ⚠️ **Bővítés (2026-07-28):** a `signOut()` + `clearUser()` **csak az auth store-t** üríti. A fiókhoz kötött **lokális** gyorsítótárat (szégyenfal-rekordok, `bestServiceSeconds`, vásárlási előzmény, kredit/birtoklás) az `App.tsx` identitás-figyelője takarítja a `clearUserScopedData()` helperrel — enélkül a következő felhasználó az előzőét látta. Az elv és a teljes leírás: [[007-state-persist-page-refresh]] G. blokk; a kiváltó hiba: [[012-wall-of-shame]] R. blokk.
- **`useAuthStore`** tartja: `uid`, `displayName`, `photoURL`, `isAnonymous`, `status` (`loading`\|`anonymous`\|`authenticated`).

### Betöltés bejelentkezéskor (a kérés lényege)
- Auth-esemény után `subscribeUser(uid)` — **RTDB real-time listener** a `users/{uid}` ágra.
- A beérkező adat feltölti a store-okat:
  - `settings` → `useSettingsStore` (aktív zene/hajó, némítás, nyelv → utóbbi az [[000-i18n-nyelvesites]] `i18n.changeLanguage`-ét hívja).
  - `wallet.credits` + `inventory` + `stats` → `useInventoryStore`.
- A real-time listener miatt a több eszközön történő változás automatikusan szinkronizálódik.
- **`ensureUserNode`:** ha még nincs csomópont (első belépés), létrehozza az alapértelmezésekkel (`credits: 0`, üres inventory, alap hajó/zene aktív, a böngésző nyelve).

---

## 4. Settings menü (a harang helyett)

> **Jelenlegi állapot:** a `SettingsScreen` már létezik (zene hangerő, zeneválasztó, nehézség, nyelv) — lásd [[002-ingame-shop-frontend]]. Nincs külön `bellOverlay`; a zene némítás/hangerő az `App.tsx` `playMusic` hook-ján keresztül és a `SettingsScreen`-ből vezérelhető.

### Firebase bekötéskor:
- A zene némítás/aktív zene **mérvadó forrása** az RTDB `settings.musicMuted`/`settings.activeMusicId` lesz (jelenleg `useUIStore` persist).

### Settings panel tartalma
1. **Fiók** (`AccountSection`): bejelentkezett felhasználó neve/avatarja; „Bejelentkezés Google-lel" (ha anonymous) / „Kijelentkezés". Kredit-egyenleg kijelzése.
2. **Zene**: be/ki kapcsoló + **sávválasztó** a birtokolt zenékből (`inventory.music`), alap = jelenlegi téma. Választás → `settings.activeMusicId` írás RTDB-be → a `useAudio` átvált.
3. **Űrhajó**: aktív hajó kijelzése/választása a birtokolt hajókból (ugyanaz a lista, mint a küldetés-választó lépésnél).
4. **Nyelv**: nyelvváltó (összekötve az [[000-i18n-nyelvesites]] tervvel), választás → `settings.language`.
5. (Opcionális) **Rekord** (`stats.bestServiceSeconds`) megjelenítése.

> A Settings menü elérhető a főmenüben és szünet közben is, ahogy a harang eddig.

---

## 5. Űrhajó-választó küldetés után

### ✅ Jelenlegi implementáció ([[002-ingame-shop-frontend]])
`MissionSelector` (célválasztás) → `handleSelectDestination` (kamera-ellenőrzés) → `shipSelect` → hajó kiválasztása → `startMission(destination, shipSpeed)` → `loading` → `playing`.

### 🔄 Terv szerinti helyes flow (későbbi módosításkor)
`MissionSelector` → **`shipSelect`** → hajó megerősítése → kamera-ellenőrzés → `startMission` → `loading` → `playing`.

> **Megjegyzés:** a kamera-ellenőrzés jelenleg a hajóválasztás ELŐTT fut. A terv szerinti helyes sorrendben a hajó kiválasztása UTÁN kellene ellenőrizni a kamerát, hogy a hajóválasztás ne függjön a kamera rendelkezésre állásától. Ezt a [[003-firebase-auth-settings]] implementálásakor kell átszervezni.

### Már megvalósított elemek ([[002-ingame-shop-frontend]]):
- `GamePhase: "shipSelect"` — `src/types/index.ts` + `phaseToFlags` a `useGameStore`-ban ✅
- `ShipSelectScreen` komponens: alap hajó + birtokolt hajók (`useShopStore.owned.ships`) ✅
- `routing/ScreenRouter`: `case "shipSelect"` ✅
- Sebesség-integráció: `shipSpeedKmPerSecond` a `useGameStore`-ban, `Dashboard` használja ✅
- Info modal a hajókhoz (`ShipInfoModal`) ✅
- Zeneválasztó a `SettingsScreen`-ben (birtokolt zenékből) ✅

### Firebase bekötéskor változik:
- `useShopStore.owned.ships` → `useInventoryStore` (Firebase RTDB `inventory.ships`)
- `activeShipId` validáció: a Firestore-ból olvasott `inventory.ships` ellenében
- Aktív hajó beállítása: `settings.activeShipId` írása az RTDB-be

---

## 6. Kredit írása (wage jóváírás) — szerveroldali út

Mivel a `wallet` és az `inventory` **nem** kliens-írható, a kredit-műveletek **Firebase Cloud Functionökön** keresztül futnak (egységesen a [[005-ingame-shop-strapi-stripe]] tervvel):
- **`awardWage`** (callable) — a küldetés végi `wage` jóváírás: validálja a befejezést és **atomikusan** (RTDB tranzakció) növeli `wallet.credits`-et.
- **`purchaseWithCredits`** (callable) — kredites vásárlás: egyenleg-ellenőrzés + levonás + `inventory` bővítés egyetlen tranzakcióban (nem a kliens). Az árat a Strapi katalógusból olvassa.
- A **valós pénzes** vásárlás ettől külön út: Stripe → Strapi webhook → **Firebase Admin SDK** írja az `inventory`-t (lásd [[005-ingame-shop-strapi-stripe]] 1. és 4. pont).

---

## 7. Store-ok és a meglévő állapot összhangolása

- **`useUIStore`** jelenleg `isMusicMuted`-et `persist`-eli (`space-travel-ui`). Bejelentkezés után a **mérvadó forrás az RTDB `settings.musicMuted`**; a localStorage csak offline tükör. A `useSettingsStore` szinkronizál a kettő között (RTDB → store → `useAudio`).
- **`useGameStore`** `bestServiceSeconds`-je (`space-travel-game` persist) → bejelentkezéskor összefésül az RTDB `stats.bestServiceSeconds`-szel (a nagyobb nyer), majd az RTDB lesz mérvadó.
- **Nyelv:** a Firebase `settings.language` és az i18n `space-travel-lang` (lásd [[000-i18n-nyelvesites]]) összehangolása — bejelentkezéskor az RTDB nyelv nyer, kijelentkezve a helyi detektált nyelv.
- **Új persist kulcsok** nem szükségesek a Firebase-adatokhoz (az RTDB a forrás); ha offline-tükör kell, külön `space-travel-firebase-cache` kulcs, hogy ne ütközzön a meglévőkkel.

---

## 8. Megvalósítási lépések (sorrend)

> **✅ Már kész ([[002-ingame-shop-frontend]]):** 8-as (shipSelect GamePhase), 9-es (ShipSelect komponens), 10-es (sebesség-integráció), 11-es (zene-integráció). A Settings menü (zene hangerő, zeneválasztó, nehézség, nyelv) már létezik — de Firebase auth nélkül.
> **🔄 Módosítás:** a kamera-ellenőrzés jelenleg a hajóválasztás ELŐTT fut; a helyes flow (shipSelect → kamera → startMission) bevezetése a Firebase implementáció részeként.

1. Firebase projekt + Auth (Google, Anonymous) + Realtime Database létrehozása; env változók.
2. `src/firebase/config.ts`, `src/firebase/auth.ts`, `src/firebase/userData.ts`.
3. **Security Rules** beállítása (wallet/inventory szerver-only; settings user-írható).
4. `useAuthStore` + anonymous auto-login az app indulásakor; `onAuthStateChanged` bekötése.
5. `ensureUserNode` + `subscribeUser` → `useSettingsStore` / `useInventoryStore` feltöltés bejelentkezéskor.
6. **`SettingsScreen` bővítése** `AccountSection`-nal (login/logout); zene-némítás RTDB `settings.musicMuted`-re átállítás.
7. Google-bejelentkezés + anonymous→Google **linkelés** a Settings menüből.
8. **`useShopStore` kiváltása:** `useInventoryStore` (RTDB read-only tükör) + `useSettingsStore` (aktív hajó/zene).
9. **Flow átszervezés:** kamera-ellenőrzés áthelyezése a hajóválasztás UTÁN (`ShipSelectScreen.handleSelectShip` → kamera → `startMission`).
10. **Cloud Function** (`awardWage`) a wage → kredit jóváíráshoz; wallet/inventory szerver-írás.
11. Nyelv/rekord/némítás összefésülés a meglévő store-okkal.
12. **Strapi↔Firebase híd** (a bolt-tervből): Stripe webhook → Admin SDK → `inventory` írás.

---

## 9. Kockázatok / figyelmeztetések

- **Két backend szinkronban tartása** (Firebase + Strapi) a fő komplexitás — a tiszta határ (Firebase olvas, Strapi fizet, Admin SDK ír) elengedhetetlen, különben szétcsúsznak az adatok.
- **Biztonság:** a `wallet` és `inventory` **soha** ne legyen kliens-írható — a Security Rules ennek a sarokköve. A `settings.activeShipId`-t a játék validálja a birtoklás ellen.
- **Anonymous → Google linkelés** él eset: ha a Google-fiók már létezik másik uid alatt, ütközés (`credential-already-in-use`) — kezelni kell (fiók-összevonás vagy figyelmeztetés).
- **Alap hajó** mindig elérhető, nem az inventory része — külön konstansként kezelendő, hogy az üres-inventory eset működjön.
- **Offline / autoplay:** RTDB listener offline gyorsítótárral; a Stripe/redirect utáni visszatéréskor az auth session helyreáll (Firebase perzisztens auth).
- **`base href`** (`/realtime_space_travel/`) és a Google OAuth **engedélyezett domainek** (Firebase Auth authorized domains) egyeztetése éles/preview környezetre.
- **Adatvédelem:** Google profil (név, avatar) tárolása → GDPR-tájékoztatás; törlési lehetőség (fiók + RTDB csomópont).
- **Adatvédelem — megosztott böngésző (2026-07-28):** a `localStorage` **origin-szintű**, a böngészőt használó minden fiók osztozik rajta. Fiókhoz kötött adat perzisztálása ezért **adatszivárgás** a következő felhasználó felé — a kijelentkezés önmagában nem takarít. Elv és megvalósítás: [[007-state-persist-page-refresh]] G. blokk; a konkrét hibaeset: [[012-wall-of-shame]] R. blokk, [[002-ingame-shop-frontend]] E rész.

---

## 10. Becsült ráfordítás (nagyságrend)

| Feladat | Nagyságrend |
|---------|-------------|
| Firebase setup + auth (Google, anonymous, link) | ~1 nap |
| RTDB séma + Security Rules + betöltés/szinkron | ~1–2 nap |
| Settings menü (harang csere, account, zene, nyelv) | ~1–2 nap |
| Ship-select flow + sebesség-integráció | ~1–2 nap |
| Cloud Function (wage) + Strapi↔Firebase híd | ~1–2 nap |

**Kész definíció:** a játékos névtelenül azonnal játszhat, majd Google-lel bejelentkezhet (a haladat megmarad); a beállításai (zene, aktív űrhajó, kredit, birtokolt tartalmak, rekord) a Firebase RTDB-ben perzisztensek és bejelentkezéskor betöltődnek; a harang helyett Settings menü van; küldetésválasztás után a játékos hajót választhat, üres inventory esetén csak az alapot.

---

## 11. Kapcsolódó tervek
- [[004-firebase-auth-bugfix]] – **a terv Fázis 1 részének javítása.** A megvalósított auth hat egymást elfedő hibát tartalmaz (uid-vesztés Google-belépéskor, `PERMISSION_DENIED` a nem deployolt rules miatt, elnyelt redirect-hiba, StrictMode dupla-init, lokális 9000 kredit-default, GH Pages env hiány). A bugfix lezárja a **Security Rules deploy** (Phase-1) és a **`.env.example`** TODO-kat, valamint stabilizálja az auth bootstrapet és a linkelést. A Phase-2 rules és a Cloud Functionök ebben a tervben maradnak.
- [[002-ingame-shop-frontend]] – a **helyi (frontend-only) bolt** ELŐBB valósul meg: a `useShopStore` (localStorage) kredit/birtoklás/aktív-hajó/aktív-zene állapotát ez a terv **per-felhasználós Firebase-mentésre** cseréli (RTDB `wallet`/`inventory`/`settings`), a localStorage offline tükör lesz; a `checkout` kredit-levonása → `purchaseWithCredits` Cloud Function. Az „aktív hajó sebessége" és a „Settings zeneválasztó" integráció közös — ott úgy épül, hogy itt csak a forrás cserélődjön.
- [[005-ingame-shop-strapi-stripe]] – a birtoklás/kredit írási útja (Stripe→Strapi→Firebase Admin SDK); az „aktív hajó sebessége" integráció közös.
- [[000-i18n-nyelvesites]] – a `settings.language` a nyelvi réteget vezérli.
- [[007-state-persist-page-refresh]] – a kijelentkezés/fiókváltás utáni **lokális** takarítás (`clearUserScopedData`) és a perzisztálási elv („localStorage-ban csak eszközszintű adat") itt van rögzítve; a `signOut` ág ennek megfelelően bővült.
- [[012-wall-of-shame]] – a `walls/{uid}` ág és a fiókváltáskori adatszivárgás javítása (R. blokk).
- [[021-stripe-fraud-defense]] – a 6. pont **Cloud Function** útjának (`awardWage`, `purchaseWithCredits`) Blaze-mentes alternatívája: külső serverless futtató (Cloudflare Worker) + RTDB REST API, amivel a **Phase-2 rules** (`wallet.write = false`) Spark terven is bevezethető. A terv addig is szigorítja a Phase-1 `wallet` szabályt (írásonkénti növekmény-limit + ütemkorlát) — ezt az `awardWage` későbbi bevezetésekor együtt kell hangolni.
- [[020-nextjs-migration]] – **a 6. pont szerveroldali útjának tényleges megvalósíthatósága.** A Next.js migráció (Vite SPA → App Router, Vercel) után az `awardWage` és a `purchaseWithCredits` **Vercel API route**-ként, `firebase-admin`-nal valósítható meg — **Blaze terv és Cloud Functions nélkül**, és a [[021-stripe-fraud-defense]] által javasolt külön Cloudflare Worker üzemeltetése nélkül is (ugyanaz a repó, ugyanaz a deploy, ugyanaz a TypeScript kódbázis). Ezzel a **Phase-2 rules** (`wallet.write = false`, szerver-only wallet/inventory írás) végre bevezethetővé válik. **A jelen tervben rögzített auth- és RTDB-séma változatlan marad**; a migráció mindössze két ponton érinti: (1) a 8 `VITE_FIREBASE_*` env változó `NEXT_PUBLIC_FIREBASE_*`-ra nevezés át (`src/firebase/config.ts`), (2) ⚠️ a **Firebase Console → Authentication → Authorized domains** listáját ki kell egészíteni a Vercel domainekkel — a Firebase **nem támogat wildcardot**, ezért a random commit-preview URL-eken a Google bejelentkezés `auth/unauthorized-domain` hibát ad; csak a production és a stabil branch-domain vehető fel (020 7.7). A `signInWithPopup` / `linkWithPopup` út miatt a migráció **tiltja** a dokumentum-szintű COEP/COOP headereket (020 7.5).
