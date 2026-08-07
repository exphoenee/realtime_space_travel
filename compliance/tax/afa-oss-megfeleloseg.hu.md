# ÁFA / OSS megfelelőség — tervezet

> **Státusz:** AI-vázlat → **adószakértői / könyvelői véglegesítés szükséges**
> **Kapcsolódó terv:** `plans/022-stripe-tax-compliance.md`
> **Utolsó frissítés:** 2026-08-06
>
> ⚠️ **Ez a dokumentum NEM adótanácsadás.** Technikai/szervezési vázlat, amelyet könyvelővel / adószakértővel véglegesíteni és jóváhagyni kell az élesítés előtt. Minden bizonytalan pont `⚠️ [adószakértői megerősítés szükséges]` jelölést kap; a konkrét cégadatok `{{...}}` placeholderrel szerepelnek.

---

## 1. A vállalkozás adatai (kitöltendő)

| Mező | Érték |
|---|---|
| Cégnév / vállalkozó neve | `{{ceg_nev}}` |
| Székhely / letelepedés helye | `{{szekhely}}` (uniós tagállam: **Magyarország**) |
| Adószám | `{{adoszam}}` |
| Közösségi adószám (EU VAT) | `{{eu_vat_szam}}` |
| Adózási forma | `{{adozasi_forma}}` — ⚠️ [adószakértői megerősítés szükséges]: alanyi adómentes-e? |
| OSS-regisztráció státusza | `{{oss_regisztracio_statusz}}` — uniós OSS-séma, NAV |

---

## 2. Mit értékesítünk és milyen adózási minősítéssel

- **Termék:** digitális kredit-pakkok (a [[005-ingame-shop-strapi-stripe]] shopban), amelyeket a játékos a valós idejű űrutazás-szimulátorban használ fel.
- **Adójogi minősítés:** **elektronikusan nyújtott szolgáltatás** (digitális termék) — nem fizikai áru.
- **Vevői kör:** túlnyomórészt **B2C** (magánszemély fogyasztók), EU-s és EU-n kívüli országokból.
- **Stripe termék-adókód:** **`txcd_10000000`** (General - Electronically Supplied Services / digitálisan nyújtott szolgáltatás).
  - ⚠️ [adószakértői megerősítés szükséges]: a pontos Stripe tax code kiválasztása a Dashboard adókód-katalógusából, a termék tényleges jellege alapján.
- **Ár-megjelenítés:** **bruttó** (`tax_behavior: inclusive`) — a kiírt ár = amit a fogyasztó fizet; az ÁFA az árba foglalt. Indok: EU-s fogyasztói árfeltüntetési elvárás.

---

## 3. Miért keletkezik ÁFA-kötelezettség — és hol

EU-s fogyasztónak (B2C) nyújtott elektronikus szolgáltatásnál az ÁFA **főszabály szerint a vásárló országa** szerint fizetendő. Mivel 27 tagállam van, egyenként **17–27 %** közötti kulccsal, az ÁFA-t vásárlásonként a vevő országa szerint kell kiszámolni és beszedni.

- A **beszedést és kalkulációt** a **Stripe Tax** automatizálja (lásd 4. szakasz).
- A **bevallást és befizetést** a vállalkozásnak kell teljesítenie — erre való az **OSS** (lásd 5. szakasz).

---

## 4. Stripe Tax — szerep és korlátok

| A Stripe Tax MEGTESZI | A Stripe Tax NEM teszi meg |
|---|---|
| Vásárlásonként kiszámolja a helyes célországi ÁFÁ-t | Nem nyújt be OSS-bevallást a NAV felé |
| A fizetőoldalon feltünteti az ÁFÁ-t | Nem állít ki magyar szabály szerinti számlát |
| Ország szerinti bontású riportot ad (adóalap, kulcs, összeg) | Nem küld adatot a NAV Online Számla rendszerébe |
| Kezeli az EU-n kívüli vásárlók eltérő szabályát | Nem fizeti be helyetted az adót |

**Dashboard beállítások (kézi):**
- Tax → Get started; **origin address** = `{{szekhely}}`
- Tax → Registrations: **HU ÁFA** + **EU OSS** regisztráció rögzítése
- Tax → Default settings: default product tax code = **`txcd_10000000`** (ne maradjon „General - Tangible Goods")

> A Stripe Tax **díjköteles** a normál tranzakciós díj felett — az aktuális árlistán ellenőrizendő `{{stripe_tax_dij}}`.

---

## 5. OSS (One Stop Shop / Egyablakos rendszer)

**Lényeg.** Az OSS lehetővé teszi, hogy a más EU-tagállamokba irányuló B2C digitális szolgáltatás ÁFÁ-ját **egyetlen tagállamban** (Magyarországon, a NAV-nál), **egyetlen negyedéves bevallásban** valljuk be és fizessük be az **összes** célország felé — 27 külön regisztráció helyett.

**A releváns séma.** A vállalkozás uniós letelepedésű → az **uniós OSS-séma** (Union scheme) alkalmazandó.
- A **nem-uniós OSS** EU-n kívüli letelepedésűeknek való — itt nem releváns.
- Az **IOSS** a ≤ 150 €-s **importált termékek** értékesítésére való — digitális szolgáltatásnál nem releváns.

**A 10 000 €-s uniós küszöb.**
- **Alatta:** a teljesítés helye jellemzően belföld → HU ÁFA, OSS nem kötelező.
- **Felette:** célországi ÁFA + OSS **kötelező**.
- A távolsági termékértékesítés és a B2C elektronikus szolgáltatás **együttesen** számít bele, éves szinten.
- ⚠️ [adószakértői megerősítés szükséges]: a küszöb számítása, átlépésének kezelése és az önkéntes küszöb alatti OSS-választás.

**Történet.** A korábbi **MOSS** 2021. július 1-jétől bővült teljes **OSS**-sé.

**Magyar gyakorlat (NAV ONYA).** Az OSS-regisztráció és a **negyedéves OSS-bevallás** a **NAV ONYA** (Online Nyomtatványkitöltő Alkalmazás) felületén történik. A Stripe Tax csak a **riportot/adatot** adja; a bevallást a NAV felé **be kell nyújtani** (jellemzően a könyvelő). Részletes rutin: `oss-bevallasi-rutin.md`.

---

## 6. Számlázás és NAV Online Számla — nyitott feladat

- A Stripe **nem** állít ki magyar szabály szerinti számlát, és **nem** teljesíti a NAV Online Számla adatszolgáltatást.
- **Lehetséges megoldás:** külön magyar számlázó (Számlázz.hu / Billingo) integráció vagy kézi számlázás.
- ⚠️ [adószakértői megerősítés szükséges]: a magyar számla kötelező tartalma B2C digitális szolgáltatásnál, a NAV Online Számla adatszolgáltatási kötelezettség köre, a Stripe-adatból való számlakiállítás rutinja.

---

## 7. Alanyi adómentesség vs. OSS — nyitott kérdés

- Az **alanyi adómentesség** belföldi értékesítésre alkalmazható, de a **határon átnyúló** B2C digitális szolgáltatásra a szabály eltér.
- ⚠️ [adószakértői megerősítés szükséges]: a két rendszer együttes kezelése — hogyan viszonyul az alanyi adómentesség az OSS-hez, és a 10 000 €-s küszöbhöz.

---

## 8. Nyitott kérdések összefoglalása

A teljes lista és a szakértőnek felteendő konkrét kérdések: `nyitott-kerdesek-adoszakertonek.md`.

| # | Nyitott kérdés | Felelős |
|---|---|---|
| 1 | Alanyi adómentesség vs. OSS együttes kezelése | adószakértő |
| 2 | 10 000 €-küszöb számítása és átlépésének kezelése | adószakértő |
| 3 | Magyar számla + NAV Online Számla adatszolgáltatás megoldása | könyvelő / adószakértő |
| 4 | Stripe termék-adókód végleges kiválasztása | adószakértő |
| 5 | Harmadik országbeli (EU-n kívüli) vásárlók kezelése | adószakértő |
