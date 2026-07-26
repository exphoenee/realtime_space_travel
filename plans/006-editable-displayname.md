---
title: "Szerkeszthető fantázianév a Settings menüben – ceruza/pipa UI + RTDB mentés"
slug: 006-editable-displayname
type: plan
category: auth
status: implemented
implemented: true
implemented_at: "2026-07-26"
created_at: "2026-07-26"
updated_at: "2026-07-26"
author: exphoenee
step: 6
phases:
  - 1
dependencies:
  - 004-firebase-auth-bugfix
related_plans:
  - 003-firebase-auth-settings
  - 004-firebase-auth-bugfix
tags:
  - firebase
  - auth
  - rtdb
  - settings
  - profile
  - nickname
  - ui
---

# Szerkeszthető fantázianév a Settings menüben

**Cél:** A Settings menü fiók szekciójában a felhasználó:
1. Láthassa a Google-fiók nevét a "Hitelesítve" felirat felett
2. Szerkeszthessen egy fantázianevet (nickname) egy input mezőben
3. A mező mellett ceruza ikon → kattintásra szerkeszthetővé válik
4. Szerkesztés közben a ceruza pipává változik → pipára kattintva mentés + mező zárolás
5. A fantázianév a Firebase RTDB `profile/nickname` mezőbe kerül mentésre

## Döntések

| Kérdés | Választás |
|--------|-----------|
| Adatbázis | Firebase RTDB `users/{uid}/profile/nickname` |
| Mentés trigger | Pipára kattintás **vagy** Enter billentyű |
| Mégse | Escape → visszaállítás + mező zárás |
| Hosszkorlát | 30 karakter (maxLength) |
| UI ikonok | ✏️ ceruza (alap) → ✓ pipa (szerkesztés közben) |
| Store | `useAuthStore.nickname` + `setNickname`; RTDB-ből szinkronizálva a `handleUserData`-ban |

## Megvalósítás

### Módosított fájlok

- `src/state/useAuthStore.ts` — `nickname: string`, `nicknameLoaded: boolean`, `setNickname`
- `src/firebase/userData.ts` — `UserNode.profile.nickname: string`, `updateUserNickname()` függvény
- `src/App.tsx` — `handleUserData`: `profile.nickname` → `useAuthStore.setNickname`
- `src/components/screens/SettingsScreen.tsx` — editable input mező ceruza/pipa gombbal
- `src/components/screens/SettingsScreen.module.css` — `.nicknameRow`, `.nicknameInput`, `.nicknameToggle`
- `src/i18n/locales/*/translation.json` — `settings.nickname`, `settings.nicknamePlaceholder`, `settings.nicknameEdit`, `settings.nicknameSave`

### UI Flow

```
┌─────────────────────────────────────────────┐
│  Becenév                               ✏️   │  ← zárolt állapot (disabled input)
│  [John Doe                               ]  │  ← a nickname vagy a Google displayName
├─────────────────────────────────────────────┤
│  Becenév                               ✓   │  ← szerkesztés közben (editable input)
│  [Új becenév            ]                  │  ← Enter = mentés, Escape = visszaállítás
├─────────────────────────────────────────────┤
│  User ID: MCyVmgd2...                       │
│  [Kijelentkezés]                            │
└─────────────────────────────────────────────┘
```

### RTDB változás

A `UserNode.profile` új mezője:
```ts
profile: {
  displayName: string;     // Google név (csak olvasható, autoset)
  nickname: string;        // felhasználó által szerkeszthető fantázianév
  ...
}
```

Alapértelmezett: `nickname: ""` (üres string)
Ha a nickname üres, a UI a Google `displayName`-t mutatja helyette.

### ensureUserNode kompatibilitás

A re-login-nél (`ensureUserNode` existing node update) a `nickname` NEM kerül felülírásra — a meglévő érték megmarad.
