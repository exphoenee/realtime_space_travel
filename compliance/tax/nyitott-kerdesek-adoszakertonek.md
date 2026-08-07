# Nyitott kérdések az adószakértőnek / könyvelőnek

> **Státusz:** AI-vázlat → **a szakértő válaszaival bővül**
> **Kapcsolódó:** `afa-oss-megfeleloseg.hu.md`, `plans/022-stripe-tax-compliance.md`
> **Utolsó frissítés:** 2026-08-06
>
> Ez a lista a `022-stripe-tax-compliance` terv adózási bizonytalanságait gyűjti össze, hogy egy konzultáción végig lehessen menni rajtuk. Minden kérdés mellé kerüljön a szakértő válasza és a döntés dátuma.

---

## Kontextus a szakértőnek (1 bekezdés)

EU-ban (Magyarországon) letelepedett vállalkozás **digitális kredit-pakkokat** (elektronikusan nyújtott szolgáltatás) értékesít túlnyomórészt **B2C** fogyasztóknak, EU-s és EU-n kívüli országokból, **Stripe Payment Links** fizetéssel. A Stripe Tax bekapcsolása tervezett (célországi ÁFA-kalkuláció + OSS-riport). Az alábbi pontokban szakértői döntés kell.

---

## Kérdések

### 1. Alanyi adómentesség vs. OSS
- Fennáll-e / megtartható-e az **alanyi adómentesség** a vállalkozásnál?
- Hogyan viszonyul az alanyi adómentesség a **határon átnyúló B2C digitális szolgáltatáshoz** és az OSS-hez?
- **Válasz:** `{{...}}` — **Dátum:** `{{...}}`

### 2. 10 000 €-s uniós küszöb
- Hogyan számoljuk a küszöböt (mely bevételek számítanak bele, milyen időszakra)?
- A küszöb **alatt** maradva alkalmazható-e a HU ÁFA, és önként választható-e mégis az OSS?
- Mi a teendő a küszöb **átlépésekor** (időzítés, regisztráció)?
- **Válasz:** `{{...}}` — **Dátum:** `{{...}}`

### 3. Számlázás + NAV Online Számla
- B2C digitális szolgáltatásnál milyen **magyar számla** kiállítási kötelezettség van?
- Terhel-e minket **NAV Online Számla** adatszolgáltatás, és milyen körben?
- Ajánlott megoldás: **Számlázz.hu / Billingo** integráció vagy kézi számlázás a Stripe-adatból?
- **Válasz:** `{{...}}` — **Dátum:** `{{...}}`

### 4. Stripe termék-adókód
- A **`txcd_10000000`** (elektronikusan nyújtott szolgáltatás) a helyes adókód a kredit-pakkokhoz?
- **Válasz:** `{{...}}` — **Dátum:** `{{...}}`

### 5. Harmadik országbeli (EU-n kívüli) vásárlók
- Hogyan kezelendő az EU-n kívüli fogyasztóknak nyújtott szolgáltatás ÁFÁ-ja / bevallása?
- **Válasz:** `{{...}}` — **Dátum:** `{{...}}`

### 6. Bruttó (inclusive) ár-megjelenítés
- Megfelelő-e a **`tax_behavior: inclusive`** (bruttó ár) az EU-s fogyasztói árfeltüntetésnek, és nincs-e ebből eredő adózási kockázat (országonként eltérő nettó bevétel)?
- **Válasz:** `{{...}}` — **Dátum:** `{{...}}`

---

## Döntési napló

| # | Kérdés | Döntés | Ki | Dátum |
|---|---|---|---|---|
| 1 | Alanyi adómentesség vs. OSS | `{{...}}` | `{{...}}` | `{{...}}` |
| 2 | 10 000 €-küszöb | `{{...}}` | `{{...}}` | `{{...}}` |
| 3 | Számlázás / NAV Online Számla | `{{...}}` | `{{...}}` | `{{...}}` |
| 4 | Termék-adókód | `{{...}}` | `{{...}}` | `{{...}}` |
| 5 | EU-n kívüli vásárlók | `{{...}}` | `{{...}}` | `{{...}}` |
| 6 | Bruttó ár-megjelenítés | `{{...}}` | `{{...}}` | `{{...}}` |
