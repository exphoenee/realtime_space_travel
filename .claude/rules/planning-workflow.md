# Tervezési és implementációs workflow — kötelező szabályok

> Ez a fájl a projekt tervezési munkafolyamatát rögzíti. A benne foglaltak **felülírják** az AI asszisztens alapértelmezett viselkedését és a harness (Claude Code plan mode) által felkínált alternatív útvonalakat.

## Alapelv

A **`./plans/` a single source of truth**. Minden implementációs terv ott él, `NNN-kebab-case-nev.md` néven, YAML front matterrel. A `plans/roadmap.md` **generált** fájl — a plan-fájlok front matteréből készül a `.claude/scripts/generate_roadmap.py` scripttel.

A tervezés és az implementáció **skilleken és agenteken keresztül** történik (lásd [`agents.md`](../../agents.md) és [`CLAUDE.md`](../../CLAUDE.md)), nem a fő agent kézi munkájával.

---

## Tiltott

1. **Terv írása a `./plans/` mappán kívülre.** Ide tartozik a harness által felkínált `~/.claude/plans/…` plan-fájl, a scratchpad könyvtár és bármilyen ad-hoc markdown a repo gyökerében vagy máshol.
2. **Terv-tartalom írása a `plan` skill és a `planner` agent megkerülésével.** A fő agent nem ír plan-fájlt maga.
3. **A `plans/roadmap.md` kézi szerkesztése.** Generált fájl; kizárólag a `manage-roadmap` agenten (illetve a `generate_roadmap.py` scripten) keresztül frissül.
4. **Plan-fájlok kézi átszámozása**, valamint a `step` / `slug` / `dependencies` / `related_plans` YAML mezők és a `[[...]]` kereszthivatkozások kézi állítása. Ez a `manage-roadmap` agent felelőssége.
5. **Implementáció megkezdése azelőtt**, hogy a terv a `./plans/`-ban lenne és a felhasználó jóváhagyta volna.

## Kötelező

### Új terv
```
plan skill
  1. Spec begyűjtése
  2. Döntések tisztázása a felhasználóval (AskUserQuestion) — a subagentek nem tudnak kérdezni
  3. Agent(planner)         → plans/NNN-feature-name.md + kereszthivatkozások
  4. Agent(manage-roadmap)  → átszámozás, YAML mezők, roadmap.md regenerálás
  5. Riport
```

### Implementáció
```
dev skill
  → Agent(react-dev)       → React/TypeScript kód
  → Agent(i18n)            → fordítási kulcsok mind az 5 nyelven
  → Agent(manage-roadmap)  → TODO-pipálás a plan-fájlban, roadmap frissítés
```

### Ha a harness plan mode-ba kényszerít saját plan-fájllal

A harness plan-fájlja **csak vázlat / munkalap** lehet. A kanonikus terv a `./plans/`-ba kerül a `plan` skillen keresztül. Ezt a felhasználónak **jelezni kell**, és a harness-fájl a `plan` skill lefutása után eldobható.

---

## Kivétel

Puszta **kutatás vagy diagnózis** (kódolvasás, hibakeresés, kérdés megválaszolása) nem igényel plan-fájlt. A szabály akkor lép életbe, amikor a vizsgálatból **implementációs terv** születik.

---

## Miért

- A `./plans/` és a generált `roadmap.md` a projekt egyetlen áttekinthető állapotképe. A mellette futó, máshol tárolt tervek láthatatlanok maradnak, és szétcsúsztatják a roadmapet.
- A `planner` és a `manage-roadmap` agentek tartják konzisztensen a számozást, a függőségeket és a kereszthivatkozásokat — kézi szerkesztéssel ez azonnal elromlik.
- A félbeszakadt munka csak akkor folytatható, ha a haladás a plan-fájl TODO-listájában van vezetve.
