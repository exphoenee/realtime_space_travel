---
title: "Valós pénzes kredit vásárlás – Stripe + Firebase"
slug: 004-ingame-shop-strapi-stripe
type: plan
category: shop
status: not-started
implemented: false
implemented_at: null
created_at: "2026-07-25"
updated_at: "2026-07-26"
author: exphoenee
step: 4
phases:
  - 3
  - 4
dependencies:
  - 003-firebase-auth-settings
related_plans:
  - 002-ingame-shop-frontend
  - 003-firebase-auth-settings
  - 000-i18n-nyelvesites
tags:
  - stripe
  - payments
  - cloud-functions
  - firebase-admin
---

# Valós pénzes kredit vásárlás – Stripe + Firebase (nincs Strapi)

**Cél:** a játékos 4 féle kredit-pakkot vásárolhasson valós pénzért. **Nincs Strapi** — csak Stripe (fizetés) + Firebase Cloud Function (webhook + wallet írás) + Firebase RTDB (kredit tárolás).

> **Architektúra (egyszerűsített):**
> - **Stripe Checkout** = fizetési felület (hosztolt oldal, nem kell hozzá saját backend)
> - **Firebase Cloud Function** (`stripeWebhook`) = Stripe webhook fogadása → `wallet.credits` növelés Admin SDK-val
> - **Firebase Cloud Function** (`createCheckoutSession`, callable) = Checkout Session létrehozása a klienstől hívva
> - **Firebase RTDB** = a kredit-egyenleg (`wallet.credits`) egyetlen igazságforrása
> - **A 4 CreditPack fix konstans** → `src/constants/shopCatalog.ts`-ban (már megvan)
>
> **Épít a [[002-ingame-shop-frontend]] tervre:** a `CreditShopView` már mutatja a 4 pakkot mock gombokkal. Ez a terv ezt köti össze a Stripe-pal és a Firebase-szel.

## Döntések (egyeztetve)

| Kérdés | Választás |
|--------|-----------|
| Strapi | ❌ **Nincs.** A 4 kredit-pakk fix konstans (`shopCatalog.ts`). |
| Fizetési átjáró | **Stripe Checkout** (hosztolt fizetőoldal) |
| Kredit-pakkok | 5€ → 100 kr · 10€ → 300 kr · 25€ → 700 kr · 100€ → 2000 kr |
| Checkout hívás | **Firebase Callable Function** (`createCheckoutSession`) — nem kell saját szerver |
| Webhook | **Firebase HTTPS Cloud Function** (`stripeWebhook`) — Stripe aláírás ellenőrzés |
| Kredit írása fizetés után | **Firebase Admin SDK** a webhook CF-ben → `users/{uid}/wallet.credits` növelés (tranzakció) |
| App-on belüli vásárlás | **Firebase Cloud Function** `purchaseWithCredits` (kreditből hajó/zene/exobolygó) |
| Kredit forrása | Firebase RTDB `wallet.credits` (szerver-írt, Security Rules tiltja a kliens-írást) |

---

## ✅ Haladás (TODO)

> Jelölés: `[ ]` hátravan · `[~]` folyamatban · `[x]` kész. Előfeltétel: a [[003-firebase-auth-settings]] Fázis 1 (auth + RTDB + Security Rules).

**A fázis — Stripe + Firebase Cloud Functions**
- [ ] Stripe fiók + API kulcsok + 4 Price objektum (5€, 10€, 25€, 100€) a Stripe Dashboard-on
- [ ] `createCheckoutSession` Firebase Callable Function (Stripe Checkout Session létrehozása, metaadat: `uid` + `credits`)
- [ ] `stripeWebhook` Firebase HTTPS Cloud Function (Stripe aláírás ellenőrzés → `wallet.credits` tranzakció)
- [ ] Idempotencia: webhook dupla hívás → ne növeljen kétszer (`walletWritten` kulcs)
- [ ] Env változók: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY`

**B fázis — Firebase Cloud Functions (in-app vásárlások, közös [[003-firebase-auth-settings]])**
- [ ] `purchaseWithCredits` (kredites vétel: hajó/zene/exobolygó, RTDB tranzakció)
- [ ] `awardWage` (küldetés végi kredit)

**C fázis — Frontend**
- [x] `GamePhase: "shop"` + `ScreenRouter` ág + „Áruház" gomb — lásd [[002-ingame-shop-frontend]]
- [x] `CreditShopView` mock (4 fix pakk) — lásd [[002-ingame-shop-frontend]]
- [ ] `CreditShopView` élesítése: mock → `createCheckoutSession` callable hívás → Stripe redirect
- [ ] `CheckoutReturn` komponens (success/cancel lap, Firebase listener-rel)
- [ ] Küldetés végén wage → `functionsApi.awardWage()` bekötés

**D fázis — Tesztelés / élesítés**
- [ ] Stripe teszt-vásárlások a 4 pakkra (siker, megszakítás, visszatérítés)
- [ ] Webhook idempotencia teszt
- [ ] Anti-cheat: Security Rules ellenőrzés
- [ ] `base href` (`/realtime_space_travel/`) a Stripe redirect URL-eknél

---

## 1. Architektúra

```
┌──────────────────────┐    callable          ┌──────────────────────┐
│  React SPA (Vite)    │ ──────────────────▶  │  Firebase Cloud      │
│  - CreditShopView    │   createCheckout     │  Functions            │
│  - CheckoutReturn    │   Session()          │  - createCheckout    │
│  - Firebase listener  │ ◀────────────────── │    Session (callable)│
│    (wallet.credits)   │   session.url        │  - stripeWebhook     │
└──────┬───────────────┘                      │    (HTTPS)           │
       │                                      │  - purchaseWithCredits│
       │ Stripe redirect                      │  - awardWage         │
       ▼ (session.url)                        └──────┬───────────────┘
┌──────────────────────┐    webhook                  │ Admin SDK
│  Stripe Checkout     │ ─────────────────────────▶  │ wallet.credits
│  (hosztolt oldal)    │   checkout.session.         │ növelés
│  5€ → 100 kr         │   completed                 ▼
│  10€ → 300 kr        │                    ┌──────────────────────┐
│  25€ → 700 kr        │                    │  Firebase RTDB       │
│  100€ → 2000 kr      │                    │  users/{uid}/        │
└──────────────────────┘                    │    wallet.credits    │
                                            │    inventory/...     │
                                            │    settings/...      │
                                            └──────────────────────┘
```

**Fizetési folyamat:**
1. Játékos → „Megveszem" a `CreditShopView`-ban
2. Frontend → `createCheckoutSession({ creditPackId })` Firebase Callable Function
3. CF → Stripe API: Checkout Session létrehozása (`uid`, `creditsAmount` metaadat)
4. Frontend → `window.location.href = session.url` (Stripe hosztolt oldal)
5. Játékos → fizetés a Stripe-on
6. Stripe → `checkout.session.completed` webhook → `stripeWebhook` Cloud Function
7. CF → `admin.database().ref(\`users/${uid}/wallet/credits\`).transaction(...)` növelés
8. Frontend → Firebase real-time listener → kredit egyenleg frissül

---

## 2. Adatmodell

### Kredit-pakkok (fix konstansok a kódban — nincs Strapi)

```ts
// src/constants/shopCatalog.ts — már megvan!
export const CREDIT_PACKS = [
  { id: "pack-5eur",  priceEur: 5,  credits: 100, nameKey: "shop.credits.starter"  },
  { id: "pack-10eur", priceEur: 10, credits: 300, nameKey: "shop.credits.advanced" },
  { id: "pack-25eur", priceEur: 25, credits: 700, nameKey: "shop.credits.premium"  },
  { id: "pack-100eur",priceEur: 100,credits: 2000,nameKey: "shop.credits.ultra"    },
];
```

A Stripe Price ID-k nem a kódban, hanem a Firebase Cloud Function env-ben / konfigban élnek (vagy a Stripe API-ból lekérhetők `productId` alapján).

### Firebase RTDB séma (közös [[003-firebase-auth-settings]])

```json
{
  "users": {
    "{uid}": {
      "wallet": { "credits": 0 },          // CSAK szerver írhatja
      "inventory": {
        "ships": { "ship-id": true },
        "music": { "music-id": true },
        "exoplanets": { "exoplanet-id": true }
      },                                     // CSAK szerver írhatja
      "settings": { /* user írhatja */ },
      "stats": { /* user írhatja */ }
    }
  }
}
```

---

## 3. Firebase Cloud Functions

### `createCheckoutSession` (Callable)

```ts
export const createCheckoutSession = functions.https.onCall(async (data, context) => {
  // 1. Auth ellenőrzés
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "...");

  // 2. CreditPack validálás a fix listából
  const pack = CREDIT_PACKS.find(p => p.id === data.creditPackId);
  if (!pack) throw new functions.https.HttpsError("not-found", "...");

  // 3. Stripe Checkout Session
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",
    line_items: [{ price_data: { currency: "eur", product_data: { name: pack.name }, unit_amount: pack.priceEur * 100 }, quantity: 1 }],
    metadata: { uid: context.auth.uid, credits: pack.credits.toString() },
    success_url: `${BASE_URL}/shop/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${BASE_URL}/shop/cancel`,
  });

  return { sessionUrl: session.url };
});
```

### `stripeWebhook` (HTTPS)

```ts
export const stripeWebhook = functions.https.onRequest(async (req, res) => {
  const sig = req.headers["stripe-signature"];
  const event = stripe.webhooks.constructEvent(req.rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET!);

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const { uid, credits } = session.metadata;
    const creditsAmount = parseInt(credits);

    // Idempotencia: session.id alapján ne írjon duplán
    const orderRef = admin.database().ref(`orders/${session.id}`);
    const existing = await orderRef.once("value");
    if (existing.exists()) return res.send("duplicate");

    // Atomikus kredit növelés
    const walletRef = admin.database().ref(`users/${uid}/wallet/credits`);
    await walletRef.transaction(current => (current || 0) + creditsAmount);

    // Idempotencia jelző
    await orderRef.set({ uid, credits: creditsAmount, writtenAt: Date.now() });
  }

  res.json({ received: true });
});
```

---

## 4. Frontend változtatások

### Már kész ([[002-ingame-shop-frontend]])
- `CreditShopView` — 4 pakk kártya, név/ár/kredit kijelzés
- `CreditBalance` — egyenleg kijelzés a shop fejlécében
- `useShopStore` (localStorage) — kredit/birtoklás mock

### Firebase bekötéskor új fájlok
```
src/
  services/
    functionsApi.ts     # Cloud Functions hívások: createCheckoutSession, purchaseWithCredits, awardWage
  components/
    shop/
      CheckoutReturn.tsx  # success/cancel lap Stripe fizetés után
```

### Változtatások
- **`CreditShopView`**: „Megveszem" gomb → `functionsApi.createCheckoutSession(packId)` → `sessionUrl` redirect
- **`CheckoutReturn`** (új): `success_url` / `cancel_url` kezelése; Stripe-ról visszatérve a Firebase listener megvárja a wallet frissülést
- **`useShopStore`** → a [[003-firebase-auth-settings]] Firebase listener-ére cserélve

---

## 5. Stripe konfiguráció

- Stripe Dashboard: 4 **Price** objektum (5€, 10€, 25€, 100€ — egyszeri fizetés)
- Webhook endpoint: Firebase Functions URL (`stripeWebhook`)
- Webhook események: `checkout.session.completed`
- Env változók:
  - `STRIPE_SECRET_KEY` — Stripe titkos kulcs
  - `STRIPE_WEBHOOK_SECRET` — Webhook aláírás
  - `STRIPE_PUBLISHABLE_KEY` — Publikus kulcs
  - Firebase Admin SDK → automatikusan elérhető Functions környezetben (`firebase-functions` + `firebase-admin`)
- Teszt mód: Stripe test kulcsok + `stripe listen --forward-to http://localhost:5001/...`

---

## 6. Megvalósítási lépések (sorrend)

**A fázis — Stripe + Firebase CF**
1. Stripe fiók + API kulcsok + 4 Price objektum
2. `createCheckoutSession` Callable Function
3. `stripeWebhook` HTTPS Function + idempotencia
4. Webhook endpoint regisztráció a Stripe Dashboard-on
5. Env változók beállítása

**B fázis — Firebase Cloud Functions**
6. `purchaseWithCredits` (in-app kredites vásárlás)
7. `awardWage` (küldetés végi kredit)

**C fázis — Frontend**
8. `src/services/functionsApi.ts` — Cloud Functions hívások
9. `CreditShopView` élesítése: mock → `createCheckoutSession`
10. `CheckoutReturn` komponens
11. Küldetés végén wage → `awardWage` bekötés

**D fázis — Tesztelés**
12. Stripe teszt-vásárlások (siker, megszakítás, dupla webhook)
13. Anti-cheat, Security Rules
14. `base href` redirect URL-ek

---

## 7. Kockázatok

- **Nincs Strapi** → nincs karbantartandó CMS, nincs extra backend, nincs CORS, nincs deploy komplexitás ✅
- **Webhook idempotencia** kritikus: dupla fizetés → dupla kredit. Megoldás: `session.id` alapján `orders/{id}` lock.
- **Stripe redirect** elhagyja az oldalt → visszatéréskor a Firebase auth session helyreáll (perzisztens auth).
- **`base href`** (`/realtime_space_travel/`) — a Stripe `success_url` / `cancel_url` ehhez igazodjon.

---

## 8. Becsült ráfordítás

| Fázis | Nagyságrend |
|-------|-------------|
| Stripe + Firebase CF (createCheckout, webhook) | ~1 nap |
| Cloud Functions (purchaseWithCredits, awardWage) | ~1 nap |
| Frontend (Stripe bekötés, CheckoutReturn) | ~0.5 nap |
| Tesztelés | ~0.5 nap |

**Kész definíció:** a játékos 4 féle kredit-pakkot vásárolhat Stripe-on keresztül; a kredit a Firebase RTDB `wallet.credits`-be íródik (szerver-írt); app-on belüli vásárlások Firebase Cloud Functions-en mennek; nincs Strapi.

---

## 9. Kapcsolódó tervek

- [[002-ingame-shop-frontend]] – a shop UI (CreditShopView, CreditBalance) már készen van
- [[003-firebase-auth-settings]] – auth, RTDB séma, Security Rules, Cloud Functions alapok
- [[000-i18n-nyelvesites]] – a kredit-pakkok neveinek lokalizációja
