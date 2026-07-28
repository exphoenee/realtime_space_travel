---
title: "Valós pénzes kredit vásárlás – Stripe Payment Links"
slug: 005-ingame-shop-strapi-stripe
type: plan
category: shop
status: in-progress
implemented: false
implemented_at: null
created_at: "2026-07-25"
updated_at: "2026-07-26"  # frissítve: dev/prod Payment Link szétválasztás (getPaymentLinkUrl)
author: exphoenee
step: 5
phases:
  - 3
  - 4
dependencies:
  - 003-firebase-auth-settings
  - 004-firebase-auth-bugfix
related_plans:
  - 000-i18n-nyelvesites
  - 001-main-menu-settings
  - 002-ingame-shop-frontend
  - 011-stripe-fraud-defense
  - 012-stripe-go-live
tags:
  - stripe
  - payments
  - payment-links
  - shop
---

# Valós pénzes kredit vásárlás – Stripe Payment Links

**Cél:** a játékos 4 féle kredit-pakkot vásárolhasson valós pénzért Stripe Payment Links segítségével. **Nincs Cloud Functions, nincs webhook** — a Spark (ingyenes) Firebase terv miatt a Cloud Functions nem elérhető, ezért a Stripe Payment Links + kliensoldali jóváírás út a megoldás.

> **Architektúra (egyszerűsített):**
> - **Stripe Payment Links** = hosztolt fizetőoldal (redirect) — nincs szükség backendre
> - **sessionStorage + localStorage** = függőben lévő vásárlás mentése a Stripe redirect előtt
> - **URL detektálás App.tsx-ben** = Stripe-ról visszatérve `/shop/success` path → auto-navigate to shop
> - **Firebase RTDB** = a kredit-egyenleg egyetlen igazságforrása (`updateUserWallet`)
> - **A 4 CreditPack fix konstans** → `src/constants/shopCatalog.ts`-ban

## Döntések (egyeztetve)

| Kérdés | Választás |
|--------|-----------|
| Fizetési átjáró | **Stripe Payment Links** (nem Checkout Session — nincs CF szükséges) |
| Kredit-pakkok | 5€ → 100⭐ · 10€ → 300⭐ · 25€ → 700⭐ · 100€ → 2000⭐ |
| Spark terv korlát | ❌ Nincs Cloud Functions → nincs webhook, nincs createCheckoutSession |
| Visszatérés kezelés | URL path detektálás (`/shop/success`) → `queueMicrotask` → `transitionTo("shop")` |
| Pending purchase tárolás | **sessionStorage + localStorage** dupla írás (localStorage túléli a page load ciklust) |
| Kredit írása | Kliensoldali `buyCredits` → `updateUserWallet` (RTDB `set`, Phase-1 rules) |
| Kredit forrása | Firebase RTDB `wallet.credits` (kliens-írható Phase-1-ben, később CF + Phase-2 rules) |
| Dev vs. prod visszatérés | **Külön Payment Link készlet** dev-re és prodra (`getPaymentLinkUrl` választ `import.meta.env.DEV` alapján) |

> ℹ️ **Miért kell két linkkészlet?** A Payment Link visszatérési címe (`after_completion.redirect.url`) **magán a Stripe objektumon** van tárolva — a frontend nem tudja futásidőben felülírni. Egy link tehát pontosan **egy** fix visszatérési címet jelent, így a dev (localhost) és a prod (Firebase Hosting) visszatérés külön linkeket igényel.

---

## ✅ Haladás (TODO)

> Jelölés: `[ ]` hátravan · `[~]` folyamatban · `[x]` kész.

**A fázis — Stripe fiók + Payment Links**
- [x] Stripe fiók létrehozva (teszt mód)
- [x] 4 Payment Link létrehozva a Stripe API-n keresztül (`scripts/create_payment_links.mjs`)
- [x] `stripe` npm package telepítve
- [x] Stripe best-practices skill telepítve a projekthez
- [x] `create_payment_links.mjs`: `--redirect=<url>` CLI paraméter (alapértelmezés a prod URL)
- [x] `create_payment_links.mjs`: beégetett `sk_test_` kulcs kivezetve → `loadEnv` (`vite`) olvassa a `VITE_STRIPE_SECRET_KEY`-t a `.env`-ből; a kimenet megmondja, melyik mezőbe (`stripePaymentLink` / `stripePaymentLinkDev`) kell beilleszteni
- [x] 4 **dev** Payment Link létrehozva (`--redirect=http://localhost:5173/realtime_space_travel/shop/success`) — összesen 8 teszt-link, API-lekérdezéssel visszaigazolva
- [x] `.env` + `.env.example`: `VITE_STRIPE_SECRET_KEY` változó
- [x] `deploy.yml` + `deploy-firebase.yml`: `VITE_STRIPE_SECRET_KEY: ${{ secrets.VITE_STRIPE_SECRET_KEY }}` a build env-ben

**B fázis — Frontend integráció**
- [x] `CreditPack` típus bővítve: +`stripePaymentLink: string` (`src/types/index.ts`)
- [x] `CreditPack` típus bővítve: +`stripePaymentLinkDev?: string` (opcionális, prod fallbackkel)
- [x] 4 kredit pakkhoz `stripePaymentLink` URL-ek a `shopCatalog.ts`-ban
- [x] Mind a 4 pakk megkapta a `stripePaymentLinkDev` URL-t
- [x] `getPaymentLinkUrl(pack)` export a `shopCatalog.ts`-ban — `import.meta.env.DEV` alapján dev/prod link
- [x] `CreditShopView`: `pack.stripePaymentLink` helyett `getPaymentLinkUrl(pack)`
- [x] `CreditShopView`: gomb → sessionStorage+localStorage mentés → Stripe redirect
- [x] `ShopScreen`: useEffect sessionStorage+localStorage olvasás → `buyCredits` → success view
- [x] `App.tsx`: Stripe visszatérés URL detektálás → auto-navigate to shop

**C fázis — Visszatérés kezelés (Stripe → SPA)**
- [x] App.tsx: `window.location.pathname.includes("/shop/success")` → `queueMicrotask` → `transitionTo("shop")`
- [x] Dupla storage írás: sessionStorage + localStorage a `CreditShopView.handleBuy`-ban
- [x] Dupla storage olvasás: sessionStorage elsődleges, localStorage fallback a `ShopScreen` useEffect-ben
- [x] Közös `clear()` helper: mindkét storage törlése siker/lejárat/érvénytelenség esetén
- [x] Stripe MCP server telepítve (opcionális, Stripe API műveletekhez)
- [x] `/shop/success` SPA fallback igazolva a **dev szerveren** (HTTP 200 + `index.html` a válasz)

**D fázis — Tesztelés / élesítés**
- [ ] Stripe teszt-vásárlások a 4 pakkra (siker, megszakítás) — **feloldva**: eddig blokkolta, hogy a linkek a Firebase Hostingra tértek vissza; a dev linkekkel most localhoston végigjátszható
- [ ] Visszatérés tesztelése Firebase Hosting URL-en (ugyanazon origin, prod linkek)
- [x] ~~Cross-origin teszt (localhost → Firebase Hosting → localStorage nem elérhető)~~ — **tárgytalan**: dev módban a link a localhostra tér vissza, tehát a redirect azonos origin-en marad
- [ ] Deploy: `npm run build:firebase && npx firebase-tools deploy --only hosting`

---

## 1. Architektúra

```
┌──────────────────────────┐
│  React SPA (Vite)        │
│  - CreditShopView         │
│  - ShopScreen (useEffect) │
│  - App.tsx (URL detektálás)│
└──────┬───────────────────┘
       │ 1. "Megveszem" kattintás
       │ 2. sessionStorage + localStorage mentés
       │ 3. window.location.href = getPaymentLinkUrl(pack)
       ▼
┌──────────────────────────┐
│  Stripe Payment Link     │
│  (hosztolt fizetőoldal)  │
│  dev vagy prod készlet   │
│  5€ → 100⭐               │
│  10€ → 300⭐               │
│  25€ → 700⭐               │
│  100€ → 2000⭐             │
└──────────┬───────────────┘
           │ 4. Visszairányítás `/shop/success` URL-re
           ▼
┌──────────────────────────┐
│  App.tsx URL detektálás   │
│  → transitionTo("shop")   │
└──────────┬───────────────┘
           │ 5. ShopScreen useEffect
           │ 6. localStorage/sessionStorage olvasás
           │ 7. buyCredits(packId)
           ▼
┌──────────────────────────┐
│  Firebase RTDB            │
│  users/{uid}/             │
│    wallet.credits += pack │
└──────────────────────────┘
```

**Fizetési folyamat:**
1. Játékos → "Megveszem" a `CreditShopView`-ban
2. Frontend → `sessionStorage` + `localStorage` mentés: `{ packId, credits, timestamp }`
3. Frontend → `window.location.href = getPaymentLinkUrl(pack)` (Stripe hosztolt oldal; `import.meta.env.DEV` dönt a dev/prod link között)
4. Játékos → fizetés a Stripe-on
5. Stripe → redirect a **linkbe égetett** címre: prod → `https://realtimespacetravel-e74e3.web.app/shop/success`, dev → `http://localhost:5173/realtime_space_travel/shop/success`
6. `App.tsx` → URL path-ben `/shop/success` → `queueMicrotask` → `transitionTo("shop")`
7. `ShopScreen` → `useEffect` → `localStorage.getItem(PENDING_PURCHASE_KEY)`
8. `buyCredits(pack.id)` → lokális állapot + `updateUserWallet(rtdbKey, newCredits)`

### Storage stratégia

| Storage | Előny | Hátrány |
|---------|-------|---------|
| `sessionStorage` | Per-tab, automatikusan törlődik tab bezáráskor | Page navigáció + visszatéréskor elveszik |
| `localStorage` | Túléli a page load ciklust (ugyanazon origin-en) | Perzisztens, kézzel kell törölni |

**Megoldás:** Mindkettőbe mentünk. sessionStorage elsődleges, localStorage fallback. Közös `clear()` mindkettőt törli.

### URL detektálás

A Stripe Payment Link `after_completion.redirect.url` a **prod** linkeknél `https://realtimespacetravel-e74e3.web.app/shop/success`, a **dev** linkeknél `http://localhost:5173/realtime_space_travel/shop/success`. Mivel az SPA minden path-en `index.html`-t szolgál ki (Firebase Hosting SPA viselkedés), a `/shop/success` path megmarad. Ugyanez a Vite dev szerveren **ellenőrizve**: a `/realtime_space_travel/shop/success` kérésre HTTP 200 + `index.html` a válasz, tehát a fallback dev alatt is működik. Az `App.tsx` useEffect-e ellenőrzi `window.location.pathname.includes("/shop/success")`-t, és `queueMicrotask`-ban `transitionTo("shop")`-t hív, ami átugorja az intrót és közvetlenül a shopba navigál.

---

## 2. Adatmodell

### Kredit-pakkok (fix konstansok a kódban)

```ts
// src/types/index.ts
type CreditPack = {
  // ...
  stripePaymentLink: string;      // prod (Firebase Hosting) visszatérés
  stripePaymentLinkDev?: string;  // dev (localhost) visszatérés — opcionális
};

// src/constants/shopCatalog.ts
export const CREDIT_PACKS: CreditPack[] = [
  { id: "credits-starter",  nameKey: "shop.credits.starter",  priceEur: 5,   credits: 100,  stripePaymentLink: "https://buy.stripe.com/test_...", stripePaymentLinkDev: "https://buy.stripe.com/test_..." },
  { id: "credits-advanced", nameKey: "shop.credits.advanced", priceEur: 10,  credits: 300,  stripePaymentLink: "https://buy.stripe.com/test_...", stripePaymentLinkDev: "https://buy.stripe.com/test_..." },
  { id: "credits-premium",  nameKey: "shop.credits.premium",  priceEur: 25,  credits: 700,  stripePaymentLink: "https://buy.stripe.com/test_...", stripePaymentLinkDev: "https://buy.stripe.com/test_..." },
  { id: "credits-ultra",    nameKey: "shop.credits.ultra",    priceEur: 100, credits: 2000, stripePaymentLink: "https://buy.stripe.com/test_...", stripePaymentLinkDev: "https://buy.stripe.com/test_..." },
];

// Dev/prod link választás — a visszatérési cím a Stripe objektumon van, nem a fronton
export const getPaymentLinkUrl = (pack: CreditPack): string =>
  (import.meta.env.DEV && pack.stripePaymentLinkDev) || pack.stripePaymentLink;
```

### Firebase RTDB séma (Phase-1, kliens-írható)

```json
{
  "users": {
    "{uid}": {
      "wallet": { "credits": 0 },      // Phase-1: kliens írhatja (updateUserWallet)
      "inventory": { ... },            // Phase-1: kliens írhatja
      "settings": { ... },             // kliens írhatja
      "stats": { ... }                 // kliens írhatja
    }
  },
  "device_map": {
    "{deviceId}": "{firebaseAuthUid}"  // security rules által ellenőrizve
  }
}
```

### Security rules

```json
"$key": {
  ".read": "auth != null && (root.child('device_map').child($key).val() == auth.uid || $key == auth.uid)",
  "wallet":    { ".write": "auth != null && (root.child('device_map').child($key).val() == auth.uid || $key == auth.uid)" },
  "inventory": { ".write": "auth != null && (root.child('device_map').child($key).val() == auth.uid || $key == auth.uid)" },
  "profile":   { ".write": "auth != null && (root.child('device_map').child($key).val() == auth.uid || $key == auth.uid)" },
  "settings":  { ".write": "auth != null && (root.child('device_map').child($key).val() == auth.uid || $key == auth.uid)" },
  "stats":     { ".write": "auth != null && (root.child('device_map').child($key).val() == auth.uid || $key == auth.uid)" }
}
```

---

## 3. Módosított fájlok

| Fájl | Változás |
|------|----------|
| `src/types/index.ts` | `CreditPack` → +`stripePaymentLink: string`, +`stripePaymentLinkDev?: string` (opcionális, prod fallbackkel) |
| `src/constants/shopCatalog.ts` | 4 kredit pakkhoz `stripePaymentLink` **és** `stripePaymentLinkDev` URL-ek; új `getPaymentLinkUrl(pack)` export (`import.meta.env.DEV` alapján választ) |
| `src/components/shop/CreditShopView.tsx` | Gomb → sessionStorage+localStorage mentés → Stripe redirect `getPaymentLinkUrl(pack)`-kal (korábban `pack.stripePaymentLink`); exportált `PENDING_PURCHASE_KEY` |
| `src/components/shop/ShopScreen.tsx` | `useEffect` sessionStorage+localStorage olvasás visszatéréskor → `buyCredits` + success view; közös `clear()` helper |
| `src/App.tsx` | URL detektálás `/shop/success` → `queueMicrotask` → `transitionTo("shop")` |
| `scripts/create_payment_links.mjs` | Stripe API szkript a Payment Link-ek létrehozásához; `--redirect=<url>` CLI paraméter (alap: prod URL); a kulcsot `loadEnv` (`vite`) olvassa a `.env`-ből (`VITE_STRIPE_SECRET_KEY`) a korábbi beégetett `sk_test_` helyett; a kimenet jelzi, melyik mezőbe (`stripePaymentLink` / `stripePaymentLinkDev`) kell a linket beilleszteni |
| `.env` / `.env.example` | Új `VITE_STRIPE_SECRET_KEY` változó |
| `.github/workflows/deploy.yml`, `.github/workflows/deploy-firebase.yml` | `VITE_STRIPE_SECRET_KEY: ${{ secrets.VITE_STRIPE_SECRET_KEY }}` a build env-ben |

### Új függőségek
- `stripe` npm package (csak a létrehozó szkripthez, nem a frontendhez)

---

## 4. Stripe konfiguráció

- Stripe fiók: **teszt mód** (`pk_test_...`, `sk_test_...`)
- **8 teszt Payment Link** létrehozva a Stripe API-n keresztül (nem manuálisan a Dashboard-on) — API-lekérdezéssel visszaigazolva
- `after_completion.type: "redirect"`, a `url` a linkbe van égetve:

| Készlet | Darab | `after_completion.redirect.url` | Katalógus mező |
|---------|-------|--------------------------------|----------------|
| prod | 4 | `https://realtimespacetravel-e74e3.web.app/shop/success` | `stripePaymentLink` |
| dev | 4 | `http://localhost:5173/realtime_space_travel/shop/success` | `stripePaymentLinkDev` |

- A Stripe **teszt módban elfogadja a `http://localhost`** redirectet; élesben `https` kötelező — az éles linkek tehát csak prod URL-lel készíthetők
- Link generálás: `node scripts/create_payment_links.mjs --redirect=<url>` (paraméter nélkül a prod URL az alapértelmezés)
- Payment Link URL-ek fixen a `shopCatalog.ts`-ban (nem env változókban, mert publikusak)
- Teszt kártya: `4242 4242 4242 4242` (bármilyen jövőbeli dátum, CVC, irányítószám)

### Env változók (csak a létrehozó szkripthez)

| Változó | Hol kell | Szerep |
|---------|----------|--------|
| `VITE_STRIPE_SECRET_KEY` | `.env` (lokálisan), GitHub Actions secret a két deploy workflow-ban | A `create_payment_links.mjs` ezzel hívja a Stripe API-t (`loadEnv` a `vite`-ból) |

> ⚠️ **Kulcskezelés (méréssel ellenőrizve):** a `VITE_` prefix miatt a kulcs
> - **dev szerveren kikerül a böngészőbe** — a Vite a teljes env objektumot beinjektálja minden modulba;
> - **a prod buildbe viszont nem kerül bele** — oda csak a kódban konkrétan hivatkozott `import.meta.env.VITE_X` tagok kerülnek, és a `src/` alatt semmi nem hivatkozik erre a kulcsra.
>
> A prefix elhagyása (nem-`VITE_` név), a kulcs rotálása és a **restricted API key** bevezetése a [[016-stripe-fraud-defense]] terv A fázisának feladata.

Élesítéskor:
- Hozd létre a 4 élő Payment Link-et (élő `sk_live_...` kulccsal), `--redirect=<éles https URL>`-lel — élesben a `http://localhost` redirect nem engedélyezett
- Cseréld le a `stripePaymentLink` URL-eket a `shopCatalog.ts`-ban (a `stripePaymentLinkDev` mezők maradhatnak teszt-linkek, prod buildben úgysem használatosak)

> 📋 **A teljes élesítési út a [[017-stripe-go-live]] tervben van.** A fenti két pont csak a technikai mag; az élesítés valójában ennél lényegesen több: Stripe fiókaktiválás (KYC, egyéni vállalkozóként), **a weboldal jogi elemeinek megépítése** (ÁSZF, adatkezelési tájékoztató, elállási/visszatérítési szabályzat, impresszum — ma egyik sincs meg, és ez a Stripe review leggyakoribb blokkolója), az EU-s 14 napos elállási jogról szóló kifejezett lemondás beépítése a vásárlási folyamatba, valamint a **Stripe Tax** bekapcsolása (digitális termék adókód, `tax_behavior: "inclusive"`, `automatic_tax`). Fontos sorrendi kötöttség: a `tax_behavior` a `price` objektumon **immutábilis**, ezért a Stripe Tax beállítása **megelőzi** az éles linkek generálását. A 012-es terv minden feladatnál jelöli, hogy **kézi** (Stripe Dashboard / hatóság) vagy **automatizálható** (script) lépésről van-e szó.

---

## 5. Ismert korlátok

| Korlát | Oka | Megoldás a jövőben |
|--------|-----|-------------------|
| Nem Cloud Functions | Spark (ingyenes) terv | Blaze tervre váltás + CF migration |
| Kliens írja a kreditet | Phase-1 kompromisszum | Phase-2: `wallet.write = false` + `purchaseWithCredits` CF |
| ~~Cross-origin localStorage elveszik~~ — **megoldva** | Korábban a dev futás is a prod (Firebase Hosting) linkre irányított, így a visszatérés más origin-re esett | Külön **dev linkkészlet** (`stripePaymentLinkDev` + `getPaymentLinkUrl`): a visszatérés dev alatt is ugyanarra az origin-re történik, a localStorage megmarad |
| Nincs webhook → nincs automatikus verifikáció | Spark terv korlát | CF migration után: `stripeWebhook` + idempotencia |
| Payment Link URL-ek fixen a kódban | Nem lehet env változó a buildben | `.env` + Vite import (de publikus, így ez nem biztonsági issue) |

> ⚠️ **Csalás- és visszaélés-kockázatok:** a fenti két sor (*kliens írja a kreditet*, *nincs webhook*) egy kihasználható **„ingyen kredit" rést** jelent — a jóváírás kizárólag a localStorage tartalmán alapul. Ehhez társul a Stripe API kulcs kezelésének kockázata (carding, refund-támadás, adatlopás). A teljes fenyegetés-modell, a Spark-kompatibilis enyhítések (kulcs-higiénia, restricted API key, ingyenes Radar, RTDB rules szigorítás, `session_id` alapú replay-védelem) és az opcionális külső serverless webhook út a **[[016-stripe-fraud-defense]]** tervben van.

---

## 6. Tesztelés

### Manuális teszt lépések

> A folyamat **dev alatt is végigjátszható**: `npm run dev` → a `getPaymentLinkUrl` a dev linkeket adja, amelyek a `http://localhost:5173/realtime_space_travel/shop/success` címre térnek vissza (azonos origin, a pending purchase storage megmarad). Prod ellenőrzéshez a Firebase Hosting URL-t használd.

1. Nyisd meg a Firebase Hosting URL-t (`https://realtimespacetravel-e74e3.web.app/`) **vagy** a dev szervert (`http://localhost:5173/realtime_space_travel/`)
2. Navigálj a shopba → Kredit tab
3. Kattints "Megveszem" a Starter Pack-en
4. Stripe-on: `4242 4242 4242 4242` + bármilyen adat → Pay
5. Ellenőrizd: visszatérés után a shopban a ⭐ egyenleg nőtt 100-zal?
6. Ellenőrizd: az RTDB-ben `users/{uid}/wallet.credits` frissült?
7. Próbáld ki mind a 4 pakkot
8. Próbáld ki: megszakítás (Stripe-on vissza gomb → nem történik jóváírás)

---

## 7. Kapcsolódó tervek

- [[002-ingame-shop-frontend]] – a shop UI alapjai (ShopScreen, ProductGrid, CartView)
- [[003-firebase-auth-settings]] – auth, RTDB séma, Security Rules
- [[004-firebase-auth-bugfix]] – **blokkoló előfeltétel.** A kredit írás (`updateUserWallet`) csak működő auth + RTDB rules felett építhető
- [[009-firebase-identity-split-bugfix]] – **az `updateUserWallet(rtdbKey, …)` célútvonalát javítja.** Ma egy migrációs `catch`-ág a `rtdbKey`-t a `deviceId`-re térítheti, így a jóváírás a **rossz** RTDB node alá kerül (élesben megerősített hiba: ugyanaz a Google fiók két node, 0 vs. 1837 kredit). A `rtdbKey` derivált értékké válik, a `setRtdbKey` action megszűnik
- [[017-stripe-go-live]] – **az élesítés terve.** Teszt módból valós pénzes fizetésbe: KYC / fiókaktiválás, a kötelező jogi oldalak megépítése, elállási jog lemondása, Stripe Tax, a 4 éles Payment Link generálása és a go-live / rollback checklist. Módosítja a `create_payment_links.mjs`-t (`tax_code`, `tax_behavior`, `automatic_tax`, `consent_collection`), a `shopCatalog.ts` `stripePaymentLink` mezőit, a `CreditShopView`-t (elállási checkbox) és új `LegalScreen` képernyőt vezet be
- [[016-stripe-fraud-defense]] – **ráépülő biztonsági terv.** Carding / refund-támadás / adatlopás elleni Spark-kompatibilis védelem + az ingyen-kredit rés szűkítése (`session_id` kapu, `credit_claims` ledger, `wallet` növekmény-limit). Módosítja a `CreditShopView` pending payloadját, a `ShopScreen` jóváírási ágát, az `updateUserWallet` írásmódját (`set` → `update`) és a `create_payment_links.mjs` redirect URL-jét
