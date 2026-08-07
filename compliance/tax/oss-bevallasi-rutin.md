# OSS negyedéves bevallási rutin — checklist

> **Státusz:** AI-vázlat → **könyvelői / adószakértői véglegesítés szükséges**
> **Kapcsolódó:** `afa-oss-megfeleloseg.hu.md`, `plans/022-stripe-tax-compliance.md`
> **Utolsó frissítés:** 2026-08-06
>
> ⚠️ Ez a checklist szervezési vázlat, nem adótanácsadás. A tényleges bevallási határidőket és a NAV ONYA-folyamatot könyvelővel kell megerősíteni.

---

## Ütemezés

Az uniós OSS-bevallás **negyedéves**. Naptári negyedévenként, a negyedévet követő hónap végéig kell benyújtani.

| Negyedév | Időszak | Benyújtási határidő (⚠️ könyvelővel megerősítendő) |
|---|---|---|
| Q1 | jan–márc | ~ápr. vége |
| Q2 | ápr–jún | ~júl. vége |
| Q3 | júl–szept | ~okt. vége |
| Q4 | okt–dec | ~jan. vége |

⚠️ [könyvelői megerősítés szükséges]: pontos határidők és a hiánytalan/nullás bevallás szabályai.

---

## Negyedéves checklist

### 1. Adatexport a Stripe-ból
- [ ] Stripe Dashboard → **Tax → Reports** (vagy Registrations export)
- [ ] Időszak: az adott naptári negyedév
- [ ] Ország szerinti bontású CSV letöltése: **adóalap, adókulcs, adóösszeg, tranzakciószám** oszlopokkal
- [ ] Ellenőrizni, hogy csak a **B2C EU-s** (OSS-hatókörű) tranzakciók szerepelnek-e; a HU-belföldi és EU-n kívüli tételek elkülönítése ⚠️ [könyvelővel]

### 2. Adategyeztetés
- [ ] Stripe-export összevetése a tényleges pénzügyi bevétellel (payout-ok)
- [ ] Visszatérítések / chargebackek levonása az adóalapból
- [ ] Árfolyam-kezelés (ha nem EUR-ban) ⚠️ [könyvelővel]

### 3. NAV ONYA bevallás
- [ ] Belépés a **NAV ONYA** (Online Nyomtatványkitöltő Alkalmazás) felületére
- [ ] Az OSS negyedéves bevallás nyomtatvány kitöltése az export alapján, tagállamonként
- [ ] Bevallás benyújtása a határidőn belül
- [ ] A megállapított ÁFA **befizetése** a NAV OSS-számlájára

### 4. Dokumentálás / archiválás
- [ ] A Stripe-export CSV archiválása (negyedév + dátum megjelöléssel)
- [ ] A benyújtott ONYA-bevallás visszaigazolásának mentése
- [ ] Bejegyzés a belső nyilvántartásba

---

## Szerep-elhatárolás

| Lépés | Ki végzi |
|---|---|
| Stripe-export | `{{felelos_export}}` (üzemeltető) |
| Adategyeztetés | `{{konyvelo}}` |
| ONYA-bevallás + befizetés | `{{konyvelo}}` |
| Archiválás | `{{felelos_export}}` |

> Emlékeztető: a **Stripe csak az adatot adja** — a bevallást és a befizetést a NAV felé mindig **manuálisan** kell teljesíteni.
