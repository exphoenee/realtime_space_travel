---
title: "Stripe adózás és ÁFA-megfelelőség – Stripe Tax, OSS, számlázás"
slug: 022-stripe-tax-compliance
type: plan
category: payments
status: not-started
implemented: false
implemented_at: null
created_at: "2026-08-06"
updated_at: "2026-08-06"
author: exphoenee
step: 22
phases: []
dependencies:
  - 005-ingame-shop-strapi-stripe
related_plans:
  - 021-stripe-fraud-defense
  - 023-stripe-go-live
tags:
  - stripe
  - tax
  - vat
  - oss
  - compliance
  - payments
  - invoicing
---

# Stripe adózás és ÁFA-megfelelőség – Stripe Tax, OSS, számlázás

**Cél:** a [[005-ingame-shop-strapi-stripe]] Stripe Payment Links fizetési út **adózási megfelelőségének** rendezése — a Stripe Tax Dashboard-bekapcsolásától és az országonkénti ÁFA-számítástól az EU OSS- és NAV-regisztráción át a magyar számlázás és az OSS-bevallási riport-rutin tisztázásáig. Ez a [[023-stripe-go-live]] terv **E fázisából** kiszervezett munka, mert **nem kódolási feladat**, hanem **hatósági + adószakértői + Stripe Dashboard** munka.

> ⚠️ **Ez a terv technikai útmutató, nem jogi és nem adótanácsadás.** Az ÁFA-, OSS-, számlázási pontokat **könyvelővel / adószakértővel meg kell erősíteni** az élesítés előtt. A terv jelzi, hol kötelező a szakértői jóváhagyás.

> ℹ️ **Miért külön terv, és mi NEM tartozik ide:** ez a terv a Stripe adózás **nem-kódolási** sávja — Dashboard-beállítás, hatósági regisztráció, adószakértői döntés. Az adózás **scriptes bekötése** (a `scripts/create_payment_links.mjs` `tax_code`, `tax_behavior: "inclusive"`, `automatic_tax`, `billing_address_collection`, `tax_id_collection` mezői, valamint a `products.create` / `prices.create` kódrészletek) **a [[023-stripe-go-live]] terv része marad** (ott a 6.3–6.4 szekció és az E fázis `[A]` tételei). A [[023-stripe-go-live]] F fázisa (éles link-generálás) **nem indulhat**, amíg ez a terv le nem zárult — mert a `tax_behavior` a price-on **immutábilis**, tehát a Stripe Tax beállításának meg kell előznie a link-létrehozást.

## Döntések (egyeztetve)

| Kérdés | Választás |
|--------|-----------|
| ÁFA | **Stripe Tax bekapcsolása** — automatikus, országonkénti ÁFA-számítás és -beszedés, OSS-riporttal |
| Árak megjelenítése | **Bruttó** — az EU-s fogyasztói árfeltüntetés miatt a kiírt 5 € = amennyit a vásárló fizet (a scriptes `tax_behavior: "inclusive"` megvalósítás a [[023-stripe-go-live]] 6.4-ben) |
| Termék-adókód | **Elektronikusan nyújtott szolgáltatás / digitális termék** — a Dashboard adókód-katalógusában visszaellenőrizendő és adószakértővel megerősítendő (a scriptes `tax_code` a [[023-stripe-go-live]] 6.3-ban) |
| Számlázás | A Stripe **nem** állít ki magyar szabályok szerinti számlát és **nem** jelent a NAV Online Számla felé — a megoldás (Számlázz.hu / Billingo vagy kézi) külön feladat, adószakértővel tisztázandó |

---

## ✅ Haladás (TODO)

> Jelölés az állapotra: `[ ]` hátravan · `[~]` folyamatban · `[x]` kész.
> Jelölés a végrehajtóra: **`[K]`** = KÉZI (a felhasználó: Stripe Dashboard / hatóság / adószakértő). *(Ebben a tervben minden tétel `[K]` — az adózás scriptes `[A]` tételei a [[023-stripe-go-live]] E fázisában maradnak.)*

**Stripe Tax bekapcsolás és regisztrációk (Dashboard + hatóság)**
- [ ] `[K]` Dashboard → **Tax** → Get started; **origin address** (székhely) megadása
- [ ] `[K]` Dashboard → Tax → **Registrations**: magyar ÁFA-regisztráció rögzítése
- [ ] `[K]` Dashboard → Tax → Registrations: **EU OSS** regisztráció rögzítése (ha a NAV OSS-regisztráció megtörtént)
- [ ] `[K]` NAV oldalán az **OSS-regisztráció** benyújtása (ONYA) — hatósági lépés, nem Stripe
- [ ] `[K]` Dashboard → Tax → Default settings: **default product tax code** beállítása digitális termékre (elektronikusan nyújtott szolgáltatás), **ne** maradjon a „General - Tangible Goods" alapérték

**Adószakértői / számlázási megerősítés (hatósági + könyvelői)**
- [ ] `[K]` Stripe Tax **díjának** ellenőrzése az aktuális árlistán (a normál tranzakciós díj **felett**)
- [ ] `[K]` **Adószakértői megerősítés**: alanyi adómentesség vs. OSS, a 10 000 €-s EU-küszöb kezelése, HU vs. célországi ÁFA (lásd 4. szekció)
- [ ] `[K]` Tisztázni, hogyan készül a **magyar számla és a NAV Online Számla adatszolgáltatás** — a Stripe ezt **nem** végzi el (lásd 5. tábla)
- [ ] `[K]` Havi/negyedéves rutin: Dashboard → Tax → **Reports / Registrations** export az OSS-bevalláshoz

---

## 1. Kontextus

A [[005-ingame-shop-strapi-stripe]] tervben megépített, 4 kredit-pakkot kínáló Stripe Payment Links fizetési út ma **kizárólag teszt módban** működik, **ÁFA-kezelés nélkül**. Az élesítéskor ([[023-stripe-go-live]]) EU-s fogyasztóknak nyújtott, valós pénzes B2C **digitális** értékesítés indul — ez **ÁFA-kötelezettséget** keletkeztet. Az ÁFÁ-t az elektronikus szolgáltatás főszabálya szerint jellemzően a **vásárló országa** szerint kell megfizetni; ezt a Stripe Tax automatizálja, de a **regisztrációkat, a bevallást és a számlázást** a projekt / a vállalkozó oldalán kell megoldani.

Ez a terv az adózási sávot **önállóan** viszi végig, hogy a [[023-stripe-go-live]] technikai élesítése (KYC, jogi oldalak, elállás, éles kulcs, valamint a Stripe Tax **scriptes** bekötése) a hatósági/adószakértői átfutástól **függetlenül** haladhasson — de az éles link-generálás (023 F fázisa) csak ennek a tervnek a lezárása **után** indulhat.

---

## 2. Kézi / hatósági feladatok — összefoglaló

Ebben a tervben minden feladat **kézi vagy hatósági** — senki más nem tudja elvégezni a felhasználó helyett (Dashboard-jogosultság, NAV-regisztráció, adószakértői döntés).

| # | Feladat | Ki / mivel | Nagyságrend |
|---|---|---|---|
| 1 | NAV OSS-regisztráció | NAV ONYA — **hatósági**, nem Stripe | változó |
| 2 | Stripe Tax bekapcsolás, registrations, default tax code | Dashboard → Tax | 30 perc |
| 3 | Stripe Tax díjának ellenőrzése | Dashboard → árlista | 5 perc |
| 4 | Adószakértői megerősítés (OSS, alanyi adómentesség, számlázás) | könyvelő / adószakértő | változó |
| 5 | Magyar számla + NAV Online Számla adatszolgáltatás megoldása | Számlázz.hu / Billingo / kézi + könyvelő | változó |
| 6 | OSS-bevallási riport-rutin (havi/negyedéves export) | Dashboard → Tax → Reports | ismétlődő |

> A Stripe Tax **scriptes** bekötése (`tax_code`, `tax_behavior`, `automatic_tax`, `billing_address_collection`) automatizálható `[A]` feladat, de az a [[023-stripe-go-live]] E fázisában és 6.3–6.4 szekciójában marad — nem ennek a tervnek a felelőssége.

---

## 3. Stripe Tax — bekapcsolás

### 3.1 Miért kell

EU-s fogyasztóknak nyújtott **elektronikus szolgáltatásnál** az ÁFA főszabály szerint a **vásárló országa** szerint fizetendő. 27 tagállam × változó kulcs (17–27 %) kézzel kezelhetetlen. A Stripe Tax ezt tranzakciónként kiszámolja, a fizetőoldalon feltünteti, és riportot ad a bevalláshoz.

### 3.2 Bekapcsolás (KÉZI, Dashboard)

1. Dashboard → **Tax** → *Get started*
2. **Origin address**: a vállalkozás székhelye (Magyarország)
3. **Registrations**: a magyar ÁFA-regisztráció felvétele; ha van OSS, az **EU One Stop Shop** regisztráció is
4. **Default settings** → *Default product tax code*: **ne** maradjon az alapértelmezett „General - Tangible Goods"; a kredit-pakk **elektronikusan nyújtott szolgáltatás / digitális termék**

> ℹ️ A termék-adókód **scriptes** beállítása (`products.create` → `tax_code`) és a bruttó/nettó `tax_behavior` kódrészlete a [[023-stripe-go-live]] 6.3–6.4 szekciójában van. Itt csak a **Dashboard-oldali default** beállítása és az adószakértői jóváhagyás tartozik.

---

## 4. OSS és a magyar sajátosságok — amit adószakértőnek kell megerősítenie

| Kérdés | Miért nem dönthető el a terv szintjén |
|---|---|
| **10 000 €-s EU-küszöb** | A küszöb alatt a teljesítés helye jellemzően belföld (HU ÁFA); felette a célországi ÁFA és **OSS-regisztráció** kötelező. A küszöb a több tagállamba irányuló távolsági értékesítésre és elektronikus szolgáltatásra **együttesen** számít. |
| **Alanyi adómentesség** | Belföldi értékesítésre alkalmazható, de a **határon átnyúló** digitális szolgáltatásra a szabály eltér. A két rendszer együttes kezelése szakértői kérdés. |
| **Harmadik országbeli vásárlók** | EU-n kívüli fogyasztónál más szabály él; a Stripe Tax ezt kezeli, de a bevallási oldal nem automatikus. |
| **Számlázás** | A Stripe Tax **kiszámolja** az ÁFA-t, de **nem állít ki magyar szabályok szerinti számlát**, és **nem küld adatot a NAV Online Számla rendszerébe**. Ennek megoldása (Számlázz.hu / Billingo integráció vagy kézi számlázás) külön feladat — lásd 5. tábla. |

---

## 5. Riportok és számlázás

### 5.1 Riportok az OSS-bevalláshoz

Dashboard → **Tax** → *Reports / Registrations*: ország szerinti bontású export (adóalap, adókulcs, adóösszeg, tranzakciószám), CSV-ben letölthető, negyedéves bontásban. Ez a **bemenete** az OSS-bevallásnak — de a bevallást a NAV felé **be kell nyújtani**, azt a Stripe nem teszi meg.

### 5.2 Számlázás — nyitott feladat

| Korlát | Oka | Feloldás / kezelés |
|---|---|---|
| **A Stripe nem állít ki magyar számlát és nem jelent a NAV Online Számla felé** | A Stripe Tax csak kalkulál | Külön számlázó (Számlázz.hu / Billingo) vagy kézi számlázás — **nyitott kérdés**, adószakértővel |

---

## 6. Kockázatok / ismert korlátok

| Korlát / kockázat | Oka | Feloldás / kezelés |
|---|---|---|
| **ÁFA-kötelezettség** keletkezik | Valós pénzes, EU-s B2C digitális értékesítés | Stripe Tax + adószakértő |
| **A Stripe nem állít ki magyar számlát és nem jelent a NAV Online Számla felé** | A Stripe Tax csak kalkulál | Külön számlázó (Számlázz.hu / Billingo) vagy kézi számlázás — **nyitott kérdés**, adószakértővel |
| **`tax_behavior` immutábilis a price-on** | Stripe API-korlát | A Stripe Tax beállítása **előbb** (ez a terv), az éles link-generálás **utána** ([[023-stripe-go-live]] F) — kötelező sorrend, ezért ez a terv **blokkoló előfeltétel** |
| **Stripe Tax díjköteles** | A normál tranzakciós díj felett | Az aktuális árlistán ellenőrizendő; a legkisebb (5 €) pakk margóját érdemben csökkentheti |
| **Bruttó ár mellett a bevétel országonként változik** | `tax_behavior: "inclusive"` (a döntés a [[023-stripe-go-live]] 6.4-ben) | Tudatos döntés; a legrosszabb eset a HU 27 % |

### 6.1 Figyelmeztetések

- **A Stripe Tax beállítása megelőzi a link-generálást.** A `tax_behavior` a price-on immutábilis; ha az éles linkek nélküle készülnek, mindent újra kell csinálni (és a régi linkeket deaktiválni). Ezért ez a terv **blokkoló előfeltétele** a [[023-stripe-go-live]] F fázisának (022 → 023 F sorrend).
- **Jogi és adózási megerősítés kötelező.** Ez a terv **technikai** útmutató. Az **OSS-regisztráció**, az **alanyi adómentesség** kezelése és a **számlázás** (magyar számla + NAV Online Számla adatszolgáltatás) **szakértői jóváhagyást igényel**. A terv egyik állítása sem tekinthető jogi vagy adótanácsnak.

---

## 7. Becsült ráfordítás

| Tartalom | K/A | Nagyságrend |
|---|---|---|
| Stripe Tax (Dashboard + OSS + számlázás tisztázása) | **K** | ~1 óra Dashboard + hatósági/szakértői átfutás |

**Megjegyzés:** a tényleges Dashboard-munka rövid (~1 óra), de a **NAV OSS-regisztráció** és az **adószakértői / számlázási** review átfutása akár több hét — és ez blokkolja a [[023-stripe-go-live]] éles link-generálását. *(A Stripe Tax scriptes bekötésének ~30 perces `[A]` munkája a [[023-stripe-go-live]] E fázisában van elszámolva.)*

> ℹ️ **Érintett fájl:** ennek a tervnek nincs kódfájl-módosítása — tisztán Dashboard + hatósági + szakértői munka. Az egyetlen „artifact" maga ez a plan-dokumentum. A `scripts/create_payment_links.mjs` adózási mezői a [[023-stripe-go-live]]-hez tartoznak.

---

## 8. Kapcsolódó tervek

- [[023-stripe-go-live]] – **ez a terv a 023 E fázisából lett kiszervezve** (a hatósági/adószakértői rész). A 023 megtartja a Stripe Tax **scriptes** bekötését (6.3–6.4 szekció, E fázis `[A]` tételei: `tax_code`, `tax_behavior`, `automatic_tax`, `billing_address_collection`). A 023 F fázisa (éles Payment Link-generálás) csak ennek a tervnek a lezárása **UTÁN** futhat, mert a `tax_behavior` a price-on **immutábilis**: a Tax-beállításnak meg kell előznie a link-létrehozást. A 023 go-live checklistjében szereplő ÁFA-ellenőrző lépések (füst-teszt `automatic_tax` szerinti ÁFA-sor, Payments Tax-bontás) **ennek** a tervnek az eredményét verifikálják.
- [[021-stripe-fraud-defense]] – kapcsolódó payments/compliance sáv.
- [[005-ingame-shop-strapi-stripe]] – **közvetlen előfeltétel.** Az ott megépített Payment Links út az alap, amelynek adózási megfelelőségét ez a terv rendezi.

---

**Kész definíció:** a Stripe Tax **aktív** a Dashboardon (origin address, HU ÁFA + EU OSS registrations, digitális default tax code); a **NAV OSS-regisztráció** benyújtva; az **adószakértői megerősítés** (OSS vs. alanyi adómentesség, 10 000 €-s küszöb, HU vs. célországi ÁFA) megtörtént; a Stripe Tax **díja** ellenőrizve; a **magyar számlázás + NAV Online Számla adatszolgáltatás** módja megoldva és dokumentálva; és az **OSS-bevallási riport-rutin** (Dashboard → Tax → Reports havi/negyedéves export) dokumentálva van. *(A Stripe Tax scriptes bekötése — `tax_code`, `tax_behavior: "inclusive"`, `automatic_tax` — a [[023-stripe-go-live]] Kész definíciójának része.)*
