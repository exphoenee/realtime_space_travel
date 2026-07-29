---
title: "Social és multiplayer – barátok, chat, közös küldetések"
slug: 013-social-multiplayer
type: plan
category: core
status: in-progress
implemented: false
implemented_at: null
created_at: "2026-07-27"
updated_at: "2026-07-28"
author: exphoenee
step: 13
phases: []
dependencies:
  - 003-firebase-auth-settings
  - 010-firebase-guest-merge-single-gate
  - 011-difficulty-event-system
  - 012-wall-of-shame
related_plans:
  - 001-main-menu-settings
  - 002-ingame-shop-frontend
  - 007-state-persist-page-refresh
  - 009-firebase-identity-split-bugfix
tags:
  - social
  - multiplayer
  - friends
  - chat
  - firebase
  - rtdb
  - i18n
  - gameplay
  - walls
  - security-rules
  - bugfix
  - guest
  - access-control
---

# Social és multiplayer – barátok, chat, közös küldetések

**Cél:** A játékosok kapcsolatba léphessenek egymással — barátokat kezeljenek, privát üzeneteket küldjenek, **megtekinthessék egymás Szégyenfalát (kudarcok + sikerek, read-only)**, és közös multiplayer küldetésekben vegyenek részt, ahol a figyelem és az események csapatszinten kezelődnek.

> ⚠️ **Ez a terv a [[011-difficulty-event-system]] tervre épül** — a multiplayer eseménykezelés (ki kapja az eventet, hogyan értesülnek a többiek) a 011-es terv eseményrendszerét használja. **A 011-es terv előfeltétel.** Firebase RTDB szükséges a barátlistához és a chathez — ez a [[003-firebase-auth-settings]] és [[010-firebase-guest-merge-single-gate]] tervek Firebase infrastruktúrájára épül.

---

## Döntések (egyeztetve)

| Kérdés | Választás |
|--------|-----------|
| Elhelyezés a roadmapen | **13. lépés** — a 012-wall-of-shame után, a 016-stripe-fraud-defense előtt. A multiplayer az eseményrendszerre épül, de a Stripe-tól független. |
| Barát keresés | **Nickname + email + user ID** alapján is lehessen keresni |
| Barát hozzáadás | Mindig barátkérés (friend request) útján — a másik fél elfogadhatja vagy elutasíthatja |
| MVP scope | **Teljes MVP**: barátlista + invite/join + figyelmi lista + privát chat + friend request + **barát szégyenfala** |
| Privát chat helye | **Mind a Barátok menüben, mind játék közben** elérhető legyen |
| Barát szégyenfala | **Barát listából** elérhető — read-only nézet minden rekorddal (kudarc + siker), **élő** RTDB subscription |
| Host kilépés | **Host átadás** — a következő legaktívabb játékos lesz az új host |
| Max létszám | **8 fő** egy multiplayer küldetésben |
| Event timeout multiplayerben | **Csapat büntetés** — ha az érintett játékos nem reagál időben, a teljes csapat kapja a büntetést |
| Online státuszok | `offline`, `online`, `játékban`, `figyel`, `nem figyel` |
| Figyelési szabály easy/medium | Elég, ha **legalább egy** aktív résztvevő figyel |
| Figyelési szabály hard | **Mindenkinek** figyelnie kell |
| Jutalom | **Megosztva** a résztvevők között; csak azok kapnak, akik a küldetés végén online vannak |
| Bukás | Ha a csapat elbukik, **minden résztvevő** veszít |
| Event kiosztás multiplayerben | Az eventet kapó játékost az **figyelők közül** választja a rendszer (random vagy súlyozott) |
| Csatlakozás futó küldetéshez | **Lehetséges**, host jóváhagyással |
| Vendég/linkes csatlakozás | **Csak bejelentkezett userek** között — guest/link nélkül |
| Chat elhelyezése | **Önálló `"chat"` GamePhase** (nem a `FriendsScreen` lokális al-nézete) — hogy F5 után is a beszélgetésben maradjon a játékos (M. blokk) |
| Barát falának forrása | Elsődleges: `walls/{friendUid}` ([[012-wall-of-shame]] O. blokk); **fallback olvasás** a legacy `users/{friendUid}/failures\|successes` útra, `id` szerinti dedupppal (L. blokk) |
| **Vendég hozzáférése a social funkciókhoz** (2026-07-28, O. blokk) | **Nincs.** Vendég = **kijelentkezett VAGY anonim** — a barát-gráf a **Google auth uid**-ra kulcsol, anonim uid-re nem építhető tartós kapcsolat |
| Vendég visszajelzése | A Barátok gomb **🔒 prefixet** kap; kattintásra **nem navigál**, hanem tájékoztató üzenetet mutat (`role="status"`), ugyanez a szöveg a gomb `title` tooltipjében |
| Perzisztált social fázis vendégnél | A `ScreenRouter` **visszairányít** a főmenübe (`friends` / `chat` / `friendWall`) |
| `status === "loading"` kezelése | **NEM** számít vendégnek — különben az auth aszinkron feloldódása előtt a `ScreenRouter` kidobná a bejelentkezett játékost is oldalfrissítéskor |

---

## ✅ Haladás (TODO — 93/121 kész)

> Jelölés: `[ ]` hátravan · `[~]` folyamatban · `[x]` kész.
> **Új kész tételek (2026-07-28):** `sessions` node security rules + `createSession/joinSession/leaveSession/subscribeSession` RTDB függvények, `useMultiplayerSession` hook (ref→state fix), `MultiplayerStatusBar` overlay, `EventToast` értesítő komponens, multiplayer.* i18n kulcsok mind 5 nyelven, `database.rules.json` regenerálva.
> **Új kész tételek (2026-07-28, második kör):** barát-fal **legacy fallback olvasás** (L.), **chat mint önálló `"chat"` GamePhase** (M.), **chat üzenet-betöltés security-rule bugfix** (N.).
> **Új kész tételek (2026-07-28, harmadik kör):** **Barátok menü letiltása nem regisztrált usereknél** (O.) — 🔒 gomb + `friends.guestNotice` (5 nyelv) + `ScreenRouter` vendég-őr a perzisztált social fázisokra.

**A. Firebase RTDB séma bővítése — barátok, chat, multiplayer session**
- [x] RTDB új node-ok: `friends/{uid}/{friendUid}: true`, `friendRequests/{uid}/{fromUid}: { from, at, status }`, `chats/{chatId}: { participants, messages }`
- [x] `users/{uid}/profile` bővítése: `+onlineStatus: string` (offline/online/játékban) — `usersPublic/{uid}/onlineStatus`
- [x] `sessions/{sessionId}: { host, participants, status, createdAt }` — multiplayer session node (+ security rules)
- [x] `sessions` security rules: new session creation only, host transfer, participant self/host management
- [x] `security.rules.json` frissítése: `friends`, `friendRequests`, `chats` node-ok írási/olvasási szabályai
- [x] `security.rules.json` — `users/{uid}/failures` és `users/{uid}/successes` olvasási joga: csak a barátok számára engedélyezett
- [x] `database.rules.json` regenerálva

**B. Barátlista — UI és logika**
- [x] `src/components/screens/FriendsScreen.tsx` + `FriendsScreen.module.css` — **új GamePhase képernyő**
- [x] `src/components/screens/FriendsScreen.tsx` — barátlista online státusszal
- [x] `src/components/screens/FriendsScreen.tsx` — barátkereső név/becenév alapján (min. 3 karakter)
- [x] `src/components/screens/FriendsScreen.tsx` — UID lookup külön mező (pontos UID alapján)
- [x] `src/components/screens/FriendsScreen.tsx` — friend request küldése
- [x] `src/components/screens/FriendsScreen.tsx` — bejövő friend request-ek listája (elfogadás/elutasítás)
- [x] `src/components/screens/FriendsScreen.tsx` — valós idejű outgoing request státusz (Firebase subscription)
- [x] `src/types/index.ts` — új GamePhase: `"friends"`; új típusok: `FriendRequest`, `FriendStatus`, `UserOnlineStatus`
- [x] `src/components/routing/ScreenRouter.tsx` — `case "friends"` ág
- [x] `src/components/screens/MainMenu.tsx` — „Barátok" gomb → `transitionTo("friends")`
- [x] `MainMenu.tsx` — notification badge az olvasatlan üzenetekhez

**C. Privát chat — UI és logika**

> ℹ️ **Átalakítva az M. blokkban (2026-07-28):** a „chat a Barátok menüben (teljes képernyős nézet)" tétel már **nem** a `FriendsScreen` lokális `useState`-jéből renderelt al-nézet, hanem önálló `"chat"` GamePhase (`ChatScreen`). A `ChatPanel` az üzenetlista/beviteli mag maradt, a játék közbeni kis panelhez.

- [x] `src/components/features/ChatPanel.tsx` + `ChatPanel.module.css` — chat panel komponens
- [x] `ChatPanel.tsx` — üzenet lista, időbélyeg
- [x] `ChatPanel.tsx` — üzenet küldése (RTDB push)
- [x] `ChatPanel.tsx` — chat a Barátok menüben (teljes képernyős nézet)
- [ ] Chat játék közben (kisebb panel, jobb alsó sarok)
- [x] RTDB listener: valós idejű üzenet frissítés
- [x] Olvasatlan üzenet jelzés a Barátok gombon / barát listában
- [x] `ChatPanel.tsx` — typing indicator (gépelés jelző)
- [x] `userData.ts` — `markChatRead`, `subscribeUnreadCount`, `updateTypingStatus`, `subscribeTypingStatus`
- [x] `userData.ts` — `outgoingRequests/{from}/{to}` node + `subscribeOutgoingRequests` (valós idejű kérésstátusz)

**D. Multiplayer session kezelés**
- [x] `src/hooks/useMultiplayerSession.ts` — **új hook**: session létrehozás, csatlakozás, kilépés, host átadás (state-based currentSessionId, unmount cleanup)
- [x] `useGameStore.ts` bővítése: +`multiplayerSession: MultiplayerSession | null`, +`setMultiplayerSession` action
- [x] Session létrehozás: `createSession(uid, nickname)` → `sessions/{sessionId}` létrehozása hostként
- [x] Csatlakozás: `joinSession(sessionId, uid, nickname)` → `sessions/{sessionId}/participants` frissítése
- [x] Kilépés: `leaveSession(sessionId, uid)` → host átadás (következő résztvevőnek) vagy session törlés
- [x] Host átadás: ha host kilép, a rendszer a következő aktív résztvevőt jelöli ki
- [x] Max 8 fő limit
- [x] `subscribeMySessions` + `subscribeSession` — valós idejű session állapot figyelés
- [x] Online status broadcast: `updateOnlineStatus` + `onDisconnect` + gamePhase watcher

**E. Figyelmi állapot multiplayerben**
- [x] `updateSessionAttention` — figyelmi állapot RTDB-be írása: `sessions/{sessionId}/participants/{uid}/attention: boolean`
- [x] Figyelmi állapot olvasása: `subscribeSession` → `participants[uid].attention` (élő RTDB listener)
- [ ] Csapatszintű figyelmi döntés: easy/medium = legalább egy figyel; hard = mindenki figyel
- [ ] Ha senki nem figyel: a meglévő `INACTIVITY_LIMIT_SECONDS` óra indul csapatszinten
- [x] `src/components/features/MultiplayerStatusBar.tsx` + `MultiplayerStatusBar.module.css` — résztvevő lista a jobb felső sarokban, név + figyel/nem figyel ikonnal + korona ikon

**F. Események multiplayerben — a 011-es terv kiterjesztése**
- [ ] `useEventSystem.ts` bővítése: ha `multiplayerSession !== null`, az event ütemezés és kiosztás multiplayer módba vált
- [ ] Event kiosztás: az eventet az **figyelő** résztvevők közül választja a rendszer (random)
- [ ] Ha többen figyelnek: súlyozott random (aki régebb óta nem kapott eventet, nagyobb eséllyel)
- [ ] Ha senki nem figyel: új interaktív event nem indul; a figyelmetlenségi szabályok érvényesek
- [ ] Az event UI-ja (**EventModal**) csak az érintett játékosnál jelenik meg
- [ ] A nem érintett résztvevők **toast/statusz üzenetet** kapnak: „{name} {event_description}"
- [ ] `src/components/features/EventToast.tsx` + `EventToast.module.css` — nem blokkoló toast értesítés
- [ ] Globalis következmény esetén (pl. mentőhajó átszállás): minden résztvevő állapota frissül
- [ ] Event timeout: ha az érintett nem reagál időben, a **teljes csapat** kapja a büntetést
- [ ] i18n: `multiplayer.eventToast.*` kulcsok (lásd H blokk)

**G. Jutalom és bukas — multiplayer**
- [ ] `useGameStore.bestServiceSeconds` frissítése: a legjobb csapattag értéke számít (vagy átlag?)
- [ ] Küldetés végén a jutalom felosztása a résztvevők között
- [ ] Csak az kap jutalmat, aki a küldetés végén online van
- [ ] Ha a csapat elbukik, minden résztvevő veszít (crewLost mindenkinél)

**H. i18n — ÚJ kulcsok mind az 5 nyelven (`en`, `hu`, `fr`, `de`, `es`)**
- [x] `friends.title` / `friends.back` / `friends.search` / `friends.searchPlaceholder`
- [x] `friends.addFriend` / `friends.removeFriend` / `friends.friendRequestSent`
- [x] `friends.pendingRequests` / `friends.accept` / `friends.reject`
- [x] `friends.online` / `friends.offline` / `friends.inGame` / `friends.watching` / `friends.notWatching`
- [x] `friends.noResults` / `friends.empty`
- [x] `friends.guestNotice` (2026-07-28, O. blokk) — vendég tájékoztató a főmenüben (gomb tooltip + `role="status"` üzenet)
- [x] `chat.title` / `chat.inputPlaceholder` / `chat.send` / `chat.unread` / `chat.typing` / `chat.empty`
- [ ] `multiplayer.invite` / `multiplayer.join` / `multiplayer.leave` / `multiplayer.host`
- [ ] `multiplayer.participants` / `multiplayer.maxReached`
- [ ] `multiplayer.eventToast.horn` / `.asteroid` / `.rescueTransfer` / `.solarFlare` / `.rover`
- [ ] `multiplayer.eventToast.timePenalty` / `.crewLost`
- [ ] `multiplayer.hostTransferred` / `multiplayer.sessionEnded`
- [x] `friendWall.title` / `friendWall.back` / `friendWall.viewWall`
- [x] Teljes paritás mind az 5 fájlban

**I. Barát szégyenfala — read-only Wall of Shame megtekintése**
- [x] WallOfShame komponens **újrahasználása** read-only módban (opcionális `friendUid`/`friendName` propok)
- [x] `src/types/index.ts` — új GamePhase: `"friendWall"`
- [x] `FriendsScreen.tsx` — barátra kattintva opció: „View Wall of Shame" → `transitionTo("friendWall")` + barát uid átadása
- [x] `useGameStore` bővítése: +`friendWallTargetUid: string | null`, +`friendWallTargetName: string | null`
- [x] `ScreenRouter.tsx` — `case "friendWall"` ág → WallOfShame friend propokkal
- [x] Security rules: a `users/{uid}/failures` és `users/{uid}/successes` node-ok olvasása **csak barátok számára** engedélyezett
- [x] `App.tsx` — `friendWall` hozzáadva az `isPreGame` listához
- [x] i18n: `friendWall.*` kulcsok (lásd H blokk)

**J. Tesztek**
- [ ] `src/hooks/useMultiplayerSession.test.ts` — session létrehozás, csatlakozás, host átadás
- [ ] `src/hooks/useMultiplayerAttention.test.ts` — figyelmi állapot szinkron, csapatszintű döntés
- [ ] `src/hooks/useEventSystem.test.ts` — bővítés: multiplayer event kiosztás
- [ ] `tsc --noEmit` + `npm run test` + `npm run build` — zöld

**K. Dokumentáció**
- [x] `security.rules.json` frissítése: új node-ok (friends, friendRequests, chats)
- [ ] `.claude/lessons-learned.md` — bejegyzés a multiplayer architektúráról
- [ ] `.claude/references/architecture-current.md` frissítése

**L. Barát szégyenfala — legacy fallback olvasás (BUGFIX az I. blokkhoz) (2026-07-28)**
- [x] **Tünet:** a barát szégyenfala üres volt („Még nincs küldetés"), pedig a DB-ben voltak rekordjai
- [x] **Ok:** a barát adatai a régi `users/{uid}/failures|successes` úton maradtak, mert a `migrateWallData` **csak akkor** fut, ha az ADOTT user a SAJÁT falát nyitja meg; a `subscribeFailures(friendUid)` viszont már csak a `walls/{uid}`-ot olvasta ([[012-wall-of-shame]] O. blokk)
- [x] **Tévhit korrigálva:** a komponens korábbi megjegyzése azt állította, hogy a régi út barát módban olvashatatlan. Valójában az RTDB olvasási szabályok **lefelé kaszkádolnak**: a szülő `users/$key/.read: false` **nem vonja vissza** a `users/$key/failures|successes` szintű barát-grantet. Migrálni viszont tényleg nem lehet a barát nevében (a `walls/$uid` írás `$uid == auth.uid`-hez kötött) → a megoldás fallback **OLVASÁS**, nem migráció.
- [x] `src/firebase/userData.ts` — `subscribeLegacyFailures` / `subscribeLegacySuccesses` a `users/{uid}/…` útra (a közös `subscribeWallRecords` helperre építve)
- [x] `WallOfShame` barát módban mind a **NÉGY** útvonalra feliratkozik: `walls/{uid}/failures`, `walls/{uid}/successes`, `users/{uid}/failures`, `users/{uid}/successes`
- [x] `mergeById(primary, legacy)` helper a `WallOfShame`-ban — **`id` szerinti dedup**; a migráció változatlan `id`-vel másol, így félig migrált usernél sincs duplikátum
- [x] `tsc --noEmit` tiszta · `npm run test` **77/77** zöld · `npm run build` sikeres

**M. Chat mint önálló képernyő (a C. blokk átalakítása) (2026-07-28)**
- [x] **Kiváltó hiba:** F5-re a játékos visszaesett a barátlistára a nyitott beszélgetésből (a chat a `FriendsScreen` lokális `useState`-jéből renderelt al-nézet volt, ami nem perzisztálódik)
- [x] `src/types/index.ts` — új `"chat"` GamePhase
- [x] **Új fájlok:** `src/components/screens/ChatScreen.tsx` + `ChatScreen.module.css`
- [x] `useGameStore` — új, **perzisztált** mezők: `chatTargetUid`, `chatTargetName` (a `friendWallTargetUid`/`friendWallTargetName` mintájára), a `partialize`-ban is
- [x] `useGameStore` — `phaseToFlags` új `case "chat"` ág
- [x] `src/components/routing/ScreenRouter.tsx` — `case "chat"` → `ChatScreen`
- [x] `FriendsScreen.tsx` — a 💬 gomb már **csak célpontot állít** és `transitionTo("chat")`-el hív; a `ChatPanel` import és a beágyazott chat-render kikerült
- [x] `App.tsx` — `"chat"` hozzáadva az `isPreGame` listához **és** az online-státusz (`"online"`) fázislistájához
- [x] `ChatScreen` **önellátó**: a barát nevét maga kéri le a `usersPublic`-ból (`lookupUserByUid`), nem a `FriendsScreen` állapotából — az F5 után nem is létezik. Fallback-lánc: `usersPublic` név → perzisztált `chatTargetName` → az uid első 8 karaktere.

**N. Chat üzenetek betöltése — BUGFIX (2026-07-28)**
- [x] **Tünet:** a korábbi üzenetek nem jelentek meg a chatben
- [x] **Ok:** a `.read` szabály a `chats/$chatId/messages/$msgId` **szinten** volt, a kliens viszont a **teljes** `messages` kollekcióra iratkozik fel. Az RTDB-ben az olvasási jogot a **lekérdezett node-on vagy FELETTE** kell megadni — **gyerekszabály nem engedélyez szülő-listázást** → az `onValue(messages)` `PERMISSION_DENIED`-et kapott.
- [x] **Súlyosbító tényező:** a `subscribeChatMessages`-nek nem volt error callbackje, ezért a megtagadott olvasás némán „nincs még üzenet"-nek látszott. **Javítva.**
- [x] `database.rules.json` — a `.read` felkerült a **`messages` szintre**, résztvevőkre szűkítve: `root.child('chats').child($chatId).child('participants').child(auth.uid).val() === true` — ez **SZIGORÚBB**, mint a korábbi „bármelyik bejelentkezett user"
- [x] `database.rules.json` — az írás `newData.child('from').val() === auth.uid`-re szigorítva: **más nevében nem lehet üzenetet beírni**
- [x] A szabályok **deployolva élesben**
- [x] `tsc --noEmit` tiszta · `npm run test` **77/77** zöld · `npm run build` sikeres

**O. Barátok menü letiltása nem regisztrált usereknél (2026-07-28)**
- [x] **Indok:** a barát-gráf (`friends/{uid}`), a chat (`chats/{chatId}/participants`) és a barát-fal grant mind a **Google auth uid**-ra kulcsol. Anonim uid-re ezek nem építhetők — a vendég számára a képernyők üresek vagy `PERMISSION_DENIED`-esek lennének.
- [x] **Vendég definíció:** `!authUser || authUser.isAnonymous` (kijelentkezett **vagy** anonim)
- [x] `MainMenu.tsx` — a Barátok gomb **🔒 prefixet** kap vendégnél
- [x] `MainMenu.tsx` — kattintás vendégként **nem navigál**, hanem tájékoztató üzenetet állít be (`<p role="status">`) — a state a 002 F rész óta `guestNoticeKey: string | null`
- [x] `MainMenu.tsx` — ugyanaz a szöveg a gomb `title` tooltipjében
- [x] `MainMenu.module.css` — új `.guestNotice` stílus
- [x] Sikeres bejelentkezés után a notice **automatikusan eltűnik** (`useEffect` az `isGuest`-re)
- [x] Vendégnél a hozzászólás-számláló **RTDB listenerek el sem indulnak** (`subscribeFriends` / `subscribeUnreadCount` — nincs értelme, és felesleges kapcsolat)
- [x] `ScreenRouter.tsx` — védelem a **perzisztált fázisra**: ha a `friends` / `chat` / `friendWall` fázisban vendég a user → `transitionTo("mainMenu")` + `<MainMenu />` render
- [x] `ScreenRouter.tsx` — a `status === "loading"` **NEM** számít vendégnek: `authStatus !== "loading" && (!authUser || authUser.isAnonymous)` — enélkül az auth aszinkron feloldódása előtt a bejelentkezett játékost is kidobná oldalfrissítéskor
- [x] i18n: új `friends.guestNotice` kulcs **mind az 5 nyelven**
- [x] Ellenőrzés: `tsc --noEmit` tiszta · `npm run test` **77/77** zöld · `npm run build` sikeres
- [x] **Kiterjesztés a `shop` fázisra** ([[002-ingame-shop-frontend]] F rész, 2026-07-28): ugyanez a kétrétegű minta védi az áruházat is (a vásárlásnak túl kell élnie egy eldobható vendég-sessiont). Ekkor lett a `MainMenu` `showGuestNotice: boolean` state-je **`guestNoticeKey: string | null`** (két különböző üzenet), és született a közös **`guardedNav(phase, noticeKey)`** helper; a `ScreenRouter`-ben a `isSocialPhase` → **`needsAccount`** (`friends | chat | friendWall | shop`), a `blockSocial` → **`blockPhase`**.

---

## 1. Architektúra

### 1.1 Firebase RTDB séma

```json
{
  "users": {
    "{uid}": {
      "profile": {
        "onlineStatus": "offline | online | in-game",
        "nickname": "..."
      }
    }
  },
  "friends": {
    "{uid}": {
      "{friendUid}": true
    }
  },
  "friendRequests": {
    "{uid}": {
      "{fromUid}": {
        "from": "<uid>",
        "fromNickname": "...",
        "at": 1234567890,
        "status": "pending | accepted | rejected"
      }
    }
  },
  "chats": {
    "{chatId}": {
      "participants": { "{uid}": true, "{uid2}": true },
      "messages": {
        "{msgId}": {
          "from": "<uid>",
          "text": "...",
          "at": 1234567890
        }
      },
      "unread": { "{uid}": 0 },
      "typing": { "{uid}": true }
    }
  },
  "walls": {
    "{uid}": {
      "failures":  { "{pushId}": { "...": "FailureRecord" } },
      "successes": { "{pushId}": { "...": "SuccessRecord" } }
    }
  },
  "sessions": {
    "{sessionId}": {
      "host": "<uid>",
      "status": "waiting | playing | ended",
      "createdAt": 1234567890,
      "participants": {
        "{uid}": {
          "nickname": "...",
          "attention": true,
          "joinedAt": 1234567890
        }
      }
    }
  }
}
```

### 1.1.a Security rules — a kaszkádolás két tanulsága (2026-07-28)

| Szabály | Következmény |
|---|---|
| Az olvasási jogot a **lekérdezett node-on vagy FELETTE** kell megadni | A `chats/$chatId/messages/$msgId` szintű `.read` **nem** engedélyezi az `onValue(messages)` **listázást** → `PERMISSION_DENIED` (N. blokk). A `.read` a **`messages` szintre** került, résztvevőkre szűkítve. |
| A szabályok **lefelé kaszkádolnak**, de a szülő `false` **nem von vissza** gyerek-grantet | A `users/$key/.read: false` mellett a `users/$key/failures\|successes` szintű **barát-grant érvényes marad** → a legacy fal barát módban **olvasható** (L. blokk). |

```jsonc
"chats": {
  "$chatId": {
    "messages": {
      // FELÜL a kollekción — enélkül nincs listázás
      ".read": "auth != null && root.child('chats').child($chatId)
                 .child('participants').child(auth.uid).val() === true",
      "$msgId": {
        // más nevében nem lehet írni
        ".write": "auth != null && newData.child('from').val() === auth.uid"
      }
    }
  }
}
```

> ⚠️ **Néma megtagadás.** Mindkét hibát súlyosbította, hogy a subscription-nek nem volt `error` callbackje: a `PERMISSION_DENIED` „nincs még üzenet" / „üres fal" képében jelent meg. Azóta a `subscribeChatMessages` és a fal-subscription-ök (`subscribeWallRecords`, [[012-wall-of-shame]]) is hibaágon **üres listát** adnak vissza és logolnak.

### 1.2 Komponens architektúra

```
MainMenu ──► "Barátok" gomb ──► FriendsScreen (GamePhase: "friends")
                                           │
                              ┌────────────┼────────────┐
                              ▼            ▼            ▼
                         Barátlista    Keresés     Friend Request-ek
                              │
                    ┌─────────┴──────────┐
                    ▼                    ▼
          💬 → transitionTo("chat")   „View Wall of Shame" ──► WallOfShame (friend mód)
                    │                  (read-only, élő RTDB     (GamePhase: "friendWall")
                    ▼                   subscription)               │
              ChatScreen                                      ┌─────┴──────┐
        (GamePhase: "chat" — ÖNÁLLÓ,                          ▼            ▼
         F5-álló; a nevet maga kéri le                   Failures     Successes
         a usersPublic-ból)                              (sírkövek)   (trófeák)

Játék közben (gamePhase === "playing"):

┌─────────────────────────────────────────────────────────────┐
│  MultiplayerStatusBar (jobb felső sarok)                     │
│  ┌──────┐ ┌──────┐ ┌──────┐                                  │
│  │Anna🟢│ │Bela🟡│ │Csaba🔴│ → ChatPanel (kis panel)         │
│  └──────┘ └──────┘ └──────┘                                  │
│                                                               │
│                     Dashboard (meglévő)                        │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐     │
│  │    EventToast (nem blokkoló) → "Anna evasive maneuver"│     │
│  └──────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 Event kiosztás multiplayerben

```
useEventSystem
  │
  ├── Ha multiplayerSession !== null:
  │     ├── Event kiválasztás (meglévő poolból)
  │     ├── Ki kapja? → a figyelő résztvevők közül random / súlyozott
  │     ├── Az érintettnél: EventModal (meglévő)
  │     ├── A többieknél: EventToast (nem blokkoló)
  │     └── Timeout → csapatbüntetés
  │
  └── Ha multiplayerSession === null:
        └── Meglévő single player viselkedés
```

### 1.4 Figyelmi állapot szinkron

```
useMultiplayerAttention
  │
  ├── useAttentionMonitor meglévő face detection → attention státusz
  ├── attention státusz → RTDB: sessions/{sessionId}/participants/{uid}/attention
  ├── RTDB listener → más résztvevők attention státusza
  ├── Csapatszintű döntés:
  │     ├── Easy/Medium: legalább 1 figyel → OK; 0 figyel → countdown
  │     └── Hard: mind figyel → OK; bárki nem figyel → countdown
  └── Ha senki nem figyel → meglévő crewLost mechanika (csapatszinten)
```

### 1.5 Chat mint önálló GamePhase (M. blokk, 2026-07-28)

**Előtte:** a chat a `FriendsScreen` lokális `useState`-jéből renderelt al-nézet volt → **F5-re elveszett**, a játékos visszaesett a barátlistára.

**Utána:** a chat ugyanolyan elsőosztályú fázis, mint a `friends` vagy a `settings`.

```
FriendsScreen  ── 💬 gomb ──►  setChatTarget(uid, name)
                               transitionTo("chat")
                                        │
                                        ▼
                      ScreenRouter  case "chat" → ChatScreen
                                        │
                        ┌───────────────┴────────────────┐
                        ▼                                ▼
              lookupUserByUid(uid)              subscribeChatMessages(chatId)
              (usersPublic → név)               (walls/… független, chats/…)
                        │
        név-fallback:  usersPublic  →  chatTargetName (persist)  →  uid.slice(0, 8)
```

**Perzisztált állapot (`useGameStore`, `partialize`-ban is):**

```ts
chatTargetUid: string | null;    // a friendWallTargetUid mintájára
chatTargetName: string | null;   // csak fallback — a ChatScreen elsődlegesen a usersPublic-ból olvas
```

- `phaseToFlags` új `case "chat"` ág (pre-game szemantika).
- `App.tsx`: a `"chat"` szerepel az `isPreGame` listában **és** az online-státusz (`"online"`) fázislistájában.
- **Miért nem elég a perzisztált név?** Mert az elavulhat (a barát átnevezi magát), és mert az F5 utáni forrás nem a `FriendsScreen` állapota. A `ChatScreen` ezért **önellátó**: maga kérdezi le a `usersPublic`-ot.

### 1.6 Barát fala — négy forrás, egy lista (L. blokk, 2026-07-28)

```
friend mód (friendWallTargetUid):
    subscribeFailures(friendUid)         → walls/{uid}/failures        ┐
    subscribeSuccesses(friendUid)        → walls/{uid}/successes       │ elsődleges
    subscribeLegacyFailures(friendUid)   → users/{uid}/failures        ┐
    subscribeLegacySuccesses(friendUid)  → users/{uid}/successes       │ legacy fallback
                        │
                        ▼
        mergeById(primary, legacy)   # id szerinti dedup
```

**Miért kell a fallback?** A `migrateWallData` **csak a tulajdonos** saját faltár-megnyitásakor fut ([[012-wall-of-shame]] O. blokk). Aki még nem nyitotta meg a saját falát, annak az adata a legacy úton van — a barát viszont már a `walls/{uid}`-ot olvasná. Migrálni a barát **nem tud** a másik nevében (`walls/$uid` írás `$uid == auth.uid`-hez kötött), ezért fallback **olvasás** a megoldás.

**Miért nem duplikál?** A migráció **változatlan `id`**-vel másol, így a `mergeById` a félig migrált usernél is egyetlen példányt tart meg rekordonként.

### 1.7 Vendég-őr — két rétegben (O. blokk, 2026-07-28)

```
isGuest = !authUser || authUser.isAnonymous          # a barát-gráf a GOOGLE auth uid-ra kulcsol

1. réteg — MainMenu (megelőzés)
   guardedNav(phase, noticeKey) = isGuest ? () => setGuestNoticeKey(noticeKey)
                                          : () => transitionTo(phase)
   Barátok gomb  →  🔒 prefix + title tooltip
                 →  kattintás: setGuestNoticeKey("friends.guestNotice")   (NEM transitionTo("friends"))
                 →  <p role="status">{t(guestNoticeKey)}</p>
                 →  sikeres bejelentkezés → useEffect(!isGuest) → a notice eltűnik
   RTDB listenerek (subscribeFriends / subscribeUnreadCount) vendégnél EL SEM INDULNAK

2. réteg — ScreenRouter (perzisztált fázis)
   isGuest = authStatus !== "loading" && (!authUser || authUser.isAnonymous)
                              ▲
                              └── a "loading" NEM vendég: az auth aszinkron feloldódása
                                  előtt különben a bejelentkezett játékost is kidobná F5-re
   blockPhase = isGuest && phase ∈ needsAccount { friends, chat, friendWall, shop }
        → useEffect: transitionTo("mainMenu")                          ▲
        → render: <MainMenu />                                         └── shop: 002 F rész
```

**Miért kell a második réteg?** Mert a `gamePhase` **perzisztálódik** ([[007-state-persist-page-refresh]]): kijelentkezés egy social képernyőn, vagy F5 egy localStorage-ból visszaállított social fázisba, megkerülné a főmenü gombját.

---

## 2. Fájlstruktúra

### Új fájlok
```
src/components/screens/FriendsScreen.tsx          # Barátok képernyő
src/components/screens/FriendsScreen.module.css
src/components/screens/ChatScreen.tsx             # ÚJ (M. blokk) — chat mint önálló GamePhase ("chat")
src/components/screens/ChatScreen.module.css
src/components/features/ChatPanel.tsx             # Privát chat panel (üzenetlista + beviteli mag)
src/components/features/ChatPanel.module.css
src/components/features/MultiplayerStatusBar.tsx  # Résztvevő lista játék közben
src/components/features/MultiplayerStatusBar.module.css
src/components/features/EventToast.tsx            # Nem blokkoló event értesítés
src/components/features/EventToast.module.css
src/hooks/useMultiplayerSession.ts                # Session kezelés
src/hooks/useMultiplayerAttention.ts              # Figyelmi állapot szinkron
```

> ℹ️ **Pontosítás (2026-07-28):** külön `FriendWallScreen.tsx` **nem** készült — az I. blokk döntése szerint a meglévő `WallOfShame` komponens került újrahasznosításra read-only (friend) módban, opcionális `friendUid`/`friendName` propokkal. A `"friendWall"` GamePhase megmaradt.

### Módosuló fájlok
```
src/types/index.ts                                # +GamePhase "friends", "friendWall", "chat", +MultiplayerSession, +FriendRequest, +UserOnlineStatus
src/state/useGameStore.ts                         # +multiplayerSession, +multiplayerParticipants, +friendWallTargetUid, +friendWallTargetName,
                                                  #  +chatTargetUid, +chatTargetName (persist + partialize), +phaseToFlags case "chat"
src/components/routing/ScreenRouter.tsx           # +"friends", +"friendWall", +"chat" case;
                                                  #  +vendég-őr: blockPhase → transitionTo("mainMenu") + <MainMenu />
                                                  #  needsAccount = friends | chat | friendWall | shop (a shop: 002 F rész)
                                                  #  (authStatus "loading" NEM vendég) — O. blokk
src/components/screens/MainMenu.tsx               # "Barátok" gomb; +isGuest → 🔒 prefix, guestNotice (role="status"),
                                                  #  title tooltip, listenerek kihagyása vendégnél — O. blokk;
                                                  #  guestNoticeKey: string | null + guardedNav() helper (002 F rész)
src/components/screens/MainMenu.module.css        # +.guestNotice — O. blokk
src/components/screens/FriendsScreen.tsx          # +"View Wall of Shame" gomb → transitionTo("friendWall");
                                                  #  💬 gomb → setChatTarget + transitionTo("chat") (a ChatPanel import + beágyazott render kikerült)
src/components/screens/WallOfShame.tsx            # +read-only mód paraméter (opcionális, újrahasználható);
                                                  #  +barát mód 4 subscription (walls + legacy) + mergeById() dedup
src/hooks/useEventSystem.ts                       # Multiplayer event kiosztás
src/components/features/EventModal.tsx             # Multiplayer-aware (opcionális)
src/components/features/Dashboard.tsx              # MultiplayerStatusBar integráció
src/App.tsx                                        # FriendsScreen + friendWall routing; "chat" az isPreGame listában
                                                   #  és az online-státusz ("online") fázislistájában
src/firebase/userData.ts                          # +subscribeFriendFailures(), +subscribeFriendSuccesses()
                                                  #  → megvalósítva: subscribeFailures/subscribeSuccesses(friendUid) a walls/{uid}-on
                                                  #  +subscribeLegacyFailures(), +subscribeLegacySuccesses() (users/{uid}/… fallback, L. blokk)
                                                  #  subscribeChatMessages: +error callback (néma PERMISSION_DENIED javítás, N. blokk)
security.rules.json                                # Új node-ok + friend-only olvasás failures/successes + walls/{uid}
database.rules.json                                # Regenerálva; chats/$chatId/messages/.read a KOLLEKCIÓ szintjén (résztvevőkre szűkítve),
                                                   #  $msgId/.write: newData.child('from').val() === auth.uid — DEPLOYOLVA élesben
src/i18n/locales/{en,hu,fr,de,es}/translation.json  # 35+ új kulcs
```

---

## 3. Függőségek

- **Előfeltétel:** [[011-difficulty-event-system]] — a multiplayer event kiosztás a 011 eseményrendszerét használja; a 011-es EventModal és useEventSystem az alap
- **Előfeltétel:** [[010-firebase-guest-merge-single-gate]] — a barátlista és chat Firebase RTDB-t használ; a guest→fiók merge kapu nélkül a barátok azonosítása instabil lenne
- **Előfeltétel:** [[003-firebase-auth-settings]] — Firebase Auth kell a felhasználók azonosításához
- **Független:** Stripe-tervektől (013, 014) — a multiplayer nem érint fizetést
- **Érinti:** [[007-state-persist-page-refresh]] — session állapot **nem** perzisztálódik (újracsatlakozás kell); a **chat célpont viszont igen** (`chatTargetUid` / `chatTargetName` a `partialize`-ban), különben F5-re a nyitott beszélgetés elveszne (M. blokk)
- **Érinti:** [[009-firebase-identity-split-bugfix]] — a rtdbKey/uid invariáns biztosítja, hogy a barátok és chat a helyes user node-okhoz kapcsolódnak; a `walls/{uid}` kulcs is innen jön (bejelentkezve `auth.uid`)
- **Előfeltétel/kölcsönös:** [[012-wall-of-shame]] — a barát szégyenfala a `walls/{uid}` node barát-olvasási szabályára épül (012 O. blokk). A 012 **azért** vezette be a top-level `walls` node-ot, mert a `users/$key/.read` szülő szinten blokkolja a barát-hozzáférést. A legacy fallback olvasás (L. blokk) a 012 migrációjának hatóköri korlátját (csak a tulajdonos migrál) fedi le.
- **Érinti:** [[010-firebase-guest-merge-single-gate]] — a vendég fala a guest→Google váltáskor kerül át `walls/{deviceId}` → `walls/{targetUid}`; enélkül a barát-rendszer (ami `auth.uid`-del kulcsol) nem látná

---

## 4. i18n — ÚJ kulcsok (mind az 5 nyelv)

> Teljes paritás kötelező (`en`, `hu`, `fr`, `de`, `es`). A `multiplayer.eventToast.*` kulcsok a 011-es `event.*` kulcsokra épülnek — a toast rövid leírást ad.

| Kulcs | en | hu |
|---|---|---|
| `friends.title` | Friends | Barátok |
| `friends.back` | Back | Vissza |
| `friends.search` | Search players | Játékosok keresése |
| `friends.searchPlaceholder` | Search by nickname or email... | Keresés név vagy email alapján... |
| `friends.addFriend` | Add friend | Barát hozzáadása |
| `friends.removeFriend` | Remove friend | Barát eltávolítása |
| `friends.friendRequestSent` | Friend request sent! | Barátkérés elküldve! |
| `friends.pendingRequests` | Pending requests | Függő kérések |
| `friends.accept` | Accept | Elfogadás |
| `friends.reject` | Reject | Elutasítás |
| `friends.online` | Online | Online |
| `friends.offline` | Offline | Offline |
| `friends.inGame` | In game | Játékban |
| `friends.watching` | Watching | Figyel |
| `friends.notWatching` | Not watching | Nem figyel |
| `friends.noResults` | No players found | Nincs találat |
| `friends.empty` | Your friend list is empty | A barátlistád üres |
| `friends.minSearchLength` | Type at least 3 characters to search | Írj legalább 3 karaktert a kereséshez |
| `friends.uidLookupPlaceholder` | Paste exact User ID... | Illeszd be a pontos User ID-t... |
| `friends.lookup` | Look up | Keresés |
| `friends.uidNotFound` | No user found with this ID | Nincs felhasználó ezzel az ID-val |
| `friends.uidLookupError` | Lookup failed. Try again. | A keresés nem sikerült. Próbáld újra. |
| `friends.thisIsYou` | This is you! | Ez te vagy! |
| `friends.guestNotice` ⭐ | The friends feature requires an account. Sign in with Google to add friends and chat with them! | A barátok funkcióhoz be kell jelentkezned. Jelentkezz be Google-fiókkal, hogy barátokat adhass hozzá és chatelhess velük! |
| `friendWall.title` | {{name}}'s Wall of Shame | {{name}} Szégyenfala |
| `friendWall.back` | Back to Friends | Vissza a barátokhoz |
| `friendWall.emptyFailures` | No failures recorded | Nincs rögzített kudarc |
| `friendWall.emptySuccesses` | No successful missions | Nincs sikeres küldetés |
| `chat.title` | Chat | Csevegés |
| `chat.inputPlaceholder` | Write a message... | Írj egy üzenetet... |
| `chat.send` | Send | Küldés |
| `chat.unread` | Unread messages | Olvasatlan üzenetek |
| `multiplayer.invite` | Invite to mission | Meghívás küldetésbe |
| `multiplayer.join` | Join mission | Csatlakozás küldetéshez |
| `multiplayer.leave` | Leave mission | Kilépés a küldetésből |
| `multiplayer.host` | Host | Házigazda |
| `multiplayer.participants` | Participants ({{count}}/8) | Résztvevők ({{count}}/8) |
| `multiplayer.maxReached` | Maximum 8 participants reached | Maximum 8 résztvevő |
| `multiplayer.eventToast.horn` | {{name}} is responding to a horn signal! | {{name}} egy kürtszóra reagál! |
| `multiplayer.eventToast.asteroid` | {{name}} is evading an asteroid! | {{name}} kitér egy aszteroida elől! |
| `multiplayer.eventToast.rescueTransfer` | {{name}} transferred to a rescue ship! | {{name}} átszállt egy mentőhajóra! |
| `multiplayer.eventToast.solarFlare` | {{name}} is dealing with a solar flare! | {{name}} egy napkitöréssel küzd! |
| `multiplayer.eventToast.rover` | {{name}} is deploying a rover! | {{name}} egy űrajárót vet be! |
| `multiplayer.eventToast.timePenalty` | {{name}} failed — +{{years}} years added to travel time | {{name}} elbukta — +{{years}} év az útidőhöz |
| `multiplayer.eventToast.crewLost` | {{name}} failed — the crew is lost! | {{name}} elbukta — a legénység odaveszett! |
| `multiplayer.hostTransferred` | {{name}} is the new host! | {{name}} az új házigazda! |
| `multiplayer.sessionEnded` | The session has ended | A munkamenet véget ért |
| `multiplayer.inviteReceived` | {{name}} invited you to a mission! | {{name}} meghívott egy küldetésbe! |

---

## 5. Kockázatok / figyelmeztetések

### 5.1 Firebase RTDB terhelés
- A `chats` node folyamatos RTDB írást generál — minden üzenet egy `push()`. 8 játékos aktív chatje esetén ez kezelhető mennyiség (max ~1-2 írás/perc/fő). A Spark-terv korlátai: 100 egyidejű kapcsolat, 1 GB tárhely — ez bőven elég.
- A `sessions/{sessionId}/participants/{uid}/attention` node másodpercenként frissül (a face detection gyakoriságával). Ez 8 játékos × 1 Hz = 8 írás/másodperc egy session alatt. Ez belül van a Spark-korláton.

### 5.2 Host átadás konzisztencia
- Ha a host kilép, a host átadás egy RTDB `transaction`-nel történik (vagy egyszerű `update`). Fennáll a versenyhelyzet, ha ketten lépnek ki egyszerre. **Megoldás:** a host átadás a `sessions/{sessionId}/host` mező atomikus `set()`-jével történik; ha a kiválasztott új host is kilép, a rendszer a harmadik résztvevőt próbálja.

### 5.3 Event timeout multiplayerben
- Ha az érintett játékos nem reagál időben, a teljes csapat kapja a büntetést. Ez kemény, de szükséges a csapatdinamika fenntartásához. A toast értesítés egyértelművé teszi, hogy ki hibázott.
- **Fontos:** a timeout csak akkor indul, ha legalább egy játékos figyel (különben a figyelmetlenségi mechanika indul előbb).

### 5.4 Regresszió kockázatok
- **Single player játékmenet:** a multiplayer módosítások nem törhetik el a meglévő single player élményt. A `useEventSystem`-ben a `multiplayerSession` ellenőrzésével a két mód teljesen elkülöníthető.
- **useGameStore perzisztálás:** a `multiplayerSession` és `multiplayerParticipants` mezők **nem** perzisztálódnak (a `partialize` kihagyja őket).

### 5.5 Nyitott kérdések

- **Extra jutalom az aktívan figyelőkért?** A specifikáció 7. pontja felteszi a kérdést, de egyeztetés során nem került tisztázásra. Jelen terv egyszerű felosztást ír elő (minden résztvevő egyenlően osztozik). Ha később szükségessé válik, a jutalomelosztás logikája bővíthető anélkül, hogy az RTDB sémát vagy a session kezelést érintené.

### 5.6 UX kockázatok
- **Chat elérhetősége játék közben:** a chat panel nem lehet zavaró a játékmenet szempontjából. Kis méretű, összecsukható panel a jobb alsó sarokban.
- **Toast értesítések:** nem blokkolóak, automatikusan eltűnnek 3-5 másodperc után. Nem zavarhatják a dashboardot vagy az EventModal-t.

### 5.7 Security rules — kaszkádolás és néma megtagadás (2026-07-28, L./N. blokk)

- **Kollekció-listázás:** az RTDB-ben a `.read`-et a **lekérdezett node-on vagy felette** kell megadni. Egy `$msgId` szintű `.read` **nem** engedélyezi az `onValue(messages)` hívást. Minden új „kollekcióra iratkozom fel" mintánál ezt **kötelező** ellenőrizni.
- **Szülő `false` ≠ gyerek tiltás:** a `users/$key/.read: false` **nem vonja vissza** a `users/$key/failures|successes` szintű barát-grantet. A korábbi ezzel ellentétes feltételezés vezetett oda, hogy a legacy fal olvasását „lehetetlennek" hittük.
- **Néma megtagadás:** error callback nélküli `onValue` esetén a `PERMISSION_DENIED` „üres adat"-ként jelenik meg. **Minden** RTDB subscription-nek legyen error ága (log + üres lista) — ez volt a chat és a fal hibájának közös súlyosbító tényezője.
- **Szigorítás, nem lazítás:** a `messages` `.read` (résztvevőkre szűkítve) és a `$msgId` `.write` (`from === auth.uid`) a **korábbinál szigorúbb**. A `.write` szigorítás előtt más nevében is lehetett üzenetet beírni.
- **Deploy-kötelezettség:** a `database.rules.json` módosítása csak **deploy után** hat. Az N. blokk szabályai **élesben deployolva**.

### 5.8 Fázis-perzisztálás és képernyő-önellátás (2026-07-28, M. blokk)

- **Minden „célpontos" képernyőnek önálló GamePhase + perzisztált célpont kell.** A `FriendsScreen` lokális `useState`-jéből renderelt chat F5-re elveszett — ugyanez a hibaosztály bármely beágyazott al-nézetnél megismételhető.
- **A képernyő ne a szülő állapotára támaszkodjon.** A `ChatScreen` a barát nevét a `usersPublic`-ból kéri le (`lookupUserByUid`); a perzisztált `chatTargetName` csak **fallback**, mert elavulhat (átnevezés). Végső fallback: az uid első 8 karaktere.
- **Regressziós figyelmeztetés:** minden új pre-game fázist fel kell venni az `App.tsx` `isPreGame` listájába **és** az online-státusz fázislistájába, különben a háttérzene/online státusz elcsúszik.

### 5.9 Vendég-hozzáférés és auth-időzítés (2026-07-28, O. blokk)

- **A social funkciók a Google auth uid-ra kulcsolnak.** Vendégnek (kijelentkezett **vagy** anonim) nincs tartós social identitása → a Barátok menü **letiltva**, a hozzászólás-számláló listenerek **el sem indulnak**.
- **A gomb letiltása önmagában nem elég.** A `gamePhase` perzisztálódik ([[007-state-persist-page-refresh]]), ezért a `ScreenRouter`-ben is kell **vendég-őr** — kijelentkezés egy social képernyőn vagy F5 egy visszaállított social fázisba különben megkerülné a menüt.
- **⚠️ Az auth aszinkron feloldódása nem lehet „vendég".** A `status === "loading"` **nem** számít vendégnek — enélkül minden oldalfrissítés kidobná a bejelentkezett játékost a chatből/barát-falról, mielőtt az auth megérkezne. Ugyanaz az időzítési hibaosztály, mint a [[012-wall-of-shame]] R. blokkjában (a fiókváltás-figyelő kiindulási értéke sem indulhat `null`-ról).
- **Tájékoztatás, nem néma tiltás.** A letiltott gomb visszajelzés nélkül hibának látszik: ezért 🔒 prefix + `title` tooltip + `role="status"` üzenet, ami sikeres bejelentkezés után **automatikusan eltűnik**.
- **A minta újrahasznosítható, de két helyen kell karbantartani.** A `MainMenu` gombja és a `ScreenRouter` `needsAccount` listája **külön** kód: új, fiókot igénylő fázisnál mindkettőt bővíteni kell (a `shop` felvétele — [[002-ingame-shop-frontend]] F rész — pontosan ezt az utat járta be). A notice-t tartó state ezért lett `boolean` helyett **`guestNoticeKey: string | null`**, a navigáció pedig a közös `guardedNav(phase, noticeKey)` helperbe került.

---

## 6. Kész definíció

- A **Főmenüben** elérhető a **Barátok** képernyő, ahol a játékos láthatja a barátlistáját online státusszal, kereshet más játékosokat (nickname, email, user ID), küldhet és fogadhat barátkéréseket.
- **Privát chat** elérhető a Barátok menüben (teljes képernyő) és játék közben (kis panel, jobb alsó sarok). Az üzenetek valós időben szinkronizálódnak az RTDB-n keresztül.
- **Multiplayer session:** host indít egy küldetést, meghívhat barátokat (max 8 fő). A meghívott játékos elfogadás után csatlakozik. Futó küldetéshez is lehet csatlakozni host jóváhagyással. Ha a host kilép, a rendszer átadja a host szerepet.
- **Figyelmi állapot:** játék közben a jobb felső sarokban látszik a résztvevők neve és figyelmi állapota (figyel / nem figyel). Easy/Medium módban elég ha legalább egy ember figyel; Hard módban mindenkinek figyelnie kell.
- **Események multiplayerben:** a 011-es terv eventjei multiplayer módban csak egy (figyelő) játékost érintenek közvetlenül; a többiek toast értesítést kapnak. Ha az érintett nem reagál időben, a teljes csapat büntetést kap.
- **Jutalom:** a küldetés végén a jutalom felosztásra kerül a résztvevők között. Csak az kap, aki a végén online van. Ha a csapat elbukik, mindenki veszít.
- **Firebase struktúra:** `friends`, `friendRequests`, `chats`, `sessions` új node-ok a megfelelő security rules-szal.
- **Barát szégyenfala:** a FriendsScreen-en a barátra kattintva elérhető a barát fala (GamePhase: `"friendWall"`), amely a meglévő `WallOfShame` komponenst használja újra read-only módban (külön `FriendWallScreen` **nem** készült). A barát neve a headerben jelenik meg („{name} Szégyenfala"). A rekordok élő RTDB subscription-nel szinkronizálódnak.
- **Security:** a barát fala a `walls/{uid}` node-ról olvasható (`friends/{auth.uid}/{$uid} === true` grant); a legacy `users/{uid}/failures|successes` olvasása szintén csak barátok számára engedélyezett.
- i18n: mind az 5 nyelven teljes paritás (35+ új kulcs)
- `npm run test` + `npm run build` + `tsc --noEmit` — zöld

### Bővítés (2026-07-28) — L./M./N. blokk

- **Barát fala nem lehet hamisan üres:** a `WallOfShame` barát módban **négy** útvonalra iratkozik fel (`walls/{uid}/failures|successes` + legacy `users/{uid}/failures|successes`), és `mergeById`-vel `id` szerint deduplikál. A még nem migrált barát fala is látszik, félig migrált usernél sincs duplikátum.
- **A chat önálló `"chat"` GamePhase:** `ChatScreen` + `ChatScreen.module.css`, `ScreenRouter` `case "chat"`, perzisztált `chatTargetUid` / `chatTargetName` a `useGameStore` `partialize`-ában, `phaseToFlags` `case "chat"`, `"chat"` az `App.tsx` `isPreGame` és online-státusz listáiban. **F5 után a játékos a beszélgetésben marad.** A `ChatScreen` a barát nevét maga kéri le a `usersPublic`-ból (`lookupUserByUid`), fallback: perzisztált név → `uid.slice(0, 8)`.
- **A chat üzenetek betöltődnek:** a `chats/$chatId/messages` `.read` a **kollekció szintjén** van, résztvevőkre szűkítve; az írás `from === auth.uid`-re szigorítva; a `subscribeChatMessages` **error callbackkel** rendelkezik (nincs több néma „nincs még üzenet"). A szabályok **élesben deployolva**.
- **Ellenőrzés:** `tsc --noEmit` tiszta · `npm run test` **77/77** zöld · `npm run build` sikeres.

### Bővítés (2026-07-28) — O. blokk (vendég-hozzáférés)

- **A Barátok menü csak regisztrált (Google) usernek elérhető.** Vendégnél (kijelentkezett vagy anonim) a gomb 🔒 prefixet kap, kattintásra nem navigál, hanem a `friends.guestNotice` üzenetet mutatja (`role="status"` + `title` tooltip); a notice sikeres bejelentkezés után eltűnik.
- **Vendégnél a hozzászólás-számláló RTDB listenerek el sem indulnak.**
- **A perzisztált social fázis (`friends` / `chat` / `friendWall`) vendégnél a főmenübe irányít vissza** — a `status === "loading"` **nem** számít vendégnek, így az oldalfrissítés a bejelentkezett játékost nem dobja ki. *(A `shop` fázis ugyanezt a listát kapta meg a [[002-ingame-shop-frontend]] F részében.)*
- **i18n:** `friends.guestNotice` mind az 5 nyelven.
- **Ellenőrzés:** `tsc --noEmit` tiszta · `npm run test` **77/77** zöld · `npm run build` sikeres.

---

## 7. Kapcsolódó tervek

- [[012-wall-of-shame]] — **kölcsönös kapcsolat.** A 012 O. blokkja **ezért** vezette be a top-level `walls/{uid}` node-ot: a `users/$key/.read` szülő szinten blokkolja a barát-hozzáférést. Az itteni I. blokk (barát fala) arra épül, az L. blokk pedig a 012 migrációjának hatóköri korlátját (csak a tulajdonos migrál) fedi le legacy fallback olvasással.
- [[011-difficulty-event-system]] — **előfeltétel.** A multiplayer event kiosztás (F blokk) a 011 `useEventSystem` / `EventModal` rendszerére épül.
- [[010-firebase-guest-merge-single-gate]] — a vendég fala a `migrateGuestData()`-ban kerül át `walls/{deviceId}` → `walls/{targetUid}`; enélkül a `auth.uid`-del kulcsoló barát-rendszer nem látná.
- [[009-firebase-identity-split-bugfix]] — a `getRtdbKey()` / `selectRtdbKey` invariáns adja a `walls/{uid}`, `friends/{uid}`, `chats/{chatId}` kulcsokat.
- [[003-firebase-auth-settings]] — **előfeltétel.** Firebase Auth + az eredeti RTDB séma és rules forrása.
- [[007-state-persist-page-refresh]] — a `chatTargetUid` / `chatTargetName` perzisztálás ugyanabba a `useGameStore` `partialize`-ba illeszkedik; a session állapot szándékosan **nem** perzisztálódik. **Két 2026-07-28-i következmény:** (1) a perzisztált `gamePhase` miatt kell a `ScreenRouter` vendég-őre (O. blokk); (2) fiókváltáskor a `clearUserScopedData` nullázza a `chatTarget*` / `friendWallTarget*` mezőket, mert azok az előző fiók barát-gráfjára mutatnak (007 G. blokk).
- [[001-main-menu-settings]] — a Barátok gomb és a vendég-tájékoztató (`.guestNotice`) a főmenü panelen él; a főmenü elrendezésének 2026-07-28-i bővítése ott van dokumentálva.
- [[002-ingame-shop-frontend]] — az O. blokk vendég-őrét az **F rész** terjesztette ki a `shop` fázisra (közös `guardedNav` + `guestNoticeKey`, `needsAccount` lista). A shop-specifikus indoklás és a vállalt következmény (a vendég nem tud vásárolni, csak örökölni kreditet) ott van rögzítve.
- [[000-i18n-nyelvesites]] — a `friends.*`, `chat.*`, `friendWall.*`, `multiplayer.*` kulcsok teljes paritása mind az 5 nyelven.
