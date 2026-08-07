# Adatvédelmi tisztviselő (DPO) kötelezettségének értékelése (tervezet)

> **Státusz:** AI-vázlat → **GDPR-szakértői / jogászi megerősítés szükséges**
> **Kapcsolódó terv:** `plans/023-gdpr-compliance.md` (D szakasz)
> **Utolsó frissítés:** 2026-08-06
>
> ⚠️ **Ez a dokumentum NEM jogi tanácsadás.** Az álláspont munkahipotézis, amelyet jogásznak meg kell erősítenie.

---

## 1. Mikor kötelező DPO? (GDPR 37. cikk (1))

DPO kijelölése kötelező, ha:

- **(a)** az adatkezelést közhatalmi szerv végzi (itt **nem** releváns); vagy
- **(b)** a fő tevékenység **nagy léptékű, rendszeres és szisztematikus megfigyelést** igényel; vagy
- **(c)** a fő tevékenység **különleges kategóriájú** (9. cikk) vagy büntetőjogi adat **nagy léptékű** kezelése.

---

## 2. Az értékelés

| Feltétel | Fennáll? | Indoklás |
|---|---|---|
| (a) Közhatalmi szerv | **Nem** | Egyéni vállalkozó, magánszolgáltatás |
| (b) Nagy léptékű, rendszeres, szisztematikus megfigyelés | **Valószínűleg nem** ⚠️ | A webkamera-figyelés **lokális**, nem tárolt, nem továbbított, és nem irányul egyedi azonosításra/profilalkotásra (`webkamera-9cikk-allaspont.md`). A „nagy lépték" a jelenlegi felhasználószámnál valószínűtlen. |
| (c) Nagy léptékű különleges kategóriájú adat | **Valószínűleg nem** ⚠️ | A `webkamera-9cikk-allaspont.md` szerint valószínűleg **nem keletkezik** 9. cikk szerinti biometrikus adat; még ha keletkezne is, a kezelés lokális és nem „nagy léptékű". |

---

## 3. Álláspont (munkahipotézis)

**A DPO kijelölése valószínűleg NEM kötelező**, mert egyik 37. cikk (1) szerinti feltétel sem teljesül egyértelműen:

- a webkamera-feldolgozás lokális és nem hoz létre tárolt biometrikus adatot;
- nincs nagy léptékű, szisztematikus megfigyelés vagy profilalkotás;
- a szolgáltatás egyéni vállalkozói, korlátozott léptékű.

**Ajánlás:** DPO helyett egy **kijelölt adatvédelmi kapcsolattartó** (a vállalkozó maga, `{{kapcsolat_email}}`) kezelje az érintetti kéréseket és a NAIH-kommunikációt.

---

## 4. Nyitott kérdés a jogásznak

| # | Kérdés |
|---|---|
| 1 | Megerősíthető-e, hogy a jelen adatkezelés alapján **nem kötelező** DPO kijelölése? ⚠️ |
| 2 | A felhasználószám növekedése (nagy lépték) mikor billentheti át az értékelést? Van-e küszöb, amelynél újra kell vizsgálni? |
| 3 | Szükséges-e önkéntes DPO vagy adatvédelmi felelős formális kijelölése a Stripe / üzleti partnerek elvárása miatt? |
