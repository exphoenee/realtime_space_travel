---
name: freebuff
description: Bootstrap skill for Freebuff (Buffy) sessions. Loads the hybrid Claude Code ↔ Freebuff context — rules, references, agent instructions, and workflow definitions. Always load this first when starting a Freebuff session in the Realtime Space Travel project.
---

# Freebuff Bootstrap Skill

> A skill, ami betölti a Freebuff (Buffy, deepseek-v4-flash) munkamenethez szükséges kontextust a Realtime Space Travel projektben.

## Első lépés — Kötelező fájlok betöltése

A munkamenet elején **mindig** olvasd be az alábbi fájlokat. Ez biztosítja, hogy a projekt összes konvenciója, szabálya és architektúrája a kontextusban legyen.

```text
read_files(
  "CLAUDE.md",                          # Projekt áttekintés, stack, struktúra
  "agents.md",                          # Agent architektúra dokumentáció
  ".freebuff/README.md",                # Freebuff hibrid modell dokumentáció
  ".claude/rules/main-rules.md",        # Asimov törvényei (alap szabályok)
  ".claude/rules/planning-workflow.md", # Tervezési workflow szabályok
  ".claude/lessons-learned.md",         # Tanulságok (olvasd el fejlesztés előtt!)
)
```

## Második lépés — Feladattól függő fájlok

Attól függően, hogy mit kell csinálnod, olvasd be a releváns agent fájlokat:

### Implementáció előtt (dev skill)

```text
read_files(
  ".claude/agents/react-dev.md",        # React/TypeScript konvenciók
  ".claude/agents/i18n.md",             # i18n fordítási minta
  ".claude/agents/manage-roadmap.md",   # Roadmap frissítés
  ".claude/references/project-conventions.md",  # Kód konvenciók
  ".claude/references/architecture-current.md",  # Jelenlegi architektúra
)
```

### Új terv előtt (plan skill)

```text
read_files(
  ".claude/agents/planner.md",          # Terv készítés minta
  ".claude/agents/manage-roadmap.md",
  ".claude/references/plan-yaml-schema.md",
  ".claude/references/plan-naming.md",
  ".claude/references/phase-numbering.md",
  ".claude/references/architecture-planned.md",
)
```

### Firebase érintettség esetén

```text
skill("firebase-auth-basics")    # Firebase Auth skill
skill("firebase-basics")         # Firebase alap skill
read_files(
  "src/firebase/config.ts",
  "src/firebase/auth.ts",
  "src/firebase/authBootstrap.ts",
  "src/firebase/userData.ts",
  "src/state/useAuthStore.ts",
)
```

### Stripe érintettség esetén

```text
skill("stripe-best-practices")
```

## Harmadik lépés — Roadmap állapot

Mielőtt bármilyen implementációba kezdenél, mindig generáld újra a roadmap-et és olvasd el:

```bash
python .claude/scripts/generate_roadmap.py
```

Majd olvasd el a generált `plans/roadmap.md`-t és a releváns plan fájl(oka)t.

## Negyedik lépés — Agent helyettesítés

A Claude Code specifikus agent típusok (`react-dev`, `i18n`, `manage-roadmap`, `planner`) **nem** hívhatók közvetlenül `spawn_agents(agent_type: "react-dev")` formában Freebuff-ban.

**Ehelyett:**

1. **Olvasd be az agent fájlt** (`read_files(".claude/agents/<name>.md")`)
2. **Építsd be a kontextusba** az agent utasításait
3. **Használd a beépített eszközöket** a munka elvégzésére (`str_replace`, `write_file`, `code_searcher`, `basher`, `file-picker`, stb.)

Részletes leírás: `.freebuff/README.md` → **Agent helyettesítési minta** section.

## Ötödik lépés — Validáció

Minden implementáció után futtasd le a validációt:

```bash
basher("npx tsc --noEmit")       # TypeScript ellenőrzés
basher("npm run test")           # Tesztek futtatása
basher("npm run build")          # Build ellenőrzés
```

## Hatodik lépés — Lezárás

1. `spawn_agents(code-reviewer-deepseek-flash)` — kód review
2. Roadmap frissítés: `basher("python .claude/scripts/generate_roadmap.py")`
3. Report a felhasználónak

---

## Gyors hivatkozások

### Freebuff kompatibilis beépített agent-ek

| agent_type | Használat |
|---|---|
| `basher` | Terminál parancsok |
| `code-searcher` | Kód keresés (ripgrep) |
| `file-picker` | Releváns fájlok megtalálása |
| `researcher-web` | Web keresés |
| `researcher-docs` | Dokumentáció olvasás |
| `browser-use` | Böngésző tesztelés |
| `code-reviewer-deepseek-flash` | Kód review |
| `thinker-gpt` | Mély gondolkodás |
| `context-pruner` | Kontextus tömörítés |
| `tmux-cli` | CLI alkalmazás tesztelés |

### Gyakori parancsok

```bash
npm run dev                # Fejlesztői szerver
npx tsc --noEmit           # TypeScript ellenőrzés
npm run test               # Tesztek
npm run build              # Build
python .claude/scripts/generate_roadmap.py  # Roadmap generálás
```

### Fontos fájlok

| Fájl | Tartalom |
|---|---|
| `.freebuff/README.md` | Freebuff hibrid modell teljes dokumentációja |
| `CLAUDE.md` | Projekt áttekintés |
| `agents.md` | Agent architektúra |
| `.claude/rules/main-rules.md` | Asimov törvényei |
| `.claude/rules/planning-workflow.md` | Tervezési szabályok |
| `.claude/lessons-learned.md` | Tanulságok |
| `.claude/references/` | Architektúra, konvenciók, YAML séma |
| `plans/roadmap.md` | **Generált** roadmap |
