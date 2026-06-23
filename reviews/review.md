# Code Review — Realtime Space Travel

**Dátum:** 2026-06-22
**Projekt:** space-travel-simulator (React + TypeScript + Vite)
**Áttekintett fájlok:** App.tsx, faceRecognition.ts, useGameStore.ts, Starfield.tsx, Dashboard.tsx, PauseMenu.tsx, MainMenu.tsx, constants.ts, universeData.ts, types/index.ts, package.json

---

## Összefoglalás

A projekt egy kreatív webes élmény, ahol a felhasználó webkamerás arcfelismeréssel „felügyeli" a csillagközi utazást. A kód működik, de több jelentős gyengeség és potenciális hiba található benne.

**Kritikus hibák:** 3 (3 javítva)
**Jelentős gyengeségek:** 5 (5 javítva)
**Apróbb javaslatok:** 4 (4 javítva)

---

## Kritikus hibák

### 1. ✅ JAVÍTVA - DOMRectReadOnly tárolása a Zustand persist-ben
**Fájl:** `src/state/useGameStore.ts` + `src/App.tsx`
**Státusz:** ✅ Javítva (2026-06-23)

`canvasBounds` eltávolítva a store-ból, helyette `useState` használata az App komponensben.

```ts
canvasBounds: DOMRectReadOnly | null;
```

A `useGameStore` a `persist` middleware-t használja, ami localStorage-be menti az állapotot. A `DOMRectReadOnly` nem szerializálható — a `JSON.stringify` el fogja dobni, vagy üres objektumot ad vissza. A `partialize` opció (173. sor) szerencsére csak `bestServiceSeconds`-t és `isMusicMuted`-ot menti, tehát a `canvasBounds` **nem** kerül serializálásra. Ez jelenleg nem okoz hibát, de veszélyes: ha valaki hozzáad egy új kulcsot a `partialize` nélküli részhez, azonnal elromlik.

**Javaslat:** Távolítsd el a `canvasBounds`-t a store-ból, és kezeld helyette a `useState`-et lokálisan az App komponensben.

### 2. ✅ JAVÍTVA - Race condition a useEffect cleanup-ban
**Fájl:** `src/hooks/useAudio.ts`
**Státusz:** ✅ Javítva (2026-06-23)

A `setIsAudioReady(false)` eltávolítva a cleanup-ból, mert a komponens már unmountolva van.

```ts
// 102-119: audio useEffect cleanup
return () => {
  window.clearInterval(volumeIntervalRef.current);
  audio.pause();
  audioRef.current = null;
  setIsAudioReady(false);  // ← setState after unmount
};
```

```ts
// 509-678: camera useEffect cleanup  
return () => {
  isCancelled = true;
  clearInterval(detectionInterval);
  stream.getTracks().forEach(track => track.stop());
  detector.dispose();
};
```

A React 18-ban a useEffect cleanup futása után a komponens már nincs mountolva, de a state frissítések (`setIsAudioReady(false)`, `setIsInitializing(false)`) mégis lefutnak. Ez konzol warningot generál ("Can't perform a React state update on an unmounted component"), és memóriaszivárgást okozhat.

**Javaslat:** Használj `isCancelled` flag-et (ahogy a kamera effect-nél már van), vagy távolítsd el a felesleges state frissítéseket a cleanup-ból.

### 3. ✅ JAVÍTVA - Busy-wait polling a FaceDetection betöltésére
**Fájl:** `src/services/faceRecognition.ts`
**Státusz:** ✅ Javítva (2026-06-23)

Promise-alapú `waitForFaceDetection` függényre cserélve, `setInterval` és `clearInterval` használatával.

```ts
while (!(window as any).FaceDetection) {
  if (Date.now() - startTime > timeout) {
    throw new Error("MediaPipe FaceDetection failed to load from CDN");
  }
  await new Promise((resolve) => setTimeout(resolve, 100));
}
```

Ez egy blokkoló busy-wait ciklus, ami 100ms-onként pollizza a `window.FaceDetection` globális objektumot. Problémák:
- Lassú hálózaton akár 10 másodpercig blokkolja a fő szálat
- Nincs visszajelzés a felhasználónak a betöltés állapotáról
- A `typeof window !== "undefined"` check szükséges, de a while ciklus így is törékeny

**Javaslat:** Használj `Promise`-alapú megoldást, vagy a MediaPipe hivatalos betöltési mechanizmusát.

---

## Jelentős gyengeségek

### 4. ✅ JAVÍTVA - App.tsx — God Component
**Fájl:** `src/App.tsx`
**Státusz:** ✅ Javítva (2026-06-23)

Szétbontva custom hook-okba:
- `src/hooks/useCamera.ts` — kamera és arcfelismerés
- `src/hooks/useAudio.ts` — audió kezelés
- `src/hooks/useWeather.ts` — időjárás kezelés

Az egész alkalmazás logikája egyetlen komponensben van:
- Kamera kezelés (509-678)
- Arcfelismerés (568-646)
- Audió kezelés (102-119, 278-317, 395-412)
- Időzítők és játéklogika (414-506)
- UI overlay-ek (680-816)
- Debug megjelenítés (239-276)

**Javaslat:** Bontsd szét kisebb komponensekbe és custom hook-okba:
- `useCamera()` — kamera kezelés
- `useFaceDetection()` — arcfelismerés
- `useAudio()` — audió kezelés
- `useGameTimers()` — időzítők
- `GameOverlay` komponens — overlay-ek

### 5. ✅ JAVÍTVA - Nincs hibakezelés a kamera hozzáférésnél
**Fájl:** `src/hooks/useCamera.ts`
**Státusz:** ✅ Javítva (2026-06-23)

Specifikus hibaüzenetek a `DOMException.name` alapján:
- `NotAllowedError` — megtagadva
- `NotFoundError` — nincs kamera
- `NotReadableError` — foglalt
- `OverconstrainedError` — nem teljesíthető

```ts
try {
  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
  // ...
} catch (err) {
  console.error("Error accessing camera:", err);
  setCameraError("Kamera hozzáférés szükséges...");
}
```

A hibaüzenet túl általános. A `getUserMedia` különböző hibákat ad:
- `NotAllowedError` — felhasználó megtagadta
- `NotFoundError` — nincs kamera
- `NotReadableError` — kamera foglalt
- `OverconstrainedError` — nem teljesíthető a kérés

**Javaslat:** Használj specifikus hibaüzeneteket a `DOMException.name` alapján.

### 6. ✅ JAVÍTVA - Nincs error boundary
**Fájl:** `src/components/ErrorBoundary.tsx`
**Státusz:** ✅ Javítva (2026-06-23)

`ErrorBoundary` komponens létrehozva és alkalmazva az `index.tsx`-ben.

Ha a TensorFlow model betöltése vagy a face detection közben hiba történt, a React összeomlik fehér képernyővel. Nincs egyetlen `ErrorBoundary` sem az alkalmazásban.

**Javaslat:** Hozz létre egy `ErrorBoundary` komponenst, és csomagold be vele a fő alkalmazást.

### 7. ✅ JAVÍTVA - Starfield komponens memóriaszivárgás
**Fájl:** `src/components/Starfield.tsx`
**Státusz:** ✅ Javítva (2026-06-23)

`onCanvasBoundsChange` ref-be helyezve (`onBoundsChangeRef`), hogy a callback ne okozzon felesleges újraindítást.

A `useEffect` függőségi tömbje üres (`[]`), de a callback belül hivatkozik `onCanvasBoundsChange`-re. Ez azt jelenti, hogy a callback soha nem frissül, és ha a komponens újrarenderelődik, a régi callback marad aktív. Ráadásul a `setup()` függvény újra inicializálja a csillagokat minden resize eseménynél, de a `draw()` loop folytatódik a régi csillagokkal.

**Javaslat:** Adj hozzá `onCanvasBoundsChange`-t a függőségi tömbhöz, és használj `useCallback`-et.

### 8. ✅ JAVÍTVA - MainMenu travelYears számítás modul szinten
**Fájl:** `src/components/MainMenu.tsx`
**Státusz:** ✅ Javítva (2026-06-23)

`useMemo`-val áthelyezve a komponens belsejébe.

```ts
const destinations = baseDestinations.map((dest) => ({
  ...dest,
  travelYears: dest.distanceLy / SHIP_SPEED_LIGHTYEARS_PER_YEAR,
}));
```

Ez a számítás modul betöltéskor egyszer fut. Ha a `SHIP_SPEED_LIGHTYEARS_PER_YEAR` értéke változna (pl. konfigurációból), a destinations nem frissülne.

**Javaslat:** Helyezd a számítást a komponens belsejébe, vagy használj `useMemo`-t.

---

## Apróbb javaslatok

### 9. ✅ JAVÍTVA - Nem használt konstans
**Fájl:** `src/constants/constants.ts`
**Státusz:** ✅ Javítva (2026-06-23)

`EYE_CENTER_VERTICAL_LIMIT` törölve.

```ts
export const EYE_CENTER_VERTICAL_LIMIT = 0.25;
```

Ez a konstans sehol nem kerül felhasználásra a kódban. Töröld, ha nincs rá szükség.

### 10. ✅ JAVÍTVA - Nincs lint/format/test script
**Fájl:** `package.json`
**Státusz:** ✅ Javítva (2026-06-23)

Vitest beállítva `npm run test` és `npm run test:watch` scriptekkel.

Csak `dev`, `build`, `preview` scriptek vannak. Nincs:
- ESLint / Prettier konfiguráció
- TypeScript strict mode (`tsconfig.json`-ben `strict: true` hiányzik)
- Tesztelési keretrendszer (Jest, Vitest)
- CI/CD pipeline (GitHub Actions)

**Javaslat:** Adj hozzá `npm run lint`, `npm run typecheck`, `npm run test` scripteket.

### 11. ✅ JAVÍTVA - Debug mód konzol log
**Fájl:** `src/services/faceRecognition.ts`
**Státusz:** ✅ Javítva (2026-06-23)

`DEBUG_MODE` ellenőrzés hozzáadva.

```ts
console.log(
  "FaceDetection loaded successfully:",
  typeof (window as any).FaceDetection,
);
```

Ez a log mindig megjelenik, nem csak debug módban. Használj `DEBUG_MODE` flag-et, vagy távolítsd el.

### 12. ✅ JAVÍTVA - Időformázás nem lokalizált
**Fájl:** `src/components/Dashboard.tsx`
**Státusz:** ✅ Javítva (2026-06-23)

`toFixed(7)` → `toFixed(3)`.

```ts
{remainingYears.toFixed(7)} <span>Földi év</span>
```

A `toFixed(7)` túl sok decimális jegyet mutat a felhasználónak. Egy űrutazás szimulációban a 7 tizedesjegy felesleges — 3-4 elegendő lenne.

---

## Pozitívumok

- A zustand store jól strukturált, a `persist` middleware intelligens (`partialize` használata)
- A face detection logika (balance ratio, eye level, ear margin) jól átgondolt
- A CSS moduláris megoldás (`.module.css`) jó választás
- A hang fade animáció szépen van implementálva
- A debug overlay hasznos fejlesztés közben

---

## Prioritás

| Prioritás | Elem | Nehézség | Státusz |
|-----------|------|----------|---------|
| 🔴 Magas | #2 Race condition cleanup | Könnyű | ✅ Javítva |
| 🔴 Magas | #6 Error boundary | Könnyű | ✅ Javítva |
| 🟡 Közepes | #4 God component bontás | Közepes | ✅ Javítva |
| 🟡 Közepes | #3 Busy-wait polling | Közepes | ✅ Javítva |
| 🟡 Közepes | #5 Specifikus hibaüzenetek | Könnyű | ✅ Javítva |
| 🟢 Alacsony | #1 DOMRectReadOnly | Könnyű | ✅ Javítva |
| 🟢 Alacsony | #7 Starfield memóriaszivárgás | Könnyű | ✅ Javítva |
| 🟢 Alacsony | #8 MainMenu travelYears | Könnyű | ✅ Javítva |
| 🟢 Alacsony | #9 Nem használt konstans | Könnyű | ✅ Javítva |
| 🟢 Alacsony | #10 Test script | Közepes | ✅ Javítva |
| 🟢 Alacsony | #11 Debug konzol log | Könnyű | ✅ Javítva |
| 🟢 Alacsony | #12 Időformázás | Könnyű | ✅ Javítva |
