# Tervezett Architektúra

> Ez a fájl a Realtime Space Travel projekt **tervezett** (jövőbeli) architektúráját dokumentálja, a `./plans/` mappában lévő tervek alapján.

## Áttekintés – Cél architektúra

```
┌─────────────────────────────────────────────────────────────────┐
│                        React SPA (Vite)                         │
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │  ScreenRouter │    │   App.tsx    │    │   Starfield.tsx  │  │
│  │  (fázis alapján)│  │  (logikai    │    │   (Canvas csillag │  │
│  │              │    │   központ)    │    │    mező animáció) │  │
│  └──────┬───────┘    └──────┬───────┘    └──────────────────┘  │
│         │                   │                                   │
│  ┌──────▼───────┐    ┌──────▼───────┐    ┌──────────────────┐  │
│  │ Komponensek  │    │   Hook-ok    │    │   i18n (5 nyelv) │  │
│  │ (UI réteg)   │    │  (logika)    │    │   react-i18next  │  │
│  └──────────────┘    └──────────────┘    └──────────────────┘  │
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │useGameStore  │    │  useUIStore  │    │  useAuthStore    │  │
│  │(Zustand)     │    │  (Zustand)   │    │  (Zustand)      │  │
│  └──────────────┘    └──────────────┘    └──────────────────┘  │
│  ┌──────────────┐    ┌──────────────┐                          │
│  │useSettings   │    │useInventory  │                          │
│  │Store         │    │Store         │                          │
│  └──────────────┘    └──────────────┘                          │
└─────────────────────────────────────────────────────────────────┘
         │                                       │
         │ Webkamera + TensorFlow.js             │ Firebase Auth
         ▼                                       ▼
┌─────────────────────────────┐  ┌──────────────────────────────┐
│   MediaPipe Face Detection  │  │     Firebase (Auth + RTDB)   │
│  (ugyanaz, mint most)       │  │                              │
└─────────────────────────────┘  │  users/{uid}/                │
                                 │    profile: { ... }          │
                                 │    settings: { ... }         │
                                 │    wallet: { credits }       │
                                 │    inventory: { ships, ... } │
                                 │    stats: { bestService... } │
                                 └──────────────────────────────┘
                                           │
                                           │ Cloud Functions
                                           ▼
                                 ┌──────────────────────────────┐
                                 │  Firebase Cloud Functions    │
                                 │  - awardWage (wage → kredit) │
                                 │  - purchaseWithCredits       │
                                 └──────────────────────────────┘
                                           │
                                           │ Strapi ↔ Firebase híd
                                           ▼
                                 ┌──────────────────────────────┐
                                 │      Strapi CMS              │
                                 │  - Product katalógus         │
                                 │  - Order (pénzügy)           │
                                 │  - i18n plugin               │
                                 └──────────────┬───────────────┘
                                                │
                                                │ Stripe webhook
                                                ▼
                                 ┌──────────────────────────────┐
                                 │     Stripe Checkout          │
                                 │  (hosztolt fizetőoldal)       │
                                 └──────────────────────────────┘
```

## Implementációs fázisok

### Fázis 0 — i18n alapréteg ✅ Kész

**Állapot:** Implementálva.

- `react-i18next` + `i18next-browser-languagedetector` beépítve.
- 5 nyelv fordítás: `en`, `hu`, `fr`, `de`, `es` (teljes kulcs-paritás).
- `LanguageSwitcher` komponens a `SettingsScreen`-ben.
- Minden komponens `t()` / `<Trans>` használatra átállítva.

### Fázis 1 — Firebase Auth + Beállítások ⬜ Nem kezdődött

**Cél:** Firebase autentikáció + perzisztens felhasználói beállítások.

#### Új modulok

```
src/
  firebase/
    config.ts            # initializeApp + getAuth + getDatabase
    auth.ts              # signInWithGoogle, signInAnonymously, linkAnonymousToGoogle
    userData.ts          # RTDB olvasás/írás: subscribeUser, updateSettings, ensureUserNode
  state/
    useAuthStore.ts      # user (uid, displayName, isAnonymous), authStatus
    useSettingsStore.ts  # activeShipId, activeMusicId, musicMuted, language
    useInventoryStore.ts # ownedShips, ownedMusic, ownedDlc, credits, bestServiceSeconds
  components/
    SettingsMenu.tsx     # ⚙️ fogaskerék gomb + panel (harang helyett)
    SettingsMenu.module.css
    AccountSection.tsx   # login/logout/link Google, felhasználó kijelzés
```

#### RTDB Séma

```
users/{uid}/
  profile:   { displayName, photoURL, provider, isAnonymous, createdAt, lastLoginAt }
  settings:  { activeShipId, activeMusicId, musicMuted, language }
  wallet:    { credits }                          # CSAK szerver írhatja
  inventory: { ships, music, dlc }                # CSAK szerver írhatja
  stats:     { bestServiceSeconds }               # szerver-validált
```

#### Security Rules

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

#### Auth folyamat

1. App indulás → `signInAnonymously` (azonnal játszható).
2. `onAuthStateChanged` → `subscribeUser(uid)` → RTDB listener → store-ok feltöltése.
3. Settings menüből „Bejelentkezés Google-lel" → `linkWithCredential` (anonymous→Google).
4. Kijelentkezés → `signOut` → újra anonymous session.

#### Settings menü (harang helyett)

1. **Fiók:** bejelentkezett felhasználó neve/avatarja; Google-login/kijelentkezés.
2. **Zene:** be/ki kapcsoló + sávválasztó (birtokolt zenékből).
3. **Űrhajó:** aktív hajó kijelzése/választása.
4. **Nyelv:** nyelvváltó (összekötve az i18n-nel).
5. **Rekord:** `stats.bestServiceSeconds` megjelenítése.

### Fázis 2 — Hajóválasztó + Sebesség ⬜ Nem kezdődött

**Cél:** Küldetésválasztás után hajóválasztás; sebesség az aktív hajóból.

#### Új GamePhase

- `GamePhase: "shipSelect"` bevezetése.
- `phaseToFlags`: `shipSelect` = szüneteltetett pre-game állapot.

#### Új folyamat

```
MainMenu → MissionSelector → pending destination → shipSelect (ÚJ)
  → ShipSelect komponens → hajó megerősítése
  → kamera-ellenőrzés → startMission(destination, ship)
  → loading → playing
```

#### ShipSelect komponens

- Lista: **alap hajó** (mindig) + `inventory.ships` birtokolt hajók.
- Üres inventory → csak az alap hajó választható.
- Hajó adatai: név, sebesség (km/s), célhoz számított utazási idő.
- „Indítás" → `activeShipId` + kamera-ellenőrzés + `startMission`.

#### Sebesség-integráció

- `startMission` a kiválasztott hajó sebességéből számolja a `travelYears`-t.
- `Dashboard` sebesség-kijelzője és a `MainMenu` utazásiidő-becslése is aktív hajóból.
- Zene-integráció: `useAudio` az aktív zene URL-jével.

### Fázis 3 — Bolt Backend (Strapi + Cloud Functions) ⬜ Nem kezdődött

**Cél:** Strapi katalógus + Stripe fizetés + kredit műveletek.

#### Strapi

- `Product` content type (név, leírás, ár, típus, payload).
- `Order` content type (pénzügyi rekord).
- i18n plugin a `name`/`description` lokalizálásához.
- Firebase ID token ellenőrzés middleware.
- `/api/checkout` endpoint (Stripe Session létrehozás).
- `/api/webhooks/stripe` endpoint (fizetés megerősítés → Admin SDK → Firebase inventory).

#### Cloud Functions

- `awardWage` (callable) – küldetés végi kredit jóváírás (RTDB tranzakció).
- `purchaseWithCredits` (callable) – kredites vásárlás (egyenleg-ellenőrzés + levonás + inventory bővítés).

#### Adatfolyamat (valós pénz)

```
Frontend → POST /api/checkout (Firebase ID token + productSlug)
  → Strapi ellenőrzi tokent → Stripe Checkout Session
  → Frontend → Stripe fizetőoldal
  → Sikeres → Stripe webhook → Strapi → Order + Admin SDK → Firebase inventory
  → Frontend visszatér → real-time listener → termék feloldva
```

#### Adatfolyamat (kredit)

```
Frontend → purchaseWithCredits (callable)
  → Cloud Function: egyenleg-ellenőrzés → levonás → inventory bővítés (RTDB tranzakció)
  → real-time listener → frissítés
```

### Fázis 4 — Bolt Frontend + Stripe + Fordítások ⬜ Nem kezdődött

**Cél:** Bolt UI + fizetési flow + bolt szövegek fordítása.

#### Új komponensek

```
src/components/
  ShopScreen.tsx         # Bolt képernyő (fülek: Hajók / DLC / Zenék)
  ShopScreen.module.css
  ProductCard.tsx        # Termékkártya (kép, név, ár, vásárlás gomb)
  ShopTabs.tsx           # Fülek (Hajók / DLC / Zenék)
  CreditBalance.tsx      # Kredit egyenleg kijelzés
  PurchaseModal.tsx      # Vásárlás megerősítő dialógus
  CheckoutReturn.tsx     # Stripe visszatérés utáni képernyő
```

#### Új GamePhase

- `GamePhase: "shop"` bevezetése.
- `MainMenu` „Áruház" gomb → `shop` fázis.

#### Vásárlási flow

```
ShopScreen → ProductCard → PurchaseModal
  → Kredit vásárlás → Cloud Function (purchaseWithCredits)
  → Valós pénz → Stripe redirect → CheckoutReturn → Firebase listener
```

## Tiszta felelősség-határ (Kánon)

```
┌─────────────────────────────────────────────────────────────────┐
│                    FELELŐSSÉGI TERÜLETEK                        │
├──────────────────┬──────────────────┬───────────────────────────┤
│    Firebase      │     Strapi       │        Stripe             │
├──────────────────┼──────────────────┼───────────────────────────┤
│ Auth (Google +   │ Termék katalógus │ Valós pénzes fizetés      │
│ Anonymous)       │ Rendelés rekord  │ Checkout Session          │
│                  │                  │                           │
│ RTDB:            │ i18n plugin      │ Webhook események         │
│ - profile        │ (name/desc)      │                           │
│ - settings       │                  │                           │
│ - wallet (írás:  │                  │                           │
│   szerver)       │                  │                           │
│ - inventory (írás│                  │                           │
│   : szerver)     │                  │                           │
│ - stats          │                  │                           │
└──────────────────┴──────────────────┴───────────────────────────┘

Szabály:
- A kliens KIZÁRÓLAG a Firebase-ből olvas minden felhasználói adatot.
- A wallet és inventory CSAK szerver-írható (Cloud Functions / Admin SDK).
- A Strapi CSAK a pénzügyi tranzakciót intézi, nem kezel usert.
```

## Új store-ok

### useAuthStore

- `uid`, `displayName`, `photoURL`, `isAnonymous`
- `status`: `"loading"` | `"anonymous"` | `"authenticated"`
- `signInWithGoogle()`, `signInAnonymously()`, `signOut()`

### useSettingsStore

- `activeShipId`, `activeMusicId`, `musicMuted`, `language`
- RTDB-vel szinkronban (real-time listener)
- Offline: localStorage tükör

### useInventoryStore

- `ownedShips`, `ownedMusic`, `ownedDlc`, `credits`
- RTDB read-only tükör (szerver-írt)
- `activeShipId` validálása betöltéskor (ha nincs birtokban, alap hajóra áll vissza)

## Környezeti változók (bővítés)

| Változó | Leírás |
|---|---|
| `VITE_FIREBASE_API_KEY` | Firebase API kulcs |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Auth domain |
| `VITE_FIREBASE_DATABASE_URL` | Firebase RTDB URL |
| `VITE_FIREBASE_PROJECT_ID` | Firebase projekt azonosító |
| `VITE_FIREBASE_APP_ID` | Firebase App azonosító |

## Kockázatok

- **Két backend szinkronban tartása** (Firebase + Strapi) — a tiszta határ elengedhetetlen.
- **Security Rules:** wallet/inventory soha ne legyen kliens-írható.
- **Anonymous→Google linkelés:** ha a Google-fiók már létezik másik uid alatt, ütközés → kezelés kell.
- **Offline:** RTDB listener offline gyorsítótár; Stripe redirect utáni visszatérés → auth session helyreáll.
- **base href + OAuth domainek:** engedélyezett domainek egyeztetése.
