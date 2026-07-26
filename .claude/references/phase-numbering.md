# Phase Numbering Rules

> Shared reference for all skills and agents. Defines how roadmap phases are numbered and ordered.

## `step` vs `phases` — two different things

| | `step` (+ filename prefix) | `phases` |
|---|---|---|
| Means | **Implementation order** in `plans/` | A stable **label** for a body of work ("Fázis 3") |
| Changes? | **Renumbered** whenever a plan is inserted | **Never** — once assigned, it stays |
| Owner | `manage-roadmap` agent | The plan author |
| Empty? | **No** — every plan must have an integer `step` | Yes (`[]`) — not every plan belongs to a numbered phase |

`phases` is always a **list** (the scalar `phase:` key is deprecated), so a plan can carry more
than one phase label. A plan may therefore sit at `step: 2` with `phases: []` while `step: 3`
carries `phases: [1, 2]`.
That is **not** an inconsistency: steps say *when we build it*, phases say *what we call it*.

## Rules

1. **Fázis 0** is always i18n (step 0, never changes)
2. **step 0 and step 1** are stable foundations (i18n, main-menu-settings) — never renumbered
3. **Every other step is renumberable.** Inserting a plan shifts the steps after it; that is
   the normal, expected cost of insertion — do not avoid it by appending to the end.
4. **Phase numbers are stable** — never renumber an existing phase
5. **Use "Fázis X" notation** consistently in all plan files

## Current Phases

> ⚠️ **Deliberately not listed here** — a hand-maintained table drifts from the plan files on
> every renumbering. The live phase↔step mapping is the **Overview** table of the generated
> `plans/roadmap.md` (`python .claude/scripts/generate_roadmap.py`).

## Adding New Plans

New plans should either:
- Extend an existing phase (add to its TODO)
- Insert as a new phase between existing ones
- Append as a new phase at the end

**Insertion is placement by dependency, not by "next free number":** a plan goes *after the
highest step of its dependencies* and *before the lowest step of anything that must depend on
it*. If its own text says it is a prerequisite of an existing plan, it belongs **before** that
plan — even though that means renumbering.

> 🔄 Renumbering and roadmap regeneration are handled by the `manage-roadmap` agent (`.claude/agents/manage-roadmap.md`), which runs `python .claude/scripts/generate_roadmap.py` to rebuild `roadmap.md` from the plan files.
