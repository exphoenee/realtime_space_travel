# Adatkezelési tájékoztató — tervezet (magyar, irányadó)

> **Státusz:** AI-vázlat → **GDPR-szakértői / jogászi véglegesítés szükséges**
> **Kapcsolódó terv:** `plans/023-gdpr-compliance.md`
> **Utolsó frissítés:** 2026-08-06
> **Verzió:** `v0.1-vazlat`
>
> ⚠️ **Ez a dokumentum NEM jogi tanácsadás.** Technikai/szervezési vázlat, amelyet adatvédelmi szakértővel / jogásszal véglegesíteni és jóváhagyni kell az élesítés (`plans/024-stripe-go-live.md`) előtt. A bizonytalan pontok `⚠️ [jogi megerősítés szükséges]` jelölést kapnak; a konkrét cégadatok `{{...}}` placeholderrel szerepelnek.
>
> **Irányadó nyelv:** ez a magyar változat az irányadó. Az `en/fr/de/es` fordítások kizárólag tájékoztató jellegűek; eltérés esetén a magyar szöveg az érvényes.

---

## 1. Az adatkezelő

| Mező | Érték |
|---|---|
| Adatkezelő neve | `{{ev_nev}}` (egyéni vállalkozó) |
| Székhely | `{{szekhely}}` (Magyarország) |
| Adószám | `{{adoszam}}` |
| EV-nyilvántartási szám | `{{ev_nyilvantartasi_szam}}` |
| Kapcsolattartási e-mail | `{{kapcsolat_email}}` |
| Weboldal | `{{weboldal_url}}` (`https://realtimespacetravel-e74e3.web.app/` vagy a migráció utáni Vercel domain) |

> Az itt megadott adatok egyezzenek a jogi impresszummal (`plans/024-stripe-go-live.md` C fázis, Imprint fül).

**Adatvédelmi tisztviselő (DPO):** `{{dpo}}` — a jelen adatkezelés alapján **valószínűleg nem kötelező** (indoklás: `dpo-ertekeles.md`). ⚠️ [jogi megerősítés szükséges].

---

## 2. A szolgáltatás rövid leírása

A **Realtime Space Travel** böngészőben futó, valós idejű űrutazás-szimulátor játék. A játék **webkamerás arcfelismerést** használ a játékos figyelmének figyelésére (a feldolgozás teljes egészében a böngészőben, lokálisan történik — lásd 8. szakasz), és **valós pénzes** vásárlást kínál virtuális kredit-pakkokra.

---

## 3. A kezelt adatkörök, célok és jogalapok

> A jogalapok részletes indoklása és érdekmérlegelése: `jogalap-nyilvantartas.md`.

| # | Adatkör | Konkrét adatok | Cél | Jogalap (GDPR 6. cikk) |
|---|---|---|---|---|
| 1 | Fiók / profil | `users/{uid}/profile`: megjelenített név, avatar (Google), fantázianév (nickname), szolgáltató, létrehozás/utolsó belépés ideje | Bejelentkezés, fiók-azonosítás, a haladás mentése | **6(1)(b)** — szerződés (a szolgáltatás nyújtása) |
| 2 | Játékbeállítás | `users/{uid}/settings`: aktív hajó/zene, hangerő, nehézség, nyelv, kamera-hozzájárulás állapota | A szolgáltatás nyújtása, preferenciák tárolása | **6(1)(b)** — szerződés |
| 3 | Pénztárca / birtoklás / vásárlás | `users/{uid}/wallet`, `.../inventory`, `.../purchases` | Kredit-egyenleg, megvásárolt tartalom, vásárlási előzmény | **6(1)(b)** — szerződés teljesítése |
| 4 | Statisztika / küldetésnapló | `users/{uid}/stats`, `walls/{uid}/failures\|successes` | Rekordok, „Szégyenfal" napló | **6(1)(b)** — szolgáltatás / ⚠️ [jogi megerősítés: esetleg 6(1)(f)] |
| 5 | Nyilvános profil | `usersPublic/{uid}`: fantázianév, online státusz | Barát-kereshetőség, jelenlét | **6(1)(a)** — hozzájárulás (a social funkciók opcionálisak) ⚠️ [jogi megerősítés] |
| 6 | Social gráf | `friends`, `friendRequests`, `outgoingRequests`, `notifications`, `chats` | Barátok, kérések, értesítések, privát chat | **6(1)(a)** — hozzájárulás ⚠️ [jogi megerősítés] |
| 7 | Eszköz-azonosító | `deviceId` (localStorage), `device_map/{deviceId}` | Vendég (anonim) folytonosság, guest→Google fiók-összevonás | **6(1)(f)** — jogos érdek (a bejelentkezés nélküli játszhatóság) |
| 8 | Webkamera-figyelés (arcfelismerés) | Kamerakép — **kizárólag lokális**, sosem tárolt/továbbított | A játékmenet alapmechanikája (figyelemfigyelés) | **6(1)(a)** — kifejezett hozzájárulás (lásd 8. szakasz és `webkamera-9cikk-allaspont.md`) |
| 9 | Anti-cheat, stabilitás, hibadiagnózis | Technikai események (nincs önálló érzékeny adatkör) | A szolgáltatás védelme és megbízhatósága | **6(1)(f)** — jogos érdek |
| 10 | Fizetési adat | **Stripe hosztolt fizetőoldal** — a kártyaadat **sosem** érinti az appot | Valós pénzes vásárlás | **6(1)(b)** — szerződés (a Stripe önálló adatkezelő/adatfeldolgozó, lásd 4. szakasz) |

---

## 4. Adatfeldolgozók és címzettek

| Címzett | Szerep | Kezelt adat |
|---|---|---|
| **Google Ireland Ltd. / Google LLC (Firebase)** | adatfeldolgozó | Realtime Database (a fenti `users`, `walls`, `usersPublic`, `friends`, `friendRequests`, `outgoingRequests`, `notifications`, `chats`, `device_map` node-ok), Firebase Authentication (Google OAuth + anonim bejelentkezés), Firebase Hosting |
| **Stripe Payments Europe, Ltd. / Stripe, Inc.** | önálló adatkezelő a fizetésre | Fizetési/kártyaadat a **hosztolt** fizetőoldalon; az appba csak a tranzakció azonosítója (`session_id`) tér vissza |
| **`{{szamlazo}}` (pl. Számlázz.hu / Billingo)** | adatfeldolgozó (ha bevezetésre kerül) | Számlázási adat (`plans/022-stripe-tax-compliance.md`) |

> ⚠️ [jogi megerősítés szükséges]: a Google és a Stripe pontos jogi entitása és a velük kötött adatfeldolgozói megállapodás (DPA) hivatkozása.

---

## 5. Adattovábbítás harmadik országba

A Firebase/Google és a Stripe infrastruktúrája részben **EU-n kívül (USA)** működik, így személyes adat **harmadik országba** továbbítódhat. A továbbítás jogalapja:

- **EU–US Data Privacy Framework** (megfelelőségi határozat), amennyiben a szolgáltató tanúsított; és/vagy
- **Általános Szerződési Feltételek (SCC)** a Google, illetve a Stripe adatfeldolgozói megállapodása szerint.

> ⚠️ [jogi megerősítés szükséges]: a pontos hivatkozás (DPF-tanúsítás státusza, SCC-modul) — jogilag mozgó terület, a véglegesítéskor ellenőrizni kell.

---

## 6. Megőrzési idők

| Adatkör | Megőrzés |
|---|---|
| Fiók / profil / beállítás / játékállapot | A fiók fennállásáig, illetve a törlési kérelemig (17. cikk) |
| Vásárlási / számlázási adat | A jogszabályi (adójogi) megőrzési ideig — ⚠️ [jogi/könyvelői megerősítés]: jellemzően a számviteli bizonylat-megőrzési kötelezettség (`{{megorzesi_ido}}`) |
| Statisztika / küldetésnapló / social | A fiók fennállásáig, illetve a törlésig |
| Webkamera-kép | **Nem tárolódik** — a stream a feldolgozás után azonnal eldobásra kerül |
| Eszköz-azonosító (`deviceId`) | A böngésző localStorage ürítéséig / a fiók törléséig |

---

## 7. Az érintett jogai

Az érintettet megilleti a **hozzáférés** (15.), **helyesbítés** (16.), **törlés / elfeledtetés** (17.), **adathordozhatóság** (20.), **korlátozás** (18.), **tiltakozás** (21.) joga, valamint a **hozzájárulás visszavonásának** joga (7.).

**Gyakorlati gyakorlás — a szolgáltatásban közvetlenül:**
- **Hozzáférés + adathordozhatóság:** a **Beállítások → Adatvédelem / GDPR → „Adataim exportálása"** gomb a teljes rólad tárolt adatot **JSON**-ban letölti.
- **Törlés:** a **Beállítások → Adatvédelem / GDPR → „Fiók és adatok törlése"** gomb véglegesen törli a fiókodat és adataidat (megerősítő lépéssel).
- **Helyesbítés:** a fantázianév a **Beállítások** menüben szerkeszthető (`plans/006-editable-displayname.md`).
- **Hozzájárulás visszavonása (kamera):** a **Beállítások**-ban bármikor visszavonható.

> ⚠️ **Korlát (`plans/023-gdpr-compliance.md` 4.3):** a más felhasználók adataiban megjelenő tartalom (pl. elküldött chat-üzenet a közös beszélgetésben) teljes törléséhez szükség lehet szerveroldali feldolgozásra. Amíg ez nem áll rendelkezésre, ilyen kérést a `{{kapcsolat_email}}` címen lehet benyújtani. ⚠️ [jogi megerősítés: elfogadható-e az átmeneti részleges kliensoldali törlés].

**E-mailes csatorna:** minden érintetti kérés benyújtható a `{{kapcsolat_email}}` címen is; a válaszadási határidő a GDPR szerint **legfeljebb 1 hónap**.

---

## 8. Webkamera és arcfelismerés — kiemelt szakasz

A játék **webkamerás arcfelismerést** használ a figyelmed figyelésére. Fontos:

- A kamerakép feldolgozása **teljes egészében a böngésződben, lokálisan** történik (TensorFlow.js / MediaPipe technológiával).
- **Kép, videó vagy arc-jellemző (keypoint) SOHA nem kerül szerverre**, nem tárolódik és nem továbbítódik — sem az adatkezelőnek, sem harmadik félnek.
- A kamera használatához **kifejezett hozzájárulásod** szükséges, amelyet a hozzájárulási képernyőn adhatsz meg, és a **Beállítások**-ban bármikor visszavonhatsz (`plans/014-camera-consent.md`).
- Az adatkezelő kizárólag a **hozzájárulás állapotát** (megadva / megtagadva) tárolja (`users/{uid}/settings/cameraConsent`), a kameraképet **nem**.

> Az adatkezelő álláspontja szerint a fentiek miatt **valószínűleg nem keletkezik a GDPR 9. cikke szerinti különleges kategóriájú (biometrikus) adatkezelés** — a részletes indoklás: `webkamera-9cikk-allaspont.md`. ⚠️ [jogi megerősítés szükséges].

---

## 9. Süti- és tárolási tájékoztatás

Az alkalmazás kizárólag **működéshez szükséges (funkcionális)** böngésző-tárolást (`localStorage`) használ: játékállapot, nyelvi beállítás, függőben lévő vásárlás. **Nincs** analitikai vagy hirdetési süti/nyomkövetés.

> ⚠️ [jogi megerősítés szükséges]: mivel csak funkcionális tárolás történik, **süti-hozzájárulási banner várhatóan nem kötelező** (ePrivacy) — a véglegesítéskor megerősítendő. Rögzítés: `jogalap-nyilvantartas.md`.

---

## 10. Korhatár

A vásárláshoz **nagykorúság** (18. életév), illetve szülői / törvényes képviselői hozzájárulás szükséges. Az adatkezelő nem irányoz célzottan 16 (illetve `{{korhatar}}`) év alatti gyermekekre szolgáltatást. ⚠️ [jogi megerősítés szükséges]: a magyar/EU gyermek-hozzájárulási korhatár (GDPR 8. cikk) alkalmazása.

---

## 11. Jogorvoslat — panasz

Ha úgy ítéled meg, hogy az adatkezelés jogsértő, panaszt tehetsz a felügyeleti hatóságnál:

**Nemzeti Adatvédelmi és Információszabadság Hatóság (NAIH)**
- Cím: 1055 Budapest, Falk Miksa utca 9–11. `⚠️ [cím ellenőrzése a véglegesítéskor]`
- Weboldal: `https://naih.hu`
- E-mail: `ugyfelszolgalat@naih.hu` `⚠️ [ellenőrzendő]`

Emellett bírósághoz is fordulhatsz.

---

## 12. A tájékoztató módosítása

Az adatkezelő fenntartja a jogot a tájékoztató módosítására. Az aktuális verziószám és a hatálybalépés dátuma a dokumentum fejlécében (`Verzió`, `Utolsó frissítés`) és a szolgáltatásban (`legal.lastUpdated`) jelenik meg.
