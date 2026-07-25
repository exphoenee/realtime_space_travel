---
name: planner
description: Roadmap-aware planner skill for the Realtime Space Travel project. Creates markdown plan files in ./plans/, analyzes consistency with existing plans, rewrites conflicting plans, asks the user about unclear decisions, and inserts the new plan into the roadmap in the correct implementation order.
---

# Planner Skill

This skill creates **roadmap-aware plans** for the Realtime Space Travel project. It generates markdown plan files, ensures consistency with existing plans, resolves conflicts, asks the user about unclear decisions, and integrates the new plan into the roadmap.

## When to Use

Use this skill when:
- The user wants to plan a new feature or phase
- The user describes a feature idea that needs a formal plan
- The user wants to add a new plan to the roadmap
- The user asks to "tervezd meg" (plan) something
- The user wants to create a plan for a new integration or module

## Core Workflow

### Step 1: Read All Existing Plans

**Always** read all existing plans first to understand the current state:

1. **`plans/roadmap.md`** — master overview, phase ordering, dependencies
2. **`plans/i18n-nyelvesites.md`** — i18n infrastructure (Fázis 0)
3. **`plans/firebase-auth-settings.md`** — auth + settings (Fázis 1–2)
4. **`plans/ingame-shop-strapi-stripe.md`** — shop + payments (Fázis 3–4)
5. **`plans/main-menu-settings.md`** — menu + settings UI

Parse each plan's:
- **Title and purpose** — what does this plan cover?
- **Decisions table** — what choices were made?
- **Dependencies** — what must come before?
- **TODO section** — what's done, what's pending?
- **Architecture sections** — what systems are involved?

### Step 2: Analyze the User's Request

Understand what the user wants to plan:
- **What** is the feature/module?
- **Why** is it needed?
- **When** should it be implemented (which phase)?
- **Dependencies** — does it depend on existing plans?

### Step 3: Identify Conflicts and Questions

Before creating the plan, check for:

#### Potential Conflicts
- Does the new plan overlap with an existing plan?
- Does it contradict a decision already made?
- Does it change the phase ordering?
- Does it affect the architecture (e.g., backend responsibilities)?

#### Questions for the User
Use `ask_user` to clarify:
- **Ambiguous requirements** — if the feature description is unclear
- **Conflicting decisions** — if the new plan contradicts an existing decision
- **Architecture choices** — if there are multiple valid approaches
- **Priority/ordering** — if it's unclear where this fits in the roadmap
- **Scope** — if the feature is too broad or too narrow

**Example questions:**
- "Hogyan illeszkedjen a meglévő Firebase auth rendszerhez?"
- "Ez egy új fázis legyen, vagy egy meglévő fázis bővítése?"
- "Milyen backend szolgáltatást használjunk ehhez?"
- "Milyen új i18n kulcsok kellenek?"

### Step 4: Determine Plan Placement

Based on the analysis, decide:

#### New Phase vs. Existing Phase Extension
- **New phase**: If it's a major new feature area (e.g., multiplayer, achievements)
- **Existing phase extension**: If it logically extends an existing phase (e.g., adding a new tab to the shop)

#### Phase Numbering
Current phases:
- **Fázis 0**: i18n (completed)
- **Fázis 1**: Firebase Auth + Settings
- **Fázis 2**: Ship Select + Speed
- **Fázis 3**: Shop Backend
- **Fázis 4**: Shop Frontend

New plans should either:
- Extend an existing phase (add to its TODO)
- Insert as a new phase between existing ones
- Append as a new phase after Fázis 4

### Step 5: Create the Plan File

Create a new markdown file in `./plans/` with a descriptive filename:

```
plans/[feature-name].md
```

Use kebab-case for filenames (e.g., `achievements-system.md`, `multiplayer.md`).

#### Plan Template

```markdown
# [Terv címe] – [Rövid leírás]

**Cél:** [Mi a terv célja, 1-2 mondatban]

## Döntések (egyeztetve)

| Kérdés | Választás |
|--------|-----------|
| [Kérdés 1] | [Választás] |
| [Kérdés 2] | [Választás] |

---

## ✅ Haladás (TODO)

> Jelölés: `[ ]` hátravan · `[~]` folyamatban · `[x]` kész.

- [ ] [Feladat 1]
- [ ] [Feladat 2]
- [ ] [Feladat 3]

---

## 1. Architektúra

[Leírás arról, hogyan illeszkedik a meglévő rendszerhez]

## 2. Fájlstruktúra

[Új fájlok listája, ha vannak]

## 3. Megvalósítási lépések

1. [Első lépés]
2. [Második lépés]
3. [Harmadik lépés]

## 4. Függőségek

- [Milyen meglévő tervre épül?]
- [Milyen külső szolgáltatások kellenek?]

## 5. i18n

[Új i18n kulcsok listája, ha vannak]

## 6. Kockázatok / figyelmeztetések

- [Kockázat 1]
- [Kockázat 2]

## 7. Kapcsolódó tervek

- [[existing-plan]] – [Hogyan kapcsolódik]

## 8. Becsült ráfordítás

| Feladat | Nagyságrend |
|---------|-------------|
| [Feladat 1] | ~[idő] |
| [Feladat 2] | ~[idő] |

**Kész definíció:** [Mikor tekintjük késznek a tervet]
```

### Step 6: Update Existing Plans if Needed

If the new plan affects existing plans:

1. **Add cross-references** — add `[[new-plan]]` links to related sections in existing plans
2. **Update dependency notes** — if the new plan changes what's blocking what
3. **Modify existing TODOs** — if the new plan adds sub-tasks to existing phases
4. **Update architecture sections** — if the new plan changes the system design

**Do NOT delete or rewrite existing plan content** — only add cross-references and minor clarifications.

### Step 7: Update the Roadmap

Update `plans/roadmap.md`:

1. **Add to the plan list** at the top:
```markdown
- [[new-plan]] – [rövid leírás]
```

2. **Update the phase ordering diagram** if it's a new phase:
```
Fázis 0  i18n alapréteg  ─────────────┐
                                       ▼
Fázis 1  Firebase auth + RTDB          ▼
                                       ▼
Fázis 2  Hajóválasztó                  ▼
                                       ▼
Fázis 3  Bolt backend                  ▼
                                       ▼
Fázis 4  Bolt frontend                 ▼
                                       ▼
Fázis 5  [Új terv]  ← ÚJ
```

3. **Add to the summary table**:
```markdown
| Fázis X — [Név] | [[new-plan]] | ⬜ Nem kezdődött el |
```

4. **Update the "Kritikus utak" table** if the new plan introduces new blockers

### Step 8: Report Summary

Provide a clear summary to the user:

```
📋 Új terv létrehozva: plans/[feature-name].md

📝 Tartalom:
- Cél: [rövid leírás]
- Fázis: [X] — [fázis neve]
- Feladatok: [X] db

🔗 Kapcsolódó tervek:
- [[existing-plan1]] – [hogyan kapcsolódik]
- [[existing-plan2]] – [hogyan kapcsolódik]

🗺️ Roadmap frissítve:
- Új fázis hozzáadva a sorrendhez
- Összesített tábla frissítve

❓ Kérdések (ha voltak):
- [kérdés] → [válasz]
```

## Plan Naming Conventions

- Use kebab-case: `achievements-system.md`, `multiplayer-lobby.md`
- Be descriptive: `social-features.md`, `leaderboard.md`
- Avoid abbreviations: `in-app-purchases.md` not `iap.md`

## Existing Plan References

When referencing existing plans, use the `[[plan-name]]` syntax (without `.md`):
- `[[i18n-nyelvesites]]`
- `[[firebase-auth-settings]]`
- `[[ingame-shop-strapi-stripe]]`
- `[[main-menu-settings]]`

## Phase Numbering Rules

1. **Fázis 0** is always i18n (completed, never changes)
2. **Fázis 1–4** are the core roadmap (Firebase → Ship → Shop Backend → Shop Frontend)
3. **New phases** can be inserted between existing phases or appended after Fázis 4
4. **Phase numbers are stable** — once assigned, don't renumber existing phases
5. **Use "Fázis X" notation** consistently in all plan files

## Conflict Resolution

### If the new plan contradicts an existing plan:
1. Ask the user which approach to prefer
2. Update the existing plan to note the conflict
3. Add a cross-reference in both plans

### If the new plan overlaps with an existing plan:
1. Ask the user if it should be merged or kept separate
2. If merged, add it as sub-tasks in the existing plan's TODO
3. If separate, clearly define the boundaries between the two

### If the new plan changes phase ordering:
1. Explain the impact to the user
2. Ask for confirmation before modifying the roadmap
3. Update all affected cross-references

## Example: Creating a Plan

**User request:** "Készíts egy tervet a leaderboard funkcióhoz"

**Steps:**
1. Read all existing plans
2. Analyze: leaderboard needs auth (Fázis 1), could show best service times, might need a new backend
3. Ask: "Ez a Firebase RTDB-ben tárolódjon, vagy külön backend kell?"
4. Create: `plans/leaderboard.md`
5. Update: `plans/roadmap.md` (add as Fázis 5 or extension of Fázis 1)
6. Cross-reference: add `[[leaderboard]]` to `firebase-auth-settings.md` stats section
7. Report summary

## Tips for Good Plans

1. **Be specific** — don't leave ambiguous requirements
2. **Include file lists** — show exactly what files to create/modify
3. **Show code patterns** — include TypeScript interfaces, component structures
4. **List i18n keys** — specify all new translation keys needed
5. **Estimate effort** — help with prioritization
6. **Note risks** — what could go wrong?
7. **Cross-reference** — link to all related plans
