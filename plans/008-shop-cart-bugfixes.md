---
title: "Áruház kosár bugfixek + kreditlimit + összérték kijelzés"
slug: 008-shop-cart-bugfixes
type: plan
category: core
status: implemented
implemented: true
implemented_at: "2026-07-26"
created_at: "2026-07-26"
updated_at: "2026-07-26"
author: exphoenee
step: 8
phases:
  - 4
dependencies:
  - 007-state-persist-page-refresh
related_plans:
  - 002-ingame-shop-frontend
  - 007-state-persist-page-refresh
tags:
  - shop
  - bugfix
  - cart
  - credits
  - ui
---

# Áruház kosár bugfixek + kreditlimit + összérték kijelzés

**Cél:** az áruház kosárral kapcsolatos hibáinak javítása és UX javítások:

1. **Bug: Nincs kreditlimit a kosárba helyezésnél** — a felhasználó akkor is kosárba tehet egy terméket, ha nincs elég kreditje. A gomb legyen letiltva (`disabled`) ha a termék ára > egyenleg.
2. **Bug: A "Kosárba" gomb nem vált át azonnal "Eltávolítás"-ra** — a `ProductCard`-ban a `useShopStore((s) => s.isInCart)` selector egy stabil függvényreferenciát ad vissza, így a komponens nem renderelődik újra a kosár változásakor. Fix: reaktív boolean selector használata (`useShopStore((s) => s.cart.some(...))`).
3. **Feature: Kosár összértékének kijelzése** — a header-ben a kosár ikon mellett jelenjen meg a kosárban lévő termékek összértéke ⭐-ban. Emellett a CartView már mutatja, ez marad.

## Döntések (egyeztetve)

| Kérdés | Választás |
|--------|-----------|
| Kreditlimit hol? | **Gomb szinten tiltva** — ha `cartTotal + termék ára > egyenleg`, a "Kosárba" gomb `disabled` (kumulatív ellenőrzés) |
| Kosár összérték hol? | **Header-ben (kosár gomb mellett)** + **CartView-ban** (már megvan) |
| Reaktivitás javítás | **Selector fix** — `cart.some(...)` a `ProductCard`-ban, nem a store metódus |
| Terv típusa | **Bugfix terv** — új step (008) a roadmap-ben |

---

## ✅ Haladás (TODO)

> Jelölés: `[ ]` hátravan · `[~]` folyamatban · `[x]` kész.

**A. Kreditlimit a Kosárba gombon**
- [x] `ProductCard`: `canAfford = credits >= (cartTotal + product.priceCredits)` — a kosárban MÁR lévő tételek összértékét is figyelembe veszi
- [x] Ha nem fér bele, a Kosárba gomb `disabled` + `.disabledBtn` CSS stílus (szürke, 0.5 opacity)
- [x] `getButtonClass()`: `.disabledBtn` osztály ha `!canAfford && !isInCart && !isOwned`
- [x] `disabled={isOwned || (!isInCart && !canAfford)}` a gomb attribútumban is
- [x] `useShopStore.addToCart()` is ellenőrzi: `if (credits < cartTotal + item.priceCredits) return` — defense-in-depth

**B. Reaktivitás javítás a Kosárba/Eltávolítás gombon**
- [x] `ProductCard`: `useShopStore((s) => s.isInCart)` → `useShopStore((s) => s.cart.some((item) => item.id === product.id))`
- [x] A reaktív selector biztosítja, hogy a komponens újrarenderelődjön a kosár változásakor

**C. Kosár összérték kijelzése a header-ben**
- [x] `CartButton` kibővítve: a badge mellett mutatja a kosár összértékét (⭐ N)
- [x] Ha a kosár üres, nem jelenik meg az összérték (ugyanaz a feltétel, mint a badge-nél)
- [x] `.cartTotalLabel` CSS stílus hozzáadva (arany szín, jobb oldali margó)

**D. i18n kulcsok**
- [x] Nincs szükség új i18n kulcsra — az összérték csak ⭐ + szám, nincs szöveges címke

**E. Tesztelés**
- [x] TypeScript fordítás tiszta (`npx tsc --noEmit` → 0 hiba)
- [x] Vitest tesztek: 14/14 passed
- [x] Code review: lezárva, nincs kritikus észrevétel

---

## 1. Érintett fájlok

| Fájl | Módosítás |
|------|-----------|
| `src/state/useShopStore.ts` | `addToCart` kumulatív kreditguard: `if (credits < cartTotal + item.priceCredits) return` |
| `src/components/shop/ProductCard.tsx` | Selector fix (`cart.some(...)`) + `canAfford = credits >= (cartTotal + product.priceCredits)` + disabled gomb |
| `src/components/shop/CartButton.tsx` | Kosár összérték kijelzése (⭐ N) |
| `src/components/shop/ShopScreen.module.css` | `.cartTotalLabel` + `.disabledBtn` stílusok |

---

## 2. Megvalósítási lépések

1. `ProductCard.tsx` — `isInCart` selector fix: `useShopStore((s) => s.cart.some(...))`
2. `ProductCard.tsx` — kreditlimit: `canAfford = credits >= (cartTotal + product.priceCredits)` — a kosárban MÁR lévő tételek összértékét is figyelembe veszi
3. `useShopStore.ts` — `addToCart` kumulatív kreditguard: `if (credits < cartTotal + item.priceCredits) return`
4. `CartButton.tsx` — kosár összérték kijelzés a badge mellett
5. `ShopScreen.module.css` — `cartTotalBadge` + `disabledBtn` stílus
6. Terv frissítése (TODO -> x)

---

## 3. Kapcsolódó tervek

- [[002-ingame-shop-frontend]] — a shop UI, amit javítunk
- [[007-state-persist-page-refresh]] — shop tab perzisztálás
