---
title: "Social és multiplayer – barátok, chat, közös küldetések"
slug: 013-social-multiplayer
type: plan
category: core
status: not-started
implemented: false
implemented_at: null
created_at: "2026-07-27"
updated_at: "2026-07-29"
author: exphoenee
step: 13
phases: []
dependencies:
  - 011-difficulty-event-system
  - 010-firebase-guest-merge-single-gate
  - 003-firebase-auth-settings
related_plans:
  - 007-state-persist-page-refresh
  - 009-firebase-identity-split-bugfix
  - 012-wall-of-shame
tags:
  - social
  - multiplayer
  - friends
  - chat
  - firebase
  - rtdb
  - i18n
  - gameplay
---

# Social és multiplayer – barátok, chat, közös küldetések

**Cél:** A játékosok kapcsolatba léphessenek egymással — barátokat kezeljenek, privát üzeneteket küldjenek, **megtekinthessék egymás Szégyenfalát (kudarcok + sikerek, read-only)**, és közös multiplayer küldetésekben vegyenek részt, ahol a figyelem és az események csapatszinten kezelődnek.

> ⚠️ **Ez a terv a [[011-difficulty-event-system]] tervre épül** — a multiplayer eseménykezelés (ki kapja az eventet, hogyan értesülnek a többiek) a 011-es terv eseményrendszerét használja. **A 011-es terv előfeltétel.** Firebase RTDB szükséges a barátlistához és a chathez — ez a [[003-firebase-auth-settings]] és [[010-firebase-guest-merge-single-gate]] tervek Firebase infrastruktúrájára épül.

---

## Döntések (egyeztetve)

| Kérdés | Választás |
|--------|-----------|
| Elhelyezés a roadmapen | **12. lépés** — a 011-difficulty-event-system után, a 013-stripe-fraud-defense előtt. A multiplayer az eseményrendszerre épül, de a Stripe-tól független. |
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

---

## ✅ Haladás (TODO)

> Jelölés: `[ ]` hátravan · `[~]` folyamatban · `[x]` kész.

**A. Firebase RTDB séma bővítése — barátok, chat, multiplayer session**
- [ ] RTDB új node-ok: `friends/{uid}/{friendUid}: true`, `friendRequests/{uid}/{fromUid}: { from, at, status }`, `chats/{chatId}: { participants, messages }`
- [ ] `users/{uid}/profile` bővítése: `+onlineStatus: string` (offline/online/játékban)
- [ ] `sessions/{sessionId}: { host, participants, status, createdAt }` — multiplayer session node
- [ ] `security.rules.json` frissítése: `friends`, `friendRequests`, `chats`, `sessions` node-ok írási/olvasási szabályai
- [ ] `security.rules.json` — `users/{uid}/failures` és `users/{uid}/successes` olvasási joga: csak a barátok (`friends/{requestUid}/{targetUid} === true`) számára engedélyezett
- [ ] `database.rules.json` regenerálása

**B. Barátlista — UI és logika**
- [ ] `src/components/screens/FriendsScreen.tsx` + `FriendsScreen.module.css` — **új GamePhase képernyő**
- [ ] `src/components/screens/FriendsScreen.tsx` — barátlista online státusszal
- [ ] `src/components/screens/FriendsScreen.tsx` — barátkereső (nickname, email, user ID)
- [ ] `src/components/screens/FriendsScreen.tsx` — friend request küldése
- [ ] `src/components/screens/FriendsScreen.tsx` — bejövő friend request-ek listája (elfogadás/elutasítás)
- [ ] `src/types/index.ts` — új GamePhase: `"friends"`; új típusok: `FriendRequest`, `FriendStatus`, `UserOnlineStatus`
- [ ] `src/components/routing/ScreenRouter.tsx` — `case "friends"` ág
- [ ] `src/components/screens/MainMenu.tsx` — „Barátok" gomb → `transitionTo("friends")`

**C. Privát chat — UI és logika**
- [ ] `src/components/features/ChatPanel.tsx` + `ChatPanel.module.css` — chat panel komponens
- [ ] `ChatPanel.tsx` — üzenet lista, időbélyeg, olvasatlan jelzés
- [ ] `ChatPanel.tsx` — üzenet küldése (RTDB push)
- [ ] `ChatPanel.tsx` — chat a Barátok menüben (teljes képernyős nézet)
- [ ] `ChatPanel.tsx` — chat játék közben (kisebb panel, jobb alsó sarok)
- [ ] RTDB listener: valós idejű üzenet frissítés
- [ ] Olvasatlan üzenet jelzés a Barátok gombon / barát listában

**D. Multiplayer session kezelés**
- [ ] `src/hooks/useMultiplayerSession.ts` — **új hook**: session létrehozás, csatlakozás, kilépés, host átadás
- [ ] `useMultiplayerSession.ts` — session state: `MultiplayerSession` interface + `useGameStore` bővítése
- [ ] Session létrehozás: host indít egy küldetést → `sessions/{sessionId}` létrehozása
- [ ] Meghívás: host barátot hív → RTDB notification / friend request alapú
- [ ] Csatlakozás: meghívott játékos elfogad → `sessions/{sessionId}/participants` frissítése
- [ ] Csatlakozás futó küldetéshez: host jóváhagyás szükséges
- [ ] Host átadás: ha host kilép, a rendszer a következő aktív résztvevőt jelöli ki
- [ ] Max 8 fő limit
- [ ] `useGameStore` bővítése: +`multiplayerSession: MultiplayerSession | null`, +`multiplayerParticipants: Participant[]`

**E. Figyelmi állapot multiplayerben**
- [ ] `src/hooks/useMultiplayerAttention.ts` — **új hook**: résztvevők figyelmi állapotának szinkronizálása
- [ ] Figyelmi állapot RTDB-be írása: `sessions/{sessionId}/participants/{uid}/attention: boolean`
- [ ] Figyelmi állapot olvasása: RTDB listener a többi résztvevő állapotára
- [ ] Csapatszintű figyelmi döntés: easy/medium = legalább egy figyel; hard = mindenki figyel
- [ ] Ha senki nem figyel: a meglévő `INACTIVITY_LIMIT_SECONDS` óra indul csapatszinten
- [ ] `src/components/features/MultiplayerStatusBar.tsx` + `MultiplayerStatusBar.module.css` — résztvevő lista a jobb felső sarokban, név + figyel/nem figyel ikonnal

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
- [ ] `friends.title` / `friends.back` / `friends.search` / `friends.searchPlaceholder`
- [ ] `friends.addFriend` / `friends.removeFriend` / `friends.friendRequestSent`
- [ ] `friends.pendingRequests` / `friends.accept` / `friends.reject`
- [ ] `friends.online` / `friends.offline` / `friends.inGame` / `friends.watching` / `friends.notWatching`
- [ ] `friends.noResults` / `friends.empty`
- [ ] `chat.title` / `chat.inputPlaceholder` / `chat.send` / `chat.unread`
- [ ] `multiplayer.invite` / `multiplayer.join` / `multiplayer.leave` / `multiplayer.host`
- [ ] `multiplayer.participants` / `multiplayer.maxReached`
- [ ] `multiplayer.eventToast.horn` / `.asteroid` / `.rescueTransfer` / `.solarFlare` / `.rover`
- [ ] `multiplayer.eventToast.timePenalty` / `.crewLost`
- [ ] `multiplayer.hostTransferred` / `multiplayer.sessionEnded`
- [ ] Teljes paritás mind az 5 fájlban

**I. Barát szégyenfala — read-only Wall of Shame megtekintése**
- [ ] `src/components/screens/FriendWallScreen.tsx` + `FriendWallScreen.module.css` — **új GamePhase képernyő**
- [ ] `FriendWallScreen.tsx` — meglévő WallOfShame komponens **újrahasználása** read-only módban
- [ ] `FriendWallScreen.tsx` — barát neve a headerben („{friendName} Wall of Shame")
- [ ] `src/types/index.ts` — új GamePhase: `"friendWall"`
- [ ] `firebase/userData.ts` — új `subscribeFriendFailures(uid, callback)` és `subscribeFriendSuccesses(uid, callback)` — ugyanaz, mint a meglévő subscribe, de barát uid-jével hívva
- [ ] `FriendsScreen.tsx` — barátra kattintva opció: „View Wall of Shame" → `transitionTo("friendWall")` + barát uid átadása
- [ ] `useGameStore` bővítése: +`friendWallTargetUid: string | null`, +`friendWallTargetName: string | null`
- [ ] `ScreenRouter.tsx` — `case "friendWall"` ág → `FriendWallScreen`
- [ ] Security rules: a `users/{uid}/failures` és `users/{uid}/successes` node-ok olvasása **csak barátok számára** engedélyezett
- [ ] i18n: `friendWall.*` kulcsok (lásd H blokk)

**J. Tesztek**
- [ ] `src/hooks/useMultiplayerSession.test.ts` — session létrehozás, csatlakozás, host átadás
- [ ] `src/hooks/useMultiplayerAttention.test.ts` — figyelmi állapot szinkron, csapatszintű döntés
- [ ] `src/hooks/useEventSystem.test.ts` — bővítés: multiplayer event kiosztás
- [ ] `tsc --noEmit` + `npm run test` + `npm run build` — zöld

**K. Dokumentáció**
- [ ] `security.rules.json` frissítése: új node-ok (friends, friendRequests, chats, sessions)
- [ ] `.claude/lessons-learned.md` — bejegyzés a multiplayer architektúráról
- [ ] `.claude/references/architecture-current.md` frissítése

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
      }
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
              ChatPanel       „View Wall of Shame" ──► FriendWallScreen
              (teljes           (read-only, élő RTDB    (GamePhase: "friendWall")
               képernyő)        subscription)               │
                                                      ┌─────┴──────┐
                                                      ▼            ▼
                                                 Failures     Successes
                                                 (sírkövek)   (trófeák)

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

---

## 2. Fájlstruktúra

### Új fájlok
```
src/components/screens/FriendsScreen.tsx          # Barátok képernyő
src/components/screens/FriendsScreen.module.css
src/components/screens/FriendWallScreen.tsx       # Barát szégyenfala (read-only)
src/components/screens/FriendWallScreen.module.css
src/components/features/ChatPanel.tsx             # Privát chat panel
src/components/features/ChatPanel.module.css
src/components/features/MultiplayerStatusBar.tsx  # Résztvevő lista játék közben
src/components/features/MultiplayerStatusBar.module.css
src/components/features/EventToast.tsx            # Nem blokkoló event értesítés
src/components/features/EventToast.module.css
src/hooks/useMultiplayerSession.ts                # Session kezelés
src/hooks/useMultiplayerAttention.ts              # Figyelmi állapot szinkron
```

### Módosuló fájlok
```
src/types/index.ts                                # +GamePhase "friends", "friendWall", +MultiplayerSession, +FriendRequest, +UserOnlineStatus
src/state/useGameStore.ts                         # +multiplayerSession, +multiplayerParticipants, +friendWallTargetUid, +friendWallTargetName
src/components/routing/ScreenRouter.tsx           # +"friends", +"friendWall" case
src/components/screens/MainMenu.tsx               # "Barátok" gomb
src/components/screens/FriendsScreen.tsx          # +"View Wall of Shame" gomb → transitionTo("friendWall")
src/components/screens/WallOfShame.tsx            # +read-only mód paraméter (opcionális, újrahasználható)
src/hooks/useEventSystem.ts                       # Multiplayer event kiosztás
src/components/features/EventModal.tsx             # Multiplayer-aware (opcionális)
src/components/features/Dashboard.tsx              # MultiplayerStatusBar integráció
src/App.tsx                                        # FriendsScreen + FriendWallScreen routing
src/firebase/userData.ts                          # +subscribeFriendFailures(), +subscribeFriendSuccesses()
security.rules.json                                # Új node-ok + friend-only olvasás failures/successes
database.rules.json                                # Regenerálva
src/i18n/locales/{en,hu,fr,de,es}/translation.json  # 35+ új kulcs
```

---

## 3. Függőségek

- **Előfeltétel:** [[011-difficulty-event-system]] — a multiplayer event kiosztás a 011 eseményrendszerét használja; a 011-es EventModal és useEventSystem az alap
- **Előfeltétel:** [[010-firebase-guest-merge-single-gate]] — a barátlista és chat Firebase RTDB-t használ; a guest→fiók merge kapu nélkül a barátok azonosítása instabil lenne
- **Előfeltétel:** [[003-firebase-auth-settings]] — Firebase Auth kell a felhasználók azonosításához
- **Független:** Stripe-tervektől (013, 014) — a multiplayer nem érint fizetést
- **Érinti:** [[007-state-persist-page-refresh]] — session állapot nem perzisztálódik (újracsatlakozás kell)
- **Érinti:** [[009-firebase-identity-split-bugfix]] — a rtdbKey/uid invariáns biztosítja, hogy a barátok és chat a helyes user node-okhoz kapcsolódnak

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

---

## 6. Kész definíció

- A **Főmenüben** elérhető a **Barátok** képernyő, ahol a játékos láthatja a barátlistáját online státusszal, kereshet más játékosokat (nickname, email, user ID), küldhet és fogadhat barátkéréseket.
- **Privát chat** elérhető a Barátok menüben (teljes képernyő) és játék közben (kis panel, jobb alsó sarok). Az üzenetek valós időben szinkronizálódnak az RTDB-n keresztül.
- **Multiplayer session:** host indít egy küldetést, meghívhat barátokat (max 8 fő). A meghívott játékos elfogadás után csatlakozik. Futó küldetéshez is lehet csatlakozni host jóváhagyással. Ha a host kilép, a rendszer átadja a host szerepet.
- **Figyelmi állapot:** játék közben a jobb felső sarokban látszik a résztvevők neve és figyelmi állapota (figyel / nem figyel). Easy/Medium módban elég ha legalább egy ember figyel; Hard módban mindenkinek figyelnie kell.
- **Események multiplayerben:** a 011-es terv eventjei multiplayer módban csak egy (figyelő) játékost érintenek közvetlenül; a többiek toast értesítést kapnak. Ha az érintett nem reagál időben, a teljes csapat büntetést kap.
- **Jutalom:** a küldetés végén a jutalom felosztásra kerül a résztvevők között. Csak az kap, aki a végén online van. Ha a csapat elbukik, mindenki veszít.
- **Firebase struktúra:** `friends`, `friendRequests`, `chats`, `sessions` új node-ok a megfelelő security rules-szal.
- **Barát szégyenfala:** a FriendsScreen-en a barátra kattintva elérhető a `FriendWallScreen` (GamePhase: `"friendWall"`), amely a meglévő `WallOfShame` komponenst használja újra read-only módban. A barát neve a headerben jelenik meg („{name} Szégyenfala"). A rekordok élő RTDB subscription-nel szinkronizálódnak.
- **Security:** a `users/{uid}/failures` és `users/{uid}/successes` node-ok olvasása csak barátok számára engedélyezett a security rules-ban.
- i18n: mind az 5 nyelven teljes paritás (35+ új kulcs)
- `npm run test` + `npm run build` + `tsc --noEmit` — zöld
