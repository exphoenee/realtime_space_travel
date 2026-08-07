---
title: "Notification retention – a `notifications/{uid}` node korlátlan növekedésének megfékezése"
slug: 016-notification-retention
type: plan
category: core
status: not-started
implemented: false
implemented_at: null
created_at: "2026-07-29"
updated_at: "2026-07-30"  # frissítve: átszámozás 18 → 16 (a Stripe tervek a lista végére kerültek)
author: exphoenee
step: 16
phases: []
dependencies:
  - 015-toast-notification
related_plans:
  - 013-social-multiplayer
  - 020-nextjs-migration
tags:
  - firebase
  - rtdb
  - notifications
  - retention
  - performance
  - maintenance
---

# Notification retention – a `notifications/{uid}` node korlátlan növekedésének megfékezése

**Cél:** a [[015-toast-notification]] tervben bevezetett `notifications/{uid}/{pushId}` RTDB node **tárolási** és **sávszélesség-oldali** korlátlan növekedésének megszüntetése, két egymástól független eszközzel: (1) kliensoldali, a tulajdonos által futtatott **takarítás** (`pruneNotifications`), (2) a listener áttérése **korlátozott lekérdezésre** (`limitToLast`). Cloud Functions nélkül, Spark csomagon.

> ⚠️ **Ez a terv a [[015-toast-notification]] I. blokkjában nyitva hagyott tételt (`notifications/{uid}` takarítása) és a 7.3 kockázatot váltja ki.** A 015-ös tervfájl nem módosul; a nyitott TODO tétel átvezetése a `manage-roadmap` agent feladata.

---

## A probléma

A `notifications` node eredetileg **ritka** eseményekre készült (`friendRequest`, `friendRequestAccepted`, `friendRequestRejected`) — ott a „+1 írás barátkérésenként, elhanyagolható" becslés igaz volt. A 015 I. blokkja utólag bevezette a `chatMessage` típust: azóta **minden elküldött chat-üzenet létrehoz egy rekordot a címzett node-jában** (`userData.ts` `sendMessage` → `sendNotification(toUid, "chatMessage", …)`).

Ez két irányban is határtalan:

1. **Tárolás.** A `notifications/{uid}` node userenként monoton nő. A kódban **semmi nem töröl** belőle; a `markNotificationRead` / `markAllNotificationsRead` csak a `read` flaget billenti át.
2. **Sávszélesség.** A `subscribeNotifications` `onValue`-t használ a node **egészére**. Az `onValue` minden változásnál a **teljes** listát újraküldi — egy hosszan használt fiók minden egyes új értesítésnél letölti a teljes előzményét. A növekedés tehát nem lineáris költség, hanem **kvadratikus**: `n` értesítés `O(n²)` átvitelt jelent egy session alatt.

Harmadik, kisebb következmény: a `useNotificationListener` `toastedIds` `Set`-je (a duplikált toast elleni védelem, 015/0.3) a beérkező rekordok számával arányosan nő a session alatt.

> **Időzítési megjegyzés.** A növekedés jelenleg **latens**: amíg a 015 A. blokkjában szereplő `database.rules.json` **deploy nem futott le**, a `sendNotification` idegen node-ba íráskor `PERMISSION_DENIED`-et kap (a hiba elnyelődik — 015/0.8), tehát a node gyakorlatilag nem hízik. A probléma **a deploy pillanatában élesedik**. Ezért ideális, ha ez a terv a 015 deployjával **együtt vagy előtte** landol.

---

## Döntések (egyeztetve)

| Kérdés | Választás |
|--------|-----------|
| A chat-üzenet írjon-e továbbra is notification rekordot? | **Igen, marad.** A rekord megmarad, és **mellé** készül takarítás. Az alternatíva — a chat-toast levezetése a `chats/{chatId}/unread` számlálóból, nulla RTDB írással (a jelenlét-toast mintája, 015/0.11) — **elvetve** |
| Hol fusson a takarítás? | **Kliensoldalon, a tulajdonos által.** A projekt Spark csomagon van, Cloud Functions nincs |
| Olvasatlan értesítés törlése | **Soha, semmilyen körülmények között.** Az olvasatlan rekord hordozza a badge-információt |
| Megőrzési ablak | **7 nap**, az **olvasott** rekordokra (`NOTIFICATION_RETENTION_MS`) |
| Abszolút plafon | **100 rekord** (`NOTIFICATION_MAX_RECORDS`) — a plafon fölött a **legrégebbi olvasott** rekordok esnek ki. Az olvasatlan itt is védett |
| A számok helye | **`src/constants/constants.ts`**, nem beégetve |
| Írási minta | **Egyetlen multi-path `update()`** `null` értékekkel — a projekt bevett mintája (`migrateGuestData`, `markAllNotificationsRead`) |
| Mikor fusson | **Az app indulásakor**, az auth feloldódása után, a `useNotificationListener` effektjében — identitásonként egyszer, plusz hosszú session esetén **legfeljebb 6 óránként** újra |
| Olvasás korlátozása | `query(ref, orderByKey(), limitToLast(N))` — **a takarítástól függetlenül**, ez önmagában is megfogja a sávszélesség-problémát |
| Security rules | **Nem kell módosítás és nem kell új deploy** — lásd 5. szekció |
| Új UI | **Nincs.** Háttérművelet, nulla i18n kulcs — lásd 6. szekció |

---

## ✅ Haladás (TODO)

> Jelölés: `[ ]` hátravan · `[~]` folyamatban · `[x]` kész.

**A. Konstansok**
- [ ] `src/constants/constants.ts`: `NOTIFICATION_RETENTION_MS = 7 * 24 * 60 * 60 * 1000` (7 nap)
- [ ] `src/constants/constants.ts`: `NOTIFICATION_MAX_RECORDS = 100`
- [ ] `src/constants/constants.ts`: `NOTIFICATION_SUBSCRIBE_LIMIT = 100` — **kötelezően ≥ `NOTIFICATION_MAX_RECORDS`** (lásd 3.3)
- [ ] `src/constants/constants.ts`: `NOTIFICATION_PRUNE_MIN_INTERVAL_MS = 6 * 60 * 60 * 1000` (6 óra) — a hosszú session-ök miatti újrafuttatás alsó korlátja
- [ ] Mind a négy konstanshoz **magyarázó JSDoc**: miért az az érték (a puszta szám nem magyarázza meg magát)

**B. `pruneNotifications` — `src/firebase/userData.ts`**
- [ ] `pruneNotifications(uid: string, now: number = Date.now()): Promise<PruneResult>` — a `now` injektálható, **kizárólag a tesztelhetőség miatt**
- [ ] Egyszeri `get(ref(db, \`notifications/${uid}\`))` — a takarítás a **teljes** node-ot olvassa, **nem** a listener (limitált) adatait
- [ ] Nem létező node → `{ scanned: 0, deleted: 0 }`, **nulla írás**
- [ ] 1. szabály: `read !== true` → **mindig marad** (invariáns)
- [ ] 2. szabály: `read === true && now - at > NOTIFICATION_RETENTION_MS` → törlendő
- [ ] 3. szabály: ha a túlélők száma > `NOTIFICATION_MAX_RECORDS`, a **legrégebbi olvasott** rekordok törlődnek, amíg a szám a plafon alá nem esik
- [ ] 3b. szabály: ha az olvasatlanok száma önmagában > plafon, **nincs további törlés** (`console.warn` + a `PruneResult` jelzi) — az 1. szabály erősebb
- [ ] Hiányzó/érvénytelen `at` mező → **`now`-ként** kezelendő (azaz marad). Sosem törlünk hiányos adat miatt
- [ ] A törlendő útvonalak **egyetlen** `update(ref(db, \`notifications/${uid}\`), { [pushId]: null, … })` hívásban mennek el (relatív kulcsok, a `markAllNotificationsRead` mintája szerint)
- [ ] **Ha nincs törlendő, `update` sem hívódik** — ez a legfontosabb ciklus-védelem (nincs írás → nincs `onValue` esemény)
- [ ] A hibák elnyelődnek (`console.error`), a takarítás bukása nem törhet meg semmit — a `sendNotification` (015/0.8) mintája szerint
- [ ] `PruneResult` típus a `src/types/index.ts`-ben: `{ scanned: number; deleted: number; unreadOverCap: boolean }`

**C. Olvasás korlátozása — `subscribeNotifications`**
- [ ] `src/firebase/userData.ts`: import kiegészítése a `firebase/database`-ből → `query`, `orderByKey`, `limitToLast`
- [ ] `subscribeNotifications`: `onValue(query(notificationsRef, orderByKey(), limitToLast(NOTIFICATION_SUBSCRIBE_LIMIT)), …)`
- [ ] Az `orderByKey()` **explicit** legyen (a push ID kronologikusan rendezett, így a „legutóbbi N" pontosan a kívánt halmaz) — kommentben rögzítve, miért működik ez push ID-kkel
- [ ] Az `.indexOn` **nem szükséges** (kulcs szerinti rendezés) — kommentben rögzítve, hogy ne kerüljön feleslegesen a rules fájlba
- [ ] A hibakezelő ág (`callback([])` + `console.error`) változatlanul marad
- [ ] `markAllNotificationsRead` **NEM** kap limitet: annak a teljes node-ot kell látnia, különben a limiten kívüli olvasatlanok örökre olvasatlanok maradnának

**D. Futtatás bekötése — `src/hooks/useNotificationListener.ts`**
- [ ] A takarítás **a feliratkozás mellett** indul, az effekt elején, `uid` + nem-vendég feltétellel — ugyanaz a kapu, ami a subscribe-ot védi
- [ ] `pruneRunning` ref — újrabelépés-védelem (egyszerre egy futás)
- [ ] `lastPruneAt` ref — az `onValue` callbackből legfeljebb `NOTIFICATION_PRUNE_MIN_INTERVAL_MS`-onként indulhat újra (hosszú, több napos session-ök miatt — ez egy AFK játék)
- [ ] Identitásváltáskor (`uid` változás) mindkét ref **nullázódik**, ahogy a `toastedIds` is
- [ ] A takarítás **nem** blokkolja a feliratkozást (nincs `await` a subscribe előtt), és a hibája nem buktatja el a listenert
- [ ] Kommentben rögzítve, **miért kell a kettős őr**: a törlés maga is `onValue`-t vált ki, és a naiv „takaríts minden callbacknél" megoldás végtelen ciklus
- [ ] ❌ **NEM** kerül prune-hívás a `FriendsScreen`-be — indoklás: 3.4

**E. Tesztek — `src/firebase/userData.test.ts`**
- [ ] A `vi.mock("firebase/database")` factory **kiegészítése**: `query`, `orderByKey`, `limitToLast` — enélkül a modul betöltése is elbukik („No export is defined on the mock"), nem csak a `subscribeNotifications`-t hívó teszt
- [ ] Teszt: olvasatlan, a megőrzési ablaknál régebbi rekord **marad**
- [ ] Teszt: olvasott, az ablaknál régebbi rekord **törlődik** (`null` a helyes kulcson)
- [ ] Teszt: olvasott, az ablakon belüli rekord **marad**
- [ ] Teszt: nincs törlendő → **`update` nem hívódik** (a ciklus-védelem lényege)
- [ ] Teszt: a plafon fölött a **legrégebbi olvasott** rekordok esnek ki, a legfrissebbek maradnak
- [ ] Teszt: csupa olvasatlan a plafon fölött → **nulla törlés**, `unreadOverCap: true`
- [ ] Teszt: hiányzó `at` mezőjű olvasott rekord **marad**
- [ ] Teszt: nem létező node → `{ scanned: 0, deleted: 0 }`, `update` nem hívódik
- [ ] Teszt: **egyetlen** `update` hívás történik, a helyes ref-fel (`notifications/{uid}`), több törlendő esetén is

**F. Validáció**
- [ ] `tsc --noEmit` hibamentes
- [ ] `npm run test` zöld (a meglévő 84 teszt + az újak)
- [ ] `npm run build` sikeres
- [ ] Kézi próba: két fiók, chat-üzenetváltás → a `notifications` node az RTDB konzolban a plafon alatt marad
- [ ] Kézi próba: a takarítás **nem** csökkenti a főmenü badge-ét (olvasatlan nem törlődik)

**G. Ellenőrzött nem-tételek (tudatosan kimaradó hatókör)**
- [ ] Ellenőrizve: `database.rules.json` **nem módosul**, **nincs új deploy** ehhez a tervhez (5. szekció)
- [ ] Ellenőrizve: **nulla új i18n kulcs**, a paritás marad 373/373 (6. szekció)
- [ ] Ellenőrizve: nincs új UI, nincs új képernyő, nincs új beállítás

---

## 1. Megőrzési politika

A politika három szabályból áll, **szigorú precedencia-sorrendben**. A sorrend nem stílus kérdése: a 2. és 3. szabály csak azon a halmazon dolgozhat, amit az 1. szabály nem védett le.

### 1. szabály — olvasatlan soha nem törlődik (invariáns)

Az olvasatlan értesítés **nem előzmény, hanem függő feladat**: ez táplálja a főmenü badge-ét (015/0.4, `useNotificationStore.unreadCount`). Ha egy takarítás olvasatlant törölne, a felhasználó úgy veszítene el egy barátkérés-értesítést, hogy soha nem is látta. Kor és darabszám ezen nem üt át.

**Következmény:** a plafon (3. szabály) *best effort* korlát, nem garancia. Ezt vállaljuk — a garantált korlátot az olvasási oldalon a `limitToLast` adja (3.3).

### 2. szabály — olvasott + régi → törlés (7 nap)

`read === true && now - at > NOTIFICATION_RETENTION_MS`.

**Miért 7 nap:** az értesítés funkciója az, hogy *értesítsen*; ha a felhasználó már látta, az érték a rekordban gyakorlatilag nulla. A hét nap arra hagy tartalékot, hogy a felhasználó visszakeresse, ki írt neki a héten. Rövidebb ablak (pl. 24 óra) elvenné a még meg nem nézett — de már „olvasottnak" jelölt — előzményt: a `markAllNotificationsRead` **a Barátok képernyő megnyitásakor mindent olvasottra állít** (015/0.5), tehát az „olvasott" itt nem azt jelenti, hogy a felhasználó tételesen elolvasta.

Ez az utóbbi pont a legfontosabb indok arra, hogy az ablak **ne legyen szűk**: a rendszerben az „olvasott" flag optimista.

### 3. szabály — abszolút plafon (100 rekord)

Két takarítás között egy nagyon aktív chat így is felduzzaszthatja a node-ot. A plafon ez ellen véd: a túlélők (1. + 2. szabály után) számából a **legrégebbi olvasott** rekordokat dobjuk, amíg a darabszám a plafon alá nem esik.

**Miért 100:** a `NOTIFICATION_SUBSCRIBE_LIMIT`-tel egyezik (3.3), így a listener pontosan azt látja, amit a megőrzés garantál. Rekordonként ~120 bájt, tehát 100 rekord ≈ 12 KB — ennyi replay egy `onValue` eseménynél még elfogadható.

### Összefoglaló tábla

| Rekord | Kor | Darabszám a plafon fölött | Sors |
|---|---|---|---|
| olvasatlan | bármi | igen/nem | **marad** |
| olvasott | < 7 nap | plafon alatt | marad |
| olvasott | < 7 nap | plafon fölött, a legrégebbiek közt | **törlődik** |
| olvasott | > 7 nap | bármi | **törlődik** |
| bármi, hiányzó `at` | ismeretlen | — | **marad** (defenzív) |

---

## 2. `pruneNotifications` — implementáció

Új függvény a `src/firebase/userData.ts` „Notifications" szekciójában, a `markAllNotificationsRead` mellett.

```typescript
export interface PruneResult {
  /** Hány rekordot vizsgált a futás. */
  scanned: number;
  /** Hány rekordot nullázott ki. */
  deleted: number;
  /** Igaz, ha az olvasatlanok száma önmagában a plafon fölött van. */
  unreadOverCap: boolean;
}

/**
 * Takarítja a saját `notifications/{uid}` node-ot: az olvasott + lejárt, illetve
 * a plafon fölötti legrégebbi olvasott rekordokat törli EGYETLEN multi-path
 * update()-tel. Olvasatlant SOHA nem töröl.
 *
 * Idempotens: második futásra nincs mit törölni, tehát nem ír — és így nem is
 * vált ki újabb `onValue` eseményt. Ez a ciklus-védelem alapja.
 *
 * A `now` paraméter kizárólag a tesztelhetőség miatt injektálható.
 */
export const pruneNotifications = async (
  uid: string,
  now: number = Date.now(),
): Promise<PruneResult> => { /* … */ };
```

**Algoritmus**

1. `const snapshot = await get(ref(db, \`notifications/${uid}\`))` — ha nem létezik: `{ scanned: 0, deleted: 0, unreadOverCap: false }`, **írás nélkül**.
2. Az `Object.entries(snapshot.val())`-ből `{ key, at, read }` lista. `at` nem szám → `now` (marad). `read === true` a törölhetőség feltétele.
3. `doomed = new Set<string>()`; minden olvasott rekord, amire `now - at > NOTIFICATION_RETENTION_MS`, bekerül.
4. `survivors = mind \ doomed`, `at` szerint **csökkenő** sorrendben. Amíg `survivors.length > NOTIFICATION_MAX_RECORDS`, a sor végéről (legrégebbi) veszünk el egy **olvasott** rekordot és tesszük a `doomed`-ba. Ha a sor végén már csak olvasatlan van, a ciklus megáll → `unreadOverCap: true` + `console.warn`.
5. Ha `doomed.size === 0` → **visszatérés írás nélkül**.
6. `const updates: Record<string, null> = {}`, minden `doomed` kulcsra `null`, majd egyetlen
   `await update(ref(db, \`notifications/${uid}\`), updates)`.
7. `try/catch` → `console.error`, a hívó nem borul.

**Miért egyetlen `update()` és nem `remove()`-onként:** a multi-path update atomi és **egy** RTDB írásnak számít, tehát **egy** `onValue` eseményt vált ki, nem `n` darabot. Rekordonkénti `remove()` esetén a listener minden törlésnél újra megkapná a teljes (fogyó) listát — pontosan azt a sávszélesség-problémát erősítené, amit meg akarunk szüntetni. Ez a projekt bevett mintája is (`migrateGuestData`, `markAllNotificationsRead`).

---

## 3. Olvasás korlátozása és a futtatás helye

### 3.1 A `subscribeNotifications` limitálása

```typescript
import { query, orderByKey, limitToLast } from "firebase/database";

const notificationsRef = ref(db, `notifications/${uid}`);
const recent = query(
  notificationsRef,
  orderByKey(),
  limitToLast(NOTIFICATION_SUBSCRIBE_LIMIT),
);

return onValue(recent, (snapshot) => { /* változatlan feldolgozás */ }, errorHandler);
```

A push ID lexikografikus rendezése **kronologikus**, tehát az `orderByKey() + limitToLast(N)` pontosan a legutóbbi N értesítést adja. Külön `.indexOn` nem kell, mert kulcs szerinti rendezésről van szó.

**Ez a takarítástól független védelem.** Ha a takarítás bármiért nem fut (a felhasználó nem nyitja meg az appot elég sűrűn, hiba történik, egy burst két futás közé esik), a listener akkor is legfeljebb N rekordot húz le eseményenként. Az `O(n²)` átvitel `O(n·N)`-re szelídül.

### 3.2 A feldolgozás nem változik

A `snapshot.val()` továbbra is objektum, a rendezés (`b.at - a.at`), a normalizálás (`id`, `read`) és a hívói oldal (`useNotificationListener`) érintetlen. A `limitToLast` **kizárólag** azt szűkíti, hány rekord jön át.

### 3.3 A limit ≥ plafon invariáns

`NOTIFICATION_SUBSCRIBE_LIMIT >= NOTIFICATION_MAX_RECORDS` — ha a limit kisebb lenne a plafonnál, a takarítás megőrizne olyan rekordokat, amiket a listener sosem lát: az `unreadCount` badge alulszámolna, és a toast is elmaradna. A két konstans ezért egyezik (100), és ezt a JSDoc-ban rögzíteni kell.

**Ismert peremeset:** ha az olvasatlanok száma meghaladja a 100-at (1. szabály miatt ezek nem törlődnek), a badge és a toastok csak a legutóbbi 100-at fedik. Ez egy hosszan elhanyagolt fiók esete; vállaljuk. A `PruneResult.unreadOverCap` és a `console.warn` láthatóvá teszi, ha valaha előfordul.

### 3.4 Mikor fusson a takarítás — és miért nem máshol

**Választott hely: `useNotificationListener`**, ugyanabban az effektben, ami a feliratkozást nyitja.

Miért ez a helyes:

- Az effekt **már ma pontosan a jó feltételre** fut: `uid` megvan és a felhasználó nem vendég. Az auth feloldódását nem kell külön kezelni — amíg nincs `uid`, az effekt korán kilép.
- Identitásonként egyszer fut, determinisztikusan, függetlenül attól, hova navigál a felhasználó.
- A hook `App.tsx`-ben **egyszer** van mountolva (015/0.7 kifejezetten emiatt született), tehát nincs duplikált futás.

**Miért NEM a `FriendsScreen`** (ahol a `markAllNotificationsRead` fut): a Barátok képernyő megnyitása esetleges — aki csak chatel a játék közbeni panelről, sosem váltaná ki a takarítást. Ráadásul a mount-effekt már ma is ír (`markAllNotificationsRead`), a prune-t is odatéve két, egymást `onValue`-n keresztül kiváltó írás sorjázna ugyanabban a pillanatban. Egy kiváltó pont áttekinthetőbb.

> Megjegyzés: a `markAllNotificationsRead` **utáni azonnali** takarítás nem törölne semmi frisset, mert a 2. szabály **kor** alapján dönt, nem az olvasottá válás időpontja alapján. A `FriendsScreen` tehát nem *veszélyes* hely, csak megbízhatatlan és fölösleges.

**Miért kell mégis egy másodlagos kiváltó:** ez egy AFK játék, a session **napokig** futhat újratöltés nélkül. Ezért az `onValue` callbackből is indulhat takarítás, de **legfeljebb 6 óránként** (`NOTIFICATION_PRUNE_MIN_INTERVAL_MS`).

### 3.5 A ciklus-védelem három rétege

A törlés maga is `onValue` eseményt vált ki. Naiv megvalósításban ez végtelen ciklus. Három, egymástól független őr:

1. **Idempotencia (a legerősebb):** ha nincs törlendő, `pruneNotifications` **nem ír**. A takarítás által kiváltott callbackben a második futás nulla írással zárul, tehát nem keletkezik újabb esemény.
2. **`pruneRunning` ref:** amíg egy futás `await`-el, újabb nem indul (az `onValue` közben többször is tüzelhet).
3. **`lastPruneAt` ref + 6 órás alsó korlát:** még ha az 1. réteg valaha megsérülne (pl. egy jövőbeli, mindig-ír implementációtól), az időkorlát akkor is óránál sűrűbb ismétlést nem enged.

Az 1. réteget a **teszt** rögzíti („nincs törlendő → `update` nem hívódik"), hogy egy későbbi refaktor ne tudja némán elrontani.

---

## 4. Fájlstruktúra

### Új fájlok

Nincs. A funkció a meglévő rétegekbe illeszkedik — a `notifications` CRUD a `userData.ts`-ben él, a takarítás is oda tartozik.

### Módosuló fájlok

```
src/constants/constants.ts          # +NOTIFICATION_RETENTION_MS, +NOTIFICATION_MAX_RECORDS,
                                    #  +NOTIFICATION_SUBSCRIBE_LIMIT, +NOTIFICATION_PRUNE_MIN_INTERVAL_MS
src/firebase/userData.ts            # +pruneNotifications; subscribeNotifications → query/orderByKey/limitToLast;
                                    #  import kiegészítés a firebase/database-ből
src/types/index.ts                  # +PruneResult
src/hooks/useNotificationListener.ts # +prune indítása az effektben, +pruneRunning / lastPruneAt refek
src/firebase/userData.test.ts       # a firebase/database mock kiegészítése (query, orderByKey, limitToLast)
                                    #  + a pruneNotifications tesztek
```

**Nem módosul:** `database.rules.json`, `security.rules.json` (5. szekció) · `src/i18n/locales/**` (6. szekció) · `App.tsx` · bármely komponens vagy CSS.

---

## 5. Biztonsági szabályok — nincs teendő, nincs deploy

A `database.rules.json` **jelenlegi, már fájlba írt** szabálya:

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

A szülőszintű `.write` a **tulajdonosnak** ad írási jogot a saját node-jára. Az RTDB-ben a törlés `null` írása, tehát ez a szabály **már ma engedi**, hogy a tulajdonos a saját rekordjait törölje — ugyanaz a jog, amin a `markAllNotificationsRead` batch update-je is fut.

**Ebből következően ehhez a tervhez sem szabálymódosítás, sem új deploy nem kell.**

> ⚠️ **Ezt tudatosan el kell választani a [[015-toast-notification]] nyitott deploy-tételétől.** Az a deploy attól kell, hogy a `sendNotification` **idegen** node-ba tudjon írni (015/0.1, 015/7.2). A takarítás **saját** node-ba ír, ami a ma élő szabályokkal is megy. A két tétel összekeverése két hibához vezetne: (a) „a takarítás nem működik, mert nincs deploy" — téves; (b) „deployoltunk, tehát a takarítás is kész" — szintén téves. Külön tételek, külön okból.

Az egyetlen tényleges kapcsolódás **időzítési**: a node növekedése a 015 deployja után indul be (lásd „A probléma").

---

## 6. i18n

**Nulla új kulcs.** A takarítás háttérművelet: nincs képernyője, nincs gombja, nincs visszajelzése a felhasználónak. A `toast` névtér marad 7 kulcs, a paritás **373/373** mind az 5 nyelven.

**Miért nem készül UI hozzá.** Felmerülhetett volna egy „Előzmények törlése" gomb vagy egy megőrzési beállítás a Settingsben. Mindkettőt elvetjük:

- A megőrzési politika **karbantartási** döntés, nem felhasználói preferencia — a felhasználónak nincs információja ahhoz, hogy jól válasszon 7 és 30 nap között.
- Egy manuális törlés-gomb olyan műveletet tenne kattintásnyira, ami visszavonhatatlan, és amit a napi automatika amúgy is elvégez.
- Egy „X értesítés törölve" toast **zaj**: a felhasználó nem kért semmit, és nem is tud vele mit kezdeni.

Ha valaha mégis kell UI (pl. GDPR-adatkezelési igény), az **külön terv** legyen, saját i18n kulcsokkal — ez a terv szűk marad.

---

## 7. Függőségek

- **Előfeltétel:** [[015-toast-notification]] — ez a terv az ott létrehozott `notifications` node-ot, a `subscribeNotifications`-t és a `useNotificationListener`-t módosítja. A 015 I. blokkjának nyitott `notifications` takarítás tétele és a 7.3 kockázat **ide kerül át**
- **Kapcsolódó:** [[013-social-multiplayer]] — a növekedés forrása a chat (`sendMessage`, `chats/{chatId}/unread`); ha valaha visszatérne a „nulla írású chat-toast" alternatíva, azt a 013 chat-rétegében kellene megvalósítani
- **Nem függ tőle és nem függ rá:** a Stripe-tervek ([[021-stripe-fraud-defense]], [[024-stripe-go-live]]) — más node, más rules-ág
- **Elhelyezés a roadmapen:** a 015 után. Ideálisan **a 015 `database.rules.json` deployjával együtt vagy előtte** landoljon, mert a növekedés a deploy pillanatában élesedik

---

## 8. Kockázatok / figyelmeztetések

### 8.1 A kliensoldali takarítás csak akkor fut, ha a tulajdonos megnyitja az appot

Ez a megközelítés **strukturális** korlátja, nem hiba: egy elhagyott fiók `notifications` node-ja **örökre megmarad** — sőt, tovább is nő, mert a barátai továbbra is írhatnak bele. Se önmagát nem takarítja, se más nem takaríthatja (idegen node-ból törölni a szabályok szerint tilos, és helyesen tilos).

Ez a **Spark csomag vállalt ára**. A valódi megoldás egy **ütemezett Cloud Function** (`onSchedule`, napi futás, minden `notifications/*` ág nyesése), ami **Blaze csomagot** igényel. Ezt jövőbeli fázisként rögzítjük, nem ennek a tervnek a hatóköre — ugyanaz a mintázat, mint a [[021-stripe-fraud-defense]] opcionális backend-fázisa.

Enyhítő körülmény: az elhagyott fiók node-ja **senkinek nem okoz futásidejű költséget**, mert a `limitToLast` miatt még a tulajdonos visszatérésekor is csak 100 rekord jön át. A kár tisztán tárolási.

### 8.2 Törlés → `onValue` → újabb callback (végtelen ciklus)

A legvalószínűbb hibaforrás az implementációban. Védelem: a 3.5 három rétege — idempotencia (nulla törlendő → **nulla írás**), `pruneRunning` őr, 6 órás alsó korlát. A „nincs törlendő → nincs `update`" viselkedést **tesztnek kell rögzítenie**, mert ez a réteg némán elromolhat egy későbbi refaktornál (pl. ha valaki „biztonságból" mindig meghívja az `update`-et üres objektummal).

### 8.3 A `toastedIds` Set növekedése

A `useNotificationListener` `useRef<Set<string>>`-je a session során minden látott notification ID-t megjegyez. A `limitToLast` ezen **részben** segít: a feliratkozáskori kezdeti replay legfeljebb N ID-t tesz a Setbe a teljes előzmény helyett. A session **közbeni** növekedés viszont ettől független: minden új értesítés +1 elem.

Nagyságrendileg ártalmatlan (egy ID ~20 bájt; 10 000 üzenet is csak pár száz KB), de egy több napos AFK session esetén nem nulla. **Opcionális** későbbi finomítás: a Set felső korlátozása (pl. 500 elem, FIFO ürítéssel) — most szándékosan kimarad, hogy a hatókör szűk maradjon. A törölt rekordok ID-jai bent maradnak a Setben; ez ártalmatlan, mert a push ID-k egyediek, ugyanaz az ID sosem tér vissza.

### 8.4 Túl rövid megőrzési ablak → elveszett előzmény

Ha az ablak túl szűk, a felhasználó olyan értesítést veszít el, amit még nem nézett meg. Ez **konkrét veszély**, mert a `markAllNotificationsRead` a Barátok képernyő puszta megnyitásakor mindent olvasottra állít (015/0.5) — az „olvasott" flag optimista.

Emiatt (a) olvasatlant **soha** nem törlünk, (b) az ablak **7 nap**, nem 24 óra. Ha az érték valaha csökkenne, ezt a bekezdést kell újraolvasni.

### 8.5 A badge nem változhat a takarítástól

Invariáns: `pruneNotifications` **soha nem csökkentheti** az `unreadCount`-ot, mert olvasatlant nem töröl. Ha a takarítás bevezetése után a főmenü badge-e ugrálni kezd, az **bug**, nem várt viselkedés. Kézi tesztben ellenőrizni kell (F. blokk).

### 8.6 Teszt-mock törés

A `query` / `orderByKey` / `limitToLast` importok bevezetése a `userData.ts`-be **az összes** `userData.test.ts` tesztet elbuktatja, amíg a `vi.mock("firebase/database")` factory nem adja vissza őket — a Vitest a nem definiált named exportnál a modul betöltésekor hibázik, nem csak az érintett teszt futásakor. Ez első futásra rejtélyesnek látszó, teljes fájlt érintő bukás; az E. blokk első tétele emiatt van külön kiemelve.

### 8.7 A `markAllNotificationsRead` limitálatlan marad

Tudatos aszimmetria: a listener limitált, a „mindet olvasottra" művelet nem. Ha valaki később „konzisztenciából" ráteszi ugyanazt a `limitToLast`-ot, a limiten kívül eső olvasatlanok **örökre** olvasatlanok maradnának, és — az 1. szabály miatt — örökre a node-ban is. Kommentben rögzíteni kell.

---

## 9. Becsült ráfordítás

| Blokk | Becslés |
|---|---|
| A. Konstansok | ~10 perc |
| B. `pruneNotifications` | ~60 perc |
| C. `limitToLast` a listenerben | ~20 perc |
| D. Bekötés + ciklus-védelem | ~40 perc |
| E. Tesztek (mock-kiegészítés + 9 eset) | ~60 perc |
| F. Validáció + kézi próba | ~30 perc |
| **Összesen** | **~3.5 óra** |

---

**Kész definíció:**

- A `notifications/{uid}` node mérete korlátos: az olvasott rekordok 7 nap után eltűnnek, és a rekordszám normál használat mellett a 100-as plafon alatt marad.
- Olvasatlan értesítés **soha** nem törlődik automatikusan; a főmenü badge-e a takarítástól nem változik.
- A `subscribeNotifications` `limitToLast`-tal fut: egy `onValue` esemény legfeljebb `NOTIFICATION_SUBSCRIBE_LIMIT` rekordot hoz át, a takarítás állapotától függetlenül.
- A takarítás identitásonként egyszer indul az app betöltésekor, hosszú session esetén legfeljebb 6 óránként újra, és **soha nem indul újra a saját maga által kiváltott `onValue` eseményre**.
- Ha nincs törlendő, a takarítás **egyetlen írást sem** végez.
- A négy megőrzési paraméter a `src/constants/constants.ts`-ben él, JSDoc-kal indokolva.
- `database.rules.json` **nem módosult**, **nem kell deploy** — ez a tétel elkülönül a [[015-toast-notification]] nyitott deployjától.
- Nulla új i18n kulcs, a paritás marad 373/373.
- `tsc --noEmit` tiszta, `npm run test` zöld (a bővített `firebase/database` mockkal), `npm run build` sikeres.
