# Plan YAML Front Matter Schema

> Shared reference for all skills and agents. Every plan file in `./plans/` must start with this YAML header.

## Schema

```yaml
---
title: "[Terv címe] – [Rövid leírás]"
slug: NNN-feature-name        # kebab-case, megegyezik a fájlnévvel (.md nélkül)
type: plan                     # plan | meta (roadmap only)
category: [category]           # i18n | auth | shop | ui | roadmap | ...
status: not-started            # not-started | in-progress | implemented | partially-implemented
implemented: false             # true | false
implemented_at: null           # ISO date or null
created_at: "YYYY-MM-DD"
updated_at: "YYYY-MM-DD"
author: exphoenee
step: null                     # roadmap step (set by manage-roadmap after creation)
phases: []                     # roadmap phase number(s), list (e.g. [1, 2]); empty list if none
dependencies: []               # list of plan slugs this depends on (sorted by slug)
related_plans: []              # list of related plan slugs (sorted by slug)
tags: []                       # keywords for discoverability
---
```

## Field Rules

| Field | Rule |
|-------|------|
| `slug` | Must match the filename without `.md`, **including the numeric prefix** (e.g., `006-achievements-system`) |
| `step` | Set by `manage-roadmap` after creation — leave as `null` when creating the plan |
| `status` | Must reflect actual implementation state based on TODO checkboxes |
| `implemented` | `true` only when all core TODO items are checked `[x]` |
| `implemented_at` | Set to the date when the last core task was completed |
| `phases` | Roadmap phase number(s) as a **list** (e.g. `[1, 2]`); empty list when the plan maps to no phase. The scalar `phase:` key is deprecated — do not use it |
| `dependencies` | Plans that must be completed **before** this one. Sorted by slug |
| `related_plans` | Plans that are connected but not blocking. **Must not repeat `dependencies`.** Sorted by slug, symmetric between plans (if A lists B, B lists A — unless the link is already expressed as a dependency) |
| `tags` | Keywords for discoverability and filtering |

## Status Update Rules

When creating a new plan: `status: not-started`, `implemented: false`, `implemented_at: null`.

When updating after implementation:

| New TODO state | YAML changes |
|---|---|
| First task checked `[x]` | `status: in-progress`, `updated_at: today` |
| All core tasks checked `[x]` | `status: implemented`, `implemented: true`, `implemented_at: today`, `updated_at: today` |
| Partial completion | `status: partially-implemented`, `implemented: false`, `updated_at: today` |
| No tasks checked yet | `status: not-started`, `implemented: false` |
