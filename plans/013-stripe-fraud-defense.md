---
title: "Stripe csalásvédelem – carding, refund-támadás és az ingyen-kredit rés"
slug: 013-stripe-fraud-defense
type: plan
category: security
status: not-started
implemented: false
implemented_at: null
created_at: "2026-07-26"
updated_at: "2026-07-27"
author: exphoenee
step: 13
phases: []
dependencies:
  - 005-ingame-shop-strapi-stripe
  - 009-firebase-identity-split-bugfix
  - 010-firebase-guest-merge-single-gate
related_plans:
  - 002-ingame-shop-frontend
  - 003-firebase-auth-settings
  - 004-firebase-auth-bugfix
  - 014-stripe-go-live
tags:
  - stripe
  - security
  - fraud
  - payments
  - radar
---

# Stripe csalásvédelem – carding, refund-támadás és az ingyen-kredit rés

**Cél:** a [[005-ingame-shop-strapi-stripe]] tervben megépített, backend nélküli Stripe Payment Links fizetési út köré egy **Spark-terven belül megvalósítható** védelmi réteg építése három konkrét fenyegetés ellen: (a) bankkártyás visszaélés / card testing (carding), (b) refund-támadás kiszivárgott API kulccsal, (c) a jelenlegi **kliensoldali kredit-jóváírásból** fakadó „ingyen kredit" rés.

> **Fontos elvárás a tervvel szemben:** ez a terv **nem ígér teljes megoldást** az ingyen-kredit résre. Backend nélkül a rés **nem szüntethető meg, csak szűkíthető**. A valódi megoldást (szerveroldali webhook-verifikáció) a 6. szekció írja le **opcionális** fázisként, mert az kívül esik a felhasználó által kért Spark-kompatibilis hatókörön.

## Döntések (egyeztetve)

| Kérdés | Választás |
|--------|-----------|
| Hatókör | **Csak Spark-kompatibilis védelem** — ❌ nincs Blaze terv, ❌ nincs Firebase Cloud Functions. A fő útvonal egyetlen lépése sem igényel CF-et. |
| Ingyen-kredit rés | **Bekerül a tervbe** — őszinte helyzetkép + a backend nélkül elérhető szűkítések |
| Stripe Radar | **Ingyenes Radar szint** a fő út (beépített ML kockázati pontszám + CVC/irányítószám blokkolás); a fizetős **Radar for Fraud Teams** külön, opcionális szekció (7.) |
| Kulcskezelés | `VITE_` prefix **elhagyása** (`STRIPE_SECRET_KEY`) + a jelenlegi `sk_test_` **rotálása** + **restricted API key** a szkripthez |
| Kredit-jóváírás forrása | A `credits` érték **soha ne a storage-ból** jöjjön, hanem a `packId` → `CREDIT_PACKS` konstansból |
| Replay-védelem | `?session_id={CHECKOUT_SESSION_ID}` a Payment Link redirect URL-jében + **egyszer-felhasználható** `credit_claims/{sessionId}` RTDB rekord |
| RTDB `wallet` szigorítás | **Nem** „csak nőhet" (a kredites vásárlás levon!) — helyette: **írásonkénti maximális növekmény** (2000⭐ = a legnagyobb pakk) + `lastTopUpAt` alapú ütemkorlát |
| Külső serverless backend | **Opcionális fázis** (6.), nem a fő út — de a terv kimondja, hogy ez az **egyetlen tényleges megoldás** |

---

## ✅ Haladás (TODO)

> Jelölés: `[ ]` hátravan · `[~]` folyamatban · `[x]` kész.

**A fázis — Kulcs-higiénia (a legjobb ár/érték arányú lépés, ~1 óra)**
- [ ] `.env`: `VITE_STRIPE_SECRET_KEY` → **`STRIPE_SECRET_KEY`** átnevezés (a `VITE_` prefix elhagyása)
- [ ] `.env.example`: ugyanez + a figyelmeztető komment átírása (a jelenlegi szöveg tévesen állítja, hogy a kulcs a prod bundle-be kerül — lásd 3.1)
- [ ] `scripts/create_payment_links.mjs`: `env.VITE_STRIPE_SECRET_KEY` → `process.env.STRIPE_SECRET_KEY ?? env.STRIPE_SECRET_KEY` (a `loadEnv(mode, rootDir, "")` üres prefixe miatt a fájl-alapú olvasás változatlanul működik)
- [ ] Git-történet ellenőrzése: `git log -S "sk_test_" --all --oneline` és `git log -S "sk_live_" --all --oneline` → ha bármi találat, a kulcs **kompromittáltnak** tekintendő
- [ ] `.gitignore` ellenőrzése: `.env` szerepel-e (a `.env.example` igen, a `.env` nem lehet követett)
- [ ] Jelenlegi `sk_test_` kulcs **rotálása**: Stripe Dashboard → Developers → API keys → Secret key → **Roll key**
- [ ] **Restricted API key** létrehozása a szkripthez: Dashboard → Developers → API keys → *Create restricted key*
  - [ ] `Payment Links: Write`, `Products: Write`, `Prices: Write`
  - [ ] **Minden más: None** — kiemelten: `Charges: None`, `Refunds: None`, `Customers: None`, `Balance/Payouts: None`, `Webhook endpoints: None`
  - [ ] A restricted key (`rk_test_…` / `rk_live_…`) kerül a `.env`-be, a teljes `sk_` kulcs **sehová**
- [ ] `scripts/check_secrets.mjs` (**ÚJ**): a `dist/` mappában keres `sk_test_|sk_live_|rk_test_|rk_live_|whsec_` mintát, találat esetén nem nulla exit kóddal leáll
- [ ] `package.json`: `"check:secrets": "node scripts/check_secrets.mjs"` + a `build` / `build:firebase` láncba fűzve
- [ ] `.github/workflows/deploy.yml` és `deploy-firebase.yml`: `npm run check:secrets` lépés a build után; ellenőrizve, hogy **egyetlen Stripe-kulcs sem** szerepel a workflow `env:` blokkjában
- [ ] Manuális verifikáció: `npm run build` → `Select-String -Path dist\assets\*.js -Pattern "sk_test_|sk_live_|rk_"` → **0 találat**

**B fázis — Stripe fiók keményítése (~1 óra, csak Dashboard)**
- [ ] 2FA bekapcsolása a tulajdonosi fiókon: Dashboard → Settings → Team and security → *Two-step authentication*
- [ ] 2FA **kötelezővé tétele** minden csapattagra: Settings → Team and security → *Require two-step authentication*
- [ ] Csapattagok jogosultságainak felülvizsgálata (ha van csapattag): a `Developer` / `Analyst` szerep elég, `Administrator` csak a tulajdonosnak
- [ ] Értesítések bekapcsolása: Settings → Personal → Notifications → **Disputes**, **Early fraud warnings**, **Refunds**, **Failed payments** (kisforgalmú fázisban a **Successful payments** is, hogy minden valós fizetés látható legyen)
- [ ] Stripe fiók e-mail címén 2FA + erős jelszó (a Stripe-fiók visszaszerzése az e-mailen keresztül megy)
- [ ] A Stripe fiók bankszámla-adatainak ellenőrzése (payout account) — a helyes számla van-e beállítva

**C fázis — Ingyenes Radar beállítások (~30 perc, csak Dashboard)**
- [ ] Dashboard → Radar → Rules: **Block if CVC verification fails** bekapcsolása
- [ ] Dashboard → Radar → Rules: **Block if postal code verification fails** bekapcsolása
- [ ] A beépített kockázati küszöb ellenőrzése (`Block if risk level is highest`) — alapból aktív, ne legyen kikapcsolva
- [ ] 3D Secure: az EEA-s SCA miatt a Payment Links automatikusan kikényszeríti — ellenőrzés egy teszt-fizetéssel (`4000 0027 6000 3184` = 3DS-kötelező teszt kártya)
- [ ] Radar → Overview: a mérési alap rögzítése (jelenlegi blokkolási/vitatott arány) az F fázis döntéséhez

**D fázis — Payment Link higiénia**
- [ ] A 4 **dev** Payment Link (`stripePaymentLinkDev`, localhost redirect) deaktiválása élesítés előtt: Dashboard → Payment Links → link → *Deactivate* (vagy `stripe.paymentLinks.update(id, { active: false })`)
- [ ] Elavult / kísérleti Payment Linkek deaktiválása a fiókban (a teszt módban maradt 8 linken kívül ne legyen aktív link)
- [ ] Élesítéskor: **külön** live-módú restricted kulccsal létrehozott 4 live link; a `sk_live_` kulcs **soha ne kerüljön a `.env`-be** — egyszeri használat parancssori env változóval: `$env:STRIPE_SECRET_KEY="rk_live_…"; node scripts/create_payment_links.mjs`
- [ ] `scripts/create_payment_links.mjs`: a redirect URL kapjon `?session_id={CHECKOUT_SESSION_ID}` végződést (mindkét — dev és prod — halmazra), majd a 8 meglévő link **újragenerálása vagy frissítése**
- [ ] `src/constants/shopCatalog.ts`: az új link URL-ek beírása (`stripePaymentLink` + `stripePaymentLinkDev`)

> ℹ️ **Pontosítás a [[014-stripe-go-live]] tervből:** a fenti első pont („dev Payment Linkek deaktiválása élesítés előtt") **finomítandó**. Élesben a Stripe `https` redirectet követel, ezért a `localhost`-ra visszatérő dev linkek **nem is hozhatók létre éles módban** — teszt módban maradnak, ahol valós pénzt nem tudnak mozgatni. A fejlesztői folyamat megtartása érdekében ezek **aktívak maradhatnak**; amit ténylegesen érdemes deaktiválni, az a **prod-redirectes teszt link-készlet**, mert az ugyanarra az éles URL-re térne vissza, mint az éles linkek (összekeverhető). Ugyanez a terv rögzíti, hogy az itteni `?session_id={CHECKOUT_SESSION_ID}` toldalék **elrontja** a `create_payment_links.mjs` `redirectUrl === PROD_REDIRECT_URL` mező-javaslatát (`stripePaymentLink` helyett `stripePaymentLinkDev`-et írna) — a `startsWith`-alapú összehasonlításra javítás **kötelező**.

**E fázis — Az ingyen-kredit rés szűkítése (Spark-on belül)**
- [ ] `src/components/shop/CreditShopView.tsx`: a `PENDING_PURCHASE_KEY` payloadból a **`credits` mező kikerül** (marad `packId` + `timestamp`) — a kredit értéke a jóváíráskor a `CREDIT_PACKS`-ból származik
- [ ] `src/App.tsx`: a `/shop/success` detektálásnál a `session_id` query paraméter kiolvasása és átadása (`useShopStore`/modul-szintű változó), mielőtt az URL-t tisztítanánk
- [ ] `src/components/shop/ShopScreen.tsx`: a jóváírás **kapuja** legyen a `session_id` megléte + formátuma (`/^cs_(test|live)_[A-Za-z0-9]{20,}$/`), ne pusztán a storage tartalma
- [ ] `src/components/shop/ShopScreen.tsx`: `PENDING_PURCHASE_TTL` marad 10 perc, de + alsó korlát (`pending.timestamp <= Date.now()`, jövőbeli timestamp elutasítva)
- [ ] `src/firebase/userData.ts` (**ÚJ függvény**): `claimCreditSession(rtdbKey, sessionId, packId)` → `set(ref(db, 'credit_claims/' + sessionId), …)`; a rules miatt a **második** kísérlet `PERMISSION_DENIED`-del elbukik → nincs jóváírás
- [ ] `src/firebase/userData.ts`: `updateUserWallet` átírása `set` → `update`-re, `lastTopUpAt: serverTimestamp()` mezővel (a jelenlegi `set(walletRef, { credits })` **letörölné** a `lastTopUpAt`-ot, és a rules elutasítaná az írást)
- [ ] `src/state/useShopStore.ts`: `buyCredits` átalakítása — előbb `claimCreditSession`, csak **siker** után lokális kredit-növelés + `updateUserWallet`
- [ ] `database.rules.json`: `wallet` node `.validate` — `credits` szám, `>= 0`, írásonkénti **maximális növekmény 2000**, növekedéskor kötelező friss `lastTopUpAt` + 60 s ütemkorlát (részletes snippet az 5.3-ban)
- [ ] `database.rules.json`: új `credit_claims/$sessionId` node — `".write": "auth != null && !data.exists()"`, `".read": false`, `$sessionId.matches(/^cs_(test|live)_[A-Za-z0-9]+$/)`
- [ ] `security.rules.json` szinkronban tartása a `database.rules.json`-nal (a deploy a `database.rules.json`-t használja — lásd [[004-firebase-auth-bugfix]])
- [ ] Rules deploy: `npx firebase-tools deploy --only database`
- [ ] i18n: 5 új kulcs mind az 5 nyelven (lásd 9. szekció)
- [ ] Havi egyeztetés (reconciliation) bevezetése: Stripe Dashboard → Payments export vs. RTDB `credit_claims` — az eltérés = kliensoldali hamisítás

**F fázis — Opcionális: külső serverless webhook backend (a valódi megoldás)**
- [ ] Döntés: Cloudflare Workers (ajánlott) vs. Netlify Functions vs. Vercel (⚠️ Hobby ToS = nem kereskedelmi) — lásd 6.3
- [ ] Worker: `POST /stripe/webhook` — `Stripe-Signature` fejléc ellenőrzése `whsec_…` titokkal
- [ ] Worker: `checkout.session.completed` esemény → `metadata.credit_pack_id` → RTDB REST írás service account JWT-vel (a Spark terv ezt **nem** korlátozza)
- [ ] Worker: idempotencia a `session.id`-re (`credit_claims/{sessionId}` szerver-írt rekord)
- [ ] RTDB Phase-2 rules: `wallet` → `".write": false` (csak a Worker írhat) — ez zárja le véglegesen a rést
- [ ] Kliens: a `/shop/success` képernyő „feldolgozás alatt" állapot + RTDB listener a `wallet.credits` változására (a jóváírás már nem a kliens dolga)

**G fázis — Opcionális: Radar for Fraud Teams**
- [ ] Döntés a 7. szekció küszöbei alapján (forgalom / vitatott arány)
- [ ] Ha igen: egyedi szabályok, allow/block listák, sebesség-limitek (kártyánként/IP-nként), manuális review sor

---

## 1. Kiindulási helyzet (a jelenlegi architektúra)

A [[005-ingame-shop-strapi-stripe]] terv szerinti fizetési út, kiegészítve a **mai** (a 005-ben még nem tükrözött) dev/prod link-szétválasztással:

```
CreditShopView.handleBuy(packId)
  → sessionStorage + localStorage: { packId, credits, timestamp }
  → window.location.href = getPaymentLinkUrl(pack)        ← import.meta.env.DEV alapján dev vagy prod link
  → [Stripe hosztolt fizetőoldal]
  → redirect: …/shop/success
  → App.tsx: pathname.includes("/shop/success") → transitionTo("shop")
  → ShopScreen useEffect: storage olvasás → buyCredits(packId)
  → useShopStore: credits += pack.credits → updateUserWallet(rtdbKey, newCredits)
  → RTDB: users/{rtdbKey}/wallet = { credits }
```

**A kritikus rés egy mondatban:** a jóváírás **kizárólag** a localStorage tartalmán alapul; semmi nem igazolja, hogy fizetés történt. A DevTools konzolban egyetlen sorral (`localStorage.setItem("realtime_space_travel_pending_credit", '{"packId":"credits-ultra","credits":2000,"timestamp":Date.now()}')`) bárki 2000⭐-ot ír be magának, korlátlanul ismételve.

### Ami MA már van (2026-07-26-i állapot)

| Elem | Állapot |
|---|---|
| `CreditPack.stripePaymentLinkDev?: string` + `getPaymentLinkUrl(pack)` | ✅ `src/constants/shopCatalog.ts` |
| 8 teszt Payment Link (4 prod → Firebase Hosting, 4 dev → `localhost:5173`) | ✅ Stripe fiókban |
| `scripts/create_payment_links.mjs --redirect=<url>` | ✅ |
| `PENDING_PURCHASE_TTL = 10 * 60 * 1000` + `pack.credits !== pending.credits` ellenőrzés | ✅ `ShopScreen.tsx` |
| Stripe kulcs `.env`-ben `VITE_STRIPE_SECRET_KEY` néven, `sk_test_` | ⚠️ átnevezendő + rotálandó |
| RTDB Phase-1 rules: a kliens írhatja a `wallet`-et | ⚠️ szigorítandó |

---

## 2. Fenyegetés-modell

| # | Fenyegetés | Előfeltétel | Kár | Jelenlegi védelem | Terv szerinti védelem |
|---|---|---|---|---|---|
| 1 | **Carding / card testing** | Kiszivárgott `sk_live_` **vagy** a Payment Linkek tömeges használata | Chargeback-díj ~15–25 €/db, Stripe fiók-felfüggesztés, kártyahálózati monitoring program | Fix összegek + EEA 3DS | Kulcs-higiénia (A), restricted key, ingyenes Radar (C) |
| 2 | **Refund-támadás** | Kiszivárgott `sk_live_` (refund jogosultsággal) | A bevétel eltűnik (a pénz az eredeti kártyára megy vissza) | ❌ nincs | **Restricted key refund-jog nélkül** (A) + 2FA (B) + refund-értesítés (B) |
| 3 | **Adatlopás** | Kiszivárgott `sk_live_` (customer/charge olvasással) | Teljes vásárlói lista (név, e-mail, cím, kártyatípus + utolsó 4 jegy, fizetési előzmény) → **GDPR bejelentés-köteles** | ❌ nincs | Restricted key `Customers: None`, `Charges: None` (A) |
| 4 | **Katalógus-manipuláció** | Kiszivárgott kulcs `prices:write` / `payment_links:write` joggal | Árak átírása, redirect URL átirányítása adathalász oldalra | ❌ nincs | Rotáció + a restricted key **külön** tárolása; link-audit (D); a redirect URL fix ellenőrzése minden deploy előtt |
| 5 | **Ingyen kredit** | **Semmi** — elég egy böngésző DevTools | A játékbeli gazdaság összeomlik; a valós pénzes vásárlás értelmét veszti | ❌ nincs | E fázis (szűkítés) + F fázis (megszüntetés) |

### 2.1 Carding — enyhítő körülmény, amit érdemes kimondani

A card testing lényege, hogy a támadó **apró összegekkel** (0,50–2 €) teszteli tömegesen a lopott kártyaszámokat, mert az apró terhelés ritkábban tűnik fel a kártyabirtokosnak, és olcsóbb neki. A mi Payment Linkjeink **fix, magas összegűek** (5 / 10 / 25 / 100 €), és az összeg a Stripe-objektumon van rögzítve — a Payment Link URL-jével **nem lehet tetszőleges összeget terhelni**. Ez természetes védelem mindaddig, amíg a támadó csak a nyilvános Payment Link URL-eket éri el.

Ez a védelem **megszűnik**, ha a `sk_live_` kulcs kiszivárog: a kulccsal tetszőleges összegű `PaymentIntent` hozható létre. Innen ered a terv prioritása: **a kulcs-higiénia (A fázis) fontosabb minden más lépésnél.**

Emellett az EEA-s SCA szabály miatt a Payment Links európai kártyáknál automatikusan **3D Secure**-t kényszerít, ami a carding-ot gyakorlatilag ellehetetleníti a hosztolt oldalon keresztül.

### 2.2 Refund-támadás — a kár határa

Az API kulccsal minden korábbi fizetés visszatéríthető. **A támadó ezen nem nyer** — a pénz mindig az eredeti fizető kártyájára megy vissza, nem a támadóhoz. Ez rombolás, nem lopás.

**A kifizetési (payout) bankszámlát API-val NEM lehet átírni** — ehhez Dashboard-belépés kell, jelszóval és 2FA-val. Ez határolja be a kár mértékét: a legrosszabb eset a bevétel eltűnése és a vásárlói bizalom sérülése, nem pedig a pénz átirányítása a támadóhoz. Ezért éri meg annyira a **restricted key**: `Refunds: None` jogosultsággal egy kiszivárgott kulcs **egyáltalán nem tud refundot indítani**.

---

## 3. Kulcskezelés — mért tények

### 3.1 Mit tesz a Vite az env változókkal (méréssel igazolva)

| Környezet | Viselkedés | Következmény a `VITE_STRIPE_SECRET_KEY`-re |
|---|---|---|
| **Prod build** (`npm run build`) | A Vite **kizárólag azokat** az `import.meta.env.VITE_X` hivatkozásokat helyettesíti be a bundle-be, amelyek **konkrétan szerepelnek a forráskódban** | A kulcs **NEM kerül** a prod bundle-be, mert a `src/` alatt **semmi nem hivatkozik** rá (ellenőrizve: `dist/assets/*.js`-ben nincs `sk_` minta) |
| **Dev szerver** (`npm run dev`) | A Vite a **teljes** (prefixre szűrt) env objektumot beinjektálja **minden modulba** — az `import.meta.env` a böngészőben élő objektum | A kulcs **olvasható a böngészőből** a `localhost:5173`-on. `npm run dev -- --host` esetén **a helyi hálózaton is** |

**Következtetés:** a `VITE_` prefix technikailag működik (a Node-szkript látja), de **footgun**: elég egyetlen `console.log(import.meta.env)` vagy egy hibajelentő integráció, ami az env-et is elküldi, és a kulcs prodban is kikerül. A `.env.example` jelenlegi kommentje („the VITE_ prefix means Vite inlines this into the client bundle") **túl szigorúan fogalmaz** a prod buildre nézve, de a dev szerverre nézve **alábecsüli** a kockázatot — mindkettőt pontosítani kell.

### 3.2 A megoldás: prefix nélküli név (egysoros változtatás)

A `scripts/create_payment_links.mjs` a `loadEnv(process.env.NODE_ENV ?? "development", rootDir, "")` hívást használja **üres prefixszel**, tehát **bármilyen nevű** env változót lát. Az átnevezés így egyetlen sor a szkriptben és egy sor a `.env`-ben:

```js
// scripts/create_payment_links.mjs
const secretKey = process.env.STRIPE_SECRET_KEY ?? env.STRIPE_SECRET_KEY;
if (!secretKey) {
  console.error("❌ Missing STRIPE_SECRET_KEY — see .env.example (no VITE_ prefix on purpose).");
  process.exit(1);
}
```

A `process.env` elsőbbsége azért kell, hogy az **élő** kulcs egyszeri használatra átadható legyen anélkül, hogy fájlba kerülne:

```powershell
$env:STRIPE_SECRET_KEY="rk_live_…"; node scripts/create_payment_links.mjs
```

### 3.3 Restricted API key — a legjobb ár/érték arányú lépés

A `scripts/create_payment_links.mjs` mindössze három műveletet végez: `products.create`, `prices.create`, `paymentLinks.create`. Ehhez **nem kell** teljes jogú secret key.

| Jogosultság | Beállítás | Miért |
|---|---|---|
| Payment Links | **Write** | a szkript létrehozza a linkeket |
| Products | **Write** | a szkript létrehozza a termékeket |
| Prices | **Write** | a szkript létrehozza az árakat |
| Refunds | **None** | ⭐ ez teszi hatástalanná a refund-támadást (2. fenyegetés) |
| Charges / PaymentIntents | **None** | ez teszi hatástalanná a cardingot kulccsal (1. fenyegetés) |
| Customers | **None** | ez teszi hatástalanná az adatlopást (3. fenyegetés) |
| Balance / Payouts / Webhook endpoints | **None** | nem kell a szkriptnek |

**Egy kiszivárgott restricted key legrosszabb esetben új terméket és Payment Linket hoz létre** a fiókban — kellemetlen (4. fenyegetés), de nem pénzügyi kár, és a Dashboardon azonnal látszik és visszavonható.

---

## 4. Amit a Stripe oldalán kell beállítani (Spark-független)

### 4.1 Ingyenes Radar szint — mit ad

| Funkció | Ingyenes Radarban | Megjegyzés |
|---|---|---|
| ML kockázati pontszám minden fizetéshez | ✅ | a `Highest risk` automatikusan blokkolva |
| **Block if CVC verification fails** | ✅ (kapcsoló) | a lopott kártyaszámokhoz gyakran nincs meg a CVC → erős carding-védelem |
| **Block if postal code verification fails** | ✅ (kapcsoló) | AVS-hiba blokkolása |
| 3D Secure az EEA-s SCA szerint | ✅ automatikus | Payment Linkeknél a Stripe intézi |
| Egyedi szabályok, allow/block listák, sebesség-limitek | ❌ | → Radar for Fraud Teams (7. szekció) |
| Manuális review sor | ❌ | → Radar for Fraud Teams |

### 4.2 Dashboard értesítések (incidens-észlelés)

Backend nélkül **az értesítés az egyetlen valós idejű észlelési csatorna**. Bekapcsolandó: **Disputes** (vitatott fizetés), **Early fraud warnings** (a kártyakibocsátó csalás-jelzése, még a vita előtt), **Refunds** (ha nem te indítottad → kulcs-kompromittálás gyanú), **Failed payments** (a hirtelen megugró hibaarány a card testing klasszikus jele).

> **Incidens-forgatókönyv (dokumentálni kell):** váratlan refund vagy failed-payment hullám esetén → (1) Dashboard → Developers → API keys → **minden kulcs rollolása**, (2) a fiók aktivitásnaplójának átnézése (Settings → Team and security → activity log), (3) a Payment Linkek redirect URL-jeinek ellenőrzése, (4) szükség esetén a Stripe support értesítése.

---

## 5. Az ingyen-kredit rés — őszinte helyzetkép

### 5.1 Amit backend nélkül NEM lehet elérni

- **Nem lehet ellenőrizni, hogy a fizetés valóban megtörtént-e.** Ehhez a Stripe API-t kellene hívni (`checkout.sessions.retrieve`), ami secret kulcsot igényel — a kliensbe tett secret kulcs pedig maga a legsúlyosabb sebezhetőség (3. fenyegetés). **Ez az út zárva van.**
- **Nem lehet ellenőrizni a `session_id` valódiságát.** A kliens csak a formátumot tudja nézni; egy kitalált `cs_test_` + 40 véletlen karakter alaki szempontból tökéletes.
- **Nem lehet megakadályozni a lokális állapot hamisítását.** A DevTools mindent lát és mindent átír.

**Amit el lehet érni:** a támadás **költségének** és **zajszintjének** megemelése, valamint az **utólagos kimutathatóság** (audit). Ez a különbség „egy sor a konzolban, korlátlanul" és „scriptelni kell, percenként egy pakkot, és minden kísérlet nyomot hagy" között.

### 5.2 A kár mértékének reális megítélése

Az ingyen kredit **nem jelent valós pénzügyi veszteséget** — csak elmaradt bevételt és a játékbeli gazdaság elértéktelenedését. Ezért:

- Ez a rés **nem indokol azonnali architektúra-váltást**, de
- **komolyabb**, mint a kulcs-kockázatok, ha a bolt bevétele érdemi lesz, mert a hamisítás **triviális** (nem kell hozzá se lopott kártya, se kiszivárgott kulcs).

Külön megjegyzés: a vendég (deviceId-alapú) azonosítás miatt a csaló a localStorage törlésével friss pénztárcát is kaphat — de mivel az induló egyenleg 0⭐ (`STARTING_CREDITS`), ez önmagában nem nyereséges.

### 5.3 Spark-on belüli szűkítések

**(a) A `credits` érték szerver-ismert konstansból származzon**

A `PENDING_PURCHASE_KEY` payloadból kikerül a `credits` mező; marad `{ packId, timestamp }`. A jóváírandó összeget a `CREDIT_PACKS.find(p => p.id === packId).credits` adja. Így a támadónak legfeljebb **létező pakkot** lehet hamisítania — tetszőleges összeget nem.

**(b) `session_id` a redirect URL-ben + a jóváírás kapuja**

```js
// scripts/create_payment_links.mjs
after_completion: {
  type: "redirect",
  redirect: { url: `${redirectUrl}?session_id={CHECKOUT_SESSION_ID}` },
}
```

`App.tsx`-ben a `/shop/success` detektálásakor kimentjük a `session_id` paramétert, és a `ShopScreen` **csak akkor** ír jóvá, ha van érvényes alakú session id. Így a puszta storage-hamisítás nem elég — a támadónak a `/shop/success?session_id=cs_test_…` URL-t is meg kell nyitnia.

**(c) Egyszer-felhasználható claim rekord az RTDB-ben (replay-védelem)**

```json
"credit_claims": {
  "$sessionId": {
    ".read": false,
    ".write": "auth != null && !data.exists()",
    ".validate": "$sessionId.matches(/^cs_(test|live)_[A-Za-z0-9]+$/) && newData.hasChildren(['key','packId','at']) && newData.child('at').val() <= now && newData.child('at').val() > now - 600000"
  }
}
```

A kliens **először** ide ír, és csak sikeres írás után hívja a `buyCredits`-et. Ugyanaz a `session_id` másodszor `PERMISSION_DENIED`-et kap (`!data.exists()`), tehát **egy valódi fizetés egyszer írható jóvá**. A `.read: false` miatt a kliens nem tudja előre lekérdezni, hogy egy id foglalt-e — pontosan ezt akarjuk.

> ⚠️ **Korlát:** a támadó **kitalált** session id-kkal továbbra is ír. A claim-ledger nem a hamisítás ellen véd, hanem (1) a valódi fizetés **többszöri** beváltása ellen, és (2) **auditnyomot** hagy: a `credit_claims` és a Stripe Payments export összevetése kimutatja a hamis jóváírásokat.

**(d) RTDB `wallet` szigorítás — növekmény-limit + ütemkorlát**

> Fontos: a „csak nőhet" szabály **nem alkalmazható**, mert a kredites vásárlás (`checkout`) **levon** a `wallet.credits`-ből. Helyette az **írásonkénti növekményt** korlátozzuk.

```jsonc
"wallet": {
  ".write": "auth != null && (root.child('device_map').child($key).val() == auth.uid || $key == auth.uid)",
  ".validate": "newData.hasChild('credits')",
  "credits": {
    // Olvashatóság kedvéért tördelve — a fájlban EGY sorban kell lennie.
    ".validate": "newData.isNumber() && newData.val() >= 0 && (
        !data.exists()
        || newData.val() <= data.val()                                   /* költés: korlátlanul szabad */
        || ( newData.val() <= data.val() + 2000                          /* max 1 pakk / írás (Ultra) */
             && newData.parent().child('lastTopUpAt').val() <= now
             && newData.parent().child('lastTopUpAt').val() >= now - 10000
             && ( !data.parent().child('lastTopUpAt').exists()
                  || newData.parent().child('lastTopUpAt').val() >= data.parent().child('lastTopUpAt').val() + 60000 ) )
      )"
  },
  "lastTopUpAt": { ".validate": "newData.isNumber() && newData.val() <= now" },
  "$other": { ".validate": false }
}
```

Hatás: egy csaló legfeljebb **2000⭐-ot tud percenként** felírni (a jelenlegi „korlátlan, ciklusban" helyett), és a `now` **szerveridő**, amit a kliens nem tud hamisítani.

> ⚠️ **Implementációs csapda:** a jelenlegi `updateUserWallet` `set(walletRef, { credits })`-et hív, ami **letörli** a `lastTopUpAt`-ot → a fenti szabály minden növelést elutasítana. Kötelező átállni `update(walletRef, { credits, lastTopUpAt: serverTimestamp() })`-re.
>
> ⚠️ **A 2000-es limit és a jövőbeli `awardWage`:** a küldetés végi kredit-jóváírás ([[003-firebase-auth-settings]] 6. pont) ugyanezen a szabályon megy át. Ha a wage egyszerre 2000⭐-nál többet adna, a limitet együtt kell hangolni.
>
> ⚠️ **A 2000-es limit és a guest-merge ([[010-firebase-guest-merge-single-gate]]):** az a terv az **első** guest→fiók merge-nél a vendég kreditet **hozzáadja** a fiók walletjéhez (`target + guest`), egyetlen `wallet/credits` írásban. Ha a vendég több pakkot vásárolt, a növekmény **meghaladhatja a 2000⭐-ot** → a fenti szabály **elutasítaná a legitim merge-t**. A `!data.exists()` ág csak akkor fed, ha a targetnek egyáltalán nincs wallet-je; ha van, a merge-írás beleütközik a limitbe. Megoldás: a szabály kapjon **kivételt az egyszeri guest-merge írásra** (pl. a `profile/guestMergeClaimed` `false→true` átmenetéhez kötött megengedőbb növekmény), **vagy** a 010 kapzsizza a merge-kreditet 2000⭐-ra. A duplázás ellen a 010 fiók-flagje + guest-node-törlése véd, nem a limit.

**(e) Időkorlátok**

A `PENDING_PURCHASE_TTL = 10 perc` marad, kiegészítve azzal, hogy a `timestamp` **nem lehet a jövőben** (a jelenlegi kód ezt nem nézi, így egy jövőbeli timestamp örökre érvényes claim maradna).

---

## 6. Opcionális kerülőút — külső serverless backend (a valódi megoldás)

### 6.1 A lényeg

A „nincs Blaze terv" valójában **költség-korlát, nem technológiai korlát**. A Blaze azért kellene, mert a Firebase Cloud Functions kimenő hálózati hívást és számlázási fiókot igényel. **Egy ingyenes külső serverless futtató ugyanezt a szerepet betölti, a Firebase számlázás érintése nélkül** — a Firebase Realtime Database **REST API-ja** service accounttal írható kívülről, és ehhez **nem kell Blaze**.

### 6.2 Architektúra

```
Stripe  ──(checkout.session.completed + Stripe-Signature)──►  Cloudflare Worker
                                                                  │  1. aláírás ellenőrzés (whsec_…)
                                                                  │  2. metadata.credit_pack_id → credits
                                                                  │  3. idempotencia: credit_claims/{session.id}
                                                                  ▼
                                                   Firebase RTDB REST API
                                                   (service account JWT → OAuth token)
                                                   users/{key}/wallet/credits  ← SZERVER írja
```

Ezzel a RTDB rules **Phase-2**-re állítható: `"wallet": { ".write": false }` — a kliens **egyáltalán nem** tud kreditet írni, és a rés **megszűnik**, nem csak szűkül. Ugyanez az út adja meg a [[003-firebase-auth-settings]] 6. pontjában szereplő `awardWage` / `purchaseWithCredits` szerepét is, Cloud Functions nélkül.

### 6.3 Futtató-választás

| Platform | Ingyenes keret | Kereskedelmi használat | Megjegyzés |
|---|---|---|---|
| **Cloudflare Workers** (ajánlott) | 100 000 kérés/nap | ✅ engedélyezett | WebCrypto (RS256) → a service account JWT aláírható; a Stripe webhook-aláírás `crypto.subtle`-lel ellenőrizhető |
| **Netlify Functions** | ~125 000 hívás/hó | ✅ | Node runtime, a `stripe` npm csomag `constructEvent`-je használható |
| **Vercel Hobby** | bőséges | ⚠️ **NEM** — a Hobby ToS tiltja a kereskedelmi használatot | Valós pénzes fizetést kiszolgáló endpointhoz **Pro** csomag kellene |

### 6.4 Miért nem ez a fő út

A felhasználó kifejezetten **Spark-kompatibilis, backend nélküli** védelmet kért. Az F fázis egy új üzemeltetendő komponenst (deploy, titokkezelés, monitoring, service account kulcs) hoz be. A terv ezért **kész, végiggondolt opcióként** tartja nyilván, nem előfeltételként — de rögzíti, hogy **az E fázis összes lépése együtt sem ér fel ezzel**.

---

## 7. Opcionális: Radar for Fraud Teams

| Szempont | Tartalom |
|---|---|
| **Mit ad** | Egyedi szabálynyelv (`Block if :card_country: != :ip_country:`), **allow/block listák** (kártya-ujjlenyomat, e-mail, IP, ország), **sebesség-limitek** (pl. „max 3 sikertelen fizetés / kártya / óra"), **manuális review sor**, részletes kockázati insight-ok |
| **Nagyságrendi ár** | ~0,05–0,07 € / átvizsgált tranzakció a normál díj felett (⚠️ a pontos árat a Stripe aktuális árlistáján kell ellenőrizni — régiónként eltér) |
| **Mikor éri meg** | (a) tartósan **> ~300–500 tranzakció/hó**, ahol a fix költség elenyészik a megelőzött chargeback-díjakhoz (15–25 €/db) képest; **vagy** (b) a **vitatott arány (dispute rate) tartósan > 0,4 %**, mert 0,7–1 % felett a kártyahálózati monitoring programok komoly büntetéssel járnak; **vagy** (c) az ingyenes Radar blokkolási statisztikái egyértelmű támadási mintát mutatnak (azonos IP/kártya-sorozat) |
| **Mikor NEM éri meg** | A jelenlegi (teszt módú, forgalom nélküli) fázisban semmiképp. A B+C fázis ingyenes lépései a forgalom első hónapjaira bőven elegendők. |
| **Döntési trigger** | A C fázis végén rögzített Radar-alapmérés + 1 hónap éles forgalom |

---

## 8. Módosított / új fájlok

| Fájl | Változás | Fázis |
|---|---|---|
| `.env` | `VITE_STRIPE_SECRET_KEY` → `STRIPE_SECRET_KEY`, érték = új **restricted** key | A |
| `.env.example` | ugyanez + pontosított komment (dev szerver ≠ prod build viselkedés) | A |
| `scripts/create_payment_links.mjs` | env-név csere, `process.env` elsőbbség, `?session_id={CHECKOUT_SESSION_ID}` a redirect URL-ben | A, D |
| `scripts/check_secrets.mjs` | **ÚJ** — a `dist/` titok-szkennelése, nem nulla exit kód találatnál | A |
| `package.json` | `check:secrets` script + a build láncba fűzés | A |
| `.github/workflows/deploy.yml` | `npm run check:secrets` lépés; Stripe-kulcs **nincs** az `env:` blokkban | A |
| `.github/workflows/deploy-firebase.yml` | ugyanaz | A |
| `src/constants/shopCatalog.ts` | az újragenerált (session_id-s) 8 Payment Link URL | D |
| `src/components/shop/CreditShopView.tsx` | a payloadból kikerül a `credits` mező | E |
| `src/App.tsx` | `session_id` query param kimentése a `/shop/success` detektálásakor | E |
| `src/components/shop/ShopScreen.tsx` | session_id kapu + formátum-ellenőrzés, claim-hívás, hibaágak + i18n üzenetek | E |
| `src/firebase/userData.ts` | **ÚJ** `claimCreditSession()`; `updateUserWallet` → `update` + `lastTopUpAt: serverTimestamp()` | E |
| `src/state/useShopStore.ts` | `buyCredits` → claim-siker után írjon | E |
| `database.rules.json` | `wallet` `.validate` (növekmény-limit + ütemkorlát), új `credit_claims` node | E |
| `security.rules.json` | szinkronban tartás a `database.rules.json`-nal | E |
| `src/i18n/locales/{en,hu,fr,de,es}/translation.json` | 5 új kulcs (9. szekció) | E |

---

## 9. i18n

Új kulcsok a `shop.credits` névtér alá (ez **objektum-névtér**, a stringhez továbbra is `shop.creditsLabel` használandó — lásd `CLAUDE.md`). Mind az 5 nyelven (`en`, `hu`, `fr`, `de`, `es`) kötelező paritással:

| Kulcs | Mikor jelenik meg | Magyar szöveg (javaslat) |
|---|---|---|
| `shop.credits.claimRejected` | nincs / hibás alakú `session_id` a visszatéréskor | „A vásárlás nem igazolható. Ha fizettél, vedd fel velünk a kapcsolatot." |
| `shop.credits.claimExpired` | a pending rekord lejárt (>10 perc) vagy jövőbeli timestamp | „A vásárlási munkamenet lejárt. Indítsd újra a vásárlást." |
| `shop.credits.claimDuplicate` | a `credit_claims` írás elbukott (már beváltott session) | „Ez a vásárlás már jóvá lett írva." |
| `shop.credits.claimRateLimited` | a `wallet` írás `PERMISSION_DENIED` az ütemkorlát miatt | „Túl gyakori jóváírás. Próbáld újra egy perc múlva." |
| `shop.credits.claimSupport` | a fenti hibák alatt megjelenő súgósor | „Segítség: őrizd meg a Stripe visszaigazoló e-mailt." |

---

## 10. Tesztelés / verifikáció

**A fázis (kulcs-higiénia)**
1. `npm run build` → `Select-String -Path dist\assets\*.js -Pattern "sk_|rk_|whsec_"` → **0 találat**
2. `npm run dev` → böngésző konzol → `import.meta.env` → a kimenetben **nincs** Stripe-kulcs (az átnevezés után)
3. `node scripts/create_payment_links.mjs` a **restricted** kulccsal → sikeres link-létrehozás
4. Ellenőrzés, hogy a restricted kulcs **nem tud** refundot: `stripe.refunds.create(...)` egy dobozteszt-szkriptben → `permission_error` várható

**C fázis (Radar)**
5. Teszt-fizetés hibás CVC-vel (`4000 0000 0000 0101`) → **blokkolt**
6. Teszt-fizetés 3DS-kötelező kártyával (`4000 0027 6000 3184`) → 3DS lap megjelenik

**E fázis (ingyen-kredit szűkítés)**
7. **Boldog út:** valós teszt-vásárlás mind a 4 pakkra → visszatérés → kredit pontosan a pakk értékével nő; `credit_claims/{sessionId}` létrejött az RTDB-ben
8. **Replay:** ugyanazzal a `?session_id=…` URL-lel újratöltés → **nincs** újabb jóváírás, `claimDuplicate` üzenet
9. **Storage-hamisítás session_id nélkül:** `localStorage.setItem(PENDING_PURCHASE_KEY, …)` + `/shop` megnyitása → **nincs** jóváírás
10. **Payload-hamisítás:** `{"packId":"credits-starter","credits":999999,…}` → legfeljebb 100⭐ íródik jóvá (a `CREDIT_PACKS` értéke)
11. **Ütemkorlát:** két egymást követő jóváírás 60 s-on belül → a második `PERMISSION_DENIED`
12. **Költés nem törik el:** kredites vásárlás (`checkout`) továbbra is levon → a `.validate` a csökkenést engedi
13. **Rules unit-teszt** (opcionális): `firebase emulators:exec` + `@firebase/rules-unit-testing` a `wallet` és `credit_claims` szabályokra

---

## 11. Ismert korlátok

| Korlát | Oka | Feloldás |
|---|---|---|
| A `session_id` valódisága kliensről **nem ellenőrizhető** | Ehhez secret kulcs kellene a kliensben | F fázis (Worker + webhook) |
| A `credit_claims` **kitalált** id-kat is elfogad | `.read: false` + nincs szerveroldali verifikáció | F fázis; addig **audit** (Stripe export ↔ `credit_claims`) |
| A kliens továbbra is írhatja a `wallet`-et | Phase-1 rules ([[004-firebase-auth-bugfix]] döntése) | F fázis után `".write": false` (Phase-2) |
| 2000⭐/perc továbbra is hamisítható | A rules-limit csak lassít | F fázis |
| A Radar ingyenes szintjén **nincs** allow/block lista és sebesség-limit | Stripe csomagkorlát | G fázis (Fraud Teams) |
| Dev Payment Linkek `localhost` redirecttel élnek a fiókban | A redirect URL a Stripe-objektumon van | D fázis: deaktiválás élesítés előtt |
| A `.env` fájl a fejlesztői gépen továbbra is tartalmaz egy (restricted) kulcsot | Lokális fejlesztés | `sk_live_` **soha** ne kerüljön bele; live művelet csak `$env:`-vel |
| Cross-origin localStorage (localhost ↔ Firebase Hosting) | Böngésző origin-izoláció | Már dokumentálva a [[005-ingame-shop-strapi-stripe]]-ben |

---

## 12. Kockázatok / figyelmeztetések

- **A rules szigorítás elronthatja a működő kredit-írást.** A `set` → `update` átállás a `userData.ts`-ben **kötelező** a `.validate` bevezetésével **együtt**, különben minden jóváírás `PERMISSION_DENIED`-et kap. A két változtatás egy deployban menjen.
- **A `now` szerveridő, a `Date.now()` nem.** A rules-ben kizárólag `now`-ra szabad támaszkodni.
- **A meglévő 8 Payment Link újragenerálása** (session_id-s redirect) után a `shopCatalog.ts` URL-jeit **azonnal** frissíteni kell, különben a fizetés visszatérése session id nélkül érkezik, és az E fázis kapuja **minden valós vásárlást is elutasít**.
- **Kulcs-rotáció sorrendje:** előbb az új restricted key létrehozása és a `.env` frissítése, **utána** a régi `sk_test_` rollolása — fordítva a szkript átmenetileg használhatatlan.
- **GDPR:** a Stripe az adatfeldolgozó, a fiók tulajdonosa az adatkezelő. Kulcs-kiszivárgásból eredő vásárlói adatlopás **bejelentés-köteles** (72 óra). Az incidens-forgatókönyvet (4.2) érdemes írásban rögzíteni.
- **Ne keletkezzen hamis biztonságérzet:** az E fázis után is igaz, hogy elszánt támadó szerez ingyen kreditet. A terv sikerkritériuma a **költség megemelése és a kimutathatóság**, nem a megszüntetés.
- **A `credit_claims` node növekszik** korlátlanul. Spark-on a RTDB tárhely 1 GB — egy claim rekord ~100 bájt, tehát ez évekig nem probléma, de a takarítás (F fázisban, szerveroldalról) számításba veendő.

---

## 13. Becsült ráfordítás

| Fázis | Tartalom | Nagyságrend |
|---|---|---|
| A | Kulcs-higiénia (átnevezés, rotáció, restricted key, `check_secrets.mjs`, CI) | ~1–2 óra |
| B | Stripe fiók keményítés (2FA, jogosultságok, értesítések) | ~1 óra |
| C | Ingyenes Radar beállítások + verifikáció | ~30 perc |
| D | Payment Link higiénia + újragenerálás session_id-vel | ~1 óra |
| E | Ingyen-kredit rés szűkítése (kliens + RTDB rules + i18n + teszt) | ~1 nap |
| F *(opcionális)* | Cloudflare Worker + webhook + RTDB REST + Phase-2 rules | ~1–2 nap |
| G *(opcionális)* | Radar for Fraud Teams bevezetés | ~fél nap + havi díj |

**Kész definíció (A–E fázis):** a Stripe secret kulcs sehol nem `VITE_` prefixes és a prod bundle-ben sem szerepel (CI-ben automatikusan ellenőrizve); a szkript **restricted** kulccsal fut, amely refundot és vásárlói adatot **nem** ér el; a Stripe fiókon kötelező 2FA és aktív dispute/refund/EFW értesítés van; az ingyenes Radar CVC- és irányítószám-blokkolása aktív; a dev Payment Linkek deaktiválva; a kredit-jóváírás csak érvényes `session_id`-vel, a `CREDIT_PACKS`-ból származó összeggel, **egyszer** történhet meg, és az RTDB rules írásonként legfeljebb 2000⭐ növekményt enged percenként egyszer; minden elutasítási ág lokalizált üzenetet mutat mind az 5 nyelven.

---

## 14. Kapcsolódó tervek

- [[005-ingame-shop-strapi-stripe]] – **közvetlen előfeltétel.** Ez a terv az ott megépített Payment Links + kliensoldali jóváírás út köré épít védelmet; a 005 „Ismert korlátok" táblájának *„Kliens írja a kreditet"* és *„Nincs webhook → nincs automatikus verifikáció"* sorai itt kapnak konkrét kockázat-elemzést és enyhítést.
- [[014-stripe-go-live]] – **ráépülő élesítési terv, amelynek ez a terv A és E fázisa blokkoló előfeltétele.** Valós pénzes fizetés nem indulhat a kulcs-higiénia és az ingyen-kredit rés szűkítése nélkül. A 012 az itteni `?session_id={CHECKOUT_SESSION_ID}` redirect-mintát viszi tovább az éles linkekre, `rk_live_` restricted kulccsal generálva, és kiegészíti a fizetési utat a Stripe Tax (`automatic_tax`, `tax_behavior`) valamint a 14 napos elállási jog lemondása (`consent_collection`) elemekkel. Fontos, hogy a 012 sem oldja meg a webhook hiányát: élesben a **refund után a kredit nem vonódik vissza** automatikusan — ez az F fázis melletti további érv.
- [[004-firebase-auth-bugfix]] – a Phase-1 RTDB rules (`wallet` kliens-írható) és a `device_map` alapú `rtdbKey` innen származik; az 5.3 (d) pont ezeket a szabályokat **szigorítja additívan**, a `device_map` logika érintetlenül marad.
- [[009-firebase-identity-split-bugfix]] – **blokkoló előfeltétel.** A `rtdbKey` ma egy `catch`-ági fallbackkel a `deviceId`-re térülhet, ami ugyanabból a Google fiókból **két RTDB user node-ot** csinál, külön kredittel. Ez a terv a `credit_claims/{sessionId}` ledgert és a `wallet` írási limitet a user node-hoz köti — szétcsúszott identitás mellett a claim és a jóváírás a **rossz** node alá kerülne, azaz valós pénzért fizetett kredit tűnne el. **Forward-compat pont, amit itt kell átvezetni:** a tervezett `wallet` növekmény-limit szabályának **null-safe** ágat kell tartalmaznia (`!data.exists()`), mert első belépéskor és a guest-migráció kredit-átvételekor a `wallet` ág még **nem létezik** — enélkül az `ensureUserNode` create-ágja és a migráció is `PERMISSION_DENIED`-del bukik.
- [[003-firebase-auth-settings]] – a Phase-2 rules (`wallet.write = false`) és az `awardWage` / `purchaseWithCredits` szerveroldali út itt van felvázolva Cloud Functionökkel; a jelen terv **F fázisa** ugyanezt Blaze terv nélkül, külső serverless futtatóval valósítaná meg.
- [[002-ingame-shop-frontend]] – a `useShopStore` kredit/kosár/birtoklás logikája; a `buyCredits` és a `checkout` viselkedése a rules-limit hangolásánál számít (a `checkout` **levon**, ezért nem alkalmazható „csak nőhet" szabály).
