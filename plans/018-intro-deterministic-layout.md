---
title: "Determinisztikus intró-elrendezés – nyelv- és képernyőfüggetlen pozíciók, közös betűméret, időalapú felfedés"
slug: 018-intro-deterministic-layout
type: plan
category: ui
status: implemented
implemented: true
implemented_at: "2026-08-06"
created_at: "2026-07-30"
updated_at: "2026-08-06"  # átszámozva: step 19 → 18 (Stripe-tervek a lista végére kerültek)
author: exphoenee
step: 18
phases: []
dependencies: []
related_plans:
  - 000-i18n-nyelvesites
  - 017-starfield-realism
  - 020-nextjs-migration
tags:
  - intro
  - layout
  - typography
  - i18n
  - responsive
  - animation
  - determinism
  - performance
  - accessibility
---

# Determinisztikus intró-elrendezés – nyelv- és képernyőfüggetlen pozíciók, közös betűméret, időalapú felfedés

**Cél:** az `IntroScreen` (Star Wars-szerű felfelé úszó szöveg) **mind az 5 nyelven és minden képernyőméreten pontosan ugyanúgy** nézzen ki: a szövegblokkok **azonos időpontban** és **azonos pozícióban** jelenjenek meg, a betűméret **közös** legyen, az intró teljes hossza **azonos**, a záró „continue" felirat pedig **garantáltan** megjelenjen.

> ⚠️ **Ez a terv semmitől nem függ.** `dependencies: []` — **szándékosan üres**. A sorszám (018) csak az időrendet tükrözi, **nem** függőséget: ez a terv **bármikor implementálható**, akár azonnal, a [[020-nextjs-migration]] **előtt** is. Egy későbbi olvasó ne higgye, hogy a Next.js migrációra vár. Az egyetlen kapcsolódás a 020-hoz egy **kódütközési figyelmeztetés** (6.12), nem függőség.

> 🎯 **A gyökérok egy mondatban.** A mai `IntroScreen` a görgetés kezdő- és végpontját **kizárólag a viewport magasságából** számolja (`IntroScreen.tsx:18-24`, tudatos döntés a nyelvváltáskori ugrálás ellen), a tartalom magasságát pedig **szándékosan figyelmen kívül hagyja**. Így a görgetési út fixen `2 × vh + 200` px, a tartalom magassága viszont nyelvenként és képernyőméretenként erősen változik — **két független mennyiség, amiknek egyezniük kellene, de semmi nem köti össze őket.**

> ✅ **A megoldás elve.** Nem a tartalmat mérjük a görgetéshez, hanem a **tartalmat tesszük determinisztikussá**: minden blokk `vh`-arányos, **fix magasságú rekeszt** kap, a betűméret pedig blokkonként úgy áll be, hogy a **leghosszabb nyelv** is beleférjen — és **ugyanaz a méret** megy mind az 5 nyelvre. Ekkor a tartalom teljes magassága **ismert szám**, a görgetés végpontja **pontosan belőle** számolható, és minden blokk **kiszámítható időpontban** lépi át a képernyő bármely vonalát.

---

## Döntések (egyeztetve)

| Kérdés | Választás |
|--------|-----------|
| Betűméret-stratégia | **KÖZÖS betűméret minden nyelven**, blokkonként. A méret a **leghosszabb nyelv** szövegéhez van illesztve, és **mind az 5 nyelv ugyanazt kapja** |
| ❌ Elutasított alternatíva | **Nyelvenként illesztett betűméret.** A felhasználó kifejezetten **nem** ezt választotta. Egy későbbi session ne „javítsa" per-nyelv illesztésre |
| A közös méret vállalt ára | A rövidebb nyelveknél (**magyar**, 1228 karakter) **több üres hely** marad a rekeszekben, mint a leghosszabbnál (**francia**, 1423). Ezt a felhasználó **tudatosan vállalta** — cserébe a betűméret **és** a pozíció is azonos minden nyelven |
| A „leghosszabb nyelv" meghatározása | ❌ **NEM karakterszámból** (az csak közelítés: eltérő szóhossz, ékezetek, betűszélesség). ✅ **Futásidejű DOM-mérés**: blokkonként mind az 5 nyelv szövege kirenderelve egy képernyőn kívüli mérőelembe az **aktuális oszlopszélességgel**, és a **legmagasabbra** méretezve |
| A mérés forrása | `i18n.getFixedT(lng)` — az i18next mind az 5 fordítást **statikusan betöltve** tartja (`src/i18n/index.ts:20-26`), tehát a mérés **szinkron** és hálózat nélküli |
| A mérés gyakorisága | **Viewportonként egyszer**, resize-ra **debounce-olva** (250 ms). ❌ Soha nem képkockánként |
| Ütemezés | **FIX IDŐREND.** Minden blokk **előre meghatározott időpontban** jelenik meg, a pozíciójától **függetlenül** |
| Az intró hossza | **Fix `INTRO_TOTAL_DURATION_SEC`.** ⚠️ Nem a sebesség fix (mint ma: 3.5 px/s), hanem az **idő** — a sebesség (px/s) a viewportból adódik. Ez teszi az intrót **minden képernyőn pontosan ugyanolyan hosszúvá** |
| Az időtartam **értéke** | **540 s (9 perc).** A felhasználó a **mai ~10 perces érzet megtartását** kérte. ⚠️ A mai intró valójában **nem fér bele** 10 percbe (1.2.1): 1080p-n `674 s` ≈ 11,2 perces animációt indít, amit az auto-skip 600 s-nál elvág — tehát a mai 11,2 percből **úgyis csak 10 látszik**. Az 540 s megtartja a lassú, hangulatos tempót, és **60 s tartalékot** hagy az auto-skip előtt |
| Az `INTRO_AUTO_SKIP_TIMEOUT_MS` | **Nem változik** (600 s). Az 540 s-os idővonal **alá fér** — az invariáns (`finalInstructionAtMs + 30 s ≤ 600 s`) teljesül: `531 + 30 = 561 ≤ 600` ✅. A 7.6-os hatókör-korlát érvényben marad |
| ⚠️ Viselkedésváltozás | **Az intró mostantól magától ér véget**, az auto-skip beavatkozása nélkül (544 s < 600 s). Ma **soha** nem ér véget magától — mindig az auto-skip zárja le (1.2.1). Ez önálló, kézzel ellenőrizendő tétel (8.2 / 21. forgatókönyv) |
| Nyitó csend hossza | **Érdemben lerövidítve: az első címsor ~6,6 s-nál jelenik meg** (a terv korábbi vázlatában ~47 s volt). Indoklás: a hosszú üres nyitás alatt a játékos **elbizonytalanodik, hogy elakadt-e a betöltés** — a hangulati nyereség nem éri meg ezt a kockázatot |
| A felfedés kioldó vonala | ⚠️ **`INTRO_REVEAL_TRIGGER_RATIO = 1.0`** (a képernyő **alsó éle**), nem a mai `2/3`. **Ez a rövid nyitás ára és egyben feltétele** — a levezetés (1.5.1) szerint az „alulról úszik be" + „~7 s-on belül megjelenik" + „állandó lassú sebesség" hármas **csak** így teljesíthető együtt. Mellékhaszon: megszűnik a mai, állandóan üres alsó képernyőharmad, és a jelenet közelebb kerül a valódi Star Wars-crawlhoz, ahol a szöveg **az alsó élnél teljes fedettséggel** úszik be |
| ❌ Elvetett alternatíva a nyitáshoz | **A `2/3`-os kioldó vonal megtartása** kisebb nyitópaddal (`s = 0.688`). Ekkor a 2–9. blokk középen fedne fel, de a **legelső** blokk nem úszna be, hanem **helyben** tűnne elő a képernyő 2/3-ánál. Elvetve: a felhasználó kifejezetten kérte, hogy **a beúszás élménye maradjon meg**. Az I. blokk hangoló körének **tartalék** megoldása, ha a peremnél való felfedés élőben nem tetszik (1.5.1) |
| Rekesz-modell | Minden blokk **fix, `vh`-arányos magasságú rekeszt** kap (`INTRO_SLOTS` tábla). A rekeszek minden nyelven és képernyőn **ugyanott** vannak |
| Szöveg igazítása a rekeszen belül | **Felülre igazítva** (`flex-start`). Így a blokk **első sora** minden nyelven pontosan ugyanazon a `y`-on van, és a felfedés kioldó vonala is ugyanoda esik. A függőleges középre igazítás **elvetve**: szebb lenne, de a rövid nyelvek első sorát lejjebb tolná, azaz épp a sikerkritériumot rontaná el |
| A rAF-pollozás sorsa | **Teljesen elhagyva.** A mai `requestAnimationFrame` hurok (`IntroScreen.tsx:104-114`) képkockánként **9 `getBoundingClientRect()`** hívást végez. Fix rekeszek + állandó sebesség mellett a felfedés ideje **analitikusan ismert**, tehát pozíciópollozás helyett sima **időalapú ütemezés** jár. Egyszerre egyszerűsítés **és** teljesítménynyereség |
| Az időalapú ütemező mechanizmusa | **Alacsony frekvenciájú, önkorrigáló timer** (250 ms), ami az eltelt időt (`performance.now()`) veti össze a menetrenddel. ❌ Nem blokkonkénti `setTimeout`: háttérfülön a böngésző ≥1 s-ra clampeli, és visszatéréskor sorban elsülnének. Az önkorrigáló timer visszatéréskor **egyszerre** fedi fel az összes lejárt blokkot — ami helyes, mert a CSS-animáció közben végig futott |
| A görgetés hajtása | **CSS-animáció marad** (`translateY`, GPU, nulla per-frame JS). Csak a `--intro-start` / `--intro-end` / `--intro-duration` értékei számolódnak másképp |
| Renderelési technika | **DOM marad.** ❌ Canvas **elvetve** — a szöveg maradjon **kijelölhető és akadálymentes** |
| `<Trans>` félkövér részek | **Megmaradnak** (`intro.rule1`–`rule4`, `<1>` markup). ⚠️ A **mérésnek is** a valódi, formázott tartalmat kell mérnie, nem a nyers stringet — ezért a mérőelem **React-tel renderel**, nem string-hosszból becsül |
| Nyelvváltás az intró alatt | **Nem szabad újraszámolni és nem szabad ugrania.** A betűméret-illesztés a **közös** méret miatt nyelvfüggetlen → a `useLayoutEffect` függősége **kizárólag** a viewport, **nem** az `i18n.language`. ✅ Ez épp az eredeti döntés (`IntroScreen.tsx:18-24`) mögötti félelmet oldja meg — elegánsan, a tartalom-mérés elhagyása helyett annak **determinisztikussá tételével** |
| `DEBUG_MODE` | **Gyorsított, de ugyanolyan determinisztikus idővonal.** `INTRO_DEBUG_SPEED_MULTIPLIER` osztja a teljes időtartamot **és minden felfedési időpontot ugyanazzal a szorzóval**. ❌ Nem külön kódág (mint ma: `updateScrollPositions` rövidre zárása + fix `210s`), hanem **egyetlen szorzó**. Így a debug mód a produkciós idővonal **kicsinyített mása** — amit debugban ellenőrzünk, az élesben is igaz |
| Tesztelhetőség | A **tiszta döntési logika** `src/services/`-be, exportált, egységtesztelhető függvényekbe. ❌ **Nem** a komponensbe, ❌ **nincs és ne is legyen `src/utils/`** — a [[017-starfield-realism]] bevált mintája |
| A DOM-mérés tesztelése | **Nem tesztelhető jsdom alatt** (nincs valódi layout). Ezért a mérés eredménye **paraméter** a tiszta függvényekben — így azok `Math.random` / DOM mockolás **nélkül** tesztelhetők |
| i18n | **Nulla új kulcs.** A `dev` skill **ne indítsa** az `i18n` agentet (lásd 5. szekció) |
| `langBar`, `onSkip`, `fade` | **Változatlan** működés |

---

## ✅ Haladás (TODO)

> Jelölés: `[ ]` hátravan · `[~]` folyamatban · `[x]` kész.

**A. A hiba megerősítése (nem felderítés — igazolás)**

> ⚠️ **A záró felirat hiánya IGAZOLT, LEVEZETETT hiba, nem gyanú.** A levezetés az 1.2 szekcióban áll: a feltétel `contentH ≤ vh + 200`, ami kilenc szövegblokk mellett **gyakorlatilag elérhetetlen**. A lenti böngészős lépés **megerősítés**, nem vizsgálat — a **várt** eredmény az, hogy a felirat **mindenhol, minden nyelven hiányzik**.

- [x] Böngészős megerősítés: `DEBUG_MODE=true` (210 s-os intró) mellett végigfuttatás **legalább 2 nyelven** (leghosszabb: `fr`, legrövidebb: `hu`) és **2 képernyőméreten** (mobil portré 390×844, desktop 1920×1080) — az elvárt eredmény: a `intro.continue` felirat **egyszer sem** jelenik meg
- [x] DevTools-ban rögzítve a tényleges `contentH` (a `.scroll` `scrollHeight`-ja) mind az 5 nyelven, 3 méreten → mind a 15 érték **jóval** a `vh + 200` limit **fölött** van
- [x] ⚠️ Rögzítve a mai **számított animáció-hossz** mind a 3 képernyőméreten (`(2 × vh + 200) / 3.5` másodperc) → mindhárom érték **meghaladja** a 600 s-os `INTRO_AUTO_SKIP_TIMEOUT_MS`-t (1080p-n `674 s` ≈ 11,2 perc). **Ez független, időbeli megerősítése az 1.2 geometriai levezetésének** (1.2.1)
- [x] Rögzítve, hogy a mai intró **soha nem ér véget magától** — minden futásban az auto-skip zárja le, nem az animáció
- [x] Rögzítve, **hány blokk marad felfedetlenül** a mai modellben az animáció végén (a pozícióalapú felfedés miatt a német/francia blokkok később indulnak, mint a magyarok)
- [x] DevTools Performance profil a mai rAF-pollozásról: a `getBoundingClientRect` hívások aránya a frame-időben (ez lesz a G. blokk nyereségének mércéje)
- [x] ⚠️ Rögzítve a `intro.continue` **jelenlegi** megjelenése (ha egyáltalán kikényszeríthető, pl. a `bottom <= 0` feltétel ideiglenes `true`-ra állításával) — mind az 5 nyelven, mobil portrén. **Ez a stílus soha nem volt kipróbálva** (6.11)
- [x] ✅ **Ellenőrzési pont:** a hiba **dokumentáltan** minden nyelven és minden méreten fennáll → a terv nem peremesetet javít, hanem **szerkezeti hibát**

**B. Konstansok — `src/constants/constants.ts`**
- [x] `INTRO_SLOTS` — a rekesz-tábla: `readonly { id: IntroBlockId; heightVh: number }[]`, **9 elem** a 9 blokkra. JSDoc: **ez a terv fő hangolási felülete**; a `heightVh` a `window.innerHeight` **szorzója** (pl. `0.42` = a viewport 42%-a)
- [x] Kiinduló értékek: `headline 0.30` · `motto 0.20` · `paragraph1 0.42` · `paragraph2 0.42` · `sectionTitle 0.24` · `rule1…rule4 0.36` — **összesen 3.02 vh**. JSDoc: szubjektív kiindulás, a J. blokk hangolja élőben
- [x] `INTRO_START_PAD_VH = 1.02` — a tartalom teteje ennyi viewportnyival a képernyő **teteje alatt** kezd, azaz **2%-nyival az alsó él alatt**. JSDoc: ⚠️ **`> 1.0` kell legyen**, különben a legelső blokk nem alulról úszna be, hanem már a képernyőn állna (1.5.1). A `0.02`-es tartalék adja a ~2,6 s-os beúszást
- [x] `INTRO_END_PAD_VH = 0.10` — a tartalom alja ennyi viewportnyival a képernyő **fölött** végez. JSDoc: ez **garantálja** a `bottom <= 0` teljesülését (1.2). ⚠️ **`> 0` kell legyen** — ez a terv legfontosabb invariánsa, a rövidebb nyitópad **nem érinti**
- [x] `INTRO_TOTAL_DURATION_SEC = 540` — a görgetés teljes hossza (9 perc). JSDoc: ⚠️ **az idő fix, nem a sebesség** — ez teszi az intrót minden képernyőn azonos hosszúvá. A `540` a mai ~10 perces érzetet tartja meg **úgy, hogy közben belefér** a 600 s-os auto-skipbe (1.2.1)
- [x] `INTRO_SCROLL_DELAY_SEC = 4` — a mai `animation-delay: 4s` **nevesítve** (viselkedés-semleges kiemelés)
- [x] ⚠️ `INTRO_REVEAL_TRIGGER_RATIO = 1.0` — a képernyő **alsó éle**. JSDoc: **ez NEM a mai érték** (a mai `(window.innerHeight / 3) * 2`, azaz `2/3`) — tudatos változtatás, a rövid nyitás matematikai feltétele (1.5.1). Az I. blokk hangolásának tartaléka a `2/3`-ra visszaállás, kisebb `INTRO_START_PAD_VH`-val
- [x] `INTRO_MIN_FONT_SIZE_PX = 12` / `INTRO_MAX_FONT_SIZE_PX = 72` — az illesztés alsó/felső korlátja. JSDoc: az alsó korlát elérése **túlcsordulást** jelent (6.1)
- [x] `INTRO_FIT_PROBE_FONT_SIZE_PX = 24` — a mérés kiinduló betűmérete
- [x] `INTRO_FIT_BISECTION_STEPS = 5` — a felezéses finomítás lépésszáma. JSDoc: a szövegmagasság a betűméret **lépcsős** függvénye (a sortörés diszkrét), ezért a lineáris becslés önmagában felül- vagy alulbecsülhet
- [x] `INTRO_SCHEDULE_TICK_MS = 250` — az önkorrigáló ütemező periódusa
- [x] `INTRO_RESIZE_DEBOUNCE_MS = 250` — az újramérés debounce-a
- [x] `INTRO_RESIZE_HEIGHT_THRESHOLD_PX = 120` — ennél kisebb, **csak magasságot** érintő változás **nem** vált ki újramérést. JSDoc: mobil böngésző URL-sáv be/kigördülése (6.5)
- [x] `INTRO_DEBUG_SPEED_MULTIPLIER = 8` — debug módban ennyivel osztódik a teljes időtartam **és minden felfedési időpont**
- [x] `INTRO_FINAL_READ_MARGIN_MS = 30_000` — a záró felirat megjelenése és az auto-skip közti **kötelező** olvasási tartalék
- [x] ⚠️ A meglévő `INTRO_AUTO_SKIP_TIMEOUT_MS = 600_000` **nem változik** — de mostantól **invariáns** köti (D. blokk teszt)
- [x] ✅ **Ellenőrzési pont:** minden új konstans JSDoc-os, a `constants.ts` fordul

**C. Típusok — `src/types/index.ts`**
- [x] `IntroBlockId` — literál unió: `"headline" | "motto" | "paragraph1" | "paragraph2" | "sectionTitle" | "rule1" | "rule2" | "rule3" | "rule4"`
- [x] `IntroSlot` — `{ id: IntroBlockId; heightVh: number }`
- [x] `IntroSlotBox` — `{ id: IntroBlockId; topVh: number; heightVh: number }` (a kumulált elrendezés, **vh-egységben**)
- [x] `IntroScrollGeometry` — `{ startOffsetPx: number; endOffsetPx: number; distancePx: number; durationSec: number }`
- [x] `IntroRevealSchedule` — `{ reveals: { id: IntroBlockId; atMs: number }[]; finalInstructionAtMs: number; totalMs: number }`
- [x] `IntroFitResult` — `Record<IntroBlockId, number>` (blokkonkénti, **közös** betűméret px-ben)
- [x] JSDoc mindegyikre, kiemelten az `IntroRevealSchedule`-re: ⚠️ **a menetrend viewport-független** — nincs benne `vh` (levezetés: 1.5)

**D. Tiszta logika — `src/services/introLayout.ts` + teszt**
- [x] ⚠️ A modulok a **`src/services/`**-be kerülnek, **nem** egy új `src/utils/` mappába — a [[017-starfield-realism]] által rögzített konvenció
- [x] `computeSlotBoxes(slots: readonly IntroSlot[]): IntroSlotBox[]` — kumulatív `topVh`, **vh-egységben** (nem px!)
- [x] `totalContentVh(slots): number` — a `heightVh`-k összege
- [x] `computeScrollGeometry(params): IntroScrollGeometry` — bemenet: `{ totalVh, startPadVh, endPadVh, viewportHeightPx, durationSec, speedMultiplier }`; kimenet: `startOffsetPx = startPadVh * vh`, `endOffsetPx = -(totalVh + endPadVh) * vh`, `distancePx`, `durationSec / speedMultiplier`
- [x] ⚠️ `computeScrollGeometry` **garantálja** a záró feltételt: az `endOffsetPx` abszolút értéke **mindig nagyobb** a tartalom magasságánál (`endPadVh > 0`), tehát az utolsó blokk alja **matematikailag biztosan** kicsúszik felül. Ez a terv **legfontosabb** invariánsa (1.2)
- [x] `computeRevealSchedule(params): IntroRevealSchedule` — bemenet: `{ boxes, totalVh, startPadVh, endPadVh, triggerRatio, durationSec, delaySec, speedMultiplier }`
- [x] ⚠️ A `computeRevealSchedule` **NEM kap viewport-magasságot** — a levezetés (1.5) szerint a `vh` kiesik. Ha valaki később mégis paraméterként adná át, az **hiba jele**
- [x] Peremeset-védelem: `viewportHeightPx <= 0` vagy nem véges → biztonságos fallback (`durationSec` a minimumon, `distancePx = 0`), **sosem `NaN`**
- [x] Peremeset-védelem: `speedMultiplier <= 0` vagy nem véges → `1`
- [x] `assertIntroTimingInvariant(schedule, autoSkipMs, marginMs): boolean` — igaz, ha `finalInstructionAtMs + marginMs <= autoSkipMs`
- [x] `src/services/introLayout.test.ts` — `computeSlotBoxes`: 9 doboz, `topVh[0] === 0`, minden `topVh[i] === topVh[i-1] + heightVh[i-1]`, az utolsó alja `=== totalContentVh`
- [x] Teszt: `computeScrollGeometry` — az `endOffsetPx` **szigorúan negatívabb**, mint `-(totalVh * vh)` (a záró feltétel garanciája), **három** viewport-magasságon (844 / 1080 / 600)
- [x] Teszt: `computeScrollGeometry` — a `distancePx` **lineáris** a `viewportHeightPx`-ben (kétszeres vh → kétszeres távolság), a `durationSec` viszont **változatlan**
- [x] Teszt: `computeScrollGeometry` — `speedMultiplier = 8` → a `durationSec` pontosan nyolcada, az offsetek **változatlanok**
- [x] Teszt (**a terv központi állítása**): `computeRevealSchedule` kimenete **bitre azonos** három különböző viewport-magassággal futtatva — mert a függvény nem is kap `vh`-t. A teszt ezt **szerkezetileg** is rögzíti
- [x] Teszt: a felfedési időpontok **szigorúan monoton növők**, az első `> delaySec * 1000`, az utolsó `< finalInstructionAtMs`
- [x] Teszt: `finalInstructionAtMs < totalMs` (a felirat az animáció **vége előtt** jelenik meg)
- [x] Teszt: `speedMultiplier = 8` → **minden** felfedési időpont és a `finalInstructionAtMs` is pontosan nyolcada (a debug idővonal **arányos kicsinyítés**, nem külön logika)
- [x] Teszt (**invariáns**): `assertIntroTimingInvariant(computeRevealSchedule(INTRO_SLOTS…), INTRO_AUTO_SKIP_TIMEOUT_MS, INTRO_FINAL_READ_MARGIN_MS) === true` — ⚠️ ez a teszt **elbukik**, ha valaki a jövőben megemeli az `INTRO_TOTAL_DURATION_SEC`-et vagy a rekeszeket a 10 perces auto-skip fölé. Ez a **szándék**
- [x] Teszt: peremesetek — `vh = 0`, `vh = NaN`, `speedMultiplier = 0`, üres `slots` tömb → véges számok, nincs `NaN`, nincs kivétel
- [x] ✅ **Ellenőrzési pont:** `npm run test` zöld, az `IntroScreen.tsx` még **nem** módosult

**E. Tiszta logika — `src/services/introFit.ts` + teszt**
- [x] `estimateFittedFontSize({ probeFontSizePx, measuredHeightPx, targetHeightPx, minPx, maxPx }): number` — lineáris első becslés (`probe * target / measured`), a `[minPx, maxPx]` sávra clampelve
- [x] Peremeset: `measuredHeightPx <= 0` vagy nem véges → `probeFontSizePx` (biztonságos fallback)
- [x] `pickLargestFitting(samples: { fontSizePx: number; heightPx: number }[], targetHeightPx: number, minPx: number): number` — a **legnagyobb** olyan méret, ami még belefér; ha **egyik sem** fér bele → `minPx`
- [x] `bisectionCandidates(lowPx, highPx, steps): number[]` — a felezéses finomítás jelöltjei (a mérés **hívóoldali**, a függvény csak a jelölteket adja)
- [x] `tallestIndex(heights: number[]): number` — a leghosszabb nyelv kiválasztása a **mért magasságokból**, `NaN` / üres tömb védelemmel
- [x] `didFitOverflow(fittedPx, minPx): boolean` — igaz, ha az illesztés a **padlóra** futott, azaz a szöveg túlcsordulhat (6.1). Fejlesztői figyelmeztetés forrása
- [x] ⚠️ **Egyik függvény sem nyúl a DOM-hoz.** A mért magasságok **paraméterek** — ez teszi az egészet tesztelhetővé jsdom alatt is (5.2)
- [x] `src/services/introFit.test.ts` — `estimateFittedFontSize`: `probe=24, measured=200, target=100` → `12`; `target=400` → `48`; clamp mindkét irányban; `measured=0` → `probe`; `NaN` → `probe`
- [x] Teszt: `pickLargestFitting` — a legnagyobb beférő méretet adja; ha mind túlcsordul → `minPx`; ha mind befér → a legnagyobb jelölt; rendezetlen bemenetre is helyes
- [x] Teszt: `bisectionCandidates` — `steps` darab jelölt, mind a `[low, high]` sávban, monoton
- [x] Teszt: `tallestIndex` — `[10, 30, 20]` → `1`; holtverseny → a **legkisebb** index (determinizmus); `[]` → `-1`; `NaN` elemeket kihagy
- [x] Teszt: `didFitOverflow` — `fitted === minPx` → `true`; `fitted > minPx` → `false`
- [x] ✅ **Ellenőrzési pont:** `npm run test` zöld; a két új service együtt lefedi a terv **teljes** döntési logikáját

**F. Mérőelem + hook — `IntroMeasureProbe.tsx` és `useIntroLayout.ts`**
- [x] `src/components/screens/IntroMeasureProbe.tsx` — **képernyőn kívüli** mérőelem: `position: absolute`, `visibility: hidden`, `pointer-events: none`, `aria-hidden="true"`, `inert`
- [x] ⚠️ A mérőelem **oszlopszélessége bitre azonos** a valódi tartaloméval (ugyanaz a `max-width: 900px` + `padding`), és **ugyanazokat a CSS-osztályokat** használja (`.headline`, `.motto`, `.paragraph`, `.sectionTitle`) — különben a mérés hazudik
- [x] ⚠️ A mérőelem **React-tel renderel**, `<Trans i18nKey="intro.rule1" t={i18n.getFixedT(lng)} components={{ 1: <strong /> }} />` alakban — tehát a **valódi, formázott** tartalmat méri, a `<strong>` súlyával együtt, **nem** a nyers stringet
- [x] A mérőelem **9 blokk × 5 nyelv = 45** csomópontot renderel, `ref`-ekkel
- [x] `src/hooks/useIntroLayout.ts` — a mérést és az illesztést vezénylő hook. **Kimenet:** `{ ready, fontSizes, geometry, schedule }`
- [x] ⚠️ A hook `useLayoutEffect`-et használ, hogy a méretek a **festés előtt** beálljanak (nincs villanás rossz betűmérettel)
- [x] ⚠️ **Betűtöltés bevárása:** a mérés **csak `await document.fonts.ready` után** indul. Enélkül a fallback-betűkészlet metrikáit mérnénk, és **az összes** illesztés hibás lenne (6.4). `document.fonts` hiánya esetén (régi böngésző) azonnali folytatás
- [x] Mérési menet 1: mind az **5 nyelv** mérése blokkonként a `INTRO_FIT_PROBE_FONT_SIZE_PX` próbaméreten → `tallestIndex` blokkonként (**45 mérés**)
- [x] Mérési menet 2: **csak a legmagasabb** nyelvre felezéses finomítás, blokkonként (**9 × 5 = 45 mérés**) — a betűméretet a próbaelem DOM-csomópontján **imperatívan** állítva, React-újrarenderelés **nélkül**
- [x] Mérési menet 3 (**ellenőrző**): a végleges méreten **mind az 5 nyelv** újramérése (**45 mérés**); ha bármelyik túlcsordul, a méret **egy lépcsőt lejjebb**. ⚠️ Ez fedi le azt az esetet, amikor a próbaméreten legmagasabb nyelv a **végleges** méreten már nem a legmagasabb (eltérő sortörés — 7.3)
- [x] Összesen **~135 mérés** viewportonként, **egyszer**. JSDoc-ban rögzítve, miért nem több
- [x] A hook a tiszta függvényeket hívja (`introFit`, `introLayout`) — **saját matematikát nem tartalmaz**
- [x] Resize-kezelés: `INTRO_RESIZE_DEBOUNCE_MS` debounce; ⚠️ **magasság-változás** csak akkor vált ki újramérést, ha meghaladja az `INTRO_RESIZE_HEIGHT_THRESHOLD_PX`-et (mobil URL-sáv, 7.5). **Szélesség**-változás mindig kivált
- [x] ⚠️ A hook effekt-függősége **kizárólag** a viewport-méret — **NEM** az `i18n.language`. Nyelvváltáskor **nincs** újramérés és **nincs** ugrás (1.7)
- [x] A mérőelem a mérés befejeztével **unmountolódik** (nem marad 45 rejtett szövegcsomópont a DOM-ban)
- [x] ✅ **Ellenőrzési pont:** DevTools-ban a mérési menet **egyszer** fut, `< 150 ms` alatt; nyelvváltásra **nem** fut újra; a rejtett próbaelem a mérés után **nincs** a DOM-ban

**G. `IntroScreen.tsx` átírása**
- [x] Az `updateScrollPositions` **törölve** — helyette a `useIntroLayout` kimenete
- [x] A `requestAnimationFrame` hurok (`IntroScreen.tsx:104-114`) **törölve**, a `checkBlocks` / `getBoundingClientRect` logikával együtt
- [x] Új: **önkorrigáló ütemező** — egyetlen `setInterval(INTRO_SCHEDULE_TICK_MS)`, ami a `performance.now() - baseline`-t veti össze a `schedule.reveals` időpontjaival, és felfedi **az összes** lejárt blokkot
- [x] Az időalap (`baseline`) **pontosan akkor** rögzül, amikor az animáció elindul (a `ready` állapotba lépéskor) — nem a mountoláskor
- [x] A `schedule.finalInstructionAtMs` elérésekor `setInstructionsVisible(true)`, majd az ütemező **leáll** (nincs felesleges timer)
- [x] A 9 blokk `data-intro-block` attribútuma **megmarad** (a felfedés továbbra is `styles.blockVisible` osztállyal történik) — ⚠️ de a kiválasztás mostantól **`data-intro-block-id`** szerint megy, nem sorrend szerint, hogy a menetrend és a DOM **nevesítve** kapcsolódjon
- [x] Minden blokk a rekeszét CSS-változóból kapja: `style={{ "--intro-slot-height": `${box.heightVh * 100}vh` }}`
- [x] Minden blokk a **közös** betűméretét CSS-változóból kapja: `style={{ "--intro-font-size": `${fontSizes[id]}px` }}`
- [x] A `--intro-start` / `--intro-end` / `--intro-duration` a `geometry`-ből
- [x] ⚠️ Az animáció `animation-play-state: paused` állapotban indul, és **csak a mérés befejeztével** vált `running`-ra (`data-ready="true"`). Enélkül az első képkockák rossz betűmérettel és rossz offsettel futnának
- [x] `DEBUG_MODE`: a `INTRO_SCROLL_DURATION = "210s"` konstans és a `DEBUG_MODE ? … : undefined` inline stílus-ág **törölve**; helyette a `speedMultiplier` paraméter megy a `useIntroLayout`-ba
- [x] A `langBar`, az `onSkip` (`onClick` az overlayen), a `stopPropagation` hármas és a `styles.fade` **érintetlen**
- [x] ⚠️ A `import.meta.env.VITE_DEBUG_MODE` sor (`IntroScreen.tsx:10`) **megmarad a jelenlegi formájában** — lásd a 020-szal való ütközést (6.12)
- [x] ✅ **Ellenőrzési pont:** `tsc --noEmit` tiszta; a komponensben **nulla** `getBoundingClientRect` és **nulla** `requestAnimationFrame` maradt

**H. `IntroScreen.module.css` átalakítása**
- [x] ⚠️ **Az `.overlay` `align-items: center` → `flex-start`** (illetve a `.content` `position: absolute; top: 0`). **Ez a legfontosabb CSS-változás:** a mai függőleges központozás miatt a tartalom teteje `(vh − contentH) / 2`-nél van, ami **tartalomfüggő** — pontosan ez a tag teszi kiszámíthatatlanná a záró feltételt (1.2). Felülre horgonyozva a `translateY` **közvetlenül** képernyő-koordináta
- [x] Új `.slot` osztály: `min-height: var(--intro-slot-height); display: flex; flex-direction: column; justify-content: flex-start;` — a **fix rekesz**
- [x] A blokkok betűmérete: `font-size: var(--intro-font-size, clamp(...))` — ⚠️ a **mai `clamp()` marad fallbacknek**, hogy JS-hiba esetén se legyen olvashatatlan a szöveg (6.9)
- [x] A `.headline` / `.motto` / `.paragraph` / `.sectionTitle` többi tulajdonsága (szín, `letter-spacing`, `line-height`, `text-shadow`, `text-transform`) **változatlan**
- [x] Az `.overlay` `overflow: hidden` **marad** — a megnőtt tartalom nem hozhat létre görgetősávot
- [x] `.scroll`: `animation-play-state: paused;` alapból, `[data-ready="true"] &` → `running`
- [x] ⚠️ **`.finalInstruction` átméretezése** — a `width: 33%` fix érték + `letter-spacing: 0.4em` + `text-transform: uppercase` kombináció **soha nem volt kipróbálva** (6.11). Új: `width: min(90%, 640px)`, `max-width` a viewporthoz kötve, `letter-spacing` `clamp`-pel csökkentve kis képernyőn, `font-size` `clamp`-pel
- [x] A `@media (max-width: 600px)` blokk kiegészítve a `.finalInstruction` mobil-változatával
- [x] ✅ **Ellenőrzési pont:** a `intro.continue` mind az 5 nyelven **kifér** és **olvasható** 390 px széles képernyőn (a leghosszabb: `fr`, 62 karakter)

**I. Idővonal-hangolás (`DEBUG_MODE` + élő)**
- [x] Debug módban végigfuttatás: `INTRO_DEBUG_SPEED_MULTIPLIER = 8` → **~68 mp**-es teljes intró (544 / 8), a felfedések arányosan
- [x] Ellenőrizve, hogy a debug idővonal a produkciós **arányos kicsinyítése**: a blokkok **relatív** időpontjai (a teljes hosszhoz viszonyítva) azonosak
- [x] Élő hangolás: `INTRO_SLOTS` magasságok — a rekeszek ne legyenek se zsúfoltak, se kongóan üresek **magyarul**
- [x] ⚠️ Élő hangolás: **a felfedés jellege az alsó élnél** (`INTRO_REVEAL_TRIGGER_RATIO = 1.0`). Ez a mai `2/3`-hoz képest **változás mind a 9 blokkra** (1.5.1) — élőben kell megítélni, hogy a beúszó jelleg jobb-e a mai „középen materializálódásnál". **Dokumentált tartalék:** `r = 2/3` + `s = 0.688`, azzal az árral, hogy a legelső blokk nem úszik be. ⚠️ **Csak felhasználói jóváhagyással**
- [x] Élő hangolás: `INTRO_TOTAL_DURATION_SEC = 540` — az olvasási tempó. ⚠️ A mai effektív tempó ~3.5 px/s (nagyon lassú, tudatosan AFK-jellegű), a mai **látható** hossz pedig az auto-skip miatt 600 s (1.2.1). Az `540` ehhez képest alig tér el. **Emelése erősen korlátozott:** a D. blokk invariáns-tesztje `570 s`-nál (`600 − 30`) elvágja, és az `INTRO_AUTO_SKIP_TIMEOUT_MS` emelése **nem része a hatókörnek** (7.6)
- [x] Élő hangolás: `INTRO_START_PAD_VH = 1.02` — ez határozza meg, mennyit vár a néző az **első** blokkra (~6,6 mp). ⚠️ **Nem csökkenthető `1.0` alá**, mert akkor a legelső blokk már a képernyőn állna, és nem úszna be alulról (1.5.1). Növelése az első blokk késleltetését **erősen** növeli (`+0.01 vh` ≈ `+1,3 s`)
- [x] A végleges értékek visszaírva a `constants.ts` JSDoc-jaiba (a [[017-starfield-realism]] K. blokkjának mintájára)
- [x] ✅ **Ellenőrzési pont:** a hangolt idővonal átmegy a D. blokk invariáns-tesztjén (`npm run test` zöld a hangolás **után** is)

**J. Validáció + kézi mátrix**
- [x] `tsc --noEmit` hibamentes
- [x] `npm run test` zöld (meglévő 147 + az új service-tesztek)
- [x] `npm run build` sikeres
- [x] A 8. szekció **teljes 5 × 3-as mátrixa** lefuttatva (15 kombináció)
- [x] ✅ **Ellenőrzési pont — POZÍCIÓ:** a blokkok mind az 5 nyelven **azonos képernyő-pozícióban** jelennek meg (képernyőkép-összevetés azonos időbélyegnél)
- [x] ✅ **Ellenőrzési pont — IDŐ:** a blokkok mind az 5 nyelven és mind a 3 méreten **azonos időpontban** jelennek meg (stopper / képernyőfelvétel, ±1 mp tűrés)
- [x] ✅ **Ellenőrzési pont — ZÁRÓ FELIRAT:** a `intro.continue` **mind a 15 kombinációban megjelenik**, és a **10 perces auto-skip előtt legalább 30 mp-cel** (számított: ~531 mp, tehát ~69 mp tartalékkal). ⚠️ Ez **önálló sikerkritérium**, nem a pozíció-ellenőrzés része (1.2 / 6.11)
- [x] ✅ **Ellenőrzési pont — MAGÁTÓL VÉGET ÉR:** az animáció ~544 mp-nél lezárul, és a jelenet **ott marad** — a képernyő nem ugrik tovább magától. ⚠️ **Új viselkedés**, ma az auto-skip vágja el (1.2.1 / 8.2 21. forgatókönyv)
- [x] ✅ **Ellenőrzési pont — NYITÁS:** a címsor mind a 15 kombinációban **5-10 mp-en belül** megjelenik, és **alulról úszik be** (1.5.1 / 8.2 22. forgatókönyv)
- [x] DevTools Performance: a rAF-pollozás megszűnésének nyeresége az A. blokk profiljához mérve
- [x] ✅ **Ellenőrzési pont:** az intró alatt **nincs** per-frame JS a főszálon (a görgetés tisztán CSS/compositor, az ütemező 4 ébredés/mp)

**K. Ellenőrzött nem-tételek (tudatosan kimaradó hatókör)**
- [x] Ellenőrizve: **nulla új i18n kulcs**, az `src/i18n/locales/**` egyike sem módosult, a paritás mind az 5 nyelven változatlan (5. szekció)
- [x] Ellenőrizve: a `<Trans>` félkövér részek (`intro.rule1`–`rule4`) **megvannak** és helyesen renderelnek mind az 5 nyelven
- [x] Ellenőrizve: a szöveg **kijelölhető** egérrel (nem canvas), és a képernyőolvasó a valódi szöveget olvassa
- [x] Ellenőrizve: a mérőelem **nincs** az akadálymentességi fában és **nincs** a kijelölésben (`aria-hidden` + `visibility: hidden` + unmount)
- [x] Ellenőrizve: a `langBar` az intró alatt továbbra is elérhető, és a nyelvváltás **nem** indít újramérést, **nem** ugrat és **nem** indítja újra az animációt
- [x] Ellenőrizve: az `onSkip` (kattintás / billentyű / érintés) minden fázisban működik, az `App.tsx` `INTRO_AUTO_SKIP_TIMEOUT_MS` időzítője **érintetlen**
- [x] Ellenőrizve: a `styles.fade` (`introFade 45s`) animáció **változatlan**
- [x] Ellenőrizve: **nem jött létre `src/utils/` mappa**
- [x] Ellenőrizve: nincs **nyelvenkénti** betűméret (a felhasználó ezt elutasította) — a `fontSizes` **egyetlen** rekord, nem `Record<lang, …>`
- [x] Ellenőrizve: nincs canvas-alapú szövegrenderelés (elutasítva)

---

## 1. Architektúra

### 1.1 A jelenlegi felállás és annak két következménye

A mai `IntroScreen` (~230 sor) három, egymástól független mechanizmust futtat:

1. **Görgetés** — CSS-animáció, aminek a kezdő- és végpontját a JS a **viewport magasságából** számolja (`IntroScreen.tsx:25-49`). A görgetési út fixen `2 × vh + 200` px.
2. **Felfedés** — `requestAnimationFrame` hurok, ami képkockánként `getBoundingClientRect()`-tel nézi, hogy a következő blokk átlépte-e a viewport 2/3-át (`IntroScreen.tsx:74-91`).
3. **Záró felirat** — akkor jelenik meg, ha az utolsó blokk **teljesen kicsúszik felül** (`bottom <= 0`, `IntroScreen.tsx:93-101`).

A tartalom magassága viszont nyelvenként **+16%**-ban szór (a nyers karakterszám alapján: `hu` 1228 → `fr` 1423), blokkszinten pedig **+28%**-ig (`sectionTitle`). Ebből a **két következmény**, amit a terv megszüntet:

**(a) A felfedés pozícióalapú, tehát nyelvfüggő.** Egy blokk pozíciója a **fölötte lévő** szövegek összhosszától függ. Németül minden blokk lejjebb kezd, mint magyarul, tehát később éri el a kioldó vonalat. Az intró „ritmusa" nyelvenként más.

**(b) A záró felirat gyakorlatilag soha nem jelenik meg.** Lásd 1.2 — ez nem peremeset, hanem szerkezeti hiba.

### 1.2 ⚠️ A záró felirat hiánya — igazolt hiba, levezetéssel

Ez **nem** gyanú és **nem** nyelvfüggő peremeset. A levezetés:

Az `.overlay` (`IntroScreen.module.css:1-12`) `display: flex; align-items: center`, tehát a `.content` **függőlegesen középre igazul**, és a teteje:

```
contentTop = (vh − contentH) / 2
```

(Ez negatív is lehet, ha a tartalom magasabb a viewportnál; a flex-központozás ilyenkor egyenlően lóg ki fent és lent, tehát a képlet **érvényes marad**.)

Az animáció végén `translateY = −(vh + 100)` (`IntroScreen.tsx:39`). Az utolsó blokk aljának képernyő-koordinátája:

```
bottom = (vh − contentH)/2 + contentH − (vh + 100)
       = vh/2 − contentH/2 + contentH − vh − 100
       = contentH/2 − vh/2 − 100
```

Az `instructionsVisible` feltétele (`IntroScreen.tsx:97`) `bottom <= 0`, azaz:

```
contentH/2 − vh/2 − 100 ≤ 0
──────────────────────────────
        contentH ≤ vh + 200
──────────────────────────────
```

| Viewport magasság | Megengedett `contentH` |
|---|---|
| 1080 px (desktop) | ≤ 1280 px |
| 800 px (laptop) | ≤ 1000 px |
| 667 px (mobil portré) | ≤ 867 px |

**Kilenc szövegblokkal** (címsor, mottó, 2 bekezdés, szekciócím, 4 szabály) ezek a limitek **gyakorlatilag elérhetetlenek** — a tartalom minden reális esetben jóval magasabb. A záró felirat tehát **minden nyelven és minden képernyőméreten hiányzik**.

**Miért nem panaszkodott rá senki:** az egész overlay **kattintásra kihagyható** (`onClick={onSkip}`, `IntroScreen.tsx:118`), tehát a felhasználók eleve kattintanak — vagy a 10 perces `INTRO_AUTO_SKIP_TIMEOUT_MS` zárja le a jelenetet. A hiba **néma**.

**A valódi szerkezeti hiba** a `contentH ≤ vh + 200` feltétel maga: az animáció végpontja a **viewportból** származik, a tartalom magassága viszont a **szövegből** — és a kettő között **semmi kapcsolat nincs**. A javasolt determinisztikus modell épp azért oldja meg, mert benne a `contentH` **ismert és fix** (`Σ heightVh × vh`), tehát a végpont **pontosan belőle** számolható:

```
endOffsetPx = −(totalVh + INTRO_END_PAD_VH) × vh
```

Mivel `INTRO_END_PAD_VH > 0`, az utolsó blokk alja az animáció végén **matematikailag garantáltan** `−INTRO_END_PAD_VH × vh < 0` pozícióban van. **A hiba nem javul, hanem megszűnik lehetségesnek lenni.**

A H. blokk `align-items: center` → `flex-start` változtatása ehhez elengedhetetlen: a központozás `(vh − contentH)/2` tagja **tartalomfüggő** eltolás, ami épp a determinizmust rontaná el. Felülre horgonyozva a `translateY` **közvetlenül** képernyő-koordináta.

### 1.2.1 ⚠️ Független, időbeli megerősítés: a mai intró sosem ér véget magától

A geometriai levezetés (1.2) mellett a hiba **időben is** kimutatható, teljesen más úton — és ez a második levezetés **nem is a záró feliratról szól**, hanem az intró egészéről.

A mai időtartam-számítás (`IntroScreen.tsx:42-44`):

```
totalDist   = (vh + 100) − (−(vh + 100)) = 2 × vh + 200
durationSec = max(120, round(totalDist / 3.5))
```

| Viewport magasság | `totalDist` | Animáció hossza |
|---|---|---|
| 1080 px (desktop) | 2360 px | **674 s** ≈ 11,2 perc |
| 844 px (mobil portré) | 1888 px | **539 s** ≈ 9,0 perc |
| 1180 px (tablet) | 2560 px | **731 s** ≈ 12,2 perc |

Az `INTRO_AUTO_SKIP_TIMEOUT_MS` viszont **600 s** (`constants.ts:28`). Desktopon és tableten tehát az animáció **hosszabb, mint a türelmi idő**: a jelenetet **mindig az auto-skip vágja el**, nem az animáció zárja le.

**Két következtetés:**

1. **A záró felirat időben sem férne bele**, még akkor sem, ha a geometriai feltétel (1.2) valahogy teljesülne. A hiba tehát **kettősen** zárt: sem a pozíció, sem az idő nem engedi meg.
2. **A mai intró hossza nem is definiált** — nem az, amit a kód számol (674 s), hanem az, amit az auto-skip enged (600 s). A „mai ~10 perces érzet" valójában **a 11,2 percből levágott 10 perc**, aminek a **vége hiányzik**.

Ebből következik az `INTRO_TOTAL_DURATION_SEC = 540` választása: a felhasználó a mai lassú, hangulatos tempó megtartását kérte, és a **540 s ehhez képest alig tér el** (a mai *látható* 600-ból 540) — cserébe viszont az intró **először a projekt történetében magától ér véget**, 56 s-mal az auto-skip előtt.

> ⚠️ **Ez önmagában viselkedésváltozás**, függetlenül a záró felirattól: a képernyő a jelenet végén **nem** ugrik tovább magától közvetlenül a felirat után, hanem megvárja a felhasználót (vagy a 600 s-os auto-skipet). A 8.2 / 21. forgatókönyv ezt kifejezetten ellenőrzi.

### 1.3 A cél-felállás

```
src/constants/constants.ts
  INTRO_SLOTS (9 rekesz, vh-arányos)     ← a fő hangolási felület
  INTRO_TOTAL_DURATION_SEC, PAD-ok, …
             │
             ▼
src/services/introLayout.ts     ─┐  tiszta függvények, DOM nélkül
  computeSlotBoxes               │  → Vitesttel teljesen tesztelhetők
  totalContentVh                 │
  computeScrollGeometry          │
  computeRevealSchedule          │  ⚠️ NEM kap viewport-magasságot (1.5)
  assertIntroTimingInvariant    ─┤
src/services/introFit.ts        ─┤
  estimateFittedFontSize         │  ⚠️ a MÉRT magasságok PARAMÉTEREK,
  pickLargestFitting             │     a függvények nem mérnek
  bisectionCandidates            │
  tallestIndex                   │
  didFitOverflow                ─┘
             │
             ▼
src/hooks/useIntroLayout.ts       (a mérés vezénylése — NEM tesztelhető jsdomban)
  await document.fonts.ready
  3 mérési menet a próbaelemen  ──▶ fontSizes
  a tiszta függvények hívása    ──▶ geometry + schedule
             │
             ▼
src/components/screens/IntroScreen.tsx        (csak megjelenítés + ütemező)
  IntroMeasureProbe (offscreen, aria-hidden, unmountol a mérés után)
  CSS-változók: --intro-start / --intro-end / --intro-duration
                --intro-slot-height / --intro-font-size (blokkonként)
  egyetlen 250 ms-os önkorrigáló timer   ← a rAF-pollozás HELYETT
```

A megosztás elve **azonos a [[017-starfield-realism]]-ével**: *ami tiszta függvény, az kikerül és tesztelhető; ami DOM-állapot, az marad.*

> **Miért a `src/services/` és miért nem egy új `src/utils/`.** A projektben **nincs** `utils` top-level mappa, és nem is kell: a `src/services/` pontosan ezt a réteget jelenti — keretrendszer-független, tiszta domain-modulok kolokált teszttel (`faceRecognition.ts`, `cameraPermission.ts`, `starColor.ts`, `starfieldMath.ts`). Egy párhuzamos „utils" mappa csak annyit érne el, hogy két helyen kellene keresni ugyanazt a fajta kódot.

### 1.4 Fix, arányos rekeszek

Minden blokk `vh`-arányos, **fix magasságú** helyet kap:

```
┌─ startPad (1.02 vh) ──────────── a tartalom teteje 2%-nyival az ALSÓ ÉL alatt
├─ headline       0.30 vh
├─ motto          0.20 vh
├─ paragraph1     0.42 vh
├─ paragraph2     0.42 vh
├─ sectionTitle   0.24 vh
├─ rule1          0.36 vh
├─ rule2          0.36 vh
├─ rule3          0.36 vh
├─ rule4          0.36 vh          ─── totalVh = 3.02
└─ endPad (0.10 vh) ────────────── a képernyő FÖLÖTT végez  ⚠️ > 0 → az 1.2 garanciája
                                    distance = 1.02 + 3.02 + 0.10 = 4.14 vh
```

A szöveg a rekeszen belül **felülre** igazul. Ez a döntés a sikerkritériumból következik: ha a szöveg középre igazulna, a rövidebb nyelv **első sora lejjebb** kezdene, tehát a blokk „megjelenési pozíciója" nyelvenként eltérne — pontosan az, amit meg akarunk szüntetni. A rövid nyelveknél maradó üres hely a rekesz **alján** gyűlik össze, ahol a következő blokk előtti térközt növeli — vizuálisan ez a legkevésbé zavaró hely.

### 1.5 A felismerés: a menetrend viewport-független konstans

Legyen a rekeszek kumulált teteje `a_i` (vh-egységben), `s = INTRO_START_PAD_VH`, `e = INTRO_END_PAD_VH`, `total = Σ heightVh`, `r = INTRO_REVEAL_TRIGGER_RATIO`, `T = INTRO_TOTAL_DURATION_SEC`, `D = s + total + e` (a teljes út vh-ban).

A görgetés **állandó sebességű** (lineáris CSS-animáció), és a sebesség:

```
v = D × vh / T     [px/s]
```

A blokk *i* teteje a képernyőn (felülre horgonyzott tartalommal): `translateY(t) + a_i × vh`. A kioldás akkor történik, amikor ez eléri az `r × vh` vonalat:

```
t_i = delay + T × (s + a_i − r) / D
                    ▲
                    └── a vh KIESIK: számláló és nevező is vh-arányos
```

**Ebből következik a terv központi állítása:** mivel a rekeszek `vh`-arányosak **és** a teljes időtartam fix, a felfedési időpontok **tiszta konstansok** — se a képernyőmérettől, se a nyelvtől nem függnek. A viewport **kizárólag** a px/s sebességet befolyásolja, az időzítést nem.

A **véglegesített** táblával (`T = 540 s`, `delay = 4 s`, `s = 1.02`, `e = 0.10`, `D = 4.14`, `r = 1.0`), ahol `k = T / D = 130.43`:

| Blokk | `a_i` (vh) | Megjelenés |
|---|---|---|
| headline | 0.00 | **~6,6 s** |
| motto | 0.30 | ~45,7 s |
| paragraph1 | 0.50 | ~71,8 s |
| paragraph2 | 0.92 | ~126,6 s |
| sectionTitle | 1.34 | ~181,4 s |
| rule1 | 1.58 | ~212,7 s |
| rule2 | 1.94 | ~259,7 s |
| rule3 | 2.30 | ~306,6 s |
| rule4 | 2.66 | ~353,6 s |
| **`intro.continue`** | (alja: 3.02) | **~531,0 s** |
| **Az animáció vége** | | **544 s** (~9,07 perc) |
| **Auto-skip** | | 600 s |

**Három dolgot érdemes leolvasni a tábláról:**

1. **Az első címsor ~6,6 s-nál van** — a felhasználó által kért 5-10 s-os sávban, a korábbi vázlat ~47 s-os nyitó csendje helyett.
2. **A záró felirat ~69 s-nyi olvasási időt kap** (600 − 531), és az animáció **56 s-mal az auto-skip előtt** magától véget ér (544 < 600). A D. blokk invariáns-tesztje (`531 + 30 = 561 ≤ 600`) ezt **gépileg rögzíti** — ha valaki később megemeli a rekeszeket vagy az időtartamot a határon túl, a teszt **elbukik**.
3. **A tartalom több időt kapott, nem kevesebbet.** A nyitópad rövidítése és a hosszabb alapidő együtt a blokkok közti térközt **+31%**-kal növelte: a szabály-blokkok (`0.36 vh`) a korábbi vázlatban ~35,8 s-onként követték egymást, most **~47,0 s**-onként. A tartalomra jutó idő `300 s` → **`394 s`**. Ez azért fontos, mert a szövegek hosszúak — a rövidebb nyitás nem sietteti a jelenetet, hanem **átcsoportosítja** az időt oda, ahol olvasnivaló van.

### 1.5.1 ⚠️ Miért mozdult el a kioldó vonal `2/3`-ról `1.0`-ra

A rövid nyitás nem szabadon választható: állandó sebességű görgetésnél **három követelmény feszül egymásnak**, és a matematika csak kettőt enged egyszerre.

| # | Követelmény | Forrás |
|---|---|---|
| **(a)** | A legelső blokk **alulról ússzon be** (ne a képernyőn állva tűnjön elő) | felhasználói megkötés |
| **(b)** | A legelső blokk **5-10 s-on belül** jelenjen meg | felhasználói döntés (2. kérdés) |
| **(c)** | A teljes hossz **540 s**, állandó sebességgel | felhasználói döntés (1. kérdés) |

A (c)-ből a sebesség 1080p-n `4.14 × 1080 / 540 = 8,28 px/s`. A (b)-ből a késleltetés levonása után ~3 s marad a mozgásra, ami **~25 px** megtett utat jelent. Tehát **a legelső blokknak a felfedési vonalától legfeljebb ~25 px-re szabad kezdenie.**

Az (a) viszont azt követeli, hogy a blokk az **alsó él alatt** kezdjen. A két feltétel csak akkor fér össze, ha a **felfedési vonal maga is az alsó élnél van** — azaz `r = 1.0`. A `2/3`-os vonal `0.333 × vh = 360 px`-re van az alsó éltől, ami ezen a sebességen **43 s**; a (b) mellett tehát a `2/3` és az (a) **kizárja egymást**.

**A választott feloldás:** `r = 1.0`, `s = 1.02`. A tartalom teteje 2%-nyival (1080p-n ~22 px) az alsó él alatt kezd, ~2,6 s alatt eléri az élt, és ott fed fel. Az (a), (b), (c) mind teljesül.

**Mit jelent ez vizuálisan.** A szöveg mostantól **az alsó élnél, teljes fedettséggel** úszik be, ahelyett hogy a képernyő 2/3-ánál materializálódna. Két mellékhaszon:

- **Megszűnik a mai, állandóan üres alsó képernyőharmad.** A mai modellben a `2/3` vonal alatti sáv mindig üres (a blokkok ott már a helyükön vannak, de `opacity: 0`), tehát a képernyő harmada kihasználatlan.
- **Közelebb kerül a valódi Star Wars-crawlhoz**, ahol a szöveg a kép aljánál teljes fedettséggel lép be, és nem tűnik elő menet közben.

⚠️ **Ez viszont a felfedés jellegének változása mind a 9 blokkra**, nem csak az elsőre — élőben ellenőrizendő (I. blokk). A `.block` átmenete (`opacity` + `translateY(40px)`, 1,5 s) a felfedés pillanatában az alsó élnél zajlik, ahol a blokk teteje még csak ~12 px-re van bent; a felúszás közben tehát a szöveg **már opakká vált**.

**Dokumentált tartalék**, ha a peremnél való felfedés élőben nem tetszik: vissza `r = 2/3`-ra, `s = 0.688`-cal. Ekkor a 2–9. blokk középen fed fel (a mai jelleg), az első blokk viszont **nem úszik be**, hanem helyben tűnik elő a képernyő 2/3-ánál — azaz az (a) követelmény sérül, cserébe a (b) és (c) teljesül. Ez tudatos csere, nem javítás; **csak a felhasználó jóváhagyásával**.

### 1.6 Közös betűméret-illesztés — a mérési eljárás

A „leghosszabb nyelv" **nem** a karakterszámból dől el. A karakterszám csak közelítés: a német összetett szavak hosszabb, tördeletlen egységeket adnak, a francia több rövid szót, az ékezetes karakterek szélessége eltér, és a `<strong>` szakaszok szélesebbek. **A tényleges renderelt magasság** számít.

```
document.fonts.ready
      │
      ▼
1. menet ─ 9 blokk × 5 nyelv @ 24 px próbaméret ──▶ tallestIndex(heights) blokkonként
      │                                              (45 mérés)
      ▼
2. menet ─ csak a legmagasabb nyelvre:
           lineáris becslés  →  estimateFittedFontSize(...)
           majd 5 lépéses felezés a próbaelem DOM-csomópontján
           (imperatív font-size állítás, React-renderelés NÉLKÜL)   (9 × 5 = 45 mérés)
      │
      ▼
3. menet ─ ELLENŐRZÉS: a végleges méreten MIND az 5 nyelv újramérése
           bármelyik túlcsordul → egy lépcsővel kisebb méret         (45 mérés)
      │
      ▼
fontSizes: Record<IntroBlockId, number>   ← EGY méret blokkonként, mind az 5 nyelvre
```

**Miért kell a felezés a lineáris becslés után.** A szöveg magassága a betűméret **lépcsős** függvénye: a sortörés diszkrét, tehát egy 1 px-es méretcsökkentés hol semmit nem változtat, hol egy egész sort megspórol. A lineáris becslés (`probe × target / measured`) ezért felül- vagy alulbecsülhet; a felezés a becslés körül keresi meg a **legnagyobb, még beférő** méretet.

**Miért kell a 3. ellenőrző menet.** A próbaméreten legmagasabb nyelv nem feltétlenül a legmagasabb a **végleges** méreten: eltérő sortöréssel a sorrend megfordulhat (6.3).

**Miért React-tel renderel a próbaelem.** Az `intro.rule1`–`rule4` kulcsok `<1>` markupot tartalmaznak, amit a `<Trans>` `<strong>`-gá alakít. A félkövér szöveg **szélesebb**, tehát máshol tör. Egy nyers `i18n.t()` string mérése **rendszeresen alulbecsülne**. A próbaelem ezért `<Trans t={i18n.getFixedT(lng)} components={{ 1: <strong /> }} />` alakban rendereli a **valódi** tartalmat.

### 1.7 Nyelvváltás az intró alatt — az eredeti félelem feloldása

A mai kód kommentje (`IntroScreen.tsx:18-24`) így indokolja a tartalommérés elhagyását:

> *„A tartalom magasságát (contentHeight) NEM használjuk, mert az nyelvenként eltérő hosszúságú szövegek miatt változó pozíciókat és ugrálást okozna."*

**A félelem jogos volt, a következtetés viszont túl erős.** Az új modellben:

- a **rekeszek** `vh`-arányosak, tehát nyelvfüggetlenek;
- a **betűméret** a leghosszabb nyelvhez illeszkedik, és **közös** — tehát nyelvfüggetlen;
- a **menetrend** viewport- és nyelvfüggetlen konstans (1.5).

Ebből következik, hogy nyelvváltáskor **semmit nem kell újraszámolni**: a `useIntroLayout` effekt-függősége **kizárólag** a viewport-méret, **nem** az `i18n.language`. A `<Trans>` és a `t()` új szöveget renderel a **változatlan** rekeszekbe, változatlan betűmérettel — se a görgetés, se az ütemező nem indul újra, és **nincs ugrás**.

> ⚠️ Ez a bekezdés **szándékosan explicit**: egy későbbi session ne vezesse be az `i18n.language`-et a mérési effekt függőségei közé „hogy pontosabb legyen az illesztés". Az pontosan a **per-nyelv** illesztés lenne, amit a felhasználó elutasított.

### 1.8 Időalapú felfedés a rAF-pollozás helyett

A mai hurok képkockánként **9 `getBoundingClientRect()`** hívást végezhet (`IntroScreen.tsx:104-114`). A `getBoundingClientRect` **kényszerített layoutot** vált ki, tehát ez a legdrágább fajta per-frame munka — és mindezt egy jelenetben, ami **7-10 percig** fut.

Fix rekeszek + állandó sebesség mellett a felfedés ideje **analitikusan ismert** (1.5), tehát a pollozás **teljesen felesleges**. Helyette:

```
baseline = performance.now()                  ← az animáció indulásának pillanata
setInterval(250 ms):
    elapsed = performance.now() − baseline
    minden még fel nem fedett blokkra, ahol atMs <= elapsed:  felfed
    ha elapsed >= finalInstructionAtMs:  felirat + a timer LEÁLL
```

**Miért nem blokkonkénti `setTimeout`.** Háttérfülön a böngésző a `setTimeout`-ot **≥1 s-ra clampeli**, és a fülre visszatéréskor a lemaradt időzítők **sorban, gyors egymásutánban** sülnének el — a blokkok „bezuhannának". Az önkorrigáló, eltelt időt vizsgáló timer viszont **egyszerre** fedi fel az összes lejárt blokkot, ami **helyes**: a CSS-animáció a háttérben is végig futott, tehát azok a blokkok valóban elhagyták a kioldó vonalat.

**Nyereség:** 60 ébredés/mp + 540 layout-kényszerítés/mp helyett **4 ébredés/mp, nulla layout-kényszerítés**. A görgetés maga tisztán a compositoron marad.

### 1.9 `DEBUG_MODE` az új modellben

| | Ma | Ezután |
|---|---|---|
| Mechanizmus | `updateScrollPositions` **rövidre zárva** (`return` a legelején), fix `INTRO_SCROLL_DURATION = "210s"` inline stílus | **Egyetlen szorzó**: `INTRO_DEBUG_SPEED_MULTIPLIER = 8` osztja a `durationSec`-et **és minden** felfedési időpontot |
| Következmény | A debug idővonal a produkcióstól **szerkezetileg** eltér: az offsetek a CSS fallback értékeire esnek vissza (`87.5vh` / `-250%`), tehát **más geometria**. Amit debugban ellenőrzünk, az élesben nem feltétlenül igaz | A debug idővonal a produkciós **arányos kicsinyítése** — azonos geometria, azonos relatív időpontok. Amit debugban látunk, az élesben is igaz |
| Teljes hossz | 210 s | **~68 s** (544 / 8) |
| Első címsor | (a CSS fallback geometriája szerint, kiszámíthatatlan) | **~0,8 s** (6,6 / 8) |
| Záró felirat | soha (1.2) | **~66,4 s** (531 / 8) |

Ez érdemi minőségjavulás: a `DEBUG_MODE` mostantól **tesztelési eszköz**, nem alternatív kódág. A D. blokk tesztje ezt gépileg is rögzíti (a `speedMultiplier = 8` kimenete pontosan a nyolcada az `1`-esének).

### 1.10 Miért nem canvas

A canvasos szövegrenderelés felmerült (pixelpontos kontroll, triviális méret-illesztés), de a felhasználó a **DOM** mellett döntött:

- a szöveg **kijelölhető** marad;
- a képernyőolvasók a valódi szöveget olvassák;
- a `<Trans>` félkövér markupja és az 5 nyelv tipográfiája (ékezetek, ligatúrák, tördelés) ingyen működik;
- a böngésző sortördelő algoritmusát nem kell újraírni.

Cserébe a méret-illesztés méréssel jár — ez a terv F. blokkja. Megéri.

---

## 2. Fájlstruktúra

### Új fájlok

| Fájl | Szerep |
|---|---|
| `src/services/introLayout.ts` | Rekesz-elrendezés, görgetés-geometria, menetrend — **tiszta** |
| `src/services/introLayout.test.ts` | Kolokált teszt |
| `src/services/introFit.ts` | Betűméret-illesztés matematikája — **tiszta** |
| `src/services/introFit.test.ts` | Kolokált teszt |
| `src/hooks/useIntroLayout.ts` | A DOM-mérés vezénylése (**nem** tesztelhető jsdomban) |
| `src/components/screens/IntroMeasureProbe.tsx` | Képernyőn kívüli mérőelem (5 nyelv × 9 blokk) |

### Módosuló fájlok

| Fájl | Változás |
|---|---|
| `src/constants/constants.ts` | +15 konstans (`INTRO_SLOTS` és társai), JSDoc-kal |
| `src/types/index.ts` | +6 típus (`IntroBlockId`, `IntroSlot`, `IntroSlotBox`, `IntroScrollGeometry`, `IntroRevealSchedule`, `IntroFitResult`) |
| `src/components/screens/IntroScreen.tsx` | rAF-hurok és `updateScrollPositions` **törölve**; rekeszek, CSS-változók, önkorrigáló ütemező |
| `src/components/screens/IntroScreen.module.css` | ⚠️ `align-items: center` → `flex-start`; `.slot` osztály; `--intro-font-size` fallbackkel; `.finalInstruction` átméretezve; `animation-play-state` kapu |

### Nem módosul

`src/App.tsx` (az `INTRO_AUTO_SKIP_TIMEOUT_MS` időzítő és a globális skip-kezelők **érintetlenek**), `src/i18n/**` (**nulla** kulcsváltozás), `src/components/ui/LanguageSwitcher.tsx`, minden store.

---

## 3. Megvalósítási lépések

Az implementáció **blokkonként, külön committal** halad — a sorrend a TODO-listáé:

1. **A** — a hiba megerősítése és a baseline-profil (⚠️ a [[017-starfield-realism]] tanulsága: az ott **kimaradt** baseline miatt a hangolás nem tudott mihez mérni; itt ez **kötelező**).
2. **B + C** — konstansok és típusok (kód-semleges, a fordítás megmarad).
3. **D + E** — a két tiszta service **teszttel együtt**, még az `IntroScreen` érintése **nélkül**. Ez a terv legnagyobb, egyben legbiztonságosabb darabja.
4. **F** — mérőelem és hook (az `IntroScreen` még a régi módon fut).
5. **G + H** — az `IntroScreen` és a CSS átírása. ⚠️ **Egyetlen commit**, mert a kettő egymás nélkül tört állapotot ad (a `flex-start` a régi JS-sel elrontja a pozíciókat).
6. **I** — idővonal-hangolás.
7. **J + K** — validáció és a nem-tételek ellenőrzése.

---

## 4. Függőségek

- **`dependencies: []` — ez a terv semmitől nem függ.** Nincs előfeltétele, bármikor implementálható. A 018-as sorszám **időrend**, nem sorrendi kényszer.
- **Semmi nem függ ettől a tervtől.** Az `IntroScreen` külső szerződése (`{ onSkip }` prop) **azonos marad**, tehát az `App.tsx` és a `ScreenRouter` érintetlen.
- **Nem érinti:** Firebase, auth, shop, Stripe, notification, kamera, arcfelismerés, `useGameStore`, `useUIStore`, `useShopStore`.
- **Egyetlen külső érintkezés:** az `App.tsx`-beli `INTRO_AUTO_SKIP_TIMEOUT_MS` időzítő. Azt **nem módosítjuk**, de az új idővonalnak **alá kell férnie** — ezt a D. blokk invariáns-tesztje gépileg őrzi.
- **Elhelyezés a roadmapen:** szabadon mozgatható. A `manage-roadmap` bárhová teheti; a `dependencies: []` miatt nincs kényszer.

---

## 5. i18n

**Nulla új kulcs. A `dev` skill ehhez a tervhez ne indítsa az `i18n` agentet.**

Ez elrendezési és időzítési változás: nincs új képernyő, nincs új gomb, nincs új felirat, nincs új hibaüzenet, nincs új beállítás. A meglévő `intro.*` kulcsok (`headline`, `motto`, `paragraph1`, `paragraph2`, `sectionTitle`, `rule1`–`rule4`, `continue`) **változatlan tartalommal** és **változatlan struktúrával** maradnak mind az 5 nyelven ([[000-i18n-nyelvesites]]). A locale-fájlok egyike sem módosul, a kulcsparitás változatlan.

**A terv az i18n-t „fogyasztóként" használja**, két új módon:

1. A mérőelem **mind az 5 fordítást** kiolvassa (`i18n.getFixedT(lng)`), nem csak az aktívat. Ez működik, mert az `src/i18n/index.ts:5-9` **statikus importtal** tölti be mind az ötöt — nincs lusta betöltés, nincs hálózat, nincs `await`.
2. A `<Trans>` markup (`<1>` → `<strong>`) a mérésben is a **valódi** formázott tartalmat adja.

> ⚠️ **Ha az implementáció során mégis új kulcs merülne fel** (pl. a záró felirat rövidebb, mobilbarát változata a 6.11 miatt), azt **külön kell jelezni és indokolni**, és **csak akkor** szabad az `i18n` agentet elindítani. Az alapállapot: **nulla kulcs**.

**Miért nem lesz szövegrövidítés.** Felmerülhetne, hogy a francia és a német szövegeket rövidítsük a szórás csökkentése végett. Elvetjük: a fordítások tartalmilag helyesek, és a terv célja épp az, hogy a **szórás ne számítson**. A rövidítés a tünetet kezelné, nem az okot — és minden későbbi fordítási módosításnál újra jelentkezne.

---

## 6. Kockázatok / figyelmeztetések

### 6.1 Az illesztés a minimum betűméretre futhat (túlcsordulás)

Ha egy blokk szövege a legszűkebb oszlopban (mobil portré) még `INTRO_MIN_FONT_SIZE_PX = 12` mellett sem fér a rekeszébe, a szöveg **túlcsordul** a rekeszen, és belelóg a következőbe. Ez a rekesz-tábla hibája, nem az illesztésé.

**Észlelés:** a `didFitOverflow(fitted, minPx)` igazat ad; a hook `DEBUG_MODE`-ban `console.warn`-nal jelzi, melyik blokk melyik nyelven csordult túl. **Kezelés:** az `INTRO_SLOTS` érintett rekeszének megemelése (I. blokk). ⚠️ A megemelés a `totalVh`-t növeli, tehát a menetrend **minden** időpontja eltolódik — a D. blokk invariáns-tesztjét újra kell futtatni.

**Becslés a kiinduló táblához** (390 px széles mobil, ~342 px oszlop, `line-height: 1.5`): a leghosszabb bekezdés (`es`, 282 karakter) ~16 px betűmérettel ~8 sor ≈ 192 px, a `0.42 × 844 = 354 px` rekeszbe **kényelmesen** befér. A padló tehát nem fenyeget — de a J. blokk **méri**, nem hiszi.

### 6.2 A mérés költsége és a layout-thrash

~135 mérés viewportonként, mindegyik `getBoundingClientRect()` vagy `offsetHeight` olvasás. Ha közben írunk is a DOM-ba (a felezésnél `font-size`-t állítunk), az **írás–olvasás–írás** minta layout-thrash-t okoz.

**Mitigáció:** az 1. és a 3. menet **tiszta olvasás** (minden nyelv egyszerre renderelve, egy menetben olvasva). Csak a 2. menet vált írást és olvasást, blokkonként ~5-ször — ez összesen ~45 kényszerített layout, egyszer, a mérőelemen (ami `visibility: hidden`, tehát nem fest). **Elvárt költség: < 150 ms.** A J. blokk méri.

⚠️ Ha egy gyenge mobilon mégis érzékelhető akadás lenne: a mérés a `.block`-ok `opacity: 0` kezdőállapota miatt **láthatatlan** (nincs villanás), és a `animation-play-state: paused` kapu miatt az animáció sem indult el — tehát az akadás **nem látszik**, csak késleltet.

### 6.3 A legmagasabb nyelv megváltozhat a végleges betűméreten

A próbaméreten (24 px) legmagasabb nyelv nem feltétlenül a legmagasabb a végleges (pl. 17 px) méreten: más méretnél máshol tör a sor, és a sorszám **lépcsős** függvény. Elvben előfordulhat, hogy a `fr` a próbán 7 sor, a `de` 7 sor, de a véglegesen a `fr` 6, a `de` 7.

**Mitigáció:** a **3. ellenőrző menet** (F. blokk) a végleges méreten **mind az 5 nyelvet** újraméri, és ha bármelyik túlcsordul, egy lépcsőt lejjebb lép. Így az eredmény attól függetlenül helyes, hogy a próbán melyik volt a legmagasabb.

### 6.4 ⚠️ Betűtöltés — a legalattomosabb hibaforrás

Ha a mérés a webfontok betöltése **előtt** fut, a fallback-betűkészlet (rendszerfont) metrikáit mérjük. Azok jellemzően **eltérő szélességűek**, tehát **minden** illesztett méret hibás lesz — és a hiba **néma**: a szöveg egyszerűen rossz méretű lesz, kifutás vagy üres hely nélküli magyarázattal.

**Mitigáció:** `await document.fonts.ready` **kötelezően** a mérés előtt (F. blokk). `document.fonts` hiánya esetén azonnali folytatás (régi böngésző — ott a rendszerfont amúgy is aktív).

⚠️ Ez a tétel **nem opcionális**. Ha kimarad, a terv látszólag működik fejlesztői gépen (cache-elt font), és **eltörik** az első látogatónál.

### 6.5 Mobil böngésző: a dinamikus viewport (URL-sáv)

Mobilon a `window.innerHeight` görgetéskor **változik** (az URL-sáv be/kigördül, jellemzően 50-100 px). Ez `resize` eseményt vált ki. Ha minden ilyenre újramérnénk, az intró közben a betűméretek **ugrálnának**.

**Mitigáció:** `INTRO_RESIZE_HEIGHT_THRESHOLD_PX = 120` — csak magasságot érintő, ennél kisebb változás **nem** vált ki újramérést. Szélesség-változás (valódi eszközforgatás) mindig kivált.

### 6.6 Resize közben a görgetés folytonossága — miért nem probléma

Első ránézésre veszélyesnek tűnik, hogy a `--intro-start` / `--intro-end` értékek **futó animáció közben** változnak. Valójában **helyes** viselkedés adódik:

- a CSS-animáció az aktuális `p` haladási aránynál a `start + p × (end − start)` értéket interpolálja;
- mivel **mindkét** végpont `vh`-arányos, egy `k` arányú viewport-változás mindkettőt `k`-val skálázza;
- a **`durationSec` nem változik** (az idő fix, nem a sebesség), tehát `p` **változatlan**.

Eredmény: a görgetési pozíció a viewporttal **arányosan skálázódik**, a haladási arány és a menetrend pedig **érintetlen** marad. Ez a determinisztikus modell egyik ingyen kapott előnye — a mai modellben ugyanez ugrást okozna.

⚠️ Ami **mégis** látható lehet: az újraillesztett **betűméret**. Ez ritka (valódi eszközforgatás vagy ablakhúzás), és a felhasználó által kiváltott — elfogadható.

### 6.7 Az önkorrigáló ütemező és a CSS-animáció szinkronja

A blokkok felfedése JS-ütemezésű, a görgetés CSS-animációjú. Ha a kettő elcsúszik, a blokk „rossz helyen" villan fel.

**Források:** (a) az animáció indulása és a `baseline` rögzítése közti késés, (b) a `animation-delay: 4s` figyelmen kívül hagyása, (c) a böngésző animáció-szüneteltetése háttérfülön (a CSS-animációk **nem** állnak meg háttérfülön, csak a festés).

**Mitigáció:** a `baseline` **pontosan** a `data-ready="true"` beállításának pillanatában rögzül (ugyanabban a layout-effektben, mint az `animation-play-state: running`), és a menetrend a `delaySec`-et **tartalmazza**. A tűrés a J. blokk kézi mátrixában **±1 mp**.

### 6.8 A `visibility: hidden` mérőelem és a kijelölés

Egy 45 szövegcsomópontos rejtett elem elvben megjelenhetne a `Ctrl+A` kijelölésben vagy a képernyőolvasóban — az intró szövege **ötször** olvasódna fel.

**Mitigáció:** `aria-hidden="true"` + `inert` + `visibility: hidden` (a `visibility: hidden` tartalom nem kijelölhető és nincs az akadálymentességi fában), **és** a mérés befejeztével a komponens **unmountolódik**. Kettős védelem.

### 6.9 A JS-illesztés kiesése

Ha a hook bármiért nem fut le (hiba a mérésben, `ErrorBoundary`), a `--intro-font-size` változó nem áll be.

**Mitigáció:** a CSS `font-size: var(--intro-font-size, clamp(...))` alakban a **mai `clamp()` értékeket** tartja fallbacknek. Ekkor az intró a **mai** viselkedésre esik vissza (olvasható, csak nem determinisztikus) — nem törik el.

### 6.10 A rekesz-tábla „mágikus számai"

A 9 `heightVh` érték szubjektív. Ha valaki később szöveget ad hozzá vagy vesz el az `intro.*` kulcsokból, a tábla **elavul**, és a 6.1 túlcsordulás jelentkezik.

**Mitigáció:** a `didFitOverflow` `DEBUG_MODE`-os figyelmeztetése (6.1) ezt **azonnal** jelzi fejlesztéskor, és az `INTRO_SLOTS` JSDoc-jában rögzítve van, hogy **szövegváltozás esetén újra kell hangolni**.

### 6.11 ⚠️ A `.finalInstruction` stílusa kipróbálatlan

Mivel a záró felirat a mai kódban **gyakorlatilag soha nem jelenik meg** (1.2), a stílusa (`IntroScreen.module.css:103-119`) **soha nem volt élesben tesztelve**. A jelenlegi értékek:

```css
width: 33%;
letter-spacing: 0.4em;
text-transform: uppercase;
font-size: 1.2rem;
padding: 1rem 1.5rem;
```

Az `intro.continue` hosszai:

| Nyelv | Szöveg | Karakter |
|---|---|---|
| en | „Click or press any key to continue." | 35 |
| hu | „Kattints vagy nyomj meg bármilyen gombot a folytatáshoz." | 56 |
| fr | „Cliquez ou appuyez sur n'importe quelle touche pour continuer." | **62** |
| de | „Klicke oder drücke eine beliebige Taste, um fortzufahren." | 57 |
| es | „Haz clic o pulsa cualquier tecla para continuar." | 48 |

**A probléma nagyságrendje.** 390 px széles mobilon a `33%` doboz ≈ **129 px** belső szélessége a paddinggel együtt ~80 px. Ebbe `1.2rem` (19 px) nagybetűs, `0.4em` (7.7 px) betűközzel szedett szöveg **kb. 4-5 karakterenként** törne — a 62 karakteres francia szöveg ~13 sort adna, jóval a doboz és a képernyő magassága fölött. **Ez biztosan eltörik.**

**Kezelés (H. blokk):** `width: min(90%, 640px)`, `font-size: clamp(...)`, `letter-spacing` mobilon `0.15em`-re csökkentve, és a `@media (max-width: 600px)` blokk kiegészítése. A J. blokk ellenőrzési pontja mind az 5 nyelvre kiterjed.

⚠️ **Ha a tipográfiai megkötések (nagybetűs, ritkított) miatt a hosszú nyelvek így sem férnek ki elfogadhatóan**, felmerülhet egy rövidebb, mobilra szánt kulcs — **ez lenne az egyetlen ok új i18n kulcsra** (5. szekció). Ekkor **külön indoklással** kell jelezni és az `i18n` agentet elindítani.

### 6.12 ⚠️ Kódütközés a [[020-nextjs-migration]]-nel

A 020 C. blokkja a **3.1 tábla 14. tételeként** kifejezetten átírja:

```
src/components/screens/IntroScreen.tsx   import.meta.env.VITE_DEBUG_MODE
                                       → process.env.NEXT_PUBLIC_DEBUG_MODE
```

Ez **pontosan** az `IntroScreen.tsx:10` sor, amit ez a terv is érint (a G. blokk megtartja, de a fájl körülötte jelentősen átalakul).

**Következmény:** ha ez a terv a migráció **után** fut, a 020 tábla-tétele már elvégezte a cserét — a G. blokknak azt a formát kell megtartania. Ha **előtte** fut, a 020 diffje ütközhet, de a csere továbbra is **egyetlen sor**, tehát triviálisan feloldható.

**Egyéb érintettség nincs:** a `src/services/introLayout.ts` és `introFit.ts` **keretrendszer-független** tiszta modulok, a `useIntroLayout` pedig kliensoldali hook, ami a 020 `ssr: false` határa mögött változatlanul működik.

⚠️ Két dolgot **ellenőrizni kell**, ha a migráció ezután fut: (a) a React 18 → 19 StrictMode dupla-effekt viselkedése a `useIntroLayout` mérési effektjén (a mérés **idempotens**, tehát biztonságos, de a `document.fonts.ready` `await` utáni `setState` cleanup-védelmet igényel), (b) a `document.fonts` szerveroldalon **nem létezik** — a hook csak a kliens-only határ mögött futhat.

### 6.13 A `sectionTitle` a legnagyobb szórású blokk

A táblázat szerint a `sectionTitle` szór a legerősebben (**+28%**: `en` 47 → `fr` 60 karakter), ráadásul `text-transform: uppercase` és `letter-spacing: clamp(0.1em, 1vw, 0.4em)` van rajta — a ritkítás a hosszú szövegeket **aránytalanul** bünteti. Ez a blokk a legvalószínűbb jelöltje a 6.1 túlcsordulásnak, és a `0.24 vh` kiinduló rekesze a leginkább hangolásra szoruló érték.

---

## 7. Nem része a scope-nak

### 7.1 Nyelvenként illesztett betűméret

**Elutasítva a felhasználó által.** A közös méret a döntés, a rövidebb nyelveknél maradó üres hellyel együtt. Egy későbbi session ne „javítsa" per-nyelv illesztésre — az elrontaná a „a betűméret is azonos minden nyelven" kritériumot.

### 7.2 Canvas-alapú szövegrenderelés

**Elutasítva.** A szöveg maradjon kijelölhető és akadálymentes (1.10).

### 7.3 A fordítási szövegek rövidítése

Nem cél a szórás csökkentése (5. szekció). A terv épp azt éri el, hogy a szórás **ne számítson**.

### 7.4 Az intró tartalmának megváltoztatása

A 9 blokk, a sorrendjük, a szövegük és a `<Trans>` markupjuk **változatlan**. Ez elrendezési terv.

### 7.5 Új i18n kulcs

Alapállapot: **nulla**. Egyetlen lehetséges kivétel a 6.11 (rövid mobil „continue"), és az is **külön indoklással**.

### 7.6 Az `INTRO_AUTO_SKIP_TIMEOUT_MS` megváltoztatása

A 10 perces auto-skip **változatlan**. Az új idővonalnak alá kell férnie, nem fordítva — a D. blokk invariáns-tesztje ezt őrzi.

### 7.7 Görgethető / interaktív intró

Nem cél, hogy a felhasználó vissza tudjon tekerni vagy scrollal gyorsítani. A jelenet marad **passzív, időzített** — az `onSkip` az egyetlen interakció.

### 7.8 Az intró átemelése más képernyőkre

A `.slot` / illesztési mechanizmus elvben újrahasznosítható lenne (pl. `MissionSelector` hosszú leírásaira), de **most nem** általánosítjuk. A modulok tiszták és exportáltak, tehát egy későbbi terv felhasználhatja őket.

---

## 8. Kézi teszt-forgatókönyv

> ⚠️ **A `DEBUG_MODE=true` (~68 mp-es intró) használandó a mátrix futtatásához**, különben 15 × 9 perc = ~2,3 óra menne el várakozással. A debug idővonal az élesnek **arányos kicsinyítése** (1.9), tehát az itt látott sorrend és relatív időzítés élesben is igaz. ⚠️ **Kivétel:** az „azonos időpont" tétel **legalább egy** kombinációban **éles** (nem debug) idővonalon is ellenőrizendő.

### 8.1 A kötelező mátrix — 5 nyelv × 3 képernyőméret

| | **390 × 844** (mobil portré) | **820 × 1180** (tablet) | **1920 × 1080** (desktop) |
|---|---|---|---|
| **en** | ☐ | ☐ | ☐ |
| **hu** (legrövidebb) | ☐ | ☐ | ☐ |
| **fr** (leghosszabb) | ☐ | ☐ | ☐ |
| **de** | ☐ | ☐ | ☐ |
| **es** | ☐ | ☐ | ☐ |

**Minden cellában ellenőrizendő — ez a terv sikerkritériuma:**

| # | Elvárás |
|---|---|
| 1 | **POZÍCIÓ** — mind a 9 blokk **ugyanazon a képernyő-pozíción** jelenik meg, mint a többi nyelvnél ugyanazon a méreten (képernyőkép-összevetés azonos időbélyegnél) |
| 2 | **IDŐ** — mind a 9 blokk **ugyanabban az időpontban** jelenik meg, mint a többi nyelvnél **és** a többi méreten (±1 mp) |
| 3 | **BETŰMÉRET** — a blokkonkénti betűméret az **összes nyelvnél azonos** (DevTools → computed `font-size`) |
| 4 | **NINCS TÚLCSORDULÁS** — egyik blokk szövege sem lóg bele a következőbe, és nincs vízszintes kifutás |
| 5 | **ZÁRÓ FELIRAT** — a `intro.continue` **megjelenik**, teljesen kifér, olvasható, és nem lóg ki a képernyőről ⚠️ *önálló sikerkritérium* |
| 6 | **TELJES HOSSZ** — az intró teljes hossza **azonos** minden cellában (±1 mp) |
| 7 | **NYITÁS** — a címsor **5-10 mp-en belül** megjelenik, és **alulról úszik be** (nem helyben tűnik elő) |

### 8.2 További forgatókönyvek

| # | Forgatókönyv | Elvárt eredmény |
|---|---|---|
| 7 | **Nyelvváltás az intró közben** — a `langBar`-ral, több blokk felfedése után, mind a 4 másik nyelvre | ⚠️ **Nincs ugrás**, **nincs újramérés** (DevTools-ban nem fut a mérési menet), a görgetés **nem indul újra**, a már felfedett blokkok **felfedettek maradnak**, a betűméret **nem változik**. A szöveg egyszerűen kicserélődik a helyén |
| 8 | **Nyelvváltás oda-vissza** ugyanarra a nyelvre | Bitre ugyanaz az állapot; nincs halmozódó eltolódás |
| 9 | **Kihagyás** — kattintás, billentyű, érintés az intró bármely szakaszában | Azonnali `onSkip`, nincs beragadt timer (`setInterval` cleanup ellenőrizve DevToolsban) |
| 10 | **Auto-skip** — érintetlenül hagyva 10 percig (**éles** idővonal, 1 kombináció elég) | A záró felirat **~531 mp**-nél megjelenik, az animáció **~544 mp**-nél véget ér, az auto-skip **~600 mp**-nél üt. A felirat legalább **69 mp**-ig látszik |
| 11 | **Háttérfül** — átváltás másik fülre 60 mp-re, majd vissza | A visszatéréskor **az összes lejárt blokk fel van fedve** (nem sorban zuhannak be), a görgetés a helyes pozíción van, a menetrend nem csúszott el |
| 12 | **Ablakméretezés az intró közben** (desktop, húzás) | A görgetés **haladási aránya megmarad** (nem ugrik előre/vissza), a pozíciók arányosan skálázódnak (6.6). A betűméret újraillesztődhet — ez elfogadható |
| 13 | **Eszközforgatás** (mobil, portré ↔ fekvő) | Újraillesztés lefut, a haladási arány megmarad, nincs túlcsordulás egyik orientációban sem |
| 14 | **URL-sáv be/kigördülés** (valódi mobil böngésző) | ⚠️ **Nincs** újramérés, **nincs** betűméret-ugrálás (6.5) |
| 15 | **Lassú betűtöltés** — DevTools → Network → Slow 3G, cache kikapcsolva, **hard reload** | ⚠️ A méretek a **webfont** metrikáival állnak be, nem a fallbackével (6.4). Összevetendő a gyors betöltéssel: **azonos** betűméretek |
| 16 | **`DEBUG_MODE` arányosság** — ugyanaz a nyelv debug (~68 mp) és éles (~544 mp) idővonalon | A blokkok **relatív** időpontjai (a teljes hosszhoz viszonyítva) **azonosak**. A debug a produkciós **arányos kicsinyítése** (1.9) |
| 17 | **Teljesítmény** — DevTools Performance, a teljes intró alatt | ⚠️ **Nulla** `getBoundingClientRect` a görgetés alatt, **nulla** per-frame JS a főszálon, ~4 timer-ébredés/mp. Összevetve az A. blokk baseline-jával |
| 18 | **Kijelölés + akadálymentesség** — `Ctrl+A` az intró alatt, majd képernyőolvasó | A szöveg **egyszer** jelenik meg a kijelölésben (nem 5×), a mérőelem **nincs** az akadálymentességi fában (6.8) |
| 19 | **JS-fallback** — a `useIntroLayout` mesterséges hibája (ideiglenes `throw`) | Az intró a **mai** viselkedésre esik vissza (a CSS `clamp()` fallbackkel), olvasható marad, nem törik el (6.9) |
| 20 | **`<Trans>` félkövér** — a `rule1`–`rule4` blokkok mind az 5 nyelven | A félkövér szakaszok **megvannak** és helyes szót emelnek ki; a mérés is ezt a formázott változatot mérte (nem lóg túl a rekeszen) |
| 21 | ⚠️ **Az intró magától ér véget** — **éles** idővonal, végigvárva, **beavatkozás nélkül** (1 kombináció elég, de **kötelező**) | (a) A záró felirat ~531 mp-nél megjelenik. (b) Az animáció ~544 mp-nél véget ér, és a jelenet **ott is marad** — a képernyő **NEM ugrik tovább magától** közvetlenül a felirat után. (c) A továbblépés vagy a felhasználó kattintására, vagy a 600 mp-es auto-skipre történik. ⚠️ **Ez új viselkedés:** ma az intró **soha** nem ér véget magától, mindig az auto-skip vágja el (1.2.1) |
| 22 | ⚠️ **Nyitó élmény** — az intró első 15 másodperce, mind az 5 nyelven, mind a 3 méreten | (a) A címsor **5-10 mp-en belül** megjelenik (cél: ~6,6 mp). (b) A címsor **alulról úszik be**, nem helyben tűnik elő és **nem a képernyő tetején ugrik be** (1.5.1). (c) Nincs olyan üres szakasz, ami alatt a játékos azt hihetné, hogy a betöltés elakadt. (d) A felfedés az **alsó élnél** történik — szubjektív megítélés, az I. blokk hangolásának tárgya |

---

## 9. Becsült ráfordítás

| Blokk | Becslés |
|---|---|
| A. A hiba megerősítése + baseline-profil | ~30 perc |
| B. Konstansok (15 db, JSDoc-kal) | ~25 perc |
| C. Típusok (6 db) | ~15 perc |
| D. `introLayout.ts` + teszt (~14 teszt) | ~70 perc |
| E. `introFit.ts` + teszt (~12 teszt) | ~50 perc |
| F. Mérőelem + `useIntroLayout` (3 menet, `fonts.ready`, debounce) | ~90 perc |
| G. `IntroScreen.tsx` átírása (rAF törlés, ütemező, CSS-változók) | ~60 perc |
| H. CSS (flex-start, `.slot`, `.finalInstruction` átméretezés) | ~45 perc |
| I. Idővonal-hangolás (élő) | ~40 perc |
| J. Validáció + a 15 cellás mátrix + 16 további forgatókönyv (⚠️ ebből 2 **éles**, végigvárt futás: 10. és 21.) | ~120 perc |
| K. Nem-tételek ellenőrzése | ~15 perc |
| **Összesen** | **~9 óra** |

---

**Kész definíció:**

- A 9 intró-blokk **fix, `vh`-arányos rekeszben** él (`INTRO_SLOTS`), tehát a tartalom teljes magassága **ismert szám**, nem a szöveg függvénye.
- A betűméret blokkonként **közös mind az 5 nyelven**, és a **futásidőben mért** leghosszabb nyelvhez van illesztve (nem karakterszámból becsülve), a `<Trans>` félkövér markupjával együtt, **`document.fonts.ready` után** mérve.
- A blokkok felfedése **fix időrend szerint** történik: a menetrend **viewport- és nyelvfüggetlen konstans** (1.5), amit egy `src/services/`-beli **tiszta függvény** számol, teszttel rögzítve.
- A `requestAnimationFrame` pozíciópollozás és a képkockánkénti `getBoundingClientRect()` **eltűnt**; helyette egyetlen, 250 ms-os **önkorrigáló** timer fut, ami háttérfülről visszatérve is helyesen zárkózik fel.
- ⚠️ **A záró `intro.continue` felirat garantáltan megjelenik** — nem javítás, hanem szerkezeti lehetetlenné tétel: az `INTRO_END_PAD_VH > 0` miatt az utolsó blokk alja az animáció végén **matematikailag biztosan** a képernyő fölött van (1.2). Az `.overlay` `align-items: center` → `flex-start` váltása ehhez elengedhetetlen volt.
- A `.finalInstruction` stílusa **átméretezve és élesben kipróbálva** mind az 5 nyelven, mobil portrén is (6.11) — eddig gyakorlatilag soha nem jelent meg, tehát a `width: 33%` + `0.4em` ritkítás **kipróbálatlan** volt.
- Az intró **teljes hossza minden nyelven és minden képernyőméreten pontosan azonos**: `INTRO_TOTAL_DURATION_SEC = 540` + 4 s késleltetés = **544 s** (~9,07 perc). **Gépi invariáns** rögzíti, hogy a záró felirat (~531 s) legalább `INTRO_FINAL_READ_MARGIN_MS`-mal az `INTRO_AUTO_SKIP_TIMEOUT_MS` előtt megjelenik: `531 + 30 = 561 ≤ 600` ✅.
- ⚠️ **Az intró magától ér véget** — a projekt történetében **először**. Ma a számított animáció-hossz 1080p-n `674 s`, ami **meghaladja** a 600 s-os auto-skipet, tehát a jelenetet **mindig** az auto-skip vágja el (1.2.1). Ezután az animáció 544 s-nál lezárul, 56 s-mal az auto-skip **előtt**, és a képernyő **nem ugrik tovább magától** — megvárja a felhasználót.
- **A nyitó csend eltűnt:** a címsor **~6,6 s**-nál jelenik meg (a korábbi vázlat ~47 s-a helyett), és közben **alulról úszik be** — a játékos nem hiheti azt, hogy elakadt a betöltés. A felszabaduló idő nem vész el, hanem a **tartalomra** jut: a blokkok közti térköz **+31%** (a szabály-blokkok ~35,8 s → **~47,0 s**).
- ⚠️ A felfedés kioldó vonala a képernyő **alsó éle** (`INTRO_REVEAL_TRIGGER_RATIO = 1.0`), nem a mai `2/3`. Ez a rövid nyitás **matematikai feltétele** (1.5.1), egyben megszünteti a mai, állandóan üres alsó képernyőharmadot. A `2/3`-ra visszaállás **dokumentált tartalék**, felhasználói jóváhagyással.
- **Nyelvváltás az intró alatt nem számol újra, nem ugrat és nem indítja újra az animációt** — a mérési effekt függősége **kizárólag** a viewport. Ez az eredeti tervezői félelem (`IntroScreen.tsx:18-24`) **elegáns feloldása**, nem megkerülése.
- A `DEBUG_MODE` a produkciós idővonal **arányos kicsinyítése** (egyetlen szorzó), nem alternatív kódág — amit debugban ellenőrzünk, az élesben is igaz.
- A tiszta logika a **`src/services/introLayout.ts`** és **`src/services/introFit.ts`** fájlokban él (**nem** jött létre `src/utils/` mappa), Vitest-lefedettséggel; a DOM-mérés eredménye **paraméter**, nem belső hívás.
- A szöveg **kijelölhető és akadálymentes** maradt (DOM, nem canvas); a mérőelem `aria-hidden` + `inert` + unmountol.
- A `langBar`, az `onSkip`, a `styles.fade` és az `App.tsx` `INTRO_AUTO_SKIP_TIMEOUT_MS` időzítője **változatlan**.
- **Nulla új i18n kulcs**, a paritás mind az 5 nyelven változatlan — az `i18n` agentnek nincs teendője (5. szekció).
- `tsc --noEmit` tiszta, `npm run test` zöld, `npm run build` sikeres, a **15 cellás mátrix** és a **16 további forgatókönyv** lefutott.

---

## 10. Kapcsolódó tervek

- [[017-starfield-realism]] – **Minta, nem függőség.** Innen származik (a) a **tiszta függvény / `src/services/`** szétválasztás konvenciója (*„ami tiszta függvény, az kikerül és tesztelhető; ami DOM/canvas-állapot, az marad"*), (b) a „**nincs és ne is legyen `src/utils/`**" szabály, (c) a mért mennyiségek **paraméterként** való átvétele a determinisztikus tesztelhetőségért, és (d) a `vh`-alapú, viewport-arányos számítás megközelítése. Tanulság-átvétel: a 017 **A. blokkja (baseline) kimaradt**, ezért a hangolása nem tudott mihez mérni — **itt az A. blokk ezért kötelező**. Kódütközés a két terv közt **nincs**: a 017 a `Starfield.tsx`-et írja, ez az `IntroScreen.tsx`-et.
- [[000-i18n-nyelvesites]] – **A fordítási kulcsok forrása.** Az `intro.headline` / `motto` / `paragraph1` / `paragraph2` / `sectionTitle` / `rule1`–`rule4` / `continue` kulcsok és az 5 nyelvű paritás onnan származik. ⚠️ Ez a terv **nulla kulcsot ad hozzá és nulla kulcsot módosít** — csak **fogyasztja** őket, egy új módon: a mérőelem `i18n.getFixedT(lng)`-vel **mind az 5 fordítást** kiolvassa, nem csak az aktívat. Ez azért működik, mert az `src/i18n/index.ts:5-9` **statikus importtal** tölt (nincs lusta betöltés). ⚠️ **Következmény a 000-ra nézve:** ha valaha lusta betöltésre (namespace-splitre) váltunk, ennek a tervnek a mérése **eltörik** — a hooknak akkor `i18n.loadLanguages([...])`-t kellene bevárnia.
- [[020-nextjs-migration]] – ⚠️ **KÓDÜTKÖZÉS-FIGYELMEZTETÉS, nem függőség.** A migráció C. blokkja (3.1 tábla, **14. tétel**) az `src/components/screens/IntroScreen.tsx` `import.meta.env.VITE_DEBUG_MODE` sorát `process.env.NEXT_PUBLIC_DEBUG_MODE`-ra írja át — és az `IntroScreen.tsx:10` **pontosan ilyen sor**. Ha ez a terv a migráció **után** fut, a G. blokknak a már átírt formát kell megtartania; ha **előtte**, a 020 diffje ütközhet, de a feloldás **egyetlen sor**. ⚠️ **Ez NEM teszi függővé a két tervet egyik irányban sem** (`dependencies: []`). Egyéb érintettség: a `src/services/introLayout.ts` és `introFit.ts` keretrendszer-független, tehát változatlanul működik; a `useIntroLayout` viszont **kliens-only** (`document.fonts`, `window`), tehát a 020 `ssr: false` határa mögé kell essen, és a React 18 → 19 StrictMode dupla-effektjére a mérési effekt cleanup-védelmét ellenőrizni kell (6.12).
