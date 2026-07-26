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

## Firebase awareness

The project uses **Firebase Auth** (Google + Anonymous) + **Realtime Database** (RTDB). When the task involves any Firebase feature (auth, RTDB, security rules, deploy), load the relevant Firebase skill **before** spawning subagents, and include Firebase context in the agent prompts:

### Available Firebase skills

| Skill | When to load |
|-------|-------------|
| `firebase-auth-basics` | Auth operations (Google sign-in, anonymous, redirect, popup, linking) |
| `firebase-basics` | Project setup, CLI usage, `firebase.json`, `.firebaserc`, env vars |
| `firebase-firestore` | Firestore operations (only if the plan explicitly uses Firestore; the project uses **RTDB** by default) |
| `firebase-data-connect` | SQL Connect relational DB operations |

If the task touches Firebase, use the `skill` tool to load the relevant Firebase skill
into context. Then include the loaded instructions in the subagent prompt.

> ⚠️ The `dev` skill itself does NOT load other skills — that is the main agent's job.
> See `agents.md`: "Nincs skill-loading. Skill sosem tölt be másik skillt."
> The main agent uses the `skill` tool to load context, then passes it to subagents.

### Firebase architecture references

| Reference file | Contents |
|---------------|----------|
| `src/firebase/config.ts` | Firebase app initialization, `getAuth()`, `getDatabase()` helpers |
| `src/firebase/auth.ts` | `startGoogleAuth()`, `signInAnonymous()`, `checkRedirectResult()`, `signOut()`, `getAuthErrorMessage()` |
| `src/firebase/authBootstrap.ts` | Module-level auth lifecycle singleton (StrictMode-safe) |
| `src/firebase/userData.ts` | RTDB operations: `ensureUserNode`, `subscribeUser`, `updateUserSettings`, `updateUserWallet`, `updateUserInventory` |
| `src/state/useAuthStore.ts` | Auth state: `user`, `uid`, `isAnonymous`, `authStatus`, `authError` |
| `src/state/useShopStore.ts` | Shop state synced with RTDB: `credits`, `creditsLoaded`, `owned`, `setCredits()`, `setOwned()` |
| `database.rules.json` | Deployed RTDB Security Rules (Phase-1: client-writable wallet/inventory) |
| `security.rules.json` | Documented RTDB Security Rules source (with comments and deployment phases) |
| `firebase.json` | Firebase project config: hosting + database rules path |
| `.github/workflows/deploy-firebase.yml` | CI/CD for Firebase Hosting + database |
| `.github/workflows/deploy.yml` | CI/CD for GitHub Pages |

### Firebase patterns to reinforce in agent prompts

When prompting the react-dev agent, include these Firebase patterns when relevant:

- **Auth state**: always use `useAuthStore` (not local state) for auth data; available selectors: `s.user`, `s.uid`, `s.isAnonymous`, `s.authStatus`, `s.authError`, `s.setAuthError`
- **Login**: use `startGoogleAuth()` (not raw `signInWithPopup`/`linkWithPopup`) — handles popup-first + redirect fallback + `credential-already-in-use`
- **Logout**: use `signOut()` from `firebase/auth` then `clearUser()` from `useAuthStore`
- **RTDB reads**: `subscribeUser()` in `authBootstrap.ts` calls `handleUserData()` which syncs into `useShopStore`
- **RTDB writes**: use `updateUserWallet(uid, credits)` and `updateUserInventory(uid, category, items)` from `userData.ts`
- **Settings sync**: use `updateUserSettings(uid, partial)` — already wired from `SettingsScreen`
- **Error handling**: always call `setAuthError(getAuthErrorMessage(err))` on Firebase errors; display via `authError` store selector
- **RTDB rules**: Phase-1 rules allow client writes to wallet/inventory; Phase-2 will lock them to server-only
- **Bootstrap singleton**: `startAuthBootstrap(handleUserData)` in `App.tsx` — module-scope flags prevent StrictMode double-init
- **`ensureUserNode`**: uses `update` (not `set`) so RTDB `set` is evaluated per top-level child, not at `users/$uid` level

## Stripe awareness

The project integrates **Stripe** for credit purchases via **Stripe Payment Links** (Spark plan — no Cloud Functions). When the task involves any Stripe feature (payment links, checkout, pricing, credit packs), load the relevant Stripe skill **before** spawning subagents, and include Stripe context in the agent prompts.

### Available Stripe skills

| Skill | When to load |
|-------|-------------|
| `stripe-best-practices` | Any Stripe integration: payment links, checkout, pricing, security, API calls |

### Stripe MCP server

The project's AI tools can connect to the Stripe MCP server at `https://mcp.stripe.com` for direct Stripe API operations. Configure it in the AI client with:
```json
{
  "mcpServers": {
    "stripe": {
      "url": "https://mcp.stripe.com",
      "headers": {
        "Authorization": "Bearer <restricted_api_key>"
      }
    }
  }
}
```
When a task requires Stripe API calls (creating payment links, prices, checking balances), use the Stripe MCP tools:
- `stripe_api_write` — Create/modify Stripe resources (Payment Links, Prices, Products)
- `stripe_api_read` — Query Stripe resources
- `stripe_api_search` — Search Stripe API methods
- `search_stripe_documentation` — Search Stripe docs

> ⚠️ The MCP requires a valid Stripe restricted API key (`rk_` prefix). The user must provide this.

### Stripe architecture references

| Reference file | Contents |
|---------------|----------|
| `src/constants/shopCatalog.ts` | Credit pack definitions (`CREDIT_PACKS`): 4 packs with price and credit amounts |
| `src/types/index.ts` | TypeScript types: `CreditPack`, `ShopProduct`, `OwnedItems` |
| `src/components/shop/CreditShopView.tsx` | Credit pack display — shows 4 packs with "Buy" button |
| `src/components/shop/CreditSuccess.tsx` | Success screen after credit purchase |
| `src/components/shop/ShopScreen.tsx` | Main shop view — orchestrates credit buying flow |
| `src/state/useShopStore.ts` | Shop state: `buyCredits(packId)`, `setCredits()`, RTDB sync via `updateUserWallet` |
| `src/i18n/locales/{en,hu,fr,de,es}/translation.json` | Translation keys under `shop.credits.*` namespace |
| `plans/005-ingame-shop-strapi-stripe.md` | Plan: Spark-compatible Payment Links approach |

### Stripe patterns to reinforce in agent prompts

- **Credit packs**: defined in `shopCatalog.ts` as `CREDIT_PACKS` — 4 packs (5€→100⭐, 10€→300⭐, 25€→700⭐, 100€→2000⭐)
- **Buy flow**: user clicks "Buy" on a credit pack → redirect to Stripe Payment Link → returns to `/shop/success?session_id=...` → credits added locally + persisted to RTDB
- **No Cloud Functions**: project is on Spark (free) plan → no server-side Stripe handling. Payment Links are created in the Stripe Dashboard
- **RTDB persistence**: after purchase, `updateUserWallet(rtdbKey, newCredits)` writes to RTDB
- **Store**: `useShopStore.buyCredits(packId)` adds credits locally; `useShopStore.setCredits(n)` syncs from RTDB
- **Security rules**: Phase-1 allows client writes to `wallet.credits` — accept this temporarily; Phase-2 will lock it when Cloud Functions are available
- **Stripe Dashboard setup needed**: create Stripe account → get API keys → create 4 Payment Links → configure success/cancel URLs with `BASE_URL`

### When to load the Stripe skill

Use the `skill` tool to load `stripe-best-practices` when:
- The task is part of `plans/005-ingame-shop-strapi-stripe.md`
- The task involves creating/modifying credit packs or payment flows
- The task involves Stripe API calls (via MCP or manual)

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
Read the relevant existing code yourself (Read/Grep/Glob). Determine files to create/modify and the new i18n keys needed.

**If the task touches Firebase** (auth, RTDB, deploy, security rules):
- Load the relevant Firebase skill (`firebase-auth-basics`, `firebase-basics`)
- Read the Firebase architecture files listed above
- Note which Firebase services are involved (Auth, RTDB, Cloud Functions, etc.)
- Check the RTDB rules (`database.rules.json`) to ensure planned writes are permitted
- Read the plan file carefully — Firebase plans (003, 004, 005) contain detailed architecture and caveats

Share a short plan with the user. If requirements are genuinely ambiguous, ask the user (AskUserQuestion) **before** spawning agents — subagents cannot prompt the user.

### 3. Trigger the react-dev agent
Spawn `subagent_type: react-dev` with a precise task: what to build, which files, which conventions, and the expected i18n keys.

**If the task involves Firebase**, include in the prompt:
- Which Firebase services are involved (Auth, RTDB, etc.)
- Key patterns from the Firebase architecture (see above)
- Specific store/action names to use (e.g., `useAuthStore.setUser`, `updateUserSettings`)
- Error handling expectations (`getAuthErrorMessage`, `setAuthError`)
- The relevant firewall skill instructions loaded at step 2

It returns the list of files changed and the new i18n keys.

### 4. Trigger the i18n agent
Spawn `subagent_type: i18n` with the new keys (and their Hungarian source text). It adds them to all 5 languages and verifies parity.

### 5. Validate
```bash
npx tsc --noEmit
npm run test
npm run build
```

**If Firebase was involved**, also validate:
- That Firebase env vars are documented (check `.env.example` exists and is up-to-date)
- That both `build:firebase` and `build:gh-pages` scripts work for multi-deploy compatibility
- RTDB rules syntax: the CI (`deploy-firebase.yml`) validates rules syntax on deploy; locally, check that `database.rules.json` matches `security.rules.json` (the documented source)

Fix failures (or re-task the relevant agent). If validation fails in a way you can't resolve, ask the user how to proceed.

### 6. (Optional) Review
For non-trivial changes, spawn the `code_reviewer_deepseek_flash` agent on the diff before documenting.

### 7. Trigger the manage-roadmap agent
Spawn `subagent_type: manage-roadmap` to update TODO checkboxes, sync plan YAML, and regenerate `roadmap.md`. Pass: which plan/slug, which TODO items completed, files changed, i18n key count, validation results.

### 8. Report
```
✅ Implementált: [feature]
📝 Dokumentáció: [plan] — [X] TODO [x]
🌐 i18n: [X] új kulcs mind az 5 nyelven
🔧 Validáció: tsc ✅ | tests ✅ | build ✅
🔥 Firebase: [relevant Firebase changes/notes]
Következő: [next task]
```

## Flow

```
/dev (you, orchestrator)
  1. Read plans → next task → report state
  2. Plan (read code, decide files + i18n keys)
     ├── Ha Firebase érintett → load skill + read Firebase refs
     └── Ask user if ambiguous
  3. Agent(react-dev)      → implement React code (+ Firebase context)
  4. Agent(i18n)           → translations for all 5 languages
  5. Validate (tsc, test, build)
     └── Ha Firebase → firebase deploy --only database --dry-run
  6. (optional) code-review
  7. Agent(manage-roadmap) → TODO + YAML + roadmap
  8. Report
```
