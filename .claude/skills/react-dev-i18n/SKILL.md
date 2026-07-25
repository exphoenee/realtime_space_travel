---
name: react-dev-i18n
description: Roadmap-aware React development skill for the Realtime Space Travel project. Reads ./plans to determine current progress, implements the next feature in the roadmap, handles i18n translations for all 5 languages, and updates plan TODO checkboxes after each implementation step.
---

# React Dev + i18n Skill

This skill implements React features for the Realtime Space Travel project in a **roadmap-aware** manner. It reads the `./plans/` directory to determine what's next, implements it, handles i18n for all 5 languages, and keeps the plan TODO checkboxes up to date.

## When to Use

Use this skill when:
- The user asks to implement the next feature in the roadmap
- The user asks to continue development from where things left off
- The user asks to implement a specific phase (Fázis 0–4)
- The user asks to add i18n translations for new UI text
- The user asks to update plan progress after implementing something

## Core Workflow

### Step 1: Read the Roadmap and Determine Current State

Always start by reading these files in order:

1. **`plans/roadmap.md`** — master overview of all phases and their status
2. **`plans/i18n-nyelvesites.md`** — i18n phase (Fázis 0) TODO section
3. **`plans/firebase-auth-settings.md`** — auth + settings phase (Fázis 1–2) TODO section
4. **`plans/ingame-shop-strapi-stripe.md`** — shop phase (Fázis 3–4) TODO section
5. **`plans/main-menu-settings.md`** — menu + settings phase TODO section

Parse the `[ ]` / `[~]` / `[x]` markers in each file's **"Haladás (TODO)"** section to determine:
- What is completed (`[x]`)
- What is in progress (`[~]`)
- What is the next uncompleted task (`[ ]`)

**Report the current state** to the user before implementing anything:
```
Current roadmap state:
- Fázis 0 (i18n): ✅ Kész
- Fázis 1 (Firebase Auth): ⬜ Nem kezdődött
  - Next: [ ] Firebase projekt + Auth setup
- Fázis 2 (Ship Select): ⬜ Nem kezdődött
...
```

### Step 2: Implement the Next Feature

Based on the roadmap state, implement the **next uncompleted task**. Follow these rules:

#### Project Conventions
- **CSS Modules**: Every component gets a `*.module.css` file
- **Hooks**: `use` prefix, camelCase, in `src/hooks/`
- **Stores**: Zustand `use*Store` pattern with persist middleware
- **Types**: Centralized in `src/types/index.ts`
- **i18n keys**: Logical groups (`menu.*`, `dashboard.*`, `pause.*`, etc.)
- **Tests**: `*.test.ts` co-located with the tested file
- **Translations**: Must be in sync across all 5 languages

#### Implementation Rules
1. **Read existing code first** — understand the current implementation before modifying
2. **Reuse existing patterns** — follow the conventions already established
3. **Minimal changes** — make as few changes as possible to achieve the goal
4. **Type safety** — all code must be TypeScript-compatible
5. **No assumptions about libraries** — verify usage before adding new dependencies

### Step 3: Handle i18n for All New Text

**Every new user-facing string** must be added to all 5 translation files:

1. `src/i18n/locales/hu/translation.json` (Hungarian — primary)
2. `src/i18n/locales/en/translation.json` (English — fallback)
3. `src/i18n/locales/fr/translation.json` (French)
4. `src/i18n/locales/de/translation.json` (German)
5. `src/i18n/locales/es/translation.json` (Spanish)

#### i18n Rules
- **Key naming**: Use dot notation matching component groups: `menu.newKey`, `dashboard.newKey`
- **Interpolation**: Use `{{variable}}` syntax in translation values
- **HTML in translations**: Use `<Trans>` component with `<0>...</0>` or named components
- **Plurals**: Use `_one` / `_other` suffixes for languages that need them (fr, de, es)
- **Don't translate**: Proper nouns (Proxima Centauri, etc.), brand names, units (km/s, °C)
- **Class components**: Use `i18n.t()` directly (not hooks) for ErrorBoundary

#### Translation Update Process
1. Add the new key to `hu/translation.json` with the Hungarian text
2. Add the same key to `en/translation.json` with English translation
3. Add the same key to `fr/translation.json` with French translation
4. Add the same key to `de/translation.json` with German translation
5. Add the same key to `es/translation.json` with Spanish translation
6. Verify all 5 files have the same number of keys (key parity)

### Step 4: Update Plan TODO Checkboxes

**Immediately after implementing each step**, update the relevant plan file's TODO section:

#### Update Rules
1. **Mark completed tasks**: Change `[ ]` to `[x]` in the plan file
2. **Mark in-progress tasks**: Change `[ ]` to `[~]` when starting a task
3. **Be specific**: If a task has sub-tasks, mark each individually
4. **Update roadmap.md**: If a phase is completed, update the summary table
5. **Add notes**: If there are caveats or follow-ups needed, add them

#### Where to Update
| What was implemented | Which file to update |
|---|---|
| i18n infrastructure | `plans/i18n-nyelvesites.md` |
| Firebase auth | `plans/firebase-auth-settings.md` |
| Ship select | `plans/firebase-auth-settings.md` (Fázis 2 section) |
| Shop features | `plans/ingame-shop-strapi-stripe.md` |
| Menu/settings | `plans/main-menu-settings.md` |
| Phase completion | `plans/roadmap.md` (summary table) |

### Step 5: Validate Changes

After implementation, run validation:

```bash
# Type checking
npx tsc --noEmit

# Tests
npm run test

# Build
npm run build
```

Fix any errors before considering the task complete.

### Step 6: Report Summary

Provide a clear summary of what was done:

```
✅ Implemented: [feature name]
📝 Updated plan: [file name] — marked [x] on [task]
🌐 i18n: Added [X] new keys to all 5 languages
🔧 Validation: tsc ✅ | tests ✅ | build ✅

Next in roadmap: [next task from plan]
```

## Phase-Specific Guidelines

### Fázis 0 — i18n (Completed)
- All infrastructure is in place
- All 5 languages have full translations
- LanguageSwitcher is in SettingsScreen
- Only new UI text needs translation updates

### Fázis 1 — Firebase Auth + Settings
**Prerequisites**: None (can start fresh)
**New modules needed**:
```
src/firebase/config.ts
src/firebase/auth.ts
src/firebase/userData.ts
src/state/useAuthStore.ts
src/state/useSettingsStore.ts
src/state/useInventoryStore.ts
src/components/SettingsMenu.tsx
src/components/SettingsMenu.module.css
src/components/AccountSection.tsx
```
**Key decisions**:
- Firebase Auth (Google + Anonymous)
- RTDB (not Firestore)
- Security Rules: wallet/inventory server-only
- Anonymous→Google account linking

### Fázis 2 — Ship Select + Speed
**Prerequisites**: Fázis 1 (Firebase Auth + RTDB)
**New modules needed**:
```
src/components/ShipSelect.tsx
src/components/ShipSelect.module.css
```
**Key changes**:
- New `GamePhase: "shipSelect"`
- Ship speed integration with Dashboard
- Active ship determines travelYears calculation

### Fázis 3 — Shop Backend (Strapi + Stripe)
**Prerequisites**: Fázis 1 (Firebase Auth + RTDB)
**Backend setup**:
- Strapi project (separate repo or /server)
- Product + Order content types
- Firebase ID token verification
- Stripe webhook → Admin SDK → Firebase inventory

### Fázis 4 — Shop Frontend + Stripe
**Prerequisites**: Fázis 3 (Shop Backend)
**New modules needed**:
```
src/components/ShopScreen.tsx
src/components/ShopScreen.module.css
src/components/ProductCard.tsx
src/components/ShopTabs.tsx
src/components/CreditBalance.tsx
src/components/PurchaseModal.tsx
src/components/CheckoutReturn.tsx
```

## Common Patterns

### Adding a New Component with i18n

1. Create `src/components/NewComponent.tsx`:
```tsx
import { useTranslation } from 'react-i18next';

const NewComponent = () => {
  const { t } = useTranslation();
  return <div>{t('newComponent.text')}</div>;
};
```

2. Create `src/components/NewComponent.module.css`

3. Add keys to all 5 translation files:
```json
{
  "newComponent": {
    "text": "Fordított szöveg"
  }
}
```

4. Add component to `ScreenRouter.tsx` if it's a new screen

### Adding a New Store

1. Create `src/state/useNewStore.ts`:
```ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface NewState {
  setValue: (value: Type) => void;
}

const useNewStore = create<NewState>()(
  persist(
    (set) => ({
      setValue: (value) => set({ value }),
    }),
    { name: 'space-travel-new' }
  )
);

export default useNewStore;
```

2. Use in components: `const value = useNewStore((s) => s.value);`

### Adding a New GamePhase

1. Add to `src/types/index.ts`:
```ts
export type GamePhase = 'intro' | 'mainMenu' | 'missionSelect' | 'newPhase' | ...;
```

2. Update `useGameStore.ts` `phaseToFlags`:
```ts
case 'newPhase':
  return { showIntro: false, isPaused: true, ... };
```

3. Add case to `ScreenRouter.tsx`:
```ts
case 'newPhase':
  return <NewComponent />;
```

4. Add navigation in `MainMenu.tsx` or `MissionSelector.tsx`

## Troubleshooting

### Translation key not found
- Check all 5 JSON files have the key
- Verify key spelling matches exactly
- Check for typos in `t('key.path')` calls

### Build fails after changes
- Run `npx tsc --noEmit` to find type errors
- Check imports are correct
- Verify all required props are passed

### Tests fail
- Check if tests use text content that was moved to i18n
- Update test setup to initialize i18n (see `src/test/setup.ts`)
- Use `screen.getByText(t('key'))` or `screen.getByTestId()` instead of raw text

### Phase transition not working
- Verify `phaseToFlags` includes the new phase
- Check `GamePhase` type includes the new phase
- Verify `ScreenRouter` has a case for the new phase
