# Webkamera + arcfelismerés — GDPR 9. cikk álláspont (tervezet)

> **Státusz:** AI-vázlat → **GDPR-szakértői / jogászi megerősítés szükséges**
> **Kapcsolódó terv:** `plans/023-gdpr-compliance.md` (B/5. szakasz), `plans/014-camera-consent.md`
> **Utolsó frissítés:** 2026-08-06
>
> ⚠️ **Ez a dokumentum NEM jogi tanácsadás.** A benne foglalt álláspont **munkahipotézis**, amelyet jogásznak / adatvédelmi szakértőnek meg kell erősítenie az élesítés előtt.

---

## 1. A kérdés

A játék webkamerás **arcfelismerést** használ a játékos figyelmének figyelésére. Az arc feldolgozása felveti a **GDPR 9. cikke** szerinti **különleges kategóriájú (biometrikus) adatkezelés** gyanúját, amely főszabály szerint **tilos**, kivéve szűk kivételekkel (pl. kifejezett hozzájárulás, 9(2)(a)).

**A kérdés:** keletkezik-e a 9. cikk értelmében vett biometrikus adatkezelés?

---

## 2. A tényállás (technikai)

| Tény | Részlet | Bizonyíték a kódban |
|---|---|---|
| A feldolgozás **100%-ban lokális** | TensorFlow.js / MediaPipe a böngészőben fut | `src/hooks/useFaceDetection.ts`, `src/services/faceRecognition.ts` |
| A kamerakép **nem hagyja el a klienst** | a `getUserMedia` stream csak a böngésző sandboxában él | `src/hooks/useCamera.ts` |
| A stream **azonnal lezárul** a hozzájárulás-prompt után | a track-ek `stop()`-ja azonnal fut | `plans/014-camera-consent.md` 5. szakasz, `CameraConsentScreen.handleAllow` |
| **Semmi nem tárolódik** | nincs kép/videó/keypoint az RTDB-ben vagy máshol | a `settings.cameraConsent` csak `granted`/`denied`/`undecided` állapot |
| **Semmi nem továbbítódik** | nincs hálózati hívás kameraadattal | — |
| **Nincs egyedi azonosítás** | a rendszer csak azt vizsgálja, *van-e arc a képen* (figyel-e a játékos), nem *kit* azonosít | figyelemfigyelés, nem személyazonosítás |

---

## 3. Az álláspont (munkahipotézis)

**A 9. cikk szerinti biometrikus adat** akkor keletkezik, ha a személyes adatot **kifejezetten egy természetes személy egyedi azonosítása céljából**, sajátos technikai eljárással kezelik (GDPR 4. cikk 14. pont).

Az adatkezelő álláspontja szerint **valószínűleg NEM keletkezik 9. cikk szerinti adatkezelés**, mert:

1. **Nincs egyedi azonosítási cél.** A rendszer nem azonosít személyt, csak *arc jelenlétét/figyelmét* detektálja. A cél a játékmechanika (a játékos a képernyő előtt ül-e), nem az identitás megállapítása.
2. **Nincs tárolt biometrikus sablon.** Nem készül és nem tárolódik arc-template, embedding vagy keypoint-készlet — a feldolgozás pillanatnyi, memóriában futó, majd eldobott.
3. **Nincs adattovábbítás.** Az adat sosem hagyja el a böngészőt, így az adatkezelő ténylegesen nem is „fér hozzá" biometrikus adathoz.

**Következmény:** a feldolgozás a **6(1)(a) hozzájáruláson** alapul (a `plans/014-camera-consent.md` flow), és **különös (9. cikk szerinti) jogalapra valószínűleg nincs szükség**.

---

## 4. Óvatossági intézkedések (attól függetlenül, hogy a 9. cikk alkalmazandó-e)

Még ha a fenti álláspont helyes is, az adatkezelő a **legszigorúbb** utat követi:

- **Kifejezett hozzájárulás** a kamera használatához (nem ráutaló magatartás) — `CameraConsentScreen`.
- A hozzájárulás **bármikor visszavonható** a Beállításokban.
- **Kiemelt, külön tájékoztató szakasz** az adatkezelési tájékoztatóban (`adatkezelesi-tajekoztato.hu.md` 8. szakasz), amely egyértelműen kimondja a lokális, nem tárolt, nem továbbított feldolgozást.
- **Adatvédelem beépítetten** (Privacy by Design): a lokális feldolgozás maga a legerősebb technikai garancia.

---

## 5. Nyitott kérdések a jogásznak

| # | Kérdés |
|---|---|
| 1 | Elfogadható-e az az álláspont, hogy a lokális, nem tárolt, nem azonosító célú arcfelismerés **nem** keletkeztet 9. cikk szerinti biometrikus adatkezelést? ⚠️ |
| 2 | Ha a 9. cikk **mégis** alkalmazandó, a **9(2)(a) kifejezett hozzájárulás** kivétele elegendő jogalapot ad-e, és milyen többlet-tájékoztatás kell hozzá? |
| 3 | Szükséges-e **adatvédelmi hatásvizsgálat (DPIA, 35. cikk)** a webkamera-figyelés miatt? (Előzetes vélemény: a lokális, nem tárolt feldolgozás miatt a magas kockázat valószínűtlen — ⚠️ megerősítendő.) |
| 4 | A tagállami (magyar) gyakorlat / NAIH-álláspont tartalmaz-e eltérő elvárást a biometria fogalmára? |
