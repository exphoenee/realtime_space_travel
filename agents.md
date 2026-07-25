# Agents – Fejlesztési architektúra (skillek + agentek)

> Ez a fájl dokumentálja, hogyan szervezzük a fejlesztési munkafolyamatot a Realtime Space Travel projektben a Claude Code natív **skill** és **agent (subagent)** mechanizmusával.

## Alapelv

**A vékony skillek triggerelik az agenteket.** Nincs „skill loader" — egyetlen skill sem tölt be másik skillt. A minta:

- **Skill** (`.claude/skills/<name>/SKILL.md`) — vékony belépési pont / orchestrátor. A `Skill` eszközzel hívódik (`/dev`, `/plan`). Betölti az utasításait a fő agent turnjébe, majd a **fő agent** az `Agent` eszközzel **subagenteket indít**.
- **Agent** (`.claude/agents/<name>.md`) — önálló worker, saját kontextussal. Az `Agent` eszközzel indul (`subagent_type: <name>`), elvégzi a feladatot, és jelentést ad vissza.

```
felhasználó → Skill (dev/plan) → fő agent → Agent(subagent_type: …) → jelentés → fő agent → összegzés
```

## Skillek (belépési pontok)

### `/dev` — implementációs orchestrátor
**Fájl:** `.claude/skills/dev/SKILL.md`
Beolvassa a `./plans/`-t, meghatározza a következő feladatot, majd sorban triggeli: **react-dev** → **i18n** → (validáció: tsc/test/build) → **manage-roadmap**, végül összegez. Használat: „folytasd a fejlesztést", következő fázis implementálása, `/dev`.

### `/plan` — új terv létrehozása
**Fájl:** `.claude/skills/plan/SKILL.md`
Tisztázza a specifikációt és a döntéseket a felhasználóval, majd triggeli a **planner** agentet (tervtartalom) és a **manage-roadmap** agentet (átszámozás + roadmap újragenerálás). Használat: `/plan <leírás>`, „tervezd meg <funkció>".

## Agentek (workerek)

| Agent | `subagent_type` | Fájl | Szerep | Ki indítja |
|-------|-----------------|------|--------|------------|
| React fejlesztő | `react-dev` | `.claude/agents/react-dev.md` | React komponensek, Zustand store-ok, hook-ok, típusok, CSS Module-ok, GamePhase-ek, navigáció | `/dev`, vagy közvetlenül |
| i18n | `i18n` | `.claude/agents/i18n.md` | Fordítási kulcsok mind az 5 nyelven (hu, en, fr, de, es), kulcs-paritás, plurals/interpoláció/HTML | `/dev`, vagy közvetlenül |
| Roadmap-kezelő | `manage-roadmap` | `.claude/agents/manage-roadmap.md` | Tervfájlok átszámozása, YAML `step`/`slug`/függőségek, `roadmap.md` generálás, TODO frissítés, placement-analízis | `/dev`, `/plan` |
| Tervező | `planner` | `.claude/agents/planner.md` | Tervfájl-tartalom (YAML, TODO, architektúra, i18n, kockázatok), cross-reference-ek | `/plan` |

**Indítás példa:** a `/dev` skill utasítására a fő agent az `Agent` eszközt hívja `subagent_type: react-dev` értékkel, precíz feladattal (mit építs, mely fájlok, mely i18n kulcsok). A subagent visszaadja a módosított fájlok listáját és az új i18n kulcsokat, amit a fő agent továbbad az `i18n` agentnek.

## Munkafolyamatok

### `/dev` — implementáció
```
/dev (fő agent, orchestrátor)
  1. plans/ olvasása → következő feladat → állapot jelentése
  2. Terv (érintett kód olvasása, fájlok + i18n kulcsok meghatározása)
  3. Agent(react-dev)      → React kód implementálása
  4. Agent(i18n)           → fordítások mind az 5 nyelvre
  5. Validáció (tsc, test, build)
  6. (opcionális) /code-review a diffre
  7. Agent(manage-roadmap) → TODO + YAML + roadmap frissítés
  8. Összegzés
```

### `/plan` — új terv
```
/plan (fő agent, belépési pont)
  1. Specifikáció átvétele
  2. Döntések tisztázása a felhasználóval (AskUserQuestion);
     opcionálisan Agent(manage-roadmap) placement-analízishez
  3. Agent(planner)        → tervtartalom + cross-reference-ek
  4. Agent(manage-roadmap) → átszámozás, YAML, roadmap újragenerálás
  5. Összegzés
```

## Beépített képességek (natív Claude Code eszközök)

A fő agent és a subagentek a natív eszközöket használják — nincs szükség külön „kereső/basher/reviewer" agentekre:

- **Kontextusgyűjtés:** `Read`, `Grep`, `Glob` (fájlkeresés és -olvasás).
- **Validáció / parancsok:** `Bash` (`npx tsc --noEmit`, `npm run test`, `npm run build`).
- **Kódellenőrzés:** a `/code-review` skill a diffre (nem külön agent).
- **Böngészős ellenőrzés:** a Claude-in-Chrome eszközök (ha a bővítmény csatlakoztatva van).
- **Kérdezés:** `AskUserQuestion` — **csak a skillekben / fő agentben**, a döntéseket a subagent-indítás *előtt* kell tisztázni.

## Fontos megkötések

- **Subagentek nem kérdezhetnek a felhasználótól.** Minden tisztázást a fő agent (skill) végez, mielőtt agentet indít; a subagent a bizonytalanságot a jelentésében jelzi.
- **Single source of truth:** a `./plans/` könyvtár. A `roadmap.md` **scripttel generált** (`python .claude/scripts/generate_roadmap.py`), tájékoztató jellegű — kézzel ne szerkeszd. **Olvasás előtt mindig generáld újra.** A script a tervek YAML fejlécéből és „Haladás (TODO)" szekciójából állítja elő a projekt-állást (terv- és task-haladás), a következő nyitott feladatokat és a beillesztési útmutatót (függőségek + függő tervek).
- **Nincs skill-loading.** Skill sosem tölt be másik skillt; a delegálás mindig `Agent` eszközzel, `subagent_type`-pal történik.
- **Konvenciók:** `.claude/references/project-conventions.md`; terv-YAML séma és számozás: `.claude/references/plan-yaml-schema.md`, `plan-naming.md`, `phase-numbering.md`.
- **Pusztító parancsok** (`git push`, `rm -rf`, stb.) csak kifejezett kérésre.
