---
title: "Firebase guest→fiók merge egyszeri kapu + figyelmeztetések"
slug: 010-firebase-guest-merge-single-gate
type: plan
category: auth
status: implemented
implemented: true
implemented_at: "2026-07-28"
created_at: "2026-07-27"
updated_at: "2026-07-28"
author: exphoenee
step: 10
phases: []
dependencies:
  - 009-firebase-identity-split-bugfix
related_plans:
  - 004-firebase-auth-bugfix
  - 005-ingame-shop-strapi-stripe
  - 012-wall-of-shame
  - 021-stripe-fraud-defense
  - 023-stripe-go-live
tags:
  - firebase
  - auth
  - rtdb
  - bugfix
  - guest-merge
  - wallet
  - data-integrity
  - device-map
  - i18n
---

# Firebase guest→fiók merge egyszeri kapu + figyelmeztetések

**Cél:** a [[009-firebase-identity-split-bugfix]] által bevezetett per-`deviceId` `migratedFrom` idempotencia-jelölés **adatvesztő** viselkedésének felszámolása. A guest→regisztrált-fiók beolvasztás **fiók-szintű, életében-egyszer** kapuvá alakul (`profile/guestMergeClaimed`), az **első** merge a vendég kreditet és tárgyait **hozzáadja** a fiókhoz, a további merge-kísérletek **blokkolódnak** (figyelmeztetéssel), a `device_map` szivárgás minden ágon megszűnik, és a felhasználó **vásárláskor** figyelmeztetést kap a vendég-adat elvesztésének kockázatáról.

> ⚠️ **Ez a terv a [[009-firebase-identity-split-bugfix]] FOLYTATÁSA/JAVÍTÁSA, és a [[021-stripe-fraud-defense]] + [[023-stripe-go-live]] ELŐFELTÉTELE.** A 009 megszüntette a `deviceId`-rotációt — ezzel viszont az idempotencia-jelölés (`migratedFrom/{deviceId}`) **csapdává** vált: a visszatérő, változatlan `deviceId`-n frissen vásárolt vendég-kredit a következő Google-belépéskor **nyomtalanul törlődik**. Valós pénzes kredit ([[021-stripe-fraud-defense]], [[023-stripe-go-live]]) ilyen adatvesztés fölé nem tehető.

---

## Tünet (valós, éles RTDB-ből, admin olvasással megerősítve)

| Bizonyíték | Éles állapot |
|---|---|
| `users` node | **EGYETLEN** kulcs: `MCyVmgd2yGYM5IWBTxA8WJHYHPu2` (Google user), `wallet.credits = 0` |
| `profile.migratedFrom` | `{ 7e7e74de: true, b458ab5f: true }` — a guest node-ok (`7e7e74de`, `b458ab5f`) beolvadtak és **törlődtek** |
| `device_map` | **5 ÁRVA** bejegyzés, mind → `MCyVmgd2…`; köztük `7e7e74de`, ami egyszerre van a `migratedFrom`-ban **ÉS** a `device_map`-ben |
| Auth | **22 anonim** auth-user halmozódott fel (kliensről **NEM** törölhető — lásd 7.4) |

**Reprodukció (felhasználó által igazolva):** guestként vett **2000** kreditet (megkapta `users/{deviceId}/wallet`-re), majd Google-lel visszalépett → a kredit **eltűnt** (se átvitel, se `orphanDiscardedCredits` audit).

---

## A gyökérok (kódszinten)

### [1] ADATVESZTÉS — `src/firebase/userData.ts` idempotencia-ág (kb. 213–217. sor)

```ts
if (targetData.profile?.migratedFrom?.[deviceId] === true) {
  await cleanupGuestNode(db, deviceId); // TÖRLI a guest node-ot merge ÉS audit NÉLKÜL
  return true;
}
```

A 009 megszüntette a `deviceId`-rotációt (`clearDeviceId` törölve, `src/firebase/deviceId.ts:25-27`), így kijelentkezés után **ugyanaz a `deviceId`** jön vissza. A guestként **frissen** vásárolt kredit a `users/{deviceId}/wallet`-re kerül, de a következő Google-belépéskor a `migrateGuestData` az **idempotencia-ágra** fut (`migratedFrom[deviceId] === true`) → `cleanupGuestNode` **törli** a guest node-ot **merge és audit nélkül**. Az `orphanDiscardedCredits` audit (009) itt **nem** fut le, mert az idempotencia-ág a merge-számítás **előtt** visszatér.

### [2] `device_map` szivárgás — `cleanupGuestNode` nem törli a mappinget

A `cleanupGuestNode` (`userData.ts:347-361`) **csak** a `users/{deviceId}` gyerekeket törli, a `device_map/{deviceId}`-t **nem**. Az `ensureDeviceMap` viszont **minden** Google-belépéskor újraírja (`authBootstrap.ts:104`) → a mapping-ek **halmozódnak** (a mostani 5 árva bejegyzés innen ered). A 009 fő merge-ága törli a `device_map`-et, de az **idempotencia-ág** (`cleanupGuestNode`) **nem**.

### [3] UI félrevezetés — `src/components/screens/SettingsScreen.tsx`

A `deviceId`-t jeleníti meg **„User ID"** (`settings.userId`) néven a bejelentkezett fiók blokkjában is (`:32` selector, `:212`, `:215`, `:216`, `:221` render). Bejelentkezve a **valós `rtdbKey`/uid**-ot kellene mutatnia — az van `:33`-on kiolvasva (`selectRtdbKey`), de a kijelzés a `deviceId`-t használja.

---

## Döntések (egyeztetve)

| Kérdés | Választás |
|--------|-----------|
| **Kapu típusa** | **Fiók-szintű** `users/{uid}/profile/guestMergeClaimed: true` (bool), **NEM** per-`deviceId` map. Egy regisztrált fiók **életében CSAK EGYSZER** olvaszthat be vendég fiókot. |
| **Első merge** (flag nincs, van guest node) | A vendég kredit **ÖSSZEADÓDIK** a fiók walletjéhez (`target.credits + guest.credits`); az `inventory` (ships/music/exoplanets) **unió**; `stats` **max**; `settings` csak ha a targetnek nincs. Ezután: **flag beállítása**, guest node törlése, `device_map/{deviceId}` törlése — **egyetlen atomikus** multi-path update-ben. |
| **Ismételt merge** (flag már beállítva, van guest node) | **NINCS** kredit/tárgy átvétel. Figyelmeztetés a felhasználónak: „Csak egy vendég fiók olvasztható be." A guest node ilyenkor is **törlendő**, és a `device_map/{deviceId}` is. (A felhasználó a vásárláskor már figyelmeztetve lett.) Audit: a nem-nulla vendég-kredit `profile/orphanDiscardedCredits/{deviceId}`-re kerül (visszakövethetőség). |
| **Vendég-vásárlás figyelmeztetés** | Anonim (`isAnonymous`) user a kredit-vásárlás fülön: „A vendégként vásárolt kreditek és tárgyak elvesznek, ha nem regisztrálsz; és csak EGYSZER, EGY vendég fiókból vihetők át." |
| **`device_map` szivárgás** | **MINDEN** ág (első merge, ismételt-blokkolt, legacy takarítás) törli a `device_map/{deviceId}`-t is. |
| **Settings azonosító-kijelzés** | Bejelentkezve a valós `rtdbKey`/uid látszódjon; a `deviceId` **max. külön, guest kontextusban**. |
| **`migratedFrom` sorsa** | **Legacy/deprecated.** A meglévő nem-üres `migratedFrom` map **„már beolvasztott"-nak** számít (visszafelé kompatibilitás), de **új** kódútvonal már **nem** ír bele — helyette a `guestMergeClaimed` bool. |
| **RTDB rules** | **Nincs új rule.** A `guestMergeClaimed` a `profile/*` alá esik, amit a `database.rules.json` ma is `.write`-tal fed. Csak **séma-komment** a `security.rules.json`-ban. |
| **Végrehajtási branch** | `develop` (a `main` nem tartalmazza a Firebase integrációt). |

---

## ✅ Haladás (TODO)

> Jelölés: `[x]` hátravan · `[~]` folyamatban · `[x]` kész.

**A. Fiók-szintű merge-kapu (`migratedFrom` map → `guestMergeClaimed` bool)**
- [x] `src/firebase/userData.ts` — `UserNode.profile` +`guestMergeClaimed?: boolean` (a `migratedFrom` **legacy** kommenttel megmarad, de nem íródik újra)
- [x] Kapu-olvasás segédfüggvény: `isGuestMergeClaimed(targetData)` = `targetData?.profile?.guestMergeClaimed === true || Object.keys(targetData?.profile?.migratedFrom ?? {}).length > 0` (a legacy map „claimed"-nek számít)
- [x] `security.rules.json` — séma-komment: `profile.guestMergeClaimed` (új), `profile.migratedFrom` **DEPRECATED (legacy)** megjegyzés

**B. `migrateGuestData` újraírás — első merge = ÖSSZEADÁS, ismételt = BLOKK + takarítás**
- [x] Visszatérési típus: `boolean` → **`MergeResult`** (`"noop" | "blocked" | { kind: "merged"; addedCredits }`) — lásd 2.2
- [x] `if (deviceId === targetUid)` → `{ kind: "noop" }`; nem létező/üres guest node → `{ kind: "noop" }`, **semmilyen írás**
- [x] **Kapu:** `isGuestMergeClaimed(targetData) === true` → **BLOKK-ág**: nincs wallet/inventory átvétel; guest node + `device_map/{deviceId}` törlés; nem-nulla vendég-kredit → `console.warn` + `profile/orphanDiscardedCredits/{deviceId}` audit; `{ kind: "blocked" }`
- [x] **Első merge** (kapu nyitva, van guest node): `users/{uid}/wallet/credits = (target.credits ?? 0) + (guest.credits ?? 0)`
- [x] Inventory **unió** (`ships`/`music`/`exoplanets`, csak `=== true`, csak ha a targeten még nem `true`)
- [x] Stats **max** (`bestServiceSeconds`)
- [x] Settings: csak ha a targetnek **egyáltalán nincs** `settings` ága; `profile.nickname`/`createdAt`: csak ha a targeten nincs
- [x] **Flag beállítása:** `users/{uid}/profile/guestMergeClaimed = true`
- [x] Guest node **tényleges** gyerekei (`Object.keys(guestSnapshot.val())`) → `null`; `device_map/{deviceId} = null`
- [x] **Egyetlen** `update(ref(db), updates)` root multi-path írás; `undefined` **tilos**; **csak leaf-szintű** kulcsok, **átfedő útvonal tilos**
- [x] Ha a root-update rules-okon elhasal → dokumentált **lépésenkénti** fallback (2.3, a 009 mintája szerint)
- [x] `cleanupGuestNode` bővítése / kiváltása: a `device_map/{deviceId}` törlése **mindig** benne legyen

**C. `authBootstrap` — a `MergeResult` felszínre hozása**
- [x] `src/firebase/authBootstrap.ts:116` — a `migrateGuestData` visszatérése `MergeResult`
- [x] `{ kind: "blocked" }` → `useAuthStore.setMergeNotice("login.guestMergeAlreadyClaimed")` (informatív, **nem** `authError`)
- [x] `{ kind: "merged" }` → `console.log("Guest data merged", addedCredits)`; a `seedWallet` logika változatlan (a merge írja a wallet-et, az `ensureUserNode` exists-ága nem seedel újra — lásd 2.4)
- [x] Kivétel esetén továbbra is `migrationPending = true` + `setAuthError` (a 009 viselkedés marad)

**D. `device_map` szivárgás javítása**
- [x] Minden ág (első merge / blokkolt / legacy) az atomikus update-ben törli a `device_map/{deviceId}`-t is
- [x] A `cleanupGuestNode`-nak **soha** ne maradjon `device_map`-et nem törlő útvonala

**E. SettingsScreen azonosító-kijelzés**
- [x] `src/components/screens/SettingsScreen.tsx` — a **bejelentkezett** blokk (`authUser && !isAnonymous`) a `rtdbKey`-t (uid) jelenítse meg `settings.userId` címkével
- [x] A **guest** blokk a `deviceId`-t jelenítse meg **külön** `settings.guestId` címkével
- [x] `handleCopyUid` a kontextusnak megfelelő azonosítót másolja (bejelentkezve uid, guestként deviceId)

**F. Vendég-vásárlás figyelmeztetés (shop UI)**
- [x] `src/components/shop/CreditShopView.tsx` — ha `useAuthStore(s => s.isAnonymous)` → figyelmeztető sáv a kredit-pakkok fölött (`shop.credits.guestWarning`)
- [x] `src/components/screens/SettingsScreen.tsx` (vagy a login felület) — a `mergeNotice` megjelenítése egyszer (`login.guestMergeAlreadyClaimed`), majd `setMergeNotice(null)`

**G. i18n — ÚJ kulcsok mind az 5 nyelven (`en`, `hu`, `fr`, `de`, `es`)**
- [x] `shop.credits.guestWarning` (vendég-vásárlás figyelmeztetés)
- [x] `login.guestMergeAlreadyClaimed` (ismételt merge blokk üzenet)
- [x] `settings.guestId` (guest azonosító címke)
- [x] Teljes paritás mind az 5 fájlban ([[000-i18n-nyelvesites]])

**H. `useAuthStore` — értesítés-mechanizmus**
- [x] `src/state/useAuthStore.ts` — +`mergeNotice: string | null`, +`setMergeNotice(msg: string | null)`
- [x] `clearUser` resetelje a `mergeNotice`-t

**I. Tesztek**
- [x] `src/firebase/userData.test.ts` (a 009 firebase-mock mintája szerint bővítve)
  - [x] első merge: `target 500 + guest 2000` → `wallet/credits === 2500`; `guestMergeClaimed === true`; guest node + `device_map` törölve; `{ kind: "merged", addedCredits: 2000 }`
  - [x] első merge, target `wallet` nélkül: `guest 2000` → `wallet/credits === 2000`
  - [x] ismételt merge: `guestMergeClaimed === true`, `guest 2000` → **nincs** `wallet/credits` írás; guest node + `device_map` törölve; `orphanDiscardedCredits/{deviceId} === 2000`; `{ kind: "blocked" }`
  - [x] legacy: `migratedFrom: { x: true }`, nincs `guestMergeClaimed` → **blokk**-ág (claimed)
  - [x] guest node nélkül → `{ kind: "noop" }`, **semmilyen** írás
  - [x] `deviceId === targetUid` → `{ kind: "noop" }`
  - [x] inventory unió + stats max (első merge)
  - [x] `device_map/{deviceId} === null` **minden** guest-node-t érintő ágban (merged **és** blocked)
  - [x] `Object.values(updates)` egyetlen `undefined`-ot sem tartalmaz; nincs prefix-átfedő útvonalpár
- [x] `src/firebase/authBootstrap.test.ts` — `{ kind: "blocked" }` → `getState().mergeNotice === "login.guestMergeAlreadyClaimed"`; `{ kind: "merged" }` → nincs `mergeNotice`
- [x] `npm run test` + `npm run build` + `npm run build:gh-pages` + `tsc --noEmit` — zöld

**J. Egyszeri kézi takarítás (a mostani éles állapotra)**
- [x] Firebase Console → RTDB: a **5 árva** `device_map` bejegyzés törlése (mind → `MCyVmgd2…`, köztük `7e7e74de`, `b458ab5f`)
- [x] Opcionális (felhasználó dönt): a reprodukcióban elvesztett **2000** kredit kézi jóváírása a `users/MCyVmgd2yGYM5IWBTxA8WJHYHPu2/wallet/credits`-re
- [x] Opcionális: `users/MCyVmgd2…/profile/guestMergeClaimed = true` beállítása + a legacy `migratedFrom` map törlése (a kód enélkül is „claimed"-nek látja)
- [x] Dokumentálva: a **22 anonim auth-user** kliensről **nem** törölhető (Admin SDK / Cloud Function kellene, ami a Spark-terv szerint nincs — 7.4)

**K. Dokumentáció / kereszthivatkozás**
- [x] `database.rules.json` — regenerálva a `security.rules.json`-ból (tartalmi változás **nincs**)
- [x] [[009-firebase-identity-split-bugfix]] — additív kereszthivatkozás erre a tervre (a `migratedFrom` idempotencia csapdája)
- [x] [[021-stripe-fraud-defense]] — a wallet-növekmény-limit forward-compat pont frissítése (7.2)
- [x] `.claude/lessons-learned.md` — bejegyzés: „a rotáció megszüntetése után a per-deviceId idempotencia-jelölés adatvesztő lett"

**L. Stripe-visszatérési kredit-jóváírási race javítása (kifizetett kredit nem veszhet el) — lásd 11.**
- [x] `src/firebase/userData.ts` — új `incrementUserWallet(uid, delta)` **`runTransaction`**-nel a `users/{uid}/wallet/credits` node-on: updater `current => (current ?? 0) + delta`; `runTransaction` import a `firebase/database`-ből; visszatér az új (szerveroldali) egyenleggel. **NEM** `set()`-tel felülír (szemben a jelenlegi `updateUserWallet`-tel, `userData.ts:471–478`)
- [x] `src/components/shop/ShopScreen.tsx` — a pending-feldolgozó `useEffect` (34–74) **kapu**-vá alakítása: csak akkor dolgozza fel a pendinget, ha **(a)** az auth kész (`useAuthStore` `status !== "loading"`, a hitelesített user ismert — nem tranziens null/guest) **ÉS (b)** `useShopStore` `creditsLoaded === true` (az első `subscribeUser`/`handleUserData` szinkron lefutott). Amíg ezek nem teljesülnek: **NE** dolgozza fel, a pending **maradjon** a storage-ban (TTL-en belül)
- [x] `ShopScreen` — az effekt dependency-listája `[]` helyett tartalmazza az `authStatus`-t és a `creditsLoaded`-et, hogy az állapotváltozás (auth ready / creditsLoaded true) **újratriggerelje** a feldolgozást
- [x] `ShopScreen` — a jóváírás `incrementUserWallet(getRtdbKey(), pack.credits)`-t hívjon a stale-lokális-összeadó `buyCredits(pack.id)` **helyett** (`ShopScreen.tsx:63`); a lokális `credits` a tranzakció eredményéből / a soron következő `onValue` szinkronból frissüljön, ne stale-lokális összeadásból
- [x] **Idempotencia:** a pending kulcs törlése (`sessionStorage` + `localStorage`) CSAK a `incrementUserWallet` **sikeres** Promise-a után; feldolgozás-közbeni marker (modul-szintű `processingPending` ref és/vagy a `PENDING_PURCHASE_KEY` objektumba írt `claimedAt`) a dupla mount / React StrictMode / kétszeri visszatérés ellen — ugyanaz a pending **kétszer nem** íródhat jóvá
- [x] **Hitelesített kulcs:** a jóváírás a `selectRtdbKey`/`getRtdbKey` szerinti **hitelesített** uid-ra menjen; anonim (guest) vásárlás guest node-ra — de a kapu (auth-ready) garantálja, hogy tranziens `loading`/null auth-állapotban **NE** íródjon a guest `deviceId`-node-ra bejelentkezett vásárlásnál (a guest-vásárlás figyelmeztetés — F blokk — itt is érvényes)
- [x] `src/state/useShopStore.ts` — a Stripe-visszatérési kredit-jóváírási út **ne** a `set()`-alapú `updateUserWallet`-en menjen (`buyCredits`, 132–142); dokumentáld a két utat: `buyCredits` marad a debug/azonnali (nem-Stripe) jóváíráshoz, a Stripe-flow az atomikus `incrementUserWallet`-et használja (opcionálisan a `buyCredits` is átállítható inkrementre a `creditSuccess`-út egységesítéséhez)
- [x] i18n (**opcionális**, lásd 11.4) — csak ha a „jóváírás folyamatban / várakozás a szinkronra" jelzést hozzáadjuk (`shop.credits.creditPending`); ha nem, nem kell új kulcs
- [x] `src/firebase/userData.test.ts` — `incrementUserWallet`: `runTransaction` updater `2000 + 2000 → 4000` (NEM 2000); `null/undefined + 300 → 300`; `0 + 2000 → 2000`
- [x] `ShopScreen` pending-feldolgozás teszt — **stale-egyenleg regresszió:** szerveren meglévő 2000, 2000-es pakk pending → végeredmény **4000**, NEM 2000
- [x] Teszt: auth **nem kész** (`status === "loading"`) → a pending **nem** dolgozódik fel, guest `deviceId`-node-ra **nem** ír; auth-ready + `creditsLoaded` váltás után **egyszer** lefut a hitelesített uid-ra
- [x] Teszt: `creditsLoaded === false` → nem dolgoz fel; `true`-ra váltáskor triggerel (dependency-alapú újrafutás)
- [x] Teszt: **dupla feldolgozás** (kétszeri mount / StrictMode / kétszeri `/shop/success` visszatérés) → **pontosan egyszer** ír, nincs duplikáció; a pending kulcs csak siker után törlődik
- [x] `npm run test` + `npm run build` + `npm run build:gh-pages` + `tsc --noEmit` — zöld (L blokk)

---

## 1. Architektúra

### 1.1 A kapu-modell váltás: `migratedFrom` map → `guestMergeClaimed` bool

**009 (jelenlegi, hibás):** per-`deviceId` `migratedFrom/{deviceId}: true`. Mivel a `deviceId` **nem rotálódik** (009 döntés), ugyanaz a `deviceId` visszatér, és a második merge az **idempotencia-ágra** fut → a friss vendég-kredit **törlődik**.

**Ez a terv (helyes):** fiók-szintű `profile/guestMergeClaimed: true`. A kapu **a fiókhoz**, nem a `deviceId`-hez kötött → **egy** regisztrált fiók **életében egyszer** olvaszthat be vendéget. A visszatérő `deviceId` friss vendég-kredite már a **BLOKK**-ágra fut (audit + takarítás), nem tűnik el csendben.

**Visszafelé kompatibilitás:** a meglévő nem-üres `migratedFrom` map (pl. `MCyVmgd2…`) **„claimed"-nek** számít. Így a mostani egyetlen éles fiók a deploy után rögtön helyesen viselkedik (minden további vendég-belépés blokkolt merge + takarítás).

### 1.2 A `migrateGuestData` új szerződése

```
migrateGuestData(deviceId, targetUid) → Promise<MergeResult>

type MergeResult =
  | { kind: "noop" }                              // deviceId === targetUid, vagy nincs guest node
  | { kind: "blocked" }                           // kapu zárva → NINCS átvétel, guest + device_map takarítva
  | { kind: "merged"; addedCredits: number };     // első merge → kredit ÖSSZEADVA + tárgyak
```

**Lépések:**

1. `if (deviceId === targetUid) return { kind: "noop" }`
2. `get(users/{deviceId})` → ha nem létezik/üres: `{ kind: "noop" }`
3. `get(users/{targetUid})` → `targetData: DeepPartial<UserNode> | null`
4. **Kapu:** `isGuestMergeClaimed(targetData)` → **BLOKK-ág** (5. kihagyva), csak takarítás + audit → `{ kind: "blocked" }`
5. **Merge-számítás** (a snapshot-objektumot **nem** mutáljuk, csak leaf-kulcsokat gyűjtünk):

| Ág | **Első merge** politika | **Blokk** politika |
|---|---|---|
| `wallet.credits` | `= (target.credits ?? 0) + (guest.credits ?? 0)` (**ÖSSZEADÁS**) | **nincs** wallet-írás; `guest.credits > 0` → `console.warn` + `orphanDiscardedCredits/{deviceId}` |
| `inventory.{ships,music,exoplanets}` | **unió** (csak `=== true`, csak ha a targeten még nem az) | — |
| `stats.bestServiceSeconds` | **max** | — |
| `settings` | csak ha `targetData?.settings === undefined` | — |
| `profile.nickname` / `createdAt` | csak ha a targeten nincs | — |
| `profile.guestMergeClaimed` | `= true` | `= true` (idempotens; ha már true, ártalmatlan) |

6. **Takarítás (mindkét nem-noop ágban):** guest node tényleges gyerekei → `null`; `device_map/{deviceId} = null`
7. **Egyetlen** `update(ref(db), updates)` root multi-path írás

> 🔁 **Bővítés (2026-07-28, [[012-wall-of-shame]] Q. blokk):** a `migrateGuestData` a **Szégyenfalat** is átviszi: `collectGuestWallUpdates(db, deviceId, targetUid)` a `walls/{deviceId}/failures|successes` rekordokat **eredeti push ID-kkal** másolja `walls/{targetUid}` alá (idempotens overwrite), majd a forrás ágat törli. Három eltérés a kredit/tárgy-politikától:
> 1. **A falrekordok nem „valuta"** → a `"blocked"` (már claimelt) ágban **is** átmigrálnak; a `guestMergeClaimed` kapu **nem** vonatkozik rájuk, és nem keletkezik `orphanDiscardedCredits`-szerű audit.
> 2. **A guest `users/{deviceId}` node hiánya nem akadály** — a fal akkor is migrál, ha a user node már nem létezik (különben egy korábbi takarítás után a fal örökre elveszne).
> 3. **Külön retry:** ha a fő atomi root multi-path update elhasal, az `executeAtomicUpdate` fallback ága a fal-írást **külön** újrapróbálja (2.3 „B" forgatókönyv szellemében).
>
> **Miért kell egyáltalán?** A barát-rendszer ([[013-social-multiplayer]]) `auth.uid`-del kulcsol, a vendég fala viszont a `deviceId` alatt keletkezik → migrálás nélkül a váltás után láthatatlan maradna.

**Két kötelező hibaosztály-védelem (009-ből átvéve):**

- **`undefined` tilos** — az RTDB `update` `undefined`-ra dob; minden mező **feltételesen** kerül be.
- **Átfedő útvonalak tilosak** — kizárólag **leaf-szintű** kulcsok a targetre; a guest-törlésnél a top-level gyerekek a leafek (más `$key`, nincs átfedés).

### 1.3 A wallet-politika változása a 009-hez képest — és ami miatt biztonságos

A 009 wallet-politikája **„target győz"** volt (a guest kredit sosem adódott hozzá). Ez a terv **első merge-nél ÖSSZEAD**. A duplázás/visszaélés ellen **két** független mechanizmus véd:

1. **Fiók-flag:** `guestMergeClaimed` → egy fiók életében **egyetlen** összeadó merge lehet.
2. **Guest node törlése:** a beolvadt guest node megszűnik → nincs miből újra összeadni.

A **`deviceId`-rotáció elhagyása** (009) így **helyes marad** — a rotáció szerepét a fiók-flag veszi át; a per-`deviceId` jelölés csapdája viszont megszűnik.

### 1.4 A `seedWallet` és a merge-sorrend

A `authBootstrap` sorrendje változatlan: `ensureDeviceMap` → `migrateGuestData` → `ensureUserNode` → `subscribeUser`. Az **első** Google-belépéskor a `migrateGuestData` **előbb** ír `wallet/credits`-et (a target node ekkor még nem létezik → `target.credits = 0`, az összeg = guest kredit), majd az `ensureUserNode` az **exists-ágra** fut (a node már létezik) → **nem** seedel újra wallet-et. A 009 `seedWallet` opció **változatlanul** marad (kivétel-ág = `migrationPending` → `seedWallet: false`).

### 1.5 Atomikus root multi-path update — engedik-e a rules?

**Igen, új rule nélkül.** A `guestMergeClaimed` a `profile/*` alá esik, amit a `database.rules.json` `.write`-ja fed (`$key == auth.uid` ág). A guest-törlés + `device_map/{deviceId}: null` biztonságos ugyanabban a tranzakcióban: a `.write` a **művelet ELŐTTI** állapot (`root`) alapján értékelődik, így az `device_map/{deviceId}` ugyanebben az update-ben történő törlése **nem** vonja ki a `users/{deviceId}` írásjog alól (009 2.3 elemzés). **Előfeltétel:** az `ensureDeviceMap(deviceId, uid)` a merge **előtt** lefutott (ma is így van, `authBootstrap.ts:104`).

**„B" forgatókönyv (ha a root-update elhasal, pl. [[021-stripe-fraud-defense]] wallet-limit után):** lépésenkénti, rollback-barát sorrend (009 2.3): (1) `update(users/{targetUid}, { …leaf…, "profile/guestMergeClaimed": true })`, (2) guest node gyerekek `null`, (3) `set(device_map/{deviceId}, null)`. Egy megszakadás után a következő belépés a **blokk-ágon** újrapróbálja a takarítást — adatvesztés/duplázás nélkül.

---

## 2. Fájlstruktúra

### Módosuló fájlok
```
src/firebase/userData.ts                   # UserNode.profile.guestMergeClaimed; migrateGuestData → MergeResult; cleanupGuestNode + device_map
src/firebase/authBootstrap.ts              # MergeResult kezelés; mergeNotice; seedWallet változatlan
src/state/useAuthStore.ts                  # +mergeNotice, +setMergeNotice; clearUser reset
src/firebase/userData.ts                   # (11.) +incrementUserWallet (runTransaction) — atomikus wallet-inkrement
src/components/shop/ShopScreen.tsx         # (11.) pending-feldolgozás: kettős kapu (auth-ready + creditsLoaded) + incrementUserWallet + siker-utáni takarítás/idempotencia
src/state/useShopStore.ts                  # (11.) Stripe-flow: set()-alapú updateUserWallet helyett atomikus inkrement; buyCredits marad a debug/nem-Stripe úton
src/components/screens/SettingsScreen.tsx  # bejelentkezve uid/rtdbKey, guestként deviceId; mergeNotice megjelenítés
src/components/shop/CreditShopView.tsx     # isAnonymous → guestWarning sáv
src/i18n/locales/{en,hu,fr,de,es}/translation.json   # 3 új kulcs, teljes paritás
security.rules.json                        # séma-komment: guestMergeClaimed (új), migratedFrom (deprecated)
database.rules.json                        # regenerálva (tartalmi változás NINCS)
.claude/lessons-learned.md                 # bejegyzés
plans/009-firebase-identity-split-bugfix.md  # kereszthivatkozás (additív)
plans/021-stripe-fraud-defense.md          # forward-compat pont frissítés (a manage-roadmap rendezi a YAML-t)
```

### Bővülő tesztfájlok
```
src/firebase/userData.test.ts        # merge/blokk/noop/legacy esetek; (11.) incrementUserWallet runTransaction updater
src/firebase/authBootstrap.test.ts   # mergeNotice felszínre hozás
src/components/shop/ShopScreen.test.tsx  # (11.) pending-feldolgozás: kapu, stale-regresszió, dupla-mount idempotencia
```

### RTDB séma-kiegészítés (nincs rules-változás)
```
users/{uid}/profile/
  guestMergeClaimed:                 true      # ÚJ — fiók-szintű egyszeri kapu
  migratedFrom/{deviceId}:           true      # DEPRECATED (legacy) — nem íródik újra
  orphanDiscardedCredits/{deviceId}: <number>  # audit: elesett vendég-kredit (blokk-ág)
```

---

## 3. Függőségek

- **Előfeltétel:** [[009-firebase-identity-split-bugfix]] — annak `migrateGuestData` / `rtdbKey` / self-healing kódját javítja/folytatja (a per-`deviceId` idempotencia csapdáját).
- **Blokkolja:** [[021-stripe-fraud-defense]] és [[023-stripe-go-live]] — mindkettő a `wallet` node integritására épül; valós pénzes kredit nem mehet adatvesztő merge fölé.
- **Érinti:** [[005-ingame-shop-strapi-stripe]] — a kredit-jóváírás célútvonala (`users/{rtdbKey}/wallet/credits`); [[004-firebase-auth-bugfix]] — az eredeti guest→Google migráció és `deviceId`-modell.
- **Kézi lépések:** Firebase Console (J blokk: 5 árva `device_map` törlés, opcionális kredit-jóváírás, opcionális flag-beállítás).
- **Végrehajtási branch:** `develop`.

---

## 4. i18n — ÚJ kulcsok (mind az 5 nyelv)

> Teljes paritás kötelező (`en`, `hu`, `fr`, `de`, `es`) — az `i18n` agent feladata. A `shop.credits` **object namespace** (a string a `shop.creditsLabel`), a `guestWarning` **nested** string alá kerül — ez konzisztens.

| Kulcs | en | hu |
|---|---|---|
| `shop.credits.guestWarning` | Heads up: credits and items bought as a guest are lost unless you sign in. Guest progress can be transferred to a registered account only once, from a single guest account. | Figyelem: a vendégként vásárolt kreditek és tárgyak elvesznek, ha nem jelentkezel be. A vendég haladás csak egyszer, egyetlen vendég fiókból vihető át regisztrált fiókba. |
| `login.guestMergeAlreadyClaimed` | Only one guest account can be merged into a registered account. Your recent guest purchases could not be transferred. | Csak egy vendég fiók olvasztható be egy regisztrált fiókba. A legutóbbi vendég vásárlásaid nem kerültek átvitelre. |
| `settings.guestId` | Guest ID | Vendég azonosító |

| Kulcs | fr | de | es |
|---|---|---|---|
| `shop.credits.guestWarning` | Attention : les crédits et objets achetés en tant qu'invité sont perdus si vous ne vous connectez pas. La progression d'invité ne peut être transférée qu'une seule fois, depuis un seul compte invité. | Achtung: Als Gast gekaufte Credits und Gegenstände gehen verloren, wenn du dich nicht anmeldest. Gastfortschritt kann nur einmal, von einem einzigen Gastkonto, übertragen werden. | Atención: los créditos y objetos comprados como invitado se pierden si no inicias sesión. El progreso de invitado solo se puede transferir una vez, desde una única cuenta de invitado. |
| `login.guestMergeAlreadyClaimed` | Un seul compte invité peut être fusionné dans un compte enregistré. Vos achats récents en tant qu'invité n'ont pas pu être transférés. | Nur ein Gastkonto kann mit einem registrierten Konto zusammengeführt werden. Deine letzten Gastkäufe konnten nicht übertragen werden. | Solo se puede fusionar una cuenta de invitado con una cuenta registrada. Tus compras recientes como invitado no se pudieron transferir. |
| `settings.guestId` | Identifiant invité | Gast-ID | ID de invitado |

Az `guestMergeClaimed` / `migratedFrom` / `orphanDiscardedCredits` **belső audit-mezők** — nincs i18n vonatkozásuk.

---

## 5. Kockázatok / figyelmeztetések / regresszió

### 5.1 Forward-compat a [[021-stripe-fraud-defense]] wallet-szabálya felé (frissített 009/7.2)

A 009 már rögzítette: a tervezett `wallet` növekmény-limit (`newData.val() <= data.val() + 2000`) szabálynak **null-safe** ágra van szüksége (`!data.exists()`). **Ez a terv tovább élezi:** az **első merge ÖSSZEAD**, így az egylépéses `wallet/credits` írás növekménye = a **vendég teljes kreditje**, ami több pakk vásárlásával **meghaladhatja a 2000⭐-ot**. A 011 wallet-limit szabályának ezért:

1. `!data.exists()` ág (első belépés / seedWallet) — kötelező;
2. **kivétel/kapu** az egyszeri guest-merge írásra (pl. a `guestMergeClaimed` `false→true` átmenetéhez kötött megengedőbb növekmény), **vagy** a merge-kredit **2000⭐-ra kapzsizása**.

⚠️ **Nyitott döntés** a 011 felé — lásd „Nyitott kérdések". A duplázás ellen a **flag + guest-node-törlés** véd, nem a limit; a limit itt inkább a merge-t **akadályozná**, ezért kell kivétel.

### 5.2 További kockázatok

- **A wallet-politika megfordul (target-győz → összead).** A 009 tesztjei, amelyek „a kredit nem adódik össze"-t vártak, **frissítendők** — ez a terv ezt a viselkedést **szándékosan** cseréli. A régi 009-teszteseteket ez a terv váltja ki (F blokk).
- **`mergeNotice` életciklus:** informatív, egyszer jelenik meg, majd nullázódik. Ne keveredjen az `authError`-ral (az hiba, ez tájékoztatás).
- **Legacy `migratedFrom` fals-pozitív:** ha egy fiókon **véletlen** `migratedFrom` bejegyzés van, a kód „claimed"-nek látja → a **legitim** első összeadó merge blokkolódhat. A mostani éles adatnál (`MCyVmgd2…`) ez a **kívánt** viselkedés (már beolvasztott). Új fiókokon `migratedFrom` már nem keletkezik.
- **Cross-origin árva node:** a 009 self-healing limitációja változatlan — a másik origin/gép árva node-ja csak onnan belépve gyógyul; szerveroldali söprés Admin SDK-t igényelne (nincs Spark-on).
- **Stale bundle:** ha a régi viselkedés látszik → **Ctrl+Shift+R** (Vite HMR, [[004-firebase-auth-bugfix]]).

### 5.3 22 anonim auth-user

A felhalmozódott anonim auth-userek **kliensről nem törölhetők** (`deleteUser` csak a **saját**, aktuális userre; idegen anonim userekhez Admin SDK / Cloud Function kell). A Spark-terv szerint **nincs** Cloud Functions → ez **dokumentált korlátozás**, nem tervezünk rá backendet. Kézi opció: Firebase Console → Authentication → egyesével törlés (fáradságos, de kockázatmentes; a hozzájuk tartozó `users/*` node-ok már beolvadtak/törlődtek).

### 5.4 Stripe-visszatérési kredit-jóváírási race (kifizetett kredit elveszik) — lásd 11.

A Payment Link-visszatérés utáni jóváírás jelenleg a mount-effektben **azonnal**, a szinkron **előtt**, `set()`-tel (felülírva) fut → a meglévő szerver-egyenleg elveszhet, és tranziens auth-állapotban a guest node-ra írhat. Javítás: **kettős kapu** (auth-ready + `creditsLoaded`) + **atomikus `runTransaction` inkrement** + **kliensoldali idempotencia** (11.3). Regresszió-veszély a jelenlegi `buyCredits` / `updateUserWallet` (`set()`) útra: ezt a Stripe-flow-ból ki kell váltani az inkrementre; a `buyCredits` a nem-Stripe (debug) úton maradhat. Ez a wallet-integritási ág a [[023-stripe-go-live]] élesítés előfeltétele; a szerveroldali `session_id`-ledger a [[021-stripe-fraud-defense]] hatóköre.

---

## 6. Egyszeri kézi takarítás — checklist a mostani állapotra

> **Sorrend:** először ellenőrzés/mentés, aztán törlés.

| # | Lépés | Hol |
|---|---|---|
| 1 | A **5 árva** `device_map` bejegyzés azonosítása (mind → `MCyVmgd2…`, köztük `7e7e74de`, `b458ab5f`) | Firebase Console → RTDB → `device_map` |
| 2 | Mind az 5 árva `device_map` bejegyzés **törlése** | Console |
| 3 | *(opcionális, felhasználó dönt)* A reprodukcióban elvesztett **2000** kredit **kézi jóváírása** → `users/MCyVmgd2yGYM5IWBTxA8WJHYHPu2/wallet/credits` | Console |
| 4 | *(opcionális)* `users/MCyVmgd2…/profile/guestMergeClaimed = true` + a legacy `migratedFrom` map törlése | Console |
| 5 | Dokumentálva: a **22 anonim auth-user** kliensről nem törölhető (5.3) | — |

> 💡 A kód a legacy `migratedFrom` miatt a `MCyVmgd2…` fiókot **enélkül is** „claimed"-nek látja, így a 4. lépés csak higiénia. A 3. lépés az **egyetlen** ténylegesen elvesztett érték helyreállítása — a felhasználó dönt róla.

---

## 7. Tesztelés

### 7.1 Automatizált (Vitest, a 009 firebase-mock mintája)

```ts
vi.mock("./config", () => ({ getFirebaseDB: () => ({}) }));
vi.mock("firebase/database", () => ({
  ref: (_db: unknown, path?: string) => ({ path: path ?? "" }),
  get: vi.fn(), update: vi.fn(async () => {}), set: vi.fn(async () => {}), onValue: vi.fn(),
}));
```

| # | Bemenet | Elvárás |
|---|---|---|
| 1 | első merge: target `wallet 500`, guest `wallet 2000` | `wallet/credits === 2500`; `profile/guestMergeClaimed === true`; guest node + `device_map/{deviceId}` **null**; `{ kind: "merged", addedCredits: 2000 }` |
| 2 | első merge: target `wallet` nélkül, guest `2000` | `wallet/credits === 2000` |
| 3 | ismételt: `guestMergeClaimed === true`, guest `2000` | **nincs** `wallet/credits` írás; guest node + `device_map` **null**; `orphanDiscardedCredits/{deviceId} === 2000`; `console.warn`; `{ kind: "blocked" }` |
| 4 | legacy: `migratedFrom: { x: true }`, nincs `guestMergeClaimed` | blokk-ág (claimed) |
| 5 | guest node nem létezik | `{ kind: "noop" }`, `update` **nem** hívva |
| 6 | `deviceId === targetUid` | `{ kind: "noop" }` |
| 7 | inventory: guest `{ships:{a:true}}`, target `{ships:{b:true}}` (első merge) | `inventory/ships/a === true`; `b` nem íródik újra |
| 8 | stats: guest 1200, target 900 (első merge) | `stats/bestServiceSeconds === 1200` |
| 9 | bármely nem-noop | `device_map/{deviceId} === null` benne van |
| 10 | bármely | `Object.values(updates)`-ban **nincs** `undefined`; `Object.keys(updates)`-ban nincs prefix-átfedés |

**`authBootstrap`:** `{ kind: "blocked" }` → `useAuthStore.getState().mergeNotice === "login.guestMergeAlreadyClaimed"`; `{ kind: "merged" }` → `mergeNotice` marad `null`; kivétel → `migrationPending`, `authError` beáll.

### 7.2 Kézi ellenőrzés

1. Anonim user a kredit-fülön → **guestWarning** sáv látszik; Google usernél **nem**.
2. **Első merge:** anonim → vesz 2000 kreditet → Google-belépés → a fiók walletje `korábbi + 2000`; `guestMergeClaimed === true`; guest node + `device_map` eltűnt.
3. **Ismételt merge:** kijelentkezés → guest újra vesz 500 kreditet → Google-belépés → **nincs** hozzáadás; **guestMergeAlreadyClaimed** üzenet; guest node + `device_map` takarítva; `orphanDiscardedCredits` audit megjelenik.
4. **Settings:** bejelentkezve az **uid** látszik (`settings.userId`); guestként a `deviceId` (`settings.guestId`).
5. `npm run test` + `npm run build` + `npm run build:gh-pages` + `tsc --noEmit` — zöld.

---

## 8. Becsült ráfordítás

| Blokk | Feladat | Nagyságrend |
|---|---|---|
| A–B | `guestMergeClaimed` kapu + `migrateGuestData` újraírás (összeadás/blokk/noop) | ~3–4 óra |
| C–D | `authBootstrap` `MergeResult` + `mergeNotice` + `device_map` szivárgás | ~1,5 óra |
| E–F | SettingsScreen uid-kijelzés + guestWarning sáv + mergeNotice UI | ~1,5 óra |
| G–H | i18n (3 kulcs × 5 nyelv) + `useAuthStore` mező | ~1 óra |
| I | Tesztek (merge/blokk/legacy/noop + authBootstrap) | ~2–3 óra |
| J–K | Kézi takarítás + dokumentáció/kereszthivatkozás | ~1 óra |
| L | Stripe-visszatérési race: `incrementUserWallet` + kettős kapu + idempotencia + tesztek (11.) | ~2,5–3 óra |
| — | Kézi ellenőrzés | ~1 óra |

**Összesen:** ~2 fejlesztői nap (az L blokk Stripe-visszatérési race-ágával együtt).

---

## 9. Kész definíció

- A guest→fiók beolvasztást **fiók-szintű** `profile/guestMergeClaimed` kapu vezérli; egy fiók **életében egyszer** olvaszt be vendéget.
- Az **első** merge a vendég kreditet **hozzáadja** (`target + guest`), a tárgyakat egyesíti; a **további** merge-kísérletek **blokkolódnak** (figyelmeztetéssel), **de** a guest node és a `device_map/{deviceId}` **minden** ágban törlődik — nincs több szivárgás.
- A visszatérő, változatlan `deviceId`-n vásárolt vendég-kredit **nem** tűnik el csendben: vagy összeadódik (első merge), vagy blokk + `orphanDiscardedCredits` audit (ismételt).
- A `migrateGuestData` **egyetlen `undefined`-ot sem** ír, **egyetlen atomikus** update-ben végez, és **idempotens** (`guestMergeClaimed`); a legacy `migratedFrom` visszafelé „claimed"-ként értelmezett.
- A `SettingsScreen` bejelentkezve a **valós uid/rtdbKey**-t mutatja, guestként a `deviceId`-t (`settings.guestId`).
- A kredit-vásárlás UI anonim usernek **figyelmezteti** a vendég-adat elvesztésének kockázatát (`shop.credits.guestWarning`), mind az 5 nyelven.
- A mostani **5 árva** `device_map` bejegyzés törölve; a 22 anonim auth-user korlátozása **dokumentálva**.
- `npm run test` (új/frissített esetek), `npm run build`, `npm run build:gh-pages`, `tsc --noEmit` — mind zöld.
- A [[021-stripe-fraud-defense]] wallet-limit **forward-compat pontja** (5.1) átvezetve.
- A **Stripe-visszatérési kredit-jóváírás** (11.) a fizetett kreditet **atomikus `runTransaction` inkrementtel** írja a **hitelesített** uid `wallet/credits` node-jára, **kettős kapu** (auth-ready + `creditsLoaded`) mögött; a normál flow-ban **nem veszít** (meglévő 2000 + 2000 pakk → 4000, nem 2000) és **nem duplikál** (dupla mount / StrictMode / kétszeri visszatérés esetén sem), tranziens auth-állapotban pedig **nem** ír a guest node-ra. A `set()`-alapú felülírás a Stripe-flow-ból eltűnt.

---

## 10. Kapcsolódó tervek

- [[009-firebase-identity-split-bugfix]] — **közvetlen előfeltétel.** Ez a terv annak per-`deviceId` `migratedFrom` idempotencia-csapdáját és a `device_map`-szivárgást javítja, és a wallet-politikát „target győz"-ről „első merge = összeadás + fiók-flag"-re cseréli.
- [[021-stripe-fraud-defense]] — **erre a tervre épül.** A wallet-növekmény-limit szabálynak `!data.exists()` ágra **és** az egyszeri guest-merge írás kivételére van szüksége (5.1).
- [[023-stripe-go-live]] — **erre a tervre épül.** Valós pénzes kredit nem indulhat adatvesztő guest-merge fölött.
- [[005-ingame-shop-strapi-stripe]] — a kredit-jóváírás célútvonala (`users/{rtdbKey}/wallet/credits`).
- [[004-firebase-auth-bugfix]] — az eredeti guest→Google migráció, `deviceId`-modell és `device_map` forrása.
- [[000-i18n-nyelvesites]] — a 3 új kulcs teljes paritása mind az 5 nyelven.
- [[012-wall-of-shame]] — **additív bővítés ezen a terven belül (2026-07-28).** A `migrateGuestData` a `walls/{deviceId}` → `walls/{targetUid}` áthelyezést is elvégzi (`collectGuestWallUpdates`, lásd 1.2 alatti megjegyzés). Ugyanitt derült ki, hogy a `walls/$uid` írási szabálynak a **`device_map` tulajdonlást** is engednie kell (`root.child('device_map').child($uid).val() == auth.uid`), különben a vendégnek egyáltalán nem íródik fal — ez ugyanaz a tulajdonlási minta, amit a `users` ág használ. Tesztek: 2 új eset a `userData.test.ts`-ben, plusz a `mockGet` `beforeEach`-beli explicit alapértelmezettje (teszt-izoláció).
- [[013-social-multiplayer]] — a barát-rendszer `auth.uid`-del kulcsol, ezért függ a vendég-fal migrációjától.

---

## 11. Stripe-visszatérési kredit-jóváírási race (kifizetett kredit elveszik)

> ⚠️ **Ez az ág a [[023-stripe-go-live]] ÉLESÍTÉS EGYIK ELŐFELTÉTELE** (dependency-lánc: 012 → 011 → 010). Valós pénzes kredit nem veszhet el a Stripe-visszatérés utáni jóváíráskor. Ugyanahhoz a wallet-integritáshoz tartozik, amit ez a terv úgyis érint (A–B blokk, `useShopStore` / `userData` wallet-írás); a robusztus **szerveroldali** `session_id`-ledger (`credit_claims/{sessionId}`) és a wallet-növekmény-limit a [[021-stripe-fraud-defense]] hatóköre — itt a **kliensoldali minimum** kell, ami a normál flow-ban **nem veszít és nem duplikál**.

### 11.1 Tünet (élő adatból + kódból igazolva)

Kredit-pakk Stripe Payment Linken vásárolva → visszatérés `/shop/success`-re → a kifizetett kredit **nem íródik jóvá**, sőt a meglévő egyenleg **csökkenhet / elveszhet**:

| Kiinduló szerver-egyenleg | Vásárolt pakk | Helyes eredmény | **Jelenlegi (hibás) eredmény** | Veszteség |
|---|---|---|---|---|
| 2000⭐ | 2000⭐ | 4000⭐ | **2000⭐** (látszólag nem adott hozzá) | 2000⭐ |
| 2000⭐ | 300⭐ | 2300⭐ | **300⭐** | 1700⭐ |
| 0⭐ | 2000⭐ | 2000⭐ | 2000⭐ (véletlenül helyes, mert 0 a kiinduló) | — |

### 11.2 Gyökérok (megerősített kódútvonal)

```
CreditShopView.handleBuy
  → pending mentés (sessionStorage + localStorage, PENDING_PURCHASE_KEY)
  → window.location.href = getPaymentLinkUrl(pack)        // átirányítás Stripe-ra
Stripe fizetés
  → visszatérés /shop/success                             // → TELJES OLDALÚJRATÖLTÉS
App.tsx (/shop/success)  → transitionTo("shop")
ShopScreen mount-useEffect (ShopScreen.tsx:34–74, dep=[]):
  → beolvassa a pendinget
  → useShopStore.getState().buyCredits(pack.id)           // AZONNAL, mount-kor
useShopStore.buyCredits (useShopStore.ts:132–142):
  newCredits = get().credits + pack.credits               // ← get().credits MÉG 0!
  set({ credits: newCredits })
  updateUserWallet(getRtdbKey(), newCredits)
userData.updateUserWallet (userData.ts:471–478):
  set(ref(db, `users/{uid}/wallet`), { credits })         // set() → FELÜLÍR, nem inkrementál
```

**Két egymásra rakódó race:**

1. **Egyenleg-race (fő ok):** az oldalújratöltés után a `ShopScreen` mount-effektje **azonnal** fut, **mielőtt** a `subscribeUser` → `handleUserData` → `setCredits` első RTDB-szinkronja lefutott volna (`creditsLoaded` még `false`, `credits` még `0`). Így `newCredits = 0 + pakk`, és az `updateUserWallet` a `set()` miatt a szerver-egyenleget **felülírja** erre az értékre → a meglévő kredit **elveszik**.
2. **Kulcs-race (másodlagos):** ha a Firebase auth az újratöltéskor még nem állította vissza a session-t (`useAuthStore.status === "loading"`), a `selectRtdbKey`/`getRtdbKey` a **guest** `deviceId`-t adja (`useAuthStore.ts:45–46`, fallback), így a kredit a **rossz** (guest) node-ra íródik, nem a bejelentkezett fiókra.

### 11.3 A javítás architektúrája

Három egymást kiegészítő mechanizmus (mind kliensoldali):

**(1) Kettős kapu — auth-ready ÉS creditsLoaded.**
A pending feldolgozása csak akkor indul, ha mindkét feltétel igaz:
- **auth-ready:** `useAuthStore.status !== "loading"` (a hitelesített user ismert — a bejelentkezett vásárlás a bejelentkezett fiókra menjen, nem tranziens null/guest-re);
- **creditsLoaded:** `useShopStore.creditsLoaded === true` (megvárja a `subscribeUser`/`handleUserData` első szinkronját).

Amíg bármelyik hamis, a pending **marad** a storage-ban (TTL-en belül). A `useEffect` dep-listája `[authStatus, creditsLoaded]` — amint bármelyik átvált, a feldolgozás **újratriggerelődik**. Ez felszámolja mindkét race-t: a feldolgozás garantáltan a hitelesített uid-on és a már betöltött szerver-egyenleg felett fut.

**(2) Atomikus inkrement — runTransaction.**
Új `incrementUserWallet(uid, delta)` a `userData.ts`-ben, `runTransaction`-nel a `users/{uid}/wallet/credits` node-on: `current => (current ?? 0) + delta`. Így a jóváírás a **szerveroldali** egyenleghez ad hozzá, függetlenül a lokális store állapotától — nincs „olvasd-a-lokálist-majd-set" felülírás. A lokális `credits` a tranzakció eredményéből / a soron következő `onValue` szinkronból frissül.

```
incrementUserWallet(uid, delta):
  runTransaction(ref(db, `users/{uid}/wallet/credits`), current => (current ?? 0) + delta)
```

**(3) Idempotencia.**
Ugyanaz a pending **egyszer** íródhat jóvá:
- a `PENDING_PURCHASE_KEY` törlése (`sessionStorage` + `localStorage`) **csak** a tranzakció **sikere után**;
- modul-szintű `processingPending` ref és/vagy a pending objektumba írt `claimedAt` marker a dupla mount / React StrictMode / kétszeri `/shop/success` visszatérés ellen.

> A robusztus, **szerveroldali** `session_id`-alapú ledger (`credit_claims/{sessionId}`) a [[021-stripe-fraud-defense]] hatóköre; itt a kliensoldali minimum a cél. A jelenlegi pending nem hordoz Stripe `session_id`-t (Payment Link, nem Checkout Session) — a kliens-idempotencia a pending `timestamp`+`packId` kulcsra és a siker-utáni törlésre épül; a `session_id`-ledgert a 011 vezeti be.

### 11.4 A hitelesített kulcs

A jóváírás a `selectRtdbKey`/`getRtdbKey` szerinti **hitelesített** uid-ra menjen. Anonim (guest) vásárlás a guest node-ra kerül — de a **(1) auth-ready kapu** garantálja, hogy tranziens `loading`/null auth-állapotban a bejelentkezett vásárlás **ne** csússzon a guest `deviceId`-node-ra. A guest-vásárlás elvesztésének figyelmeztetése (F blokk, `shop.credits.guestWarning`) itt is érvényes.

### 11.5 i18n (opcionális)

Új user-facing szöveg **nem kötelező**: a kapu egy csendes, háttérben újrapróbáló mechanizmus, ami tipikusan másodperc-tört alatt lefut. **Ha** a fejlesztés úgy dönt, hogy a várakozás alatt jelzést mutat (pl. spinner + felirat a `creditSuccess` előtt), akkor **egy** új kulcs kell, mind az 5 nyelven (`en`, `hu`, `fr`, `de`, `es`), az `i18n` agent tölti fel a dev fázisban:

| Kulcs | en | hu | fr | de | es |
|---|---|---|---|---|---|
| `shop.credits.creditPending` | Finalising your purchase… | Vásárlásod véglegesítése… | Finalisation de votre achat… | Kauf wird abgeschlossen… | Finalizando tu compra… |

Ha nincs ilyen UI, **nincs új i18n kulcs** ehhez az ághoz. A `credits` **object namespace** (a `guestWarning`/`creditPending` nested string alá kerül — konzisztens a `shop.creditsLabel` mintával).

### 11.6 Tesztek

| # | Bemenet | Elvárás |
|---|---|---|
| 1 | `incrementUserWallet`: szerver `credits 2000`, `delta 2000` | `runTransaction` updater → **4000** (NEM 2000) |
| 2 | `incrementUserWallet`: szerver `credits` null/undefined, `delta 300` | → **300** |
| 3 | **stale-regresszió:** szerver 2000, pending 2000-es pakk | feldolgozás után `wallet/credits === 4000`, NEM 2000 |
| 4 | auth `status === "loading"`, van pending | **nincs** feldolgozás; guest `deviceId`-node-ra **nem** ír; auth-ready + `creditsLoaded` után **egyszer** fut a hitelesített uid-ra |
| 5 | `creditsLoaded === false`, van pending | nem dolgoz fel; `true`-ra váltáskor triggerel |
| 6 | dupla feldolgozás (kétszeri mount / StrictMode / kétszeri visszatérés) | **pontosan egyszer** ír; nincs duplikáció; pending csak siker után törlődik |
| 7 | build/típus | `npm run test` + `npm run build` + `npm run build:gh-pages` + `tsc --noEmit` zöld |

### 11.7 Forward-compat a [[021-stripe-fraud-defense]] felé

Az itt bevezetett **atomikus inkrement** (`incrementUserWallet` / `runTransaction`) és a 011 tervezett **wallet-növekmény-limitje** együtt kell éljen: a limit-szabály nem tilthatja a legitim, egy-pakknyi (max 2000⭐) inkrementet. A 011 `session_id`-ledgere (`credit_claims/{sessionId}`) a jóváírás **szerveroldali** idempotenciáját adja majd — a kliensoldali marker (11.3/3) ennek előfutára. Az „első-merge additív wallet-írás" (A–B blokk, 5.1) és ez az „inkrementális Stripe-jóváírás" **ugyanazon** a `wallet/credits` node-on osztozik → a 011 limit-szabályának **mindkét** additív írást engednie kell (nyitott pont, lásd 5.1).
