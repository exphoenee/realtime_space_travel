---
title: "Toast notification rendszer – rendszerüzenetek a bal felső sarokban"
slug: 015-toast-notification
type: plan
category: ui
status: not-started
implemented: false
implemented_at: null
created_at: "2026-07-29"
updated_at: "2026-07-29"
author: exphoenee
step: 15
phases: []
dependencies:
  - 013-social-multiplayer
related_plans:
  - 012-wall-of-shame
tags:
  - ui
  - notifications
  - toast
  - i18n
  - social
---

# Toast notification rendszer – rendszerüzenetek a bal felső sarokban

**Cél:** egy nem-blokkoló toast/értesítési rendszer létrehozása, amely a **bal felső sarokban** jeleníti meg a rendszerüzeneteket (pl. „X barátkérést küldött", „X elfogadta a meghívásod", stb.). A toast-ok automatikusan eltűnnek 4-6 másodperc után, és egyszerre több is megjelenhet (stackelődnek).

> ⚠️ **Ez a terv a [[013-social-multiplayer]] tervre épül** — a toast-ok a barátrendszer eseményeit (friend request küldés, elfogadás, elutasítás) jelenítik meg. Később bővíthető más rendszerüzenetekkel is (pl. multiplayer session események).

---

## Döntések

| Kérdés | Választás |
|--------|-----------|
| Elhelyezés | a roadmapen **16. lépés** — a 013-social-multiplayer után, mert a toast-ok a barátrendszer eseményeit jelenítik meg |
| Toast pozíció | **Bal felső sarok** — nem zavarja a dashboardot (jobb oldal) és a játékablakot (középen) |
| Megjelenés időtartama | **4-6 másodperc**, majd automatikus eltűnés + fade out animáció |
| Stackelés | **Igen** — egyszerre több toast is látható egymás alatt |
| Kattintás | Toast-ra kattintva **eltűnik** (manuális bezárás) |
| Üzenet típusok | Friend request küldés, elfogadás, elutasítás — bővíthető később |
| Adatforrás | **Firebase RTDB subscription** — a toast-ok valós idejű eseményekre épülnek |
| Tárolás | `notifications/{uid}/{notificationId}: { type, fromUid, fromName, at, read }` |
| Olvasottság | Az új notification-ok száma **badge-ként** a főmenüben is megjelenhet |

---

## ✅ Haladás (TODO)

> Jelölés: `[ ]` hátravan · `[~]` folyamatban · `[x]` kész.

**A. Firebase RTDB séma — notifications node**
- [ ] `security.rules.json`: új `notifications/{uid}` node (read/write: csak a tulajdonos)
- [ ] `userData.ts`: `sendNotification(toUid, type, fromUid, fromName)` függvény — push a `notifications/{toUid}`-ba
- [ ] `userData.ts`: `markNotificationRead(uid, notificationId)` — set `read: true`
- [ ] `userData.ts`: `markAllNotificationsRead(uid)` — batch update
- [ ] `userData.ts`: `subscribeNotifications(uid, callback)` — onValue subscription
- [ ] `database.rules.json` regenerálása + deploy

**B. Toast komponens — UI**
- [ ] `src/components/features/ToastContainer.tsx` + `ToastContainer.module.css` (ÚJ) — konténer a bal felső sarokban
- [ ] `ToastContainer.tsx` — toast-ok stackelése, fade-in/fade-out animáció
- [ ] `ToastContainer.tsx` — auto-dismiss 4-6 másodperc után
- [ ] `ToastContainer.tsx` — kézi bezárás kattintásra
- [ ] `ToastContainer.tsx` — max 5 toast egyszerre (FIFO, ha több jön)
- [ ] Különböző típusú toast-ok: info (kék), success (zöld), warning (sárga), error (piros)

**C. Toast state management — useToastStore**
- [ ] `src/state/useToastStore.ts` (ÚJ) — Zustand store a toast-ok kezelésére
- [ ] `useToastStore.ts` — `toasts: Toast[]` state
- [ ] `useToastStore.ts` — `addToast(type, message, duration?)` action
- [ ] `useToastStore.ts` — `dismissToast(id)` action
- [ ] `useToastStore.ts` — auto-dismiss timer kezelés

**D. Notification generálás az eseményekhez**
- [ ] `src/firebase/userData.ts`: `sendFriendRequest` kiegészítése — `sendNotification(toUid, \"friendRequest\", ...)` meghívása
- [ ] `src/firebase/userData.ts`: `acceptFriendRequest` kiegészítése — `sendNotification(fromUid, \"friendRequestAccepted\", ...)` meghívása
- [ ] `src/firebase/userData.ts`: `rejectFriendRequest` kiegészítése — `sendNotification(fromUid, \"friendRequestRejected\", ...)` meghívása
- [ ] `src/hooks/useNotificationListener.ts` (ÚJ) — hook, ami subscribe-ol a `notifications/{authUid}`-ra és betáplálja a toast store-ba
- [ ] `App.tsx`: `useNotificationListener` meghívása

**E. App integráció**
- [ ] `App.tsx`: `ToastContainer` komponens betöltése (mindig látható, minden GamePhase fölött)
- [ ] `src/App.module.css`: `.toastContainer` pozicionálás a bal felső sarokban, magas z-index
- [ ] `src/index.tsx` vagy `App.tsx`: `useNotificationListener` hook inicializálása
- [ ] Olvasatlan notification-ok száma badge a főmenüben

**F. i18n — ÚJ kulcsok mind az 5 nyelven**
- [ ] `toast.friendRequest.sent` — "{{name}} sent you a friend request"
- [ ] `toast.friendRequest.accepted` — "{{name}} accepted your friend request"
- [ ] `toast.friendRequest.rejected` — "{{name}} rejected your friend request"
- [ ] Teljes paritás mind az 5 fájlban

**G. Tesztek + validáció**
- [ ] `src/state/useToastStore.test.ts`
- [ ] `tsc --noEmit`
- [ ] `npm run test`
- [ ] `npm run build`

---

## 1. RTDB séma

```json
{
  "notifications": {
    "{uid}": {
      "{notificationId}": {
        "type": "friendRequest | friendRequestAccepted | friendRequestRejected",
        "fromUid": "<sender uid>",
        "fromName": "<sender nickname/displayName>",
        "at": 1234567890,
        "read": false
      }
    }
  }
}
```

## 2. Komponens architektúra

```
App.tsx
  ├── ToastContainer (bal felső sarok, minden fázis fölött)
  │     ├── Toast(type: "info", message: "...")
  │     ├── Toast(type: "success", message: "...")
  │     └── Toast(type: "warning", message: "...")
  │
  ├── ScreenRouter (meglévő)
  │
  └── useNotificationListener (hook)
        └── subscribeNotifications(authUid, ...)
              └── addToast(...) → useToastStore
```

## 3. useToastStore interface

```typescript
interface Toast {
  id: string;
  type: "info" | "success" | "warning" | "error";
  message: string;
  duration: number; // ms, default 5000
  createdAt: number;
}

interface ToastStore {
  toasts: Toast[];
  addToast: (type: Toast["type"], message: string, duration?: number) => void;
  dismissToast: (id: string) => void;
}
```

## 4. Fájlstruktúra

### Új fájlok
```
src/components/features/ToastContainer.tsx       # Toast konténer + egyes toast-ok
src/components/features/ToastContainer.module.css
src/state/useToastStore.ts                       # Toast állapotkezelés
src/hooks/useNotificationListener.ts             # Firebase notification figyelő
```

### Módosuló fájlok
```
src/App.tsx                                      # +ToastContainer betöltése
src/App.module.css                               # .toastContainer pozicionálás
src/firebase/userData.ts                         # +sendNotification, +subscribeNotifications, +sendFriendRequest/accept/reject kiegészítés
src/components/screens/MainMenu.tsx               # +notification badge (olvasatlan)
security.rules.json                               # +notifications node
database.rules.json                               # regenerálva
src/i18n/locales/{en,hu,fr,de,es}/translation.json  # +3 új kulcs
```

## 5. Biztonsági szabályok

```json
"notifications": {
  "$uid": {
    ".read": "auth != null && $uid == auth.uid",
    ".write": "auth != null && $uid == auth.uid"
  }
}
```

## 6. Függőségek

- **Előfeltétel:** [[013-social-multiplayer]] — a toast-ok a barátrendszer eseményeit jelenítik meg (friend request küldés/elfogadás/elutasítás)
- **Független:** Stripe-tervektől (014, 015)
- **Érinti:** [[012-wall-of-shame]] — a toast-ok később bővíthetők Wall of Shame eseményekkel is

## 7. Kockázatok

- **Toast halmozódás:** ha egyszerre sok notification érkezik (pl. régi user visszatér), a FIFO limit (5) véd a túlcsordulás ellen
- **Teljesítmény:** a ToastContainer minden GamePhase fölött renderelődik, de minimális DOM-mal (max 5 toast)
- **Firebase írási költség:** minden friend request művelethez +1 írás a `notifications` node-ba — elhanyagolható
