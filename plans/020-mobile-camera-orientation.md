---
title: "Mobil/tablet kamera orientáció-kompenzáció – szenzorképet állóra forgatjuk detektálás előtt"
slug: 020-mobile-camera-orientation
type: plan
category: core
status: implemented
implemented: true
implemented_at: "2026-08-05"
created_at: "2026-08-04"
updated_at: "2026-08-06"  # átszámozva: step 22 → 20 (Stripe-tervek a lista végére kerültek)
author: exphoenee
step: 20
phases: []
dependencies: []
related_plans:
  - 014-camera-consent
tags:
  - camera
  - orientation
  - mobile
  - tablet
  - face-detection
  - mediapipe
  - canvas
  - device-detection
  - regression-guard
---

# Mobil/tablet kamera orientáció-kompenzáció – szenzorképet állóra forgatjuk detektálás előtt

**Cél:** Mobil és tablet készülékeken az arcfelismerés akkor is működjön, amikor a felhasználó a játék által megkövetelt **fekvő (landscape)** tájolásba fordítja a készüléket. A kamera szenzora fixen a telefon testéhez rögzített, ezért fekvőben a `getUserMedia` videóképe 90°-kal elfordul ahhoz képest, amit a user lát — az arc oldalra dől, és a jelenlegi `analyzeFace` heurisztika (álló arcot feltételez) elbukik. A megoldás: **detektálás előtt** egy újrahasznosított offscreen canvasra rajzoljuk a videót a képernyő-orientációnak megfelelő szöggel visszaforgatva állóra, és a **canvast** adjuk a `detector.estimateFaces()`-nek. Ez egyszerre javítja a MediaPipe BlazeFace detektálást és az `analyzeFace` geometriai heurisztikát. **Asztali gépen / webkamerán a viselkedés bitre változatlan** — a kompenzáció kizárólag mobil/tablet ÉS elforgatott orientáció esetén aktiválódik.

---

## Döntések (egyeztetve)

| Kérdés | Választás |
|--------|-----------|
| Hol történik a forgatás? | **Detektálás ELŐTT**, egy offscreen canvasra rajzolt, visszaforgatott képen. A `estimateFaces` a **canvast** kapja, nem a nyers `<video>`-t |
| Miért canvas és nem post-hoc keypoint-transzformáció? | Mert a nyers, elforgatott képen a **MediaPipe BlazeFace maga sem robusztus** — lehet, hogy egyáltalán nem ismeri fel az arcot. Az állóra hozott kép mindkét problémát (detektálás + `analyzeFace` geometria) egyszerre oldja |
| Mikor forgatunk? | **KIZÁRÓLAG** ha `isTouchPrimaryDevice()` (mobil/tablet) **ÉS** `screen.orientation.angle !== 0`. Minden más esetben a nyers `<video>` megy tovább, változatlan úton |
| Készülék-detektálás elsődleges módszere | **`matchMedia("(pointer: coarse)")` ÉS `matchMedia("(hover: none)")`** — a készülék **elsődleges beviteli módja** érintés. Ez fedi le a telefonokat és a tableteket is, és kizárja a hover+fine egérrel vezérelt desktopot |
| Készülék-detektálás kiegészítése (iPadOS desktop-mode) | `navigator.maxTouchPoints > 1` + `navigator.userAgentData?.mobile`, valamint UA-regex **fallback** (`/Android\|iP(hone\|ad\|od)\|Mobile\|Tablet/`) a Permissions/UA-Data nélküli böngészőkre |
| Miért nem UA-regex az elsődleges? | A UA-sniffing törékeny és hamisítható; a `(pointer: coarse) and (hover: none)` a **tényleges beviteli képességet** kérdezi, nem a stringet. Az UA csak végső fallback |
| Az elforgatási szög forrása | **`screen.orientation.angle`** (0/90/180/270) az elsődleges; fallback a régi eszközökre `window.orientation` (`-90\|0\|90\|180`) |
| A forgatás iránya (előjel) | **Konstansként hangolható** (`CAMERA_ROTATION_SIGN`), mert szenzor-tájolás- és eszközfüggő, hogy `+angle` vagy `-angle` hozza állóra. Kiindulás: a kép a képernyő-szöggel **ellentétesen** forog vissza |
| Offscreen canvas | **Újrahasznosított** (`useRef`), sosem allokálunk képkockánként. 90°/270° esetén a canvas szélessége/magassága felcserélve |
| Tiszta, tesztelhető mag | Új `src/services/cameraOrientation.ts` — `isTouchPrimaryDevice()`, `getSensorRotationAngle()`, `computeRotatedCanvasLayout(w, h, angle)` (canvas-méret + transzformáció), mind canvas nélkül, jsdom alatt egységtesztelhető |
| Debug overlay | A DebugOverlay canvasa **ugyanazt** az állóra hozott képet mutatja, és a keypointokat **közvetlenül** rárajzolja — mert az `estimateFaces` a forgatott canvason futott, a keypointok már canvas-koordinátában (állóban) érkeznek, nincs kézi keypoint-transzformáció |
| Orientáció-változás futás közben | A detektálási hurok **minden ciklusban élőben** olvassa a szöget, tehát menet közbeni forgatásra magától reagál. Ezen felül `screen.orientation` `change` listener frissíti a debug canvas méretét/újrarajzolást |
| i18n | **Nulla új user-facing string** (háttér-logika). Ha implementáció közben mégis kellene hibaüzenet, az meglévő `app.camera.*` kulcsokat használja — a `dev` skill ekkor se indítsa feleslegesen az `i18n` agentet |
| Regresszió-védelem | Desktop/webkamera use-case **bitre változatlan**: a `shouldCompensate === false` ág a **mai kódot** futtatja (nyers `<video>` → `estimateFaces`, mai debug rajzolás). Ezt kód- és tesztszinten is rögzítjük |
| Konstans a teljes kikapcsoláshoz | `CAMERA_ORIENTATION_COMPENSATION = true` — vészkapcsoló, ha bármi regresszál |

---

## ✅ Haladás (TODO)

> Jelölés: `[ ]` hátravan · `[~]` folyamatban · `[x]` kész.

**A. Tiszta mag — `src/services/cameraOrientation.ts` (ÚJ, canvas nélkül tesztelhető)**
- [x] `isTouchPrimaryDevice(): boolean` — elsődleges: `matchMedia("(pointer: coarse)").matches && matchMedia("(hover: none)").matches`; kiegészítés: `navigator.maxTouchPoints > 1`, `navigator.userAgentData?.mobile === true`; UA-regex **fallback** csak ha a `matchMedia` nem elérhető
- [x] Bemenet-védelem: `matchMedia` / `navigator` hiánya (SSR, régi jsdom) → biztonságos `false` (nem forgatunk → mai viselkedés)
- [x] `getSensorRotationAngle(): 0 | 90 | 180 | 270` — `screen.orientation?.angle` normalizálva; fallback `window.orientation` (`-90 → 270`); ismeretlen/hiány → `0`
- [x] `computeRotatedCanvasLayout(videoW, videoH, angle)` → `{ canvasWidth, canvasHeight, rotationRad, translateX, translateY }`. 90/270-nél a canvas dimenziók **felcserélve**; a transzformáció a canvas közepére translate + `rotate` + a videó középre igazított rajzolása
- [x] `shouldCompensateOrientation(angle, isTouch)` → `CAMERA_ORIENTATION_COMPENSATION && isTouch && angle !== 0`
- [x] `CAMERA_ROTATION_SIGN` figyelembevétele a `rotationRad` előjelénél (hangolható)
- [x] `src/services/cameraOrientation.test.ts` — `computeRotatedCanvasLayout`: 0° → dimenziók változatlanok, `rotationRad === 0`; 90° és 270° → felcserélt dimenziók; 180° → azonos dimenzió, `rotationRad === ±π`
- [x] Teszt: `getSensorRotationAngle` a `screen.orientation.angle` és a `window.orientation` fallback minden ágára (mockolt `window`)
- [x] Teszt: `isTouchPrimaryDevice` — `matchMedia` mockkal coarse+no-hover → `true`; fine+hover → `false`; `matchMedia` hiánya → `false` (fallback ág)
- [x] Teszt: `shouldCompensateOrientation` igazságtáblája — desktop bármely szögön `false`; mobil 0°-on `false`; mobil 90/180/270-en `true`; `CAMERA_ORIENTATION_COMPENSATION = false` → mindig `false`

**B. Konstansok — `src/constants/constants.ts`**
- [x] `CAMERA_ORIENTATION_COMPENSATION = true` — vészkapcsoló, JSDoc
- [x] `CAMERA_ROTATION_SIGN = -1` (kiindulás) — a szenzor-tájolás miatti előjel, JSDoc: „élőben hangolandó, ha az arc fejjel lefelé jönne"

**C. Detektálási hurok — `src/hooks/useFaceDetection.ts`**
- [x] Új `useRef<HTMLCanvasElement | null>` az **újrahasznosított offscreen** canvasnak (lazy `document.createElement("canvas")`)
- [x] `detectFace`-ben: `const isTouch = isTouchPrimaryDevice()` (egyszer, a hurok scope-ján kívül, mert eszközfüggő és nem változik) + `const angle = getSensorRotationAngle()` (élőben, ciklusonként)
- [x] `shouldCompensateOrientation(angle, isTouch) === false` → **a mai ág**: `estimateFaces(video, { flipHorizontal: false })` — bitre változatlan
- [x] `true` ág: offscreen canvas méretezése `computeRotatedCanvasLayout` szerint, `ctx.setTransform(...)` + `drawImage(video, ...)`, majd `estimateFaces(offscreenCanvas, { flipHorizontal: false })`
- [x] `analyzeFace(face)` **változatlan** hívása — a canvasból már állóan érkező arcra a heurisztika helyesen áll
- [x] A `readyState < 3` őr és az `isDetectingRef` reentry-védelem változatlan

**D. Debug rajzolás — `useFaceDetection.ts` + `DebugOverlay.tsx`**
- [x] Kompenzált ág debugja: a debug canvas mérete a **forgatott** (állóra hozott) dimenzió; a képet az offscreenről blitteljük (vagy ugyanazzal a transzformmal újrarajzoljuk), a keypointok **közvetlenül** canvas-koordinátában (nincs kézi transzformáció, mert az `estimateFaces` a forgatott canvason futott)
- [x] Nem-kompenzált ág debugja: **a mai kód** (`canvas.width = video.videoWidth`, `drawImage(video, ...)`, keypoint `kp.x/kp.y`) — bitre változatlan
- [x] `DebugOverlay.tsx` `videoAspect` számítás: kompenzált módban a **canvas** oldalarányát használja (a felcserélt dimenzió miatt), különben a mai `video.videoWidth/videoHeight`

**E. Orientáció-változás figyelése — `src/hooks/useCamera.ts` (vagy `useFaceDetection.ts`)**
- [x] `screen.orientation` `change` (fallback: `window "orientationchange"`) listener, ami kikényszeríti a debug canvas újraméretezését/újrarajzolását
- [x] A detektálás maga nem igényel listenert (élőben olvassa a szöget), de a listener megszünteti a debug canvas „egy ciklusnyi késés" villanását
- [x] Cleanup: listener leiratkozás unmountkor

**F. Defenzív áttekintés — `src/services/faceRecognition.ts`**
- [x] Átgondolva: forgatás után az `analyzeFace` **változatlanul** helyes (álló arc érkezik). Dokumentáló komment az `analyzeFace` tetejére: „álló arcot feltételez; a mobil orientáció-kompenzáció a `useFaceDetection`-ben, detektálás előtt biztosítja ezt"
- [x] **Nem** vezetünk be forgatás-invariáns heurisztikát — az feleslegesen lazítaná a `crewLost` szigorát

**G. Validáció + regresszió**
- [x] `npx tsc --noEmit` tiszta
- [x] `npm run test` zöld (meglévő + új `cameraOrientation` tesztek)
- [x] `npm run build` sikeres
- [x] **Regresszió — desktop:** webkamerás gépen (`pointer: fine`, `hover: hover`) a `shouldCompensate` mindig `false`, a detektálás és a debug canvas a mai kódúton fut. Kódszinten grep-pel igazolva, hogy a nem-kompenzált ág a régi hívásokat tartalmazza
- [x] **Kézi teszt — mobil:** telefon fekvőbe fordítva → az arc detektálódik, a `crewLost` nem lő be figyelő játékosnál (fizikai mobilon leellenőrizve, mindkét fekvő irány)
- [x] **Kézi teszt — előjel:** ha az arc fejjel lefelé jönne a debug canvason → `CAMERA_ROTATION_SIGN` átbillentése (a fix előjel nem volt elég → szög-vezérelt automatikus offszet, lásd „Élő hangolás eredménye")
- [x] **Kézi teszt — menet közbeni forgatás:** játék közben portrait↔landscape váltás → a detektálás követi, nincs tartós vakfolt
- [x] **Kézi teszt — tablet:** iPad (desktop-mode Safari is) → `isTouchPrimaryDevice` `true` (maxTouchPoints ág)

---

## 1. Architektúra

### 1.1 A gyökérok

A játék `landscape` tájolást követel (`ScreenCheck orientation="landscape"`, `src/components/ui/ScreenCheck.tsx`). Mobilon a kamera **szenzora fixen a készülék testéhez** rögzített: amikor a user fekvőbe fordítja a telefont, a `getUserMedia` képe 90°-kal elfordul ahhoz képest, amit a user lát. A `useFaceDetection` a nyers `<video>`-t adja az `estimateFaces`-nek, tehát a MediaPipe **oldalra dőlt** arcot kap.

Az `src/services/faceRecognition.ts::analyzeFace` viszont **álló arcot feltételez**. Három feltételéből kettő elbukik elforgatott képen:

| Feltétel | Mit mér | Elforgatva |
|---|---|---|
| `eyesLevel` | `eyeVerticalOffset / eyeHorizontalSpan < 0.35` (a két szem közel vízszintes) | a szemek függőlegesen egymás fölött → `eyeHorizontalSpan → 0` → arány `→ ∞` → **bukik** |
| `eyesAboveEars` | a szemek Y-ban a fülek fölött (`eyeEarMargin > 0`) | a fülek a szemek **mellett** vannak, nem alattuk → **bukik** |
| `symmetricalFace` | orr–bal fül / orr–jobb fül arány `[0.4, 2.5]` közt | forgatásra **invariáns** → megmaradna |

Ráadásul a BlazeFace detektor maga sem robusztus 90°-os elforgatásnál — az arcot **egyáltalán nem** biztos, hogy felismeri. Jelenleg **sehol nincs** orientáció-kompenzáció.

### 1.2 A megoldás — detektálás előtti visszaforgatás

```
<video> (szenzor-tájolt, fekvőben 90°-kal dőlt)
      │
      │  ha  isTouchPrimaryDevice()  ÉS  screen.orientation.angle !== 0
      ▼
offscreen canvas  ◀── computeRotatedCanvasLayout(vW, vH, angle)
   ctx.setTransform → drawImage(video)      (állóra forgatva)
      │
      ▼
detector.estimateFaces(canvas, { flipHorizontal:false })
      │  a keypointok már ÁLLÓ, canvas-koordinátás arcra vonatkoznak
      ▼
analyzeFace(face)   ← VÁLTOZATLAN, újra helyesen áll a geometria
```

**Miért canvas és nem utólagos keypoint-forgatás:** ha a nyers `<video>`-t adnánk a detektornak és csak a visszakapott keypointokat forgatnánk, a BlazeFace **továbbra is** elforgatott arcot kapna, amit lehet, hogy fel sem ismer. A canvasra rajzolt, állóra hozott kép **magát a detektálást** is megjavítja.

### 1.3 A készülék-kapu (mobil/tablet vs desktop)

A forgatás **csak** akkor fut, ha a készülék elsődleges beviteli módja érintés (mobil/tablet). Desktopon a webkamera szenzora **nem** forog együtt a képernyő-tájolással (külső monitor elforgatása sem forgatja a kamerát), ezért ott a kompenzáció hibás lenne — és felesleges. A kapu:

```
shouldCompensate = CAMERA_ORIENTATION_COMPENSATION
                && isTouchPrimaryDevice()
                && getSensorRotationAngle() !== 0
```

`isTouchPrimaryDevice()` rétegei (fentről lefelé, az első igaz nyer):

1. **`(pointer: coarse) and (hover: none)`** — a tényleges elsődleges bevitel érintés. Ez a megbízható, képesség-alapú jel (nem UA-string).
2. **`navigator.maxTouchPoints > 1`** — iPadOS Safari desktop-módban `Mac`-nek adja ki magát, de több érintési pontja van (a Mac trackpad `0`/`1`).
3. **`navigator.userAgentData?.mobile === true`** — Chromium telefonon.
4. **UA-regex fallback** (`/Android|iP(hone|ad|od)|Mobile|Tablet/`) — csak ha a `matchMedia` nem elérhető.

> ⚠️ **Miért nem a UA az elsődleges.** A UA-sniffing törékeny és a felhasználó által hamisítható; a `matchMedia("(pointer: coarse)")` a böngésző **tényleges beviteli képességét** kérdezi. Az UA itt csak a `matchMedia` hiánya esetén, végső mentsvárként fut — a legrosszabb esete egy félreosztályozott ritka eszköz, nem törött működés. Ugyanaz az elv, mint a [[014-camera-consent]] `CameraHelpModal` UA-ágánál: menü/gate-döntés, nem funkció-döntés.

### 1.4 A forgatási geometria

`computeRotatedCanvasLayout(videoW, videoH, angle)` a `angle ∈ {90, 270}` esetén **felcseréli** a canvas szélességét és magasságát (a fekvő szenzorkép álló canvasba kerül), majd a canvas közepére translate-el, `CAMERA_ROTATION_SIGN * angle`-lel forgat, és a videót középre igazítva rajzolja. `angle === 180` esetén a dimenzió változatlan, a forgatás `±π`. A függvény **csak számokat ad vissza** (`canvasWidth`, `canvasHeight`, `rotationRad`, `translateX`, `translateY`), így canvas nélkül, jsdom alatt teljesen tesztelhető; a tényleges `ctx.setTransform` / `drawImage` a hookban, ezekből az értékekből épül.

> A `CAMERA_ROTATION_SIGN` azért konstans, mert **eszköz-** és **szenzor-tájolás-függő**, hogy `+angle` vagy `-angle` hozza állóra a képet (front kamera tükrözése tovább bonyolítja). A helyes érték **élő teszttel** dől el — a debug canvas megmutatja, ha az arc fejjel lefelé jönne, ekkor a konstans átbillentendő.

---

## 2. Fájlstruktúra

```
src/services/cameraOrientation.ts        (ÚJ — isTouchPrimaryDevice, getSensorRotationAngle,
                                          computeRotatedCanvasLayout, shouldCompensateOrientation)
src/services/cameraOrientation.test.ts   (ÚJ — a fenti tiszta függvények egységtesztjei)
src/hooks/useFaceDetection.ts            (offscreen canvas ref; kompenzált vs mai ág a detectFace-ben;
                                          debug rajzolás igazítása; orientáció-change listener)
src/hooks/useCamera.ts                   (opcionális: screen.orientation change listener a debug újrarajzoláshoz)
src/services/faceRecognition.ts          (VÁLTOZATLAN logika + dokumentáló komment az analyzeFace tetejére)
src/components/features/DebugOverlay.tsx (videoAspect: kompenzált módban a canvas oldalaránya)
src/constants/constants.ts               (+CAMERA_ORIENTATION_COMPENSATION, +CAMERA_ROTATION_SIGN)
```

Új top-level mappa **nem** jön létre: a tiszta mag a meglévő `src/services/` rétegbe kerül (mint a `faceRecognition.ts`, `cameraPermission.ts`, `starColor.ts`), kolokált teszttel.

---

## 3. Megvalósítási lépések

1. **B.** Konstansok felvétele (`CAMERA_ORIENTATION_COMPENSATION`, `CAMERA_ROTATION_SIGN`).
2. **A.** `cameraOrientation.ts` + tesztek — teljesen tesztelhető, canvas nélkül. Ez a legkisebb kockázatú, önálló lépés.
3. **C.** `useFaceDetection.detectFace` kettéágazása: nem-kompenzált ág = mai kód szó szerint; kompenzált ág = offscreen canvas.
4. **D.** Debug rajzolás igazítása mindkét ágra.
5. **E.** Orientáció-change listener a debug canvas frissítéséhez.
6. **F.** `faceRecognition.ts` dokumentáló komment (logika változatlan).
7. **G.** Validáció + kézi mobil/tablet tesztek + előjel-hangolás.

**Interfész — `cameraOrientation.ts` (vázlat):**

```typescript
export interface RotatedCanvasLayout {
  canvasWidth: number;
  canvasHeight: number;
  rotationRad: number;   // előjel: CAMERA_ROTATION_SIGN
  translateX: number;    // a canvas közepe
  translateY: number;
}

export const isTouchPrimaryDevice = (): boolean => { /* 1.3 rétegek */ };
export const getSensorRotationAngle = (): 0 | 90 | 180 | 270 => { /* screen.orientation.angle → window.orientation fallback */ };
export const computeRotatedCanvasLayout = (
  videoW: number, videoH: number, angle: 0 | 90 | 180 | 270,
): RotatedCanvasLayout => { /* 90/270 → dimenzió-csere */ };
export const shouldCompensateOrientation = (
  angle: number, isTouch: boolean,
): boolean => CAMERA_ORIENTATION_COMPENSATION && isTouch && angle !== 0;
```

---

## 4. Függőségek

- **Nem függ** kemény módon más tervtől: az arcfelismerés (`useFaceDetection`, `useCamera`, `faceRecognition`) már létező **core** funkció, ez annak a robusztusságát javítja — nincs blokkoló előfeltétel.
- **Kapcsolódó:** [[014-camera-consent]] — ugyanaz a kamera-domain (getUserMedia stream, `useCamera`). A consent flow adja a streamet, amelyre ez a kompenzáció ráépül. A `cameraOrientation.ts` a `cameraPermission.ts` mellé, ugyanabba a `services/` rétegbe kerül.
- **Nem érinti:** shop, social, i18n paritás (nulla új kulcs).

---

## 5. i18n

**Nulla új user-facing string.** A funkció tisztán háttér-logika (kép-előfeldolgozás detektálás előtt). Ha implementáció közben mégis felmerülne hibaüzenet (pl. offscreen canvas context nem elérhető), a meglévő `app.camera.*` névtér kulcsait kell használni — a `dev` skill ekkor **se** indítsa feleslegesen az `i18n` agentet. Ha kivételesen új kulcs kell, azt mind az 5 nyelven (`hu`, `en`, `fr`, `de`, `es`) kell felvenni, paritás-ellenőrzéssel.

---

## Élő hangolás eredménye (2026-08-05)

A fizikai mobil-teszt során kiderült, hogy a tervezett **fix** `CAMERA_ROTATION_OFFSET_DEG` (fix 90°) offszet **nem elég**: az egyik fekvő irányban 90°, a **másikban 270°** kell (180° eltérés), mert a szenzorkép a `screen.orientation.angle`-lel együtt forog. Ezért a fix offszet-konstanst **szög-vezérelt automatikus offszetre** cseréltük.

**Megváltozott / új elemek:**

- **Konstans:** `CAMERA_ROTATION_OFFSET_DEG` (fix 90) → **`CAMERA_ROTATION_OFFSET_BASE_DEG = 0`** — a live képernyő-szöghöz adott fix bázis. Ha mindkét irány fejjel lefelé jönne, 180-ra billenthető.
- **`getAutoOffsetDeg(angle)`** — új tiszta függvény a `cameraOrientation.ts`-ben: az automatikus offszet = `normalize(screen angle + base)`. A `computeRotatedCanvasLayout` `offsetDeg` default-ja ez lett.
- **`useFaceDetection`:** `offset = debugRotationOffsetRef.current ?? getAutoOffsetDeg(angle)` — runtime debug override vagy automatikus szög-alapú offszet.
- **Debug forgató eszköz (DebugOverlay):** „🔄 Forgatás 90°" gomb + `Offset: auto|X°` és `Angle: X°` readout. A `useUIStore.debugRotationOffsetDeg` (**nem perzisztált**) runtime override, `cycleDebugRotationOffset` / `resetDebugRotationOffset` akciókkal. Ez a fizikai hangolás/verifikáció eszköze.
- **DebugOverlay canvas magasság-korlát:** a viewport ~40%-ára korlátozva (arány megtartva), mert kompenzált módban az álló canvas kilógott a mobil fekvő képernyőből.

**Végső fájllista (a 2. szakasz „Fájlstruktúra" kiegészítése):**

- `src/services/cameraOrientation.ts` (+ `getAutoOffsetDeg`)
- `src/services/cameraOrientation.test.ts`
- `src/constants/constants.ts` (`CAMERA_ROTATION_OFFSET_BASE_DEG`, `CAMERA_ROTATION_SIGN`)
- `src/hooks/useFaceDetection.ts`
- `src/components/features/DebugOverlay.tsx` (+ `.module.css`)
- `src/state/useUIStore.ts`
- `src/services/faceRecognition.ts` (komment)

**Validáció (kész):** `npx tsc --noEmit` tiszta · `npm run test` **214 teszt zöld (12 fájl)** · `npm run build` sikeres · **nulla új i18n kulcs**.

---

## 6. Kockázatok / figyelmeztetések

- **Forgatás előjele (`CAMERA_ROTATION_SIGN`):** front kamera tükrözése + szenzor-tájolás miatt eszközfüggő lehet, hogy `+angle` vagy `-angle` a helyes. Enyhítés: konstans + a debug canvas azonnali vizuális visszajelzése; a legrosszabb eset egy fejjel lefelé álló kép, nem néma hiba.
- **Teljesítmény:** a `drawImage` `FACE_DETECTION_INTERVAL_MS = 1000` ms-enként fut (nem képkockánként), egyetlen offscreen canvasra, **újrahasznosított** context-tel — elhanyagolható költség. Ne allokáljunk canvast ciklusonként (ref-ben tartjuk).
- **iPad desktop-mode:** iPadOS Safari `Mac`-nek adja ki magát (`(hover: hover)`/`(pointer: fine)` is előfordulhat külső eszközzel). Ezért van a `maxTouchPoints > 1` kiegészítő ág — enélkül tablet fekvőben nem kompenzálnánk.
- **Desktop érintőképernyős laptop:** `(pointer: coarse)` igaz lehet, de az **elsődleges** mutató fine egér → a `(hover: none)` **és** feltétel kizárja. Ha mégis becsúszik: a kamera desktop laptopon úgyis fixen tájolt, tehát a `angle !== 0` kapu ritkán teljesül (a laptop képernyő nem forog), így a regresszió esélye alacsony.
- **Régi böngészők `screen.orientation` nélkül:** `window.orientation` fallback; ha az sincs → `angle = 0` → nem forgatunk (mai viselkedés).
- **Regresszió-védelem:** a `shouldCompensate === false` ág **szó szerint** a mai kód. Kód-review és grep igazolja, hogy a nem-kompenzált ág hívásai (`estimateFaces(video, …)`, `canvas.width = video.videoWidth`, keypoint `kp.x/kp.y`) változatlanok. Vészkapcsoló: `CAMERA_ORIENTATION_COMPENSATION = false` → globálisan a mai út.
- **Menet közbeni orientáció-váltás:** a hurok élőben olvassa a szöget, de a debug canvas egy ciklust késhet — az `orientationchange` listener ezt elsimítja.

---

## 7. Kapcsolódó tervek

- [[014-camera-consent]] — a kamera-hozzáférés / `getUserMedia` flow és a `useCamera` stream, amelyre ez a kompenzáció épül; a tiszta mag a `cameraPermission.ts` mellé, a `services/` rétegbe kerül.

---

## 8. Becsült ráfordítás

| Blokk | Becslés |
|---|---|
| A. `cameraOrientation.ts` + tesztek | ~2-3 óra (a forgatási geometria és a device-heurisztika a lényeg) |
| B. Konstansok | ~10 perc |
| C. `useFaceDetection` kettéágazás | ~1-2 óra |
| D. Debug rajzolás | ~1 óra |
| E. Orientáció listener | ~30 perc |
| F. `faceRecognition` komment | ~10 perc |
| G. Validáció + kézi mobil/tablet teszt + előjel-hangolás | ~1-2 óra (fizikai eszköz kell) |

**Összesen:** ~6-9 óra, ebből a kézi tesztek fizikai mobil/tablet eszközt igényelnek.

**Kész definíció:**
1. Mobil/tablet fekvő tájolásban a figyelő játékos arcát a rendszer detektálja, a `crewLost` nem lő be tévesen.
2. Desktop/webkamera use-case **bitre változatlan** (`shouldCompensate === false` ág = mai kód; a `cameraOrientation` tesztek ezt rögzítik).
3. A tiszta mag (`isTouchPrimaryDevice`, `getSensorRotationAngle`, `computeRotatedCanvasLayout`, `shouldCompensateOrientation`) egységtesztekkel fedve, jsdom alatt zölden.
4. `tsc --noEmit`, `npm run test`, `npm run build` mind zöld.
5. Nulla új i18n kulcs (paritás változatlan).
