# Freebuff + Claude Code — Hibrid működési modell

> Ez a dokumentum leírja, hogyan használja a **Freebuff** (Buffy, deepseek-v4-flash) a projekt **Claude Code** architektúráját: skilleket, agenteket, szabályokat és referenciákat.

## Cél

A projekt Claude Code-ra épülő fejlesztési infrastruktúrája (skillek, agentek, rules, `CLAUDE.md`, `agents.md`) **teljes mértékben használható Freebuff-ban is** — csak az agent-indítási mechanizmus tér el kissé. Ez a fájl leírja a pontos különbségeket és az áthidaló mintákat.

---

## Alapelv

**A skill-ek natívan működnek, az agent-ek prompt-jait a fő agent (Buffy) olvassa be és követi, a szabályokat manuálisan tölti be.**

```
Freebuff munkamenet:
  1. Bootstrap: skill("freebuff") → betölti a Freebuff kontextust
  2. A fő agent (Buffy) beolvassa a releváns .claude/ fájlokat
  3. skill("dev") vagy skill("plan") → betölti a munkafolyamatot
  4. A fő agent követi a skill utasításait
  5. spawn_agents(beépített agent-ek) párhuzamos munkára
  6. str_replace / write_file a kód módosítására
  7. Validáció: basher (tsc, test, build)
  8. Report
```

---

## Összehasonlító táblázat

| Képesség | Claude Code | Freebuff (Buffy) | Megjegyzés |
|----------|-------------|-------------------|------------|
| **Skill-ek betöltése** | `skill("dev")` | `skill("dev")` ✅ | **Natívan működik** — ugyanaz az eszköz |
| **Saját agent-ek** | `.claude/agents/react-dev.md` → `spawn_agents(agent_type: "react-dev")` | ⚠️ Nincs beépített `react-dev` agent | Lásd: [Agent helyettesítési minta](#agent-helyettesítési-minta) |
| **Subagent indítás** | `spawn_agents(agent_type: ...)` | `spawn_agents(agent_type: "basher" / "code-searcher" / "file-picker" / ...)` ✅ | A **beépített** agent típusok teljes készlete elérhető |
| **`CLAUDE.md`** | Automatikusan betöltődik | ⚠️ Látszik a fájlban, de nem töltődik automatikusan | `read_files("CLAUDE.md")`-szal manuálisan betölthető |
| **`.claude/rules/`** | Automatikusan betöltődik | ⚠️ Kézi `read_files()` kell | A `freebuff` skill betölti őket |
| **`.claude/references/`** | Elérhető | `read_files()`-szal elérhető ✅ | A `freebuff` skill felsorolja a fontosakat |
| **`.claude/settings.json`** | Parancs-engedélyezés | ❌ Nem támogatott | Nem releváns — a `basher` nem korlátozott |
| **`read_files`** | ✅ | ✅ | Ugyanaz az eszköz |
| **`str_replace` / `write_file`** | ✅ | ✅ | Ugyanazok az eszközök |
| **`basher` (terminál)** | ✅ | ✅ | Teljes körű |
| **`ask_user`** | ✅ | ✅ | Kérdések a felhasználónak |
| **`write_todos`** | ✅ | ✅ | Lépéskövetés |

---

## Agent helyettesítési minta

A `.claude/agents/` mappában definiált egyedi agent-ek (pl. `react-dev`, `i18n`, `manage-roadmap`, `planner`) **nem regisztrált agent típusok Freebuff-ban**. Helyettük a következő minta érvényes:

### Általános minta

```
1. A fő agent (Buffy) beolvassa az agent fájlt: read_files(".claude/agents/<name>.md")
2. Az agent utasításait kontextusba építi (konvenciók, munkafolyamat, ellenőrző lista)
3. A konkrét munkát a beépített subagent-ekkel + saját eszközökkel végzi
4. Vagy: a fő agent maga látja el az agent szerepét (pl. kódírás, i18n kulcsok hozzáadása)
```

### Konkrét helyettesítések

| Claude Code Agent | Freebuff implementáció | Eszközök |
|---|---|---|
| **`react-dev`** | A fő agent beolvassa `react-dev.md`-t → követi a React/TypeScript konvenciókat → implementál | `read_files`, `code_searcher`, `glob`, `str_replace`, `write_file`, `file-picker` |
| **`i18n`** | A fő agent beolvassa `i18n.md`-t → hozzáadja a fordítási kulcsokat mind az 5 nyelvhez → futtatja a parity check-et | `read_files`, `glob`, `str_replace`, `write_file`, `basher(node -e parity-check)` |
| **`manage-roadmap`** | A fő agent beolvassa `manage-roadmap.md`-t → frissíti a TODO-kat, YAML-t, futtatja a roadmap generátort | `read_files`, `glob`, `str_replace`, `basher(python generate_roadmap.py)` |
| **`planner`** | A fő agent beolvassa `planner.md`-t → terv fájl tartalom létrehozása | `read_files`, `glob`, `write_file`, `str_replace` |

### Példa: `react-dev` helyettesítése

```text
Ahelyett, hogy:  spawn_agents(agent_type: "react-dev", ...)

A fő agent:
  1. read_files(".claude/agents/react-dev.md")
     → "react-dev agent szerint ezek a konvenciók..."
  2. read_files(".claude/references/project-conventions.md")
     → "projekt konvenciók: CSS Modules, Zustand store-ok, i18n..."
  3. read_files("releváns meglévő kód")
     → "meglévő minták megértése"
  4. Szerkesztés: str_replace / write_file
  5. Ellenőrzés: basher("npx tsc --noEmit")
```

---

## Bootstrap folyamat

Minden Freebuff munkamenet elején **elsőként** a `freebuff` skill-t kell betölteni! Ez adja meg a teljes bootstrap kontextust.

### 1. Skill betöltés — ELSŐ LÉPÉS

```text
skill("freebuff")   → betölti a bootstrap skill utasításait
                     (amely felsorolja a betöltendő fájlokat)
skill("dev")        → ha implementációs feladat következik
skill("plan")       → ha új terv készül
```

A `skill("freebuff")` hívás után a skill utasításai a kontextusba kerülnek. Ez tartalmazza a teljes fájl-betöltési listát.

### 2. Kötelező fájlok betöltése (a skill utasításai alapján)

> ⚠️ **Fontos:** A `skill("freebuff")` **már megtörtént** — ekkor a skill felsorolja, hogy mely fájlokat kell `read_files`-szal betölteni. Az alábbi lista ezt a folyamatot dokumentálja:

```text
read_files(
  "CLAUDE.md",                          # Projekt áttekintés
  "agents.md",                          # Agent architektúra
  ".claude/rules/main-rules.md",        # Alap szabályok (Asimov)
  ".claude/rules/planning-workflow.md", # Tervezési workflow
  ".claude/lessons-learned.md",         # Tanulságok
)
```

Ezután a további kontextus (agent-ek, referenciák) a feladattól függően töltődik be.

### 3. Szükség szerinti fájlok

```text
# Agent fájlok (a feladattól függ, melyik kell)
read_files(
  ".claude/agents/react-dev.md",
  ".claude/agents/i18n.md",
  ".claude/agents/manage-roadmap.md",
  ".claude/agents/planner.md",
)

# Referenciák
read_files(
  ".claude/references/project-conventions.md",
  ".claude/references/architecture-current.md",
  ".claude/references/plan-yaml-schema.md",
  ".claude/references/phase-numbering.md",
)
```

---

## Skill-ek állapota Freebuff-ban

| Skill `.claude/skills/...` | Freebuff kompatibilis? | Megjegyzés |
|---|---|---|
| `dev/SKILL.md` | ✅ **Igen** | `skill("dev")` betölti, a fő agent követi az utasításokat |
| `plan/SKILL.md` | ✅ **Igen** | `skill("plan")` betölti, a fő agent követi |
| Firebase skill-ek | ✅ **Igen** | `skill("firebase-auth-basics")`, stb. |
| `stripe-best-practices` | ✅ **Igen** | `skill("stripe-best-practices")` |
| `firebase-security-rules-auditor` | ✅ **Igen** | `skill("firebase-security-rules-auditor")` |
| `xcode-project-setup` | ✅ **Igen** | `skill("xcode-project-setup")` |

**Minden skill teljes mértékben használható Freebuff-ban**, mert a `skill()` eszköz natív Freebuff funkció.

---

## Elérhető subagent-ek Freebuff-ban

A `spawn_agents` eszközzel az alábbi beépített agent típusok indíthatók:

| `agent_type` | Feladat |
|---|---|
| `basher` | Terminál parancsok futtatása |
| `code-searcher` | Kód keresés (ripgrep) |
| `file-picker` | Releváns fájlok megtalálása |
| `researcher-web` | Webes kutatás |
| `researcher-docs` | Műszaki dokumentáció olvasása |
| `browser-use` | Böngésző automatizálás (Chrome DevTools) |
| `code-reviewer-deepseek-flash` | Kód review |
| `thinker-gpt` | Mély gondolkodás (ha ChatGPT kapcsolódva) |
| `context-pruner` | Kontextus tömörítés |
| `tmux-cli` | CLI alkalmazás tesztelés |

---

## Munkafolyamatok Freebuff-ban

### `/dev` — Implementáció

```text
1. skill("freebuff")           → betölti a bootstrap kontextust
2. skill("dev")                → betölti a dev skill utasításait
3. read_files("plans/roadmap.md", a releváns plan fájl)
4. A fő agent meghatározza a következő feladatot
5. code_searcher + file_picker + read_files a releváns kódhoz
6. read_files(".claude/agents/react-dev.md") → konvenciók betöltése
7. Implementáció: str_replace / write_file
8. read_files(".claude/agents/i18n.md") → i18n konvenciók
9. i18n kulcsok hozzáadása + parity check (basher)
10. Validáció: basher(tsc) + basher(test) + basher(build)
11. code-reviewer-deepseek-flash review
12. read_files(".claude/agents/manage-roadmap.md") → roadmap frissítés
13. basher(python generate_roadmap.py)
14. Report
```

### `/plan` — Új terv

```text
1. skill("freebuff")
2. skill("plan")
3. Döntések tisztázása a felhasználóval
4. read_files(".claude/agents/planner.md")
5. Terv fájl létrehozása: write_file
6. Keresztreferenciák frissítése: code_searcher + str_replace
7. read_files(".claude/agents/manage-roadmap.md")
8. Átszámozás + roadmap generálás
9. Report
```

---

## Gyakori minták

### Firebase érintettség esetén

```text
skill("firebase-auth-basics")  # Firebase Auth skill betöltése
skill("firebase-basics")       # Firebase alap skill
# A skill-ek utasításai a kontextusba épülnek
```

### Stripe érintettség esetén

```text
skill("stripe-best-practices")
```

### Új skill telepítése

```text
npx skills find <query>
npx skills add <owner/repo> --list
npx skills add <owner/repo> --skill <name> --yes
```

---

## Korlátok és figyelmeztetések

1. **`spawn_agents` nem tud új agent típusokat létrehozni.** A `.claude/agents/*.md` fájlok utasítások, nem regisztrált agent-ek. A fő agent olvassa be és használja őket.

2. **A `skill()` eszköz csak a `.claude/skills/<name>/SKILL.md` fájlokat tölti be.** Ha egy skill-t a közösségi skillekből telepítesz (`npx skills add`), az a `.agents/skills/` mappába kerül — a `skill()` eszköz onnan is betölti.

3. **`CLAUDE.md` nem töltődik automatikusan.** Minden munkamenet elején explicit `read_files("CLAUDE.md")` szükséges (a `freebuff` skill ezt automatikusan elvégzi).

4. **A settings.json permissions nem érvényesül.** Freebuff-ban a `basher` eszköz nem korlátozott — minden parancs futtatható. Ez nem biztonsági rés, mert Freebuff amúgy is minden eszközt használhat.

5. **A subagent-ek nem kérdezhetnek.** Ez a szabály (az `agents.md`-ből) Freebuff-ban is érvényes: minden tisztázást a fő agent végez az `ask_user` eszközzel.

---

## Összefoglalás

**A Freebuff 90%-ban kompatibilis a Claude Code architektúrával.** A skill-ek natívan működnek, a fájlok olvashatók, a validációs parancsok futtathatók, a subagent-ek indíthatók. Az egyetlen különbség az agent-ek kezelése: ahelyett, hogy a `spawn_agents` közvetlenül hívná a `.claude/agents/*.md` fájlokat, a fő agent olvassa be azokat és építi be a kontextusába.

> 💡 **Tipp:** Munkamenet elején mindig hívd a `skill("freebuff")`-et a bootstrap kontextus betöltéséhez!
