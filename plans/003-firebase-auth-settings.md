---
title: "Firebase bejelentkezés + perzisztens felhasználói beállítások terve"
slug: 003-firebase-auth-settings
type: plan
category: auth
status: not-started
implemented: false
implemented_at: null
created_at: "2026-07-25"
updated_at: "2026-07-25"
author: exphoenee
step: 3
phases:
  - 1
  - 2
dependencies:
  - 000-i18n-nyelvesites
  - 001-main-menu-settings
related_plans:
  - 000-i18n-nyelvesites
  - 001-main-menu-settings
  - 004-ingame-shop-strapi-stripe
  - 002-ingame-shop-frontend
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

Két backend lesz, **tiszta felelősség-határral**, hogy ne ütközzenek (lásd [[004-ingame-shop-strapi-stripe]]):

- **Firebase = a játék olvasási modellje.** A kliens **kizárólag a Firebase-ből olvas** minden felhasználói adatot (beállítások, kredit, birtokolt hajók/zenék, rekord). Bejelentkezéskor ez tölt be.
- **Strapi + Stripe = a fizetés írási útja.** Valós pénzes vásárláskor a Stripe webhook → Strapi → **Firebase Admin SDK** beírja a megvett tételt a felhasználó Firebase csomópontjába. Így a Firebase marad az egyetlen olvasási forrás a játék számára, a Strapi csak a pénzügyi tranzakciót intézi.

Ez a terv a **Firebase oldalt** részletezi (auth, RTDB séma, betöltés, Settings menü, hajóválasztó). A fizetési híd a bolt-tervben él.

> **Ez a terv a kánon.** Felülírja a [[004-ingame-shop-strapi-stripe]] korábbi verziójának azon részeit, ahol a Strapi kezelte az autentikációt, a vendég-tokent (`/api/guest`, `/api/guest/upgrade`), a `User.credits`-et és az `Entitlement` content type-ot. Ezek helyett: **auth = Firebase**, **vendég→fiók = Anonymous→Google linkelés**, **kredit/birtoklás = RTDB (szerver-írt)**. A bolt-terv frissítve lett ehhez.

---

## ✅ Haladás (TODO)

> Jelölés: `[ ]` hátravan · `[~]` folyamatban · `[x]` kész. Implementáció közben itt vezetjük, hol tartunk, hogy félbeszakadás után folytatható legyen. Részletek a lenti szekciókban.

**Fázis 1 — auth + RTDB + Settings menü**
- [ ] Firebase projekt + Auth (Google, Anonymous) + Realtime Database + env változók
- [ ] `firebase/config.ts`, `firebase/auth.ts`, `firebase/userData.ts`
- [ ] **Security Rules** (`wallet`/`inventory` szerver-only; `settings`/`stats` user-írható)
- [ ] `useAuthStore` + anonymous auto-login + `onAuthStateChanged`
- [ ] `ensureUserNode` + `subscribeUser` → `useSettingsStore` / `useInventoryStore` feltöltés
- [ ] `SettingsMenu` + `AccountSection`; `bellOverlay` → `settingsOverlay` csere; zene-némítás áthelyezés
- [ ] Google-belépés + Anonymous→Google **linkelés**
- [ ] Nyelv/rekord/némítás összefésülés a meglévő store-okkal ([[000-i18n-nyelvesites]])

**Fázis 2 — hajóválasztó + sebesség**
- [ ] `GamePhase: "shipSelect"` + `MainMenu` pending destination + `ScreenRouter` ág
- [ ] `ShipSelect` komponens (alap hajó mindig; üres inventory → csak alap)
- [ ] Sebesség-integráció (aktív hajó → `travelYears` / `Dashboard` / `MainMenu`) — **közös** [[004-ingame-shop-strapi-stripe]]
- [ ] Zene-integráció: `useAudio` az aktív zene URL-jével

**Kredit-út (részben Fázis 3-mal közös)**
- [ ] Cloud Function `awardWage` (küldetés végi kredit)
- [ ] Strapi↔Firebase híd: Stripe webhook → Admin SDK → `inventory` írás (a bolt-tervből)

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
    SettingsMenu.tsx     # a harang helyett: fogaskerék gomb + panel
    SettingsMenu.module.css
    AccountSection.tsx   # login/logout/link Google, felhasználó kijelzés
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

A jelenlegi **`bellOverlay`** (`App.tsx` 198–219. sor): egy 🔔/🔕 gomb a vászon fölött, `handleToggleMusic`-kal. **Lecseréljük** egy **⚙️ fogaskerék** gombra, ami megnyitja a **`SettingsMenu`** panelt.

### Csere részletei
- Az `App.tsx`-ben a `bellOverlay` → `settingsOverlay`: ugyanaz a pozicionálás (canvas fölött, pre-game és pause állapotban látható), de a gomb a Settings panelt nyitja/zárja.
- A zene némítás átkerül a Settings panelbe (megmarad az `isMusicMuted` logika, de a `useUIStore` helyett/mellett az RTDB `settings.musicMuted` a perzisztens forrás).

### Settings panel tartalma
1. **Fiók** (`AccountSection`): bejelentkezett felhasználó neve/avatarja; „Bejelentkezés Google-lel" (ha anonymous) / „Kijelentkezés". Kredit-egyenleg kijelzése.
2. **Zene**: be/ki kapcsoló + **sávválasztó** a birtokolt zenékből (`inventory.music`), alap = jelenlegi téma. Választás → `settings.activeMusicId` írás RTDB-be → a `useAudio` átvált.
3. **Űrhajó**: aktív hajó kijelzése/választása a birtokolt hajókból (ugyanaz a lista, mint a küldetés-választó lépésnél).
4. **Nyelv**: nyelvváltó (összekötve az [[000-i18n-nyelvesites]] tervvel), választás → `settings.language`.
5. (Opcionális) **Rekord** (`stats.bestServiceSeconds`) megjelenítése.

> A Settings menü elérhető a főmenüben és szünet közben is, ahogy a harang eddig.

---

## 5. Űrhajó-választó küldetés után

### Jelenlegi flow
`MainMenu` (célválasztás) → `handleSelectDestination` (kamera-ellenőrzés) → `startMission` → `loading` → `playing`.

### Új flow
`MainMenu` (célválasztás) → **`shipSelect` (ÚJ)** → hajó megerősítése → kamera-ellenőrzés → `startMission(destination, ship)` → `loading` → `playing`.

### Változtatások
- **Új `GamePhase: "shipSelect"`** a `src/types/index.ts`-be + `phaseToFlags` a `useGameStore`-ban (paused-szerű állapot, mint a `menu`).
- A `MainMenu` `onSelectDestination`-je már **nem** indít küldetést, hanem eltárolja a **függőben lévő célt** és `transitionTo("shipSelect")`.
- **`ScreenRouter`**: új `case "shipSelect": return <ShipSelect ... />`.
- **`ShipSelect` komponens:**
  - Listázza a választható hajókat: **alap hajó** (mindig) + `inventory.ships` birtokolt hajók.
  - **Ha az `inventory.ships` üres → csak az alap hajó választható** (a többi „zárolt", boltba mutató kártyaként jelenhet meg — kapcsolódik a [[004-ingame-shop-strapi-stripe]] tervhez).
  - Hajó adatai: név, **sebesség** (km/s), a célhoz számított **utazási idő** (a hajó sebességéből, lásd lent).
  - „Indítás" gomb → beállítja `settings.activeShipId`-t, majd meghívja a kamera-ellenőrzést és a `startMission`-t a kiválasztott hajóval.
- **Sebesség-integráció:** a `startMission` a **kiválasztott hajó** sebességéből számolja a `travelYears`-t (jelenleg a fix `SHIP_SPEED_LIGHTYEARS_PER_YEAR`-ből). A `Dashboard` sebesség-kijelzője és a `MainMenu` utazásiidő-becslése is az aktív hajóból számol. (Ez a rész közös a [[004-ingame-shop-strapi-stripe]] „aktív hajó" integrációjával — érdemes egyszer, egységesen megvalósítani.)

---

## 6. Kredit írása (wage jóváírás) — szerveroldali út

Mivel a `wallet` és az `inventory` **nem** kliens-írható, a kredit-műveletek **Firebase Cloud Functionökön** keresztül futnak (egységesen a [[004-ingame-shop-strapi-stripe]] tervvel):
- **`awardWage`** (callable) — a küldetés végi `wage` jóváírás: validálja a befejezést és **atomikusan** (RTDB tranzakció) növeli `wallet.credits`-et.
- **`purchaseWithCredits`** (callable) — kredites vásárlás: egyenleg-ellenőrzés + levonás + `inventory` bővítés egyetlen tranzakcióban (nem a kliens). Az árat a Strapi katalógusból olvassa.
- A **valós pénzes** vásárlás ettől külön út: Stripe → Strapi webhook → **Firebase Admin SDK** írja az `inventory`-t (lásd [[004-ingame-shop-strapi-stripe]] 1. és 4. pont).

---

## 7. Store-ok és a meglévő állapot összhangolása

- **`useUIStore`** jelenleg `isMusicMuted`-et `persist`-eli (`space-travel-ui`). Bejelentkezés után a **mérvadó forrás az RTDB `settings.musicMuted`**; a localStorage csak offline tükör. A `useSettingsStore` szinkronizál a kettő között (RTDB → store → `useAudio`).
- **`useGameStore`** `bestServiceSeconds`-je (`space-travel-game` persist) → bejelentkezéskor összefésül az RTDB `stats.bestServiceSeconds`-szel (a nagyobb nyer), majd az RTDB lesz mérvadó.
- **Nyelv:** a Firebase `settings.language` és az i18n `space-travel-lang` (lásd [[000-i18n-nyelvesites]]) összehangolása — bejelentkezéskor az RTDB nyelv nyer, kijelentkezve a helyi detektált nyelv.
- **Új persist kulcsok** nem szükségesek a Firebase-adatokhoz (az RTDB a forrás); ha offline-tükör kell, külön `space-travel-firebase-cache` kulcs, hogy ne ütközzön a meglévőkkel.

---

## 8. Megvalósítási lépések (sorrend)

1. Firebase projekt + Auth (Google, Anonymous) + Realtime Database létrehozása; env változók.
2. `firebase/config.ts`, `firebase/auth.ts`, `firebase/userData.ts`.
3. **Security Rules** beállítása (wallet/inventory szerver-only; settings user-írható).
4. `useAuthStore` + anonymous auto-login az app indulásakor; `onAuthStateChanged` bekötése.
5. `ensureUserNode` + `subscribeUser` → `useSettingsStore` / `useInventoryStore` feltöltés bejelentkezéskor.
6. **`SettingsMenu`** + `AccountSection`; az `App.tsx` `bellOverlay` → `settingsOverlay` csere; zene-némítás áthelyezése a panelbe.
7. Google-bejelentkezés + anonymous→Google **linkelés** a Settings menüből.
8. **`GamePhase: "shipSelect"`** bevezetése; `MainMenu` cél-választás → pending destination → `shipSelect`; `ScreenRouter` ág.
9. **`ShipSelect`** komponens: alap hajó mindig + birtokolt hajók; üres inventory → csak alap; „Indítás" → `activeShipId` + kamera-ellenőrzés + `startMission(ship)`.
10. **Sebesség-integráció**: aktív hajó sebessége → `travelYears` / `Dashboard` / `MainMenu` becslés.
11. Zene-integráció: `useAudio` az aktív zene URL-jével (birtokolt zenékből).
12. **Cloud Function** (`awardWage`) a wage → kredit jóváíráshoz; wallet/inventory szerver-írás.
13. Nyelv/rekord/némítás összefésülés a meglévő store-okkal.
14. **Strapi↔Firebase híd** (a bolt-tervből): Stripe webhook → Admin SDK → `inventory` írás.

---

## 9. Kockázatok / figyelmeztetések

- **Két backend szinkronban tartása** (Firebase + Strapi) a fő komplexitás — a tiszta határ (Firebase olvas, Strapi fizet, Admin SDK ír) elengedhetetlen, különben szétcsúsznak az adatok.
- **Biztonság:** a `wallet` és `inventory` **soha** ne legyen kliens-írható — a Security Rules ennek a sarokköve. A `settings.activeShipId`-t a játék validálja a birtoklás ellen.
- **Anonymous → Google linkelés** él eset: ha a Google-fiók már létezik másik uid alatt, ütközés (`credential-already-in-use`) — kezelni kell (fiók-összevonás vagy figyelmeztetés).
- **Alap hajó** mindig elérhető, nem az inventory része — külön konstansként kezelendő, hogy az üres-inventory eset működjön.
- **Offline / autoplay:** RTDB listener offline gyorsítótárral; a Stripe/redirect utáni visszatéréskor az auth session helyreáll (Firebase perzisztens auth).
- **`base href`** (`/realtime_space_travel/`) és a Google OAuth **engedélyezett domainek** (Firebase Auth authorized domains) egyeztetése éles/preview környezetre.
- **Adatvédelem:** Google profil (név, avatar) tárolása → GDPR-tájékoztatás; törlési lehetőség (fiók + RTDB csomópont).

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
- [[002-ingame-shop-frontend]] – a **helyi (frontend-only) bolt** ELŐBB valósul meg: a `useShopStore` (localStorage) kredit/birtoklás/aktív-hajó/aktív-zene állapotát ez a terv **per-felhasználós Firebase-mentésre** cseréli (RTDB `wallet`/`inventory`/`settings`), a localStorage offline tükör lesz; a `checkout` kredit-levonása → `purchaseWithCredits` Cloud Function. Az „aktív hajó sebessége" és a „Settings zeneválasztó" integráció közös — ott úgy épül, hogy itt csak a forrás cserélődjön.
- [[004-ingame-shop-strapi-stripe]] – a birtoklás/kredit írási útja (Stripe→Strapi→Firebase Admin SDK); az „aktív hajó sebessége" integráció közös.
- [[000-i18n-nyelvesites]] – a `settings.language` a nyelvi réteget vezérli.
