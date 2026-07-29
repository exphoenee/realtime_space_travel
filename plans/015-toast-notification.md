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

**Cél:** egy nem-blokkoló toast/értesítési rendszer létrehozása, amely a **bal felső sarokban** jeleníti meg a rendszerüzeneteket (pl. „X barátkérést küldött", „X elfogadta a meghívásod", „X üzenetet küldött neked", „X online"). A toast-ok automatikusan eltűnnek 4-6 másodperc után, és egyszerre több is megjelenhet (stackelődnek). A rendszer egyben a főmenü **vendég-tájékoztatóinak** is a megjelenítő csatornája.

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
| Üzenet típusok | Friend request küldés, elfogadás, elutasítás; **chat-üzenet**; **barát online/offline**; **vendég-tájékoztatók** |
| Adatforrás | **Firebase RTDB subscription** — a toast-ok valós idejű eseményekre épülnek |
| Tárolás | `notifications/{uid}/{notificationId}: { type, fromUid, fromName, at, read }` |
| Olvasottság | Az új notification-ok száma **badge-ként** a főmenüben is megjelenhet |
| Jelenlét-toast adatforrása | **Nem** a `notifications` node, hanem a meglévő `usersPublic/{uid}/onlineStatus` — tisztán olvasás-oldali levezetés, **nulla RTDB írással** (0.11) |
| Chat-toast elnyomása | Ha a játékos épp azt a beszélgetést nézi (`gamePhase === "chat" && chatTargetUid === fromUid`), **nincs** toast (0.10) |
| Vendég-tájékoztatók | A `MainMenu` beágyazott `<p>` üzenetei helyett **warning toast**, `GUEST_NOTICE_DURATION_MS = 7000` (két mondat) (0.9) |
| Duplikáció | Azonos `type` + azonos `message`, még látható toastnál az `addToast` **no-op** (0.3 / H. blokk) |

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
- [ ] **`database.rules.json` deploy** — ⚠️ **felhasználói művelet, még nem futott le.** Amíg a szabályok nincsenek élesítve, a `sendNotification` a címzett node-jába íráskor `PERMISSION_DENIED`-et kap (a hiba elnyelődik, lásd D. blokk), így a toast-ok **nem jelennek meg** a másik félnél.
  **Hatókör:** a barátkérés- (D. blokk) és a chat-üzenet-toastok (I. blokk) a deployig nem működnek; a **jelenlét-toastok (J. blokk) deploy nélkül is működnek**, mert azok nem a `notifications` node-ot használják, hanem a `usersPublic/{uid}/onlineStatus`-t, aminek az olvasása már ma is engedélyezett

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
- [x] `toast.chatMessage` — „{{name}} üzenetet küldött neked" (I. blokk)
- [x] `toast.friendOnline` — „{{name}} online" (J. blokk)
- [x] `toast.friendOffline` — „{{name}} offline" (J. blokk)
- [x] A `toast` névtér összesen **7 kulcs**
- [x] Teljes paritás mind az 5 fájlban — **373/373 kulcs** nyelvenként

**G. Tesztek + validáció**
- [x] `src/state/useToastStore.test.ts` — 7 teszt
- [x] `tsc --noEmit` — hibamentes
- [x] `npm run test` — 84/84 teszt zöld, 7 fájl
- [x] `npm run build` — sikeres
- [x] Újravalidálás a H–K blokkok után (2026-07-29): `tsc --noEmit` tiszta, `npm run test` **84/84 zöld (7 fájl)**, `npm run build` sikeres

**H. Vendég-tájékoztatók toastba költöztetése (2026-07-29)**

> A főmenü vendég-üzenetei (`shop.guestNotice`, `friends.guestNotice`) eddig beágyazott `<p className={styles.guestNotice} role="status">` elemként jelentek meg a gombok alatt. Innentől a toast rendszerben jelennek meg. Áttekintés: 0.9.

- [x] `MainMenu.tsx` — `guardedNav(phase, noticeKey)` vendégnél navigáció helyett `addToast("warning", t(noticeKey), GUEST_NOTICE_DURATION_MS)`-t hív
- [x] `MainMenu.tsx` — `GUEST_NOTICE_DURATION_MS = 7000` konstans; **azért hosszabb** az 5 mp-es `DEFAULT_TOAST_DURATION`-nél, mert ezek kétmondatos üzenetek
- [x] `MainMenu.tsx` — a `guestNoticeKey` state és a hozzá tartozó „bejelentkezéskor tüntesd el" `useEffect` **törölve**
- [x] `MainMenu.module.css` — a `.guestNotice` osztály **törölve**
- [x] `useToastStore.addToast` — **duplikáció-védelem**: ha azonos `type` + azonos `message` toast MÁR látható, az új hívás **no-op**. Enélkül a zárt gombra ötször kattintva öt egyforma toast állna sorba
- [ ] `useToastStore.test.ts` — teszt az `addToast` duplikáció-védelmére (**nyitott**, jelenleg nincs rá lefedettség)

> ⚠️ Ez a [[001-main-menu-settings]], [[002-ingame-shop-frontend]] és [[013-social-multiplayer]] tervekben leírt **vendég-zár UI-t módosítja**. Azok a tervek **2026-07-29-én át lettek vezetve** a toast-alapú vendég-tájékoztatóra; a megjelenítés kanonikus leírása továbbra is ez a blokk és a 0.9 szekció.

**I. Chat-üzenet toast (2026-07-29)**
- [x] `src/types/index.ts` — `NotificationType` bővítve: `"chatMessage"`
- [x] `userData.ts`: `sendMessage(chatId, fromUid, text, fromName?)` — **negyedik, opcionális** paraméter
- [x] `userData.ts`: `sendMessage` a meglévő unread-számláló növelése **után** `sendNotification(toUid, "chatMessage", fromUid, fromName ?? "")`-t hív
- [x] `ChatPanel.tsx` — a küldő a **saját** nevét a `useAuthStore`-ból oldja fel (`nickname || displayName || uid.slice(0, 8)`) és adja át; a `userData.ts`-nek nincs hozzáférése a profilmezőkhöz
- [x] `useNotificationListener.ts` — `TOAST_TYPE.chatMessage = "info"`, `MESSAGE_KEY.chatMessage = "toast.chatMessage"`
- [x] `useNotificationListener.ts` — **elnyomás**: új `isViewingChatWith(fromUid)` helper (`useGameStore`: `gamePhase === "chat" && chatTargetUid === fromUid`); ha a játékos épp azt a beszélgetést nézi, nincs toast
- [ ] `notifications/{uid}` **takarítása** (régi / olvasott értesítések törlése) — **átkerült (superseded)** → [[018-notification-retention]] (2026-07-29). A tétel **nyitott marad**, amíg az a terv nincs implementálva; a kockázat leírása: 7.3

**J. Barát jelenlét-toast — online / offline (2026-07-29)**
- [x] `src/hooks/useFriendPresenceToasts.ts` (ÚJ)
- [x] `App.tsx` — a hook mountolása a `useNotificationListener` mellé
- [x] **Szándékosan NEM a `notifications` node-on megy** — a jelenlét már broadcastolódik a `usersPublic/{uid}/onlineStatus`-on, tehát ez tisztán olvasás-oldali levezetés, **nulla RTDB írással** (indoklás: 0.11)
- [x] Feliratkozás a `friends/{authUid}`-ra, majd barátonként a `subscribeUserOnlineStatus`-ra
- [x] `useRef<Map<string, UserOnlineStatus>>` tartja az előző státuszt
- [x] **Kritikus:** az első beérkező érték **baseline, nem átmenet** — enélkül oldalbetöltéskor minden már online barát toastolna
- [x] Csak az **offline-határátlépés** számít; az `online ↔ in-game` váltás zaj
- [x] `offline → online|in-game` → `success` toast (`toast.friendOnline`)
- [x] `online|in-game → offline` → `info` toast (`toast.friendOffline`)
- [x] A név feloldása `lookupUserByUid`-dal
- [x] Vendégek kizárva, ahogy a többi social funkciónál
- [x] A barátlista változásakor a feliratkozások újraépülnek, és a **törölt barátok kikerülnek a memóriából**, hogy egy újrafelvétel tiszta baseline-ról induljon

**K. BUGFIX — a kijelentkezés nem írt `offline`-t (2026-07-29)**
- [x] **Tünet:** a felhasználó kilépett a barát fiókjával és visszalépett, mégsem kapott egyetlen jelenlét-toastot sem
- [x] **Diagnózis (élő RTDB-ből ellenőrizve):** mindkét fiók `onlineStatus: "online"` volt, pedig az egyik kilépett
- [x] **Ok:** a kódban semmi nem írt `offline`-t. Az egyetlen offline-forrás az RTDB `onDisconnect` handler volt, ami CSAK a socket tényleges elszakadásakor sül el (böngésző bezárása, hálózat elvesztése). Kijelentkezéskor viszont a kapcsolat él tovább, mert azonnal indul egy anonim session — így a fiók örökre „online" maradt, és nem keletkezett átmenet, amire a jelenlét-toast reagálhatna
- [x] **Javítás:** `SettingsScreen.handleLogout` → `updateOnlineStatus(authUid, "offline")` **még a `signOut()` előtt**
- [x] A sorrend **kötelező**: a `usersPublic/$uid` írási szabály `$uid == auth.uid`-hez kötött, tehát kijelentkezés után, a token elvesztésével a művelet már megtagadott lenne — ez kommentben is rögzítve a kódban
- [x] Tanulság rögzítve: 7.4

---

## 0. Implementációs eltérések (2026-07-29)

> 🔁 Az implementáció során a terv több pontján kiderült, hogy az eredeti elképzelés hibás vagy hiányos, illetve a lezárás után négy bővítés is készült (H–K blokk). Az alábbi eltérések **bekerültek a kódba**, a terv érintett szekciói (1.–7.) is frissültek.

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

A tervben nem szerepelt. A `shop.guestNotice` és `friends.guestNotice` üzenetek a `MainMenu`-ben eddig beágyazott `<p className={styles.guestNotice} role="status">` elemként jelentek meg a gombok alatt; mostantól a `guardedNav(phase, noticeKey)` helper `addToast("warning", t(noticeKey), GUEST_NOTICE_DURATION_MS)`-t hív. A `guestNoticeKey` state, a hozzá tartozó „bejelentkezéskor tüntesd el" `useEffect` és a `.guestNotice` CSS osztály **megszűnt**.

A 7 mp-es időtartam (`GUEST_NOTICE_DURATION_MS`) tudatosan hosszabb az 5 mp-es alapértelmezettnél: ezek kétmondatos üzenetek. Emiatt kellett az `addToast` **duplikáció-védelme** is (azonos `type` + azonos `message` → no-op), különben a zárt gombra többször kattintva öt egyforma toast állna sorba.

Részletes tételek: **H. blokk**.

> ⚠️ Ez a [[001-main-menu-settings]], [[002-ingame-shop-frontend]] és [[013-social-multiplayer]] tervekben leírt **vendég-zár UI-ját változtatja meg**. Azok a tervek **2026-07-29-én át lettek vezetve** erre a megjelenítésre; a vendég-tájékoztató kanonikus leírása innentől ez a szekció.

### 0.10 ÚJ FUNKCIÓ — chat-üzenet toast

A terv eredetileg csak barátkérés-eseményekre készült. A `NotificationType` új tagot kapott (`"chatMessage"`), és a `sendMessage` az unread-számláló növelése után értesítést is ír a címzettnek.

Két, a kódból következő döntés:

- **A küldő nevét a hívó adja át.** A `sendMessage` negyedik, opcionális paramétere a `fromName`; a `ChatPanel` oldja fel a `useAuthStore`-ból (`nickname || displayName || uid.slice(0, 8)`). A `userData.ts` réteg nem lát rá a profilmezőkre, ezért nem tudná magától kitölteni.
- **Elnyomás nyitott beszélgetésnél.** Az `isViewingChatWith(fromUid)` helper a `useGameStore`-t nézi (`gamePhase === "chat" && chatTargetUid === fromUid`); ha a játékos épp azt a beszélgetést olvassa, a toast csak megismételné, ami a képernyőn van.

Részletes tételek: **I. blokk**. Ennek a mennyiségi következményét lásd a 7.3 kockázatnál.

### 0.11 ÚJ FUNKCIÓ — barát jelenlét-toast a `notifications` node megkerülésével

Új hook: `src/hooks/useFriendPresenceToasts.ts`, az `App.tsx`-ben a `useNotificationListener` mellé mountolva.

**Miért nem a `notifications` node-on megy:** a jelenlét már broadcastolódik a `usersPublic/{uid}/onlineStatus`-on, tehát a toast tisztán **olvasás-oldali levezetés, nulla RTDB írással**. Értesítés-rekordot írni státuszváltásonként **barátonként egy írásba** kerülne — olyan eseményért, amit senkinek nem kell kétszer látnia.

**A legfontosabb részlet:** az adott baráttól **először** beérkező státusz **baseline, nem átmenet**. Enélkül minden oldalbetöltéskor az összes már online barát toastolna. Ugyanígy tudatos, hogy csak az **offline-határátlépés** számít: az `online ↔ in-game` váltás zaj.

Részletes tételek: **J. blokk**.

### 0.12 BUGFIX — a kijelentkezés nem írt `offline`-t (a jelenlét-toast néma maradt)

A J. blokk leszállítása után a jelenlét-toastok **egyáltalán nem jelentek meg**. Az élő RTDB admin-olvasás megmutatta, hogy mindkét fiók `onlineStatus: "online"` volt, pedig az egyik kilépett: a kódban **semmi nem írt `offline`-t**, az egyetlen offline-forrás az RTDB `onDisconnect` handler volt, ami csak a socket tényleges elszakadásakor sül el.

Kijelentkezéskor a kapcsolat él tovább (azonnal indul egy anonim session), így nem keletkezett átmenet, amire a hook reagálhatott volna. Javítás: a `SettingsScreen.handleLogout` a `signOut()` **előtt** `updateOnlineStatus(authUid, "offline")`-t hív. A sorrend kötelező — lásd K. blokk és 7.4.

---

## 1. RTDB séma

```json
{
  "notifications": {
    "{uid}": {
      "{notificationId}": {
        "type": "friendRequest | friendRequestAccepted | friendRequestRejected | chatMessage",
        "fromUid": "<sender uid>",
        "fromName": "<sender nickname/displayName>",
        "at": 1234567890,
        "read": false
      }
    }
  }
}
```

> A `chatMessage` típust az I. blokk vezette be. Írója a `sendMessage`, közvetlenül az unread-számláló növelése után.

### 1.1 A jelenlét-toast NEM ezt a node-ot használja

A barát online/offline toast (J. blokk) forrása a [[013-social-multiplayer]] tervben létrehozott **meglévő** mező:

```json
{ "usersPublic": { "{uid}": { "onlineStatus": "offline | online | in-game" } } }
```

Ez így **nulla új RTDB írással** jár, és a `notifications` szabályainak deployja nélkül is működik (lásd A. blokk és 7.2).

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
  ├── useNotificationListener (hook)
  │     └── subscribeNotifications(authUid, ...)
  │           ├── isViewingChatWith(fromUid)? → elnyomás (chatMessage)
  │           └── addToast(...) → useToastStore
  │
  └── useFriendPresenceToasts (hook)
        └── subscribeFriends(authUid, ...)
              └── barátonként subscribeUserOnlineStatus(friendUid, ...)
                    ├── első érték → baseline, nincs toast
                    └── offline-határátlépés → lookupUserByUid → addToast(...)

MainMenu.guardedNav(phase, noticeKey)   # vendégnél toast, nem navigáció (H. blokk)
      └── addToast("warning", t(noticeKey), 7000) → useToastStore
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
  /** No-op, ha azonos `type` + azonos `message` toast MÁR látható (H. blokk). */
  addToast: (type: Toast["type"], message: string, duration?: number) => void;
  dismissToast: (id: string) => void;
}
```

Időtartamok:

| Konstans | Hely | Érték | Miért |
|---|---|---|---|
| `DEFAULT_TOAST_DURATION` | `useToastStore.ts` | 5000 ms | egymondatos rendszerüzenetek |
| `MAX_TOASTS` | `useToastStore.ts` | 5 | FIFO túlcsordulás-védelem |
| `GUEST_NOTICE_DURATION_MS` | `MainMenu.tsx` | 7000 ms | a vendég-tájékoztatók kétmondatosak (H. blokk) |

## 4. Fájlstruktúra

### Új fájlok
```
src/components/features/ToastContainer.tsx       # Toast konténer + egyes toast-ok
src/components/features/ToastContainer.module.css  # + a konténer pozicionálása (bal felső sarok, magas z-index)
src/state/useToastStore.ts                       # Toast állapotkezelés
src/state/useNotificationStore.ts                # unreadCount (0.7 — tervben nem szerepelt)
src/hooks/useNotificationListener.ts             # Firebase notification figyelő (+chatMessage, +isViewingChatWith)
src/hooks/useFriendPresenceToasts.ts             # barát online/offline toast (J. blokk — nulla RTDB írás)
src/state/useToastStore.test.ts                  # 7 teszt
```

### Módosuló fájlok
```
src/App.tsx                                      # +ToastContainer betöltése, +useNotificationListener,
                                                 #  +useFriendPresenceToasts (J. blokk)
src/firebase/userData.ts                         # +sendNotification, +markNotificationRead, +markAllNotificationsRead,
                                                 #  +subscribeNotifications, +sendFriendRequest/accept/reject kiegészítés,
                                                 #  +sendMessage 4. paraméter (fromName?) → sendNotification("chatMessage") (I. blokk)
src/types/index.ts                                # +NotificationType: "chatMessage" (I. blokk)
src/state/useToastStore.ts                        # +duplikáció-védelem az addToast-ban (H. blokk)
src/components/features/ChatPanel.tsx             # a küldő saját neve a useAuthStore-ból → sendMessage (I. blokk)
src/components/screens/MainMenu.tsx               # badge: olvasatlan chat + notification összevonva (0.4);
                                                 #  vendég-tájékoztató toastból (0.9 / H), guestNoticeKey state
                                                 #  + a hozzá tartozó useEffect törölve, +GUEST_NOTICE_DURATION_MS
src/components/screens/MainMenu.module.css        # -.guestNotice osztály (0.9 / H)
src/components/screens/FriendsScreen.tsx          # +markAllNotificationsRead mountoláskor (0.5)
src/components/screens/SettingsScreen.tsx         # handleLogout: updateOnlineStatus(authUid, "offline")
                                                 #  a signOut() ELŐTT (K. blokk / 0.12)
security.rules.json                               # +notifications node (javított szabály — 5. szekció)
database.rules.json                               # regenerálva (deploy még hátravan)
src/i18n/locales/{en,hu,fr,de,es}/translation.json  # +7 kulcs a toast névtérben (373/373 paritás)
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

### 5.1 A jelenlét-toast nem igényel szabálymódosítást

A J. blokk a `usersPublic/{uid}/onlineStatus` **olvasásán** áll, ami már ma engedélyezett — új szabály nem kellett hozzá, és a `notifications` deploy sem előfeltétele.

Az **írási** oldal viszont szigorú: a `usersPublic/$uid` írási szabály `$uid == auth.uid`-hez kötött. Ezért kellett a K. blokk javításában az `updateOnlineStatus(authUid, "offline")`-t **a `signOut()` elé** tenni — utána a token elvesztésével a művelet már megtagadott lenne.

## 6. Függőségek

- **Előfeltétel:** [[013-social-multiplayer]] — a toast-ok a barátrendszer eseményeit jelenítik meg (friend request küldés/elfogadás/elutasítás); innen jön a chat (`sendMessage`, `chatTargetUid`) és a jelenlét (`usersPublic/{uid}/onlineStatus`, `subscribeUserOnlineStatus`) is
- **Független:** Stripe-tervektől (014, 015)
- **Érinti:** [[012-wall-of-shame]] — a toast-ok később bővíthetők Wall of Shame eseményekkel is
- **Érinti (vendég-zár UI):** [[001-main-menu-settings]], [[002-ingame-shop-frontend]], [[013-social-multiplayer]] — a `MainMenu` vendég-tájékoztatói innentől toastok, nem beágyazott `<p>` elemek (0.9 / H. blokk). Azok a tervfájlok változatlanok

## 7. Kockázatok

- **Toast halmozódás:** ha egyszerre sok notification érkezik (pl. régi user visszatér), a FIFO limit (5) véd a túlcsordulás ellen
- **Teljesítmény:** a ToastContainer minden GamePhase fölött renderelődik, de minimális DOM-mal (max 5 toast)
- **Firebase írási költség:** minden friend request művelethez +1 írás a `notifications` node-ba — elhanyagolható
- **Toast-zaj a vendég-tájékoztatóktól:** a zárt gombra ismételten kattintva ötször ugyanaz az üzenet állna sorba — ez ellen az `addToast` duplikáció-védelme véd (H. blokk). A védelemre **jelenleg nincs teszt**

### 7.1 Tanulság — az „írj a másik felhasználó node-jába" szabályosztály (2026-07-29)

A tervezett security rule (`.write: "$uid == auth.uid"`) **kizárta volna a funkció saját működését**, mert a `sendNotification` definíció szerint **idegen** node-ba ír. Ugyanez a hibaosztály fordult elő a chat `messages` **olvasási** szabályánál a [[013-social-multiplayer]] tervben.

**Minta:** minden olyan RTDB node-nál, ahol az adatot **nem a tulajdonos hozza létre** (értesítés, barátkérés, üzenet), a szabályt az **író fél oldaláról** is végig kell gondolni — nem elég a „csak a saját ágadat írhatod" reflex. A gyakorlati ellenőrzés: minden írási hívásnál nézd meg, hogy `auth.uid` egyezik-e a path-ban szereplő UID-dal; ha nem, kell egy gyerekszintű, tartalom-alapú grant (`newData.child('fromUid').val() === auth.uid`).

**Súlyosbító tényező:** a `sendNotification` hibái elnyelődnek (0.8), így egy rossz szabály **néma hibaként** jelentkezik — a barátkérés lemegy, csak a toast nem érkezik meg. Szabálymódosítás után ezért kötelező kétfelhasználós manuális próba.

### 7.2 A deploy elmaradása látens hiba (2026-07-29)

A `database.rules.json` kész, de **nincs deployolva** (A. blokk). Amíg ez nem történik meg, az élesben futó szabályok a régiek: a `sendNotification` `PERMISSION_DENIED`-et kap, ami a 0.8 szerint elnyelődik — a rendszer *működni látszik*, de a másik fél sosem kap toastot.

**Ami a deploy nélkül is működik:** a jelenlét-toastok (J. blokk), mert azok a `usersPublic` olvasásából vezetődnek le (5.1). Ez tesztelésnél megtévesztő lehet: a felhasználó lát toastot (barát online/offline), miközben a barátkérés- és chat-toastok némán buknak.

### 7.3 A `notifications` node növekedése a chat-üzenetekkel (2026-07-29)

A barátkéréssel ellentétben a chat-üzenet **gyakori esemény**, tehát a `notifications/{uid}` node **üzenetenként nő**. Az eredeti becslés („minden friend request művelethez +1 írás — elhanyagolható") a chat-toasttal (I. blokk) már nem áll.

Hosszabb távon takarítás kell (pl. a régi / olvasott értesítések törlése, vagy TTL-szerű nyesés a `markAllNotificationsRead` mellett). **Jelenleg nincs ilyen** — a megoldás **átkerült (superseded)** → [[018-notification-retention]] (2026-07-29). Az a terv **két, egymástól független** eszközzel dolgozik: a **tárolást** kliensoldali takarítás (`pruneNotifications`: 7 napos megőrzés az olvasott rekordokra + 100-as plafon, olvasatlant soha nem törölve) fogja meg, a **sávszélességet** pedig a listener áttérése `query(ref, orderByKey(), limitToLast(N))`-re. Az I. blokk tétele addig **nyitva marad**.

Mellékhatás az olvasási oldalon is: a `subscribeNotifications` `onValue`-ja a **teljes** listát replayeli minden változásnál, tehát a node növekedése a listener sávszélesség-igényét is növeli (a toast-duplikáció ellen a `toastedIds` Set véd — 0.3). Ez a költség nem lineáris, hanem **kvadratikus** a session során; ezt szünteti meg a `limitToLast` ([[018-notification-retention]] 3.1).

> ⏳ **A probléma jelenleg lappang.** Amíg a `database.rules.json` **deployja nem futott le** (A. blokk / 7.2), a `sendNotification` a címzett **idegen** node-jába íráskor `PERMISSION_DENIED`-et kap, ami a 0.8 szerint **elnyelődik** — a `notifications` node tehát ma gyakorlatilag alig nő. A növekedés **a deploy pillanatában válik élővé**. Ezért ideális, ha a [[018-notification-retention]] a deployjal **együtt vagy előtte** landol.

### 7.4 Tanulság — az `onDisconnect` nem helyettesíti az explicit állapotírást (2026-07-29)

A jelenlét-toast azért maradt néma, mert a fiók sosem lett `offline` (0.12). Az RTDB `onDisconnect` handler **csak a socket tényleges elszakadásakor** sül el — böngésző bezárása, hálózat elvesztése. A kijelentkezés nem ilyen: az alkalmazás azonnal anonim sessionre vált, a kapcsolat él tovább, a handler nem fut le.

**Minta:** ha az alkalmazás a kijelentkezés (vagy identitásváltás) után is fenntartja a kapcsolatot, az állapotot **explicit írással** kell lezárni, és **még az érvényes token birtokában** — a `usersPublic/$uid` írási szabály `$uid == auth.uid`-hez kötött, tehát a `signOut()` után már késő.

**Diagnosztikai tanulság:** a hibát nem a UI-tünetből, hanem **élő RTDB admin-olvasásból** lehetett kimondani (mindkét fiók `onlineStatus: "online"` volt, pedig az egyik kilépett). Jelenlét- és identitás-hibáknál ez az első lépés.

---

**Kész definíció:**

- A toast-ok a bal felső sarokban stackelődve jelennek meg, auto-dismissel és kézi bezárással, minden `GamePhase` fölött. ✅
- Barátkérés küldése / elfogadása / elutasítása toastot vált ki a másik félnél. ⚠️ *kódszinten kész, élesben a `database.rules.json` deployig nem működik*
- Chat-üzenet toastot vált ki a címzettnél, **kivéve** ha épp azt a beszélgetést nézi. ⚠️ *ugyanaz a deploy-függés*
- Barát online/offline állapotváltása toastot vált ki, oldalbetöltéskor **nem** (baseline-szabály), és kijelentkezéskor is keletkezik átmenet. ✅ *deploy nélkül is működik*
- A főmenü vendég-tájékoztatói toastként jelennek meg, ismételt kattintásra sem duplikálódnak. ✅
- Vendégek egyik értesítés-forrásra sem iratkoznak fel. ✅
- i18n: `toast` névtér 7 kulcs, **373/373 paritás** mind az 5 nyelven. ✅
- `tsc --noEmit` tiszta, `npm run test` 84/84 zöld (7 fájl), `npm run build` sikeres. ✅

**Nyitott tételek a lezárás után:** `database.rules.json` deploy (felhasználói művelet, A. blokk) · `addToast` duplikáció-védelmének tesztje (H. blokk) · `notifications` node takarítása (I. blokk / 7.3) — **átkerült (superseded)** → [[018-notification-retention]].
