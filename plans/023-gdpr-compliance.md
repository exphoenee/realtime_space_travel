---
title: "GDPR / adatvédelmi megfelelőség – adatkezelési tájékoztató, érintetti jogok (export/törlés), jogalap-dokumentáció, webkamera 9. cikk"
slug: 023-gdpr-compliance
type: plan
category: compliance
status: not-started
implemented: false
implemented_at: null
created_at: "2026-08-06"
updated_at: "2026-08-06"
author: exphoenee
step: 23
phases: []
dependencies:
  - 001-main-menu-settings
  - 003-firebase-auth-settings
related_plans:
  - 014-camera-consent
  - 012-wall-of-shame
  - 013-social-multiplayer
  - 022-stripe-tax-compliance
  - 024-stripe-go-live
tags:
  - gdpr
  - privacy
  - compliance
  - data-protection
  - consent
  - camera
  - erasure
  - i18n
---

# GDPR / adatvédelmi megfelelőség – adatkezelési tájékoztató, érintetti jogok, jogalap-dokumentáció, webkamera 9. cikk

**Cél:** A **Realtime Space Travel** valós pénzes, EU-s B2C digitális szolgáltatás GDPR-megfelelőségének rendezése egy önálló, dedikált tervben. Négy sáv: (A) **adatkezelési tájékoztató** szövege (GDPR 13. cikk), (B) a **webkamera + arcfelismerés** különleges kategória (9. cikk) jogi rendezése, (C) az **érintetti jogok technikai funkciói** (hozzáférés/adathordozhatóság = export, törlés = „elfeledtetéshez való jog") a Settings képernyőn, (D) **jogalap-dokumentáció, süti-állásfoglalás, 30. cikk szerinti nyilvántartás, DPO-értékelés**. A kanonikus jogi szövegek markdown-forrása a repo-szintű **`./compliance/gdpr/`** mappában él (single source of truth, verziózható, jogásszal review-zható).

> ⚠️ **Ez a terv technikai útmutató, nem jogi tanácsadás.** A tervben szereplő **szövegeket és jogalapokat GDPR-szakértővel / jogásszal jóvá kell hagyatni** az élesítés előtt. A terv jelzi, hol kötelező a szakértői megerősítés. A benne foglalt jogi állítások (pl. „a lokális arcfelismerés nem keletkeztet biometrikus adatkezelést", „süti-banner nem kötelező", „DPO nem kötelező") **munkahipotézisek**, amelyek jogi jóváhagyás nélkül nem tekinthetők ténynek.

> ℹ️ **Miért külön terv, és mi NEM tartozik ide:** ez a terv a **compliance-család** adatvédelmi sávja, párhuzamosan a [[022-stripe-tax-compliance]] adózási sávjával. A **jogi képernyő UI-váza** (`LegalScreen` komponens, fülek, routing, `/legal/*` mély linkek, valamint a Terms / Refund / Imprint fülek tartalma) a [[024-stripe-go-live]] **C fázisában** marad. Ez a terv a **Privacy fül tartalmi/jogi forrását** adja (a `legal.privacy.*` névtér tartalmi gazdája), plusz a **go-live-tól független** érintetti-jog funkciókat (export/törlés) a Settingsben. **Nincs körkörösség:** a tartalom/követelmény ebből a (korábbi) tervből jön, a renderelő váz a (későbbi) go-live-ból. Az export/törlés a meglévő Firebase-adatmodellre (003) épül, ezért a go-live **ELŐTT** implementálható.

## Döntések (egyeztetve)

| Kérdés | Választás |
|--------|-----------|
| Külön terv vagy go-live-ba olvasztva? | **Külön, dedikált terv** — párhuzamosan a [[022-stripe-tax-compliance]]-szel, ugyanabban a compliance-családban |
| Hatókör | **Teljes:** (A) adatkezelési tájékoztató szövege + (B) webkamera 9. cikk álláspont + (C) érintetti jogok TECHNIKAI funkciói (export/törlés) + (D) jogalap-dokumentáció, süti, 30. cikk, DPO |
| Viszony a go-live-hoz | A terv a **[[024-stripe-go-live]] kemény, blokkoló előfeltétele**. A go-live nem élesíthető, amíg ez le nem zárult |
| Kanonikus jogi szöveg helye | Repo-szintű **`./compliance/gdpr/*.md`** markdown-tár (nem `src/` alatt) — single source of truth, verziózható, jogász által review-zható |
| Markdown vs. runtime render | **(a) út: a markdown a kanonikus forrás, a runtime `legal.privacy.*` i18n kulcsok ennek kézzel szinkronizált tükre.** Indoklás: egyszerűbb, nincs build-csatolás a `src/`-en kívüli mappára, konzisztens a go-live meglévő i18n-alapú `legal.*` renderelésével. A duplikációt egy **paritás-ellenőrző TODO** és a ritka, tudatos szövegváltás kezeli. A (b) build-idejű markdown-import a jövőbeli optimalizáció (lásd 6.2) |
| Irányadó nyelv | **Magyar** a jogilag irányadó szöveg; en/fr/de/es tájékoztató fordítás (ugyanaz az elv, mint a go-live `legal.authoritativeNote`-nál) |
| Érintetti-jog UI helye | **Settings képernyő** „Adatvédelem / GDPR" szekció (Export + Törlés gomb, megerősítő modállal) — nem dedikált screen; a Settings a meglévő belépési pont (001) |
| Export tartalma | RTDB user-node (`users/{rtdbKey}`) + `walls/{rtdbKey}` + a lokális `space-travel-*` persist store-ok → **egyetlen JSON** letöltés |
| Törlés hatóköre | RTDB user-node + Firebase Auth fiók (bejelentkezettnél) + lokális `space-travel-*` kulcsok **ÉS** a nyilvános/social személyes adat: `usersPublic`, `walls`, `friends` (reciprok), `friendRequests`/`outgoingRequests` (reciprok), `notifications`, `chats`. **Anonim/vendégnél is működik** a `deviceId`/`device_map` alapján |
| Helyesbítés (16. cikk) | **Nem épül újra** — a fantázianév-szerkesztés már létezik ([[006-editable-displayname]]), erre hivatkozunk |
| Süti-banner | Az app csak **funkcionális** localStorage-ot használ (nincs analitika/hirdetés) → banner **valószínűleg nem kötelező** — **jogi megerősítés kell**, rögzítve |
| DPO | **Valószínűleg nem kötelező** (a különleges kategória kezelés lokális, nem nagy léptékű, nem szisztematikus) — az álláspontot írásban rögzítjük, jogi megerősítéssel |

---

## ✅ Haladás (TODO)

> Jelölés az állapotra: `[ ]` hátravan · `[~]` folyamatban · `[x]` kész.
> Jelölés a végrehajtóra: **`[K]`** = KÉZI (a felhasználó / jogász: jogi szöveg, hatósági/szakértői döntés) · **`[A]`** = AUTOMATIZÁLHATÓ (kód, script vagy AI) · **`[K+A]`** = vegyes (AI vázol, ember/jogász véglegesít).

**Előfeltétel — jogi jóváhagyás (blokkoló az élesítésre)**
- [ ] `[K]` A teljes terv (szövegek + jogalapok + 9. cikk álláspont + süti + DPO + 30. cikk) **GDPR-szakértői / jogászi review**-ja és jóváhagyása

**A. Adatkezelési tájékoztató (Privacy notice) — GDPR 13. cikk**
- [x] `[K+A]` `./compliance/gdpr/` mappa létrehozása (repo-szintű dokumentum-tár)
- [x] `[K+A]` `compliance/gdpr/adatkezelesi-tajekoztato.hu.md` — a magyar (irányadó) tájékoztató teljes **vázlata** elkészült (`{{...}}` placeholderek + `⚠️ [jogi megerősítés]` jelölések); jogász-véglegesítés az „Előfeltétel — jogi jóváhagyás" tételnél
- [x] `[K+A]` Fordítások: `adatkezelesi-tajekoztato.{en,fr,de,es}.md` — az `en.md` érdemi vázlat, az `fr/de/es` rövid szakaszcím-váz + irányadósági záradék; teljes fordítás a HU véglegesítése után
- [ ] `[K]` **Adatkezelő azonosítása:** EV neve, székhely, adószám, EV-nyilvántartási szám, kapcsolattartási e-mail (megegyezik a go-live impresszum adataival) — *a vázlatban `{{...}}` placeholder, a valós adat kitöltése hátravan*
- [x] `[K+A]` **Adatkörök és célok** táblázata (lásd 3.1) — vázlat kész (`adatkezelesi-tajekoztato.hu.md` 3. szakasz)
- [x] `[K+A]` **Jogalapok** adatkörönként (6. cikk): vásárlás → 6(1)(b) szerződés; webkamera-figyelés → 6(1)(a) hozzájárulás; anti-cheat/stabilitás → 6(1)(f) jogos érdek (lásd 3.2) — vázlat kész (`jogalap-nyilvantartas.md`)
- [x] `[K+A]` **Adatfeldolgozók**: Google/Firebase (RTDB, Auth, Hosting), Stripe (fizetés) — a kártyaadat sosem érinti az appot (lásd 3.3) — vázlat kész
- [ ] `[K]` **Harmadik országba továbbítás** (Firebase/Google US) → megfelelőségi határozat / SCC rögzítése (lásd 3.4) — *a vázlatban rögzítve, jogi megerősítés hátra*
- [x] `[K+A]` **Megőrzési idők** adatkörönként (lásd 3.5) — vázlat kész (adójogi megőrzés ⚠️ könyvelői megerősítéssel)
- [x] `[K+A]` **Érintetti jogok** felsorolása + a gyakorlati út (Settings export/törlés + e-mail) (lásd 3.6) — vázlat kész
- [ ] `[K]` **Panasz a NAIH-hoz** (Nemzeti Adatvédelmi és Információszabadság Hatóság) — elérhetőséggel
- [ ] `[K]` **Korhatár / nagykorúság** (a vásárláshoz) — összhangban a go-live ÁSZF-fel

**B. Webkamera + arcfelismerés — különleges kategória (GDPR 9. cikk)**
- [x] `[K+A]` `compliance/gdpr/webkamera-9cikk-allaspont.md` — a jogi álláspont **vázlata** kész (munkahipotézis + indoklás + jogásznak felteendő kérdések)
- [ ] `[K]` **Jogászi megerősítés:** a 100%-ban lokális feldolgozás (TensorFlow.js/MediaPipe; kép/videó/keypoint sosem hagyja el a böngészőt, semmi nem tárolódik/továbbítódik) → **valószínűleg nem keletkezik biometrikus adatkezelés** a 9. cikk értelmében
- [x] `[K+A]` A tájékoztatóban **külön, kiemelt szakasz** a webkameráról, hivatkozva a [[014-camera-consent]] hozzájárulási flow-ra — vázlat kész (`adatkezelesi-tajekoztato.hu.md` 8. szakasz)
- [ ] `[A]` Kereszthivatkozás: a [[014-camera-consent]] `app.cameraConsent.*` tájékoztató szövege és ez a szakasz **ne mondjon ellent** egymásnak

**C. Érintetti jogok — TECHNIKAI megvalósítás (a terv kód-része)**
- [ ] `[A]` `src/firebase/gdprData.ts` (**ÚJ**) — `exportUserData(rtdbKey, authUid)` egyszeri `get()` olvasás minden érintett node-ról → egységes JSON objektum
- [ ] `[A]` `src/firebase/gdprData.ts` — `eraseUserData(rtdbKey, authUid)` — a törölhető RTDB-útvonalak atomikus `update(..., null)` törlése (lásd 4.2 út-lista)
- [ ] `[A]` `src/state/gdprExport.ts` (**ÚJ** vagy a `clearUserScopedData.ts` mellett) — a lokális `space-travel-*` persist store-ok begyűjtése az exportba + törléskori `localStorage.removeItem`
- [ ] `[A]` `SettingsScreen.tsx` — új „Adatvédelem / GDPR" szekció: **„Adataim exportálása"** gomb (JSON letöltés `Blob` + `URL.createObjectURL`) és **„Fiók/adatok törlése"** gomb
- [ ] `[A]` **Megerősítő modál** a törléshez (a meglévő `ui/Modal.tsx`-re; kétlépcsős megerősítés, mert visszafordíthatatlan)
- [ ] `[A]` Törlés után: Firebase Auth fiók törlése bejelentkezettnél (`deleteUser`) → lokális takarítás (`clearUserScopedData` újrahasznosítva) → `transitionTo("intro")` / új anonim session
- [ ] `[A]` **Vendég (anonim) ág:** a `deviceId`/`device_map` alapú törlés is működjön (nincs Google Auth fiók, csak anonim uid + device node)
- [ ] `[K]` **Kereszt-hatás dokumentálása és tesztelése:** a törlés a [[012-wall-of-shame]] `walls/{rtdbKey}` és a [[013-social-multiplayer]] social adatait (chat, barát-élek, notification) is érintse (lásd 4.3 nyitott kérdés a más-user-node-okban lévő adatról)
- [ ] `[A]` Helyesbítés (16. cikk): **link/hivatkozás** a meglévő fantázianév-szerkesztésre ([[006-editable-displayname]]) — nem új funkció
- [ ] `[A]` i18n: `settings.privacy.*` névtér mind az 5 nyelven (lásd 7. szekció)
- [ ] `[A]` `database.rules.json` felülvizsgálat: a törléshez szükséges `.write` (null) engedélyezett-e minden érintett úton (lásd 4.4)

**D. Jogalap-dokumentáció, süti, nyilvántartás, DPO**
- [x] `[K+A]` `compliance/gdpr/jogalap-nyilvantartas.md` — jogalap-tábla + érdekmérlegelés + süti-állásfoglalás **vázlata** kész (3.2 forrása)
- [x] `[K+A]` `compliance/gdpr/adatkezelesi-nyilvantartas-art30.md` — minimális 30. cikk szerinti nyilvántartás **vázlata** kész (EV részben mentesül, de a webkamera miatt érdemes)
- [x] `[K+A]` `compliance/gdpr/dpo-ertekeles.md` — DPO-értékelés **vázlata** kész: **valószínűleg nem kötelező**, az álláspont indoklással
- [ ] `[K]` **Süti-állásfoglalás:** csak funkcionális localStorage → banner valószínűleg nem kötelező (ePrivacy) — **jogi megerősítés**, rögzítve a `jogalap-nyilvantartas.md`-ben
- [ ] `[K]` A négy `[K]`-jellegű állásfoglalás (9. cikk, süti, DPO, 30. cikk) **jogászi megerősítése**

**E. i18n**
- [ ] `[A]` `settings.privacy.*` érintetti-jog UI kulcsok mind az 5 nyelven (7.1)
- [ ] `[K+A]` A `legal.privacy.*` névtér **tartalmi feltöltése** a `compliance/gdpr/adatkezelesi-tajekoztato.*.md`-ből (a go-live C fázisa hozza létre a kulcs-vázat; a **tartalom forrása ez a terv**) — paritás-ellenőrzés (7.2)
- [ ] `[K]` A jogi szövegek fordításának emberi ellenőrzése (mint a go-live-nál)

**F. Koordináció + validáció**
- [ ] `[A]` A [[024-stripe-go-live]] additív módosítása: GDPR-terv felvétele blokkoló `dependencies`-be + `[[023-gdpr-compliance]]` hivatkozás a Privacy/§4.3 résznél (lásd 8. szekció — a planner elvégzi)
- [ ] `[A]` `tsc --noEmit` tiszta · `npm run test` zöld · i18n paritás nyelvenként egyenlő
- [ ] `[K]` Manuális teszt: export JSON letöltés (bejelentkezett + vendég), törlés (bejelentkezett + vendég), a social/wall adat is eltűnik

---

## 1. Kontextus és architektúra

A [[003-firebase-auth-settings]] teremtette meg a Firebase Auth (Google + anonim) + RTDB adatmodellt, amelyre minden felhasználói adat épül. A [[014-camera-consent]] a webkamera-hozzájárulási flow-t, a [[012-wall-of-shame]] a `walls/{uid}` személyes küldetésnaplót, a [[013-social-multiplayer]] pedig a barát-gráfot, chatet és értesítéseket. A [[005-ingame-shop-strapi-stripe]] + [[024-stripe-go-live]] valós pénzes B2C digitális értékesítést indít EU-s fogyasztóknak — ez **kötelezővé teszi a GDPR-megfelelőséget** (13. cikk tájékoztató, érintetti jogok gyakorolhatósága, jogalapok dokumentálása).

Ez a terv **négy sávban** rendezi a megfelelőséget:

```
compliance/gdpr/*.md   ── kanonikus jogi szöveg (single source of truth) ──┐
        │                                                                  │
        │ (a) kézi szinkron                                                │
        ▼                                                                  ▼
  legal.privacy.* i18n  ──► LegalScreen Privacy fül (a VÁZ a go-live C-je)   compliance dokumentum-tár
                                                                        (jogász review, git-történet)

  settings.privacy.* i18n ──► SettingsScreen „Adatvédelem/GDPR" szekció
        │
        ├──► exportUserData()  →  JSON letöltés (15., 20. cikk)
        └──► eraseUserData()   →  RTDB + Auth + localStorage törlés (17. cikk)
```

**Az adatvédelmi UI a Settingsben él, nem a `LegalScreen`-ben.** A `LegalScreen` (go-live C) **olvasható jogi dokumentum**; az érintetti-jog **műveletek** (export/törlés) interaktívak és fiók-hoz kötöttek, ezért a Settings a helyük (ott van az `AccountSection`, a kijelentkezés, a nyelv). A kettő független.

---

## 2. Fájlstruktúra

### Új: kanonikus jogi dokumentum-tár (nem `src/` alatt)

```
compliance/
  gdpr/
    adatkezelesi-tajekoztato.hu.md        # IRÁNYADÓ magyar tájékoztató (13. cikk)
    adatkezelesi-tajekoztato.en.md        # tájékoztató fordítás
    adatkezelesi-tajekoztato.fr.md
    adatkezelesi-tajekoztato.de.md
    adatkezelesi-tajekoztato.es.md
    jogalap-nyilvantartas.md              # jogalap-tábla adatkörönként + süti-állásfoglalás
    adatkezelesi-nyilvantartas-art30.md   # 30. cikk szerinti (minimális) nyilvántartás
    dpo-ertekeles.md                      # DPO-értékelés (valószínűleg nem kötelező)
    webkamera-9cikk-allaspont.md          # a különleges kategória (9. cikk) jogi álláspont
```

> A `compliance/` **szándékosan a `src/`-en KÍVÜL** van: nem alkalmazás-kód, hanem jogi dokumentum-tár. A választott (a) út mellett a build **nem** importálja — az app az i18n-ből renderel —, így a mappa tisztán verziózott, jogász által review-zható forrás marad. (A build-idejű import (b) útját lásd 6.2.)

### Új / módosuló alkalmazás-kód

```
src/firebase/gdprData.ts            # ÚJ — exportUserData(), eraseUserData()
src/state/gdprExport.ts             # ÚJ (vagy clearUserScopedData.ts bővítése) — lokális store-ok az exportba + removeItem
src/components/screens/SettingsScreen.tsx   # +„Adatvédelem / GDPR" szekció (Export + Törlés gomb + megerősítő modál)
src/components/screens/SettingsScreen.module.css  # +szekció stílus
src/firebase/userData.ts            # (esetleg) közös path-konstansok újrahasznosítása
database.rules.json                 # törlési (.write null) jogosultságok felülvizsgálata a social/wall utakon
src/i18n/locales/{en,hu,fr,de,es}/translation.json  # +settings.privacy.* ; a legal.privacy.* TARTALMA (kulcs-váz: go-live C)
```

---

## 3. Adatkezelési tájékoztató — tartalmi vázlat (GDPR 13. cikk)

> A teljes, kifejtett szöveg a `compliance/gdpr/adatkezelesi-tajekoztato.hu.md`-be kerül; itt a **kötelező elemek szerkezete** van, hogy a jogász strukturáltan tudja véglegesíteni.

### 3.1 Adatkörök és célok

| Adatkör | Konkrét mezők (RTDB / kliens) | Cél |
|---|---|---|
| Fiók / profil | `users/{uid}/profile` (displayName, photoURL, provider, nickname, createdAt, lastLoginAt), Google OAuth alapadat | Bejelentkezés, fiók-azonosítás |
| Játékbeállítás | `users/{uid}/settings` (aktív hajó/zene, hangerő, nehézség, nyelv, `cameraConsent`) | A szolgáltatás nyújtása, preferenciák |
| Pénztárca / birtoklás | `users/{uid}/wallet`, `users/{uid}/inventory`, `users/{uid}/purchases` | Kredit-egyenleg, megvásárolt tartalom, vásárlási előzmény |
| Statisztika / napló | `users/{uid}/stats`, `walls/{uid}/failures\|successes` | Küldetésnapló (Szégyenfal), rekordok |
| Nyilvános profil | `usersPublic/{uid}` (nickname, online státusz) | Barát-kereshetőség, jelenlét |
| Social gráf | `friends/{uid}`, `friendRequests/{uid}`, `outgoingRequests/{uid}`, `notifications/{uid}`, `chats/{chatId}` | Barátok, kérések, értesítések, privát chat |
| Eszköz-azonosító | `deviceId` (localStorage), `device_map/{deviceId}` | Vendég (anonim) folytonosság, guest→Google merge |
| Fizetési adat | **Stripe hosztolt fizetőoldal** — a kártyaadat **sosem** érinti az appot | Valós pénzes vásárlás ([[024-stripe-go-live]]) |
| Webkamera-kép | **Kizárólag lokális** (böngésző), sosem tárolt/továbbított | Figyelemfigyelés (arcfelismerés) — lásd 3.2 és B szakasz |

### 3.2 Jogalapok (GDPR 6. cikk)

| Adatkezelés | Jogalap | Megjegyzés |
|---|---|---|
| Kredit-vásárlás, számlázás | **6(1)(b)** — szerződés teljesítése | A valós pénzes tranzakció; adózás → [[022-stripe-tax-compliance]] |
| Webkamera-figyelés (arcfelismerés) | **6(1)(a)** — hozzájárulás | A [[014-camera-consent]] flow szerzi be; visszavonható (Settings) |
| Anti-cheat, stabilitás, hibadiagnózis | **6(1)(f)** — jogos érdek | Érdekmérlegelés dokumentálandó a `jogalap-nyilvantartas.md`-ben |
| Fiók, játékállapot mentése | **6(1)(b)** — szolgáltatás nyújtása | RTDB user-node |
| Nyilvános profil / social | **6(1)(a)** vagy **6(1)(b)** — jogász dönti el | A barát-funkciók opcionálisak → hozzájárulás valószínű |

> ⚠️ A webkamera jogalapja **hozzájárulás**, nem jogos érdek — a különleges kategória gyanúja miatt (9. cikk) ez a biztonságos út, még akkor is, ha a B szakasz szerint valószínűleg nem keletkezik biometrikus adat. Jogász erősítse meg.

### 3.3 Adatfeldolgozók

- **Google / Firebase** — Realtime Database (`users`, `walls`, `usersPublic`, `friends`, `friendRequests`, `outgoingRequests`, `notifications`, `chats`, `device_map`), Firebase Authentication (Google OAuth + anonim), Firebase Hosting. A `deviceId`, `uid` és a fenti RTDB-adatok a Google infrastruktúráján tárolódnak.
- **Stripe** — fizetés-feldolgozó. A **kártyaadat a Stripe hosztolt fizetőoldalán** marad, az appot sosem érinti ([[024-stripe-go-live]] 4.3).

### 3.4 Harmadik országba továbbítás

A Firebase/Google infrastruktúrája részben **EU-n kívül (US)** működik. Rögzíteni kell a jogalapot: **megfelelőségi határozat** (EU–US Data Privacy Framework) és/vagy **általános szerződési feltételek (SCC)** a Google DPA-ja szerint. ⚠️ A pontos hivatkozást jogász erősítse meg, mert a keret jogilag változó.

### 3.5 Megőrzési idők

Adatkörönként meghatározandó (jogász). Kiindulás: a fiók-adat a fiók fennállásáig; a vásárlási/számlázási adat a jogszabályi (adójogi) megőrzési ideig ([[022-stripe-tax-compliance]]); a webkamera-kép **nem tárolódik** (azonnal eldobott stream). A törlés (17. cikk) a nem jogszabályi kötelezettség alatt álló adatot azonnal eltávolítja.

### 3.6 Érintetti jogok

Hozzáférés (15.), helyesbítés (16. — [[006-editable-displayname]]), törlés (17.), adathordozhatóság (20.), hozzájárulás visszavonása (7. — kamera: Settings). A **gyakorlati út**: a Settings „Adatvédelem / GDPR" szekció export/törlés gombjai + a kapcsolattartási e-mail. Panasz: **NAIH**.

---

## 4. Érintetti jogok — technikai megvalósítás

### 4.1 Export (hozzáférés + adathordozhatóság, 15. és 20. cikk)

„Adataim exportálása" gomb a Settingsben → `exportUserData(rtdbKey, authUid)`:

- **Egyszeri `get()`** olvasás (nem subscription) az érintett node-okról: `users/{rtdbKey}`, `walls/{rtdbKey}`, `usersPublic/{rtdbKey}`, `friends/{authUid}`, `friendRequests/{authUid}`, `outgoingRequests/{authUid}`, `notifications/{authUid}`, valamint a saját `chats/{chatId}` beszélgetések (a `getChatId(authUid, friendUid)` alapján a barát-listából származtatva).
- A **lokális** `space-travel-*` localStorage persist store-ok (`space-travel-game`, `space-travel-ui`, `space-travel-shop`, `space-travel-lang`) beolvasása.
- Az összefésült objektum **JSON-ként** letölthető (`Blob` + `URL.createObjectURL` + `<a download>`), gépi olvasható, strukturált formátumban (a 20. cikk „tagolt, széles körben használt" követelménye).

> A meglévő reader függvények (`subscribeUser`, `subscribeFailures`, `subscribeSuccesses`, `mapPurchases` a `userData.ts`-ben) mintát adnak, de az exporthoz **egyszeri olvasó** kell (`get()`), nem élő listener — külön `gdprData.ts` fájlban.

```ts
// src/firebase/gdprData.ts — vázlat
export interface UserDataExport {
  exportedAt: number;
  user: unknown;              // users/{rtdbKey}
  wall: unknown;              // walls/{rtdbKey}
  publicProfile: unknown;     // usersPublic/{rtdbKey}
  social: {                   // csak regisztrált usernél
    friends: unknown;
    friendRequests: unknown;
    outgoingRequests: unknown;
    notifications: unknown;
    chats: Record<string, unknown>;
  } | null;
  localStorage: Record<string, unknown>;  // space-travel-*
}
```

### 4.2 Törlés / „elfeledtetéshez való jog" (17. cikk)

„Fiók/adatok törlése" gomb → **kétlépcsős megerősítő modál** (visszafordíthatatlan) → `eraseUserData(rtdbKey, authUid)`:

**Törlendő RTDB-útvonalak** (atomikus multi-path `update(root, { ...: null })`):

| Útvonal | Kulcs | Forrás-terv |
|---|---|---|
| `users/{rtdbKey}` | rtdbKey | [[003-firebase-auth-settings]] |
| `usersPublic/{rtdbKey}` | rtdbKey | [[013-social-multiplayer]] |
| `walls/{rtdbKey}` | rtdbKey | [[012-wall-of-shame]] |
| `device_map/{deviceId}` | deviceId | [[010-firebase-guest-merge-single-gate]] |
| `friends/{authUid}` + minden `friends/{otherUid}/{authUid}` reciprok él | authUid | [[013-social-multiplayer]] (`removeFriend` mintája: kétoldali törlés) |
| `friendRequests/{authUid}` + a más inboxában lévő saját kérés `friendRequests/{otherUid}/{authUid}` | authUid | [[013-social-multiplayer]] |
| `outgoingRequests/{authUid}` (+ reciprok) | authUid | [[013-social-multiplayer]] |
| `notifications/{authUid}` | authUid | [[013-social-multiplayer]] |
| `chats/{chatId}` a saját beszélgetésekre (`getChatId`) | authUid | [[013-social-multiplayer]] |

**Ezután:**
1. **Firebase Auth fiók törlése** bejelentkezettnél (`deleteUser(currentUser)`); vendégnél az anonim uid + `device_map` node törlése elég.
2. **Lokális takarítás:** `localStorage.removeItem` minden `space-travel-*` kulcsra (a `clearUserScopedData` bővíthető, de az eszközszintű kulcsokat — nyelv, hangerő — a törléskor **is** el kell dobni, mert ez explicit felhasználói kérés, szemben a fiókváltással).
3. Átmenet: `transitionTo("intro")` és új anonim session (a `signInAnonymously` úgyis lefut a bootstrapben).

### 4.3 ⚠️ Kritikus nyitott kérdés — adat más felhasználók node-jaiban

A GDPR-törlésnek ki kellene terjednie a **más felhasználók node-jában** lévő személyes adatra is: a chat-üzenetekben a törlő fél üzenetei a `chats/{chatId}` közös node-ban élnek (a barát is olvassa); a barát inboxában lévő értesítés (`notifications/{friendUid}` ahol `fromUid == törlő`); a barát `friends`/`friendRequests` élei.

- A `removeFriend` **kétoldali** törlést végez (a rules ezt engedik), tehát a barát-élek eltávolíthatók kliensről.
- A **chat közös node** és a **más inboxában lévő értesítés** törlése viszont a security rules szerint kliensről **nem feltétlen engedélyezett** (a notification írás `fromUid == auth.uid` push-ra korlátozott, nem tetszőleges törlésre). **Ez teljes, szerveroldali törlést igényelhet (Firebase Admin SDK).**
- **Feloldás:** a szerveroldali erasure endpoint a [[020-nextjs-migration]] utáni **Vercel API route + `firebase-admin`** úton (ugyanaz az infrastruktúra, amit a [[021-stripe-fraud-defense]] F fázisa és a 003 6. pontja is céloz) valósítható meg. Amíg ez nincs meg, a kliensoldali törlés **a saját node-jaiban teljes**, a más node-jaiban lévő maradékra **dokumentált korlát** + kézi/e-mailes erasure-kérés a csatorna. **Jogásszal tisztázandó, elfogadható-e a részleges kliensoldali törlés a szerveroldali endpoint bevezetéséig.**

### 4.4 Security rules

A `database.rules.json`-ban ellenőrizni kell, hogy a törlendő utak **`.write` (null)** művelete engedélyezett a tulajdonosnak (a `users`, `walls`, `usersPublic` már `device_map`/uid alapú tulajdonlással írható; a `friends` reciprok törlést a `removeFriend` már használja). Ahol nem — a szerveroldali endpoint (4.3) kell.

### 4.5 Helyesbítés (16. cikk)

**Nem épül újra.** A fantázianév szerkesztése a [[006-editable-displayname]]-ben már megvan (`updateUserNickname`, Settings ceruza/pipa UI). A tájékoztató erre hivatkozik; a GDPR-szekció opcionálisan egy „Profil szerkesztése" utalást adhat ugyanoda.

---

## 5. Webkamera + arcfelismerés — GDPR 9. cikk álláspont

A `compliance/gdpr/webkamera-9cikk-allaspont.md`-ben rögzített, **jogásszal megerősítendő** álláspont:

- A feldolgozás **100%-ban lokális** (TensorFlow.js / MediaPipe a böngészőben). A `getUserMedia` stream **sosem** hagyja el a klienst; a [[014-camera-consent]] `CameraConsentScreen` a prompt után **azonnal lezárja** a track-eket, a detektálás memóriában fut.
- **Kép, videó, arc-keypoint nem tárolódik és nem továbbítódik** — sem RTDB-be, sem máshova. A [[003-firebase-auth-settings]] `settings.cameraConsent` mező **csak az engedély állapotát** (`granted`/`denied`/`undecided`) rögzíti, nem a kameraképet.
- Ebből következően **valószínűleg nem keletkezik a 9. cikk szerinti biometrikus adatkezelés** (nincs „egyedi azonosítás céljából" történő tárolt biometria). **De ezt jogásznak kell megerősítenie** — a 9. cikk megítélése tagállami gyakorlattól is függhet.
- A tájékoztatóban ez **külön, kiemelt szakasz** legyen (a Stripe review és az érintetti bizalom szempontjából is), és tartalmi paritásban a [[014-camera-consent]] `app.cameraConsent.description` szövegével.

---

## 6. Markdown forrás és runtime render viszonya

### 6.1 Választott út — (a) markdown a forrás, i18n a tükör

- A `compliance/gdpr/adatkezelesi-tajekoztato.*.md` a **kanonikus jogi szöveg** (verziózott, jogász review-zza, git-történet).
- A `LegalScreen` Privacy fül a **runtime `legal.privacy.*` i18n kulcsokból** renderel (a kulcs-vázat a [[024-stripe-go-live]] C fázisa hozza létre; a **tartalom forrása ez a terv**). Az i18n értékek a markdown **kézzel szinkronizált tükre**.
- **Előny:** nincs build-csatolás a `src/`-en kívüli mappára; konzisztens a go-live meglévő i18n-alapú `legal.*` renderelésével; a `compliance/` tisztán dokumentum-tár marad.
- **Ár:** duplikáció (markdown + i18n). Kezelés: a szöveg **ritkán és tudatosan** változik (mindig jogi review kíséri), és egy **paritás-ellenőrző TODO** (E szakasz) rögzíti, hogy a kulcsok és a markdown egyeznek. A markdown fejlécében verziószám/`lastUpdated` — ugyanaz jelenik meg a `legal.lastUpdated`-ben.

### 6.2 Elvetett út — (b) build-idejű markdown import

A `LegalScreen` build-időben importálhatná a markdownt (Vite `?raw` import + markdown→HTML), így nincs duplikáció. **Miért nem most:** (1) a `compliance/` a `src/`-en kívül van, a bundlernek relatív importtal (`../../compliance/...`) vagy `public/`-ba másolással kellene elérnie; (2) nyelvváltásnál dinamikusan a megfelelő `*.<lng>.md`-t kellene betölteni (kód-split); (3) a markdown→HTML sanitizálás új függőség. Ez **jövőbeli optimalizáció**, ha a duplikáció fájdalmassá válik — a plan rögzíti mint opciót, de az (a) út a mostani döntés.

---

## 7. i18n

### 7.1 `settings.privacy.*` — érintetti-jog UI (ÚJ, ebben a tervben)

Mind az 5 nyelven (`en`, `hu`, `fr`, `de`, `es`), teljes paritással.

| Kulcs | Magyar szöveg (javaslat) |
|---|---|
| `settings.privacy.heading` | „Adatvédelem / GDPR" |
| `settings.privacy.exportButton` | „Adataim exportálása" |
| `settings.privacy.exportHint` | „Letölti minden rólad tárolt adatot JSON formátumban." |
| `settings.privacy.deleteButton` | „Fiók és adatok törlése" |
| `settings.privacy.deleteHint` | „Véglegesen törli a fiókodat és minden adatodat. Nem visszavonható." |
| `settings.privacy.confirmTitle` | „Biztosan törlöd az adataidat?" |
| `settings.privacy.confirmBody` | „Ez véglegesen törli a profilodat, kreditjeidet, küldetésnaplódat, barátaidat és üzeneteidet. A művelet nem visszavonható." |
| `settings.privacy.confirmYes` | „Igen, töröljön mindent" |
| `settings.privacy.confirmNo` | „Mégse" |
| `settings.privacy.deleted` | „Az adataid törlésre kerültek." |
| `settings.privacy.exportError` | „Az exportálás nem sikerült. Próbáld újra." |
| `settings.privacy.deleteError` | „A törlés nem sikerült. Próbáld újra." |
| `settings.privacy.editProfileLink` | „Profil / fantázianév szerkesztése" *(a [[006-editable-displayname]]-re mutat)* |

### 7.2 `legal.privacy.*` — koordináció a go-live-val

⚠️ **Ne duplikáld a kulcs-vázat.** A `legal.privacy.*` névteret (kulcsok: `.heading`, `.controller`, `.dataCollected`, `.camera`, `.storage`, `.firebase`, `.stripe`, `.retention`, `.rights`, `.contact`) a [[024-stripe-go-live]] **10.4 szekciója** definiálja. Ez a terv a **tartalmi forrás**: a `compliance/gdpr/adatkezelesi-tajekoztato.*.md`-ből töltjük fel a kulcsokat. A magyar az irányadó, a többi tájékoztató fordítás (`legal.authoritativeNote`). Ha a tájékoztató több szakaszt kíván, mint a meglévő váz, a **bővítést itt jelezzük** és a go-live C fázisában additívan vesszük fel — nem itt hozunk létre új `legal.*` kulcsokat a go-live megkerülésével.

---

## 8. Koordináció a go-live tervvel — additív módosítások

> Ezeket a `planner` **additívan** végzi el a [[024-stripe-go-live]]-ban, a meglévő tartalom átírása nélkül; a `manage-roadmap` véglegesíti a számozást és a `[[...]]` hivatkozásokat.

1. **`dependencies`:** a [[023-gdpr-compliance]] slug felvétele a go-live `dependencies`-ébe **kemény, blokkoló** előfeltételként (a go-live nem élesíthető GDPR-megfelelőség nélkül).
2. **C fázis / 4.3 Privacy:** a Privacy fül tartalmi részénél `[[023-gdpr-compliance]]` hivatkozás — „a részletes adatvédelmi tartalom és a jogalapok forrása a GDPR-terv". A `LegalScreen` **váz, routing, mély linkek** és a Terms/Refund/Imprint tartalom **marad** a go-live-ban.
3. **Nincs körkörösség:** a Privacy fül *tartalma/követelménye* a GDPR-tervből (korábbi) jön; a *renderelő váz* a go-live-ból (későbbi). Az export/törlés a Settingsbe épül, a `LegalScreen`-től függetlenül, a 003 adatmodellre — a go-live **ELŐTT** implementálható.

---

## 9. Kockázatok / figyelmeztetések

- **Jogi jóváhagyás kötelező.** A terv technikai útmutató. A szövegek, jogalapok, a 9. cikk álláspont, a süti- és DPO-állásfoglalás **jogászi megerősítés nélkül nem élesíthető**. Egyik állítás sem jogi tanács.
- **Más-user-node adat (4.3).** A teljes 17. cikk szerinti törléshez (chat közös node, más inboxában lévő értesítés) valószínűleg **szerveroldali (Admin SDK)** endpoint kell → [[020-nextjs-migration]]. Addig a kliensoldali törlés a saját node-okban teljes, a maradékra dokumentált korlát + e-mailes erasure. Jogásszal tisztázandó az átmenet elfogadhatósága.
- **Visszafordíthatatlan törlés.** Kétlépcsős megerősítő modál kötelező; a törlés a valós pénzen vett kreditet is elviszi — az ÁSZF-ben ezt egyértelműsíteni kell (nincs visszatérítés a törlés miatt).
- **Vendég (anonim) törlés.** A `deviceId`/`device_map` alapú ág könnyen elmarad a tesztelésből — a TODO-ban külön tesztpont. A vendégnek nincs Google Auth fiókja, csak anonim uid + device node.
- **Az RTDB nem tárol üres objektumot.** Export/olvasáskor a hiányzó node `null`-ként jön vissza (mint a [[012-wall-of-shame]] S. blokkjában az üres tömb) — az export defenzíven kezelje a hiányzó ágakat.
- **Markdown ↔ i18n paritás.** A választott (a) út duplikál; ha a paritás-ellenőrzés elmarad, a megjelenített és a kanonikus szöveg szétcsúszhat. A `lastUpdated`/verziószám és a paritás-TODO ezt köti.
- **Harmadik országos továbbítás jogalapja változó** (3.4) — a Data Privacy Framework / SCC hivatkozást jogász frissítse, mert jogilag mozgó terület.
- **Hozzájárulás visszavonása = kamera.** A [[014-camera-consent]] `denied` útja már megvan; a tájékoztató mondja ki, hogy a Settingsben bármikor visszavonható.

---

## 10. Becsült ráfordítás

| Sáv | Tartalom | K/A | Nagyságrend |
|---|---|---|---|
| A | Adatkezelési tájékoztató szöveg (md + i18n feltöltés) | **K+A** | ~1 nap AI vázlat + jogi review (átfutás akár hetek) |
| B | Webkamera 9. cikk álláspont | **K+A** | ~2 óra + jogi megerősítés |
| C | Érintetti-jog funkciók (export/törlés UI + Firebase + rules) | **A** | ~1,5–2 nap |
| D | Jogalap-tábla, süti, 30. cikk, DPO dokumentumok | **K+A** | ~0,5 nap + jogi review |
| E | i18n (`settings.privacy.*` + `legal.privacy.*` tartalom) | **A** (+K fordítás-ellenőrzés) | ~2–3 óra |
| F | Go-live koordináció + validáció | **A** | ~1 óra |

**Összesen:** ~3–4 munkanap tényleges munka, **plusz** a jogi/GDPR-szakértői review átfutása (akár több hét) — ez blokkolja az élesítést.

**Kész definíció:** a `./compliance/gdpr/` mappában verziózott, jogilag jóváhagyott magyar adatkezelési tájékoztató (+ en/fr/de/es fordítás), jogalap-nyilvántartás, 30. cikk szerinti nyilvántartás, DPO-értékelés és a webkamera 9. cikk álláspont; a `LegalScreen` Privacy füle (go-live C) ezt a tartalmat rendereli mind az 5 nyelven; a Settings „Adatvédelem / GDPR" szekció **működő export** (teljes felhasználói adat JSON-ban, bejelentkezett és vendég usernél) és **működő törlés** (RTDB user-node + social/wall + Auth fiók + lokális `space-travel-*`; a más-user-node-okban lévő maradékra dokumentált korlát vagy szerveroldali endpoint), kétlépcsős megerősítéssel; a helyesbítés a meglévő [[006-editable-displayname]]-re hivatkozik; a jogalapok, a süti-állásfoglalás és a DPO-értékelés jogászilag megerősítve; és a [[024-stripe-go-live]] blokkoló `dependencies`-ében szerepel a GDPR-terv.

---

## 11. Kapcsolódó tervek

- [[024-stripe-go-live]] – **ez a terv a go-live kemény, blokkoló előfeltétele.** A `LegalScreen` váz + routing + mély linkek + Terms/Refund/Imprint tartalom a go-live C fázisában marad; a **Privacy fül tartalmi/jogi forrása ez a terv** (a `legal.privacy.*` névtér tartalmi gazdája). Az export/törlés a Settingsbe épül, a go-live-tól függetlenül.
- [[022-stripe-tax-compliance]] – **testvér-terv a compliance-családban.** Az adózási sáv (ÁFA, OSS, számlázás) párja az adatvédelmi sávnak. A megőrzési idők (3.5) részben az adójogi kötelezettségekhez (022) igazodnak.
- [[014-camera-consent]] – a webkamera-hozzájárulási flow; a 9. cikk álláspont (B/5. szakasz) erre épül, és a tájékoztató webkamera-szakasza tartalmi paritásban van az `app.cameraConsent.*` szövegekkel.
- [[003-firebase-auth-settings]] – **előfeltétel.** Az RTDB user-node séma (`profile`, `settings`, `wallet`, `inventory`, `stats`, `purchases`) és a `getRtdbKey()` invariáns (bejelentkezve `auth.uid`, vendégként `deviceId`) adja az export/törlés alapját. A 9. és 10. terv adatvédelmi figyelmeztetései (`Adatvédelem — megosztott böngésző`) itt kapnak funkcionális választ.
- [[001-main-menu-settings]] – **előfeltétel.** A Settings képernyő az érintetti-jog UI (export/törlés) belépési pontja.
- [[012-wall-of-shame]] – a `walls/{rtdbKey}` személyes küldetésnapló az export és a törlés része. A törlés a nyilvános (barát által látható) `walls` rekordokat is elviszi.
- [[013-social-multiplayer]] – a `friends`, `friendRequests`, `outgoingRequests`, `notifications`, `chats`, `usersPublic` személyes/social adat az export és a törlés része. A 4.3 nyitott kérdés (más-user-node adat) közvetlenül ennek a tervnek a struktúrájából ered.
- [[006-editable-displayname]] – a helyesbítés (16. cikk) meglévő megvalósítása; a GDPR-terv **hivatkozik rá**, nem építi újra.
- [[020-nextjs-migration]] – a 4.3 szerinti **szerveroldali erasure endpoint** (Vercel API route + `firebase-admin`) tényleges megvalósíthatóságát a migráció adja, ugyanabban a repóban/deployban.
