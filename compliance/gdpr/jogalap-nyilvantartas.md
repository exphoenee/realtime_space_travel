# Jogalap-nyilvántartás és süti-állásfoglalás (tervezet)

> **Státusz:** AI-vázlat → **GDPR-szakértői / jogászi véglegesítés szükséges**
> **Kapcsolódó terv:** `plans/023-gdpr-compliance.md` (D szakasz), `adatkezelesi-tajekoztato.hu.md` (3. szakasz)
> **Utolsó frissítés:** 2026-08-06
>
> ⚠️ **Ez a dokumentum NEM jogi tanácsadás.** A jogalapokat és az érdekmérlegeléseket jogásznak meg kell erősítenie.

---

## 1. Jogalap-tábla adatkörönként

| # | Adatkezelés | Jogalap (GDPR 6. cikk) | Indoklás / megjegyzés |
|---|---|---|---|
| 1 | Kredit-vásárlás, birtoklás, számlázás | **6(1)(b)** — szerződés | A valós pénzes tranzakció teljesítése; adózás → `plans/022-stripe-tax-compliance.md` |
| 2 | Fiók, profil, beállítás, játékállapot mentése | **6(1)(b)** — szerződés | A szolgáltatás nyújtásához elengedhetetlen |
| 3 | Webkamera-figyelés (arcfelismerés) | **6(1)(a)** — hozzájárulás | Lásd `webkamera-9cikk-allaspont.md`; visszavonható |
| 4 | Nyilvános profil (`usersPublic`) | **6(1)(a)** — hozzájárulás ⚠️ | A social funkciók opcionálisak; ⚠️ [jogi megerősítés: hozzájárulás vs. 6(1)(b)] |
| 5 | Social gráf (barát, kérés, notification, chat) | **6(1)(a)** — hozzájárulás ⚠️ | Opcionális funkció; a felhasználó aktívan kezdeményezi |
| 6 | Eszköz-azonosító (`deviceId`, `device_map`) | **6(1)(f)** — jogos érdek | Cél: bejelentkezés nélküli játszhatóság + guest→Google merge; lásd 2. érdekmérlegelés |
| 7 | Anti-cheat, stabilitás, hibadiagnózis | **6(1)(f)** — jogos érdek | Cél: a szolgáltatás védelme, a fizető felhasználók tisztességes kezelése; lásd 2. érdekmérlegelés |
| 8 | Statisztika / küldetésnapló | **6(1)(b)** vagy **6(1)(f)** ⚠️ | ⚠️ [jogi megerősítés]: a napló a szolgáltatás része-e vagy önálló jogos érdek |

---

## 2. Érdekmérlegelési teszt (6(1)(f) tételek)

> A jogos érdeken alapuló adatkezeléshez a GDPR érdekmérlegelést (LIA) kíván. Vázlat — jogász véglegesíti.

### 2.1 Eszköz-azonosító (`deviceId`)
- **Jogos érdek:** a felhasználó bejelentkezés nélkül is játszhasson, a haladása ne vesszen el, és guest→Google váltáskor átmenthető legyen.
- **Szükségesség:** enélkül a vendégjáték nem működne; az azonosító nem tartalmaz érzékeny adatot.
- **Érdekmérlegelés:** a felhasználó ésszerűen elvárja ezt a folytonosságot; a beavatkozás minimális (technikai azonosító). ⚠️ [jogi megerősítés].

### 2.2 Anti-cheat / stabilitás
- **Jogos érdek:** a valós pénzes gazdaság védelme a csalástól, a fizető felhasználók tisztességes kezelése (`plans/021-stripe-fraud-defense.md`).
- **Szükségesség:** a kredit-hamisítás elleni védelem nélkül a bolt sérülékeny.
- **Érdekmérlegelés:** technikai események, nem profilalkotás; alacsony érintetti kockázat. ⚠️ [jogi megerősítés].

---

## 3. Süti- / tárolási állásfoglalás (ePrivacy)

| Tárolt elem | Kulcs | Típus | Hozzájárulás-köteles? |
|---|---|---|---|
| Játékállapot | `space-travel-game` | funkcionális | Nem (működéshez szükséges) |
| UI-beállítás (hangerő, nehézség, kamera-consent cache) | `space-travel-ui` | funkcionális | Nem |
| Bolt-állapot (kredit-cache, kosár) | `space-travel-shop` | funkcionális | Nem |
| Nyelv | `space-travel-lang` | funkcionális | Nem |
| Eszköz-azonosító | `deviceId` | funkcionális (folytonosság) | Nem ⚠️ |

**Álláspont:** az alkalmazás **kizárólag működéshez szükséges (funkcionális)** böngésző-tárolást használ; **nincs** analitikai, hirdetési vagy nyomkövető süti. Ezért **süti-hozzájárulási banner várhatóan nem kötelező** az ePrivacy-irányelv szerint.

> ⚠️ [jogi megerősítés szükséges]: (1) a `deviceId` funkcionális minősítésének megerősítése; (2) hogy nem áll fenn banner-kötelezettség; (3) új, nem-funkcionális tároló (pl. analitika) bevezetése esetén a banner **kötelezővé válik** — ezt jövőbeli változásnál újra kell értékelni.

---

## 4. Verziókövetés

A jogalapok bármely változása (új adatkör, jogalap-váltás, új adatfeldolgozó) esetén ezt a nyilvántartást és az `adatkezelesi-tajekoztato.*.md` fájlokat **együtt** kell frissíteni, majd a runtime `legal.privacy.*` i18n kulcsokat szinkronizálni (`plans/023-gdpr-compliance.md` 6.1, paritás-ellenőrzés).
