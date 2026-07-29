---
title: "Toast notification rendszer – rendszerüzenetek a bal felső sarokban"
slug: 015-toast-notification
type: plan
category: ui
status: implemented
implemented: true
implemented_at: "2026-07-29"
created_at: "2026-07-28"
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
| Elhelyezés | a roadmapen **15. lépés** — a 013-social-multiplayer után, mert a toast-ok a barátrendszer eseményeit jelenítik meg |
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
- [x] `security.rules.json`: új `notifications/{uid}` node (olvasás: csak a tulajdonos; írás: a tulajdonos **és** a küldő — lásd 5. szekció)
- [x] `userData.ts`: `sendNotification(toUid, type, fromUid, fromName)` függvény — push a `notifications/{toUid}`-ba
- [x] `userData.ts`: `markNotificationRead(uid, notificationId)` — set `read: true`
- [x] `userData.ts`: `markAllNotificationsRead(uid)` — batch update
- [x] `userData.ts`: `subscribeNotifications(uid, callback)` — onValue subscription
- [x] `database.rules.json` regenerálása (a fájl tartalmazza a `notifications` node-ot)
- [ ] **`database.rules.json` deploy** — ⚠️ **felhasználói művelet, még nem futott le.** Amíg a szabályok nincsenek élesítve, a `sendNotification` a címzett node-jába íráskor `PERMISSION_DENIED`-et kap (a hiba elnyelődik, lásd D. blokk), így a toast-ok **nem jelennek meg** a másik félnél

**B. Toast komponens — UI**
- [x] `src/components/features/ToastContainer.tsx` + `ToastContainer.module.css` (ÚJ) — konténer a bal felső sarokban
- [x] `ToastContainer.tsx` — toast-ok stackelése, fade-in/fade-out animáció
- [x] `ToastContainer.tsx` — auto-dismiss 4-6 másodperc után
- [x] `ToastContainer.tsx` — kézi bezárás kattintásra
- [x] `ToastContainer.tsx` — max 5 toast egyszerre (FIFO, ha több jön)
- [x] Különböző típusú toast-ok: info (kék), success (zöld), warning (sárga), error (piros)

**C. Toast state management — useToastStore**
- [x] `src/state/useToastStore.ts` (ÚJ) — Zustand store a toast-ok kezelésére
- [x] `useToastStore.ts` — `toasts: Toast[]` state
- [x] `useToastStore.ts` — `addToast(type, message, duration?)` action
- [x] `useToastStore.ts` — `dismissToast(id)` action
- [x] `useToastStore.ts` — auto-dismiss timer kezelés

**D. Notification generálás az eseményekhez**
- [x] `src/firebase/userData.ts`: `sendFriendRequest` kiegészítése — `sendNotification(toUid, \"friendRequest\", ...)` meghívása
- [x] `src/firebase/userData.ts`: `acceptFriendRequest` kiegészítése — `sendNotification(fromUid, \"friendRequestAccepted\", ...)` meghívása
- [x] `src/firebase/userData.ts`: `rejectFriendRequest` kiegészítése — `sendNotification(fromUid, \"friendRequestRejected\", ...)` meghívása
- [x] `src/hooks/useNotificationListener.ts` (ÚJ) — hook, ami subscribe-ol a `notifications/{authUid}`-ra és betáplálja a toast store-ba
- [x] `App.tsx`: `useNotificationListener` meghívása

**E. App integráció**
- [x] `App.tsx`: `ToastContainer` komponens betöltése (mindig látható, minden GamePhase fölött)
- [x] `ToastContainer.module.css`: pozicionálás a bal felső sarokban, magas z-index — **nem** az `App.module.css`-ben: a komponensnek saját CSS modulja van, a pozicionálás oda tartozik (lásd „Implementációs eltérések")
- [x] `src/index.tsx` vagy `App.tsx`: `useNotificationListener` hook inicializálása
- [x] Olvasatlan notification-ok száma badge a főmenüben — a **meglévő** Barátok-gomb badge-ébe olvadt bele (lásd „Implementációs eltérések")

**F. i18n — ÚJ kulcsok mind az 5 nyelven**
- [x] `toast.friendRequest.sent` — "{{name}} sent you a friend request"
- [x] `toast.friendRequest.accepted` — "{{name}} accepted your friend request"
- [x] `toast.friendRequest.rejected` — "{{name}} rejected your friend request"
- [x] `toast.dismiss` — a bezáró gomb `aria-label`-je és a toast tooltipje (a tervben nem szerepelt, az akadálymentesítés miatt kellett)
- [x] Teljes paritás mind az 5 fájlban — **370/370 kulcs** nyelvenként

**G. Tesztek + validáció**
- [x] `src/state/useToastStore.test.ts` — 7 teszt
- [x] `tsc --noEmit` — hibamentes
- [x] `npm run test` — 84/84 teszt zöld, 7 fájl
- [x] `npm run build` — sikeres

---

## 0. Implementációs eltérések (2026-07-29)

> 🔁 Az implementáció során a terv több pontján kiderült, hogy az eredeti elképzelés hibás vagy hiányos. Az alábbi eltérések **bekerültek a kódba**, a terv érintett szekciói (4., 5., 7.) is frissültek.

### 0.1 A tervezett security rule hibás volt — javítva

Az eredeti 5. szekció így szólt:

```json
"notifications": { "$uid": { ".read": "... $uid == auth.uid", ".write": "... $uid == auth.uid" } }
```

Ez **megtiltotta volna a saját funkcióját**: a `sendNotification(toUid, ...)` a **címzett** node-jába ír, ahol `toUid != auth.uid`, tehát minden értesítésküldés `PERMISSION_DENIED`-del bukott volna el. A `friendRequests`-nél bevált `newData.hasChild(auth.uid)` trükk itt **nem alkalmazható**, mert a notification-ök **push ID** alatt keletkeznek, nem a küldő UID-ja alatt. A javított szabály a gyerekszinten ad írási jogot a küldőnek (az RTDB írási joga lefelé kaszkádol, a gyerekszintű grant tehát **kiegészíti** a szülőt) — a végleges verziót lásd az 5. szekcióban.

### 0.2 Vendégek kizárva a feliratkozásból

A `useNotificationListener` **nem iratkozik fel**, ha a felhasználó vendég (kijelentkezett vagy anonim) — összhangban a barátok / chat / áruház regisztráció-kötelezettségével. Vendégnél a badge is 0.

### 0.3 Toast-duplikáció elleni kettős védelem

Az `onValue` minden változásnál a **teljes** notification-listát visszaadja, ezért:

- a `useNotificationListener` egy `useRef<Set<string>>`-ben tartja a már megtoastolt notification ID-kat, és csak az újakat adja tovább;
- az `useToastStore.addToast` figyelmen kívül hagyja az **azonos típusú + azonos szövegű**, még látható toastot.

### 0.4 Badge: nem új, hanem összevont

Nem külön notification-badge készült: az olvasatlan értesítések száma a `MainMenu` **meglévő** Barátok-gomb badge-ébe olvadt bele (olvasatlan chat + olvasatlan notification egy számban).

### 0.5 Olvasottság a Barátok képernyőn

A `FriendsScreen` mountolásakor lefut a `markAllNotificationsRead(authUid)`.

### 0.6 Szignatúra-változás a barátkérés-műveleteknél

`acceptFriendRequest(uid, fromUid, ownNickname)` és `rejectFriendRequest(uid, fromUid, ownNickname)` **harmadik paramétert** kapott: a cselekvő fél saját neve, ez jelenik meg a másik fél toastjában.

### 0.7 Új, tervben nem szereplő fájl — `src/state/useNotificationStore.ts`

Csak az `unreadCount`-ot tartja. Célja, hogy a `MainMenu` **ne nyisson saját** `subscribeNotifications` feliratkozást: egyetlen listener fut, az `App`-ban, az eredményt a store terjeszti.

### 0.8 A `sendNotification` hibái elnyelődnek

Az értesítésküldés hibái csak logolódnak: **egy sikertelen értesítés nem törheti meg és nem görgetheti vissza** a barátkérés-műveletet. (Ennek ára: amíg a szabályok nincsenek deployolva — A. blokk — a hiba néma.)

### 0.9 ÚJ FUNKCIÓ — a főmenü vendég-tájékoztatói átkerültek a toast rendszerbe

A tervben nem szerepelt. A `shop.guestNotice` és `friends.guestNotice` üzenetek a `MainMenu`-ben eddig beágyazott `<p>` elemként jelentek meg; mostantól a `guardedNav` helper `addToast("warning", t(noticeKey), 7000)`-t hív. A `guestNoticeKey` state és a `.guestNotice` CSS osztály **megszűnt**.

> ⚠️ Ez a [[001-main-menu-settings]], [[002-ingame-shop-frontend]] és [[013-social-multiplayer]] tervekben leírt **vendég-zár UI-ját változtatja meg**. Azok a tervfájlok nem lettek módosítva — a vendég-tájékoztató megjelenítésének kanonikus leírása innentől ez a szekció.

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
src/components/features/ToastContainer.module.css  # + a konténer pozicionálása (bal felső sarok, magas z-index)
src/state/useToastStore.ts                       # Toast állapotkezelés
src/state/useNotificationStore.ts                # unreadCount (0.7 — tervben nem szerepelt)
src/hooks/useNotificationListener.ts             # Firebase notification figyelő
src/state/useToastStore.test.ts                  # 7 teszt
```

### Módosuló fájlok
```
src/App.tsx                                      # +ToastContainer betöltése, +useNotificationListener
src/firebase/userData.ts                         # +sendNotification, +markNotificationRead, +markAllNotificationsRead,
                                                 #  +subscribeNotifications, +sendFriendRequest/accept/reject kiegészítés
src/components/screens/MainMenu.tsx               # badge: olvasatlan chat + notification összevonva (0.4);
                                                 #  vendég-tájékoztató toastból (0.9), guestNoticeKey state törölve
src/components/screens/MainMenu.module.css        # -.guestNotice osztály (0.9)
src/components/screens/FriendsScreen.tsx          # +markAllNotificationsRead mountoláskor (0.5)
security.rules.json                               # +notifications node (javított szabály — 5. szekció)
database.rules.json                               # regenerálva (deploy még hátravan)
src/i18n/locales/{en,hu,fr,de,es}/translation.json  # +4 új kulcs (370/370 paritás)
```

> `src/App.module.css` **nem** módosult — a pozicionálás a `ToastContainer.module.css`-be került, mert a komponensnek saját CSS modulja van (lásd E. blokk).

## 5. Biztonsági szabályok (javítva — 2026-07-29, lásd 0.1)

```json
"notifications": {
  "$uid": {
    ".read": "auth != null && $uid == auth.uid",
    ".write": "auth != null && $uid == auth.uid",
    "$notificationId": {
      ".write": "auth != null && ($uid == auth.uid || newData.child('fromUid').val() === auth.uid)"
    }
  }
}
```

- **Olvasás:** kizárólag a tulajdonos.
- **Írás a node egészére:** a tulajdonos (ez kell a `markNotificationRead` / `markAllNotificationsRead` batch update-hez).
- **Írás egy notification-re:** a tulajdonos **vagy** az a felhasználó, aki a `fromUid`-ként magát jelöli meg — ez engedi a `sendNotification(toUid, ...)` push-t a **címzett** node-jába. Az RTDB írási joga lefelé kaszkádol, ezért a gyerekszintű grant **kiegészíti**, nem szűkíti a szülőt.
- A push ID miatt a `friendRequests`-nél használt `newData.hasChild(auth.uid)` minta itt nem működik (0.1).

## 6. Függőségek

- **Előfeltétel:** [[013-social-multiplayer]] — a toast-ok a barátrendszer eseményeit jelenítik meg (friend request küldés/elfogadás/elutasítás)
- **Független:** Stripe-tervektől (014, 015)
- **Érinti:** [[012-wall-of-shame]] — a toast-ok később bővíthetők Wall of Shame eseményekkel is

## 7. Kockázatok

- **Toast halmozódás:** ha egyszerre sok notification érkezik (pl. régi user visszatér), a FIFO limit (5) véd a túlcsordulás ellen
- **Teljesítmény:** a ToastContainer minden GamePhase fölött renderelődik, de minimális DOM-mal (max 5 toast)
- **Firebase írási költség:** minden friend request művelethez +1 írás a `notifications` node-ba — elhanyagolható

### 7.1 Tanulság — az „írj a másik felhasználó node-jába" szabályosztály (2026-07-29)

A tervezett security rule (`.write: "$uid == auth.uid"`) **kizárta volna a funkció saját működését**, mert a `sendNotification` definíció szerint **idegen** node-ba ír. Ugyanez a hibaosztály fordult elő a chat `messages` **olvasási** szabályánál a [[013-social-multiplayer]] tervben.

**Minta:** minden olyan RTDB node-nál, ahol az adatot **nem a tulajdonos hozza létre** (értesítés, barátkérés, üzenet), a szabályt az **író fél oldaláról** is végig kell gondolni — nem elég a „csak a saját ágadat írhatod" reflex. A gyakorlati ellenőrzés: minden írási hívásnál nézd meg, hogy `auth.uid` egyezik-e a path-ban szereplő UID-dal; ha nem, kell egy gyerekszintű, tartalom-alapú grant (`newData.child('fromUid').val() === auth.uid`).

**Súlyosbító tényező:** a `sendNotification` hibái elnyelődnek (0.8), így egy rossz szabály **néma hibaként** jelentkezik — a barátkérés lemegy, csak a toast nem érkezik meg. Szabálymódosítás után ezért kötelező kétfelhasználós manuális próba.

### 7.2 A deploy elmaradása látens hiba (2026-07-29)

A `database.rules.json` kész, de **nincs deployolva** (A. blokk). Amíg ez nem történik meg, az élesben futó szabályok a régiek: a `sendNotification` `PERMISSION_DENIED`-et kap, ami a 0.8 szerint elnyelődik — a rendszer *működni látszik*, de a másik fél sosem kap toastot.
