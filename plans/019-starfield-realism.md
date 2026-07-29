---
title: "Élethűbb csillagmező (Starfield realizmus) – színhőmérséklet, magnitúdó, subpixel, HiDPI, delta-idő, kitérő forgatás"
slug: 019-starfield-realism
type: plan
category: ui
status: in-progress
implemented: false
implemented_at: null
created_at: "2026-07-29"
updated_at: "2026-07-29"
author: exphoenee
step: 19
phases: []
dependencies:
  - 011-difficulty-event-system
related_plans:
  - 002-ingame-shop-frontend
tags:
  - starfield
  - canvas
  - rendering
  - hidpi
  - devicepixelratio
  - performance
  - visual-fidelity
  - astronomy
  - evasive-maneuver
---

# Élethűbb csillagmező (Starfield realizmus) – színhőmérséklet, magnitúdó, subpixel, HiDPI, delta-idő, kitérő forgatás

**Cél:** a `src/components/ui/Starfield.tsx` renderelésének élethűbbé és technikailag helyesebbé tétele **hat**, egymástól jól elkülöníthető munkacsomagban: (1) per-csillag feketetest **színhőmérséklet**, (2) **magnitúdó**-eloszlás, (3) **subpixel-villogás** megszüntetése, (4) **HiDPI** (devicePixelRatio) támogatás, (5) **framerate-függetlenség**, (6) a kitérő manőver **forgatása** (roll). Tisztán renderelési változás: nulla új felhasználói string, nulla új képernyő, nulla hálózati hívás.

> ⚠️ **Ez a terv szándékosan szűk.** Egy előzetes elemzés hét javítási lehetőséget azonosított; a felhasználó **ötöt hagyott jóvá**, kettőt (statikus háttérréteg / Tejút, mozgásvektoros warp-csík) és a twinkle-t **kifejezetten elutasította**. Az elutasított tételek a 8. szekcióban indoklással szerepelnek, hogy egy későbbi session ne „javítsa vissza" őket.

> ➕ **6. munkacsomag (utólagos scope-bővítés):** a kitérő manőver ma „csúszkálásnak" hat, nem manőverezésnek — ezért a mező a drift mellett **forogni** is fog. Azért került **ebbe** a tervbe és nem külön tervbe, mert **pontosan ugyanazt a kódrégiót** írja (a drift-blokk és a `ctx.save()` / `translate()` transzformáció), mint a 4. és az 5. csomag; külön tervként garantált lenne az ütközés. A választott változat **független, véletlen pördülés**; a repülőgépszerű bedőlés (banking) **elutasítva** — lásd 8.5.

---

## Döntések (egyeztetve)

| Kérdés | Választás |
|--------|-----------|
| Színmodell | **Feketetest (blackbody) Kelvin→RGB**, Tanner Helland-közelítéssel |
| Spektrál-eloszlás alapja | **Szabad szemmel látható** csillagokra súlyozott, **nem** a valódi tömegfüggvény (az ~76% M törpét adna — halványak, láthatatlanok) |
| Osztályok / arányok | O/B 15000 K 10% · A 8500 K 20% · F 6500 K 20% · G 5600 K 20% · K 4300 K 20% · M 3200 K 10% |
| Színszámítás ideje | **Egyszer, a csillag létrehozásakor.** Soha nem képkockánként |
| Telítettség | `STAR_COLOR_SATURATION` szorzó a fehér felé (alap: **0.65**) — a teljes telítettségű szín „diszkós", a valós szem a halvány csillagokat közel fehérnek látja |
| A telítettség **végleges** értéke | **Élő összevetés után dől el.** A konstans `0.65`-tel indul; az implementáció végén a felhasználónak látnia kell a `0.4` / `0.65` / `1.0` összevetést a futó játékban (K. blokk, 9. szekció 9. forgatókönyv) |
| Fényesség-eloszlás | Per-csillag `mag` power-law-ból (`Math.random() ** 2.5`), ami **a méretet ÉS az opacitást is** skálázza |
| Subpixel | Sugár **0.7 px**-nél clampelve, a veszteség az alfán, **energiamegőrző** `(r / 0.7)²` arányban |
| HiDPI | `devicePixelRatio` a backing store-on + `ctx.setTransform(dpr,…)`, **dpr clamp: max 2** |
| Logikai koordináták | Új `logicalWidth` / `logicalHeight` változók — a `canvas.width` **soha többé nem** logikai koordináta |
| Delta-idő | 60 FPS-re normalizált szorzó, **max 3 frame** clamppel (tab-váltás) |
| Warp-csík hossza | A hardkódolt `* 3` szorzó **nevesített konstansba** kerül (`STAR_STREAK_LENGTH_FACTOR = 3`, a mai viselkedés). A magnitúdó okozta rövidülés így **egyetlen szám** átírásával kompenzálható, a render-kódhoz nyúlás nélkül. A végleges érték a telítettséggel **ugyanabban a körben**, élőben dől el (7.7 / 9. szekció 11. tétel) |
| Az evasive drift lecsengése | **Ez is delta-normalizálva:** `k = 1 - (1 - 0.08) ** frames`, azaz `frames = 1`-nél bitre a mai `0.08` / `0.92`. ⚠️ Ez **felülírja** az eredeti „az evasive drift működése nem változhat" megkötést: a felhasználó tudatosan vállalta, hogy 60 Hz felett a lecsengés lassabbnak fog *tűnni*, cserébe fps-független lesz. A drift **iránya, kiváltása és 1-3 mp-es időtartama** változatlan (1.9 / 7.10) |
| Kitérő manőver: forgás | **Van forgás (roll).** A mai tiszta eltolódás „csúszkálásnak" hat, nem manőverezésnek |
| Forgás — vonatkoztatási rendszer | **A pilótafülke fix, a csillagmező forog.** Fizikailag ez a helyes nézőpont: a játékos a hajóban ül, a fülke a saját vonatkoztatási rendszere. A cockpit `drawImage` a transzformációs blokkon **kívül** marad, ahogy ma is |
| Forgás jellege | **Független, véletlen pördülés** — véletlen irányú és mértékű, a kitérés irányától **függetlenül**. Szándékolt érzet: találat / súrolás, kaotikus és drámai |
| ❌ Elutasított alternatíva | **Repülőgépszerű bedőlés (banking)**, azaz a `driftTargetX`-hez kötött forgás. A felhasználó kifejezetten **nem** ezt választotta: az kontrollált manővert sugallna. **Egy későbbi session ne „javítsa" bankingre** |
| Forgás triggere és élettartama | **Ugyanaz**, mint a drifté: `evasiveManeuverAt` + az 1-3 mp-es ablak. **Nincs külön időzítő** |
| Forgás simítása | **Ugyanaz a `frameRateAdjustedLerp` / `STAR_DRIFT_SMOOTHING`**, mint a drifté — a `k` egyetlen kiszámítása mindhármat kiszolgálja (`driftX`, `driftY`, `roll`). Így eleve framerate-független |
| Forgás mértéke | `STAR_ROLL_MAX_DEGREES` konstans, **±6°** kiindulási értékkel (szubjektív). Az AFK-jelleg és a hosszú ülés miatt tudatosan visszafogott. A **K. blokk** hangolási körének **harmadik** paramétere, a telítettség és a csíkhossz mellett |
| `Star` / `RenderStar` a forgáshoz | **Nem bővül.** A roll képernyőtér-transzformáció, nem per-csillag adat |
| Pure helperek helye | **`src/services/`** — a projektben **nincs** és **ne is legyen** `src/utils/`. A `services/` már pontosan ezt a szerepet tölti be (pure/domain modulok kolokált teszttel: `faceRecognition.ts`, `cameraPermission.ts`) |
| Per-frame string-építés | **Megszüntetve:** előre épített, osztályonként **megosztott** `rgb(...)` string + `ctx.globalAlpha` |
| `Star` típus bővítése | **`RenderStar extends Star`** — a publikus `Star` érintetlen marad (visszafelé kompatibilis) |
| Új konstansok | Mind a `src/constants/constants.ts`-be, JSDoc-kal |
| i18n | **Nulla új kulcs** — a `dev` skill **ne indítsa** az `i18n` agentet |
| Implementációs sorrend | A HiDPI **utolsó előtti** lépés (a legkockázatosabb, külön commitban izolálva) |

---

## ✅ Haladás (TODO)

> Jelölés: `[ ]` hátravan · `[~]` folyamatban · `[x]` kész.

**A. Kiindulási állapot rögzítése (baseline)**

> ⚠️ **Ez a blokk tudatosan kimaradt, és utólag nem pótolható.** A B–J blokkok implementációja a baseline felvétele **nélkül** történt meg, a régi állapotról tehát nincs képernyőkép és nincs profil. A tételek azért maradnak bejelöletlenül, hogy a hiány látható legyen: a K. blokk warp-hangolása (9. szekció 11. tétel) és a profil-összevetés (10. tétel) így **nem** tud a régi állapothoz mérni — mindkettőt abszolút megítéléssel kell elvégezni. Újrafelvétele csak a változás visszavonásával lenne lehetséges, ami nem éri meg.

- [ ] Képernyőkép a jelenlegi csillagmezőről álló helyzetben (191 km/s) és warpban (1000 km/s) — a későbbi vizuális összehasonlításhoz
- [ ] DevTools Performance profil: 400 csillag, frame time és GC-fűrészfog **a változtatás előtt** (referencia a K. blokkhoz)
- [ ] ✅ **Ellenőrzési pont:** megvan a „mihez képest" — enélkül a regresszió nem bizonyítható

**B. Pure helperek + tesztek — `src/services/`** *(canvas nélkül, ez a rész teljesen tesztelhető)*
- [x] ⚠️ A helperek a **`src/services/`**-be kerülnek, **nem** egy új `src/utils/` mappába — a `services/` már pontosan ez a réteg (`faceRecognition.ts` + kolokált teszt, `cameraPermission.ts`). Ne jöjjön létre új top-level mappa
- [x] `src/services/starColor.ts` — új fájl
- [x] `kelvinToRgb(kelvin: number): { r: number; g: number; b: number }` — Tanner Helland-közelítés, csatornánként `0…255`-re clampelve, `Math.round`-dal
- [x] Bemenet-védelem: `kelvin` a `[1000, 40000]` tartományra clampelve; nem véges bemenet (`NaN`, `Infinity`) → biztonságos fallback (6600 K, azaz fehér). **Sosem adhat vissza `NaN`-t**
- [x] `desaturateTowardWhite(rgb, saturation)` — `channel = 255 + (channel - 255) * saturation`; `saturation = 0` → tiszta fehér, `1` → identitás
- [x] `SPECTRAL_CLASSES` readonly tábla: `{ id, kelvin, weight }` × 6, a súlyok összege **pontosan 1**
- [x] `pickSpectralClass(rand: number)` — kumulatív súlyokkal; a `rand` **paraméter**, nem belső `Math.random()` (determinisztikus teszthez); `rand >= 1` → az utolsó osztály (őr)
  > 📌 **Implementációs eltérés — kerekített kumulatív súlyok.** A súlyok naiv összegzése lebegőpontos maradékot hagy: `0.1 + 0.2 = 0.30000000000000004`, ami a lenti határérték-tesztben a `rand = 0.3`-at még az **A** osztályba sorolta volna az elvárt **F** helyett. A kumulatív értékek ezért lépésenként kerekítve épülnek (`Math.round(x * 1e6) / 1e6`), így az osztályhatárok pontosan a táblázatbeli számokon vannak.
- [x] `buildStarColorTable(saturation: number)` — osztályonként **egyetlen** `{ r, g, b, css }` rekord, ahol `css` az előre épített `rgb(r, g, b)` string. **6 objektum, 6 string, egyszer** (lásd 4.3)
- [x] `src/services/starfieldMath.ts` — új fájl
- [x] `magnitudeFromRandom(rand: number): number` → `rand ** STAR_MAG_EXPONENT`
- [x] `subpixelAlphaScale(rawRadius: number, minRadius: number): number` → `rawRadius >= minRadius ? 1 : (rawRadius / minRadius) ** 2`, `0`-ra clampelve alul
- [x] `deltaFrames(elapsedMs: number, maxFrames?: number): number` → `elapsedMs <= 0` vagy nem véges → **`1`** (ez fedi le az első képkockát is); egyébként `min(elapsedMs / TARGET_FRAME_MS, maxFrames)`
- [x] `frameRateAdjustedLerp(base: number, frames: number): number` → `1 - (1 - base) ** frames` — a per-frame exponenciális simítás delta-normalizálása (a drifthez **és a forgatáshoz**: H. és I. blokk). `frames = 1` esetén **pontosan** `base`
  > 📌 **Implementációs eltérés — explicit `frames === 1` ág.** A terv a `frames = 1` esetre **bitre** `0.08`-at követel meg (regressziós horgony), a képlet viszont lebegőpontosan `1 - (1 - 0.08) = 0.07999999999999996`-ot ad — a horgony e nélkül megbukott volna. A megoldás egy **korai visszatérés** `frames === 1`-nél (`return base`): matematikailag azonos a képlettel, egyben gyorsút a leggyakoribb (60 Hz-es) esetre.
- [x] Bemenet-védelem a `frameRateAdjustedLerp`-ben: `base` a `[0, 1]`-re, `frames` a `[0, STAR_MAX_DELTA_FRAMES]`-re clampelve; nem véges bemenet → `base` (biztonságos fallback, sosem `NaN`)
- [x] `randomRollRadians(rand: number, maxDegrees: number): number` → `(rand - 0.5) * 2 * maxDegrees * Math.PI / 180` — **radiánt** ad vissza (a `ctx.rotate` úgyis azt kér, a hurokban ne legyen konverzió). A `rand` **paraméter**, nem belső `Math.random()`
- [x] Bemenet-védelem a `randomRollRadians`-ben: nem véges `rand` vagy `maxDegrees` → **`0`** (nincs forgás), sosem `NaN` — egy `NaN` szög a `ctx.rotate`-ben a **teljes** csillagmezőt eltüntetné
- [x] `getStretchFactor` **átköltöztetése** a `Starfield.tsx`-ből ide (tiszta áthelyezés, viselkedés változatlan) + export
- [x] `src/services/starColor.test.ts` — referenciaértékek (±2 tolerancia, `saturation = 1`): 6600 K → `(255,255,255)` · 5600 K → `(255,239,225)` · 15000 K → `(181,205,255)` · 8500 K → `(215,226,255)` · 6500 K → `(255,254,250)` · 4300 K → `(255,213,179)` · 3200 K → `(255,184,123)`
- [x] Teszt: a piros csatorna 6600 K-ig **végig 255**; a kék csatorna a hőmérséklettel **monoton nő**
- [x] Teszt: tartományon kívüli bemenet (`0`, `-100`, `1e9`, `NaN`, `Infinity`) → minden csatorna `0…255` közti **véges egész**
- [x] Teszt: `desaturateTowardWhite(x, 0)` → `(255,255,255)` bármely bemenetre; `saturation = 1` → identitás; `0.5` → felezőpont
- [x] Teszt: `SPECTRAL_CLASSES` súlyösszege `1` (lebegőpontos toleranciával), és **pontosan 6** elem
- [x] Teszt: `pickSpectralClass` határai — `0`→O/B, `0.0999`→O/B, `0.1`→A, `0.2999`→A, `0.3`→F, `0.5`→G, `0.7`→K, `0.9`→M, `0.99999`→M, `1`→M (őr)
- [x] `src/services/starfieldMath.test.ts` — `magnitudeFromRandom`: `0`→`0`, `1`→`1`, monoton, `0.5`→`≈0.1768`
- [x] Teszt: a magnitúdó **ferdesége** — determinisztikus (seeded LCG) mintán 10 000 elemre az érték **több mint 50%**-a `0.25` alatt van (ez a „kevés fényes, sok halvány" állítás gépi rögzítése)
- [x] Teszt: `subpixelAlphaScale` — `raw >= min` → `1`; `raw = min/2` → `0.25`; `raw = 0` → `0`; monoton növő
- [x] Teszt: `deltaFrames` — `16.667` → `≈1`; `6.944` (144 Hz) → `≈0.4167`; `5000` → **pontosan `3`** (clamp); `0` → `1`; `-5` → `1`; `NaN` → `1`
- [x] Teszt: `frameRateAdjustedLerp` — **`frames = 1` → pontosan a mai értékek**: `frameRateAdjustedLerp(0.08, 1) === 0.08`, és a lecsengésre `1 - frameRateAdjustedLerp(0.08, 1) === 0.92` (ez a regressziós horgony: 60 Hz-en bitre a mai viselkedés)
- [x] Teszt: `frameRateAdjustedLerp` határértékek — `frames = 0` → `0` (nincs elmozdulás); `frames = 2` → `1 - 0.92² = 0.1536` (**nem** `0.16`, tehát nem lineáris); monoton növő `frames`-ben; `frames → ∞` (a clamp felső határán) → `< 1`, sosem lépi túl
- [x] Teszt: `frameRateAdjustedLerp` védelem — `NaN` / `Infinity` / negatív `frames` → `base`, sosem `NaN`
- [x] Teszt: `randomRollRadians` tartomány — `rand = 0` → **pontosan** `-maxDegrees` radiánban; `rand = 1` → `+maxDegrees`; `rand = 0.5` → **pontosan `0`**; tetszőleges `rand ∈ [0,1]`-re `|eredmény| <= maxDeg * π/180`
- [x] Teszt: `randomRollRadians` **előjel-eloszlás** — determinisztikus (seeded LCG) mintán 10 000 elemre a negatív és pozitív szögek aránya `50% ± 2%` (azaz a pördülés **nem** részrehajló egyik irányba)
- [x] Teszt: `randomRollRadians` védelem — `NaN` / `Infinity` `rand` vagy `maxDegrees` → `0`
- [x] Teszt: `getStretchFactor` — `191`→`1.0`, `250`→`1.0`, `625`→`1.5`, `1000`→`2.0`, `5000`→`2.0`
- [x] ✅ **Ellenőrzési pont:** `npm run test` zöld, a `Starfield.tsx` még **nem** módosult — **63 új teszt**, mind zöld

**C. Konstansok — `src/constants/constants.ts`**

> 🎚️ **A hangolás folyamatban (K. blokk).** A felhasználó menet közben már átállított három értéket; a lenti tételek a terv **kiindulási** számait rögzítik, a `constants.ts` **jelenlegi** állása ettől eltér. Aktuális értékek: `STAR_COUNT = 1200` (a terv szerinti 400 helyett), `STAR_COLOR_SATURATION = 0.85` (0.65 helyett), `STAR_ROLL_MAX_DEGREES = 12` (6 helyett), `STAR_STREAK_LENGTH_FACTOR = 3` (változatlan). Ezek **nem véglegesek** — a K. blokk élő hangoló köre zárja le őket. Az indoklások (miért nem 1.0 a telítettség, miért visszafogott a roll) érvényben maradnak; a `12°` a 7.13-ban rögzített `4…12`-es sáv **teteje**, tehát a fáradás-ellenőrzés (9. szekció 12/f) kiemelten fontos.

- [x] `STAR_COLOR_SATURATION = 0.65` — JSDoc: miért nem 1.0 („diszkó-hatás", a szem a halványat fehérnek látja) *(jelenlegi érték: **0.85**, hangolás alatt)*
- [x] `STAR_MAG_EXPONENT = 2.5` — JSDoc: power-law, nagyobb kitevő → kevesebb fényes csillag
- [x] `STAR_MAG_SIZE_MIN = 0.45` / `STAR_MAG_SIZE_MAX = 1.35` — a magnitúdó méret-hatásának tartománya
- [x] `STAR_MAG_ALPHA_MIN = 0.25` / `STAR_MAG_ALPHA_MAX = 1.0` — a magnitúdó alfa-hatásának tartománya
- [x] `STAR_BASE_RADIUS_SCALE = 2.5` — a jelenlegi képletből kiemelt mágikus szám (viselkedés-semleges kiemelés)
- [x] `STAR_MIN_RADIUS_PX = 0.7` — JSDoc: az 1 px alatti kör aliasingot és mozgás közbeni „crawling"-ot okoz
- [x] `STAR_MAX_DEVICE_PIXEL_RATIO = 2` — JSDoc: 3-4× dpr-en a kitöltési ráta 9-16-szorosára nőne
- [x] `TARGET_FRAME_MS = 1000 / 60` — a delta-normalizálás alapja
- [x] `STAR_MAX_DELTA_FRAMES = 3` — JSDoc: tab-váltás után a rAF több másodperces ugrással tér vissza; enélkül a csillagok „kilőnének"
- [x] `STAR_STREAK_LENGTH_FACTOR = 3` — a `streakLen` képletéből kiemelt hardkódolt `* 3`. **Az érték `3`, tehát a kiemelés önmagában viselkedés-semleges.** JSDoc: ez a hangolási pont, ha a magnitúdó bevezetése után „kevesebb warp" az érzet (7.7) — emelés `4…4.5`-ig, **nem** a magnitúdó-hatás kivétele *(jelenlegi érték: **3**, változatlan)*
- [x] `STAR_DRIFT_SMOOTHING = 0.08` — az evasive drift képkockánkénti simítási tényezője. JSDoc: **egyetlen** konstans fedi a közelítést (`+= különbség * 0.08`), a lecsengést (`*= 0.92`) **és a forgatást**, mert a `0.92` épp az `1 - 0.08` — mindegyik „8% per képkocka". A `frameRateAdjustedLerp` ezt normalizálja
- [x] `STAR_ROLL_MAX_DEGREES = 6` — a kitérő manőver véletlen pördülésének **maximális** kitérése (`±6°`). JSDoc: **szubjektív, élőben hangolandó** érték; tudatosan visszafogott, mert ez egy AFK-játék, ahol a játékos **órákig** nézi a képernyőt — a nagy amplitúdójú pördülés kimerítő és rosszullétet okozhat. Hangolási sáv: `4…12` *(jelenlegi érték: **12**, a sáv teteje — hangolás alatt, lásd 7.13)*
- [x] `STAR_COUNT` és `STAR_SPEED` **értéke nem változik** — a `STAR_SPEED` JSDoc-ja viszont kiegészül: az egység mostantól „**60 FPS-re normalizált** képkockánkénti elmozdulás" *(⚠️ a `STAR_COUNT`-ot a felhasználó azóta `400`-ról **`1200`**-ra emelte a hangolás során — teljesítmény-következmény: 7.14)*

**D. Típus — `src/types/index.ts`**
- [x] A meglévő `Star` interface **változatlan** marad (`{ x, y, z }`)
- [x] Új: `RenderStar extends Star` — `r`, `g`, `b` (számok, `0…255`), `color` (előre épített `rgb(...)` string), `mag` (`0…1`)
- [x] Mindegyik új mezőhöz JSDoc, kiemelten a `color`-hoz: **osztályonként megosztott string-példány**, sosem épül újra
- [x] Kommentben rögzítve, **miért külön típus**: a `Star` publikus és visszafelé kompatibilis marad, a render-hurok pedig `??` fallbackek nélkül, kötelezően kitöltött mezőkkel dolgozik

**E. Szín bekötése — `Starfield.tsx`**
- [x] `createStar(logicalWidth, logicalHeight, colorTable): RenderStar` factory — a `setup` és a `resetStar` **közös** forrása
- [x] `resetStar` a **szín-, magnitúdó- és színstring-mezőket is újrasorsolja** (különben a mező idővel „befagyna" az induló eloszlásba)
- [x] A színtábla **egyszer** épül fel az effekt elején (`buildStarColorTable(STAR_COLOR_SATURATION)`), nem a `setup`-ban (a `setup` minden `resize`-nál újrafut)
- [x] `ctx.fillStyle = star.color` + `ctx.globalAlpha = alpha` — **a `rgba(...)` template literal mindkét helyről (kör és csík) eltűnik**
- [x] `ctx.strokeStyle = star.color` a warp-csíkra, ugyanazzal a `globalAlpha`-val
- [x] A csillag-hurok `ctx.save()` / `ctx.restore()` közt marad, **és a `restore()` a `globalAlpha`-t is visszaállítja** — a cockpit `drawImage` így garantáltan `alpha = 1`-en fut (lásd 7.5)
- [ ] ✅ **Ellenőrzési pont:** a mező színes, a cockpit **nem** áttetsző, a warp-csíkok a csillag saját színét kapják

**F. Magnitúdó**
- [x] `star.mag = magnitudeFromRandom(Math.random())` a `createStar`-ban
- [x] `magSize = lerp(STAR_MAG_SIZE_MIN, STAR_MAG_SIZE_MAX, star.mag)` — a sugár szorzója
- [x] `magAlpha = lerp(STAR_MAG_ALPHA_MIN, STAR_MAG_ALPHA_MAX, star.mag)` — az opacitás szorzója
- [x] A `mag` **külön skálázza** a méretet és az alfát (nem ugyanazzal a szorzóval — a közös szorzó a halvány csillagokat láthatatlanná tenné)
- [ ] ✅ **Ellenőrzési pont:** a mező már nem egyenletesen szemcsés; kivehető néhány domináns fényes csillag

**G. Subpixel-clamp**
- [x] `rawRadius = depth * STAR_BASE_RADIUS_SCALE * magSize` (a régi `Math.max(0.1, …)` **eltűnik**)
- [x] `radius = Math.max(rawRadius, STAR_MIN_RADIUS_PX)`
- [x] `alpha = depthOpacity * magAlpha * subpixelAlphaScale(rawRadius, STAR_MIN_RADIUS_PX)`
- [x] A warp-csík `lineWidth`-e a **clampelt** `radius`-ból számol (`radius * 2` ≥ 1.4 px) — a csík is elveszti a subpixel-villogást
- [x] A csík ugyanazt az `alpha`-t kapja, mint a pont (a subpixel-korrekció is beleértve)
- [x] A `streakLen` képletében a hardkódolt `* 3` **kicserélve** `* STAR_STREAK_LENGTH_FACTOR`-ra — a képlet többi tényezője (`stretchFactor`, `lateralFactor`, `depthFactor²`) **változatlan**
- [ ] ✅ **Ellenőrzési pont:** lassú mozgás közben nincs pattogó szemcsézés; a legtávolabbi csillagok halványak, de **stabilak**; a warp `STAR_STREAK_LENGTH_FACTOR = 3` mellett vizuálisan a magnitúdó-hatással együtt értékelendő (9. szekció 11. tétel)

**H. Framerate-függetlenség**
- [x] A `draw` **megkapja a rAF időbélyegét**: `const draw = (now: number) => { … }`
- [x] ⚠️ Az induló, kézi `draw()` hívás → **`draw(performance.now())`** — enélkül `now === undefined`, a delta `NaN`, a `z` `NaN`, és a mező **véglegesen eltűnik** (`NaN <= 0` hamis, tehát a `resetStar` sem fut le). Lásd 7.4
- [x] `let lastFrameTime = 0;` az effekt scope-jában
- [x] `const frames = deltaFrames(lastFrameTime === 0 ? 0 : now - lastFrameTime);` majd `lastFrameTime = now;`
- [x] `star.z -= STAR_SPEED * frames;`
- [x] A `lastFrameTime` **szünet alatt is frissül** (a rAF nem áll le `isPaused` esetén), tehát a szünet feloldásakor nincs ugrás
- [x] **Az evasive drift lecsengése is normalizálva** — `const k = frameRateAdjustedLerp(STAR_DRIFT_SMOOTHING, frames);` **egyszer** kiszámolva a drift-ág elején (nem ágtól függően kétszer)
- [x] Közelítő ág: `driftX += (driftTargetX - driftX) * k;` (ugyanígy `driftY`) — a mai `* 0.08` helyén
- [x] Lecsengő ág: `driftX *= 1 - k;` (ugyanígy `driftY`) — a mai `*= 0.92` helyén. `frames = 1` esetén ez **pontosan** `* 0.92`
- [x] ⚠️ **Nem** normalizálandó: a drift **iránya** (`(Math.random() - 0.5) * 40`), a **kiváltása** (`evasiveManeuverAt` összehasonlítás) és az **időtartama** (`now + 1000 + random * 2000`) — ezek `Date.now()`-alapúak, tehát eleve fps-függetlenek, és a felhasználó szerint nem változhatnak
- [x] ⚠️ Ez az **egyetlen** tétel a tervben, ami **szándékosan megváltoztat** egy meglévő, megszokott viselkedést: 60 Hz felett a lecsengés lassabbnak fog tűnni, mint eddig (mert eddig fps-arányosan gyorsult). A felhasználó ezt tudatosan vállalta — lásd 7.10
- [x] A `k` kiszámítása **egy** helyen történjen, mert a következő (I.) blokk a forgatáshoz **ugyanezt a `k`-t** használja
- [ ] ✅ **Ellenőrzési pont:** 144 Hz-en és 60 Hz-en **azonos** a látszólagos sebesség; 30 mp-es tab-váltás után nincs csillag-„kilövés"; az evasive drift lecsengése **60 Hz-en bitre a régi**, magasabb frekvencián pedig ugyanolyan **időtartamú** (nem ugyanolyan képkockaszámú)

**I. Kitérő manőver — forgatás (roll)** *(6. munkacsomag; a H-ra épül, a HiDPI-t megelőzi)*
- [x] `STAR_ROLL_MAX_DEGREES` felvéve a C. blokkban (`6`, szubjektív kiindulás) *(jelenlegi érték: **12**, hangolás alatt)*
- [x] `let roll = 0; let rollTarget = 0;` az effekt scope-jában, a `driftX` / `driftY` / `driftTarget*` mellé
- [x] A **meglévő** trigger-ágban (`evasiveManeuverAt !== lastEvasiveTrigger`), a `driftTargetX/Y` sorsolása mellé: `rollTarget = randomRollRadians(Math.random(), STAR_ROLL_MAX_DEGREES);`
- [x] ⚠️ A `rollTarget` **nem** függhet a `driftTargetX`-től — ez a **független, véletlen pördülés** lényege. A `driftTargetX` előjelének átvétele **banking** lenne, amit a felhasználó elutasított (Döntések tábla, 8.5)
- [x] **Nincs új időzítő:** a forgás ugyanabban a `now < driftEndTime` ágban él, mint a drift
- [x] Közelítő ág: `roll += (rollTarget - roll) * k;` — **ugyanaz a `k`**, amit a H. blokk kiszámolt
- [x] Lecsengő ág: `roll *= 1 - k;` — a drifttel **együtt** cseng le, ugyanolyan ütemben
- [x] `ctx.rotate(roll)` a meglévő `ctx.save()` / `ctx.translate(...)` **UTÁN**, a csillag-hurok **előtt** — a forgás középpontja így a drift által eltolt origó (transzformációs sorrend: 1.10)
- [x] ⚠️ A cockpit `drawImage` a `ctx.restore()` **után** marad, ahogy ma is — **a pilótafülke soha nem forog** (ez a vonatkoztatási rendszer lényege)
- [x] **A streak drift-kompenzáció javítása** — a képkockánként **egyszer**, a hurok előtt kiszámolt ellenforgatott drift-vektor: `const cosR = Math.cos(roll), sinR = Math.sin(roll); const driftXr = driftX * cosR + driftY * sinR; const driftYr = -driftX * sinR + driftY * cosR;`
- [x] Az `actualDist` képletében `driftX` / `driftY` **helyett** `driftXr` / `driftYr` (levezetés és indoklás: 1.10.2, kockázat: 7.11)
- [x] `cosR` / `sinR` a hurok **előtt**, nem csillagonként — 2 trigonometrikus hívás/képkocka, nem 800
- [x] ⚠️ **Nem** kerül új mező a `Star` / `RenderStar` típusba — a roll képernyőtér-transzformáció, nem per-csillag adat
- [ ] Vizuális ellenőrzés a sarkokra: elforgatott mezőnél nem ritkul-e ki láthatóan a kép széle (elemzés: 7.12). **Alapesetben nincs teendő**; ha mégis látszik, a 7.12 tartalék-megoldását kell alkalmazni
- [ ] ✅ **Ellenőrzési pont:** a kitérés „manővernek" hat, nem csúszkálásnak; a fülke **áll**, a mező forog; a warp-csíkok a forgás alatt is **kifelé/befelé** mutatnak (a kompenzáció nem tört el); a forgás a drifttel **együtt** indul és együtt cseng le

**J. HiDPI átvezetés** ⚠️ *a terv legkockázatosabb blokkja — külön commit*
- [x] `const getDpr = () => Math.min(window.devicePixelRatio || 1, STAR_MAX_DEVICE_PIXEL_RATIO);`
- [x] `let dpr = 1; let logicalWidth = 0; let logicalHeight = 0;` az effekt scope-jában, mindhármat a `resizeCanvas` állítja
- [x] `resizeCanvas`: `logicalWidth = innerWidth`, `logicalHeight = innerHeight`, `dpr = getDpr()`
- [x] `canvas.width = Math.round(logicalWidth * dpr)` / `canvas.height = Math.round(logicalHeight * dpr)`
- [x] `canvas.style.width/height` **CSS pixelben marad** (`${logicalWidth}px`) — változatlan
- [x] ⚠️ `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)` **a `canvas.width` írása UTÁN** — a méret írása nullázza a context transzformációját (lásd 7.1). `setTransform`, **nem** `scale` (idempotens)
- [x] ⚠️ **Ütközési pont az I. blokkal:** mindkét blokk **ugyanazt** a `save` / `translate` / `restore` szakaszt írja. A `setTransform(dpr…)` a `resizeCanvas`-ban él, tehát a `draw()`-ban a `save()` **már a dpr-alaptranszformációt menti el** — a `translate` és a `rotate` ezután, **változatlan sorrendben** rakódik rá. A teljes verem: `setTransform(dpr)` → `save` → `translate(közép + drift)` → `rotate(roll)` → csillagok → `restore` → cockpit (1.10.1)
- [x] Ellenőrzés: a `ctx.rotate(roll)` hívás **nem** kap dpr-korrekciót — a forgatás szögmennyiség, a skálázás nem hat rá (a `translate` viszont logikai koordinátát kap, lásd a 3.2 tábla 13. tételét)
- [x] **A 3.2 tábla mind a 16 tételének** tételes átvezetése `canvas.width/height` → `logicalWidth/logicalHeight`
- [x] Ellenőrzés grepnel: a `draw()` és a `setup()` törzsében **nulla** `canvas.width` / `canvas.height` előfordulás marad (csak a `resizeCanvas`-ban van joga szerepelni)
- [x] A `onCanvasBoundsChange` (`getBoundingClientRect`) **változatlan** — az CSS px-ben ad vissza, a HUD-pozicionálás nem érintett
- [ ] ✅ **Ellenőrzési pont:** dpr 1 és dpr 2 mellett a csillagok **azonos látszólagos méretűek és sebességűek**, csak élesebbek; a cockpit kép éles és pontosan ugyanúgy fed

**K. Validáció + hangolás**
- [x] `tsc --noEmit` hibamentes
- [x] `npm run test` zöld (a meglévő tesztek + az új helper-tesztek) — **147/147 zöld, 9 tesztfájl** (ebből 63 az új helper-teszt)
- [x] `npm run build` sikeres
- [ ] A 9. szekció **mind a 12 kézi forgatókönyve** lefuttatva
- [ ] DevTools Performance: 400 csillag, dpr 2, frame time az A. blokk referenciájához mérve; **a GC-fűrészfog lapos** (nincs per-frame allokáció)
  > ⚠️ **A mérést `STAR_COUNT = 1200`-zal kell elvégezni, nem 400-zal.** A felhasználó a hangolás során megháromszorozta a csillagszámot, a 4.5 költségvetés viszont 400-ra készült — a profil tehát **nem** a tervezett terhelést méri, hanem annak háromszorosát. Mérési feltétel: **1200 csillag, dpr 2, warpban** (1000 km/s). Részletek és a teendő, ha kifut a 16.6 ms-ból: **7.14**. Az A. blokk referencia-profilja hiányzik, ezért abszolút küszöbhöz (16.6 ms) kell mérni, nem különbséghez.
- [ ] **Élő hangoló kör a felhasználóval — három paraméter, egy menetben:** `STAR_COLOR_SATURATION`, `STAR_STREAK_LENGTH_FACTOR`, `STAR_ROLL_MAX_DEGREES`. Mindhárom szubjektív, és **egymásra is hatnak** (a színesebb csík máshogy hat, mint a fehér; a hosszabb csík forgás közben látványosabb)
  > 🎚️ **A kör elindult, de nincs lezárva.** A felhasználó eddig: `STAR_COLOR_SATURATION` `0.65 → 0.85`, `STAR_ROLL_MAX_DEGREES` `6 → 12`, `STAR_STREAK_LENGTH_FACTOR` `3` (változatlan), és a hangoláshoz `STAR_COUNT` `400 → 1200`. **Egyik érték sem végleges**, és egyik JSDoc sem rögzíti még a döntést.
- [ ] `STAR_COLOR_SATURATION`: `0.4` / `0.65` / `1.0` összevetése a futó játékban, a végleges érték rögzítése a JSDoc-ban *(jelenleg **0.85**-ön áll)*
- [ ] `STAR_STREAK_LENGTH_FACTOR`: az A. blokk warp-baseline képernyőképéhez viszonyítva. Ha „kevesebb warp" az érzet → emelés `4…4.5`-ig; a végleges érték rögzítése a JSDoc-ban *(⚠️ **a warp-baseline nincs meg** — az A. blokk kimaradt, tehát ezt abszolút megítéléssel kell eldönteni)*
- [ ] `STAR_ROLL_MAX_DEGREES`: `4` / `6` / `10` összevetése **valódi esemény közben** (aszteroida-triggerrel, nem debug-gombbal, hogy a kontextus is meglegyen). A végleges érték rögzítése a JSDoc-ban *(jelenleg **12**-n áll, a 7.13 sávjának tetején — az összevetésbe ezt is bele kell venni)*
- [ ] ⚠️ A roll hangolásánál **hosszabb ülést** kell szimulálni (több egymást követő esemény), nem egyetlen manővert — a fáradás/rosszullét csak ismétlésnél derül ki (7.13)
- [ ] Ha a mező összességében sötétebb lett a magnitúdó + subpixel miatt: `STAR_BASE_RADIUS_SCALE` vagy `STAR_MAG_ALPHA_MIN` finomhangolása (lásd 7.6)

**L. Ellenőrzött nem-tételek (tudatosan kimaradó hatókör)**
- [x] Ellenőrizve: **nulla új i18n kulcs**, a paritás változatlan (6. szekció) — az `src/i18n/locales/**` fájlok egyike sem módosult
- [x] Ellenőrizve: a `getStretchFactor` warp-viselkedés számszerűen változatlan (csak átköltözött) — regressziós teszttel fedve (B. blokk, 4 töréspont)
- [ ] Ellenőrizve: az evasive drift **iránya, kiváltása és 1-3 mp-es időtartama** változatlan; a **lecsengés** viszont tudatosan delta-normalizált (H. blokk, 7.10) — 60 Hz-en bitre azonos, afölött időarányos
  > A tétel **fele gépileg igazolt**: a 60 Hz-es bit-azonosságot a `frameRateAdjustedLerp(0.08, 1) === 0.08` regressziós teszt rögzíti, az irány/trigger/időtartam pedig kódszinten `Date.now()`-alapú maradt. A **60 Hz feletti időarányosság** viszont csak stopperrel mérhető (9. szekció 6. forgatókönyve), ezért a tétel a kézi kör lezárásáig bejelöletlen marad.
- [x] Ellenőrizve: a forgás **független, véletlen pördülés** — nincs `driftTargetX`-hez kötött banking (8.5)
- [ ] Ellenőrizve: a **cockpit kép nem forog** és nem is torzul; a `drawImage` a `restore()` után maradt *(a kódszerkezet helyes — a `drawImage` a `restore()` után van —, de a „nem torzul" csak szemmel igazolható)*
- [x] Ellenőrizve: a `Star` / `RenderStar` típus **nem** kapott roll-hoz kapcsolódó mezőt
- [x] Ellenőrizve: **nem jött létre `src/utils/` mappa**; az új modulok a `src/services/`-ben vannak
- [x] Ellenőrizve: nincs háttérréteg / Tejút / nebula, nincs twinkle, nincs mozgásvektoros csík (8. szekció)

---

## 1. Architektúra

### 1.1 A jelenlegi felállás

A `Starfield.tsx` (~247 sor) **egyetlen `useEffect`**-ben tart mindent: canvas-méretezés, csillag-setup, evasive drift állapot és a rAF-hurok. Az effekt függősége mindössze `[cockpitImageUrl]`; a változó adatok (`isPaused`, `speedKmPerSecond`, `evasiveManeuverAt`, `onCanvasBoundsChange`) **ref-eken** jutnak be, hogy a hurok ne induljon újra. Ez a minta jó, és **nem változik**.

A hurok minden képkockán: fekete `fillRect` → drift frissítés → `translate` a középpontba → csillag-hurok → `restore` → cockpit `drawImage`.

### 1.2 A cél-felállás

```
src/services/starColor.ts       ─┐
  kelvinToRgb                    │  tiszta függvények, canvas nélkül
  desaturateTowardWhite          │  → Vitesttel teljesen tesztelhetők
  SPECTRAL_CLASSES               │
  pickSpectralClass              │
  buildStarColorTable           ─┤
src/services/starfieldMath.ts   ─┤
  magnitudeFromRandom            │
  subpixelAlphaScale             │
  deltaFrames                    │
  frameRateAdjustedLerp          │
  randomRollRadians              │
  getStretchFactor              ─┘
             │
             ▼
src/components/ui/Starfield.tsx  (csak a canvas-vezérlés marad)
  effekt-scope: colorTable (1×), dpr, logicalWidth/Height, lastFrameTime,
                drift-állapot (driftX/Y, driftTarget*, roll, rollTarget)
  createStar()  ──▶ RenderStar  (szín + magnitúdó egyszer, létrehozáskor)
  draw(now)     ──▶ delta → drift + roll → transzformáció → z-léptetés →
                    projekció → alfa → rajzolás
```

A megosztás elve: **ami tiszta függvény, az kikerül és tesztelhető; ami canvas-állapot, az marad**. Ez a `Starfield.tsx`-et nagyjából a jelenlegi méreten tartja (a színkód nem kerül bele), és a K. blokk validációjának nagy részét gépesíti.

> **Miért a `src/services/` és miért nem egy új `src/utils/`.** A projektben nincs `utils` top-level mappa, és nem is kell: a `src/services/` **pontosan ezt a réteget** jelenti — keretrendszer-független, tiszta domain-modulok kolokált teszttel (`faceRecognition.ts` + `faceRecognition.test.ts`, `cameraPermission.ts`). Egy párhuzamos „utils" mappa csak annyit érne el, hogy két helyen kellene keresni ugyanazt a fajta kódot. (A `src/state/utils.ts` egy store-specifikus segédfüggvény, nem precedens új mappára.)

### 1.3 A csillag életciklusa

```
setup() / resize
   └─▶ createStar(logicalWidth, logicalHeight, colorTable)   ×STAR_COUNT
         ├── x, y  : (rand-0.5) * logikai méret
         ├── z     : rand * logicalWidth
         ├── klasszis = pickSpectralClass(rand)          ─┐
         ├── r,g,b = colorTable[klasszis].rgb             │ EGYSZER,
         ├── color = colorTable[klasszis].css  (megosztott string)  soha nem
         └── mag   = magnitudeFromRandom(rand)           ─┘ képkockánként

draw(now)  ── minden képkocka ──▶
         z -= STAR_SPEED * deltaFrames(now - last)
         z <= 0  ─▶ resetStar()  ─▶ ÚJRA teljes sorsolás (szín + mag is!)
         depth       = (logicalWidth - z) / logicalWidth
         rawRadius   = depth * STAR_BASE_RADIUS_SCALE * magSize(mag)
         radius      = max(rawRadius, STAR_MIN_RADIUS_PX)
         alpha       = depth * magAlpha(mag) * subpixelAlphaScale(rawRadius, MIN)
         fillStyle   = star.color        (string, nem épül)
         globalAlpha = alpha             (szám, nem épül)
```

**Miért sorsol a `resetStar` is újra színt és magnitúdót:** ha csak a pozíciót állítaná vissza, a mező néhány perc alatt „befagyna" az induló eloszlásba — a fényes csillagok mindig ugyanazok maradnának, ugyanabban a színben, csak más pozícióban. A folyamatos újrasorsolás tartja élettel a mezőt. Ez a mostani kódhoz képest annyi többlet, hogy a `resetStar` a `createStar`-t hívja (mezőnkénti értékadással, hogy ne allokáljon új objektumot — lásd 4.3).

### 1.4 Színhőmérséklet — a modell

A feketetest-sugárzó látszólagos színe a hőmérsékletétől függ. A **Tanner Helland-közelítés** csatornánként egy-egy zárt képlet `t = kelvin / 100` felett:

```
piros  : t <= 66 ? 255 : 329.698727446 * (t - 60) ** -0.1332047592
zöld   : t <= 66 ? 99.4708025861 * ln(t) - 161.1195681661
                 : 288.1221695283 * (t - 60) ** -0.0755148492
kék    : t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * ln(t - 10) - 305.0447927307
```

Minden csatorna `0…255`-re clampelve, `Math.round`-dal egészre. A 6600 K a „fehérpont": ott mindhárom csatorna 255.

**Miért nem a valódi tömegfüggvény szerinti eloszlás.** A Galaxis csillagainak kb. 76%-a M törpe, de azok szabad szemmel **egyetlen darabig sem** láthatók — nulla darab van belőlük az égen látható ~6000 csillag között meghatározó arányban. Egy „fizikailag korrekt" eloszlás tehát a képernyőn **hibás** eredményt adna: majdnem minden csillag vörös lenne. A választott eloszlás a **látható** égboltot közelíti, ahol a forró, fényes osztályok felülreprezentáltak.

**Miért kell a telítettség-szorzó.** A nyers blackbody RGB (`saturation = 1`) a szélső osztályoknál erős — a 3200 K mélynarancs, a 15000 K határozott kék. Egy 400 elemű mezőben ez „diszkós". A valós égen a szem a halvány csillagokat a szkotopikus látás miatt **közel fehérnek** érzékeli, a szín csak a legfényesebbeknél tűnik ki (Betelgeuse, Antares vörös; Rigel, Spica kék). A `STAR_COLOR_SATURATION` a fehér felé interpolál:

```
csatorna_végleges = 255 + (csatorna_nyers - 255) * STAR_COLOR_SATURATION
```

Alapérték: **0.65**. A K. blokk hangolja élőben. `0` → az összes csillag fehér (a mai állapot), `1` → nyers blackbody. *(A hangolás elindult: a `constants.ts`-ben jelenleg **0.85** áll — nem végleges, lásd K. blokk.)*

> 📌 **Implementációs eltérés (megvalósítva) — kerekített kumulatív spektrál-súlyok.** A `pickSpectralClass` az osztályhatárokat a súlyok kumulatív összegéből képzi. A naiv összegzés lebegőpontos maradékot hagy (`0.1 + 0.2 = 0.30000000000000004`), ami a `rand = 0.3` bemenetet még az **A** osztályba sorolta volna a terv szerinti **F** helyett — pontosan az a határérték, amit a B. blokk tesztje rögzít. A kumulatív értékek ezért lépésenként kerekítve épülnek (`Math.round(x * 1e6) / 1e6`), így a határok a táblázatbeli számokon (`0.1`, `0.3`, `0.5`, `0.7`, `0.9`) fekszenek.

> **Lehetséges további finomítás (most kimarad):** a telítettséget a magnitúdóhoz kötni (`saturation * mag`), hogy csak a fényes csillagok legyenek színesek — pontosan úgy, ahogy a szem működik. Ez viszont **per-csillag** színt jelentene, ami elveszítené a 4.3-ban leírt 6 megosztott string előnyét. Ha valaha kell, a megoldás egy kvantált tábla (6 osztály × N telítettségi lépcső = 6N előre épített string), nem a per-frame string-építés.

### 1.5 Magnitúdó

Ma minden csillag azonos abszolút fényességű, csak a `z` különbözteti meg őket. Ettől a mező **egyenletesen szemcsés**: nincs benne hierarchia, a szem nem talál fogódzót.

A valós égen a fényesség-eloszlás erősen ferde: kevés nagyon fényes csillag és rengeteg halvány. Ezt a `Math.random() ** 2.5` közelíti — a `[0,1)` egyenletes eloszlást a 0 felé húzza, tehát az `1`-hez közeli (fényes) értékek ritkák lesznek.

A `mag` **két külön csatornán** hat:

| Hatás | Képlet | Tartomány |
|---|---|---|
| Méret | `lerp(STAR_MAG_SIZE_MIN, STAR_MAG_SIZE_MAX, mag)` | 0.45× … 1.35× |
| Opacitás | `lerp(STAR_MAG_ALPHA_MIN, STAR_MAG_ALPHA_MAX, mag)` | 0.25× … 1.0× |

**Miért két külön tartomány és nem egy közös szorzó:** ha ugyanaz a `0.25…1` szorzó menne a méretre és az alfára is, a halvány csillagok egyszerre lennének nagyon kicsik **és** nagyon áttetszők — a szorzatuk gyakorlatilag láthatatlan. A méret alsó korlátja ezért lényegesen magasabb (0.45).

### 1.6 Subpixel-villogás

A mai `r = Math.max(0.1, …)` **0.1 px sugarú** köröket is rajzol. Egy 0.1 px sugarú `arc` a canvasban nem tűnik el, hanem az antialiasing egy alig látható, **a pixelrácshoz képest véletlenszerűen elhelyezkedő** foltot ad. Amint a csillag mozog, a folt intenzitása képkockánként ugrál — ez a mozgás közbeni „crawling" / pattogó szemcsézés.

A megoldás **energiamegőrző**: a sugarat 0.7 px-nél megfogjuk (ekkora korong már stabilan fedi a pixelt), és a „kimaradt" fényt az alfából vonjuk le, terület-arányosan:

```
rawRadius < 0.7  ─▶  radius = 0.7,  alpha *= (rawRadius / 0.7) ** 2
```

A négyzet azért helyes, mert a korong területe (és így a kibocsátott „fény") a sugár négyzetével arányos. Az így kapott folt **összenergiája** megegyezik az eredetivel, de stabil pozícióban és stabil intenzitással.

Ugyanez érvényes a **warp-csíkra**: a `lineWidth = r * 2` mai képlete 0.2 px vastag vonalat is előállíthat. A csík a clampelt `radius`-t használja (≥ 1.4 px `lineWidth`), és ugyanazt a korrigált alfát.

### 1.7 HiDPI

Lásd a 3. szekciót — ez a terv legrészletesebben leírt és legkockázatosabb része.

### 1.8 Delta-idő

A `star.z -= STAR_SPEED` képkockánként fix. 60 Hz-en 3 egység/mp, 144 Hz-en 7.2 — a csillagmező **2.4×** gyorsabb. Az AFK-játék jellege miatt ez nem apró kozmetikai eltérés: a hajó „sebességérzete" monitorfüggő.

```
frames = deltaFrames(now - lastFrameTime)      // 60 FPS-re normalizálva
star.z -= STAR_SPEED * frames
```

Két peremeset:

1. **Első képkocka** — nincs előző időbélyeg. A `deltaFrames` a `<= 0` bemenetre `1`-et ad, tehát a hívó nyugodtan `0`-t ad át, ha `lastFrameTime === 0`. Nincs külön elágazás a hurokban.
2. **Tab-váltás** — a böngésző felfüggeszti a rAF-ot, majd egy több másodperces ugrással tér vissza. Clamp nélkül a `frames` értéke 100+ lenne, és a mező egyetlen képkockán „kilőne". A `STAR_MAX_DELTA_FRAMES = 3` ezt megfogja: a maximum lemaradás 3 képkockányi haladás.

> A `deltaFrames` **nem** tesz különbséget „valódi lassulás" és „tab-váltás" közt, és nem is kell: 3 képkockányi (50 ms) ugrás vizuálisan észrevehetetlen, egy 10 FPS-re beszakadó gépnél pedig pontosan a helyes viselkedés.

### 1.9 Az evasive drift lecsengésének normalizálása

Az evasive drift **ugyanattól a betegségtől szenved**, mint a `star.z`: a simítás képkockánként fix arányú.

```
közelítés:  driftX += (driftTargetX - driftX) * 0.08
lecsengés:  driftX *= 0.92
```

Mindkettő „8% per **képkocka**", tehát 144 Hz-en a drift 2.4-szer annyi lépést tesz meg ugyanannyi idő alatt — a lecsengés látványosan gyorsabb. Ezért kapja meg ugyanazt a normalizálást:

```
k = frameRateAdjustedLerp(STAR_DRIFT_SMOOTHING, frames)   // 1 - (1 - base) ** frames
közelítés:  driftX += (driftTargetX - driftX) * k
lecsengés:  driftX *= 1 - k
```

**Miért `1 - (1 - base) ** frames` és nem `base * frames`.** Az exponenciális simítás képkockánként a *maradék* egy hányadát veszi el, tehát két képkocka hatása nem `2 × 8%`, hanem `1 - 0.92² = 15.36%`. A lineáris szorzás nem csak pontatlan lenne, hanem `frames > 12.5` felett **túllőne** (`k > 1`, azaz oszcilláló drift). A hatványos alak `frames`-től függetlenül a `[0, 1)` intervallumban marad — matematikailag lehetetlenné teszi a túllövést.

**`frames = 1` esetén az eredmény bitre a mai:** `1 - (1 - 0.08)¹ = 0.08`, és `1 - 0.08 = 0.92`. A B. blokk tesztje épp ezt az azonosságot rögzíti — ez a regressziós horgony arra, hogy 60 Hz-en semmi nem változott.

> 📌 **Implementációs eltérés (megvalósítva).** A fenti azonosság **matematikailag** igaz, **lebegőpontosan viszont nem**: `1 - (1 - 0.08)` a IEEE-754 dupla pontosságban `0.07999999999999996`, nem `0.08`. A bit-egyenlőséget megkövetelő regressziós teszt tehát a képlet szó szerinti implementációjával **megbukott** volna. A `frameRateAdjustedLerp` ezért **explicit korai visszatérést** kapott `frames === 1` esetén (`return base`) — matematikailag azonos a képlettel, egyben gyorsút a leggyakoribb, 60 Hz-es esetre. A horgony így valóban bitre pontos.

> ⚠️ **Ez a terv egyetlen szándékos viselkedés-változtatása.** Az eredeti megkötés az volt, hogy „az evasive drift működése nem változhat"; a felhasználó ezt **felülírta**, mert a fps-függő lecsengés önmagában is hiba. A vállalt következmény: 60 Hz **felett** a lecsengés lassabbnak fog *tűnni* — valójában viszont ugyanannyi ideig tart, mint 60 Hz-en, ami a helyes viselkedés. Részletek: 7.10.

**Amit a normalizálás NEM érint** (mert `Date.now()`-alapú, tehát eleve fps-független): a drift **iránya** (`(Math.random() - 0.5) * 40`), a **kiváltása** (az `evasiveManeuverAt` összehasonlítás) és az **időtartama** (`now + 1000 + Math.random() * 2000`, azaz 1-3 mp).

### 1.10 Kitérő manőver — forgatás (roll)

**A probléma:** a mai kitérő manőver **tisztán eltolódás** — a mező oldalra csúszik, majd visszatér. Ez „csúszkálásnak" hat, nem manőverezésnek. Hiányzik belőle a hajó **saját tengely körüli** elmozdulása.

**A megoldás:** a csillagmező elfordul a képernyő (drifttel eltolt) középpontja körül, **miközben a pilótafülke áll**.

#### 1.10.1 Vonatkoztatási rendszer és transzformációs sorrend

A játékos a hajóban ül; a fülke az ő vonatkoztatási rendszere, ezért **soha nem mozdul**. Ami elfordul, az a külvilág. Ez nem stilisztikai döntés, hanem a fizikailag helyes nézőpont — és egyben a legolcsóbb is: a cockpit `drawImage` a mai helyén marad, a transzformációs blokkon **kívül**.

A teljes verem, a HiDPI-vel együtt (a `J.` blokk ezt a szakaszt is írja — ütközési pont):

```
resizeCanvas():
  canvas.width = round(logicalWidth * dpr)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)     (1) HiDPI-alap — a resize-ban ragad meg

draw(now):
  ctx.fillRect(0, 0, logicalWidth, logicalHeight)   // az (1) alaptranszformációval
  ctx.save()                                  (2) az (1) elmentése
  ctx.translate(logicalWidth/2  + driftX,
                logicalHeight/2 + driftY)     (3) drift — logikai koordináta!
  ctx.rotate(roll)                            (4) ÚJ — forgatás a driftelt origó körül
  … csillag-hurok (pontok + warp-csíkok) …
  ctx.restore()                               (5) vissza az (1) alapra
  ctx.drawImage(cockpit, …)                   (6) FIX pilótafülke — soha nem forog
```

Két dolog, amit nem szabad felcserélni:

- **A `rotate` a `translate` UTÁN.** Fordítva a mező a képernyő eredeti közepe körül forogna, a drift pedig a *forgatott* tengelyek mentén tolna el — a manőver iránya kiszámíthatatlanná válna.
- **A `drawImage` a `restore()` UTÁN.** Ha bekerülne a blokkba, a fülke együtt forogna és csúszna a mezővel — pontosan az ellenkezője a szándéknak, ráadásul a kép sarkai kilógnának a képernyőről.

A `rotate` **nem kap dpr-korrekciót**: a szög skálafüggetlen mennyiség. Csak a `translate` kap logikai koordinátát (a 3.2 tábla 13. tétele).

#### 1.10.2 A streak drift-kompenzáció javítása

Ez a forgatás **egyetlen nem magától értetődő** következménye.

A mai `actualDist` a csillagnak a **képernyő tényleges közepétől** mért távolságát számolja, hogy a warp-csíkok a drift alatt is a valódi középpont felé mutassanak:

```
actualDist = √((sx + driftX)² + (sy + driftY)²)
```

Ez ma azért helyes, mert a rajzolási origó `(cx + driftX, cy + driftY)`, tehát a képernyő közepe a lokális rendszerben `(-driftX, -driftY)`-nál van — a csillagtól mért különbségvektor pedig `(sx + driftX, sy + driftY)`.

**Forgatás után ez eltörik.** A `rotate(roll)` miatt a lokális rendszer el van fordítva, a `driftX` / `driftY` viszont a **képernyő** rendszerében értendő. A kettő közvetlen összeadása kevert bázisú, tehát hibás távolságot ad. A hiba nem elméleti: a csíkok a forgás alatt egy hamis középpont felé mutatnának, és a `lateralFactor` hol túl-, hol alulbecsülné a hosszukat — a warp „szétesne" pont abban a pillanatban, amikor a legjobban látszik.

**A megoldás: a drift-vektor ellenforgatása** a lokális bázisba, `R(-roll)`-lal:

```
cosR = cos(roll);  sinR = sin(roll)
driftXr =  driftX * cosR + driftY * sinR
driftYr = -driftX * sinR + driftY * cosR

actualDist = √((sx + driftXr)² + (sy + driftYr)²)
```

`roll = 0` esetén `cosR = 1`, `sinR = 0`, tehát `driftXr = driftX` és `driftYr = driftY` — **a képlet visszaadja a mait**. A változtatás ezért forgás nélkül bizonyíthatóan viselkedés-semleges.

**Költség:** `cosR` / `sinR` képkockánként **egyszer**, a hurok előtt. Csillagonkénti kiszámításuk 400 × 2 = 800 trigonometrikus hívás lenne képkockánként — ezt a hurokba engedni tipikus, könnyen elkövethető hiba.

> **Az elvetett alternatíva:** a csíkot a forgatatlan képernyőtérben rajzolni (külön `save`/`restore` a csík köré). Ez két transzformáció-váltást jelentene **csillagonként** — nagyságrenddel drágább, és szétszakítaná a hurok egységes rajzolási állapotát. Az ellenforgatás négy szorzás és két összeadás; nincs verseny.

#### 1.10.3 Miért független, véletlen pördülés

A kézenfekvő alternatíva a repülőgépszerű **bedőlés** lett volna: a forgás előjelét és mértékét a `driftTargetX`-ből származtatni, ahogy egy gép bedől a kanyarba. A felhasználó ezt **kifejezetten elutasította** — az kontrollált, elegáns manővert sugallna. A szándékolt érzet ezzel szemben a **találat / súrolás**: valami eltalálta a hajót, az megpördült, a pilóta korrigál. Ehhez a forgásnak a kitérés irányától **függetlennek** kell lennie.

Gyakorlatilag: `rollTarget = randomRollRadians(Math.random(), STAR_ROLL_MAX_DEGREES)` — saját, független sorsolás, előjel-semlegesen (a B. blokk tesztje az 50/50 előjel-eloszlást rögzíti). Részletes indoklás és a „ne javítsd vissza" figyelmeztetés: 8.5.

#### 1.10.4 Trigger, élettartam, simítás — mind közös a drifttel

A forgás **nem kap saját állapotgépet**:

| Tétel | Forrás |
|---|---|
| Trigger | a meglévő `evasiveManeuverAt !== lastEvasiveTrigger` ág |
| Élettartam | a meglévő `driftEndTime` (1-3 mp) |
| Közelítés | `roll += (rollTarget - roll) * k` — **ugyanaz a `k`** |
| Lecsengés | `roll *= 1 - k` — a drifttel **együtt** |
| Framerate-függetlenség | ingyen jön, a `k` már normalizált (1.9) |

Ennek két haszna van: (a) a forgás és az eltolódás **szinkronban** marad, tehát egyetlen, egységes manővernek látszik, nem két, véletlenül egyszerre futó effektnek; (b) nincs új időzítő, nincs új lecsengési logika, nincs mit külön elrontani.

---

## 2. Fájlstruktúra

### Új fájlok

```
src/services/starColor.ts             # kelvinToRgb, desaturateTowardWhite,
                                      #  SPECTRAL_CLASSES, pickSpectralClass, buildStarColorTable
src/services/starColor.test.ts        # referencia-Kelvin értékek, clamp, eloszlás-határok
src/services/starfieldMath.ts         # magnitudeFromRandom, subpixelAlphaScale, deltaFrames,
                                      #  frameRateAdjustedLerp, randomRollRadians,
                                      #  getStretchFactor (áthelyezve)
src/services/starfieldMath.test.ts    # magnitúdó-ferdeség, subpixel-alfa, delta-clamp,
                                      #  drift-simítás, roll-tartomány és előjel-eloszlás, stretch
```

> ⚠️ **Nem jön létre `src/utils/` mappa.** A projektben nincs ilyen, és nem is kell: a `src/services/` már pontosan ez a réteg (pure/domain modulok kolokált teszttel — `faceRecognition.ts` + `faceRecognition.test.ts`, `cameraPermission.ts`). A projekt konvenciója szerint a teszt a modul mellé kerül (`*.test.ts` ugyanabban a mappában) — ezt követjük.

### Módosuló fájlok

```
src/components/ui/Starfield.tsx   # színek, magnitúdó, subpixel-clamp, delta-idő,
                                  #  evasive roll (rotate + ellenforgatott drift-kompenzáció), HiDPI;
                                  #  getStretchFactor kikerül; createStar factory
src/constants/constants.ts        # +14 új konstans (C. blokk), STAR_SPEED JSDoc pontosítás
src/types/index.ts                # +RenderStar (a Star változatlan)
```

**Nem módosul:** `src/App.tsx` (a `Starfield` propjai és viselkedése kívülről azonosak) · `src/i18n/locales/**` · bármely CSS modul · bármely store · bármely Firebase-réteg.

---

## 3. HiDPI — a tételes átvezetés

> **Ez a blokk a terv legfontosabb része.** A jelenlegi kód a `canvas.width`-et **egyszerre két szerepben** használja: fizikai backing-store méret **és** logikai koordináta-egység. A `devicePixelRatio` bevezetése a két szerepet szétválasztja; ha akár egy hivatkozás lemarad, a mező elcsúszik, más sebességgel megy, vagy középpont-eltolt lesz.

### 3.1 A két szerep

| Szerep | Ma | Ezután |
|---|---|---|
| Backing store (hány valódi pixel) | `canvas.width` | `canvas.width = round(logicalWidth * dpr)` |
| Rajzolási koordinátarendszer | `canvas.width` | `logicalWidth` (a context `setTransform`-mal skálázva) |
| CSS elhelyezés | `canvas.style.width` | változatlan (`${logicalWidth}px`) |
| HUD-pozicionálás | `getBoundingClientRect()` | változatlan (CSS px-et ad) |

### 3.2 Tételes lista — melyik sor mire vált

A jelenlegi (`develop`, 247 soros) `Starfield.tsx` sorszámaival:

| # | Sor | Jelenlegi kifejezés | Új |
|---|---|---|---|
| 1 | 84 | `canvas.width = innerWidth` | `canvas.width = Math.round(logicalWidth * dpr)` |
| 2 | 85 | `canvas.height = innerHeight` | `canvas.height = Math.round(logicalHeight * dpr)` |
| 3 | 87–88 | `canvas.style.width/height` | **változatlan** (CSS px) |
| 4 | *(új, 89 után)* | — | `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)` |
| 5 | 105 | `(Math.random() - 0.5) * canvas.width` | `… * logicalWidth` |
| 6 | 106 | `(Math.random() - 0.5) * canvas.height` | `… * logicalHeight` |
| 7 | 107 | `Math.random() * canvas.width` | `… * logicalWidth` |
| 8 | 113 | `resetStar` → `x` | `logicalWidth` |
| 9 | 114 | `resetStar` → `y` | `logicalHeight` |
| 10 | 115 | `star.z = canvas.width` | `star.z = logicalWidth` |
| 11 | 129 | `ctx.fillRect(0, 0, canvas.width, canvas.height)` | `(0, 0, logicalWidth, logicalHeight)` |
| 12 | 133 | `maxDist` — `canvas.width²/4 + canvas.height²/4` | `logicalWidth² / 4 + logicalHeight² / 4` |
| 13 | 156 | `ctx.translate(canvas.width/2 + driftX, canvas.height/2 + driftY)` | `logicalWidth/2 + driftX, logicalHeight/2 + driftY` |
| 14 | 166 | `(star.x / star.z) * canvas.width` | `* logicalWidth` |
| 15 | 167 | `(star.y / star.z) * canvas.height` | `* logicalHeight` |
| 16 | 168 | `r` képlet — `(canvas.width - star.z) / canvas.width` | `(logicalWidth - star.z) / logicalWidth` |
| 17 | 170 | `opacity` — ugyanaz a hányados | `logicalWidth` |
| 18 | 186 | `depthFactor` — ugyanaz a hányados | `logicalWidth` |
| 19 | 210–211 | cockpit `scale` — `canvas.width / img.width`, `canvas.height / img.height` | `logicalWidth`, `logicalHeight` |
| 20 | 215–216 | cockpit `offsetX/offsetY` | `logicalWidth`, `logicalHeight` |

**16 érdemi csere.** A J. blokk zárótétele egy grep-ellenőrzés: a `draw()` és a `setup()` törzsében **nulla** `canvas.width` / `canvas.height` előfordulás maradhat.

> **Az I. blokkal (forgatás) való viszony:** a 13. tétel (`translate`) és a `rotate` **ugyanabban** a transzformációs verembe kerül. A `rotate` **nem** szerepel ebben a táblában, mert szöget kap, nem koordinátát — a dpr nem hat rá. A teljes, egyesített sorrend az 1.10.1-ben van leírva.

### 3.3 Miért pont `logicalWidth` és nem a fizikai szélesség

Két hivatkozás miatt ez nem stílus, hanem **működési** kérdés:

- **A `z` tartománya `logicalWidth`** (10. tétel). Ha a fizikai szélesség kerülne ide, egy dpr = 2 kijelzőn a csillagoknak **kétszer akkora utat** kellene megtenniük ugyanazzal a `STAR_SPEED`-del → a mező **feleannyira** gyorsnak látszana. A retina-felhasználó lassabb űrhajót kapna.
- **A projekció szorzója `logicalWidth`** (14–15. tétel). Fizikai szélességgel a csillagok kétszer olyan messze vetülnének a középponttól, és a mező szétesne.

> **Megjegyzés a meglévő viselkedésről (nem változik):** a `z` tartománya az **ablakszélességhez** van kötve, tehát egy szélesebb ablakban a csillagok arányosan lassabban érnek be. Ez ma is így van, és a `logicalWidth` használata **pontosan megőrzi**. Ha valaha zavaró lesz, az külön terv (az `STAR_SPEED` felbontásfüggetlenítése), nem ennek a hatóköre.

### 3.4 A transzformáció újraalkalmazása

A `canvas.width` (vagy `.height`) **bármilyen** írása — akkor is, ha az érték nem változik — visszaállítja a 2D context teljes állapotát, benne a transzformációs mátrixot. A `setTransform` ezért **kötelezően a méret-írás után** következik, a `resizeCanvas`-on **belül**. `setTransform` és nem `scale`, mert a `scale` a meglévő mátrixra **szoroz**: ha valaha kétszer futna le, dpr² skálát kapnánk.

### 3.5 dpr-clamp

`STAR_MAX_DEVICE_PIXEL_RATIO = 2`. Egy dpr = 3 telefonon vagy dpr = 4 kijelzőn a kitöltési ráta 9-, illetve 16-szorosára nőne; a `fillRect` teljes képernyős törlés + 400 `arc` + warpban 400 `stroke` mellett ez már látható frame time. A 2× a láthatóság szempontjából a hozam nagy részét megadja (a csillagok élessége az 1→2 lépésben ugrik meg, a 2→3 alig).

---

## 4. Teljesítmény

### 4.1 A per-frame string-építés problémája

A mai kód képkockánként és csillagonként legalább egy, warpban kettő `rgba(...)` template literalt épít:

```
400 csillag × 60 FPS               = 24 000 string / mp   (pontok)
warpban                            = 48 000 string / mp   (+ csíkok)
```

Ezek mind rövid életű allokációk → folyamatos GC-nyomás, fűrészfogas memóriagörbe, időnkénti frame drop. A színek bevezetése ezt **rontaná** (a szín is bekerülne a stringbe), ha nem kezeljük.

### 4.2 A megoldás: `globalAlpha` + megosztott színstring

```
ctx.fillStyle   = star.color      // előre épített, MEGOSZTOTT string-példány
ctx.globalAlpha = alpha           // szám — nulla allokáció
ctx.beginPath(); ctx.arc(...); ctx.fill();
```

A `globalAlpha` **szorzódik** a `fillStyle` alfájára, tehát az `rgb(...)` (opak) színstring + `globalAlpha` pontosan ugyanazt adja, mint az `rgba(..., alpha)`. Az eredmény: **nulla string-allokáció a hurokban**.

⚠️ A `globalAlpha` **context-állapot**, tehát „szivárog". A csillag-hurok már ma is `ctx.save()` / `ctx.restore()` közt fut (a `translate` miatt), és a `restore()` a `globalAlpha`-t is visszaállítja — a cockpit `drawImage` így garantáltan `alpha = 1`-en rajzol. Ezt az összefüggést **kommentben rögzíteni kell**, mert egy későbbi refaktor, ami a `save`/`restore`-t megszünteti, félig áttetsző cockpitot eredményezne (7.5).

### 4.3 Hat szín, hat string

Mivel hat diszkrét spektrálosztály van, összesen **hat** különböző szín létezik. A `buildStarColorTable` egyszer építi fel őket, és a `createStar` a **string-példányt** teszi a `RenderStar.color` mezőjébe — nem másolatot. Ennek két haszna van:

1. **Nulla per-csillag string-memória** (400 csillag, 6 string).
2. A canvas `fillStyle` szetter kevés, ismétlődő értéket lát → a színparser gyorsútvonalon marad.

> **Opcionális, most kimarad:** a csillagokat spektrálosztály szerint rendezve rajzolni, hogy a `fillStyle` képkockánként csak 6-szor váltson 400 helyett. Mérés nélkül ez korai optimalizálás, és felborítaná a rajzolási sorrendet. Ha a K. blokk profilja indokolja, egyszerű utólag hozzátenni.

### 4.4 A `resetStar` allokációja

A `resetStar` **nem hozhat létre új objektumot** (`stars[i] = createStar(...)`), mert így másodpercenként több tucat `RenderStar` szemetelne. A `createStar` egy meglévő objektumot is fel tud tölteni (`fillStar(star, …)` alak), a `setup` pedig egyszer, indításkor allokál `STAR_COUNT` darabot.

### 4.5 Költségvetés

| Tétel | Cél |
|---|---|
| Frame time (400 csillag, dpr 2, warp) | < 16.6 ms |
| Per-frame allokáció | **0 bájt** (lapos GC-görbe a profilban) |
| Színszámítás | csak setup/reset — sosem képkockánként |
| `Math.pow` a hurokban | csak a subpixel-alfánál, és csak akkor, ha `rawRadius < MIN` |
| Trigonometria a forgatáshoz | **képkockánként 2** (`cos`/`sin` a hurok **előtt**), nem 800 (1.10.2) |

---

## 5. Tesztelhetőség

### 5.1 Mi tesztelhető Vitesttel

A canvas-rajzolás jsdom alatt gyakorlatilag nem tesztelhető (nincs valódi 2D context, a `getContext("2d")` `null`-t ad), ezért a `Starfield.tsx`-re **nem készül komponensteszt**. Helyette az összes döntési logika kikerül tiszta függvényekbe:

| Függvény | Mit rögzít a teszt |
|---|---|
| `kelvinToRgb` | 7 referencia-hőmérséklet ±2 toleranciával; monotonitás; clamp; `NaN`-mentesség |
| `desaturateTowardWhite` | `sat=0` → fehér, `sat=1` → identitás, `sat=0.5` → felezőpont |
| `SPECTRAL_CLASSES` | 6 elem, súlyösszeg = 1 |
| `pickSpectralClass` | mind a 6 osztály határértéke (`0`, `0.1`, `0.3`, `0.5`, `0.7`, `0.9`, `1`) |
| `magnitudeFromRandom` | végpontok, monotonitás, **ferdeség** seeded mintán |
| `subpixelAlphaScale` | `1` a küszöb felett, `0.25` a felénél, `0` nullánál, monotonitás |
| `deltaFrames` | 60/144 Hz, tab-váltás clamp, első képkocka, `NaN` |
| `frameRateAdjustedLerp` | **`frames = 1` → bitre a mai `0.08` / `0.92`**; nemlinearitás (`frames = 2` → `0.1536`); `[0, 1)`-ben marad; `NaN`-védelem |
| `randomRollRadians` | tartomány (`rand = 0 / 0.5 / 1` → `-max / 0 / +max` radiánban), **50/50 előjel-eloszlás** seeded mintán, `NaN` → `0` |
| `getStretchFactor` | a 4 töréspont (átköltöztetés utáni regresszió-védelem) |

**A `deltaFrames` és a `subpixelAlphaScale` tesztje a legfontosabb**, mert a hibájuk nem esztétikai: a rossz delta-kezelés `NaN`-t vagy csillag-kilövést okoz, a rossz alfa-clamp pedig eltünteti a távoli csillagokat.

A `frameRateAdjustedLerp` `frames = 1` tesztje külön szerepet tölt be: ez az **egyetlen gépi bizonyíték** arra, hogy a drift 60 Hz-en pontosan a régi maradt. Mivel ez a terv egyetlen szándékos viselkedés-változtatása (7.10), fontos, hogy a „változatlan rész" ne csak szemre, hanem tesztben is rögzítve legyen.

### 5.2 Mi csak manuálisan ellenőrizhető

- A HiDPI-átvezetés helyessége (a 3.2 tábla mind a 16 tétele) — **csak szemmel**, valós dpr mellett.
- A `globalAlpha` szivárgása a cockpit képre.
- A színtelítettség „diszkósság"-a — szubjektív, **élő hangolást igényel** (`STAR_COLOR_SATURATION`).
- A warp összhatása a magnitúdó bevezetése után — szintén szubjektív, szintén élő hangolás (`STAR_STREAK_LENGTH_FACTOR`).
- Az evasive drift **iránya és időtartama** (a lecsengés `frames = 1`-nél már gépi teszttel fedett).
- **A forgatás transzformációs sorrendje** (`translate` → `rotate`, és hogy a fülke áll) — canvas nélkül nem ellenőrizhető.
- **A streak drift-kompenzáció helyessége forgás közben** (1.10.2). A képlet levezetése bizonyítható, a *bekötése* nem: hogy a `driftXr` / `driftYr` valóban a `driftX` / `driftY` helyére került-e minden előfordulásnál, csak szemmel látszik.
- **A forgás mértéke** — szubjektív, élő hangolás (`STAR_ROLL_MAX_DEGREES`), ráadásul **ismételt** manőverekkel (7.13).

Ezekre a 9. szekció ad forgatókönyvet.

### 5.3 Determinizmus a tesztekben

A `pickSpectralClass`, a `magnitudeFromRandom` és a `randomRollRadians` **paraméterként** kapja a véletlen számot, nem belül hívja a `Math.random()`-ot. Ez teszi lehetővé a határérték-teszteket és a seeded LCG-vel futtatott eloszlás-teszteket (magnitúdó-ferdeség, roll előjel-eloszlás), `vi.spyOn(Math, "random")` mókolás nélkül.

---

## 6. i18n

**Nulla új kulcs. A `dev` skill ehhez a tervhez ne indítsa az `i18n` agentet.**

Ez tisztán renderelési változás: nincs új képernyő, nincs új gomb, nincs új felirat, nincs új hibaüzenet és nincs új beállítás. A `Starfield` ma sem jelenít meg egyetlen szöveget sem, és ezután sem fog. A locale-fájlok (`en`, `hu`, `fr`, `de`, `es`) **egyike sem módosul**, a kulcsparitás változatlan marad.

**Miért nem készül beállítás hozzá.** Felmerülhetne egy „csillag-realizmus" kapcsoló vagy egy telítettség-csúszka a Settingsben. Elvetjük:

- A `STAR_COLOR_SATURATION` (és ugyanígy a `STAR_STREAK_LENGTH_FACTOR`, `STAR_ROLL_MAX_DEGREES`) **hangolási** paraméter, nem felhasználói preferencia — egyszer beállítjuk élő összevetéssel, és a K. blokkban rögzítjük.
- Egy grafikai minőség-kapcsoló csak akkor indokolt, ha van mérhető teljesítmény-probléma; a dpr-clamp épp azért van, hogy ne legyen.
- Minden új beállítás 5 nyelvnyi kulccsal, perzisztálással és store-mezővel jár — aránytalan egy vizuális finomításért.

---

## 7. Kockázatok / figyelmeztetések

### 7.1 A HiDPI-átvezetés a terv legnagyobb regressziós kockázata

A `canvas.width` ma **16 helyen** logikai koordináta. Ha egyetlen hivatkozás lemarad, a tünet a hiányzó helytől függ, és nem mindig nyilvánvaló:

| Kimaradó tétel | Tünet |
|---|---|
| Projekció (14–15) | a mező kétszer szélesebbre feszül, a csillagok a képernyőn kívülre vetülnek |
| `z` tartomány (7, 10) | a csillagok **feleannyi** sebességgel jönnek dpr = 2 mellett |
| `translate` (13) | a mező középpontja a bal felső negyedbe csúszik |
| `fillRect` (11) | a képernyő jobb/alsó része nem törlődik → elmaszatolódó csíkok |
| `maxDist` / `depthFactor` (12, 18) | a warp-csíkok hossza torzul |
| Cockpit (19–20) | a cockpit kép rossz méretben/pozícióban, esetleg csak a negyedét fedi |
| `setTransform` (4) | **minden** a bal felső negyedbe zsugorodik |

Enyhítés: (a) a 3.2 tábla tételes végigpipálása, (b) **külön commit** csak erre a blokkra, (c) a grep-ellenőrzés (`canvas.width` a `draw`/`setup` törzsében = 0 találat), (d) a J. blokk ellenőrzési pontja **kötelezően** két dpr-en fut le.

**Ezért van a HiDPI a sor végén:** az A–I blokkok addigra bizonyítottan jók a régi koordináta-bázison, tehát ha a mező a J. blokk után romlik el, a hibás blokk azonnal ismert. **A forgatás (I.) is tudatosan a HiDPI elé került**: a két blokk ugyanazt a `save`/`translate`/`restore` szakaszt írja, és sokkal könnyebb a forgatást a megszokott koordináta-bázison behangolni, mint egyszerre két dolgot mozgatni.

### 7.2 A dpr menet közben is változhat

Ha a felhasználó az ablakot egy másik felbontású monitorra húzza, vagy a böngészőben zoomol, a `devicePixelRatio` **változik**. A `resize` esemény ilyenkor a legtöbb böngészőben lefut (a zoom mindig, a monitorváltás általában), és a `resizeCanvas` újraolvassa a dpr-t — tehát a gyakorlatban kezelve van.

A szigorú megoldás egy `matchMedia("(resolution: Xdppx)")` listener, ami dpr-változáskor is újramér. Ez **most szándékosan kimarad**: bonyolítja az effektet, és a tünet (átmenetileg elmosódott csillagok, amíg nincs resize) elhanyagolható. A kockázatot itt rögzítjük, hogy egy későbbi „miért mosódik el monitorváltáskor" kérdésnek legyen ismert válasza.

### 7.3 Teljesítmény nagy felbontáson

dpr = 2 mellett a törlő `fillRect` és minden `arc` négyszer annyi pixelt érint. 4K + dpr 2 esetén ez 8K-nyi effektív kitöltés. Enyhítés: a `STAR_MAX_DEVICE_PIXEL_RATIO = 2` clamp és a K. blokk profilja. Ha a frame time így is kifut a 16.6 ms-ból: első lépés a clamp `1.5`-re, második a `STAR_COUNT` csökkentése — **nem** a HiDPI visszavonása.

### 7.4 `NaN`-fertőzés az első képkockán

Ha a `draw`-t időbélyeg nélkül hívjuk meg (`draw()` a `requestAnimationFrame(draw)` helyett), a `now` `undefined` → a delta `NaN` → `star.z` `NaN`. Ez **véglegesen** eltünteti a mezőt: a `star.z <= 0` feltétel `NaN`-ra hamis, tehát a `resetStar` sem fut le, és a `z` sosem áll helyre. A tünet: fekete képernyő cockpittal, konzolhiba **nélkül**.

Két védelem: (a) az induló hívás **`draw(performance.now())`**, (b) a `deltaFrames` a nem véges bemenetre `1`-et ad. A (b) önmagában is elég lenne, de a kettő együtt tesz a hibaosztályból lehetetlent. A `deltaFrames` `NaN`-tesztje ezt a védelmet rögzíti.

### 7.5 `globalAlpha`-szivárgás a cockpit képre

A `globalAlpha` a context állapotában marad, amíg vissza nem állítjuk. A csillag-hurok utáni `ctx.restore()` ma is megvan (a `translate` miatt), és ez visszaállítja — a cockpit tehát rendben lesz. **De** ez egy nem nyilvánvaló, közvetett függés: ha valaki később a `save`/`restore` párt „optimalizálásból" kiveszi és kézi eltolásra cseréli, a cockpit **félig áttetszővé** válik, és a hiba oka a `Starfield` egy másik pontján lesz. Kötelező kommentben rögzíteni a `restore()` mellett.

### 7.6 A mező összességében sötétebb lehet

Három változás **egyszerre** csökkenti az átlagos fényerőt: (a) a magnitúdó-alfa `0.25…1`-re skáláz, (b) a subpixel-korrekció a legkisebb csillagok alfáját csökkenti, (c) a színtelítettség a fehértől elmozdítva minden csatornát legfeljebb 255-ön hagy, de a többit csökkenti. Ez **várt** — a cél épp a „kevés fényes, sok halvány" — de túlzásba vihető.

A K. blokk hangolási sorrendje: először `STAR_MAG_ALPHA_MIN` (0.25 → 0.35), utána `STAR_BASE_RADIUS_SCALE` (2.5 → 2.8). A `STAR_COUNT` **ne** legyen a hangolás eszköze: a csillagszám növelése teljesítménybe kerül, és a „sok halvány pont" hatását nem pótolja.

### 7.7 A warp-csíkok rövidülnek

A `streakLen` képlete `r`-ből indul, és az `r` mostantól a magnitúdóval is szorzódik. A halvány csillagok (`magSize = 0.45`) csíkja **rövidebb** lesz. Ez fizikailag helyes (a halvány csillag halvány csíkot húz), de az összbenyomás „kevesebb warp" lehet.

**Ezért kap a szorzó nevesített konstanst.** A hardkódolt `* 3` a G. blokkban `* STAR_STREAK_LENGTH_FACTOR`-rá válik, `3` alapértékkel — a kiemelés önmagában **viselkedés-semleges**. Ha a K. blokk élő összevetése (9. szekció, 11. tétel) „kevesebb warp"-ot állapít meg, a javítás **egyetlen szám** átírása (`3` → `4…4.5`), a render-kódhoz nyúlás nélkül.

⚠️ A javítás **nem** lehet a magnitúdó-hatás kivétele a `streakLen`-ből: az adná vissza a mai egyenletes szemcsézettséget, épp azt, amit a F. blokk megszüntet. A hangolási lever a hossz-szorzó, nem a magnitúdó.

### 7.8 A `resetStar` újrasorsolása látható lehet

Mivel a `resetStar` a színt és a magnitúdót is újrasorsolja, egy csillag „átalakul", amikor elhalad a kamera mellett. Ez a `z = 0` környékén történik, ahol a csillag már **kifelé** haladva a képernyő szélén, teljes fényerőn van — elvben látható a váltás. A gyakorlatban nem az: a `z <= 0` pillanatában a csillag a képernyőn kívülre vetül (a `star.x / star.z` hányados elszáll), tehát a mező látható részén sosem villan át. **Ha mégis látható lenne** (nagyon széles ablak, szélső csillag), a megoldás nem a szín befagyasztása, hanem a reset küszöbének megemelése (`z <= 0` → `z <= EPS`).

### 7.9 Nincs komponensteszt a `Starfield`-re

Tudatos: jsdom alatt nincs valódi canvas 2D context. A regresszió-védelem a pure helper-tesztekből és a 9. szekció kézi forgatókönyvéből áll. Aki később canvas-mockot vezetne be: az `arc` / `fillRect` hívások számlálása keveset bizonyít, a koordináta-helyesség viszont (a 3.2 tábla) mockolt contexttel **igenis** ellenőrizhető lenne — ez egy értelmes későbbi bővítés, de nem ennek a tervnek a hatóköre.

### 7.10 A drift-lecsengés az egyetlen szándékos viselkedés-változtatás

A terv minden más tétele **megőrzi** a meglévő látványt (vagy javítja anélkül, hogy a megszokottat elvenné). **Egy** kivétel van: az evasive drift lecsengésének delta-normalizálása (1.9, H. blokk).

- **Mi változik:** 60 Hz **felett** a lecsengés lassabbnak fog *tűnni*, mint eddig. Ma egy 144 Hz-es monitoron a drift 2.4-szer annyi simítási lépést tesz meg másodpercenként, tehát gyorsabban áll vissza középre. Normalizálás után minden frekvencián **ugyanannyi ideig** tart.
- **Mi nem változik:** 60 Hz-en semmi — `frames = 1` mellett a képlet bitre a mai `0.08` / `0.92` értéket adja (a B. blokk tesztje ezt rögzíti). Továbbá a drift **iránya, kiváltása és 1-3 mp-es időtartama** minden frekvencián változatlan.
- **Miért vállaljuk:** az eredeti megkötés („az evasive drift működése nem változhat") azt védte, hogy egy renderelési átalakítás ne rontson el egy bejáratott játékérzetet. Itt viszont maga a régi viselkedés a hiba: a lecsengés sebessége nem függhet a monitortól. A felhasználó ezt megvizsgálta és **tudatosan felülírta** a megkötést.

⚠️ **A kézi tesztnél erre külön figyelni kell** (9. szekció, 6. tétel): mivel ez az egyetlen pont, ahol a „másnak érződik" **nem** bug, könnyű összekeverni egy valódi regresszióval. A helyes ellenőrzés: a lecsengés **időtartamát** kell összemérni két frekvencián (stopper vagy képernyőfelvétel), nem a képkockaszámot. Ha a két időtartam egyezik, a tétel kész — akkor is, ha 144 Hz-en szubjektíven „lomhább".

> Megjegyzés: a forgatás (I. blokk) **új** viselkedés, nem meglévő megváltoztatása — ezért nem tartozik ide.

### 7.11 A streak drift-kompenzáció eltörhet a forgatástól

**A forgatás legvalószínűbb hibaforrása.** A jelenlegi `actualDist` a `driftX` / `driftY` értéket a *képernyő* bázisában adja hozzá a *lokális* `sx` / `sy`-hoz. Forgatás nélkül a két bázis egybeesik, tehát a képlet helyes; `ctx.rotate(roll)` után **nem**.

**Miért alattomos:** a hiba `roll = 0`-nál **nem jelentkezik**, tehát a normál játékmenet 95%-ában láthatatlan. Csak a manőver 1-3 másodpercében üt ki — pont akkor, amikor a játékos figyel —, és ott sem „hibaüzenetként", hanem úgy, hogy a warp-csíkok rossz irányba mutatnak és a hosszuk ugrál. Egy felületes teszt („kipróbáltam, forog, jó") ezt átengedi.

**Megoldás:** a drift-vektor ellenforgatása (`driftXr` / `driftYr`, 1.10.2). A képlet `roll = 0`-nál azonosan a mait adja, tehát a bevezetése forgás nélkül bizonyíthatóan regresszió-mentes.

**Két, a bekötésnél elkövethető hiba:**

1. **Rossz előjel** az ellenforgatásban (`R(roll)` az `R(-roll)` helyett). A tünet nem eltűnés, hanem a hiba **megkétszereződése** — a csíkok a valósnál nagyobb szöggel mutatnak félre. Csak összehasonlítással vehető észre, ezért a kézi tesztben a forgás **irányát** is figyelni kell (9. szekció, 12. tétel).
2. **`cos`/`sin` a hurokba kerül.** Működik, de 800 trigonometrikus hívás képkockánként. Nem vizuális hiba, csak a profilban látszik — a 4.5 költségvetés sora ezért van külön nevesítve.

### 7.12 Üres sarkok a forgatott mezőben — elemzés

A csillagok `x` / `y` koordinátája a `(Math.random() - 0.5) * logicalWidth/Height` tartományban szór, ami egy **képernyő-arányú téglalap**. Elforgatva a téglalap sarkai kilógnak, a képernyő sarkaiban pedig elvben kimaradhat a fedés.

**A számítás azt mutatja, hogy nincs teendő.** A projekció `sx = (x / z) * W`, ahol `z ∈ (0, W]`. A `z = W` (leghátsó) síkon a szorzó pontosan `1`, tehát a mező **épp csak** kitölti a képernyőt — margó nélkül. Minden kisebb `z`-re a szorzó `> 1`, azaz a mező a képernyőnél **nagyobb** területre feszül.

Egy `θ = 15°`-os forgatás 1920×1080-on a befoglaló félszélességet `(1920·cos15° + 1080·sin15°) / 2 = 1067 px`-re növeli a `960` helyett, azaz **1.112×** fedés kellene. Ezt minden `z < W / 1.112 = 0.9·W` csillag teljesíti. Ami kimarad: a `z ∈ [0.9W, W]` sáv — ahol viszont `opacity = (W - z) / W ≤ 0.1`, ráadásul ez még a magnitúdó-alfával (`0.25…1`) is szorzódik. **A hiányzó csillagok tehát pontosan azok, amiknek az alfája legfeljebb 10%.** A tervezett `±6°` mellett a szám még kedvezőbb (`1.04×` fedés, `z ≥ 0.96W`).

Ehhez jön, hogy a képernyő **sarkait a cockpit kép amúgy is takarja**.

**Tartalék-megoldás, ha mégis látszik** (az I. blokk vizuális ellenőrzési tétele dönt): a szórási tartomány enyhe túlméretezése egy `STAR_SPREAD_OVERSCAN` szorzóval a `createStar`-ban. ⚠️ Ennek **ára van**: a sűrűség megtartásához a csillagszámnak a szorzó **négyzetével** kell nőnie — `1.15×` túlméretezés `1.32×` csillagszámot jelent (`400 → 530`), azaz ~32% többlet rajzolási költséget. Ezért nem vezetjük be előre.

### 7.13 A forgás fárasztó lehet — az AFK-jelleg miatt kiemelt kockázat

Ez a játék arra épül, hogy a játékos **órákig** ül a képernyő előtt. Egy látványos effekt, ami egyszer nézve „szuper", ötvenedszerre kimerítő lehet — a nagy amplitúdójú képernyő-forgatás pedig a mozgásbetegség (motion sickness) klasszikus kiváltója, különösen teljes képernyőn, közelről.

Enyhítés: (a) a `STAR_ROLL_MAX_DEGREES` **tudatosan visszafogott** `6`-tal indul, nem a látványosabb 15-20°-kal; (b) a hangolás **kötelezően több egymást követő manőverrel** történik, nem egyetlen kipróbálással (K. blokk); (c) a forgás a drifttel együtt, `1-3` mp alatt lecseng — nincs tartós ferde állapot.

⚠️ Ha a hangoláskor bizonytalanság van két érték közt, **a kisebbet kell választani**. Egy visszafogott effekt legrosszabb esetben észrevétlen; egy túlzó effekt viszont játszhatatlanná teszi a saját játékának alapmechanikáját (hosszú, mozdulatlan ülés).

⚠️ **A jelenlegi állás `12°`** — a `4…12`-es sáv **teteje**, a tervezett kiindulási `6°` kétszerese. Ez nem hiba (a felhasználó állította így a hangolás során), de azt jelenti, hogy a 9. szekció 12/f tétele (**több egymást követő** manőver, fáradás-ellenőrzés) ennél az értéknél **nem hagyható ki**, és a fenti „bizonytalanság esetén a kisebbet" szabály itt a `12`-vel szemben érvényesül.

### 7.14 ⚠️ A profilozás terhelése megháromszorozódott — `STAR_COUNT = 1200`

A 4.5 költségvetés és a 9. szekció 10. forgatókönyve **400 csillagra** készült. A felhasználó a hangolás során a `STAR_COUNT`-ot **`1200`**-ra emelte, ami **3×** akkora rajzolási terhelés: képkockánként 1200 `arc`, warpban ehhez 1200 `stroke` is.

**Következmények a K. blokkra:**

- A DevTools Performance profilt **`STAR_COUNT = 1200`, dpr 2, warpban** kell felvenni. A 400 csillagos mérés érvénytelen — a valós beállítást kell mérni, nem a tervezettet.
- A `< 16.6 ms` frame time célt ehhez a darabszámhoz kell tartani. Mivel az **A. blokk referencia-profilja hiányzik** (a baseline kimaradt), nincs „mihez képest" — az abszolút küszöb az egyetlen mérce.
- A per-frame allokáció célja (**0 bájt**) darabszám-független, tehát a lapos GC-görbe elvárása 1200 csillagnál is változatlanul érvényes. Ha itt fűrészfog látszik, az valódi hiba (visszaszivárgott string-építés a hurokba), nem a csillagszám következménye.

**Ha a frame time kifut a 16.6 ms-ból**, a 7.3 lépéssorát kell követni, de a `STAR_COUNT` most **először** jön szóba (mert a hangolás emelte meg): (1) `STAR_COUNT` vissza `800`-ra, majd `600`-ra, (2) `STAR_MAX_DEVICE_PIXEL_RATIO` `2 → 1.5`, (3) a 4.3-ban leírt spektrálosztály szerinti rajzolási rendezés. **A HiDPI visszavonása továbbra sem opció.**

> Megjegyzés: a 7.6 kikötése („a `STAR_COUNT` **ne** legyen a hangolás eszköze") a **fényerő** hangolására vonatkozott — arra ott is érvényben marad. A darabszám sűrűség-célú emelése más kérdés, de a teljesítmény-ára ugyanaz, ezért kell megmérni.

---

## 8. Nem része a scope-nak

> ⚠️ Az alábbi **öt** tétel **kifejezetten elutasított**. Nem elfelejtett, nem „később" — a felhasználó megvizsgálta és nemet mondott rájuk. Egy későbbi session ne „javítsa vissza" őket.

### 8.1 Statikus háttérréteg / Tejút-sáv / nebula

**Elutasítva.** A felhasználó szó szerint: „nem akarok háttérképet". A háttér marad tiszta fekete `fillRect`. Ez egyben a legolcsóbb megoldás is: nincs második canvas-réteg, nincs textúra-betöltés, nincs a mozgó mezővel szinkronizálandó parallax.

### 8.2 Mozgásvektoros (előző pozíció alapú) warp-csík

**Elutasítva.** A csík iránya és hossza maradhatna a csillag valódi képkockák közti elmozdulásából, ami fizikailag pontosabb lenne. A jelenlegi `lateralFactor` / `depthFactor²` heurisztika azonban **jól néz ki**, be van hangolva, és a `getStretchFactor`-ral együtt egy működő egészet alkot. A csere csak kockázatot hozna, látható hozam nélkül. A heurisztika **változatlan marad** — a G. blokk annyit tesz vele, hogy a `lineWidth` a clampelt sugárból számol.

### 8.3 Pislogás / twinkle

**Elutasítva, és ez a legfontosabb indoklás.** A csillagok pislogása (szcintilláció) **légköri** jelenség: a Föld légkörének turbulenciája töri meg a fényt. Az űrben, légkör nélkül a csillagok **nem pislognak** — tökéletesen stabil pontfények. A twinkle hozzáadása tehát nem növelné, hanem **csökkentené** az élethűséget, miközben pont az a játék premisszája, hogy a játékos az űrben van.

> Ez elválasztandó a 3. munkacsomagtól: a subpixel-villogás **renderelési hiba**, amit megszüntetünk; a twinkle **szándékos effekt** lenne, amit nem adunk hozzá. A kettő vizuálisan hasonlít, a viszonyuk viszont ellentétes.

### 8.4 A hajósebesség realizmus-korrekciója

**Elutasítva.** A jelenlegi 1000 km/s = 0.003c; ezzel a sebességgel a legközelebbi csillag is 1300 év, és a csillagmező a képernyőn fizikailag **gyakorlatilag állna**. A játékélmény itt tudatosan felülírja a realizmust: a látható mozgás adja a haladás érzetét egy olyan játékban, ahol a játékos feladata a mozdulatlan ülés. A `getStretchFactor` sebesség-küszöbei (250 / 500 / 1000 km/s) **változatlanok**.

### 8.5 Repülőgépszerű bedőlés (banking) a kitérő manővernél

**Elutasítva** — és ez az a tétel, amit a legkönnyebb később „javításnak" hinni.

A kézenfekvő megoldás az lett volna, hogy a forgás a kitérés irányát kövesse: `rollTarget = -driftTargetX * valamiSkála`, ahogy egy repülőgép bedől a kanyarba. Ez fizikailag „logikusabbnak" tűnik, és egy jövőbeli olvasó könnyen gondolhatja, hogy a független sorsolás csak lustaság.

**Nem az.** A felhasználó a két változatot összevetve **tudatosan a független, véletlen pördülést választotta**, mert a szándékolt élmény nem egy kontrollált manőver, hanem egy **találat / súrolás**: valami eltalálta a hajót, az megpördült, a pilóta korrigál. Ez kaotikusabb és drámaibb — és jobban illik ahhoz az eseményhez, ami kiváltja (aszteroida, [[011-difficulty-event-system]]).

A banking ráadásul **kiszámíthatóvá** tenné az effektet: minden balra kitérés ugyanúgy nézne ki. A független sorsolás minden manővert egyedivé tesz, ami egy órákig futó játékban nem mellékes.

> Ha valaki mégis a bankinget akarja, az **külön döntés** a felhasználótól — ne kerüljön be „konzisztencia-javításként".

---

## 9. Kézi teszt-forgatókönyv

> A canvas-rendereléshez nincs automata teszt (5.2), ezért ez a lista a K. blokk kötelező része.

| # | Forgatókönyv | Elvárt eredmény |
|---|---|---|
| 1 | **Frissítési frekvencia** — ugyanaz a jelenet 60 Hz-en és 144 Hz-en (vagy DevTools → Rendering → frame rate korlátozás) | A csillagok látszólagos sebessége **azonos**. A H. blokk előtt ez 2.4× eltérést mutat |
| 2 | **Tab-váltás** — másik fülre váltás 30 mp-re, majd vissza | Nincs csillag-„kilövés", nincs ugrás; a mező zökkenőmentesen folytatja |
| 3 | **dpr 1 vs 2** — DevTools device pixel ratio emuláció, illetve valódi retina kijelző | A csillagok **élesebbek**, de **azonos látszólagos méretűek és sebességűek**. A cockpit kép is élesebb |
| 4 | **Ablakméretezés + teljes képernyő** (F11) | Nincs torzulás, nincs elmaszatolódás; az Exit gomb és a stats panel pozíciója továbbra is pontos (`onCanvasBoundsChange`) |
| 5 | **Warp** — 1000 km/s-os hajó | A csíkok megvannak, befelé mutatnak, a mélységi rétegzettség megmarad; a csík a csillag **saját színét** viseli |
| 6 | **Evasive maneuver** — aszteroida-esemény alatt gombnyomás ([[011-difficulty-event-system]]), **két frissítési frekvencián** | A drift amplitúdója, iránya és 1-3 mp-es időtartama **változatlan**; a csíkhossz-kompenzáció (`actualDist`) továbbra is működik. ⚠️ A lecsengés **időtartamát** kell összemérni a két frekvencián (stopper / képernyőfelvétel), **nem** a képkockaszámot — 144 Hz-en szubjektíven „lomhább" lesz, és ez a **helyes** eredmény (7.10) |
| 7 | **Cockpit** — több hajó ([[002-ingame-shop-frontend]] katalógus), **kitérő manőver közben is** | A kép éles, teljesen fed, **nem áttetsző**, a pozíció változatlan — és **nem forog együtt** a mezővel (1.10.1) |
| 8 | **Szünet** — pause overlay, majd folytatás | A csillagok megállnak, a drift lecseng; feloldáskor **nincs ugrás** (a delta nem halmozódott fel) |
| 9 | **Szín-hangolás** — `STAR_COLOR_SATURATION` = 0.4 / 0.65 / 1.0 a futó játékban | Látható változatosság „diszkó-hatás" nélkül; a végleges érték **élő összevetés után** rögzítve a JSDoc-ban |
| 10 | **Profil** — DevTools Performance, ⚠️ **1200 csillag** (a hangolás megemelte, lásd 7.14), dpr 2, warp | Frame time < 16.6 ms; a memória-görbe **lapos** (nincs per-frame allokáció). ⚠️ A **400** csillagos mérés érvénytelen, és az A. blokk referencia-profilja hiányzik → **abszolút** küszöbhöz kell mérni |
| 11 | **Warp-hangolás** — a warp összhatásának összevetése a **magnitúdó bevezetése előtti** állapottal (az A. blokk warp-baseline képernyőképe / felvétele) | Ha az érzet „kevesebb warp": a `STAR_STREAK_LENGTH_FACTOR` emelése `3` → `4…4.5`, majd újraértékelés. A végleges érték **ugyanabban a hangoló körben** dől el, mint a `STAR_COLOR_SATURATION` (9. tétel) — a kettő egymásra is hat. ⚠️ **A warp-baseline nincs meg** (az A. blokk kimaradt), tehát nincs mihez összevetni — abszolút megítéléssel kell dönteni |
| 12 | **Kitérő manőver forgatással** — aszteroida-esemény, **több egymást követő** manőver, **warpban is** (1000 km/s-os hajó) | (a) A kitérés „manővernek" hat, nem csúszkálásnak. (b) A **fülke áll**, a mező forog. (c) A forgás **iránya véletlenszerű**, nem követi a kitérés irányát (több manőverből kiderül — 8.5). (d) A forgás a drifttel **együtt** indul és együtt cseng le, nem külön életet él. (e) ⚠️ **A warp-csíkok a forgás alatt is a képernyő valódi közepéből sugároznak** — ha „félrenéznek" vagy a hosszuk ugrál, a drift-kompenzáció eltört (7.11). (f) Több ismétlés után sem fárasztó/rosszullét-keltő (7.13) → különben `STAR_ROLL_MAX_DEGREES` csökkentése |

---

## 10. Függőségek

- **Előfeltétel:** [[011-difficulty-event-system]] — a `Starfield` a `useGameStore.evasiveManeuverAt`-ot olvassa, ami onnan származik. Az evasive manőver **három ponton** érintett: (a) a HiDPI-átvezetés (a drift logikai pixelben mozog, és a `translate` logikai koordinátát kap), (b) a lecsengés **szándékos** delta-normalizálása (1.9 / 7.10), (c) az **új forgatás** (roll), ami ugyanarra a triggerre és ugyanarra az 1-3 mp-es ablakra épül (1.10). A trigger, az irány és az időtartam a 011 oldaláról **változatlan** — a `Starfield` csak a megjelenítést bővíti, a `useGameStore` és a `triggerEvasiveManeuver` **nem módosul**. Ellenőrzés: 9. szekció 6. és 12. forgatókönyve
- **Kapcsolódó:** [[002-ingame-shop-frontend]] — a `cockpitImageUrl` a shop hajókatalógusából jön, a `speedKmPerSecond` pedig a hajó sebességéből; a HiDPI a cockpit `drawImage` méretezését is átvezeti (3.2 / 19–20. tétel)
- **Semmi nem függ ettől a tervtől.** Tisztán a `Starfield.tsx` renderelése változik; a komponens **külső szerződése** (propok, `onCanvasBoundsChange`, viselkedés) azonos marad, tehát az `App.tsx` és a HUD érintetlen
- **Nem érinti:** Firebase, auth, shop-store, Stripe, i18n, notification — nulla átfedés a nyitott tervekkel ([[016-stripe-fraud-defense]], [[017-stripe-go-live]], [[018-notification-retention]])
- **Elhelyezés a roadmapen:** a **lista végére** — nincs sürgőssége, és semmi nem várja

---

## 11. Becsült ráfordítás

| Blokk | Becslés |
|---|---|
| A. Baseline (képernyőkép + profil) | ~15 perc |
| B. Pure helperek + tesztek (`+frameRateAdjustedLerp`, `+randomRollRadians`) | ~115 perc |
| C. Konstansok (JSDoc-kal) | ~15 perc |
| D. `RenderStar` típus | ~10 perc |
| E. Szín bekötése (`globalAlpha`, színtábla, `createStar`) | ~40 perc |
| F. Magnitúdó | ~30 perc |
| G. Subpixel-clamp (pont + csík) | ~20 perc |
| H. Delta-idő (csillagok **+ drift-lecsengés**) | ~40 perc |
| I. **Forgatás (roll)** — állapot, `rotate`, ellenforgatott drift-kompenzáció | ~45 perc |
| J. **HiDPI (16 tétel + ellenőrzés)** | ~60 perc |
| K. Validáció, 12 kézi forgatókönyv, **háromparaméteres élő hangolás** | ~90 perc |
| **Összesen** | **~7.5 óra** |

---

**Kész definíció:**

- A csillagok **spektráltípus szerinti színt** kapnak (6 osztály, a látható égboltra súlyozott eloszlással), a szín a `STAR_COLOR_SATURATION` szerint tompítva, és **egyszer, létrehozáskor** kiszámítva.
- A csillagok **magnitúdó-eloszlást** követnek: kevés domináns fényes, sok halvány; a `mag` a méretet és az opacitást **külön tartományon** skálázza.
- Nincs 0.7 px-nél kisebb sugárral rajzolt csillag; a veszteség **energiamegőrzően** az alfán jelenik meg, a warp-csík `lineWidth`-ére is.
- A canvas `devicePixelRatio` szerint méretezett backing store-ral rajzol (max 2×), a rajzolási koordináták pedig **kizárólag** `logicalWidth` / `logicalHeight` alapúak — a 3.2 tábla mind a 16 tétele átvezetve, a `draw()`/`setup()` törzsében nulla `canvas.width` hivatkozás.
- A csillagok sebessége **és az evasive drift lecsengése** framerate-független (60 FPS-re normalizált delta), az első képkocka és a tab-váltás utáni nagy delta is kezelve (clamp: 3 frame), és a `NaN`-fertőzés két, egymástól független védelemmel kizárva.
- A render-hurokban **nulla string-allokáció**: opak, osztályonként megosztott `rgb(...)` + `ctx.globalAlpha`.
- A tiszta függvények a **`src/services/starColor.ts`** és **`src/services/starfieldMath.ts`** fájlokban élnek (**nem** jött létre `src/utils/` mappa), Vitest-lefedettséggel (referencia-Kelvin értékek, eloszlás-határok, subpixel-alfa, delta-clamp, drift-simítás, roll-tartomány és előjel-eloszlás, `getStretchFactor`).
- **A kitérő manőver forgat is, nem csak eltolódik:** a csillagmező a drifttel eltolt origó körül elfordul, **független, véletlen** szöggel (`STAR_ROLL_MAX_DEGREES`), ugyanarra a triggerre, ugyanabban az 1-3 mp-es ablakban, ugyanazzal a `k` simítással — tehát eleve framerate-függetlenül. **Nincs banking** (8.5), **nincs külön időzítő**, és a `Star` / `RenderStar` típus sem bővült ettől.
- **A pilótafülke soha nem forog:** a cockpit `drawImage` a `ctx.restore()` után maradt, a transzformációs blokkon kívül.
- A warp-csíkok **forgás közben is** a képernyő valódi közepéből sugároznak: a drift-kompenzáció az ellenforgatott `driftXr` / `driftYr` vektort használja (1.10.2), ami `roll = 0`-nál azonosan a mai képletet adja. A `cos` / `sin` képkockánként **egyszer** fut, nem csillagonként.
- A `getStretchFactor` warp-viselkedés és a cockpit-rajzolás **vizuálisan változatlan**; az evasive drift **iránya, kiváltása és 1-3 mp-es időtartama** változatlan, a lecsengés 60 Hz-en bitre azonos (gépi teszttel rögzítve), afölött **időarányos** — ez a terv egyetlen, tudatosan vállalt viselkedés-*változtatása* (7.10). (A forgatás nem ide tartozik: az **új** viselkedés.)
- A `Star` publikus típusa érintetlen (`RenderStar` az új).
- A három szubjektív paraméter (`STAR_COLOR_SATURATION`, `STAR_STREAK_LENGTH_FACTOR`, `STAR_ROLL_MAX_DEGREES`) **nevesített konstans**, a végleges értékük **egyetlen élő hangoló körben** dől el, és rögzítve van a JSDoc-jukban.
- **Nulla új i18n kulcs**, nulla új UI, nulla új felhasználói string — az `i18n` agentnek nincs teendője.
- `tsc --noEmit` tiszta, `npm run test` zöld, `npm run build` sikeres, a 9. szekció mind a **12** forgatókönyve lefutott.
