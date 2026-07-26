---
title: "Valós pénzes kredit vásárlás – Stripe Payment Links"
slug: 005-ingame-shop-strapi-stripe
type: plan
category: shop
status: in-progress
implemented: false
implemented_at: null
created_at: "2026-07-25"
updated_at: "2026-07-26"
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

---

## ✅ Haladás (TODO)

> Jelölés: `[ ]` hátravan · `[~]` folyamatban · `[x]` kész.

**A fázis — Stripe fiók + Payment Links**
- [x] Stripe fiók létrehozva (teszt mód)
- [x] 4 Payment Link létrehozva a Stripe API-n keresztül (`scripts/create_payment_links.mjs`)
- [x] `stripe` npm package telepítve
- [x] Stripe best-practices skill telepítve a projekthez

**B fázis — Frontend integráció**
- [x] `CreditPack` típus bővítve: +`stripePaymentLink: string` (`src/types/index.ts`)
- [x] 4 kredit pakkhoz `stripePaymentLink` URL-ek a `shopCatalog.ts`-ban
- [x] `CreditShopView`: gomb → sessionStorage+localStorage mentés → Stripe redirect
- [x] `ShopScreen`: useEffect sessionStorage+localStorage olvasás → `buyCredits` → success view
- [x] `App.tsx`: Stripe visszatérés URL detektálás → auto-navigate to shop

**C fázis — Visszatérés kezelés (Stripe → SPA)**
- [x] App.tsx: `window.location.pathname.includes("/shop/success")` → `queueMicrotask` → `transitionTo("shop")`
- [x] Dupla storage írás: sessionStorage + localStorage a `CreditShopView.handleBuy`-ban
- [x] Dupla storage olvasás: sessionStorage elsődleges, localStorage fallback a `ShopScreen` useEffect-ben
- [x] Közös `clear()` helper: mindkét storage törlése siker/lejárat/érvénytelenség esetén
- [x] Stripe MCP server telepítve (opcionális, Stripe API műveletekhez)

**D fázis — Tesztelés / élesítés**
- [ ] Stripe teszt-vásárlások a 4 pakkra (siker, megszakítás)
- [ ] Visszatérés tesztelése Firebase Hosting URL-en (ugyanazon origin)
- [ ] Cross-origin teszt (localhost → Firebase Hosting → localStorage nem elérhető)
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
       │ 3. window.location.href = pack.stripePaymentLink
       ▼
┌──────────────────────────┐
│  Stripe Payment Link     │
│  (hosztolt fizetőoldal)  │
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
3. Frontend → `window.location.href = pack.stripePaymentLink` (Stripe hosztolt oldal)
4. Játékos → fizetés a Stripe-on
5. Stripe → redirect: `https://...web.app/shop/success`
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

A Stripe Payment Link `after_completion.redirect.url` = `https://realtimespacetravel-e74e3.web.app/shop/success`. Mivel az SPA minden path-en `index.html`-t szolgál ki (Firebase Hosting SPA viselkedés), a `/shop/success` path megmarad. Az `App.tsx` useEffect-e ellenőrzi `window.location.pathname.includes("/shop/success")`-t, és `queueMicrotask`-ban `transitionTo("shop")`-t hív, ami átugorja az intrót és közvetlenül a shopba navigál.

---

## 2. Adatmodell

### Kredit-pakkok (fix konstansok a kódban)

```ts
// src/constants/shopCatalog.ts
export const CREDIT_PACKS: CreditPack[] = [
  { id: "credits-starter",  nameKey: "shop.credits.starter",  priceEur: 5,   credits: 100,  stripePaymentLink: "https://buy.stripe.com/test_..." },
  { id: "credits-advanced", nameKey: "shop.credits.advanced", priceEur: 10,  credits: 300,  stripePaymentLink: "https://buy.stripe.com/test_..." },
  { id: "credits-premium",  nameKey: "shop.credits.premium",  priceEur: 25,  credits: 700,  stripePaymentLink: "https://buy.stripe.com/test_..." },
  { id: "credits-ultra",    nameKey: "shop.credits.ultra",    priceEur: 100, credits: 2000, stripePaymentLink: "https://buy.stripe.com/test_..." },
];
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
| `src/types/index.ts` | `CreditPack` → +`stripePaymentLink: string` |
| `src/constants/shopCatalog.ts` | 4 kredit pakkhoz `stripePaymentLink` URL-ek a Stripe Payment Link-ekből |
| `src/components/shop/CreditShopView.tsx` | Gomb → sessionStorage+localStorage mentés → Stripe redirect; exportált `PENDING_PURCHASE_KEY` |
| `src/components/shop/ShopScreen.tsx` | `useEffect` sessionStorage+localStorage olvasás visszatéréskor → `buyCredits` + success view; közös `clear()` helper |
| `src/App.tsx` | URL detektálás `/shop/success` → `queueMicrotask` → `transitionTo("shop")` |
| `scripts/create_payment_links.mjs` | Stripe API szkript a 4 Payment Link létrehozásához |

### Új függőségek
- `stripe` npm package (csak a létrehozó szkripthez, nem a frontendhez)

---

## 4. Stripe konfiguráció

- Stripe fiók: **teszt mód** (`pk_test_...`, `sk_test_...`)
- 4 **Payment Link** létrehozva a Stripe API-n keresztül (nem manuálisan a Dashboard-on)
- `after_completion.type: "redirect"` → `url: "https://realtimespacetravel-e74e3.web.app/shop/success"`
- Payment Link URL-ek fixen a `shopCatalog.ts`-ban (nem env változókban, mert publikusak)
- Teszt kártya: `4242 4242 4242 4242` (bármilyen jövőbeli dátum, CVC, irányítószám)

### Env változók (csak a létrehozó szkripthez)

Jelenleg a `scripts/create_payment_links.mjs` tartalmazza a `sk_test_...` kulcsot. Élesítéskor:
- Hozd létre a 4 élő Payment Link-et (élő `sk_live_...` kulccsal)
- Cseréld le a `stripePaymentLink` URL-eket a `shopCatalog.ts`-ban
- Változtasd a `redirect.url`-ot az éles Firebase Hosting URL-re

---

## 5. Ismert korlátok

| Korlát | Oka | Megoldás a jövőben |
|--------|-----|-------------------|
| Nem Cloud Functions | Spark (ingyenes) terv | Blaze tervre váltás + CF migration |
| Kliens írja a kreditet | Phase-1 kompromisszum | Phase-2: `wallet.write = false` + `purchaseWithCredits` CF |
| Cross-origin localStorage elveszik | localhost → Firebase Hosting | Productionben nem releváns |
| Nincs webhook → nincs automatikus verifikáció | Spark terv korlát | CF migration után: `stripeWebhook` + idempotencia |
| Payment Link URL-ek fixen a kódban | Nem lehet env változó a buildben | `.env` + Vite import (de publikus, így ez nem biztonsági issue) |

---

## 6. Tesztelés

### Manuális teszt lépések
1. Nyisd meg a Firebase Hosting URL-t: `https://realtimespacetravel-e74e3.web.app/`
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
