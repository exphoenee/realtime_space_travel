---
name: dev
description: Thin orchestrator for implementing roadmap features. Reads the plans to find the next task, then triggers subagents to do the work — the react-dev agent for React code, the i18n agent for translations, and the manage-roadmap agent for documentation — validating in between and reporting a summary. Use when the user says "folytasd a fejlesztést", asks to implement the next phase, or runs /dev.
---

# Dev Orchestrator Skill

This is a **thin orchestrator**. It does **not** implement code itself — it **triggers subagents** (via the Agent tool) and coordinates them. You (the main agent) stay in control: you read state, spawn agents, validate, and report.

## When to Use
- The user asks to implement the next roadmap feature / continue development
- The user asks to implement a specific phase
- The user says "folytasd a fejlesztést" or runs `/dev`

## How delegation works

You delegate by calling the **Agent tool** with the matching `subagent_type`:
- `subagent_type: react-dev` — React/TypeScript components, stores, hooks, types, CSS Modules, navigation
- `subagent_type: i18n` — translation keys across all 5 languages
- `subagent_type: manage-roadmap` — plan TODO/YAML updates + roadmap regeneration

There is **no skill-loading** — never call a "skill()" loader. Each subagent runs with its own context and returns a report; relay what matters.

## Workflow

### 1. Determine current state
The single source of truth is `./plans/`. **Regenerate the roadmap before reading it** — it is script-generated and may be stale:

```bash
python .claude/scripts/generate_roadmap.py
```

Then read `plans/roadmap.md` — it contains the **Project Status**, **Overview** (per-plan TODO progress), **Next Open Tasks** (the live work front), and **Insertion Guide**. For deeper detail, open the individual plan file for the current step and read its **"Haladás (TODO)"** section (`[ ]` / `[~]` / `[x]`).

> ⚠️ If plan filenames don't match their YAML `step` fields, trigger the **manage-roadmap** agent to renumber and regenerate before continuing.

Report the state to the user before implementing:
```
📋 Roadmap állapot:
- Fázis 0 (i18n): ✅ Kész
- Fázis 1 (Firebase Auth): ⬜ Nem kezdődött
  - Következő: [ ] Firebase projekt + Auth setup
...
```

### 2. Plan the implementation
Read the relevant existing code yourself (Read/Grep/Glob). Determine files to create/modify and the new i18n keys needed. Share a short plan with the user. If requirements are genuinely ambiguous, ask the user (AskUserQuestion) **before** spawning agents — subagents cannot prompt the user.

### 3. Trigger the react-dev agent
Spawn `subagent_type: react-dev` with a precise task: what to build, which files, which conventions, and the expected i18n keys. It returns the list of files changed and the new i18n keys.

### 4. Trigger the i18n agent
Spawn `subagent_type: i18n` with the new keys (and their Hungarian source text). It adds them to all 5 languages and verifies parity.

### 5. Validate
```bash
npx tsc --noEmit
npm run test
npm run build
```
Fix failures (or re-task the relevant agent). If validation fails in a way you can't resolve, ask the user how to proceed.

### 6. (Optional) Review
For non-trivial changes, run the `/code-review` skill on the diff before documenting.

### 7. Trigger the manage-roadmap agent
Spawn `subagent_type: manage-roadmap` to update TODO checkboxes, sync plan YAML, and regenerate `roadmap.md`. Pass: which plan/slug, which TODO items completed, files changed, i18n key count, validation results.

### 8. Report
```
✅ Implementált: [feature]
📝 Dokumentáció: [plan] — [X] TODO [x]
🌐 i18n: [X] új kulcs mind az 5 nyelven
🔧 Validáció: tsc ✅ | tests ✅ | build ✅
Következő: [next task]
```

## Flow

```
/dev (you, orchestrator)
  1. Read plans → next task → report state
  2. Plan (read code, decide files + i18n keys)
  3. Agent(react-dev)      → implement React code
  4. Agent(i18n)           → translations for all 5 languages
  5. Validate (tsc, test, build)
  6. (optional) /code-review
  7. Agent(manage-roadmap) → TODO + YAML + roadmap
  8. Report
```
