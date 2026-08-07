---
title: "Stripe élesítés – teszt módból valós pénzes fizetésbe"
slug: 024-stripe-go-live
type: plan
category: payments
status: not-started
implemented: false
implemented_at: null
created_at: "2026-07-26"
updated_at: "2026-08-06"
author: exphoenee
step: 24
phases: []
dependencies:
  - 005-ingame-shop-strapi-stripe
  - 009-firebase-identity-split-bugfix
  - 010-firebase-guest-merge-single-gate
  - 020-nextjs-migration
  - 021-stripe-fraud-defense
  - 022-stripe-tax-compliance
  - 023-gdpr-compliance
related_plans:
  - 002-ingame-shop-frontend
  - 003-firebase-auth-settings
  - 022-stripe-tax-compliance
  - 023-gdpr-compliance
tags:
  - stripe
  - payments
  - go-live
  - tax
  - compliance
---

# Stripe élesítés – teszt módból valós pénzes fizetésbe

**Cél:** a [[005-ingame-shop-strapi-stripe]] tervben megépített, ma **kizárólag teszt módban** működő Stripe Payment Links fizetési utat éles, valós pénzt mozgató fizetéssé alakítani — a Stripe fiókaktiválástól (KYC) a jogilag kötelező weboldal-elemeken és a Stripe Tax bekapcsolásán át a 4 éles Payment Link generálásáig és a go-live ellenőrzésig.

> **A terv fő értéke:** minden feladatnál egyértelmű, hogy **kézi** (a felhasználó a Stripe Dashboardon / hatóságnál / jogi szövegen dolgozik) vagy **automatizálható** (script vagy AI elvégzi). Lásd a 2. szekció összefoglaló tábláját.

> ⚠️ **Ez a terv technikai útmutató, nem jogi és nem adótanácsadás.** Az ÁFA-, OSS-, számlázási és fogyasztóvédelmi pontokat **könyvelővel / adószakértővel, illetve jogásszal meg kell erősíteni** az élesítés előtt. A terv jelzi, hol kötelező a szakértői jóváhagyás.

## Döntések (egyeztetve)

| Kérdés | Választás |
|--------|-----------|
| Sorrend | **Előbb a [[021-stripe-fraud-defense]] E fázisa** (ingyen-kredit rés szűkítése) **és A fázisa** (kulcs-higiénia, restricted key), **utána** élesítés. Valós pénz nem mehet triviálisan hamisítható kredit-jóváírás fölé. |
| ÁFA | **Stripe Tax bekapcsolása** — automatikus, országonkénti ÁFA-számítás és -beszedés, OSS-riporttal |
| Üzleti forma | **Egyéni vállalkozó** (magyar) — a KYC checklist ehhez igazítva |
| Árak megjelenítése | **Bruttó (`tax_behavior: "inclusive"`)** — az EU-s fogyasztói árfeltüntetés miatt a kiírt 5 € = amennyit a vásárló fizet (lásd 6.4, döntési tábla) |
| Elállási jog | A vásárlás előtt **kifejezett lemondás** a 14 napos elállásról (Payment Link ToS-elfogadás + saját UI megerősítés) — lásd 5. szekció |
| Automatizálási út | **`scripts/create_payment_links.mjs`** (Stripe npm SDK). ❌ **Nem MCP** — lásd az alábbi megjegyzést |
| Teszt mód sorsa | **Megmarad párhuzamosan.** A Stripe teszt és éles módja külön adatbázis; a dev linkek teszt módban élnek tovább, mert élesben `http://localhost` redirect **nem engedélyezett** |

> ℹ️ **MCP megjegyzés:** a [[005-ingame-shop-strapi-stripe]] C fázisában ki van pipálva a „Stripe MCP server telepítve" tétel, de a **jelenlegi környezetben egyetlen Stripe MCP tool sincs betöltve** (ellenőrizve). Elvben az MCP ugyanezeket az API-hívásokat végezné (`products.create`, `prices.create`, `paymentLinks.create`), de a **megbízható és reprodukálható út a `scripts/create_payment_links.mjs`** — a terv erre épül.

---

## ✅ Haladás (TODO)

> Jelölés az állapotra: `[ ]` hátravan · `[~]` folyamatban · `[x]` kész.
> Jelölés a végrehajtóra: **`[K]`** = KÉZI (a felhasználó: Stripe Dashboard / hatóság / jogi szöveg) · **`[A]`** = AUTOMATIZÁLHATÓ (script vagy AI) · **`[K+A]`** = vegyes (AI előkészít, ember dönt/beír).

**A fázis — Előfeltételek (blokkoló, a 011-es tervből)**
- [ ] `[A]` [[021-stripe-fraud-defense]] **A fázis** teljes lefutása: `VITE_STRIPE_SECRET_KEY` → `STRIPE_SECRET_KEY` (`.env`, `.env.example`, `create_payment_links.mjs` **és mindkét workflow `env:` blokkja**), kulcs-rotáció, **restricted key**, `scripts/check_secrets.mjs`, CI-beépítés
- [ ] `[K]` A GitHub repository secret **`VITE_STRIPE_SECRET_KEY` törlése** (Settings → Secrets and variables → Actions) — a frontend soha nem használta, csak kockázat
- [ ] `[A]` `.github/workflows/deploy.yml` + `deploy-firebase.yml`: a Stripe-kulcs env sor **eltávolítása** a build blokkból

> ⚠️ **Egyeztetendő eltérés a [[021-stripe-fraud-defense]] tervvel (lásd ott a 3.0 szekciót).** A 021 empirikus vizsgálata szerint a kulcs ma **nem szivárog** (nincs a `dist/` bundle-ben, nincs a git-történetben), és a felhasználó döntése szerint a kulcs **marad** a `.env`-ben és a workflow-kban — csak **átnevezve** —, mert a 021 és a 024 használni fogja. A fenti két tétel (secret törlése + env sor eltávolítása) ezzel a döntéssel **ütközik**. A végállapotot élesítés előtt tisztázni kell:
> - **(a) Megtartás átnevezve** (021 döntése): a workflow `env:` blokkjában `STRIPE_SECRET_KEY` szerepel, a `VITE_` prefix eltűnik.
> - **(b) Eltávolítás** (ez a terv eredeti javaslata): a build valóban nem használja a kulcsot, így a CI-ból teljesen elhagyható; a link-generálás úgyis **lokálisan, egyszeri `$env:`-vel** fut (7.1–7.2).
>
> Ami **mindkét ágban kötelező**: a `VITE_` prefixes név **sehol** nem maradhat, és `sk_live_` **soha** nem kerülhet se `.env`-be, se GitHub secretbe, se workflow env-be.
>
> ➕ **Frissítés — a [[020-nextjs-migration]] feloldja ezt az eltérést.** A migráció után az (a)/(b) kérdés **tárgytalan**: a build-workflow-k megszűnnek (a GitHub Pages deploy törlődik, a Firebase workflow csak RTDB rules-deployra csupaszodik, build és env nélkül), a Stripe kulcs pedig `STRIPE_SECRET_KEY` néven, **`NEXT_PUBLIC_` prefix nélkül**, Vercel env változóként él — ahol végre **használva is lesz** (Checkout Session + webhook API route). A fenti két tétel („secret törlése", „env sor eltávolítása") tehát **automatikusan teljesül**, csak nem törléssel, hanem a workflow-k megszűnésével.
- [ ] `[A]` [[021-stripe-fraud-defense]] **E fázis** teljes lefutása: `session_id` kapu, `credit_claims` ledger, `CREDIT_PACKS`-ból származó kredit, `wallet` növekmény-limit, i18n hibaágak
- [ ] `[K]` Döntés-megerősítés: a 011 E fázisa nélkül **nem indul** az éles fizetés (a kockázatot lásd 11. tábla)

**B fázis — Stripe fiókaktiválás / KYC (egyéni vállalkozó)** — *túlnyomórészt KÉZI*
- [ ] `[K]` Dashboard → **Activate account** (vagy Settings → Business → Business details) indítása
- [ ] `[K]` Business type: **Individual / Sole proprietorship** (egyéni vállalkozó)
- [ ] `[K]` **Adószám** megadása (magyar 11 jegyű adószám, `xxxxxxxx-y-zz` formátum)
- [ ] `[K]` **Egyéni vállalkozói nyilvántartási szám** megadása (EV-nyilvántartás)
- [ ] `[K]` **Székhely** (a nyilvántartással megegyező cím)
- [ ] `[K]` **Személyazonosító okmány** feltöltése (szem. ig. / útlevél; szükség esetén lakcímigazolás)
- [ ] `[K]` **Bankszámla (IBAN)** a payoutokhoz — a számlatulajdonos neve **egyezzen** a vállalkozó nevével
- [ ] `[K]` Várható forgalom, termékleírás, weboldal URL (`https://realtimespacetravel-e74e3.web.app/`)
- [ ] `[K]` **MCC / iparági kód**: digitális játék / digitális termék (pl. `5816 – Digital Goods: Games`) — a Stripe felajánlja, ellenőrizni kell
- [ ] `[K]` Settings → **Public details**: nyilvános cégnév, **support e-mail**, support URL, weboldal
- [ ] `[K]` Settings → Public details: **statement descriptor** (a kártyakivonaton megjelenő név, max ~22 karakter, felismerhető legyen — pl. `RTSPACETRAVEL`) → csökkenti a „nem ismerem fel" típusú chargebacket
- [ ] `[K]` **Payout ütemezés** ellenőrzése (Settings → Payouts) — új fiókoknál jellemzően gördülő késleltetés
- [ ] `[K]` Aktiválás beküldése; a `charges_enabled` és `payouts_enabled` állapot figyelése a Dashboard tetején
- [ ] `[K]` Ha **„further information required"** érkezik: a kért dokumentum feltöltése a Dashboard banner linkjén; elutasítás esetén a Stripe support megkeresése az indoklás pontosításáért (lásd 3.3)

**C fázis — Weboldal-megfelelőség (jogi oldalak)** — *ez VALÓDI FEJLESZTÉS, a Stripe review egyik leggyakoribb blokkolója*
- [ ] `[K+A]` **ÁSZF** szövegének megírása (AI vázlatot ad, a felhasználó/jogász véglegesíti)
- [ ] `[K+A]` **Adatkezelési tájékoztató** megírása — kötelezően kitérve a **webkamerás arcfelismerésre** (lásd 4.3). ⚠️ **A tartalmi/jogi forrás a [[023-gdpr-compliance]] terv** (kanonikus szöveg: `./compliance/gdpr/adatkezelesi-tajekoztato.*.md`; a `legal.privacy.*` kulcsokat onnan töltjük). Itt csak a **renderelő váz** (Privacy fül) épül
- [ ] `[K+A]` **Elállási / visszatérítési szabályzat** megírása (digitális tartalom, azonnali teljesítés — lásd 5.)
- [ ] `[K]` **Impresszum** adatai: név, székhely, adószám, EV-nyilvántartási szám, kapcsolattartási e-mail
- [ ] `[A]` `src/types/index.ts`: `GamePhase` bővítése `"legal"` értékkel
- [ ] `[A]` `src/components/screens/LegalScreen.tsx` + `LegalScreen.module.css` (**ÚJ**) — 4 fül a meglévő `Tabs.tsx`-szel: ÁSZF · Adatkezelés · Elállás/visszatérítés · Impresszum
- [ ] `[A]` `src/components/routing/ScreenRouter.tsx`: `case "legal"` ág
- [ ] `[A]` `src/components/screens/MainMenu.tsx`: „Jogi információk" gomb → `transitionTo("legal")`
- [ ] `[A]` `src/components/screens/SettingsScreen.tsx`: link ugyanide
- [ ] `[A]` `src/components/shop/ShopScreen.tsx`: lábléc-linkek (ÁSZF · Elállás · Adatkezelés) a kredit tabon **is** láthatóan
- [ ] `[A]` `src/App.tsx`: **mély link** kezelése — `/legal/terms`, `/legal/privacy`, `/legal/refund`, `/legal/imprint` path → `transitionTo("legal")` + a megfelelő fül (ugyanaz a minta, mint a `/shop/success` detektálás). **Kritikus**: a Stripe review-nak megadható közvetlen URL kell, nem „kattints végig a játékon"
- [ ] `[A]` i18n: ~35 új kulcs mind az 5 nyelven (lásd 10. szekció)
- [ ] `[K]` A **hosszú jogi szövegek** fordításának emberi ellenőrzése (lásd 12. — gépi fordítású kötelmi szöveg jogi kockázat)
- [ ] `[K]` Ellenőrzés: a **termékleírás és az árak bejelentkezés nélkül** elérhetők-e (a Stripe reviewer nem fog regisztrálni)
- [ ] `[A]` Deploy: `npm run build:firebase && npx firebase-tools deploy --only hosting`
- [ ] `[K]` Dashboard → Settings → Public details / Business profile: a **ToS URL** és a **Privacy URL** beállítása a most publikált linkekre

**D fázis — EU fogyasztóvédelem: elállási jog lemondása** — *lásd 5. szekció*
- [ ] `[A]` `src/components/shop/CreditShopView.tsx`: **kötelező checkbox** a vásárlás gomb előtt (azonnali teljesítés tudomásulvétele + a 14 napos elállási jogról való lemondás), a gomb addig `disabled`
- [ ] `[A]` A megerősítés **bizonyítékának** rögzítése: `consent: { at, version }` a pending purchase payloadban **és** RTDB-be írás a jóváíráskor (`credit_claims/{sessionId}/consent`)
- [ ] `[A]` `scripts/create_payment_links.mjs`: `consent_collection: { terms_of_service: "required" }` az éles linkeken (a Dashboardon beállított ToS URL-re mutat)
- [ ] `[A]` `scripts/create_payment_links.mjs`: `custom_text.terms_of_service_acceptance.message` — a lemondó mondat a Stripe fizetőoldalon is megjelenjen ⚠️ *a mező elérhetőségét az aktuális API-verzióban ellenőrizni kell*
- [ ] `[K]` Az ÁSZF-be és az elállási szabályzatba is bekerül a lemondó klauzula (a checkbox önmagában nem elég)
- [ ] `[K]` Jogi megerősítés, hogy a választott megoldás megfelel a 2011/83/EU 16. cikk (m) pontjának

**E fázis — Stripe Tax (scriptes bekötés)** — *lásd 6.3–6.4 szekció*
> A hatósági/adószakértői előfeltételek (Stripe Tax Dashboard-bekapcsolás, HU ÁFA / EU OSS / NAV OSS-regisztráció, default tax code, adószakértői megerősítés, magyar számlázás, OSS-riport rutin) **kiszervezve: [[022-stripe-tax-compliance]]**. Az alábbi `[A]` tételek a Stripe Tax **scriptes** bekötése, amely ebben a tervben marad.
> ⚠️ A [[022-stripe-tax-compliance]] a **blokkoló előfeltétele az F fázisnak**: a `tax_behavior` a price-on immutábilis, ezért a Stripe Tax beállításának (022) meg kell előznie az éles link-generálást (F).
- [ ] `[A]` `scripts/create_payment_links.mjs`: `products.create` → `tax_code: "<digitális tax code>"` *(a kódot a 022 szerinti Dashboard-katalógusból)*
- [ ] `[A]` `scripts/create_payment_links.mjs`: `prices.create` → `tax_behavior: "inclusive"` ⚠️ **a price létrehozása után már nem módosítható**
- [ ] `[A]` `scripts/create_payment_links.mjs`: `paymentLinks.create` → `automatic_tax: { enabled: true }` + `billing_address_collection: "required"`
- [ ] `[A]` *(opcionális, B2B)* `tax_id_collection: { enabled: true }` — EU adószám bekérése, fordított adózás

**F fázis — Éles kulcs és éles Payment Linkek** — *az élesítés technikai magja*
- [ ] `[K]` Előfeltétel-ellenőrzés: a Dashboardon `charges_enabled = true` (a B fázis lezárult) — enélkül live link **nem hozható létre**
- [ ] `[K]` Dashboard **live módra** kapcsolása (a jobb felső teszt/éles kapcsoló)
- [ ] `[K]` Developers → API keys → **Create restricted key** *live* módban: `Payment Links: Write`, `Products: Write`, `Prices: Write`, minden más **None** → `rk_live_…`
- [ ] `[K]` A `sk_live_` **teljes** kulcs **sehová** ne kerüljön: se `.env`, se GitHub secret, se workflow env (a [[021-stripe-fraud-defense]] A fázisának szabálya)
- [ ] `[A]` A 4 **éles** Payment Link generálása egyszeri, fájlba nem író env-átadással:
      `$env:STRIPE_SECRET_KEY="rk_live_…"; node scripts/create_payment_links.mjs --redirect=https://realtimespacetravel-e74e3.web.app/shop/success?session_id={CHECKOUT_SESSION_ID}`
      *(a `?session_id={CHECKOUT_SESSION_ID}` a 011 E fázisának kapuja — ha az már be van vezetve, az éles linkeknek ezzel kell készülniük)*
- [ ] `[K]` Tudomásul vétel: a **teszt módban létrehozott termékek / árak / linkek NEM vihetők át élesbe** — a live mód külön adatbázis, mindent újra kell létrehozni
- [ ] `[A]` `src/constants/shopCatalog.ts`: a 4 éles URL beírása a **`stripePaymentLink`** mezőkbe (a `stripePaymentLinkDev` marad teszt-link)
- [ ] `[A]` Ellenőrzés: az éles link URL-ekben **nincs** `test_` szegmens (`https://buy.stripe.com/…` vs. `https://buy.stripe.com/test_…`)
- [ ] `[A]` `scripts/check_live_links.mjs` (**ÚJ**, vagy a `check_secrets.mjs` kiterjesztése): prod buildnél hibával áll le, ha a `stripePaymentLink` mezőkben `buy.stripe.com/test_` szerepel
- [ ] `[A]` `package.json`: `"check:links"` script + a `build:firebase` láncba fűzés
- [ ] `[A]` Deploy: `npm run build:firebase && npx firebase-tools deploy --only hosting`
- [ ] `[K]` Dashboard → Payment Links (live): a 4 link ellenőrzése — összeg, deviza, `automatic_tax`, redirect URL, ToS-elfogadás

**G fázis — Go-live ellenőrzés + rollback-készültség** — *lásd 8. szekció*
- [ ] `[K]` **Valós kártyás mikro-teszt**: a legkisebb pakk (5 €) megvásárlása saját kártyával, éles módban
- [ ] `[K]` A Stripe visszaigazoló e-mail és a **statement descriptor** ellenőrzése a bankszámla-kivonaton
- [ ] `[K]` **RTDB-ellenőrzés**: `users/{rtdbKey}/wallet/credits` pontosan +100⭐; `credit_claims/{sessionId}` létrejött
- [ ] `[K]` **ÁFA-ellenőrzés**: Dashboard → Payments → a tranzakció Tax bontása helyes-e (ország, kulcs, bruttó/nettó)
- [ ] `[K]` **Saját visszatérítés**: Dashboard → Payments → Refund; a refund megérkezésének ellenőrzése
- [ ] `[K]` Tudatosítás: a refund a játékbeli kreditet **nem** vonja vissza (nincs webhook) — kézi korrekció szükséges (11. tábla)
- [ ] `[K]` **Payout ellenőrzése**: Balance → Payouts — az első kifizetés megérkezik-e a megadott IBAN-ra
- [ ] `[A]` `scripts/deactivate_payment_links.mjs` (**ÚJ**): `stripe.paymentLinks.update(id, { active: false })` az összes aktív linkre — a rollback egy paranccsal
- [ ] `[K]` A rollback-forgatókönyv (8.3) írásba foglalása és a support e-mail-cím működésének ellenőrzése
- [ ] `[K]` Értesítések élesben is aktívak: Disputes, Early fraud warnings, Refunds, Failed payments, Successful payments ([[021-stripe-fraud-defense]] B fázis)

---

## 1. Kiindulási helyzet (2026-07-26)

| Elem | Mai állapot | Élesítés utáni cél |
|---|---|---|
| Stripe fiók | **teszt mód**, nem aktivált | aktivált, `charges_enabled` |
| Kulcs | `sk_test_…`, `.env`-ben `VITE_STRIPE_SECRET_KEY` néven | `rk_live_…` restricted, csak `$env:`-vel, egyszeri használatra |
| Payment Linkek | **8 teszt link** — 4 prod-redirect + 4 dev-redirect (`localhost:5173`) | +4 **éles** link (csak `https` redirect); a 8 teszt link **marad** teszt módban |
| Kredit-pakkok | 5 € → 100⭐ · 10 € → 300⭐ · 25 € → 700⭐ · 100 € → 2000⭐ | változatlan, de **bruttó** ár + `automatic_tax` |
| ÁFA | nincs | Stripe Tax, országonkénti kulcs, OSS-riport |
| Link-választás | `getPaymentLinkUrl(pack)` — `import.meta.env.DEV` alapján | változatlan logika, csak a `stripePaymentLink` értéke lesz éles |
| Jogi oldalak (ÁSZF, adatkezelés, elállás, impresszum) | **nincsenek** | `LegalScreen` + mély linkek |
| Elállási jog lemondása | nincs | kötelező checkbox + ToS-elfogadás a Stripe oldalon |
| Webhook / szerveroldali verifikáció | nincs (Spark terv) | **továbbra sincs** — lásd 11. tábla és [[021-stripe-fraud-defense]] F fázis |

### 1.1 Miért nem lehet a teszt objektumokat „átkapcsolni"

A Stripe teszt és éles módja **két külön adatbázis**. Egy teszt módban létrehozott `product`, `price` vagy `payment_link` azonosítója élesben nem létezik, és nincs „promote to live" művelet. Az élesítés ezért **nem** konfigurációs kapcsoló, hanem a teljes objektum-készlet **újbóli létrehozása** éles kulccsal — pontosan ezt teszi a `scripts/create_payment_links.mjs` egy futással.

---

## 2. Kézi vs. automatizálható — összefoglaló

Ez a tábla a terv gerince: ami `[K]`, azt **senki más nem tudja elvégezni** a felhasználó helyett (hatósági azonosítás, banki adat, adószakértői döntés, Dashboard-jogosultság). Ami `[A]`, azt egy script vagy az AI végigviszi.

| # | Feladat | K/A | Ki / mivel | Nagyságrend |
|---|---|---|---|---|
| 1 | Kulcs-higiénia, restricted key, CI-ellenőrzés | **A** | [[021-stripe-fraud-defense]] A fázis + `check_secrets.mjs` | 1–2 óra |
| 2 | Ingyen-kredit rés szűkítése | **A** | [[021-stripe-fraud-defense]] E fázis | ~1 nap |
| 3 | KYC / fiókaktiválás (adószám, EV-szám, okmány, IBAN) | **K** | Stripe Dashboard → Activate account | 30–60 perc + átfutás |
| 4 | Statement descriptor, support e-mail, MCC | **K** | Dashboard → Settings → Public details | 15 perc |
| 5 | ÁSZF / adatkezelés / elállás / impresszum **szövege** | **K+A** | AI vázlat → ember/jogász véglegesít | 2–4 óra + review |
| 6 | `LegalScreen` komponens, routing, mély linkek | **A** | react-dev agent | fél nap |
| 7 | 5 nyelvű i18n kulcsok (~35 db) | **A** | i18n agent | 1–2 óra |
| 8 | Jogi szövegek fordításának **emberi ellenőrzése** | **K** | fordító / jogász | változó |
| 9 | Elállási checkbox + bizonyíték-rögzítés | **A** | react-dev agent | 1–2 óra |
| 10 | ToS URL / Privacy URL beállítása a Stripe fiókban | **K** | Dashboard → Public details | 5 perc |
| 11 | NAV OSS-regisztráció → [[022-stripe-tax-compliance]] | **K** | NAV ONYA — **hatósági**, nem Stripe | változó |
| 12 | Stripe Tax bekapcsolás, registrations, default tax code → [[022-stripe-tax-compliance]] | **K** | Dashboard → Tax | 30 perc |
| 13 | `tax_code`, `tax_behavior`, `automatic_tax` a scriptben | **A** | `create_payment_links.mjs` módosítás | 30 perc |
| 14 | Adószakértői megerősítés (OSS, alanyi adómentesség, számlázás) → [[022-stripe-tax-compliance]] | **K** | könyvelő / adószakértő | változó |
| 15 | Live restricted key létrehozása | **K** | Dashboard (live mód) → API keys | 5 perc |
| 16 | A 4 éles Payment Link **generálása** | **A** | `node scripts/create_payment_links.mjs …` | 2 perc |
| 17 | Éles URL-ek beírása a `shopCatalog.ts`-be | **A** | react-dev agent | 5 perc |
| 18 | `check_live_links.mjs` + build-lánc | **A** | script | 30 perc |
| 19 | Deploy | **A** | `npm run build:firebase && npx firebase-tools deploy --only hosting` | 5 perc |
| 20 | Valós kártyás mikro-teszt + saját refund | **K** | saját bankkártya + Dashboard | 15 perc |
| 21 | Payout megérkezésének ellenőrzése | **K** | Dashboard → Balance → Payouts | várakozás |
| 22 | `deactivate_payment_links.mjs` (rollback-eszköz) | **A** | script | 30 perc |

---

## 3. KYC / fiókaktiválás — egyéni vállalkozó

### 3.1 Mit kér a Stripe

Dashboard → **Activate account** (vagy Settings → Business → Business details). Magyar **egyéni vállalkozónál** a jellemzően kért adatkör:

| Adat | Megjegyzés |
|---|---|
| Üzleti forma | **Individual / Sole proprietorship** |
| Adószám | 11 jegyű magyar adószám (`xxxxxxxx-y-zz`) |
| EV-nyilvántartási szám | az egyéni vállalkozók nyilvántartásából |
| Székhely | a hivatalos nyilvántartással **egyező** cím (eltérés = automatikus elutasítás) |
| Személyazonosító okmány | személyi igazolvány / útlevél feltöltése; szükség esetén lakcímigazolás |
| Bankszámla (IBAN) | `HU…`, a **számlatulajdonos neve egyezzen** a vállalkozó nevével |
| Weboldal URL | `https://realtimespacetravel-e74e3.web.app/` |
| Termékleírás | „böngészőben futó űrutazás-szimulátor játék; virtuális, azonnal jóváírt kredit (in-game currency) vásárlása" |
| Várható forgalom | havi/éves becslés — legyen reális, ne túlbecsült |
| MCC / iparági kód | digitális játék / digitális termék (pl. `5816`) |
| Support e-mail | valóban figyelt, működő cím |
| Statement descriptor | max ~22 karakter, felismerhető (pl. `RTSPACETRAVEL`) |

### 3.2 Átfutási idő

| Kimenet | Jellemző átfutás |
|---|---|
| Automatikus jóváhagyás | percek – 1 munkanap |
| Kézi review | 1–5 munkanap |
| „Further information required" (dokumentum-bekérés) | +2–10 munkanap, körönként |
| Elutasítás utáni fellebbezés | 1–3 hét |

> A pontos időt a Stripe nem garantálja. **Az élesítést ne kösd fix dátumhoz** — a KYC az egyetlen olyan lépés, amelynek az ütemezését a projekt nem befolyásolja.

### 3.3 Ha elutasítás vagy hiánypótlás jön

1. **Olvasd el pontosan az indoklást** a Dashboard bannerén / az e-mailben — a Stripe általában megnevezi a hiányzó elemet.
2. A **leggyakoribb ok nem a személyi adat, hanem a weboldal** (hiányzó ÁSZF / elállási szabályzat / impresszum / árak) → ezt a 4. szekció oldja meg.
3. Második leggyakoribb: a **cím vagy a név nem egyezik** a hivatalos nyilvántartással, vagy a bankszámla más nevén van.
4. Hiánypótlás: a bannerben lévő linken tölthető fel — **ne** nyiss új fiókot, az rontja a megítélést.
5. Tartós elutasítás esetén: Dashboard → Support → új ügy, kérd az elutasítás **konkrét** indokát; a magas kockázatú kategóriába sorolás („high-risk business") ellen érdemi termékleírással érvelhetsz (ez **nem** szerencsejáték, nem kriptó, nem felnőtt tartalom — ezt ki kell mondani).

---

## 4. Weboldal-követelmények — a legvalószínűbb blokkoló

> **Ez a szekció a terv legfontosabb fejlesztési munkája.** A Stripe az aktiváláskor **megnyitja és átnézi a weboldalt**. A játéknak ma **egyik kötelező eleme sincs meg**: nincs ÁSZF, nincs adatkezelési tájékoztató, nincs elállási szabályzat, nincs impresszum. Ez önmagában elutasítási ok — és ezek a dokumentumok az EU-s fogyasztóvédelmi és GDPR-előírások miatt **amúgy is kötelezők**, függetlenül a Stripe-tól.

### 4.1 Kötelező elemek és a jelenlegi állapot

| Követelmény | Ma | Hol lesz |
|---|---|---|
| A termék világos leírása | ⚠️ részben (a shop mutatja a pakkokat) | ÁSZF + shop szövegek pontosítása |
| Árak feltüntetése (**bruttó**, devizával) | ✅ `shop.credits.price` | változatlan, `inclusive` áras Stripe Tax mellett konzisztens |
| **ÁSZF** | ❌ | `LegalScreen` → *Terms* fül, `/legal/terms` |
| **Adatkezelési tájékoztató** | ❌ | `LegalScreen` → *Privacy* fül, `/legal/privacy` |
| **Elállási / visszatérítési szabályzat** | ❌ | `LegalScreen` → *Refund* fül, `/legal/refund` |
| **Impresszum / kapcsolat** (név, székhely, adószám, e-mail) | ❌ | `LegalScreen` → *Imprint* fül, `/legal/imprint` |
| Elérhetőség **bejelentkezés nélkül** | ⚠️ ellenőrizendő | főmenü gomb + mély link |

### 4.2 Komponens-terv

```
src/components/screens/LegalScreen.tsx        (ÚJ)
src/components/screens/LegalScreen.module.css (ÚJ)
```

```ts
// src/types/index.ts
export type GamePhase = /* … */ | "shop" | "legal";

export type LegalTab = "terms" | "privacy" | "refund" | "imprint";
```

```tsx
interface LegalScreenProps {
  /** Mély linkből érkező kezdő fül; alapértelmezés: "terms" */
  initialTab?: LegalTab;
}
```

- A meglévő `src/components/ui/Tabs.tsx` újrahasznosítva (mint a `ShopTabs`), a görgetés **csak a tartalomdobozon** (a shop mintája szerint).
- `ScreenRouter.tsx` → `case "legal": return <LegalScreen initialTab={…} />;`
- Belépési pontok: `MainMenu` gomb, `SettingsScreen` link, `ShopScreen` lábléc (a kredit tabon **kötelezően** látható).
- `App.tsx`: a `/shop/success` detektáláshoz hasonló path-vizsgálat a `/legal/*` útvonalakra, `queueMicrotask` + `transitionTo("legal")`, majd az URL takarítása. A Firebase Hosting SPA-fallbackje miatt minden path `index.html`-t szolgál ki — ugyanaz a mechanizmus, ami a Stripe-visszatérésnél már bizonyított.

> ℹ️ **Alternatíva, ha a modal egyszerűbb:** a jogi tartalom `Modal`-ban is megjeleníthető, **de** a Stripe review-hoz **közvetlen, megosztható URL** kell. Ha modal, akkor is szükséges a `/legal/*` mély link, ami megnyitja. A külön képernyő (`GamePhase`) a tisztább út.

### 4.3 Adatkezelési tájékoztató — a projekt-specifikus rész

> ⚠️ **A teljes adatvédelmi tartalom, a jogalapok és az érintetti jogok (export/törlés) a [[023-gdpr-compliance]] tervben vannak** (kemény, blokkoló előfeltétel). Az itteni Privacy fül a GDPR-terv szerinti, jogilag jóváhagyott tájékoztatót rendereli (`legal.privacy.*`, tartalmi forrás: `./compliance/gdpr/*.md`). Az alábbi pontok a **minimum**, amit a Stripe review miatt itt is rögzítünk; a részletes kifejtés a 023-ban él.

Ezt **nem lehet sablonból átvenni**, mert a játék működése szokatlan:

- **Webkamera + arcfelismerés.** Ki kell mondani: a kamerakép feldolgozása **teljes egészében a böngészőben, lokálisan** történik (TensorFlow.js / MediaPipe); **kép, videó vagy arc-keypoint nem kerül szerverre**, nem tárolódik és nem továbbítódik. Enélkül a tájékoztató félrevezető, és a Stripe reviewernek is „biometrikus adatgyűjtés" gyanút kelt.
- **Firebase**: anonim/vendég azonosítás, `deviceId`, RTDB-ben tárolt `wallet`, `inventory`, `settings`, `stats` — adatfeldolgozó: Google.
- **Stripe**: fizetési adatfeldolgozó; a kártyaadat **soha nem érinti** a játékot (hosztolt fizetőoldal).
- **localStorage / sessionStorage**: kizárólag működéshez szükséges (játékállapot, nyelv, függőben lévő vásárlás) — nincs analitikai vagy hirdetési süti. Ha ez így marad, süti-banner várhatóan nem kötelező (⚠️ jogi megerősítés kell).
- Érintetti jogok, adatmegőrzési idő, kapcsolattartási e-mail.
- **Korhatár**: a vásárláshoz nagykorúság / szülői hozzájárulás szükséges — az ÁSZF-be is.

### 4.4 Amit a Stripe reviewer konkrétan keres

1. A nyitóoldalról **legfeljebb 1–2 kattintással** elérhető ÁSZF / adatkezelés / elállás link.
2. **Ár és deviza** a terméknél, bejelentkezés nélkül.
3. Egyértelmű állítás arról, **mit kap** a vásárló (virtuális, azonnal jóváírt in-game kredit — nem váltható vissza pénzre).
4. **Kapcsolattartási adat** (e-mail minimum).
5. A weboldal **működik**, nem „coming soon", és a fizetési folyamat elindítható.

---

## 5. EU fogyasztóvédelem — a 14 napos elállási jog lemondása

### 5.1 A probléma

A távollévők közötti szerződéseknél a fogyasztót **14 napos, indokolás nélküli elállási jog** illeti meg. **Azonnal teljesített digitális tartalomnál** (a kredit a fizetés után rögtön jóváíródik) ez alól akkor van kivétel, ha a fogyasztó **előzetesen, kifejezetten hozzájárult** az azonnali teljesítéshez **és tudomásul vette, hogy ezzel elveszíti az elállási jogát** (2011/83/EU 16. cikk (m); a magyar 45/2014. (II. 26.) Korm. rendelet 29. §).

**Ha ez a megerősítés hiányzik, a vásárló 14 napon belül visszakérheti a pénzt — a már elköltött kredit ellenére is.** Ez közvetlenül növeli a refund- és dispute-kockázatot, amit a [[021-stripe-fraud-defense]] terv fenyegetés-modellje is kezel.

### 5.2 Megoldás — kétrétegű megerősítés

**(a) Saját UI-ban, a vásárlás gomb előtt (`CreditShopView`)** — ez az elsődleges, mert ez van a mi kontrollunk alatt:

```tsx
// vázlat – CreditShopView
const [consent, setConsent] = useState(false);
// …
<label>
  <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
  {t("shop.consent.label")}
</label>
<button disabled={!consent} onClick={() => handleBuy(pack.id)}>{t("shop.credits.buy")}</button>
```

A pending payloadba bekerül a bizonyíték (a `credits` mező a 011 E fázisa szerint **kikerül**):

```ts
{ packId, timestamp, consent: { at: Date.now(), version: "2026-07-26" } }
```

…és a jóváíráskor a `credit_claims/{sessionId}` rekordba is beíródik (`consent.at`, `consent.version`), így **utólag bizonyítható**, hogy a vásárló mikor és melyik szövegváltozatot fogadta el.

**(b) A Stripe fizetőoldalon** — ez a független, harmadik fél által rögzített bizonyíték:

```js
// scripts/create_payment_links.mjs (éles linkek)
consent_collection: { terms_of_service: "required" },
custom_text: {
  terms_of_service_acceptance: {
    message: "Elfogadom az ÁSZF-et, és kifejezetten kérem az azonnali teljesítést. Tudomásul veszem, hogy ezzel elveszítem a 14 napos elállási jogomat.",
  },
},
```

> ⚠️ A `consent_collection.terms_of_service: "required"` **megköveteli**, hogy a Stripe fiókban be legyen állítva a **Terms of service URL** (Settings → Public details / Checkout settings) — ezért függ a D fázis a C fázistól.
> ⚠️ A Payment Links **nem támogat tetszőleges checkbox típusú custom fieldet** (a custom field típusok: szöveg / szám / legördülő). Ezért a lemondó nyilatkozat a **ToS-elfogadáshoz csatolva** és a **saját UI-ban** jelenik meg — a `custom_text` mezők pontos elérhetőségét az aktuális API-verzióban ellenőrizni kell.

### 5.3 Ami a szövegekbe kell

- Az **ÁSZF**-ben külön pont az azonnali teljesítésről és a lemondásról.
- Az **elállási szabályzat**ban: mikor **jár** visszatérítés (technikai hiba, kettős terhelés, nem teljesült jóváírás) és mikor **nem** (elköltött kredit, azonnali teljesítés utáni meggondolás).
- Egyértelmű állítás: a kredit **virtuális, a játékon belül használható, pénzre nem váltható vissza**.

---

## 6. Stripe Tax (scriptes bekötés)

> ℹ️ **A Stripe Tax fogalmi / hatósági / OSS része kiszervezve: [[022-stripe-tax-compliance]]** (miért kell, Dashboard-bekapcsolás, HU ÁFA / EU OSS / NAV OSS-regisztráció, alanyi adómentesség, számlázás, OSS-bevallási riportok). **Ebben a szekcióban csak a kód-közeli döntések és a scriptes bekötés maradnak** (6.3 termék-adókód a `products.create`-ben, 6.4 `tax_behavior` a `prices.create`/`paymentLinks.create`-ben).
> ⚠️ **Blokkoló sorrend:** a Stripe Tax beállításának (022) meg kell előznie az éles link-generálást (F fázis), mert a `tax_behavior` immutábilis.

### 6.3 Termék-adókód (product tax code)

A kredit-pakk **elektronikusan nyújtott szolgáltatás / digitális termék**, nem fizikai áru. A Stripe adókód-katalógusában az ide tartozó családot kell választani (az „Electronically supplied services" / digitális tartalom ág; a `txcd_10000000` – *General – Electronically Supplied Services* a legvalószínűbb kiindulópont).

> ⚠️ **A pontos kódot a Dashboard adókód-választójában kell visszaellenőrizni** (Product catalog → tax code), mert a katalógus változik, és a kód a ténylegesen fizetendő ÁFA-kulcsot befolyásolja. **Adószakértői megerősítés kötelező.**

A scriptben:

```js
const product = await stripe.products.create({
  name: `Realtime Space Travel - ${pack.name}`,
  description: `${pack.credits}⭐ credits for Realtime Space Travel`,
  tax_code: "txcd_10000000", // ⚠️ ellenőrizendő a Dashboard katalógusában
  metadata: { credit_pack_id: pack.id, credits: String(pack.credits) },
});
```

### 6.4 Bruttó vagy nettó ár? (`tax_behavior`)

| Beállítás | Mit lát a vásárló | Bevétel | Megfelelés |
|---|---|---|---|
| **`inclusive` (bruttó) — VÁLASZTVA** | „5 €" → **pontosan 5 €-t fizet**, az ÁFA ebből kerül kibontásra | országonként **változik** (HU 27 % → ~3,94 € nettó; DE 19 % → ~4,20 €) | ✅ EU-s fogyasztói árfeltüntetés (a kiírt ár = a fizetendő végösszeg) |
| `exclusive` (nettó) | „5 €" → a fizetőoldalon **5 € + ÁFA** lesz | országtól függetlenül 5 € nettó | ⚠️ B2C-nél megtévesztő lehet; a végösszeg csak a checkoutban derül ki |

**Döntés: `inclusive`** — a `shopCatalog.ts` `priceEur` értéke és a fizetendő összeg így egyezik, a shop UI-t nem kell átírni.

```js
const price = await stripe.prices.create({
  product: product.id,
  currency: "eur",
  unit_amount: pack.priceEur * 100,
  tax_behavior: "inclusive",   // ⚠️ a price létrehozása után NEM módosítható
  metadata: { credit_pack_id: pack.id, credits: String(pack.credits) },
});
```

```js
const paymentLink = await stripe.paymentLinks.create({
  line_items: [{ price: price.id, quantity: 1 }],
  automatic_tax: { enabled: true },
  billing_address_collection: "required",   // az adószámításhoz kell a vásárló országa
  // tax_id_collection: { enabled: true },  // opcionális, B2B fordított adózáshoz
  metadata: { credit_pack_id: pack.id, credits: String(pack.credits) },
  consent_collection: { terms_of_service: "required" },
  after_completion: { type: "redirect", redirect: { url: redirectUrl } },
});
```

> ⚠️ A `tax_behavior` **immutábilis**: ha egyszer létrejött egy price nélküle, új price-t (és új Payment Linket) kell csinálni. Ezért kell a Stripe Tax beállítását ([[022-stripe-tax-compliance]]) **az éles linkek generálása (F fázis) ELŐTT** elvégezni.

> ℹ️ **Az OSS, a magyar sajátosságok (10 000 €-s küszöb, alanyi adómentesség, harmadik országbeli vásárlók, számlázás) és az OSS-bevallási riportok kifejtése → [[022-stripe-tax-compliance]]** (4. és 5. szekció). Ezek hatósági/adószakértői kérdések, nem kódolási feladatok.

---

## 7. Éles kulcs és éles linkek

### 7.1 Kulcs-szabályok (a 011 A fázisából örökölve)

| Szabály | Indok |
|---|---|
| `sk_live_` **soha** ne kerüljön `.env`-be | fájlba írt kulcs = kiszivárgási felület |
| `sk_live_` **soha** ne kerüljön `VITE_` prefixes változóba | dev szerveren a böngészőbe kerülne |
| `sk_live_` **soha** ne kerüljön GitHub Actions env-be vagy repo secretbe | a frontend nem használja; a CI-nak nincs rá szüksége |
| A link-generálás **restricted key**-jel (`rk_live_…`) fut | `Refunds: None`, `Charges: None`, `Customers: None` → kiszivárgás esetén sem okoz pénzügyi kárt |
| A kulcs átadása **egyszeri**, parancssori env-ben | `$env:STRIPE_SECRET_KEY="rk_live_…"; node scripts/…` — nem marad a fájlrendszeren |

### 7.2 A generálás menete

```powershell
# 1. Live restricted key létrehozása a Dashboardon (live mód!) → rk_live_…
# 2. Egyszeri, fájlba nem író futtatás:
$env:STRIPE_SECRET_KEY="rk_live_…"
node scripts/create_payment_links.mjs --redirect="https://realtimespacetravel-e74e3.web.app/shop/success?session_id={CHECKOUT_SESSION_ID}"
# 3. A PowerShell munkamenet bezárása (a változó nem perzisztál)
```

A script kimenete tartalmazza a `stripePaymentLink` mezőbe illesztendő 4 URL-t.

> ⚠️ A script jelenleg a `redirectUrl === PROD_REDIRECT_URL` egyezés alapján dönti el, hogy `stripePaymentLink` vagy `stripePaymentLinkDev` mezőt javasol. A `?session_id={CHECKOUT_SESSION_ID}` toldalék miatt ez az egyezés **elromlik**, és a script tévesen `stripePaymentLinkDev`-et fog írni. Javítás: a `PROD_REDIRECT_URL` konstans frissítése a session_id-s alakra, **vagy** a `startsWith`-alapú összehasonlítás. *(A `?session_id=` toldalékot a [[021-stripe-fraud-defense]] D fázisa vezeti be a scriptbe — az összehasonlítás javítását ott vagy itt kell elvégezni, de mindenképp el kell.)*

### 7.3 Dev és éles együttélése

| Készlet | Mód | Redirect | Katalógus mező | Élesítés után |
|---|---|---|---|---|
| prod | **live** | `https://realtimespacetravel-e74e3.web.app/shop/success?session_id=…` | `stripePaymentLink` | **ÚJ**, valós pénz |
| dev | **test** | `http://localhost:5173/realtime_space_travel/shop/success?session_id=…` | `stripePaymentLinkDev` | **marad** teszt módban |
| prod-teszt | test | `https://realtimespacetravel-e74e3.web.app/shop/success` | — | archív / deaktiválható |

**Miért működik ez:** a `getPaymentLinkUrl(pack)` az `import.meta.env.DEV` alapján választ. Dev futásnál (`npm run dev`) a **teszt** linkre megy → `4242 4242 4242 4242` kártyával továbbra is végigjátszható a folyamat, **valós pénz nélkül**. Prod buildben (`npm run build`) az `import.meta.env.DEV === false` → az **éles** link. A Stripe teszt és éles módja külön adatbázis, így a két világ nem keveredik.

**Miért nem lehet éles localhost-link:** élesben a Stripe **`https` redirect URL-t követel meg**, `http://localhost` nem fogadható el. Ezért marad a dev készlet teszt módban.

> ⚠️ A [[021-stripe-fraud-defense]] D fázisa a **dev linkek deaktiválását** írja elő élesítés előtt. Ez a terv **finomítja**: a dev linkek **teszt módban** vannak, valós pénzt nem tudnak mozgatni, ezért a fejlesztői folyamat megtartása érdekében **aktívak maradhatnak**. Amit deaktiválni kell, az a **prod-redirectes teszt link-készlet** (mert az ugyanarra az éles URL-re térne vissza, mint az éles linkek — összekeverhető). Ezt a felhasználóval egyeztetni kell (lásd nyitott kérdések).

---

## 8. Go-live ellenőrzés és rollback

### 8.1 Éles füst-teszt (valós kártyával)

| # | Lépés | Elvárt eredmény |
|---|---|---|
| 1 | Prod URL megnyitása → shop → Kredit tab | 4 pakk, bruttó árakkal |
| 2 | Elállási checkbox bepipálása nélkül gombnyomás | a gomb `disabled` |
| 3 | Checkbox + „Megveszem" a **Starter** (5 €) pakkon | Stripe fizetőoldal, `automatic_tax` szerinti ÁFA-sor látszik |
| 4 | Fizetés valós kártyával | siker, visszatérés `/shop/success?session_id=cs_live_…` |
| 5 | Shop egyenleg | **pontosan +100⭐** |
| 6 | RTDB: `users/{rtdbKey}/wallet/credits` | +100, `lastTopUpAt` friss |
| 7 | RTDB: `credit_claims/{sessionId}` | létrejött, `consent.at` kitöltve |
| 8 | Oldal újratöltése ugyanazzal az URL-lel | **nincs** újabb jóváírás (replay-védelem) |
| 9 | Stripe Dashboard → Payments | a tranzakció, helyes ország + ÁFA bontással |
| 10 | Visszaigazoló e-mail | megérkezett |
| 11 | Bankszámla-kivonat | a **statement descriptor** felismerhető |
| 12 | Dashboard → Refund | a visszatérítés elindul, e-mail megy |
| 13 | Balance → Payouts | az első kifizetés az IBAN-ra megérkezik |

> ⚠️ A **12. lépés után a játékbeli kredit nem vonódik vissza** (nincs webhook). Éles üzemben a refund után a kreditet **kézzel** kell levonni az RTDB-ben. Ez a Spark-terv korlátja — lásd 11. tábla.

### 8.2 Ellenőrzés élesítés előtt (checklist)

- [ ] `charges_enabled = true` és `payouts_enabled = true`
- [ ] A `shopCatalog.ts` `stripePaymentLink` mezőiben **nincs** `buy.stripe.com/test_`
- [ ] `npm run build` → `dist/`-ben nincs `sk_`, `rk_`, `whsec_` minta (`check:secrets`)
- [ ] A 4 jogi oldal élesben elérhető, közvetlen URL-lel
- [ ] A Stripe fiókban a ToS URL és a Privacy URL be van állítva
- [ ] Stripe Tax aktív, a linkeken `automatic_tax: true`
- [ ] [[021-stripe-fraud-defense]] A + E fázis kész
- [ ] Radar CVC- és irányítószám-blokkolás bekapcsolva (011 C fázis)
- [ ] Dispute / EFW / Refund / Failed payment értesítések bekapcsolva

### 8.3 Rollback-forgatókönyv

| Kiváltó ok | Teendő | Idő |
|---|---|---|
| Hibás ÁFA-számítás vagy rossz ár | `[A]` `node scripts/deactivate_payment_links.mjs` → a 4 éles link `active: false` | ~1 perc |
| Nem működő kredit-jóváírás | `[A]` `shopCatalog.ts` visszaállítása a **teszt** linkekre + `npm run build:firebase && npx firebase-tools deploy --only hosting` | ~5 perc |
| Jogi/Stripe kifogás | `[K]` az érintett vásárlók **visszatérítése** a Dashboardon, tájékoztató e-mail a support címről | változó |
| Kulcs-kompromittálás gyanú | `[K]` Dashboard → Developers → API keys → **minden live kulcs rollolása** ([[021-stripe-fraud-defense]] 4.2 incidens-forgatókönyv) | azonnal |

> A deaktivált Payment Link URL-je **hibaoldalt** ad — a felhasználó nem tud fizetni, de a már befejezett tranzakciók érintetlenek. Ezért a deaktiválás biztonságos „vészfék".

---

## 9. Módosított / új fájlok

| Fájl | Változás | Fázis | K/A |
|---|---|---|---|
| `.github/workflows/deploy.yml` | a Stripe-kulcs env sor eltávolítása | A | A |
| `.github/workflows/deploy-firebase.yml` | ugyanaz | A | A |
| `src/types/index.ts` | `GamePhase` += `"legal"`; új `LegalTab` típus | C | A |
| `src/components/screens/LegalScreen.tsx` | **ÚJ** — 4 füles jogi képernyő | C | A |
| `src/components/screens/LegalScreen.module.css` | **ÚJ** | C | A |
| `src/components/routing/ScreenRouter.tsx` | `case "legal"` | C | A |
| `src/components/screens/MainMenu.tsx` | „Jogi információk" gomb | C | A |
| `src/components/screens/SettingsScreen.tsx` | jogi link | C | A |
| `src/components/shop/ShopScreen.tsx` | lábléc jogi linkek | C | A |
| `src/App.tsx` | `/legal/*` mély link detektálás + fül-átadás | C | A |
| `src/components/shop/CreditShopView.tsx` | elállási checkbox, `disabled` gomb, `consent` a payloadban | D | A |
| `src/firebase/userData.ts` | a `consent` mező írása a `credit_claims` rekordba | D | A |
| `database.rules.json` / `security.rules.json` | `credit_claims/$sessionId/consent` validáció | D | A |
| `scripts/create_payment_links.mjs` | `tax_code`, `tax_behavior`, `automatic_tax`, `billing_address_collection`, `consent_collection`, `custom_text`; a `PROD_REDIRECT_URL` összehasonlítás javítása (7.2) | D, E, F | A |
| `scripts/check_live_links.mjs` | **ÚJ** — `buy.stripe.com/test_` tiltása prod buildben | F | A |
| `scripts/deactivate_payment_links.mjs` | **ÚJ** — rollback-eszköz | G | A |
| `package.json` | `check:links` script + `build:firebase` láncba fűzés | F | A |
| `src/constants/shopCatalog.ts` | a 4 **éles** Payment Link URL a `stripePaymentLink` mezőkbe | F | A |
| `src/i18n/locales/{en,hu,fr,de,es}/translation.json` | ~35 új kulcs (10. szekció) | C, D | A |

---

## 10. i18n

Mind az 5 nyelven (`en`, `hu`, `fr`, `de`, `es`) **teljes paritással**. Két új névtér: `legal.*` és `shop.consent.*`, plusz 2 belépési pont kulcs.

### 10.1 Navigáció

| Kulcs | Magyar szöveg (javaslat) |
|---|---|
| `menu.legal` | „Jogi információk" |
| `settings.legal` | „Jogi információk" |

### 10.2 `legal.*` — keret

| Kulcs | Magyar szöveg (javaslat) |
|---|---|
| `legal.title` | „Jogi információk" |
| `legal.back` | „Vissza" |
| `legal.lastUpdated` | „Utolsó frissítés: {{date}}" |
| `legal.authoritativeNote` | „A magyar nyelvű változat az irányadó; a többi nyelv tájékoztató fordítás." |
| `legal.tabs.terms` | „ÁSZF" |
| `legal.tabs.privacy` | „Adatkezelés" |
| `legal.tabs.refund` | „Elállás és visszatérítés" |
| `legal.tabs.imprint` | „Impresszum" |

### 10.3 `legal.terms.*` — ÁSZF

`legal.terms.heading`, `.scope`, `.service`, `.credits`, `.credits.nonRefundable`, `.purchase`, `.immediatePerformance`, `.age`, `.acceptableUse`, `.liability`, `.changes`, `.law`

### 10.4 `legal.privacy.*` — adatkezelés

`legal.privacy.heading`, `.controller`, `.dataCollected`, `.camera` *(a lokális, szerverre nem küldött arcfelismerés — 4.3)*, `.storage`, `.firebase`, `.stripe`, `.retention`, `.rights`, `.contact`

### 10.5 `legal.refund.*` — elállás és visszatérítés

`legal.refund.heading`, `.digitalContent`, `.waiver`, `.whenRefundable`, `.whenNot`, `.howToRequest`, `.processingTime`

### 10.6 `legal.imprint.*` — impresszum

`legal.imprint.heading`, `.name`, `.address`, `.taxId`, `.regNumber`, `.email`, `.hosting`

### 10.7 `shop.consent.*` — elállási megerősítés

| Kulcs | Magyar szöveg (javaslat) |
|---|---|
| `shop.consent.label` | „Kifejezetten kérem az azonnali teljesítést, és tudomásul veszem, hogy ezzel elveszítem a 14 napos elállási jogomat." |
| `shop.consent.required` | „A vásárláshoz el kell fogadnod a fenti feltételt." |
| `shop.consent.termsLink` | „ÁSZF és elállási szabályzat" |
| `shop.consent.vatNote` | „Az ár tartalmazza az ÁFÁ-t; a pontos összeg a fizetéskor, az országod szerint jelenik meg." |

> ⚠️ **A `shop.credits` objektum-névtér** — a `CLAUDE.md` figyelmeztetése szerint stringhez `shop.creditsLabel` használandó. A `shop.consent.*` külön névtér, ezzel nem ütközik.

> ⚠️ **Hosszú jogi szövegek i18n-ben:** a teljes ÁSZF/adatkezelés bekezdésekre bontva kerül a `translation.json`-ba (`legal.terms.scope`, stb.). Ha egy bekezdés túl hosszú, érdemes megfontolni külön `legal/{lang}.json` fájlokat vagy markdown-importot — ez **nyitott kérdés** (lásd a riport).

---

## 11. Ismert korlátok

| Korlát | Oka | Feloldás / kezelés |
|---|---|---|
| **KYC elutasítás** lehetősége | A Stripe saját kockázati megítélése | 3.3 forgatókönyv; a weboldal-elemek pótlása a legerősebb ellenszer |
| **A weboldal-követelmények hiánya blokkoló** | Ma nincs ÁSZF / adatkezelés / elállás / impresszum | C fázis — **ez valódi fejlesztés**, nem konfiguráció |
| **ÁFA / OSS / számlázás / Stripe Tax korlátai** | Valós pénzes, EU-s B2C digitális értékesítés | → lásd [[022-stripe-tax-compliance]] (ÁFA-kötelezettség, magyar számla + NAV Online Számla, `tax_behavior` immutabilitás, Stripe Tax díj, bruttó ár országonkénti bevétele) |
| **A [[021-stripe-fraud-defense]] nélküli élesítés** | Ma a kredit-jóváírás DevTools-ból hamisítható | A fázis **blokkoló** előfeltétel; valós pénzes bolt mellett a triviális hamisítás a fizető vásárlókkal szemben is tisztességtelen |
| **Spark terv → nincs webhook** | Nincs Cloud Functions | A jóváírás **továbbra sem verifikált** szerveroldalon; a valódi megoldás a [[021-stripe-fraud-defense]] **F fázisa** (külső serverless Worker) |
| **Refund után a kredit nem vonódik vissza** | Nincs webhook, nincs `charge.refunded` feldolgozás | Kézi RTDB-korrekció; havi egyeztetés Stripe export ↔ `credit_claims` |
| **„Fizettem, de nem kaptam meg" panasz** | A jóváírás kliensoldali (megszakadt visszatérés, bezárt böngésző) | Support e-mail + kézi jóváírás a Stripe fizetés igazolása alapján; **dokumentált folyamat kell** |
| **Teszt objektumok nem vihetők át élesbe** | A Stripe teszt/éles mód külön adatbázis | Minden újra létrehozandó — a script egy futással megoldja |
| **Élesben nincs `localhost` redirect** | A Stripe `https`-t követel | A dev linkek **teszt módban** maradnak (7.3) |
| **A jogi szövegek 5 nyelvű fordítása jogi kockázat** | Gépi fordítású kötelmi szöveg félreérthető | Magyar (és angol) az irányadó változat, a többi tájékoztató — `legal.authoritativeNote` |
| **Chargeback-díj** | Kártyás vitánál a Stripe díjat számol fel | Felismerhető statement descriptor, elállási megerősítés, Radar ([[021-stripe-fraud-defense]]) |

---

## 12. Kockázatok / figyelmeztetések

- **A sorrend nem felcserélhető.** A [[021-stripe-fraud-defense]] **A** (kulcs-higiénia) és **E** (ingyen-kredit rés) fázisa **előbb**. Élesítés után a rés már valós pénzt érő javakat érint, és a javítás menet közben nehezebb.
- **A Stripe Tax beállítása ([[022-stripe-tax-compliance]]) megelőzi a link-generálást (F fázis).** A `tax_behavior` a price-on immutábilis; ha az éles linkek nélküle készülnek, mindent újra kell csinálni (és a régi linkeket deaktiválni). Ezért a 022 **blokkoló előfeltétele** az F fázisnak (022 → 024 F sorrend).
- **A `?session_id={CHECKOUT_SESSION_ID}` toldalék elrontja a script mező-javaslatát** (7.2) — javítás nélkül a kimenet tévesen `stripePaymentLinkDev`-et ír, és az éles linkek rossz mezőbe kerülnek. Ez **csendes hiba**: a prod build ilyenkor a régi teszt linket használná.
- **Az éles Payment Link URL-ekben nincs `test_`.** Ez a leggyorsabb szemrevételezéses ellenőrzés — automatizálva a `check_live_links.mjs`-ben.
- **A KYC átfutása kívül esik a projekt kontrollján.** Ne kösd marketing-dátumhoz.
- **Jogi és adózási megerősítés kötelező.** A 4. és 5. szekció **technikai** útmutató. Az ÁSZF, az adatkezelési tájékoztató és az elállási szabályzat **jogi** jóváhagyást igényel. Az adózási megerősítés (OSS-regisztráció, alanyi adómentesség, számlázás) → [[022-stripe-tax-compliance]]. A terv egyik állítása sem tekinthető jogi vagy adótanácsnak.
- **A webkamerás arcfelismerés kiemelt GDPR-figyelmet igényel.** Ha a tájékoztató nem mondja ki egyértelműen, hogy a feldolgozás lokális és nem kerül szerverre, az mind a Stripe review-nál, mind adatvédelmi szempontból kockázat.
- **A support e-mail működjön.** A Stripe és a fogyasztóvédelem is elvárja; a „fizettem, nem kaptam meg" eseteknél ez az egyetlen csatorna webhook nélkül.
- **Az első valós tranzakció egyben az első valós adatvédelmi incidens-kockázat is.** A [[021-stripe-fraud-defense]] 4.2 incidens-forgatókönyve élesben lép érvénybe.

---

## 13. Becsült ráfordítás

| Fázis | Tartalom | K/A arány | Nagyságrend |
|---|---|---|---|
| A | Előfeltételek (011 A + E) | túlnyomórészt **A** | ~1–1,5 nap *(a 011-ben számolva)* |
| B | KYC / fiókaktiválás | **K** | 1 óra munka + **1–10 munkanap átfutás** |
| C | Jogi oldalak (szöveg + komponens + i18n) | **K+A** | ~1–1,5 nap + jogi review |
| D | Elállási jog lemondása (UI + Payment Link + szöveg) | **A** (+K szöveg) | ~3 óra |
| E | Stripe Tax **scriptes bekötése** (`tax_code`/`tax_behavior`/`automatic_tax`); a hatósági/OSS/számlázási rész → [[022-stripe-tax-compliance]] | **A** | ~30 perc *(a hatósági átfutás a 022-ban)* |
| F | Éles kulcs + linkek + deploy | **A** (+K kulcs) | ~1–2 óra |
| G | Go-live teszt + rollback-eszköz | **K** (+A script) | ~2 óra + payout-várakozás |

**Összesen:** ~3–4 munkanap tényleges munka, **plusz** a KYC, az OSS-regisztráció és a jogi/adószakértői review átfutása (ez utóbbiak akár több hét).

**Kész definíció:** a Stripe fiók aktivált (`charges_enabled` és `payouts_enabled`); a weboldalon bejelentkezés nélkül, közvetlen URL-lel elérhető az ÁSZF, az adatkezelési tájékoztató, az elállási/visszatérítési szabályzat és az impresszum mind az 5 nyelven; a vásárlás előtt kötelező, bizonyítékként rögzített megerősítés van az azonnali teljesítésről és az elállási jog lemondásáról; a termékek digitális adókóddal (`tax_code`), a price-ok `tax_behavior: "inclusive"` beállítással, a linkeken `automatic_tax: true` **készültek**, és a [[022-stripe-tax-compliance]] szerinti adózási megfelelőség (Stripe Tax aktív, OSS/NAV-regisztráció, adószakértői megerősítés, számlázás) **teljesült**; a 4 éles Payment Link `rk_live_` restricted kulccsal, `https` redirecttel és `session_id` paraméterrel létrejött, és a `shopCatalog.ts` `stripePaymentLink` mezőiben szerepel (`test_` szegmens nélkül, CI-ben ellenőrizve); a valós kártyás mikro-teszt végigment (jóváírás az RTDB-ben, helyes ÁFA-bontás, sikeres saját refund, megérkezett payout); és a rollback egyetlen scripttel elvégezhető.

---

## 14. Kapcsolódó tervek

- [[023-gdpr-compliance]] – **kemény, blokkoló előfeltétel.** Az adatvédelmi megfelelőség (adatkezelési tájékoztató szövege, jogalapok, webkamera 9. cikk álláspont, érintetti jogok = export/törlés, süti/DPO/30. cikk állásfoglalás) a compliance-család adatvédelmi sávja, párhuzamosan a [[022-stripe-tax-compliance]] adózási sávjával. A **C fázis Privacy füle** (`legal.privacy.*`) ennek a tervnek a tartalmát rendereli (kanonikus forrás: `./compliance/gdpr/adatkezelesi-tajekoztato.*.md`); a `LegalScreen` **váz, routing, mély linkek** és a Terms/Refund/Imprint tartalom **itt marad**. Nincs körkörösség: a tartalom/követelmény a (korábbi) GDPR-tervből jön, a renderelő váz a (későbbi) go-live-ból. Az érintetti-jog **funkciók** (export/törlés) a Settingsbe épülnek, a `LegalScreen`-től és ettől a tervtől függetlenül, a [[003-firebase-auth-settings]] adatmodellre — a go-live **ELŐTT** implementálhatók.
- [[022-stripe-tax-compliance]] – **blokkoló előfeltétel az F fázishoz.** Ez a terv E fázisának **hatósági/adószakértői** része (Stripe Tax Dashboard-bekapcsolás, HU ÁFA / EU OSS / NAV OSS-regisztráció, default tax code, adószakértői megerősítés, magyar számlázás, OSS-bevallási riport) a 022-ba lett kiszervezve. A **scriptes** bekötés (`tax_code`, `tax_behavior: "inclusive"`, `automatic_tax`, `billing_address_collection`) **itt marad** (6.3–6.4, E fázis). Az éles link-generálás (F fázis) **nem indulhat**, amíg a 022 le nem zárult, mert a `tax_behavior` a price-on immutábilis: a Stripe Tax beállításának meg kell előznie a link-létrehozást. A `scripts/create_payment_links.mjs` a 024 felelőssége (9. szekció), de a 022 Dashboard-beállításai adják a bemenetét (a `tax_code` értéke a 022 szerinti katalógusból).
- [[005-ingame-shop-strapi-stripe]] – **közvetlen előfeltétel.** Az ott megépített Payment Links út, a `getPaymentLinkUrl(pack)` dev/prod választás és a 4. szekció „Élesítéskor" pontja itt kap teljes, végrehajtható kifejtést. A 005 „Ismert korlátok" táblájának *„Nincs webhook"* sora élesben is fennáll.
- [[021-stripe-fraud-defense]] – **blokkoló előfeltétel** (A + E fázis). A kulcs-higiénia, a restricted key, a `session_id` kapu és a `credit_claims` ledger nélkül nem indulhat valós pénzes fizetés. Ez a terv két ponton **finomítja** a 011-et: (1) a dev Payment Linkek nem deaktiválandók, mert teszt módban maradnak (7.3); (2) az éles linkek a 011 D fázisa szerinti `?session_id={CHECKOUT_SESSION_ID}` redirect-mintával készülnek. Fordított irányban a 021 **3.0** szekciója pontosítja az itteni A fázist: a kulcs-átnevezés **megelőzés, nem javítás** (ma nincs szivárgás), és a felhasználó döntése szerint a kulcs átnevezve **marad** a `.env`-ben és a workflow-kban — ez **ütközik** az itteni „secret törlése / env sor eltávolítása" tételekkel, lásd az A fázisnál elhelyezett megjegyzést.
- [[002-ingame-shop-frontend]] – a shop UI, a `CreditShopView` és a `ShopScreen`; az elállási checkbox és a jogi lábléc-linkek ide épülnek be.
- [[003-firebase-auth-settings]] – az RTDB `wallet` séma és a `rtdbKey` feloldás; a valós pénzes jóváírás célja ugyanez a node. A 6. pontjában vázolt szerveroldali út (`awardWage`, `purchaseWithCredits`) a refund-visszavonás problémáját is megoldaná.
- [[020-nextjs-migration]] – **új blokkoló előfeltétel.** A Vite SPA → Next.js App Router (Vercel) migráció négy ponton érinti ezt a tervet. (1) **Az A fázis ellenőrzése tárgytalanná válik:** a build-workflow-k megszűnnek, a Stripe kulcs `STRIPE_SECRET_KEY` néven, `NEXT_PUBLIC_` prefix **nélkül**, Vercel env változóként él — sem „megtartani átnevezve", sem „eltávolítani" nem kérdés többé. (2) **A C fázis mély linkjei** (`/legal/terms`, `/legal/privacy`, `/legal/refund`, `/legal/imprint`) a migráció catch-all route-ja (`app/[[...slug]]/page.tsx`) alatt **külön route-fájl nélkül** működnek — az `App.tsx` path-detektálásos mintája változatlan marad. (3) ⚠️ **A Payment Linkek redirect URL-jét újra kell generálni**: a mai 8 link a `https://realtimespacetravel-e74e3.web.app/shop/success` címre mutat, ami a migráció után már nem az alkalmazás origin-je; ezt **egy körben** érdemes elvégezni a [[021-stripe-fraud-defense]] D fázisának `?session_id={CHECKOUT_SESSION_ID}` toldalékával, és a Stripe Dashboard weboldal- / ToS- / Privacy-URL mezőit is át kell állítani. (4) ⚠️ **A `getPaymentLinkUrl` dev/prod választás** (`import.meta.env.DEV` → `process.env.NODE_ENV !== "production"`) a Vercel **preview** buildben is a **prod** linket adná — élesítés után ez valós pénzes linket jelentene a preview környezetben; javasolt egy explicit `NEXT_PUBLIC_STRIPE_MODE` kapcsoló (lásd [[020-nextjs-migration]] 3.4). ⚠️ **Költség-jellegű nyitott kérdés:** valós pénzt kiszolgáló Vercel endpointhoz a Hobby ToS miatt **Pro csomag** kell (020 12.1).
- [[009-firebase-identity-split-bugfix]] – **blokkoló előfeltétel, az A fázis de facto bővítése.** A `rtdbKey` ma egy migrációs `catch`-ág miatt a `deviceId`-re térülhet, így ugyanaz a Google fiók **két RTDB node-ot** kap külön kredittel (élesben megerősített hiba). Valós pénzes fizetés **nem indítható** addig: egy ilyen szétválás **kifizetett** kreditet tüntetne el a felhasználó számára visszakövethetetlenül → chargeback / dispute, ami a Stripe fiók kockázati pontszámát is rontja. Az élesítés előtti go-live checklistbe (8. szekció) felvenni: *„ugyanaz a fiók két böngészőben és két originon ugyanazt a kreditet látja"*.
