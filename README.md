# Realtime Space Travel

**Az életedre szóló élmény!**

Te vagy a kiválaszott! Te vagy az Emberiség utolsó és egyetlen reménye. Ez nem egy játék, a túlélésünk a tét. Ez az utolsó esélyünk: egy új otthon ígérete távoli csillagrendszerekben. A bárka, amely az emberiség jövőjét hordozza, indulásra kész.

A teljes legénység – tudósok, mérnökök, az új civilizáció alapítói – mély, kriogén álomba merült. A sorsuk, az álmaik, a jövőnk... Az emberiség sorsa most a te kezedben van. Te vagy az az élő, lélegző komponens, amelyet semmilyen mesterséges intelligencia nem pótolhat.

## A Feladataid – A Küldetés Legszigorúbb Protokolljai

**Az Éberség Protokollja** – folyamatos vizuális monitorozás szükséges a navigációs adatok stabilizálásához. Ha a figyelmed megszakad, a hajó vészleállást kezdeményez.

**A Zéró Beavatkozás Elve** – a rendszerek önfenntartóak, a manuális beavatkozás végzetes lehet. A legfontosabb képességed a fegyelem és a türelem. Ne cselekedj – felügyelj!

**Valós Idejű Utazás** – tapasztald meg a csillagközi utazás hiteles valóságát. A csillagok évezredek alatt mozdulnak el; a legnagyobb ellenség az idő.

**A tét: Minden.** Nincs dicsőség, nincsenek harcok, nincsenek jutalmak – csak a csend, a végtelen kozmosz és a válladra nehezedő felelősség. A jövő a te szemedben tükröződik.

---

## Élő verzió (deploy)

A játék Firebase Hosting-on érhető el:

- https://realtimespacetravel-e74e3.web.app
- https://realtimespacetravel-e74e3.firebaseapp.com
- https://exphoenee.github.io/realtime_space_travel/ (GitHub Pages)

---

## Funkciók

- Webkamerás arcfelismerés (MediaPipe)
- Valós idejű csillagmező animáció
- Több küldetés kiválasztása
- Hang effektusok és zene
- Debug mód fejlesztőknek
- Hibakezelés és automatikus újraindítás
- Képernyő ellenőrzés (fekvő nézet, min. 900×530)

## Technológiák

- React 18
- TypeScript
- Vite
- Zustand (állapotkezelés)
- TensorFlow.js + MediaPipe (arcfelismerés)
- CSS Modules

---

## Run Locally

**Prerequisites:** Node.js 18+

1. Telepítsd a függőségeket:
   ```bash
   npm install
   ```

2. Indítsd el a fejlesztői szervert:
   ```bash
   npm run dev
   ```

3. Nyisd meg a böngészőben: `http://localhost:5173/realtime_space_travel/`

## Elérhető scriptek

| Script | Leírás |
|--------|--------|
| `npm run dev` | Fejlesztői szerver indítása |
| `npm run build |` |
| `npm run build` | Termelési build készítése |
| `npm run preview` | Termelési build előnézete |
| `npm run test` | Tesztek futtatása |
| `npm run test:watch` | Tesztek figyelése módosításoknál |

## Képernyő követelmények

- **Minimális felbontás:** 900×530
- **Orientáció:** Fekvő (landscape) nézet
- **Kamera:** Webkamera szükséges a játékhoz

## Projekt szerkezet

```
src/
├── components/          # React komponensek
│   ├── Dashboard.tsx    # Műszerfal
│   ├── ErrorBoundary.tsx # Hiba határ
│   ├── IntroScreen.tsx  # Bevezető képernyő
│   ├── MainMenu.tsx     # Főmenü
│   ├── PauseMenu.tsx    # Szünet menü
│   ├── ScreenCheck.tsx  # Képernyő ellenőrzés
│   └── Starfield.tsx    # Csillagmező
├── hooks/               # Egyedi React hook-ok
│   ├── useAudio.ts      # Audió kezelés
│   ├── useCamera.ts     # Kamera és arcfelismerés
│   └── useWeather.ts    # Időjárás kezelés
├── services/            # Szolgáltatások
│   └── faceRecognition.ts # Arcfelismerés logika
├── state/               # Állapotkezelés
│   └── useGameStore.ts  # Zustand store
├── constants/           # Konstansok
│   ├── constants.ts     # Alapértelmezett értékek
│   └── universeData.ts  # Univerzum adatok
├── types/               # TypeScript típusok
│   └── index.ts
└── App.tsx              # Fő komponens
```

## Környezeti változók

| Változó | Leírás | Alapértelmezett |
|---------|--------|-----------------|
| `VITE_DEBUG_MODE` | Debug mód engedélyezése | `false` |

## Debug mód

A debug mód engedélyezéséhez hozz létre egy `.env` fájlt:

```
VITE_DEBUG_MODE=true
```

Debug módban:
- Kamera előnézet látható
- Arcfelismerési metrikák megjelennek
- Figyelmen kívül hagyás kapcsoló elérhető

## Licenc

[Adj hozzá licencet]
