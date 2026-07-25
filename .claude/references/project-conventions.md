# Project Conventions

> Shared reference for the implementation skills and agents. Defines coding conventions for the Realtime Space Travel project.

## File Structure

```
src/
├── App.tsx                  # Main component – logic center
├── components/
│   ├── screens/             # Full-page GamePhase views (IntroScreen, MainMenu, MissionSelector, SettingsScreen, LoadingScreen)
│   ├── features/            # In-game feature components (Dashboard, PauseMenu, DebugOverlay)
│   ├── shop/                # Shop feature (ShopScreen, ProductCard, CartView, CreditShopView, ...)
│   ├── ui/                  # Reusable generic UI components (Modal, Tabs, LanguageSwitcher, Starfield, ScreenCheck, ErrorBoundary)
│   └── routing/             # Screen phase router (ScreenRouter)
├── hooks/                   # Custom React hooks (use* prefix)
├── services/                # External service integrations
├── state/                   # Zustand stores (use*Store pattern)
├── constants/               # Constants and universe data
├── i18n/                    # Internationalization (5 languages)
├── types/                   # TypeScript type definitions
├── stubs/                   # Test stubs
└── test/                    # Test setup
```

### Component directory rules

| Directory | Contents | Example |
|-----------|----------|---------|
| `screens/` | Egy-egy GamePhase-hez tartozó teljes képernyős nézet | `IntroScreen.tsx`, `MainMenu.tsx` |
| `features/` | Játék közben használt funkció-komponensek | `Dashboard.tsx`, `PauseMenu.tsx` |
| `shop/` | Bolt funkció összes komponense (saját mappa, mert 10+ fájl) | `ShopScreen.tsx`, `ProductCard.tsx` |
| `ui/` | **Generikus, újrahasznosítható UI komponensek.** Bármely feature használhatja őket. | `Modal.tsx`, `Tabs.tsx`, `LanguageSwitcher.tsx`, `Starfield.tsx` |
| `routing/` | Navigációs / fázis-orchestrációs komponens | `ScreenRouter.tsx` |

Ha egy feature 5+ komponensné nagyobbra nő, kapjon saját mappát (`features/<feature>/`).

**Generikus → feature irány:** a `ui/`-beli komponensek SOHA nem importálhatnak shop-specifikus modulokat (pl. `shopCatalog`, `useShopStore`). Csak props-on keresztül kapnak adatot. A feature-k (pl. shop) importálják a `ui/` komponenseket, nem fordítva.

## File Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| Components | `PascalCase.tsx` + `PascalCase.module.css` | `ShipSelect.tsx`, `ShipSelect.module.css` |
| Hooks | `camelCase.ts` with `use` prefix | `useWeather.ts`, `useCatalog.ts` |
| Stores | `use*Store.ts` pattern | `useGameStore.ts`, `useUIStore.ts` |
| Services | `camelCase.ts` | `faceRecognition.ts`, `strapiApi.ts` |
| Constants | `camelCase.ts` | `universeData.ts` |
| Types | `index.ts` in `types/` directory | `src/types/index.ts` |
| Tests | `*.test.ts` co-located with source | `useGameStore.test.ts` |
| i18n | `translation.json` in `locales/{lang}/` | `src/i18n/locales/hu/translation.json` |

## State Management

- Use **Zustand** for all state management
- Always use `persist` middleware for user preferences
- Separate stores for different concerns:
  - `useGameStore` — game state (phase, destination, timer)
  - `useUIStore` — UI state (errors, modals, volume)
  - Future: `useAuthStore`, `useSettingsStore`, `useInventoryStore`

## Styling

- Always use **CSS Modules** (every component gets a `*.module.css` file)
- Follow the established module.css patterns in the codebase

## Type Safety

- All code must be TypeScript-compatible (`tsc --noEmit` must pass)
- Centralized types in `src/types/index.ts`

## Implementation Rules

1. **Read existing code first** — understand the current implementation before modifying
2. **Reuse existing patterns** — follow conventions already established in the codebase
3. **Minimal changes** — make as few changes as possible to achieve the goal
4. **No assumptions about libraries** — verify usage in `package.json` and imports before adding new dependencies

## Build & Test Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server |
| `npm run build` | Production build (tsc + vite build) |
| `npm run test` | Run tests |
| `npm run test:watch` | Watch mode tests |

## Critical Constraints

- Never modify `SHIP_SPEED_KM_PER_SECOND` without updating Dashboard and MissionSelector
- `ErrorBoundary` must remain a class component (componentDidCatch)
- Camera is essential — show error overlay if unavailable
- Base href is `/realtime_space_travel/`
- Persist keys must not conflict: `space-travel-game`, `space-travel-ui`, `space-travel-lang`
