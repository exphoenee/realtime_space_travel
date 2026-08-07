# Adatkezelési tevékenységek nyilvántartása — GDPR 30. cikk (minimális, tervezet)

> **Státusz:** AI-vázlat → **GDPR-szakértői véglegesítés szükséges**
> **Kapcsolódó terv:** `plans/023-gdpr-compliance.md` (D szakasz)
> **Utolsó frissítés:** 2026-08-06
>
> ⚠️ **Ez a dokumentum NEM jogi tanácsadás.**

---

## 0. Miért készül (annak ellenére, hogy részleges mentesség lehet)

A GDPR 30. cikk (5) bekezdése szerint a **250 főnél kevesebbet foglalkoztató** szervezet (így egy egyéni vállalkozó) bizonyos feltételekkel **mentesül** a nyilvántartás vezetése alól — **kivéve**, ha az adatkezelés kockázatot jelenthet, **nem alkalmi**, vagy **különleges kategóriájú** adatot érint.

Mivel a szolgáltatás **webkamerás arcfelismerést** használ (még ha a `webkamera-9cikk-allaspont.md` szerint valószínűleg nem is keletkezik 9. cikk szerinti adat) és **rendszeres** (nem alkalmi) adatkezelést végez, **óvatosságból** egy **minimális nyilvántartást** vezetünk.

> ⚠️ [jogi megerősítés szükséges]: a mentesség alkalmazhatósága ebben az esetben.

---

## 1. Az adatkezelő

| Mező | Érték |
|---|---|
| Név | `{{ev_nev}}` (egyéni vállalkozó) |
| Elérhetőség | `{{kapcsolat_email}}`, `{{szekhely}}` |
| DPO | `{{dpo}}` — valószínűleg nem kötelező (`dpo-ertekeles.md`) |

---

## 2. Az adatkezelési tevékenységek

| # | Tevékenység | Érintettek | Adatkategóriák | Cél / jogalap | Címzettek | Harmadik ország | Megőrzés | Techn./szerv. intézkedés |
|---|---|---|---|---|---|---|---|---|
| 1 | Fiók + játékállapot | játékosok | profil, beállítás, statisztika | szolgáltatás / 6(1)(b) | Google (Firebase) | US (SCC/DPF ⚠️) | fiók fennállásáig | RTDB security rules, Auth |
| 2 | Vásárlás / kredit | vásárlók | wallet, inventory, purchases | szerződés / 6(1)(b) | Google, Stripe, `{{szamlazo}}` | US ⚠️ | adójogi megőrzés ⚠️ | Stripe hosztolt checkout, szerver-only wallet (terv) |
| 3 | Webkamera-figyelés | játékosok | kamerakép (lokális, nem tárolt) | játékmechanika / 6(1)(a) | — (nincs továbbítás) | — | nem tárolódik | lokális feldolgozás (TF.js/MediaPipe) |
| 4 | Social (barát, chat, notification) | játékosok | nyilvános profil, üzenet, kapcsolat | social funkció / 6(1)(a) ⚠️ | Google (Firebase) | US ⚠️ | fiók fennállásáig | barát-olvasási security rules |
| 5 | Vendég-folytonosság | vendég játékosok | deviceId, device_map | jogos érdek / 6(1)(f) | Google (Firebase) | US ⚠️ | localStorage / fiók törléséig | — |

---

## 3. Érintetti jogok gyakorlásának technikai támogatása

| Jog | Megvalósítás | Hivatkozás |
|---|---|---|
| Hozzáférés / hordozhatóság (15., 20.) | Settings → Adatvédelem → „Adataim exportálása" (JSON) | `plans/023-gdpr-compliance.md` 4.1 |
| Törlés (17.) | Settings → Adatvédelem → „Fiók és adatok törlése" | `plans/023-gdpr-compliance.md` 4.2 |
| Helyesbítés (16.) | Fantázianév szerkesztése a Settingsben | `plans/006-editable-displayname.md` |
| Hozzájárulás visszavonása (7.) | Kamera-hozzájárulás visszavonása a Settingsben | `plans/014-camera-consent.md` |

---

## 4. Karbantartás

A nyilvántartást minden **új adatkör**, **új adatfeldolgozó** vagy **jogalap-változás** esetén frissíteni kell, együtt a `jogalap-nyilvantartas.md` és az `adatkezelesi-tajekoztato.*.md` fájlokkal.
