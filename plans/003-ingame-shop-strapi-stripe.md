---
title: "Játékon belüli áruház terve – Strapi katalógus + Stripe fizetés"
slug: 003-ingame-shop-strapi-stripe
type: plan
category: shop
status: not-started
implemented: false
implemented_at: null
created_at: "2026-07-25"
updated_at: "2026-07-25"
author: exphoenee
step: 3
phases:
  - 3
  - 4
dependencies:
  - 002-firebase-auth-settings
related_plans:
  - 000-i18n-nyelvesites
  - 001-main-menu-settings
  - 002-firebase-auth-settings
tags:
  - strapi
  - stripe
  - shop
  - payments
  - cloud-functions
  - firebase-admin
---

# Játékon belüli áruház terve – Strapi katalógus + Stripe fizetés (Firebase read-modellel)

**Cél:** játékon belüli bolt, ahol a játékos **űrhajókat**, **DLC csillagrendszereket/bolygókat** és **zenéket** (stb.) vásárolhat kreditből vagy valós pénzből.

> ### 🔗 Architektúra-kánon (mindhárom terv erre épül)
> A felelősség-határ a [[002-firebase-auth-settings]] tervben véglegesített:
> - **Firebase = auth + a játék olvasási modellje.** A kliens **kizárólag a Firebase-ből olvas** minden felhasználói adatot: kredit-egyenleg, birtokolt hajók/zenék/DLC, beállítások, rekord. Az auth is Firebase (Google + Anonymous→fiók).
> - **Strapi = katalógus + rendelés-nyilvántartás.** A termékadatok (ár, típus, payload) és a rendelési/pénzügyi rekordok itt élnek.
> - **Stripe = valós pénzes fizetés.** A Stripe webhook → Strapi, és a Strapi a **Firebase Admin SDK**-val írja be a megvett tételt a felhasználó Firebase csomópontjába. Így a Firebase marad az egyetlen olvasási forrás a játéknak.
> - **Kredit-műveletek (wage-jóváírás, kredites vásárlás) = Firebase Cloud Function** (nincs valós pénz, marad Firebase-en belül).
>
> **Ez a terv a katalógust, a Stripe-fizetést és a bolt-UI-t részletezi.** Az auth, a kredit/inventory tárolás és a Security Rules a [[002-firebase-auth-settings]] tervben van.

## Döntések (egyeztetve)

| Kérdés | Választás |
|--------|-----------|
| Fizetési átjáró | **Stripe Checkout** (hosztolt fizetőoldal + webhook) |
| Pénznem-modell | **Hibrid**: küldetés-jutalom (`wage`) → játékbeli **kredit**; prémium tartalom valós pénzért |
| Auth / vendég→fiók | **Firebase Auth** (Google + Anonymous→fiók) — lásd [[002-firebase-auth-settings]]. A Strapi **nem** kezel usert/guest-tokent, csak Firebase ID tokent ellenőriz. |
| Kredit + birtoklás forrása | **Firebase RTDB** (szerver-írt), a Strapi Admin SDK-val ír bele fizetés után |

---

## ✅ Haladás (TODO)

> Jelölés: `[ ]` hátravan · `[~]` folyamatban · `[x]` kész. Implementáció közben itt vezetjük, hol tartunk, hogy félbeszakadás után folytatható legyen. Előfeltétel: a [[002-firebase-auth-settings]] Fázis 1 (auth + RTDB + Security Rules) áll. Részletek a lenti szekciókban.

**A fázis — Strapi (katalógus + Stripe)**
- [ ] Strapi projekt (külön repo vagy `/server`) + adatbázis
- [ ] `Product` + `Order` content type-ok (i18n plugin a `name`/`description`-höz)
- [ ] Firebase ID token ellenőrzés middleware (`verifyIdToken`)
- [ ] `/api/checkout` (Session + uid metaadat)
- [ ] `/api/webhooks/stripe` (aláírás → `Order` → **Admin SDK inventory-írás**)
- [ ] Seed: 2-3 hajó, „Tejút DLC", 2-3 zene

**B fázis — Firebase Cloud Functions**
- [ ] `purchaseWithCredits` (kredites vétel, RTDB tranzakció)
- [ ] `awardWage` (küldetés végi kredit) — **közös** [[002-firebase-auth-settings]]

**C fázis — Frontend**
- [ ] `useCatalog` (Strapi) + `useEntitlements` (Firebase inventory)
- [ ] `ShopScreen` + `ProductCard` + `ShopTabs` + `CreditBalance`
- [ ] `GamePhase: "shop"` + `ScreenRouter` ág + „Áruház" gomb a `MainMenu`-be
- [ ] DLC zárolt/feloldott logika (Firebase `inventory.dlc`)
- [ ] Aktív hajó/zene integráció (**közös** [[002-firebase-auth-settings]])
- [ ] `PurchaseModal` (kredit → Cloud Function) + Stripe redirect + `CheckoutReturn`
- [ ] Küldetés végén `wage` → `awardWage` bekötés

**D fázis — Tesztelés / élesítés**
- [ ] Stripe teszt-vásárlások (siker/megszakítás/visszatérítés) + webhook idempotencia
- [ ] Anti-cheat ellenőrzés (kredit/inventory Firebase szerver-írt, Security Rules)
- [ ] Vitest (`useCatalog`/`useEntitlements`) + e2e checkout happy-path
- [ ] CORS + env kulcsok + `base href` a redirect URL-eknél

---

## 1. Architektúra áttekintés

```
┌────────────────────────┐   katalógus (GET)   ┌──────────────────────┐
│    React SPA (Vite)    │ ──────────────────▶ │      Strapi CMS      │
│  - Áruház UI           │ ◀────────────────── │  - Product katalógus │
│  - kredit/inventory    │                     │  - Order (pénzügy)   │
│    OLVASÁS: Firebase   │   checkout (POST)   │  - Stripe integráció │
└───┬───────────────┬────┘ ──────────────────▶ └─────┬──────────┬─────┘
    │ auth + adat   │ (Firebase ID token)             │ webhook  │ Admin SDK
    │ (olvasás)     ▼                                 ▼ (fizetés)│ (inventory írás)
    │        ┌─────────────┐  redirect  ┌──────────────────┐    │
    │        │   Stripe    │ ◀───────── │ Stripe Checkout  │    │
    │        │  Checkout   │ ─────────▶ │ (hosztolt oldal) │    │
    │        └─────────────┘  webhook   └──────────────────┘    │
    ▼                                                           ▼
┌────────────────────────────────────────────────────────────────┐
│  Firebase (Auth + Realtime DB)  ← a játék EGYETLEN olvasási forrása │
│  users/{uid}/wallet.credits · inventory · settings · stats          │
└────────────────────────────────────────────────────────────────┘
```

**Fizetési folyamat (valós pénz):**
1. Játékos „Megvásárlás" gombra kattint az áruházban.
2. Frontend hívja a Strapi custom endpointot: `POST /api/checkout` a **Firebase ID token**kel (`Authorization: Bearer <firebaseIdToken>`) + `productSlug`.
3. Strapi ellenőrzi a Firebase ID tokent (Admin SDK `verifyIdToken`), majd létrehoz egy Stripe **Checkout Session**-t (szerveroldali titkos kulccsal), a metaadatba téve a `uid`-t és `productSlug`-ot; visszaadja a `session.url`-t.
4. Frontend átirányít a Stripe hosztolt fizetőoldalra.
5. Sikeres fizetés → Stripe **webhook** (`checkout.session.completed`) → Strapi ellenőrzi az aláírást, létrehoz egy `Order`-t (pénzügyi rekord), majd **Firebase Admin SDK**-val beírja a tételt a `users/{uid}/inventory`-ba.
6. Frontend a `success_url`-ről visszatér; a Firebase real-time listener (lásd [[002-firebase-auth-settings]]) automatikusan frissíti az `inventory`-t → a termék feloldva.

**Kredit-vásárlás (játékbeli valuta, nem valós pénz):**
- **Nem érinti sem a Stripe-ot, sem a Strapit.** Egy **Firebase Cloud Function** (`purchaseWithCredits`, callable) **atomikusan** (RTDB tranzakció) ellenőrzi az egyenleget, levonja a kreditet, és hozzáadja az `inventory`-t. Az árat a függvény a Strapi katalógusból (vagy egy szinkronizált konfigból) olvassa — a kliens csak `productSlug`-ot küld.

---

## 2. Miért kell backend + hol az igazságforrás

A jelenlegi app **teljesen kliensoldali** (nincs backend/auth, minden `localStorage`-ban: `space-travel-game`, `space-travel-ui`). Valós fizetéshez és jogosultság-kezeléshez **szerveroldali igazságforrás kell**, különben a vásárlások hamisíthatók. A felelősség-megosztás:

- A **kredit-egyenleg** és a **birtoklás (inventory)** mérvadó példánya a **Firebase RTDB**-ben él, **szerver-írt** csomópontként (`wallet`/`inventory` a Security Rules szerint kliensből nem írható — lásd [[002-firebase-auth-settings]] 2. pont).
- A **termékkatalógus** és a **pénzügyi rendelés-rekord** a **Strapiban** él.
- A kliens `localStorage` csak offline tükör; az élő adat a Firebase listenerből jön.
- A `wage` jutalmat a küldetés végén **Cloud Function** írja jóvá (nem a kliens).

---

## 3. Strapi – Content Types (adatmodell)

> A **kredit** és a **birtoklás (entitlement)** **NEM** Strapiban él, hanem a Firebase RTDB-ben (lásd [[002-firebase-auth-settings]]). A Strapi felhasználó-fogalma minimális: a rekordokat a **Firebase `uid`** azonosítja, nincs Strapi Users & Permissions login, nincs guest-token.

### `Product` (termék) — a katalógus forrása
| mező | típus | megjegyzés |
|------|-------|-----------|
| `slug` | UID | egyedi azonosító (`ship-nebula`, `dlc-milky-way`, `music-ambient-1`) |
| `type` | enum | `ship` \| `dlc` \| `music` \| `cosmetic` |
| `name` | i18n string | lokalizált (Strapi i18n plugin, lásd [[000-i18n-nyelvesites]]) |
| `description` | i18n text | lokalizált |
| `priceCredits` | integer\|null | ha kreditből vehető |
| `priceStripeId` | string\|null | Stripe Price ID, ha valós pénzért |
| `currency` | enum | `credits` \| `money` \| `both` |
| `media` | media | ikon/kép/előnézet |
| `payload` | JSON | típusfüggő adat (lásd lent) |
| `active` | boolean | látható-e a boltban |
| `sortOrder` | integer | rendezés |

**`payload` típusonként:**
- `ship`: `{ speedKmPerSecond, thumbnail, modelRef }` → felülírja a `SHIP_SPEED_KM_PER_SECOND`-t.
- `dlc`: `{ destinations: [{ name, distanceLy, wage }] }` → új célállomások (a `baseDestinations` bővítése).
- `music`: `{ trackUrl, loop, title }` → a `useAudio` betölthető sávjai.

### `Order` (rendelés) — pénzügyi rekord (csak valós pénz)
`firebaseUid` (string) · `items` (rel Product) · `stripeSessionId` · `stripePaymentIntent` · `amountTotal` · `currency` · `status` (`pending`\|`paid`\|`failed`\|`refunded`) · `entitlementWritten` (boolean, jelzi hogy a Firebase inventory-írás megtörtént) · `createdAt`. **Csak könyvelési/audit célra** — a birtoklás forrása a Firebase.

> **Nincs** `Entitlement`, `User(credits/guestToken)`, `WalletTransaction` Strapi content type. Ezek Firebase-ben élnek:
> - birtoklás → `users/{uid}/inventory` (RTDB),
> - egyenleg → `users/{uid}/wallet.credits` (RTDB),
> - kredit-napló → opcionálisan `users/{uid}/walletLog` (RTDB, szerver-írt) vagy Cloud Function log.

---

## 4. Backend endpointok és függvények

### Strapi (katalógus + Stripe)
| Metódus | Útvonal | Feladat | Auth |
|---------|---------|---------|------|
| `GET` | `/api/products` | aktív katalógus (típus/pénznem szűrhető), lokalizált | publikus |
| `POST` | `/api/checkout` | Stripe Checkout Session létrehozása egy termékre | Firebase ID token |
| `POST` | `/api/webhooks/stripe` | Stripe webhook → `Order` + **Firebase inventory írás (Admin SDK)** | Stripe aláírás |

### Firebase Cloud Functions (kredit-műveletek, nincs valós pénz)
| Típus | Név | Feladat |
|-------|-----|---------|
| callable | `purchaseWithCredits` | egyenleg-ellenőrzés + levonás + inventory bővítés (RTDB tranzakció) |
| callable | `awardWage` | küldetés lezárása → `wallet.credits` növelés (anti-cheat validáció) |

> **Kliens olvasás:** az entitlementet és a kreditet a játék **közvetlenül a Firebase RTDB-ből** olvassa (real-time listener), nem Strapi endpointból. Ezért nincs `/api/me/entitlements` és `/api/me/wallet`.

**Biztonság:**
- A webhook **kötelezően** ellenőrizze a Stripe aláírást (`stripe.webhooks.constructEvent`).
- A Stripe titkos kulcs **csak** a Strapi env-ben (`STRIPE_SECRET_KEY`); a Firebase Admin SDK service-account kulcs **csak** a Strapi/Functions env-ben.
- Az árakat a szerver határozza meg a `Product`-ból; a kliens csak `productSlug`-ot küld.
- Idempotencia: a webhook `checkout.session.id` / `Order.entitlementWritten` alapján ne írjon duplán a Firebase-be.
- A `wallet`/`inventory` RTDB-írás **kizárólag** Admin SDK-ból (webhook) vagy Cloud Functionből történhet — kliensből a Security Rules tiltja.

---

## 5. Frontend – React változtatások

### Új mappastruktúra
```
src/
  shop/
    ShopScreen.tsx            # bolt fő nézet (fülek: Hajók / DLC / Zene)
    ProductCard.tsx           # egy termék + ár (kredit / $ / mindkettő) + gomb
    ShopTabs.tsx              # kategória fülek
    CreditBalance.tsx         # fejléc kredit-kijelző (Firebase wallet-ből)
    PurchaseModal.tsx         # megerősítés (kredit) / Stripe-átirányítás
    CheckoutReturn.tsx        # success/cancel visszatérés kezelése
    ShopScreen.module.css
  services/
    strapiApi.ts              # Strapi kliens: products, checkout (Firebase ID tokennel)
    functionsApi.ts           # Cloud Functions hívások: purchaseWithCredits, awardWage
  hooks/
    useCatalog.ts             # Strapi katalógus lekérés + cache
    useEntitlements.ts        # birtokolt termékek Firebase-ből + „owns(slug)" segéd
```

> **Nincs** külön `useAuthStore` és `useShopStore(credits/entitlements)` ebben a tervben — ezeket a [[002-firebase-auth-settings]] biztosítja (`useAuthStore`, `useInventoryStore`, `useSettingsStore`). A bolt ezekre épül; itt csak a **katalógus** (`useCatalog`) új.

### Integráció a meglévő kóddal
- **Belépési pont a boltba:** a `MainMenu.tsx` már reklámozza a „Tejút DLC"-t → ide „Áruház" gomb, a `ShopScreen`-t nyitja. Új `GamePhase: "shop"` (`src/types/index.ts` + `useGameStore` `phaseToFlags`), `ScreenRouter` ág. (A Settings menüből is elérhető, lásd [[002-firebase-auth-settings]].)
- **Célállomások (DLC):** a destinations = `baseDestinations` + a birtokolt `dlc` termékek `payload.destinations`. A birtoklást a **Firebase `inventory.dlc`** adja; a nem birtokolt DLC „zárolt" kártyaként → boltba visz.
- **Űrhajók (sebesség):** **közös** a [[002-firebase-auth-settings]] „aktív hajó" integrációjával — **egyszer, egységesen** valósítandó meg. Az aktív hajót a Firebase `settings.activeShipId` tartja, a birtoklást az `inventory.ships`; a sebesség felülírja a `SHIP_SPEED_KM_PER_SECOND`-t a `startMission`/`Dashboard`/`MainMenu` becslésben. A hajóválasztó képernyő a [[002-firebase-auth-settings]] `ShipSelect`-je.
- **Zenék:** a `useAudio` az **aktív zene** URL-jét kapja (Firebase `settings.activeMusicId` + `inventory.music`), alap = jelenlegi téma. A zeneválasztó a **Settings menüben** van (lásd [[002-firebase-auth-settings]]).
- **Kredit forrása (wage):** a küldetés végén (`missionComplete`) a `wage` jóváírása a **`awardWage` Cloud Function**nel (a `handleConfirmExit`/`missionComplete` ágból).

### Vásárlási folyamat a kliensen
- **Kredites vétel:** `PurchaseModal` → `functionsApi.purchaseWithCredits(slug)` → siker esetén a Firebase listener frissíti az inventory-t/kreditet.
- **Valós pénzes vétel:** `strapiApi.createCheckout(slug)` (Firebase ID tokennel) → `session.url`-re redirect → visszatéréskor `CheckoutReturn` megvárja a Firebase inventory frissülését.

---

## 6. Stripe konfiguráció

- Stripe Dashboard: minden valós pénzes `Product`-hoz **Price** objektum, a `priceStripeId` ezt tükrözi.
- Módok: **egyszeri fizetés** (DLC, hajó, zene). Előfizetés jelenleg nem szükséges.
- Env változók (Strapi oldalon): `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY`, **`FIREBASE_SERVICE_ACCOUNT`** (Admin SDK az inventory-íráshoz).
- **Teszt mód:** Stripe test kulcsok + `stripe listen --forward-to localhost:1337/api/webhooks/stripe`.
- `success_url` / `cancel_url` a frontend `CheckoutReturn` útvonalaira mutasson (a `base href` `/realtime_space_travel/`-t figyelembe véve), `session_id` query paraméterrel.

---

## 7. Megvalósítási lépések (sorrend)

> Előfeltétel: a [[002-firebase-auth-settings]] auth + RTDB séma + Security Rules már áll (a kredit/inventory oda íródik).

**A fázis – Strapi (katalógus + Stripe)**
1. Strapi projekt (külön repo vagy `/server`), Postgres/SQLite.
2. `Product` + `Order` content type-ok (i18n plugin a `name`/`description`-höz).
3. **Firebase ID token ellenőrzés** middleware (Admin SDK `verifyIdToken`) a védett endpointokhoz.
4. `/api/checkout` (Session + uid metaadat) + `/api/webhooks/stripe` (aláírás-ellenőrzés → `Order` → **Admin SDK inventory írás**).
5. Seed: 2-3 hajó, „Tejút DLC", 2-3 zene.

**B fázis – Firebase Cloud Functions**
6. `purchaseWithCredits` és `awardWage` callable függvények (RTDB tranzakció, ár a katalógusból).

**C fázis – Frontend**
7. `useCatalog` (Strapi) + `useEntitlements` (Firebase inventory-ból).
8. `ShopScreen` + `ProductCard` + `ShopTabs` + `CreditBalance`; `GamePhase: "shop"` + `ScreenRouter` ág.
9. „Áruház" gomb a `MainMenu`-be; DLC zárolt/feloldott logika a Firebase inventory alapján.
10. Aktív hajó/zene integráció (**közös** a [[002-firebase-auth-settings]] tervvel).
11. `PurchaseModal` (kredit → Cloud Function) + Stripe redirect + `CheckoutReturn`.
12. Küldetés végén `wage` → `awardWage` bekötése.

**D fázis – Tesztelés / élesítés**
13. Stripe teszt-vásárlások (siker, megszakítás, visszatérítés), webhook újrapróbálkozás + idempotencia.
14. Anti-cheat: kredit/inventory mindig Firebase szerver-írt; a Security Rules ellenőrzése.
15. Vitest: `useCatalog`/`useEntitlements` logika, API-mock; e2e a checkout happy-path-ra.
16. CORS + env kulcsok éles beállítása; `base href` a redirect URL-eknél.

---

## 8. Kockázatok / figyelmeztetések

- **Két backend (Firebase + Strapi) szinkronban tartása** a fő komplexitás — a tiszta határ (Firebase olvas, Strapi/Stripe fizet, Admin SDK ír Firebase-be) elengedhetetlen. Lásd [[002-firebase-auth-settings]] 0. és 9. pont.
- **Biztonság a legkritikusabb:** a birtoklás és a kredit **soha** ne legyen kliensoldalon mérvadó. Webhook-aláírás + Firebase Security Rules (wallet/inventory szerver-only) kötelező.
- **Idempotencia:** a webhook duplán ne írjon a Firebase inventory-ba (`Order.entitlementWritten` / `session.id` kulcs).
- **Vendég→fiók:** ezt a **Firebase Anonymous→Google linkelés** oldja meg (lásd [[002-firebase-auth-settings]]), **nem** Strapi guest-token — az kikerült.
- **i18n:** a termékek nevei/leírásai a Strapi i18n pluginjén lokalizáltak, a felület nyelvét az [[000-i18n-nyelvesites]] adja; a felhasználó nyelvét a Firebase `settings.language` tartja.
- **`base href` / útvonalak:** `/realtime_space_travel/` alatt fut, a Stripe redirect és a router ehhez igazodjon.
- **Jog/pénzügy:** valós fizetésnél ÁFA/számla/visszatérítés/GDPR — merchant-of-record (Paddle/Lemon Squeezy) egyszerűsítheti később.
- **Autoplay + fizetés-redirect:** a Stripe redirect elhagyja az oldalt; visszatéréskor a Firebase auth session és a játékállapot helyreáll.

---

## 9. Becsült ráfordítás (nagyságrend)

| Fázis | Nagyságrend |
|-------|-------------|
| Strapi (Product/Order, Firebase ID token, Stripe, webhook→Admin SDK) | ~2–4 nap |
| Cloud Functions (purchaseWithCredits, awardWage) | ~1 nap |
| Frontend áruház UI + katalógus | ~3–4 nap |
| Integráció (hajó-sebesség, zene, DLC-célok — közös a Firebase-tervvel) | ~1–2 nap |
| Tesztelés, biztonság, élesítés | ~2–3 nap |

**Kész definíció:** a játékos az áruházban hajót/DLC-t/zenét vehet kreditből (Cloud Function) vagy valós pénzből (Stripe→Strapi→Firebase); a birtoklás és a kredit a Firebase RTDB-ben rögzül és onnan tölt be; a DLC új célállomásokat ad, a hajó módosítja a sebességet, a zene a háttérzenét; a vendég (Anonymous) is vásárolhat, a haladat Google-fiókhoz köthető.

---

## 10. Kapcsolódó tervek

- [[002-firebase-auth-settings]] – **kánon**: auth, kredit/inventory RTDB tárolás, Security Rules, aktív hajó/zene, Settings menü, ship-select.
- [[000-i18n-nyelvesites]] – a termékkatalógus és a bolt-UI szövegeinek nyelvi rétege.
