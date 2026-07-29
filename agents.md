# Agents – Fejlesztési architektúra (skillek + agentek)

> Ez a fájl dokumentálja, hogyan szervezzük a fejlesztési munkafolyamatot a Realtime Space Travel projektben a Claude Code natív **skill** és **agent (subagent)** mechanizmusával.

## Alapelv

**A vékony skillek triggerelik az agenteket.** Nincs „skill loader" — egyetlen skill sem tölt be másik skillt. A minta:

- **Skill** (`.claude/skills/<name>/SKILL.md`) — vékony belépési pont / orchestrátor. A `Skill` eszközzel hívódik (`/dev`, `/plan`). Betölti az utasításait a fő agent turnjébe, majd a **fő agent** az `spawn_agents` eszközzel **subagenteket indít**.
- **Agent** (`.claude/agents/<name>.md`) — önálló worker, saját kontextussal. Az `spawn_agents` eszközzel indul (`agent_type: <name>`), elvégzi a feladatot, és jelentést ad vissza.

```
felhasználó → Skill (dev/plan) → fő agent → spawn_agents(agent_type: …) → jelentés → fő agent → összegzés
```

## Skillek (belépési pontok)

### `/dev` — implementációs orchestrátor
**Fájl:** `.claude/skills/dev/SKILL.md`
Beolvassa a `./plans/`-t, meghatározza a következő feladatot, majd sorban triggeli: **react-dev** → **i18n** → (validáció: tsc/test/build) → **manage-roadmap**, végül összegez. Használat: „folytasd a fejlesztést", következő fázis implementálása, `/dev`.

### `/plan` — új terv létrehozása
**Fájl:** `.claude/skills/plan/SKILL.md`
Tisztázza a specifikációt és a döntéseket a felhasználóval, majd triggeli a **planner** agentet (tervtartalom) és a **manage-roadmap** agentet (átszámozás + roadmap újragenerálás). Használat: `/plan <leírás>`, „tervezd meg <funkció>".

## Agentek (workerek)

| Agent | `agent_type` | Fájl | Szerep | Ki indítja |
|-------|-------------|------|--------|------------|
| React fejlesztő | `react-dev` | `.claude/agents/react-dev.md` | React komponensek, Zustand store-ok, hook-ok, típusok, CSS Module-ok, GamePhase-ek, navigáció | `/dev`, vagy közvetlenül |
| i18n | `i18n` | `.claude/agents/i18n.md` | Fordítási kulcsok mind az 5 nyelven (hu, en, fr, de, es), kulcs-paritás, plurals/interpoláció/HTML | `/dev`, vagy közvetlenül |
| Roadmap-kezelő | `manage-roadmap` | `.claude/agents/manage-roadmap.md` | Tervfájlok átszámozása, YAML `step`/`slug`/függőségek, `roadmap.md` generálás, TODO frissítés, placement-analízis | `/dev`, `/plan` |
| Tervező | `planner` | `.claude/agents/planner.md` | Tervfájl-tartalom (YAML, TODO, architektúra, i18n, kockázatok), cross-reference-ek | `/plan` |

**Indítás példa:** a `/dev` skill utasítására a fő agent a `spawn_agents` eszközt hívja `agent_type: react-dev` értékkel, precíz feladattal (mit építs, mely fájlok, mely i18n kulcsok). A subagent visszaadja a módosított fájlok listáját és az új i18n kulcsokat, amit a fő agent továbbad az `i18n` agentnek.

## Munkafolyamatok

### `/dev` — implementáció
```
/dev (fő agent, orchestrátor)
  1. plans/ olvasása → következő feladat → állapot jelentése
  2. Terv (érintett kód olvasása, fájlok + i18n kulcsok meghatározása)
  3. spawn_agents(react-dev)    → React kód implementálása
  4. spawn_agents(i18n)         → fordítások mind az 5 nyelvre
  5. Validáció (tsc, test, build) párhuzamosan + code-review
  6. spawn_agents(manage-roadmap) → TODO + YAML + roadmap frissítés
  7. Összegzés
```

### `/plan` — új terv
```
/plan (fő agent, belépési pont)
  1. Specifikáció átvétele
  2. Döntések tisztázása a felhasználóval (ask_user);
     opcionálisan spawn_agents(manage-roadmap) placement-analízishez
  3. spawn_agents(planner)        → tervtartalom + cross-reference-ek
  4. spawn_agents(manage-roadmap) → átszámozás, YAML, roadmap újragenerálás
  5. Összegzés
```

## Tool használati útmutató

### `spawn_agents` — párhuzamos agent indítás

**A preferált eszköz** agentek indításához. Több agentet lehet párhuzamosan indítani.

**Fontos:** A JSON paraméterekben:
- Ne használj backtick-et (`) — használj sima idézőjeleket
- Minden agent kapjon saját `agent_type`, `prompt`, `params` objektumot
- A `params` mezők az adott agent sémájához igazodjanak

Példa párhuzamos validációra:
```json
{
  "agents": [
    {
      "agent_type": "basher",
      "params": {
        "command": "cd /e/Projects/realtime_space_travel && npx tsc --noEmit 2>&1",
        "what_to_summarize": "Van-e TypeScript hiba?"
      }
    },
    {
      "agent_type": "code_reviewer_deepseek_flash",
      "prompt": "Review the recent changes..."
    }
  ]
}
```

### `basher` — terminál parancsok

Terminál parancsok futtatásához. Windows bash shell esetén:
- `move` → `mv` (bash)
- `copy` → `cp` (bash)
- A `cd` működik, de az elérési utakban `/` használandó (nem `\`)

### `str_replace` — fájl szerkesztés

Több replacement esetén használj **egy** `str_replace` hívást a `replacements` tömbbel.
Figyelj a JSON escape-ekre: újsor = `\n`, idézőjel = `\"`.

## Beépített képességek (natív eszközök)

A fő agent és a subagentek a natív eszközöket használják:

- **Kontextusgyűjtés:** `read_files`, `code_searcher` (ripgrep), `glob`, `list_directory`
- **Validáció / parancsok:** `basher` (`npx tsc --noEmit`, `npm run test`, `npm run build`)
- **Kódellenőrzés:** `code_reviewer_deepseek_flash` a diffre
- **Böngészős ellenőrzés:** `browser_use` (Chrome DevTools)
- **Kérdezés:** `ask_user` — **csak a skillekben / fő agentben**, a döntéseket az agent-indítás *előtt* kell tisztázni.
- **Követés:** `write_todos` — lépések nyomon követéséhez

## Fontos archívumok

| Fájl | Tartalom |
|------|---------|
| `.claude/references/architecture-current.md` | Jelenlegi architektúra részletesen |
| `.claude/references/architecture-planned.md` | Tervezett architektúra jövőbeli fázisokkal |
| `.claude/references/project-conventions.md` | Kód konvenciók, mappa struktúra |
| `.claude/references/project-state.md` | Projekt állapot fázisonként |
| `.claude/references/plan-yaml-schema.md` | Terv YAML séma |
| `.claude/references/plan-naming.md` | Terv fájl elnevezési konvenciók |
| `.claude/references/phase-numbering.md` | Fázis számozási szabályok |
| `.claude/lessons-learned.md` | **Tanulságok és minták** — olvasd el fejlesztés előtt! |

## Fontos megkötések

- **Subagentek nem kérdezhetnek a felhasználótól.** Minden tisztázást a fő agent (skill) végez, mielőtt agentet indít; a subagent a bizonytalanságot a jelentésében jelzi.
- **Single source of truth:** a `./plans/` könyvtár. A `roadmap.md` **scripttel generált** (`python .claude/scripts/generate_roadmap.py`), tájékoztató jellegű — kézzel ne szerkeszd. **Olvasás előtt mindig generáld újra.**
- **Nincs skill-loading.** Skill sosem tölt be másik skillt; a delegálás mindig `spawn_agents` eszközzel, `agent_type`-pal történik.
- **Konvenciók:** `.claude/references/project-conventions.md`
- **Pusztító parancsok** (`git push`, `rm -rf`, stb.) csak kifejezett kérésre.
- **Tanulságok:** mielőtt új feature-t implementálsz, olvasd el a `.claude/lessons-learned.md`-t!

---

## Freebuff (Buffy) kompatibilitás

Ez a projekt Freebuff-ban (deepseek-v4-flash modell, Buffy agent) is teljes mértékben használható a `.claude/skills/freebuff/SKILL.md` bootstrap skill segítségével.

### Skill-ek Freebuff-ban

A `skill()` eszköz **natívan működik** Freebuff-ban — minden `.claude/skills/` alatti skill betölthető:
- `skill("dev")` → implementációs orchestrátor
- `skill("plan")` → új terv létrehozása
- `skill("freebuff")` → Freebuff bootstrap (kontextus betöltés induláskor)
- Firebase / Stripe skill-ek → szintén működnek

### Agent-ek Freebuff-ban

A `.claude/agents/` mappában definiált agent-ek (react-dev, i18n, manage-roadmap, planner) **nem regisztrált agent típusok** Freebuff `spawn_agents` eszközében. Helyettük:

| Claude Code agent | Freebuff megközelítés |
|---|---|
| `react-dev` | A fő agent (Buffy) beolvassa `react-dev.md`-t → implementál `str_replace`/`write_file` eszközökkel |
| `i18n` | A fő agent beolvassa `i18n.md`-t → hozzáadja a kulcsokat + `basher` parity check |
| `manage-roadmap` | A fő agent beolvassa `manage-roadmap.md`-t → frissíti a plan fájlokat + `basher(python generate_roadmap.py)` |
| `planner` | A fő agent beolvassa `planner.md`-t → `write_file` a terv fájlba |

A beépített Freebuff agent-ek (`basher`, `code-searcher`, `file-picker`, `researcher-web`, `researcher-docs`, `browser-use`, `code-reviewer-deepseek-flash`, `thinker-gpt`) továbbra is `spawn_agents`-szel indíthatók.

### Részletes dokumentáció

- `.freebuff/README.md` — Teljes Freebuff ↔ Claude Code hibrid modell leírása
- `.claude/skills/freebuff/SKILL.md` — Freebuff bootstrap skill (elsőként betöltendő)
- `skill("freebuff")` → betölti a bootstrap kontextust
