---
name: plan
description: Thin entry-point for creating a new plan. Settles the spec and any user decisions, then triggers the planner agent to write the plan content and the manage-roadmap agent to renumber files, fix cross-references, and regenerate roadmap.md. Use when the user says "/plan <description>", "tervezd meg <feature>", or wants a new feature/phase added to the roadmap.
---

# Plan Skill

This is a **thin entry-point**. It does not write plan content itself — it **triggers subagents** (via the Agent tool): the `planner` agent creates the plan, then the `manage-roadmap` agent renumbers and regenerates the roadmap. There is **no skill-loading** — never call a "skill()" loader.

## When to Use
- The user says `/plan <description>` or "tervezd meg <feature>"
- The user wants a new feature/phase added to the roadmap
- The user wants a plan inserted between existing phases

## Workflow

### 1. Capture the spec
Extract the description/specification from the user's message (a one-liner, a detailed spec, or a reference).

### 2. Settle decisions with the user
Because subagents cannot prompt the user, resolve ambiguity **here**, before spawning anything.

First, **regenerate and read the roadmap** to see the current shape and where the new plan fits:

```bash
python .claude/scripts/generate_roadmap.py
```

`plans/roadmap.md`'s **Insertion Guide** (per-plan dependencies + dependents) tells you between which steps the new plan belongs. If placement, architecture, or scope is still unclear, ask the user (AskUserQuestion). You may also trigger the **manage-roadmap** agent (Section D — placement analysis) for a recommendation and relay it to the user.

### 3. Trigger the planner agent
Spawn `subagent_type: planner` with the settled spec and the user's decisions. It reads existing plans, creates `plans/[NNN-feature-name].md` (with `step: null`), and adds cross-references. It returns the file path and any open questions.

### 4. Trigger the manage-roadmap agent
Spawn `subagent_type: manage-roadmap` to renumber plan files if the new plan was inserted between existing ones, update all YAML `step`/`slug`/dependency fields, fix `[[...]]` cross-references, and regenerate `roadmap.md`.

### 5. Report
```
📋 Új terv: plans/[NNN-feature-name].md
📝 Planner: [what was created/updated]
🗺️ Manage-Roadmap: [renumbering, roadmap regenerated]
❓ Kérdések (ha voltak): [answers]
```

## Flow

```
/plan (you, entry-point)
  1. Capture spec
  2. Settle decisions with the user (AskUserQuestion);
     optionally Agent(manage-roadmap) for placement analysis
  3. Agent(planner)        → create plan content + cross-refs
  4. Agent(manage-roadmap) → renumber, update YAML, regenerate roadmap
  5. Report
```

## Example
**User:** `/plan Add a leaderboard with Firebase RTDB, top 10 service times`
1. Capture the spec.
2. Ask if it stores in Firebase RTDB or a separate backend (if unclear).
3. Agent(planner) → creates `plans/NNN-leaderboard.md`, cross-references related plans.
4. Agent(manage-roadmap) → assigns step, renumbers, regenerates roadmap.
5. Report.
