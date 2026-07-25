# Architecture Rules

This file contains architecture rules that Claude Code should follow when working on the Realtime Space Travel project.

## Project Structure

```
src/
├── App.tsx                  # Main component – logic center
├── components/              # UI components (*.tsx + *.module.css)
├── hooks/                   # Custom React hooks (use* prefix)
├── services/                # External service integrations
├── state/                   # Zustand stores (use*Store pattern)
├── constants/               # Constants and universe data
├── i18n/                    # Internationalization (5 languages)
├── types/                   # TypeScript type definitions
├── stubs/                   # Test stubs
└── test/                    # Test setup
```

## File Naming Conventions

- **Components**: `PascalCase.tsx` + `PascalCase.module.css`
- **Hooks**: `camelCase.ts` with `use` prefix
- **Stores**: `use*Store.ts` pattern
- **Services**: `camelCase.ts`
- **Constants**: `camelCase.ts`
- **Types**: `index.ts` in `types/` directory
- **Tests**: `*.test.ts` co-located with source
- **i18n**: `translation.json` in `locales/{lang}/`

## State Management Rules

- Use Zustand for all state management
- Always use `persist` middleware for user preferences
- Use separate stores for different concerns:
  - `useGameStore` — game state (phase, destination, timer)
  - `useUIStore` — UI state (errors, modals, volume)
  - Future: `useAuthStore`, `useSettingsStore`, `useInventoryStore`

## i18n Rules

- Every user-facing string must be in all 5 translation files
- Use dot notation for keys: `component.element`
- Use `<Trans>` for HTML in translations
- Use `_one`/`_other` for plurals (fr, de, es)
- Never translate: proper nouns, brand names, units

## Component Rules

- Always use CSS Modules for styling
- Use `useTranslation()` hook for i18n
- Class components: use `i18n.t()` directly (not hooks)
- All components must be TypeScript-compatible

## Build & Test Commands

```bash
npm run dev          # Development server
npm run build        # Production build (tsc + vite build)
npm run test         # Run tests
npm run test:watch   # Watch mode tests
```

## Critical Constraints

- Never modify `SHIP_SPEED_KM_PER_SECOND` without updating Dashboard and MissionSelector
- `ErrorBoundary` must remain a class component (componentDidCatch)
- Camera is essential — show error overlay if unavailable
- Base href is `/realtime_space_travel/`
- Persist keys must not conflict: `space-travel-game`, `space-travel-ui`, `space-travel-lang`
