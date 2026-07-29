---
title: "Social és multiplayer – barátok, chat, közös küldetések"
slug: 013-social-multiplayer
type: plan
category: core
status: in-progress
implemented: false
implemented_at: null
created_at: "2026-07-27"
updated_at: "2026-07-29"  # frissítve: a vendég-tájékoztató toastból jön ([[015-toast-notification]] H. blokk); +related_plans: [[018-notification-retention]]
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
  - 018-notification-retention
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

## Tünet és lezárt diagnózis — a P.–W. blokk kiváltó esete (2026-07-29)

> Ez a szekció a **P.–W. blokk** (kötelező regisztráció a social funkciókhoz) kiváltó okát rögzíti. Élő RTDB adaton megerősítve, Admin olvasással.

### A tünet

Az `UVJYm6vwZrZOT0PWiOskN55Lxbr1` uid szerepel a `friends/` és a `friendRequests/` node-okban, de **nincs `users/UVJYm…` bejegyzés**. Első ránézésre „szellem-user".

### A diagnózis — LEZÁRVA

| Kérdés | Válasz | Bizonyíték |
|---|---|---|
| Ki ez a user? | **Anonim (vendég)** | `friendRequests/SvVrrs9TRhRL52g1MieUlVCZDZR2/UVJYm…` → `fromNickname: "star_wanderer_1462"`. A `star_wanderer` az `ANON_NICKNAMES` tömb eleme (`src/firebase/userData.ts:16`), és a `generateRandomNickname()` kimenetét **kizárólag anonim userek** kapják. |
| Rules-exploit történt? | **NEM.** | A friend request `at: 1785258258122` = **2026-07-28 19:04** helyi idő. A guest-gate (`guardedNav` / `isGuest`, `src/components/screens/MainMenu.tsx:84-87`) a **b96993f** commitban, **2026-07-29 08:26**-kor jött létre — `git log -S'guardedNav'` szerint ez az **egyetlen** commit, ami bevezette. A vendég tehát **13 órával a kapu megépítése ELŐTT**, teljesen legitim módon küldött barátkérést: akkor a FriendsScreen még nyitva állt neki. |
| Elveszett adat? | **Nem.** | A user node megvan, csak a **kulcshasadás** miatt máshol: `device_map/473bff95-82c2-4384-abe6-789f408f1219 → UVJYm…`, és a `users/473bff95-82c2-4384-abe6-789f408f1219` létezik (`profile.nickname = "star_wanderer_1462"`). |
| Miért nincs `usersPublic/UVJYm…`? | Mert az írás **némán megtagadva** | `updateUserPublicProfile(rtdbKey, …)` anonim usernél `usersPublic/{deviceId}`-re ír, amit a `"usersPublic": { "$uid": { ".write": "auth != null && $uid == auth.uid" } }` (`database.rules.json:9-14`) **MEGTAGAD**; a hibát a `.catch(console.error)` elnyeli. Írási call site-ok: `src/firebase/authBootstrap.ts:178`, `src/App.tsx:221`, `src/components/screens/SettingsScreen.tsx:78`. |

> ⚠️ **Ezt expliciten rögzítjük, hogy egy későbbi olvasó ne induljon rossz irányba:** a szennyezett adat **nem** biztonsági rés kihasználásából származik. A T. blokkban leírt rules-lyukak **valósak és függetlenek** — de nem ezek okozták ezt a konkrét esetet.

### A hibaosztály — a [[009-firebase-identity-split-bugfix]] másik fele

A 009 a **`users/`** node-ra számolta fel a kulcshasadást: bevezette a `selectRtdbKey` / `getRtdbKey` derivált selectort (`src/state/useAuthStore.ts:48-52` — `user && !user.isAnonymous ? user.uid : deviceId`). A **social/publikus rétegben a hasadás ma is él**, mert két kulcs fut párhuzamosan:

```
rtdbKey   (anonimnál deviceId)  →  users/ , usersPublic/ , walls/
authUid   (mindig auth.uid)     →  friends/ , friendRequests/ , outgoingRequests/ ,
                                   notifications/ , chats/
```

**Élő következmény:** a vendégnek **egyáltalán nincs `usersPublic` sora** → sem a névkereső (`searchUsersPublic`), sem a UID-lookup (`lookupUserByUid`) nem találja meg, a `subscribeUserOnlineStatus` pedig örökre `offline`-t lát. Ugyanez a hasadás áll az `updateOnlineStatus(rtdbKey, …)`-ra és — más előjellel — a `walls/{rtdbKey}`-re (`saveFailureRecord` / `saveSuccessRecord`).

> 💡 **Fontos, hogy ne „javítsuk el":** ma a vendég **azért** láthatatlan, mert egy írás némán megbukik. A követelmény (a vendég **legyen** láthatatlan) véletlenül teljesül. A javítás iránya ezért **nem** az, hogy a `usersPublic` írását átállítjuk `authUid`-re — az pont **láthatóvá tenné** a vendégeket —, hanem az, hogy vendégnél **meg se kíséreljük** az írást (R. blokk).

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
| Vendég visszajelzése | A Barátok gomb **🔒 prefixet** kap; kattintásra **nem navigál**, hanem tájékoztató üzenetet mutat, ugyanez a szöveg a gomb `title` tooltipjében. **2026-07-29 óta** az üzenet **warning toast** a bal felső sarokban, nem beágyazott bekezdés ([[015-toast-notification]] H. blokk) |
| Perzisztált social fázis vendégnél | A `ScreenRouter` **visszairányít** a főmenübe (`friends` / `chat` / `friendWall`) |
| `status === "loading"` kezelése | **NEM** számít vendégnek — különben az auth aszinkron feloldódása előtt a `ScreenRouter` kidobná a bejelentkezett játékost is oldalfrissítéskor |
| **Vendég láthatósága** (2026-07-29, P. blokk) | **Egyáltalán nem látható.** A vendég nem jelenik meg a keresőben, nem található UID-lookuppal, nincs jelenlét-státusza — nincs `usersPublic` sora |
| **Ki barátkozhat / chatelhet** (2026-07-29) | **Kizárólag regisztrált (nem-anonim) user.** Barátkérés küldése/elfogadása és chat üzenet küldése egyaránt fiókhoz kötött |
| **A kikényszerítés szintje** (2026-07-29) | **Rules szinten IS**, nem csak UI-gate-tel. A mai védelem kizárólag a `MainMenu` `guardedNav`-ja — egy közvetlen RTDB írás (DevTools konzol, saját kliens) megkerüli |
| **Szerveroldali vendég-detektálás** (2026-07-29) | `auth.token.firebase.sign_in_provider` — az egyetlen szerveroldali mód. A feltétel **negatív** (`!= 'anonymous'`), nem `== 'google.com'`, hogy egy jövőbeli email/jelszó vagy Apple provider ne essen ki. ⚠️ Nyitott kérdés: `linkWithPopup` utáni token-viselkedés — 8.3 |
| **`users/{deviceId}` vendég-node sorsa** (2026-07-29) | **MARAD.** Device-hoz kötött játékadat (settings, inventory, wallet, stats) — ez nem social adat, és a [[010-firebase-guest-merge-single-gate]] merge-kapuja épül rá |
| **`walls/{rtdbKey}` vendégnél** (2026-07-29, R. blokk) | **Marad `deviceId` alatt.** Indok: a vendég senkinek nem látható → a falának nincs olvasóközönsége; a `collectGuestWallUpdates` (`userData.ts:529-549`) linkeléskor `walls/{deviceId}` → `walls/{targetUid}` alá viszi. Ha `authUid`-re állnánk át, az anonim uid alá írt rekordokat a migráció **nem találná meg** → adatvesztés |
| **Elhelyezés** (2026-07-29) | **A 013-ba beolvasztva**, P.–W. blokként. Nem külön terv: ugyanaz a hatókör (social hozzáférés-vezérlés), és a meglévő O. blokk közvetlen folytatása |
| **Rules-tesztek** (2026-07-29, U. blokk) | **Kötelező.** `@firebase/rules-unit-testing` + RTDB emulátor. Indok: a social hívások fele `.catch(console.error)`-ral el van nyelve → egy elrontott feltétel **némán** megölné a teljes friend flow-t |

---

## ✅ Haladás (TODO — 93/207 kész)

> Jelölés: `[ ]` hátravan · `[~]` folyamatban · `[x]` kész.
> **Új blokkok (2026-07-29):** **P.–W.** — kötelező regisztráció a social funkciókhoz, **rules szinten is** kikényszerítve (86 új tétel). Kiváltó eset és diagnózis: a „Tünet és lezárt diagnózis" szekció; részletek: 8. szekció; kézi takarítás: 9. szekció.
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
- [x] `friends.guestNotice` (2026-07-28, O. blokk) — vendég tájékoztató a főmenüben (gomb `title` tooltip + tájékoztató üzenet; **2026-07-29 óta** warning toast — [[015-toast-notification]] H. blokk). A kulcs maga változatlan.
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

> ℹ️ **Frissítve (2026-07-29):** a vendég-tájékoztató **megjelenítése** megváltozott — a gombok alatti beágyazott bekezdés helyett **warning toast** a bal felső sarokban. Kanonikus leírás: [[015-toast-notification]] H. blokk / 0.9. A 🔒 prefix, a `title` tooltip, a `friends.guestNotice` kulcs és a `ScreenRouter` vendég-őre **változatlan**.

- [x] **Indok:** a barát-gráf (`friends/{uid}`), a chat (`chats/{chatId}/participants`) és a barát-fal grant mind a **Google auth uid**-ra kulcsol. Anonim uid-re ezek nem építhetők — a vendég számára a képernyők üresek vagy `PERMISSION_DENIED`-esek lennének.
- [x] **Vendég definíció:** `!authUser || authUser.isAnonymous` (kijelentkezett **vagy** anonim)
- [x] `MainMenu.tsx` — a Barátok gomb **🔒 prefixet** kap vendégnél
- [x] `MainMenu.tsx` — kattintás vendégként **nem navigál**, hanem tájékoztató üzenetet mutat — **2026-07-29 óta** `addToast("warning", t("friends.guestNotice"), GUEST_NOTICE_DURATION_MS)` (korábban `<p role="status">` a gombok alatt, `guestNoticeKey: string | null` state-tel — a state azóta megszűnt)
- [x] `MainMenu.tsx` — ugyanaz a szöveg a gomb `title` tooltipjében
- [x] `MainMenu.module.css` — `.guestNotice` stílus. ⚠️ **Elavult:** az osztály 2026-07-29-én **törölve**, mert a tájékoztató toastként jelenik meg ([[015-toast-notification]] H. blokk)
- [x] A tájékoztató magától eltűnik (toast auto-dismiss, 7000 ms — a kétmondatos szöveg miatt hosszabb az 5 mp-es alapértelmezésnél). A korábbi „bejelentkezéskor tüntesd el" `useEffect(isGuest)` **megszűnt**
- [x] Vendégnél a hozzászólás-számláló **RTDB listenerek el sem indulnak** (`subscribeFriends` / `subscribeUnreadCount` — nincs értelme, és felesleges kapcsolat)
- [x] `ScreenRouter.tsx` — védelem a **perzisztált fázisra**: ha a `friends` / `chat` / `friendWall` fázisban vendég a user → `transitionTo("mainMenu")` + `<MainMenu />` render
- [x] `ScreenRouter.tsx` — a `status === "loading"` **NEM** számít vendégnek: `authStatus !== "loading" && (!authUser || authUser.isAnonymous)` — enélkül az auth aszinkron feloldódása előtt a bejelentkezett játékost is kidobná oldalfrissítéskor
- [x] i18n: új `friends.guestNotice` kulcs **mind az 5 nyelven**
- [x] Ellenőrzés: `tsc --noEmit` tiszta · `npm run test` **77/77** zöld · `npm run build` sikeres
- [x] **Kiterjesztés a `shop` fázisra** ([[002-ingame-shop-frontend]] F rész, 2026-07-28): ugyanez a kétrétegű minta védi az áruházat is (a vásárlásnak túl kell élnie egy eldobható vendég-sessiont). Ekkor lett a `MainMenu` `showGuestNotice: boolean` state-je `guestNoticeKey: string | null` (két különböző üzenet), és született a közös **`guardedNav(phase, noticeKey)`** helper; a `ScreenRouter`-ben a `isSocialPhase` → **`needsAccount`** (`friends | chat | friendWall | shop`), a `blockSocial` → **`blockPhase`**. *(2026-07-29: a `guestNoticeKey` state megszűnt — a `guardedNav` a kulcsot közvetlenül az `addToast`-nak adja át; a `guardedNav` és a `needsAccount` lista változatlan.)*

**P. Rules-szintű vendég-tiltás — a mag (2026-07-29)**

> Az O. blokk **UI-gate**-et épített. Ez a blokk ugyanazt a szabályt **szerveroldalon** kényszeríti ki. A kettő nem alternatíva: a UI-gate a felhasználói élményért van (érthető üzenet), a rules a valódi határ.

- [ ] `security.rules.json` — a nem-anonim feltétel **egységes megfogalmazása** és dokumentálása: `auth != null && auth.token.firebase.sign_in_provider != 'anonymous'`
- [ ] **Negatív teszt, nem pozitív:** `!= 'anonymous'` és **nem** `== 'google.com'` — így egy jövőbeli email/jelszó, Apple vagy OIDC provider nem esik ki némán (a `sign_in_provider` értéke Google-nél `"google.com"`, **nem** `"google"`)
- [ ] `usersPublic/$uid` `.write` — kiegészítés a nem-anonim feltétellel → **a vendégnek nem lehet publikus sora** (nem kereshető, nincs jelenléte)
- [ ] `friends/$uid` `.write` — mindhárom ág kiegészítve a nem-anonim feltétellel
- [ ] `friendRequests/$uid/$fromUid` `.write` — nem-anonim feltétel (a gyerek-szintű átalakítás a T. blokkban)
- [ ] `outgoingRequests/$uid/$toUid` `.write` — nem-anonim feltétel
- [ ] `chats/$chatId/participants` `.write` — nem-anonim
- [ ] `chats/$chatId/messages/$msgId` `.write` — nem-anonim (a meglévő `newData.child('from').val() === auth.uid` **mellé**, nem helyette)
- [ ] `chats/$chatId/unread/$uid` `.write` + `typing/$uid` `.write` — nem-anonim (különben egy vendég számlálót írhatna egy idegen chatben)
- [ ] `notifications/$uid/$notificationId` **peer-push ága** — nem-anonim. A tulajdonos saját `.read`/`.write`-ja (mark-read, törlés) **változatlan**: a vendég inboxa amúgy is üres marad, és a szigorítás csak regressziót okozna
- [ ] **Döntés rögzítve:** a `.read` szabályokat **nem** szigorítjuk vendégre. A `friends/$uid` / `friendRequests/$uid` olvasás már ma is `$uid == auth.uid`-hez kötött → a vendég csak a saját, garantáltan üres listáját látja. Egy `.read` szigorítás csak `PERMISSION_DENIED` zajt szülne a listenerekben
- [ ] `database.rules.json` regenerálása a `security.rules.json`-ból (W. blokk) + **deploy** (a szabály deploy nélkül nem hat)
- [ ] A `sign_in_provider` mezőnév, értékkészlet és a linkelés utáni viselkedés **emulátoros teszttel igazolva** (U. blokk) — a terv egésze ezen áll

**Q. `linkWithPopup` és a token `sign_in_provider` — a bővítés legkockázatosabb pontja (2026-07-29)**

> Részletes elemzés és a nyitott kérdés: **8.3**. Ez a blokk addig **nem indítható**, amíg a 8.3 kérdését emulátoros méréssel el nem döntöttük.

- [ ] **Mérés először:** emulátorban `linkWithPopup` (ill. `linkWithCredential`) anonim sessionre → a linkelés utáni ID token `firebase.sign_in_provider` értékének **rögzítése** (marad `"anonymous"`, vagy `"google.com"` lesz?)
- [ ] **Mérés:** `getIdToken(true)` force-refresh után **változik-e** a claim (a refresh-token csere valószínűleg **átörökíti** az eredeti `sign_in_provider`-t → önmagában nem elég)
- [ ] `src/firebase/auth.ts` — +`getSignInProvider(user): Promise<string | null>` (`user.getIdTokenResult()` → `signInProvider`) — **kliensoldali** előrejelzés a rules döntéséről
- [ ] `src/firebase/auth.ts` — +`isRegisteredToken(user): Promise<boolean>` (`provider !== "anonymous"`)
- [ ] `startGoogleAuth` (`src/firebase/auth.ts:36-38`) — a `linkWithPopup` **sikere után azonnal** `signInWithCredential(auth, GoogleAuthProvider.credentialFromResult(cred))` → **friss sign-in event**, a uid **megmarad** (a credential ekkor már ehhez a fiókhoz van linkelve)
- [ ] `checkRedirectResult` — ugyanez a `linkWithRedirect` visszatérési ágára (`auth.ts:77-88`)
- [ ] `useAuthStore` — +`tokenRegistered: boolean | null` (`null` = még nem mértük). **Derivált értékként**, ha lehet — a [[009-firebase-identity-split-bugfix]] 2.1 tanulsága szerint az írható duplikált state divergál
- [ ] `authBootstrap` — belépéskor `isRegisteredToken(user)` kiértékelése és a store-ba írása
- [ ] **Átmeneti (legacy) userek kezelése:** ha `!user.isAnonymous`, de `tokenRegistered === false` → warning toast + „jelentkezz be újra" felajánlása. Enélkül egy régebben linkelt, perzisztált sessionű user **némán** kizáródna a saját friend/chat írásaiból
- [ ] `ScreenRouter` `isGuest` / `MainMenu` `isGuest` — döntés: bevonjuk-e a `tokenRegistered`-et a vendég-definícióba (**javaslat: igen**, de csak `false` esetén — `null` (még nem mért) ne blokkoljon, ugyanaz a hibaosztály, mint a `status === "loading"` az O. blokkban)
- [ ] Regressziós ellenőrzés: a **közvetlen** `signInWithPopup` (nem linkelt) útvonal `sign_in_provider`-e `"google.com"` — nem törik el

**R. Kulcshasadás felszámolása a publikus/social rétegben (2026-07-29)**

> Cél: egyetlen írás se célozza a `usersPublic`-ot `deviceId`-vel. **Nem** a kulcs átírásával — hanem azzal, hogy vendégnél az írás **el sem indul**.

- [ ] `src/firebase/authBootstrap.ts:176-178` — `updateUserPublicProfile(rtdbKey, …)` → **kihagyva**, ha `user.isAnonymous`
- [ ] `src/App.tsx:218-227` — ugyanez a `handleUserData` nickname-szinkron ágban
- [ ] `src/components/screens/SettingsScreen.tsx:78` — ugyanez a nickname mentés ágban
- [ ] `src/firebase/authBootstrap.ts:165` — `updateOnlineStatus(rtdbKey, "online")` → vendégnél kihagyva
- [ ] `src/firebase/authBootstrap.ts:169-171` — az `onDisconnect(usersPublic/{rtdbKey}/onlineStatus)` regisztráció → vendégnél kihagyva
- [ ] `src/App.tsx:649`, `:660`, `:666` — a gamePhase-watcher `updateOnlineStatus` hívásai → vendégnél kihagyva
- [ ] `src/components/screens/SettingsScreen.tsx:184` — a kijelentkezés előtti `updateOnlineStatus(authUid, "offline")` **marad** (regisztrált user írja a saját sorát)
- [ ] **Egy kapu, egy helyen:** a fenti hét call site ne külön-külön `if`-eljen. `userData.ts` — a `updateUserPublicProfile` / `updateOnlineStatus` **maga** dobja el a hívást, ha az aktuális auth user anonim (`getRtdbKey()` mintájára egy `isRegisteredUser()` helperrel), vagy egy közös `withRegisteredUser(fn)` wrapperrel
- [ ] **Paraméter-átnevezés** a szándék rögzítéséhez: `updateUserPublicProfile(uid, …)` / `updateOnlineStatus(uid, …)` paramétere **`authUid`**, nem `rtdbKey` — a hívók ezt adják át (regisztrált usernél a 009 invariánsa szerint a kettő azonos)
- [ ] `walls/` — **NEM változik:** marad `rtdbKey` (indoklás a döntési táblázatban és a 1.9-ben). A `saveFailureRecord` / `saveSuccessRecord` call site-ok (`App.tsx:122`, `:429`, `:708`, `WallOfShame.tsx:381`, `:411`) érintetlenek
- [ ] `collectGuestWallUpdates` (`userData.ts:529-549`) — regressziós ellenőrzés: a `walls/{deviceId}` → `walls/{targetUid}` migráció linkelés után **továbbra is** működik (U. blokk teszt)
- [ ] **Néma hibaelnyelés felszámolása:** ahol egy `.catch(console.error)` egy **rules-megtagadást** rejt el, ott a hívás vagy el sem indul (a fenti kapu), vagy a hiba **felszínre kerül**. A `.catch(console.error)` csak ott maradhat, ahol a hiba tényleg nem-fatális (pl. `sendNotification`)

**S. UI-gate megerősítése — minden belépési pont (2026-07-29)**

- [ ] **Belépési pontok felderítése és rögzítése** a `friends` / `chat` / `friendWall` fázisokba (a teljes lista: 1.10)
- [ ] `MainMenu.tsx:84-87` `guardedNav` — **marad**, ez az egyetlen menüből induló út
- [ ] `FriendsScreen.tsx:324-330` `openChat` — a `chat` fázisba innen is lehet lépni; a `FriendsScreen` maga viszont már csak regisztrált usernek renderelődik (ScreenRouter őr) → **elegendő**, de rögzítendő
- [ ] `ChatScreen.tsx:29`, `:68` és `ScreenRouter.tsx:109` — vissza-navigáció a `friends`-be; ezek **nem** új belépési pontok, mert a `blockPhase` őr a render előtt lefut
- [ ] Toast / notification útvonalak (`useNotificationListener`, `useFriendPresenceToasts`) — ellenőrizve: **nem navigálnak** (csak megjelenítenek). Ha később kattintható toast készül, az **guardedNav-on** keresztül menjen
- [ ] `ScreenRouter` `needsAccount` lista — változatlan (`friends | chat | friendWall | shop`), de a Q. blokk `tokenRegistered === false` esete bekerül az `isGuest`-be
- [ ] **Kliens oldali őr a művelet előtt** (`sendFriendRequest`, `acceptFriendRequest`, `sendMessage`): ha a user nem regisztrált (vagy `tokenRegistered === false`), a hívás **el se induljon**, hanem **warning toast** jelenjen meg — a `friends.guestNotice` kulcs újrahasznosításával
- [ ] A rules-elutasítás ne legyen néma: a `sendMessage` / `sendFriendRequest` hibaága **error toastot** kapjon (ma `console.error`-ral végződik)

**T. Rules szigorítás — gyerek-szintű `.write` (FÜGGETLEN lyuk, 2026-07-29)**

> ⚠️ **Ez a blokk NEM a fenti eset oka.** Kódolvasással megerősített, valós rés, ami ugyanabban a fájlban javítandó — de a `UVJYm…` barátság legitim úton keletkezett (lásd Tünet-szekció). A kettőt **ne mossuk össze**.

- [ ] **Lyuk 1 — hamisított inbox:** `friendRequests/$uid` `.write` első ága `$uid == auth.uid` (`database.rules.json:30`) → **bárki bármit** beírhat a saját inboxába, tetszőleges `fromUid` kulccsal
- [ ] **Lyuk 2 — az 1-re épülő privilégium-eszkaláció:** a hamis inbox-bejegyzés feljogosítja a `friends/$uid` `.write` `root.child('friendRequests').child(auth.uid).child($uid).exists()` ágát (`database.rules.json:18`) → **egyoldalúan** beírhatja magát bárki barátlistájába (és így megnyílik a `walls/$uid` barát-olvasás is)
- [ ] **Lyuk 3 — barátlista-törlés:** a `friends/$uid` és `outgoingRequests/$uid` `.write` **szülő-szinten** szól → `set(ref('friends/{áldozat}'), { saját_uid: true })` **LETÖRLI** az áldozat teljes barátlistáját
- [ ] `friendRequests/$uid/$fromUid` — `.write` **gyerek-szintre** költöztetve; a szülő szintű `.write` **megszűnik**
- [ ] `friendRequests/$uid/$fromUid` — `.validate`: `newData.child('from').val() === $fromUid` (a payload nem hazudhat a küldőről)
- [ ] `friendRequests/$uid/$fromUid` — a **tulajdonos** (`$uid == auth.uid`) csak **MEGLÉVŐT** módosíthat vagy törölhet: `data.exists() || !newData.exists()` — újat **nem gyárthat**
- [ ] `friendRequests/$uid/$fromUid` — a **küldő** (`$fromUid == auth.uid`) csak akkor írhat, ha az bejegyzés még **nem létezik** (`!data.exists()`), és nem-anonim (P. blokk)
- [ ] `friends/$uid/$friendUid` — `.write` gyerek-szintre; a szülő szintű `.write` megszűnik → egyetlen `set()` sem söpörheti el a listát
- [ ] `friends/$uid/$friendUid` — a három engedélyezett eset gyerek-szinten: (a) tulajdonos ír/töröl; (b) elfogadó beírja magát (`$friendUid == auth.uid` **és** létező friend request); (c) **barát-eltávolítás a másik oldalon**: `$friendUid == auth.uid && data.exists() && !newData.exists()`
- [ ] **(c) kritikus:** a `removeFriend` (`userData.ts:1091-1102`) akkor is működjön, amikor a friend request **már rég nem létezik** — a mai harmadik ág (`data.child(auth.uid).val() === true && newData.child(auth.uid).val() === null`, `database.rules.json:18`) gyerek-szintű megfelelője
- [ ] `outgoingRequests/$uid/$toUid` — `.write` gyerek-szintre, ugyanezzel a mintával (tulajdonos + a kérés címzettje törölheti accept/reject során)
- [ ] **Regressziós csapda átvezetése:** az `acceptFriendRequest` (`userData.ts:1053-1058`) és a `rejectFriendRequest` (`:1079-1082`) **root multi-path update**-et használ — **egy** elbukó path az **EGÉSZ** írást megbuktatja. A 8.6 táblázat path-onként végigvezeti mind a négy/két útvonalat az új szabályok ellen
- [ ] `sendFriendRequest` (`userData.ts:1015-1027`) — ugyanez a path-onkénti átvezetés (2 path)
- [ ] `removeFriend` (`userData.ts:1098-1101`) — ugyanez (2 path, mindkettő törlés)
- [ ] `database.rules.json` regenerálás + deploy; a T. blokk **nem** deployolható az U. blokk tesztjei nélkül

**U. Rules-tesztek — emulátor + `@firebase/rules-unit-testing` (2026-07-29)**

> A projektben **ma nincs security-rules teszt**. Szigorított szabályokat vakon deployolni azért kockázatos, mert a social hívások fele `.catch(console.error)`-ral el van nyelve → egy elrontott feltétel **némán** megölné a friend flow-t (ugyanaz a hibaosztály, mint az N. blokk „nincs még üzenet" tünete).

- [ ] `package.json` — +`@firebase/rules-unit-testing` devDependency, +`firebase-tools` (dev), +`test:rules` script
- [ ] `firebase.json` — +`emulators` blokk (`database` port, `singleProjectMode`)
- [ ] **Külön vitest projekt/konfig** a rules-teszteknek: `environment: "node"` (a fő konfig `jsdom` + `src/test/setup.ts`, ami itt nem kell), és a rules-teszt **ne** fusson a sima `npm run test`-ben emulátor nélkül
- [ ] `src/test/rules/setup.ts` — `initializeTestEnvironment({ database: { rules: readFileSync("database.rules.json") } })`, `authenticatedContext(uid, { firebase: { sign_in_provider: "google.com" } })` és `…{ sign_in_provider: "anonymous" }` helperek
- [ ] `src/test/rules/guestGate.rules.test.ts` — vendég-tiltás (a 8.7 táblázat 1–8. esete)
- [ ] `src/test/rules/friendGraph.rules.test.ts` — támadási minták (8.7 / 9–13.)
- [ ] `src/test/rules/friendFlow.rules.test.ts` — legitim flow-k, **path-onként és teljes multi-path update-ként is** (8.7 / 14–22.)
- [ ] `src/test/rules/linkedToken.rules.test.ts` — a Q. blokk mérése: linkelés utáni első írás (8.7 / 23–24.)
- [ ] **Az emulátor a `database.rules.json`-t olvassa** (a deployolt fájlt), nem a `security.rules.json`-t → a W. blokk szinkronja a teszt **előfeltétele**
- [ ] CI/README jegyzet: a rules-teszt futtatásához emulátor kell; emulátor nélkül **skip**, nem hamis zöld

**V. Egyszeri kézi adattakarítás — pre-gate vendég-barátságok (2026-07-29)**

> Konkrét checklist: **9. szekció**. A `SvVrrs9TRhRL52g1MieUlVCZDZR2` ↔ `UVJYm6vwZrZOT0PWiOskN55Lxbr1` barátság **zombi**: a gate óta `UVJYm…` soha nem tud belépni a Friends menübe.

- [ ] **Felderítés (általános ismérv):** minden `friends/{uid}/{friendUid}`, ahol a `friendUid`-hoz **nincs `usersPublic/{friendUid}` sor** → pre-gate vendég-barátság gyanús
- [ ] A gyanús uid megerősítése: `friendRequests/**/{uid}` `fromNickname`-je illeszkedik-e a `generateRandomNickname()` mintájára (`<ANON_NICKNAMES elem>_<4 számjegy>`), és van-e rá `device_map` bejegyzés
- [ ] Az érintett `friends/` bejegyzések törlése **mindkét** oldalon
- [ ] A hozzá tartozó `friendRequests/` és `outgoingRequests/` bejegyzések törlése
- [ ] A `chats/{chatId}` node törlése (`getChatId` rendezett `uid1_uid2` formátuma szerint, `userData.ts:1317-1319`)
- [ ] A kapcsolódó `notifications/` bejegyzések törlése ([[018-notification-retention]] hatóköre)
- [ ] **Export JSON minden törlés ELŐTT** (a 009 E. blokk mintájára)
- [ ] ⚠️ Rögzítendő: a `users/{deviceId}` vendég-node és a `walls/{deviceId}` fal **NEM törlendő** — az a játékos játékadata, és `linkWithPopup` után ugyanaz a uid **legitim regisztrált userré válhat**

**W. Dokumentáció és rules-fájl szinkron (2026-07-29)**

- [ ] ⚠️ **Felderített drift:** a `security.rules.json` és a `database.rules.json` **ma nincs szinkronban** — a `chats/$chatId/messages` (N. blokk javítása), a `walls/$uid/.read` és a `walls/$uid/{failures,successes}/.write` `device_map`-ága, valamint a `notifications` node **csak a `database.rules.json`-ban** van a helyes formájában. A `security.rules.json` a **dokumentált forrás**, tehát a drift visszairányú: **előbb vissza kell porolni**, csak utána szabad új szabályt írni
- [ ] `security.rules.json` — a `chats/$chatId/messages` szabály visszaportolása a deployolt (N. blokk szerinti) alakra
- [ ] `security.rules.json` — a `walls/$uid` `.read` és `.write` szabályok visszaportolása (a `device_map` ág)
- [ ] `security.rules.json` — a P./T. blokk új szabályai **kommentekkel** (miért `!= 'anonymous'`, miért gyerek-szintű `.write`)
- [ ] `security.rules.json` — RTDB séma-komment kiegészítése: `friends`, `friendRequests`, `outgoingRequests`, `chats`, `sessions`, `walls` (ma csak `users`, `device_map`, `notifications` szerepel)
- [ ] `database.rules.json` **regenerálása** a `security.rules.json`-ból a dokumentált one-linerrel (`security.rules.json:30-33`) — **kézi szerkesztés tilos**
- [ ] Deploy + a deployolt szabály visszaellenőrzése a Console-ban
- [ ] `.claude/lessons-learned.md` — bejegyzés: „a UI-gate nem hozzáférés-vezérlés"; és: „egy némán megbukó írás véletlenül teljesíthet egy követelményt — a javítás iránya ilyenkor nem a hiba elhárítása"
- [ ] `.claude/references/architecture-current.md` — a kétrétegű (UI + rules) vendég-kapu rögzítése

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
   guardedNav(phase, noticeKey) =
       isGuest ? () => addToast("warning", t(noticeKey), GUEST_NOTICE_DURATION_MS)
               : () => transitionTo(phase)
   Barátok gomb  →  🔒 prefix + title tooltip
                 →  kattintás: warning toast a bal felső sarokban   (NEM transitionTo("friends"))
                 →  GUEST_NOTICE_DURATION_MS = 7000 (kétmondatos üzenet), auto-dismiss
                 →  ismételt kattintás: addToast no-op, amíg ugyanaz a toast látható
   RTDB listenerek (subscribeFriends / subscribeUnreadCount) vendégnél EL SEM INDULNAK

   (2026-07-29 előtt: guestNoticeKey state + <p role="status"> a gombok alatt,
    .guestNotice CSS osztállyal — lásd [[015-toast-notification]] H. blokk / 0.9)

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

### 1.8 Vendég-őr — a HARMADIK réteg: rules (P. blokk, 2026-07-29)

Az 1.7 két rétege **kizárólag kliensoldali**. Egy DevTools konzolból kiadott `set(ref(db, 'friends/…'), …)` mindkettőt megkerüli. A harmadik réteg a valódi határ:

```
1. réteg — MainMenu guardedNav      →  UX: érthető üzenet, 🔒 prefix        (megelőzés)
2. réteg — ScreenRouter blockPhase  →  perzisztált fázis visszairányítása   (megelőzés)
3. réteg — RTDB security rules      →  auth.token.firebase.sign_in_provider (KIKÉNYSZERÍTÉS)
                                        != 'anonymous'
```

**A feltétel alakja — és miért negatív:**

```jsonc
// Egységes, minden érintett node .write-jában:
"auth != null && auth.token.firebase.sign_in_provider != 'anonymous'"
```

| Változat | Miért nem |
|---|---|
| `== 'google.com'` | Egy jövőbeli email/jelszó, Apple vagy OIDC provider **némán** kiesne. A követelmény „nem-anonim", nem „Google". |
| `== 'google'` | **Rossz érték.** A `sign_in_provider` Google-nél `"google.com"` — a provider ID, nem a rövid név. |
| `auth.provider != 'anonymous'` | Legacy (Firebase 2.x) mező; modern SDK-val nem megbízható. |
| Kliensoldali flag (`usersPublic/{uid}/registered: true`) | **Kör-hivatkozás:** a flag maga is kliens-írható → egy vendég beírhatná magának. Nem hozzáférés-vezérlés. |

**Melyik node kap gate-et:**

| Node | `.write` gate | `.read` gate | Indok |
|---|---|---|---|
| `usersPublic/$uid` | ✅ nem-anonim | — (marad `auth != null`) | **Ez a láthatóság kapcsolója.** Nincs sor → nincs keresőtalálat, nincs UID-lookup, nincs jelenlét |
| `friends/$uid/$friendUid` | ✅ | — (`$uid == auth.uid`) | Barátkozás fiókhoz kötött |
| `friendRequests/$uid/$fromUid` | ✅ | — (`$uid == auth.uid`) | Barátkérés fiókhoz kötött |
| `outgoingRequests/$uid/$toUid` | ✅ | — | Ugyanaz, küldő oldalon |
| `chats/$chatId/{participants,messages,unread,typing}` | ✅ | — (résztvevőkre szűkítve, N. blokk) | Chat üzenet küldése fiókhoz kötött |
| `notifications/$uid/$notificationId` (**peer-push ág**) | ✅ | — | Vendég ne tudjon toastot küldeni idegen inboxba |
| `notifications/$uid` (**tulajdonos ág**) | ❌ változatlan | ❌ változatlan | A vendég inboxa üres; a szigorítás csak regressziót okozna (mark-read, törlés) |
| `walls/$uid` | ❌ változatlan | ❌ változatlan | Lásd 1.9 |
| `users/$key`, `device_map` | ❌ változatlan | ❌ változatlan | Device-hoz kötött játékadat — nem social |

### 1.9 Két kulcs, két irány — miért NEM egységesítünk mindent `authUid`-re (R. blokk)

```
                     ┌──────────────────────────────────────────────┐
rtdbKey              │  users/{rtdbKey}      device-hez kötött       │
(anon: deviceId)     │  walls/{rtdbKey}      játékadat  →  MARAD     │
                     └──────────────────────────────────────────────┘
                     ┌──────────────────────────────────────────────┐
authUid              │  friends/ friendRequests/ outgoingRequests/  │
(mindig auth.uid)    │  notifications/ chats/    →  MÁR MA IS jó    │
                     └──────────────────────────────────────────────┘
                     ┌──────────────────────────────────────────────┐
usersPublic          │  regisztrált: authUid  (== rtdbKey, 009)     │
(a hasadás helye)    │  vendég:      NEM ÍRJUK  →  láthatatlan      │
                     └──────────────────────────────────────────────┘
```

**Miért nem írjuk át a `usersPublic`-ot `authUid`-re vendégnél?** Mert az **pont a követelmény ellentéte**: a vendég ekkor kapna publikus sort, megjelenne a keresőben és lenne jelenlét-státusza. A helyes javítás: **vendégnél az írás el sem indul**. A hatás felhasználói szempontból változatlan (ma is nincs sora) — a különbség az, hogy ma egy **némán megbukó** írás állítja elő, holnap egy **szándékos kapu**.

**Miért marad a `walls/` `rtdbKey`-en?** Három ok:

1. A vendég falának **nincs olvasóközönsége** — senki nem látja őt, tehát a fal barát-olvasási grantje értelmezhetetlen.
2. A `collectGuestWallUpdates` (`userData.ts:529-549`) a **`walls/{deviceId}`** ágat olvassa és viszi át `walls/{targetUid}` alá linkeléskor ([[010-firebase-guest-merge-single-gate]]). Ha vendégnél `walls/{anonUid}`-re írnánk, a migráció **nem találná meg** → **adatvesztés** minden linkeléskor.
3. A `walls/$uid/{failures,successes}/.write` szabály `$uid == auth.uid`-ot **is** enged (`database.rules.json:92,95`) → a `walls/{anonUid}` írás **sikerülne**, tehát a hiba **néma** lenne. Ez a legveszélyesebb változat: működőnek látszó adatvesztés.

### 1.10 Belépési pontok a social fázisokba — teljes lista (S. blokk)

| Fázis | Belépési pont | Védve? |
|---|---|---|
| `friends` | `MainMenu.tsx:159` → `guardedNav("friends", "friends.guestNotice")` | ✅ 1. réteg |
| `friends` | `ChatScreen.tsx:29` (nincs célpont) és `:68` (Vissza gomb) | ✅ közvetve — a `ChatScreen` csak nem-vendégnek renderelődik |
| `friends` | `ScreenRouter.tsx:109` (Vissza a barát faláról) | ✅ közvetve — ugyanaz |
| `friends` / `chat` / `friendWall` | **perzisztált `gamePhase`** (F5, kijelentkezés a képernyőn) | ✅ 2. réteg (`blockPhase`) |
| `chat` | `FriendsScreen.tsx:324-330` `openChat` | ✅ közvetve — a `FriendsScreen` már csak nem-vendégnek renderelődik |
| `friendWall` | `FriendsScreen.tsx:415-418` | ✅ közvetve — ugyanaz |
| — | `useNotificationListener` / `useFriendPresenceToasts` toastjai | ✅ **nem navigálnak** (csak megjelenítenek). Kattintható toast bevezetésekor `guardedNav` kötelező |

**Következtetés:** új *navigációs* lyuk **nincs**; a `MainMenu` + `ScreenRouter` kettős lefedi az összes utat. A hiányzó védelem a **művelet** szintjén van: a `sendFriendRequest` / `sendMessage` hívások előtt nincs kliensoldali őr, ezért a rules-elutasítás **néma hibaként** jelenne meg. Ezt zárja le az S. blokk.

### 1.11 A friend-gráf írási szabályai — szülő-szintről gyerek-szintre (T. blokk)

**Ma (szülő-szintű `.write`) — két támadás:**

```
① Hamis inbox-bejegyzés + eszkaláció
   set(ref('friendRequests/{támadó}/{áldozat}'), { from: '{áldozat}', … })
        ▲ engedi: friendRequests/$uid/.write  →  $uid == auth.uid        (rules:30)
        │
        ▼
   set(ref('friends/{áldozat}/{támadó}'), true)
        ▲ engedi: friends/$uid/.write  →  root.child('friendRequests')
        │            .child(auth.uid).child($uid).exists()               (rules:18)
        ▼
   a támadó BENNE VAN az áldozat barátlistájában  →  megnyílik walls/{áldozat}

② Barátlista-törlés
   set(ref('friends/{áldozat}'), { '{támadó}': true })
        ▲ ugyanaz a szülő-szintű .write ág, de a set() a TELJES node-ot cseréli
        ▼
   az áldozat összes barátja ELTŰNIK
```

**Új alak (gyerek-szintű `.write` + `.validate`):**

```jsonc
"friendRequests": {
  "$uid": {
    ".read": "auth != null && $uid == auth.uid",
    /* NINCS szülő-szintű .write → set() nem cserélheti le az inboxot */
    "$fromUid": {
      ".write": "auth != null && auth.token.firebase.sign_in_provider != 'anonymous' && (
                   ($fromUid == auth.uid && !data.exists())         /* küldő: csak ÚJAT */
                   || ($uid == auth.uid && (data.exists() || !newData.exists()))
                 )",                                               /* tulajdonos: csak MEGLÉVŐT */
      ".validate": "!newData.exists() || newData.child('from').val() === $fromUid"
    }
  }
},
"friends": {
  "$uid": {
    ".read": "auth != null && $uid == auth.uid",
    /* NINCS szülő-szintű .write */
    "$friendUid": {
      ".write": "auth != null && auth.token.firebase.sign_in_provider != 'anonymous' && (
                   $uid == auth.uid                                              /* (a) tulajdonos */
                   || ($friendUid == auth.uid && newData.val() === true
                       && root.child('friendRequests').child(auth.uid).child($uid).exists())
                                                                                 /* (b) elfogadó */
                   || ($friendUid == auth.uid && data.exists() && !newData.exists())
                 )"                                                              /* (c) removeFriend */
    }
  }
}
```

**A (c) ág nélkül a `removeFriend` eltörik.** A `removeFriend` (`userData.ts:1091-1102`) a **másik fél** listájából is töröl (`friends/{friendUid}/{uid}: null`), és ilyenkor a friend request **már rég nem létezik** — a (b) ág `exists()` feltétele tehát nem segít. A mai szabály harmadik ága (`data.child(auth.uid).val() === true && newData.child(auth.uid).val() === null`, `database.rules.json:18`) pontosan ezt fedi le szülő-szinten; gyerek-szinten ez a (c).

> ⚠️ **Multi-path csapda.** Az `acceptFriendRequest` / `rejectFriendRequest` **root multi-path `update`**-et használ (`userData.ts:1053-1058`, `:1079-1082`). Az RTDB minden útvonalat külön értékel ki, de **EGY** elbukó path az **EGÉSZ** írást megbuktatja — és a hiba `PERMISSION_DENIED`, ami ma `console.error`-ba fut. A 8.6 táblázat path-onként vezeti végig mind a négy műveletet.

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
src/components/screens/MainMenu.tsx               # "Barátok" gomb; +isGuest → 🔒 prefix, guestNotice,
                                                  #  title tooltip, listenerek kihagyása vendégnél — O. blokk;
                                                  #  guardedNav() helper (002 F rész)
                                                  #  2026-07-29: a notice toastból jön (addToast, 7000 ms) —
                                                  #  guestNoticeKey state + a hozzá tartozó useEffect TÖRÖLVE
                                                  #  (015-toast-notification H. blokk)
src/components/screens/MainMenu.module.css        # +.guestNotice — O. blokk
                                                  #  2026-07-29: az osztály TÖRÖLVE (a notice toast lett)
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

### Új fájlok (2026-07-29, P.–W. blokk)
```
src/test/rules/setup.ts                     # initializeTestEnvironment + auth-context helperek
                                            #  (google.com / anonymous sign_in_provider)
src/test/rules/guestGate.rules.test.ts      # vendég-tiltás (8.7 / 1–8.)
src/test/rules/friendGraph.rules.test.ts    # támadási minták (8.7 / 9–13.)
src/test/rules/friendFlow.rules.test.ts     # legitim flow-k, path-onként ÉS multi-path-ként (8.7 / 14–22.)
src/test/rules/linkedToken.rules.test.ts    # linkelés utáni első írás (8.7 / 23–24.)
vitest.rules.config.ts                      # environment: "node", emulátor-függő projekt
                                            #  (a fő konfig jsdom + src/test/setup.ts — itt nem kell)
```

### Módosuló fájlok (2026-07-29, P.–W. blokk)
```
security.rules.json                         # ⚠️ ELŐBB a drift visszaportolása (W.):
                                            #   chats/$chatId/messages (N. blokk), walls/$uid device_map-ág
                                            #  MAJD: sign_in_provider gate (P.), gyerek-szintű .write (T.),
                                            #        séma-komment kiegészítés (friends/chats/sessions/walls)
database.rules.json                         # REGENERÁLVA a security.rules.json-ból + DEPLOY
firebase.json                               # +emulators blokk (database port, singleProjectMode)
package.json                                # +@firebase/rules-unit-testing, +firebase-tools (dev),
                                            #  +"test:rules" script
src/firebase/auth.ts                        # +getSignInProvider(), +isRegisteredToken();
                                            #  startGoogleAuth: linkWithPopup után signInWithCredential
                                            #  (friss sign-in event, a uid megmarad) — Q. blokk
src/firebase/authBootstrap.ts               # :165 updateOnlineStatus, :169-171 onDisconnect,
                                            #  :176-178 updateUserPublicProfile → vendégnél KIHAGYVA;
                                            #  +isRegisteredToken mérés a store-ba
src/firebase/userData.ts                    # updateUserPublicProfile / updateOnlineStatus: közös
                                            #  "csak regisztrált user" kapu (withRegisteredUser);
                                            #  paraméter authUid-re átnevezve (nem rtdbKey);
                                            #  sendFriendRequest / sendMessage: felszínre hozott hibaág
src/state/useAuthStore.ts                   # +tokenRegistered: boolean | null (Q. blokk)
src/App.tsx                                 # :218-227 usersPublic írás, :649/:660/:666 updateOnlineStatus
                                            #  → vendégnél kihagyva
src/components/screens/SettingsScreen.tsx   # :78 usersPublic írás → vendégnél kihagyva
                                            #  (:184 offline-írás MARAD — regisztrált user saját sora)
src/components/screens/FriendsScreen.tsx    # kliens oldali őr sendFriendRequest/accept előtt + error toast
src/components/screens/ChatScreen.tsx       # kliens oldali őr sendMessage előtt + error toast
src/components/routing/ScreenRouter.tsx     # isGuest kiegészítése: tokenRegistered === false (Q. blokk)
src/components/screens/MainMenu.tsx         # ugyanaz az isGuest kiegészítés
.claude/lessons-learned.md                  # „a UI-gate nem hozzáférés-vezérlés"
.claude/references/architecture-current.md  # háromrétegű vendég-kapu
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

### A P.–W. blokk függőségei (2026-07-29)

- **Ugyanaz a hibaosztály:** [[009-firebase-identity-split-bugfix]] — a `selectRtdbKey` / `getRtdbKey` (`useAuthStore.ts:48-52`) a 009-ben született, és a `users/` node hasadását zárta le. **Ez a bővítés ugyanannak a hasadásnak a social/publikus oldalát** (`usersPublic`, `onlineStatus`) számolja fel — más eszközzel (kapu, nem kulcscsere), mert itt a láthatatlanság **követelmény**, nem hiba.
- **Kölcsönös:** [[010-firebase-guest-merge-single-gate]] — a `collectGuestWallUpdates` (`userData.ts:529-549`) a `walls/{deviceId}` ágra épül. Az R. blokk döntése (a `walls/` **nem** áll át `authUid`-re) **ennek a migrációnak a feltétele**; a U. blokk tesztje ezt regressziósan lefedi.
- **Előfeltétel:** [[003-firebase-auth-settings]] — az RTDB séma és a rules eredeti forrása; a `security.rules.json` ↔ `database.rules.json` kettősség onnan származik (W. blokk).
- **Érinti:** [[015-toast-notification]] — az S. blokk kliensoldali őrei a meglévő toast rendszert használják (`friends.guestNotice` warning toast, `GUEST_NOTICE_DURATION_MS = 7000`); a rules-elutasítás **error** toastot kap.
- **Érinti:** [[012-wall-of-shame]] — a `walls/` kulcsdöntés (1.9) itt dől el véglegesen; a T. blokk (1) lyukának mellékhatása, hogy a hamis barátság **megnyitná a `walls/{áldozat}` olvasását** is.
- **Érinti:** [[018-notification-retention]] — a V. blokk takarítása a `notifications/` bejegyzésekre is kiterjed; a P. blokk peer-push gate-je a vendég-spam vektort zárja.
- **Érinti:** [[002-ingame-shop-frontend]] — az O. blokk `needsAccount` listája a `shop` fázist is tartalmazza; a Q. blokk `tokenRegistered` kiegészítése **a shopot is érinti** (egy frissen linkelt user ne essen ki a boltból sem).
- **Új dev-függőség:** `@firebase/rules-unit-testing` + `firebase-tools` + RTDB emulátor (U. blokk). Ez a projekt **első** emulátor-függő tesztje.
- **Végrehajtási branch:** `develop`.
- **Kézi (nem kódolható) lépések:** Firebase Console — rules deploy, valamint a V. blokk / 9. szekció adattakarítása.

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

### 4.1 i18n a P.–W. blokkhoz (2026-07-29)

**Alapelv: a meglévő kulcsok újrahasznosítása a preferált.** Ez a bővítés hozzáférés-vezérlés, nem új funkció — a felhasználó számára a viselkedés ugyanaz marad, mint az O. blokk óta.

| Eset | Kulcs | Státusz |
|---|---|---|
| Vendég a Barátok/Chat gombra kattint | `friends.guestNotice` | ✅ **létezik**, mind az 5 nyelven — **újrahasznosítjuk** (S. blokk kliensoldali őrei is ezt használják) |
| Vendég a Shop gombra kattint | `shop.guestNotice` | ✅ létezik, változatlan |
| Barátkérés / üzenetküldés rules-elutasítás | `login.error.generic` | ✅ létezik — **javasolt újrahasznosítás** error toastként |

**Feltételesen új kulcs — a Q. blokk „jelentkezz be újra" esete:**

| Kulcs | en | hu | Mikor kell |
|---|---|---|---|
| `login.reauthRequired` | Please sign in again to use the social features. | Jelentkezz be újra a közösségi funkciók használatához. | **Csak akkor**, ha a 8.3 mérés azt mutatja, hogy a `linkWithPopup` utáni token `sign_in_provider`-e `"anonymous"` marad, **és** a Q. blokk `signInWithCredential` megoldása nem elég |

> ⚠️ Ha a `login.reauthRequired` kulcs mégis kell, az **mind az 5 nyelven** (`en`, `hu`, `fr`, `de`, `es`) kötelező, teljes paritással — ez az **`i18n` agent feladata** ([[000-i18n-nyelvesites]]). A `planner`/`react-dev` agent **ne** írjon fordítást.

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
- **Tájékoztatás, nem néma tiltás.** A letiltott gomb visszajelzés nélkül hibának látszik: ezért 🔒 prefix + `title` tooltip + tájékoztató üzenet. **2026-07-29 óta** az üzenet **warning toast** (`GUEST_NOTICE_DURATION_MS = 7000`), ami magától eltűnik, és ismételt kattintásra sem duplikálódik (az `addToast` no-op, ha azonos típusú és szövegű toast még látható) — [[015-toast-notification]] H. blokk / 0.9.
- **A minta újrahasznosítható, de két helyen kell karbantartani.** A `MainMenu` gombja és a `ScreenRouter` `needsAccount` listája **külön** kód: új, fiókot igénylő fázisnál mindkettőt bővíteni kell (a `shop` felvétele — [[002-ingame-shop-frontend]] F rész — pontosan ezt az utat járta be). A navigáció ezért került a közös `guardedNav(phase, noticeKey)` helperbe; a notice-t azonosító i18n kulcsot a helper adja tovább a toast rendszernek (a korábbi `guestNoticeKey: string | null` state 2026-07-29-én megszűnt).

### 5.10 A UI-gate nem hozzáférés-vezérlés (P. blokk, 2026-07-29)

- **A mai teljes védelem a `MainMenu` `guardedNav`-ja és a `ScreenRouter` `blockPhase`-e.** Mindkettő **kliensoldali**. Egy DevTools konzolból kiadott közvetlen RTDB írás mindkettőt megkerüli — és a `friends` / `friendRequests` / `chats` szabályok ma **nem** kérdezik meg, hogy a user anonim-e.
- **A kapu és a következménye nem ugyanaz a réteg.** Az O. blokk azt oldotta meg, hogy a vendég **ne lásson** üres/hibás képernyőt. Ez a blokk azt, hogy a vendég **ne tudjon írni**. A kettőt együtt kell karbantartani: ha a rules szigorúbb, mint a UI, néma `PERMISSION_DENIED` lesz; ha a UI szigorúbb, mint a rules, a védelem látszat.
- **⚠️ Deploy-kötelezettség.** A `database.rules.json` módosítása **csak deploy után** hat (az N. blokk tanulsága). A P./T. blokk kódmódosításai a deploy **előtt** nem tesztelhetők élesben.

### 5.11 A `sign_in_provider` egyetlen pontja — a terv legnagyobb kockázata (Q. blokk)

- **Az egész P. blokk egyetlen token-claimre épül.** Ha a `auth.token.firebase.sign_in_provider` nem úgy viselkedik, ahogy feltételezzük (különösen `linkWithPopup` után), a szigorítás **a saját felhasználóinkat zárja ki**, nem a vendégeket. Részletes elemzés + nyitott kérdés: **8.3**.
- **A linkelés a fő útvonal, nem a kivétel.** A `startGoogleAuth` (`src/firebase/auth.ts:36-38`) **anonim sessionre `linkWithPopup`**-ot hív, hogy a uid és minden RTDB adat megmaradjon. Vagyis a tipikus regisztrált user **linkelt anonim userként** keletkezik — pontosan az az eset, ahol a `sign_in_provider` claim gyanús.
- **A tünet, ha rosszul mérünk fel:** egy frissen linkelt user `!user.isAnonymous` (a kliens szerint regisztrált, a UI beengedi), de a **rules** anonimnak látja → minden friend/chat írása `PERMISSION_DENIED`, akár **1 órán át** (a token élettartama), és a `.catch(console.error)` miatt **némán**.
- **Mitigáció:** (1) mérés **először**, kód **utána** (U. blokk); (2) `signInWithCredential` a link után (friss sign-in event); (3) kliensoldali előrejelzés `getIdTokenResult().signInProvider`-rel, hogy a hiba **soha ne legyen néma**.
- **A már linkelt, meglévő userek** perzisztált sessionje **régi** tokent hordozhat. A Q. blokk „legacy user" ága nélkül ők is kizáródnának, amíg ki-be nem jelentkeznek.

### 5.12 Rules-szigorítás regressziós kockázata (T. blokk)

- **A multi-path `update` mindent vagy semmit.** Az `acceptFriendRequest` / `rejectFriendRequest` / `sendFriendRequest` / `removeFriend` root `update()`-eket ad ki; **egy** elbukó path az egész műveletet megbuktatja. A 8.6 táblázat path-onkénti átvezetése **kötelező** a deploy előtt.
- **A `removeFriend` a legkönnyebben eltörhető.** A másik fél listájából való törléshez a friend request már nem létezik → csak a (c) ág menti meg. Ha kimarad, a barát-eltávolítás féloldalasan hajtódik végre: az egyik listán marad a bejegyzés → **inkonzisztens gráf**.
- **Az `.validate` szigorúbb, mint amire számítunk.** Az RTDB `.validate` **nem** fut törléskor (`newData` nem létezik), ezért a `!newData.exists() ||` előtag kötelező — enélkül a szabály viselkedése implementációfüggőnek látszik és félrevezet.
- **Szigorítás, nem lazítás — de mérve.** Minden új szabály a mainál szigorúbb. Egy szigorítás hibája **funkcióvesztés**, nem biztonsági rés — ezért a U. blokk teszteseteinek **fele legitim flow**, nem támadás.
- **A T. blokk függetlensége.** A T. blokk lyukai **nem** okozták a `UVJYm…` esetet. Ne kerüljön a commit üzenetébe vagy a lessons-learnedbe olyan megfogalmazás, ami ezt sugallja — egy későbbi olvasó rossz irányba indulna.

### 5.13 Néma megtagadás — a visszatérő hibaosztály (R./S. blokk)

- **Harmadszor ugyanaz.** N. blokk: néma `PERMISSION_DENIED` → „nincs még üzenet". L. blokk: néma megtagadás → „üres fal". Most: néma megtagadás → „a vendégnek nincs `usersPublic` sora". **Minden alkalommal egy `.catch(console.error)` vagy egy hiányzó `onValue` error-callback rejtette el.**
- **A szabály:** ha egy írás **elvárt** módon bukhat el (pl. vendég), akkor **el se induljon** (kapu). Ha **nem elvárt** módon bukik el, akkor **látszódjon** (toast + log). A `.catch(console.error)` csak akkor marad, ha a hiba tényleg mellékes (pl. `sendNotification` — egy elmaradt toast nem törhet meg egy sikeres barátkérést).
- **Veszélyes eset: a néma SIKER.** Az 1.9 (3) pontja szerint a `walls/{anonUid}` írás **sikerülne** — és mégis adatvesztéshez vezetne a linkeléskor. A néma megtagadásnál csak a néma *helytelen siker* rosszabb.

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

- **A Barátok menü csak regisztrált (Google) usernek elérhető.** Vendégnél (kijelentkezett vagy anonim) a gomb 🔒 prefixet kap, kattintásra nem navigál, hanem a `friends.guestNotice` üzenetet mutatja (`title` tooltip + tájékoztató üzenet). **2026-07-29 óta** ez **warning toast** a bal felső sarokban, 7000 ms auto-dismissel, ismételt kattintásra sem duplikálódva ([[015-toast-notification]] H. blokk) — korábban beágyazott `<p role="status">` volt a gombok alatt.
- **Vendégnél a hozzászólás-számláló RTDB listenerek el sem indulnak.**
- **A perzisztált social fázis (`friends` / `chat` / `friendWall`) vendégnél a főmenübe irányít vissza** — a `status === "loading"` **nem** számít vendégnek, így az oldalfrissítés a bejelentkezett játékost nem dobja ki. *(A `shop` fázis ugyanezt a listát kapta meg a [[002-ingame-shop-frontend]] F részében.)*
- **i18n:** `friends.guestNotice` mind az 5 nyelven.
- **Ellenőrzés:** `tsc --noEmit` tiszta · `npm run test` **77/77** zöld · `npm run build` sikeres.

### Bővítés (2026-07-29) — P.–W. blokk (kötelező regisztráció, rules szinten is)

- **Vendég egyáltalán nem látható:** nincs `usersPublic` sora, nem jelenik meg a keresőben, nem található UID-lookuppal, nincs jelenlét-státusza. Ez már **nem** egy némán megbukó írás mellékhatása, hanem **szándékos kapu** (R. blokk).
- **Csak nem-anonim user barátkozhat és küldhet chat üzenetet** — és ezt a **security rules** kényszeríti ki (`auth.token.firebase.sign_in_provider != 'anonymous'`), nem csak a UI. Egy közvetlen RTDB írás DevTools konzolból **elbukik**.
- **Három réteg, nem kettő:** `MainMenu.guardedNav` (UX) → `ScreenRouter.blockPhase` (perzisztált fázis) → **RTDB rules** (kikényszerítés).
- **A `linkWithPopup` utáni token bizonyítottan regisztrált providert hordoz** (Q. blokk) — vagy ha nem, a kliens ezt **előre felismeri** (`getIdTokenResult().signInProvider`) és **érthető üzenetet** ad, nem néma `PERMISSION_DENIED`-et.
- **A friend-gráf írási szabályai gyerek-szintűek:** senki nem gyárthat hamis inbox-bejegyzést, nem írhatja be magát egyoldalúan más barátlistájába, és **egyetlen `set()` sem törölheti le** más teljes barátlistáját (T. blokk). A `removeFriend` a friend request hiányában is működik.
- **Rules-tesztek futnak:** `@firebase/rules-unit-testing` + RTDB emulátor; a 8.7 mátrix mind a 24 esete zöld — **támadási minták ÉS legitim flow-k** (a multi-path `update`-ek path-onként **és** egyben is).
- **A `security.rules.json` és a `database.rules.json` szinkronban van**, a `database.rules.json` **regenerált** (nem kézzel szerkesztett), és **deployolva**.
- **A pre-gate vendég-barátságok eltakarítva** (9. szekció), a `users/{deviceId}` és `walls/{deviceId}` vendég-adat **érintetlen**.
- **Nincs néma hiba:** a rules-elutasítás minden social műveletnél toastként jelenik meg; ahol az elutasítás **elvárt** (vendég), ott a hívás el sem indul.
- `tsc --noEmit` · `npm run test` · `npm run test:rules` (emulátorral) · `npm run build` — **mind zöld**.

---

## 7. Kapcsolódó tervek

- [[012-wall-of-shame]] — **kölcsönös kapcsolat.** A 012 O. blokkja **ezért** vezette be a top-level `walls/{uid}` node-ot: a `users/$key/.read` szülő szinten blokkolja a barát-hozzáférést. Az itteni I. blokk (barát fala) arra épül, az L. blokk pedig a 012 migrációjának hatóköri korlátját (csak a tulajdonos migrál) fedi le legacy fallback olvasással.
- [[011-difficulty-event-system]] — **előfeltétel.** A multiplayer event kiosztás (F blokk) a 011 `useEventSystem` / `EventModal` rendszerére épül.
- [[010-firebase-guest-merge-single-gate]] — a vendég fala a `migrateGuestData()`-ban kerül át `walls/{deviceId}` → `walls/{targetUid}`; enélkül a `auth.uid`-del kulcsoló barát-rendszer nem látná.
- [[009-firebase-identity-split-bugfix]] — a `getRtdbKey()` / `selectRtdbKey` invariáns adja a `walls/{uid}`, `friends/{uid}`, `chats/{chatId}` kulcsokat.
- [[003-firebase-auth-settings]] — **előfeltétel.** Firebase Auth + az eredeti RTDB séma és rules forrása.
- [[007-state-persist-page-refresh]] — a `chatTargetUid` / `chatTargetName` perzisztálás ugyanabba a `useGameStore` `partialize`-ba illeszkedik; a session állapot szándékosan **nem** perzisztálódik. **Két 2026-07-28-i következmény:** (1) a perzisztált `gamePhase` miatt kell a `ScreenRouter` vendég-őre (O. blokk); (2) fiókváltáskor a `clearUserScopedData` nullázza a `chatTarget*` / `friendWallTarget*` mezőket, mert azok az előző fiók barát-gráfjára mutatnak (007 G. blokk).
- [[001-main-menu-settings]] — a Barátok gomb a főmenü panelen él; a főmenü elrendezésének 2026-07-28-i bővítése ott van dokumentálva. A vendég-tájékoztató **2026-07-29 óta nem a panelen jelenik meg**, hanem toastként (lásd alább).
- [[015-toast-notification]] — **a vendég-tájékoztató megjelenítésének kanonikus forrása (2026-07-29).** A `guardedNav` a `friends.guestNotice` üzenetet `addToast("warning", …, GUEST_NOTICE_DURATION_MS)`-szal jeleníti meg; a `guestNoticeKey` state és a `MainMenu.module.css` `.guestNotice` osztálya megszűnt (H. blokk / 0.9). A terv a barátkérés-, chat- és jelenlét-eseményekre is épít toastokat.
- [[002-ingame-shop-frontend]] — az O. blokk vendég-őrét az **F rész** terjesztette ki a `shop` fázisra (közös `guardedNav` helper + `needsAccount` lista). A shop-specifikus indoklás és a vállalt következmény (a vendég nem tud vásárolni, csak örökölni kreditet) ott van rögzítve.
- [[000-i18n-nyelvesites]] — a `friends.*`, `chat.*`, `friendWall.*`, `multiplayer.*` kulcsok teljes paritása mind az 5 nyelven.

### A P.–W. blokk kereszthivatkozásai (2026-07-29)

- [[009-firebase-identity-split-bugfix]] — **ugyanaz a hibaosztály, másik fele.** A 009 a `users/` node kulcshasadását zárta le a `selectRtdbKey` / `getRtdbKey` derivált selectorral (`useAuthStore.ts:48-52`). A social/publikus réteg (`usersPublic`, `onlineStatus`) hasadása **ma is él** — a Tünet-szekció és az R. blokk ezt számolja fel. **Fontos különbség:** ott a kulcs egységesítése volt a megoldás, itt a **kapu** — mert a vendég láthatatlansága **követelmény**, nem hiba (1.9).
- [[010-firebase-guest-merge-single-gate]] — **az R. blokk `walls/` döntésének feltétele.** A `collectGuestWallUpdates` (`userData.ts:529-549`) a `walls/{deviceId}` ágra épül; ha a fal `authUid`-re állna át, a merge **némán adatot vesztene** minden linkeléskor. A U. blokk erre regressziós tesztet ír.
- [[012-wall-of-shame]] — a `walls/{uid}` kulcs és a barát-olvasási grant forrása. A T. blokk (2) lyukának mellékhatása, hogy a hamis barátság a `walls/{áldozat}` **olvasását is megnyitná** — a gyerek-szintű `.write` ezt is lezárja.
- [[015-toast-notification]] — az S. blokk kliensoldali őrei ezt a toast rendszert használják: vendégnél **warning** (`friends.guestNotice`, 7000 ms), rules-elutasításnál **error** toast. Kattintható toast bevezetésekor a navigáció **`guardedNav`-on** keresztül menjen (1.10).
- [[003-firebase-auth-settings]] — az RTDB séma és a `security.rules.json` ↔ `database.rules.json` kettősség forrása. A W. blokk **driftet talált**: a `chats/$chatId/messages` (N. blokk javítása), a `walls/$uid` `device_map`-ága és a `notifications` node csak a **generált** fájlban helyes → a dokumentált forrást vissza kell portolni.
- [[018-notification-retention]] — a V. blokk takarítása a `notifications/` bejegyzésekre is kiterjed; a P. blokk peer-push gate-je a **vendég-spam** vektort zárja (ma bármely bejelentkezett user pusholhat toastot **bármely** uid inboxába, ha a `fromUid` a sajátja).
- [[002-ingame-shop-frontend]] — az O. blokk `needsAccount` listáján a `shop` is rajta van; a Q. blokk `tokenRegistered` kiegészítése ezért **a boltot is érinti**: egy frissen linkelt user ne essen ki a vásárlásból sem.
- [[016-stripe-fraud-defense]] / [[017-stripe-go-live]] — **közvetve érintett.** A rules-teszt infrastruktúra (U. blokk) az első a projektben; a `wallet` szabályok jövőbeli szigorítása ugyanezt a keretet fogja használni.
