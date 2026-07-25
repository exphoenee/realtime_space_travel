# Agents – AI Agent Architektúra és Szerepek

> Ez a fájl dokumentálja, hogyan használhatók AI agentek a Realtime Space Travel fejlesztési munkafolyamatában.

## Agent típusok

### 1. Buffy (Fő koordinátor)

**Szerep:** A fő AI asszisztens, aki koordinálja a feladatokat, döntéseket hoz, és integrálja az al-agentek eredményeit.

**Felelősség:**
- A felhasználó kéréseinek értelmezése és dekomponálása
- Al-agentek spawnolása párhuzamosan vagy szekvenciálisan
- Változtatások végrehajtása (str_replace, write_file)
- Döntések meghozatala a projekt konvenciói alapján
- Végső összegzés írása

### 2. File Picker

**Szerep:** Fájlok keresése a kódbázisban fuzzy kereséssel.

**Használat:** Amikor releváns fájlokat kell találni egy feladathoz. Nem csinál string-keresést — fuzzy alapú.

**Példa prompt:** "Find files related to game state management and persistence"

### 3. Code Searcher

**Szerep:** Ripgrep-alapú line-oriented keresés a forráskódokban.

**Használat:** Amikor konkrét stringeket, függvényhívásokat vagy mintákat kell keresni.

**Példa prompt:** Search for `transitionTo` usage patterns across all TypeScript files.

### 4. Researcher (Web / Docs)

**Szerep:** Dokumentáció és webes források kutatása.

**Web researcher:** Általános webes keresés, API-dokumentációk, harmadik fél szolgáltatások.
**Docs researcher:** Könyvtárak/keretrendszerek hivatalos dokumentációjának böngészése (React, Zustand, i18next, stb.).

### 5. Basher

**Szerep:** Terminál parancsok futtatása és kimenetük összefoglalása.

**Használat:** `npm run build`, `npm run test`, `tsc` ellenőrzés, stb.

### 6. Code Reviewer (mimo)

**Szerep:** Fájlváltoztatások kritikus áttekintése.

**Használat:** Implementálás után, hogy visszajelzést adjon a kód minőségéről, a projekthez való illeszkedésről, és lehetséges problémákról.

### 7. Thinker (GPT)

**Szerep:** Mély gondolkodás a beszélgetési kontextus alapján.

**Használat:** Komplex döntések, architekturális tervezés, problémamegoldás. Korlátozás: legfeljebb 1 spawn kérésenként.

### 8. Context Pruner

**Szerep:** Kontextus összehangolása és tömörítése.

**Használat:** Automatikusan spawnolódik, amikor a kontextus túl nagy lesz. Nem kell kézzel spawnolni.

### 9. Browser Use

**Szerep:** Chrome DevTools-alapú böngésző automatizálás.

**Használat:** UI tesztelés, renderelés ellenőrzése, hibaüzenetek keresése, responsive design tesztelés.

**Követelmény:** Chrome telepítve kell legyen.

### 10. Tmux CLI

**Szerep:** Tmux szessziók kezelése CLI alkalmazások teszteléséhez.

**Használat:** Hosszú ideig futó szolgáltatások tesztelése, interakció CLI appokkal.

## Agentek használatának mintázatai

### Kódolási feladat (implementálás)

```
1. file-picker + code-searcher (párhuzamos) → releváns fájlok keresése
2. read_files → kontextusgyűjtés
3. ask_user → tisztázás (ha kell)
4. write_todos → lépések tervezése
5. str_replace / write_file → implementálás
6. code-reviewer-mimo → kódellenőrzés
7. basher (tsc, test, build) → validálás
8. Hibák javítása
```

### Kutatási feladat

```
1. researcher-web → webes források keresése
2. researcher-docs → dokumentáció böngészése
3. gravity_index → harmadik fél szolgáltatások összehasonlítása
4. Válasz összeállítása a talált információkból
```

### Refaktorálási feladat

```
1. code-searcher → szimbólum összes használatának keresése
2. read_files → érintett fájlok elolvasása
3. file-picker → kapcsolódó fájlok keresése
4. str_replace → változtatások
5. basher → típus- és tesztellenőrzés
6. code-reviewer-mimo → visszajelzés
```

## Párhuzamosítás

- **File-picker + code-searcher** párhuzamosan spawnolhatók (független keresés).
- **Basher parancsok** párhuzamosan futtathatók (pl. `tsc` és `npm run test` egyszerre).
- **Code-reviewer-mimo** a basher-ekkel párhuzamosan futtatható.
- **Researcherek** (web + docs) párhuzamosan spawnolhatók.
- **Thinker agent** egyszerre legfeljebb 1 spawnolható kérésenként.

## Figyelmeztetések

- **Ne használd a `set_output` eszközt** parent agentként — csak al-agentek használhatják.
- **Context pruner** automatikusan spawnolódik, ne spawnold kézzel.
- **Thinker agent** nem rendelkezik eszközökkel — a teljes beszélgetési kontextusból dolgozik.
- **Terminál parancsok:** legyél óvatos a pusztító parancsokkal (`git push`, `rm -rf`, stb.) — csak kérésre futtatsd őket.
- **Harmadik fél szolgáltatások:** mindig használd a `gravity_index` eszközt a kutatáshoz, ne ajánlj szolgáltatást memóriából.
