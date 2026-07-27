---
title: "Firebase identitás-szétválás bugfix – az rtdbKey mindig az auth uid"
slug: 009-firebase-identity-split-bugfix
type: plan
category: auth
status: implemented
implemented: true
implemented_at: "2026-07-26"
created_at: "2026-07-26"
updated_at: "2026-07-26"
author: exphoenee
step: 9
phases: []
dependencies:
  - 004-firebase-auth-bugfix
related_plans:
  - 003-firebase-auth-settings
  - 005-ingame-shop-strapi-stripe
  - 011-stripe-fraud-defense
  - 012-stripe-go-live
tags:
  - firebase
  - auth
  - rtdb
  - bugfix
  - identity
  - device-id
  - migration
  - data-integrity
---

# Firebase identitás-szétválás bugfix – az rtdbKey mindig az auth uid

**Cél:** a bejelentkezett Google user identitása **mindig és kizárólag a Firebase Auth uid** legyen. A `deviceId` csak pre-auth (anonim) guest kulcs. **Egyetlen kódútvonal se térítse el az írásokat a uid-ről — hibák esetén sem.** A jelenlegi „non-fatal fallback" ezt megsérti, és ugyanabból a Google fiókból két különböző játékost gyárt.

> ⚠️ **Ez a terv a [[012-stripe-fraud-defense]] és a [[013-stripe-go-live]] előfeltétele.** Valós pénzes kredit nem mehet szétcsúszott identitásra: élesben egy ilyen fallback **kifizetett** kreditet tüntetne el, a felhasználó számára visszakövethetetlenül → chargeback / dispute.

---

## Tünet (valós, éles adatokon megerősítve)

Ugyanaz a Google account **két böngészőben két különböző játékos**: az egyikben `0` kredit, a másikban `1837`.

A Realtime Database-ben **két** user node van, miközben az Auth oldalon **egyetlen** user létezik:

| RTDB node | Mi ez | Tartalom |
|---|---|---|
| `users/MCyVmgd2yGYM5IWBTxA8WJHYHPu2` | az **igazi Firebase Auth UID** | teljes: `profile` + `settings` + `wallet` + `inventory` + `stats`, `createdAt: 1785093340783` (= 2026‑07‑26 19:15 UTC) |
| `users/df4ea95f-042f-444b-8c0d-4045f79c95bd` | egy localStorage **`deviceId` UUID** | csonka: csak `profile` + `inventory`; **nincs** `createdAt`, nincs `wallet`/`settings`/`stats`; de `nickname: "exphoenee"`, `provider: "google"`, `isAnonymous: false` |

A második node profilja **hiányzó `createdAt`-tal** és `provider: "google"` értékkel az ujjlenyomat, amiből bizonyítható, hogy a node-ot a **fallback-ág** írta (lásd 1.4).

### Amit ez a hibaosztály KIZÁR (ne is vizsgáljuk)

- A `useShopStore` `partialize`-ja **csak** az `activeShopTab`-ot perzisztálja (`src/state/useShopStore.ts:190-192`) — a **kredit nem megy localStorage-ba**.
- Az `App.tsx:176-199` `handleUserData` az **RTDB-t tekinti egyetlen igazságnak** (`data.wallet?.credits ?? 0`, hiányzó ág → 0 / üres, nem „tartsd meg a lokálist").

→ **Lokális állapot nem írta felül a szervert.** A szétválás **kizárólag** a rossz `rtdbKey`-ből jött. Ez egy egész hibaosztályt (persist/hydrate/race a store-ok között) levesz a napirendről.

### Fontos kontextus

- `STARTING_CREDITS = 0` normál módban, `DEBUG_STARTING_CREDITS = 9000` debug módban (`src/constants/shopCatalog.ts:4-5`) — a `getDefaultUserNode` ebből seedeli a `wallet`-et.
- A localStorage **origin-szintű**: a `localhost` és a hosztolt domain **külön `deviceId`-t** generál → ugyanahhoz az Auth accounthoz **két guest identitás** tartozik. **Ez by design rendben van.** A hiba az, hogy **bejelentkezés után nem tér vissza a uid-hez.**

---

## Döntések (egyeztetve)

| Kérdés | Választás |
|--------|-----------|
| Elhelyezés a roadmapen | **9. lépés, a Stripe-tervek ELŐTT.** Indok: valós pénzes kredit nem mehet szétcsúszott identitásra; élesben egy ilyen fallback fizetett kreditet tüntetne el. |
| `rtdbKey` invariáns | `!user.isAnonymous` esetén **`rtdbKey === user.uid` minden körülmények között.** A `catch`-ági fallback **törölve**, és az invariáns **szerkezetileg** védve (lásd 2.1 — ez a terv legfontosabb architekturális döntése). |
| Megvalósítás | **`rtdbKey` derivált érték** (selector), **nem** külön írható state. A `setRtdbKey` action **teljesen megszűnik** → a hibás hívás többé nem is fordul le. |
| Migrációs politika | **„Csak első belépéskor, összeadás nélkül."** Ha a `users/{uid}` node már létezik, a guest wallet **nem** adódik hozzá. |
| A politika metszéspontja (a felhasználó explicit pontosítása) | Az uid-node `wallet` ága **mindig győz**, ha létezik. Az árva/guest node csak **`inventory`-uniót** és **`stats` maximumot** ad hozzá. Kreditet **csak akkor** vesz át, ha az uid-node-nak **egyáltalán nincs `wallet` ága** (első belépés). Ha egy **nem-nulla** kreditű árva wallet esik el, az **ne veszhessen el nyomtalanul**: `console.warn` + audit-mező a target node-ban (`profile/orphanDiscardedCredits/{deviceId}: <összeg>`), hogy utólag kézzel jóváírható legyen. |
| Árva node-ok | **Self-healing kód + kézi takarítás.** A javított logika belépéskor beolvasztja az elérhető árva node-ot, majd törli — minden böngésző/gép **magát gyógyítja**. Emellett kézi checklist a mostani `df4ea95f` node rendbetételéhez (5. szekció). |
| `deviceId`-rotáció | **Elhagyható és elhagyandó** — az idempotencia-jelölés (`profile/migratedFrom/{deviceId}: true`) váltja ki. Ha mégis marad, **ne a migráció sikeréhez** legyen kötve (indoklás: 2.5). |
| Atomicitás | **Egyetlen multi-path `update(root, {...})`**: target írás + guest törlés + `device_map` törlés + idempotencia-jelölés **egy tranzakcióban** → félkész állapot nem jöhet létre. Rules-elemzés: 2.3. |
| RTDB rules módosítás | **Nincs szükség rá** — minden új mező meglévő `.write`-tal fedett gyerek alá (`profile/*`) kerül. Csak a `security.rules.json` **dokumentációja** frissül (séma-szekció). |
| i18n | Új felhasználói szöveg **várhatóan nincs**. Ha a migrációs hiba felszínre kerül, a meglévő `login.error.generic` újrahasznosul; új kulcs csak külön döntés után (6. szekció). |

---

## ✅ Haladás (TODO)

> Jelölés: `[ ]` hátravan · `[~]` folyamatban · `[x]` kész.

**A. `rtdbKey` invariáns — derivált érték (a fallback strukturális felszámolása)**
- [x] `src/state/useAuthStore.ts` — `rtdbKey: string` **state mező törlése**
- [x] `src/state/useAuthStore.ts` — `setRtdbKey` action **törlése** az interface-ből és az implementációból
- [x] `src/state/useAuthStore.ts` — `setUser` / `clearUser` `rtdbKey`-számításának törlése (a derivált érték átveszi)
- [x] `src/state/useAuthStore.ts` — +`export const selectRtdbKey = (s: AuthState): string` (`user && !user.isAnonymous ? user.uid : deviceId`)
- [x] `src/state/useAuthStore.ts` — +`export const getRtdbKey = (): string` (non-React call site-okhoz)
- [x] `src/firebase/authBootstrap.ts:128-132` — a `catch`-ági `setRtdbKey(deviceId)` **fallback törlése**
- [x] `src/App.tsx` (3 hívás: `:101-103`, `:138-139`, `:218-220`) → `getRtdbKey()`
- [x] `src/components/screens/SettingsScreen.tsx` (`:33` selector + `:66`, `:292`, `:317`, `:345`) → `useAuthStore(selectRtdbKey)` / `getRtdbKey()`
- [x] `src/state/useShopStore.ts` (`:109`, `:139`, `:172`) → `getRtdbKey()`
- [x] `tsc --noEmit` → **0 hiba**; `grep -r "setRtdbKey" src/` → **0 találat**

**B. `migrateGuestData` újraírása (null-safe + atomikus + idempotens)**
- [x] `src/firebase/userData.ts` — a `guestData` típusa `UserNode` → **`DeepPartial<UserNode>`** (minden gyerek opcionális)
- [x] `userData.ts:176` — a **crash javítása**: `guestData.wallet.credits = …` bal oldali `?.` nélküli írás **teljes eltávolítása** (a merge nem mutálja a snapshot-objektumot)
- [x] Idempotencia-kapu: `users/{uid}/profile/migratedFrom/{deviceId} === true` → merge kihagyva, **csak takarítás**
- [x] Wallet-politika: `targetData.wallet === undefined` → kredit átvétel; egyébként **target győz**
- [x] Elesett nem-nulla árva kredit → `console.warn` + `profile/orphanDiscardedCredits/{deviceId}` audit-mező
- [x] Inventory: **unió** (`ships`/`music`/`exoplanets`, csak `=== true` értékek)
- [x] Stats: **max** (`bestServiceSeconds`)
- [x] Settings: csak akkor kerül át, ha a targetnek **egyáltalán nincs** `settings` ága (a wallet-politikával konzisztens)
- [x] `profile.nickname`: csak akkor kerül át, ha a targeten üres/nincs
- [x] `profile.createdAt`: csak akkor kerül át, ha a targeten nincs
- [x] **Egyetlen** `update(ref(db), updates)` root multi-path írás: target leaf-mezők + `migratedFrom` jelölés + guest gyerekek `null` + `device_map/{deviceId}: null`
- [x] Guest gyerekek törlése **a tényleges kulcsok alapján** (`Object.keys(guestSnapshot.val())`), nem fix 5-es listából
- [x] **`undefined` érték soha ne kerüljön az `updates` objektumba** (RTDB `update` `undefined`-ra dob)
- [x] Átfedő útvonalak elkerülése (nem írunk egyszerre `profile`-t és `profile/nickname`-et) — **kizárólag leaf-szintű** kulcsok
- [x] Ha a root multi-path írás rules-okon elhasal (2.3 „B" forgatókönyv) → a dokumentált **lépésenkénti alternatíva** rollback-kel

**C. `ensureUserNode` javítása**
- [x] `userData.ts:106-118` (exists-ág) — `profile/createdAt` **írása, ha hiányzik**; **soha nem** írjuk felül, ha van
- [x] `ensureUserNode` +`options?: { seedWallet?: boolean }` — pending migráció esetén a `wallet` **nem** seedelődik (indoklás: 2.4)
- [x] `authBootstrap` a migráció eredményétől függően adja át a `seedWallet` értékét

**D. Self-healing árva node beolvasztás**
- [x] `authBootstrap` — `ensureDeviceMap(deviceId, user.uid)` **a migráció ELŐTT** fut (ma is így van, de a sorrend rögzítendő: ez adja a `users/{deviceId}` olvasási jogot)
- [x] A migráció **minden** Google belépéskor lefut (nem csak az elsőn) → a saját origin árva node-ja begyógyul
- [x] A migráció hibaágán **nincs** kulcs-eltérítés; `setAuthError` + `console.error` + újrapróbálás a következő auth-eventen
- [x] `clearDeviceId()` hívás **eltávolítása** a migrációs siker-ágból (`authBootstrap.ts:123-125`)
- [x] `src/firebase/deviceId.ts` — `clearDeviceId` jövője eldöntve: megtartva **kizárólag** debug „identitás-reset"-hez, vagy törölve (dead code nem maradhat)
- [x] A **limitáció** dokumentálva a kódban is: idegen origin / idegen gép `deviceId`-je klienstől **nem felderíthető** (`device_map` `.read: false`)

**E. Egyszeri kézi takarítás (a mostani állapotra)**
- [x] Firebase Console → RTDB: `users/df4ea95f-042f-444b-8c0d-4045f79c95bd` **export JSON** (mentés a törlés előtt)
- [x] `nickname: "exphoenee"` átmásolása → `users/MCyVmgd2yGYM5IWBTxA8WJHYHPu2/profile/nickname`
- [x] Az árva node `inventory` ágának összevetése a target `inventory`-jával; hiányzó `true` elemek átmásolása
- [x] `users/df4ea95f-042f-444b-8c0d-4045f79c95bd` **törlése**
- [x] `device_map/df4ea95f-042f-444b-8c0d-4045f79c95bd` **törlése**
- [x] `realtime_space_travel_device_id` localStorage-kulcs törlése **mindkét originon** (localhost + hosztolt domain)
- [x] Rögzítve: ebben a node-ban **nincs `wallet` ág → kredit nem veszik el**

**F. Tesztek**
- [x] `src/firebase/userData.test.ts` (**ÚJ**) — `firebase/database` + `./config` mockolva
  - [x] hiányzó `wallet` a guest node-ban → **nem dob** `TypeError`-t (ez a `userData.ts:176` regressziós teszt)
  - [x] hiányzó `profile` a guest node-ban → nem dob
  - [x] nem létező / üres guest node → `false`, semmilyen írás
  - [x] már migrált `deviceId` (`profile/migratedFrom/{deviceId} === true`) → **nincs** kredit-átvétel, **van** takarítás
  - [x] létező target `wallet` → a kredit **nem adódik össze**; nem-nulla árva kredit → `orphanDiscardedCredits` audit-mező
  - [x] target `wallet` ág **nincs** → a guest kredit átkerül
  - [x] inventory unió + stats max
  - [x] az `updates` objektumban **egyetlen `undefined` érték sincs**
  - [x] az `updates` objektumban nincs átfedő (prefix) útvonalpár
- [x] `src/state/useAuthStore.test.ts` (**ÚJ**) — `../firebase/deviceId` mockolva
  - [x] anonim user → `selectRtdbKey === deviceId`
  - [x] Google user → `selectRtdbKey === user.uid`
  - [x] `setDeviceId` **nem** befolyásolja a kulcsot nem-anonim user esetén
  - [x] kijelentkezés (`user: null`) → visszaáll `deviceId`-re
- [x] `src/firebase/authBootstrap.test.ts` (**ÚJ**) — invariáns-teszt
  - [x] Google user + `migrateGuestData` **elutasított promise** → `getRtdbKey() === user.uid`; `subscribeUser` a **uid**-dal hívva
- [x] `npm run test` zöld; `npm run build` + `npm run build:gh-pages` zöld

**G. Dokumentáció**
- [x] `security.rules.json` — a séma-komment kiegészítése: `profile.migratedFrom`, `profile.orphanDiscardedCredits`, `profile.nickname`
- [x] `database.rules.json` — **változatlan** (regenerálva a `security.rules.json`-ból, hogy a kettő szinkronban maradjon)
- [x] `.claude/lessons-learned.md` — bejegyzés: „a non-fatal fallback, ami identitást cserél, nem non-fatal"
- [x] [[004-firebase-auth-bugfix]] O./P. blokk kereszthivatkozása erre a tervre

---

## 1. A hiba — négy konkrét kódhely

```
[1] userData.ts:176  guestData.wallet.credits = ...   ──▶ TypeError (guest node-ban nincs wallet)
                                    │
                                    ▼
[2] authBootstrap.ts:128-132  catch { setRtdbKey(deviceId) }
                                    │  ← „non-fatal fallback", valójában IDENTITÁS-CSERE
                                    ▼
        a bejelentkezett Google user VÉGLEG a users/{deviceId} node-ot olvassa és írja
                                    │
[3] authBootstrap.ts:114-127  clearDeviceId() CSAK a siker-ágon
                                    │  ← a hibaágon nincs semmilyen idempotencia-védelem
                                    ▼
        minden betöltés újra dob [1]-et → újra [2] → ÖNGERJESZTŐ állapot
                                    │
[4] userData.ts:108-116  az exists-ág SOSEM írja a createdAt-ot
                                    ▼
        a df4ea95f node profilja csonka marad → ez az UJJLENYOMAT
```

### 1.1 `[1]` A determinisztikus crash — `userData.ts:176`

```ts
guestData.wallet.credits = (guestData.wallet?.credits ?? 0) + (targetData.wallet?.credits ?? 0);
```

A **bal oldalon nincs `?.`** → `TypeError: Cannot set properties of undefined`, ha a guest node-ban nincs `wallet` gyerek. Ez **determinisztikus**: minden betöltésnél újra dob.

Miért nincs `wallet` a guest node-ban? Mert a `migrateGuestData` egy korábbi (fél)sikeres futása **már törölte** a `wallet` gyereket (`userData.ts:222-228`), vagy mert a node-ot maga a fallback-ág írta, ami csak `profile`-t és `inventory`-t frissít. **Ez a konkrét crash állította elő a mostani szétválást.**

### 1.2 `[2]` A fő hiba — a fallback maga

```ts
} catch (err) {
  console.error("Guest data migration failed:", err);
  // Non-fatal: fall back to deviceId path if migration fails
  useAuthStore.getState().setRtdbKey(deviceId);
}
```

**Nincs is mire visszaesni.** A `users/{uid}` a `$key == auth.uid` szabállyal amúgy is olvasható és írható (`database.rules.json:33-39`) — a fallbacknek **nulla** haszna van, és **nettó kártétel**: identitást cserél egy tranziens hibára reagálva.

### 1.3 `[3]` Nincs idempotencia a hibaágon

A `clearDeviceId()` rotáció **csak a siker-ágon** fut (`authBootstrap.ts:123-125`), miközben a `migrateGuestData` **minden** Google belépéskor lefut. A hibaágon tehát semmilyen jelölés nem marad → az állapot minden betöltésnél újratermeli magát.

### 1.4 `[4]` A csonka `profile` mint ujjlenyomat

Az `ensureUserNode` „exists" ága (`userData.ts:108-116`) `profile/lastLoginAt`, `provider`, `displayName`, `photoURL`, `isAnonymous` mezőket ír — **`createdAt`-ot nem**. A `createdAt` **csak** a create-ágon (`userData.ts:45-75` `getDefaultUserNode`) keletkezik.

A `df4ea95f` node-ban **`provider: "google"` + `isAnonymous: false` van, de `createdAt` nincs** → a node-ot nem a create-ág, hanem az **exists-ág írta egy nem-anonim userrel**, azaz pontosan a fallback után. Ez a bizonyíték.

---

## 2. Architektúra

### 2.1 Az `rtdbKey` invariáns szerkezeti védelme — **a terv legfontosabb döntése**

**Invariáns:** `!user.isAnonymous` esetén `rtdbKey === user.uid`, **minden körülmények között**.

Két út vezet ide:

| | **A) Őrzött setter** | **B) Derivált érték (selector)** |
|---|---|---|
| Lényeg | `setRtdbKey` megmarad, de elutasít egy `deviceId`-t, ha van nem-anonim user | `rtdbKey` **nem state** — `user` + `deviceId` alapján számolt selector; a `setRtdbKey` **megszűnik** |
| Az invariáns érvényesül | **futásidőben** (feltétel a setterben) | **típusszinten** — nincs olyan API, amivel megsérthető |
| Duplikált state | Igen (`rtdbKey` + `user` + `deviceId` — divergálhat) | Nem (egyetlen igazság) |
| Hibás hívás sorsa | lefordul, csendben nem hat | **nem fordul le** (`tsc --noEmit` elkapja) |
| Kockázat | egy jövőbeli fejlesztő „kivezeti" az őrt, hogy „működjön" | selector referencia-stabilitás (lásd lent) |

**Javaslat: B).** Három indok:

1. A `setRtdbKey`-nek **pontosan egy** hívási helye van a teljes kódbázisban — `authBootstrap.ts:131` —, és **az maga a bug**. Az action törlése tehát nem korlátozás, hanem a hibaosztály teljes felszámolása: egy jövőbeli `setRtdbKey(deviceId)` **le sem fordul**.
2. A `rtdbKey` **már ma is 100%-ban derivált**: a `setUser` (`useAuthStore.ts:72`) és a `clearUser` (`:89`) ugyanezt a kifejezést számolja ki. Ez duplikált state → a divergencia klasszikus forrása. A `catch`-ági `setRtdbKey` pontosan azért volt lehetséges, mert **külön írható** mező.
3. Az A) változat futásidejű őrt tesz oda, ahol a hívásra egyáltalán nincs szükség — az őr önmagában is bizonyítja, hogy a mező nem kellene írhatónak lennie.

**Implementáció (Zustand v4, computed nélkül):**

```ts
// src/state/useAuthStore.ts
export const selectRtdbKey = (s: AuthState): string =>
  s.user && !s.user.isAnonymous ? s.user.uid : s.deviceId;

/** Non-React call site-okhoz (store-ok, event handlerek, authBootstrap). */
export const getRtdbKey = (): string => selectRtdbKey(useAuthStore.getState());
```

- React komponensben: `const rtdbKey = useAuthStore(selectRtdbKey);` — ugyanaz az ergonómia, mint ma.
- **Referencia-stabilitás:** a selector **`string`-et** ad vissza, nem objektumot → nincs új referencia minden renderben → nincs re-render ciklus. (Objektumot visszaadó selector `useShallow` nélkül végtelen renderhez vezetne — itt ez nem áll fenn.)
- A `deviceId` **marad** state mező (a `setDeviceId` re-rendert kell hogy triggereljen).
- **Nincs `?? deviceId` fallback a uid-re.** A Firebase `User.uid` típusa `string`, egy nem-anonim usernek definíció szerint van uid-je. Ha valaha üres lenne, az **hiba**, amit fel kell tárni (`console.error`), nem elrejteni egy másik node-ra való átirányítással.

**A `catch`-ág új viselkedése:**

```ts
if (!user.isAnonymous) {
  try {
    await migrateGuestData(deviceId, user.uid);
  } catch (err) {
    console.error("Guest data migration failed:", err);
    useAuthStore.getState().setAuthError(getAuthErrorMessage(err));
    migrationPending = true;   // ← NEM kulcscsere; csak a wallet-seedelést tiltja
  }
}
const rtdbKey = getRtdbKey();  // ← garantáltan user.uid
```

### 2.2 `migrateGuestData` — új szerződés

```
migrateGuestData(deviceId, targetUid) → Promise<MigrationResult>

type MigrationResult =
  | { kind: "noop" }              // deviceId === targetUid, vagy nincs guest node
  | { kind: "cleaned" }           // már migrált deviceId → csak takarítás történt
  | { kind: "merged"; tookCredits: boolean; discardedCredits: number };
```

**Lépések:**

1. `if (deviceId === targetUid) return { kind: "noop" }`
2. `get(users/{deviceId})` → ha nem létezik: `{ kind: "noop" }`
3. `get(users/{targetUid})` → `targetData: DeepPartial<UserNode> | null`
4. **Idempotencia-kapu:** `targetData?.profile?.migratedFrom?.[deviceId] === true` → merge **kihagyva**, csak a takarítás kerül az `updates`-be → `{ kind: "cleaned" }`
5. **Merge-számítás** (a snapshot objektumokat **nem mutáljuk**, csak leaf-kulcsokat gyűjtünk):

| Ág | Politika |
|---|---|
| `wallet.credits` | `targetData?.wallet === undefined` → **átvesszük** `guest.wallet?.credits ?? 0`-t. Egyébként **a target győz**; ha `guest.wallet?.credits > 0` → `console.warn` + `profile/orphanDiscardedCredits/{deviceId} = <összeg>` |
| `inventory.{ships,music,exoplanets}` | **unió**: minden `guest.inventory?.[cat]?.[id] === true` kulcsra `= true` (csak ha a targeten még nem `true`) |
| `stats.bestServiceSeconds` | **max** — csak akkor írunk, ha a guest értéke nagyobb |
| `settings` | csak akkor kerül át, ha `targetData?.settings === undefined` (a wallet-politikával konzisztens) |
| `profile.nickname` | csak akkor, ha a target nickname üres/nincs, és a guest nickname nem üres |
| `profile.createdAt` | csak akkor, ha a targeten nincs |
| `profile.displayName` / `photoURL` / `provider` / `isAnonymous` | **soha** — ezeket az `ensureUserNode` az Auth userből írja |

6. **Idempotencia-jelölés** (mindig): `users/{targetUid}/profile/migratedFrom/{deviceId} = true`
7. **Takarítás** (mindig): a guest node **tényleges** gyerekeire `null` + `device_map/{deviceId} = null`
8. **Egyetlen** `update(ref(db), updates)`

**Két kötelező hibaosztály-védelem:**

- **`undefined` tilos.** Az RTDB `update` `undefined` értékre dob (`Invalid value ... contains undefined`). Ezért minden mező **feltételesen** kerül be az `updates`-be — soha nem `updates[x] = maybeUndefined`. Erre külön teszt van (F blokk).
- **Átfedő útvonalak tilosak.** Egy multi-path `update`-ben nem lehet egyszerre `users/x/profile` és `users/x/profile/nickname` (RTDB elutasítja). Ezért **kizárólag leaf-szintű** kulcsokat írunk a targetre. A guest törlésnél viszont a **top-level gyerekek** a leafek — ott nincs átfedés a target útvonalaival, mert más a `$key`.

### 2.3 Az atomikus root multi-path `update` — engedik-e a rules?

**Igen.** A `database.rules.json:16-41` alapján, három ténnyel:

1. **Egy multi-path `update(root, {...})` nem igényel `.write`-ot a rooton.** Az RTDB minden útvonalat **külön-külön** a saját helyén érvényes szabály ellen értékel ki. Ez ugyanaz a mechanizmus, amire a `userData.ts:120-131` kommentje épül (`update` a `users/$key`-en azért működik, mert a **gyerekek** szabályai döntenek).
2. **A target írások** (`users/{uid}/wallet/credits`, `…/inventory/ships/{id}`, `…/profile/migratedFrom/{deviceId}`, `…/stats/bestServiceSeconds`) mind a `profile` / `settings` / `wallet` / `inventory` / `stats` **alá** esnek, ahol a `.write` engedélyez, és az RTDB write-szabályok **lefelé kaszkádolnak** → OK a `$key == auth.uid` ágon.
3. **A guest törlés és a `device_map` törlés ugyanabban a tranzakcióban biztonságos.** A `.write` kifejezésben a `root` a **művelet ELŐTTI** adatbázis-állapotot jelenti. Ezért a `users/{deviceId}/…` írás jogosultsága a `root.child('device_map').child($key).val() == auth.uid` **pre-state** alapján dől el — az **ugyanebben az update-ben** történő `device_map/{deviceId}: null` törlés **nem vonja ki a lába alól** a saját engedélyét. A `device_map/{deviceId}` törlését pedig a `data.val() == auth.uid` ág (`:18`) expliciten engedi.

> **Előfeltétel:** az `ensureDeviceMap(deviceId, user.uid)` **le kell hogy futott legyen** a migráció előtt — ma is így van (`authBootstrap.ts:102-107`). Ez adja a `users/{deviceId}` olvasási **és** írási jogot. A sorrendet a kódban kommenttel rögzítjük.

**„B" forgatókönyv — ha a root-update mégis elhasal** (pl. a rules egy jövőbeli szigorítása után, lásd [[012-stripe-fraud-defense]] `wallet` növekmény-limit):

Lépésenkénti alternatíva, **rollback-barát sorrendben**:

1. `update(users/{targetUid}, { …leaf mezők…, "profile/migratedFrom/{deviceId}": true })` — a **jelölés és a kredit-átvétel egy írásban**, hogy egy megszakadás ne engedjen dupla jóváírást.
2. `update(users/{deviceId}, { <minden tényleges gyerek>: null })`
3. `set(device_map/{deviceId}, null)`

Ha (2) vagy (3) elhasal: az adat **már** a helyén van, a `migratedFrom` jelölés áll → a következő belépés `{ kind: "cleaned" }` ágon **újrapróbálja a takarítást**. Nincs adatvesztés, nincs duplikáció. **Rollback (1) után nem szükséges és nem is kívánatos.**

### 2.4 A `seedWallet` csapda — miért kell az `ensureUserNode`-ot is módosítani

Fontos sorrendi kölcsönhatás: az `ensureUserNode` a create-ágon **`wallet`-et is seedel** (`STARTING_CREDITS`, debugban `9000`). Ha a migráció **dob**, majd az `ensureUserNode` létrehozza a target node-ot `wallet`-tel, akkor a **következő** belépés már azt látja, hogy „a targetnek van `wallet` ága" → a wallet-politika szerint **a target győz** → a guest kredit az `orphanDiscardedCredits` audit-mezőbe kerül, nem a walletbe.

**Megoldás:** `ensureUserNode(user, provider, key, { seedWallet })`. Ha egy migráció **pending** (dobott ebben a ciklusban), akkor `seedWallet: false` → a node `profile`/`settings`/`inventory`/`stats`-szal létrejön, **`wallet` nélkül** → a következő próbálkozás továbbra is „első belépés"-ként látja, és a kredit átkerül.

Átmeneti hatás: a `handleUserData` `data.wallet?.credits ?? 0`-t lát → a UI **0 kreditet** mutat, míg a migráció le nem fut. Ez **tranziens és visszafordítható** — szemben a kredit végleges audit-mezőbe süllyesztésével.

### 2.5 A `deviceId`-rotáció elhagyása — indoklás

A [[004-firebase-auth-bugfix]] **P blokkja** a `clearDeviceId()` rotációt kredit-duplikáció ellen vezette be. Ez a védelem most **három** másik mechanizmussal is megvan:

1. **Idempotencia-jelölés:** `profile/migratedFrom/{deviceId} === true` → a második migráció nem merge-öl.
2. **Wallet-politika:** létező target `wallet` esetén a kredit **soha** nem adódik hozzá.
3. **`STARTING_CREDITS = 0`** normál módban → egy friss guest node-nak nincs is mit duplikálni.

Ugyanakkor a rotációnak **konkrét kára** van: eldobja a localStorage-ból azt az egyetlen információt, amivel az adott origin árva node-ja **felderíthető** (a `device_map` klienstől nem olvasható — lásd 2.6). Egy rotáció utáni árva node **véglegesen** self-healing-képtelen.

→ **A `clearDeviceId()` hívás kikerül a migrációs útból.** (Szerencsés véletlen: éppen azért maradt meg a `df4ea95f` deviceId a localStorage-ban, mert a rotáció a **siker-ághoz** volt kötve, és a migráció mindig dobott — így a mostani árva node self-healing-gel **is** gyógyítható.)

Ha bármilyen okból mégis marad rotáció, akkor **kötelezően a migráció eredményétől függetlenül**, és **csak** a takarítás sikeres befejezése után.

### 2.6 Self-healing — mit tud és mit nem tud felderíteni a kliens

**Amit TUD:**

- A **saját origin** `deviceId`-jét a localStorage-ból (`realtime_space_travel_device_id`).
- A `users/{deviceId}` node-ot **olvasni**: a `.read` szabály (`database.rules.json:33`) engedi, ha `device_map/{deviceId} == auth.uid` — és az `ensureDeviceMap` ezt a mapping-et **minden auth-eventnél megírja**, még mielőtt a migráció olvasni próbálna. **Ez a mechanizmus, ami a self-healinget egyáltalán lehetővé teszi.**
- Ebből következően: **minden böngésző / minden gép, ahol a user belép, magát gyógyítja** — az adott origin árva node-ja beolvad a uid-node-ba, majd törlődik.

**Amit NEM tud:**

- A `device_map`-et **enumerálni**: `".read": false` (`database.rules.json:19`). Nincs lekérdezés, ami visszaadná, hogy „mely deviceId-k tartoznak ehhez a uid-hez".
- A `users` gyűjteményt **enumerálni**: nincs `.read` a `users` szinten, csak `users/$key`-en.
- Ezért **idegen origin vagy idegen gép** árva node-ja klienstől **nem felderíthető**.

**Kimondott limitáció:** a self-healing a **saját origin `deviceId`-jére szorítkozik**. Egy másik originon (pl. `localhost` vs. hosztolt domain) vagy másik gépen keletkezett árva node **csak akkor** gyógyul, amikor a user **onnan** legközelebb bejelentkezik. A teljes, szerveroldali árva-söprés Admin SDK-t (Cloud Function / szkript) igényelne — ez **kívül esik a Spark-terv hatókörén** ([[012-stripe-fraud-defense]] döntése: nincs Blaze, nincs Cloud Functions), ezért **nem része ennek a tervnek**. A mostani egyetlen ismert árva node-ot az **E blokk kézi checklistje** rendezi.

**Opcionális jövőbeli fejlesztés (nem TODO):** `users/{uid}/profile/knownDevices/{deviceId}: true` írása minden belépéskor. Ez a uid-node alatt van (olvasható, írható), és lehetővé tenné a **cross-origin** felderítést — de a `users/{idegenDeviceId}` **olvasása** akkor is bukna, mert a `device_map/{idegenDeviceId}` a **másik** origin utolsó anonim uid-jére mutat, nem a mostani auth.uid-re. Backend nélkül tehát ez sem old meg semmit; csak akkor érdemes, ha egyszer lesz Admin SDK.

---

## 3. Fájlstruktúra

### Új fájlok
```
src/firebase/userData.test.ts        # migrateGuestData unit tesztek (mockolt firebase/database)
src/state/useAuthStore.test.ts       # rtdbKey invariáns (selectRtdbKey / getRtdbKey)
src/firebase/authBootstrap.test.ts   # migrációs kivétel → a kulcs uid marad
```

### Módosuló fájlok
```
src/state/useAuthStore.ts                  # -rtdbKey state, -setRtdbKey, +selectRtdbKey, +getRtdbKey
src/firebase/authBootstrap.ts              # -catch-ági setRtdbKey, -clearDeviceId, +migrationPending → seedWallet
src/firebase/userData.ts                   # migrateGuestData teljes újraírás; ensureUserNode createdAt + seedWallet
src/firebase/deviceId.ts                   # clearDeviceId sorsa (debug-only vagy törölve)
src/App.tsx                                # 3 rtdbKey call site → getRtdbKey()
src/components/screens/SettingsScreen.tsx  # 5 rtdbKey call site → useAuthStore(selectRtdbKey) / getRtdbKey()
src/state/useShopStore.ts                  # 3 rtdbKey call site → getRtdbKey()
security.rules.json                        # séma-komment: profile.migratedFrom, profile.orphanDiscardedCredits
database.rules.json                        # regenerálva (tartalmi változás NINCS)
.claude/lessons-learned.md                 # bejegyzés a fallback-anti-patternről
plans/004-firebase-auth-bugfix.md          # kereszthivatkozás (additív)
plans/011-stripe-fraud-defense.md          # kereszthivatkozás (a manage-roadmap agent rendezi a YAML-t)
plans/012-stripe-go-live.md                # kereszthivatkozás (a manage-roadmap agent rendezi a YAML-t)
```

### RTDB séma-kiegészítés (nincs rules-változás)
```
users/{uid}/profile/
  migratedFrom/{deviceId}:            true      # idempotencia-jelölés
  orphanDiscardedCredits/{deviceId}:  <number>  # audit: elesett árva kredit
```

---

## 4. Függőségek

- **Előfeltétel:** [[004-firebase-auth-bugfix]] — az O. (guest→Google migráció), P. (deviceId rotáció) és L. (device-alapú guest identitás) blokkok. **Ez a terv azokat javítja**, nem nulláról ír.
- **Blokkolja:** [[012-stripe-fraud-defense]] és [[013-stripe-go-live]] — mindkettő a `wallet` node integritására épül (lásd 7.).
- **Érinti:** [[005-ingame-shop-strapi-stripe]] — a kredit-jóváírás célútvonala (`users/{rtdbKey}/wallet/credits`).
- **Kézi (nem kódolható) lépések:** Firebase Console (E blokk: node-export, nickname-átmásolás, két törlés), böngésző DevTools (localStorage-kulcs törlése két originon).
- **Végrehajtási branch:** `develop`. A `main` nem tartalmazza a Firebase integrációt.

---

## 5. Egyszeri kézi takarítás — checklist a mostani állapotra

> **Sorrend kötött. Export ELŐBB, törlés UTOLJÁRA.**

| # | Lépés | Hol |
|---|---|---|
| 1 | `users/df4ea95f-042f-444b-8c0d-4045f79c95bd` → **Export JSON** (biztonsági mentés) | Firebase Console → Realtime Database |
| 2 | `profile.nickname` (`"exphoenee"`) **átmásolása** → `users/MCyVmgd2yGYM5IWBTxA8WJHYHPu2/profile/nickname` | Console |
| 3 | Az árva node `inventory/{ships,music,exoplanets}` `true` elemeinek összevetése a target `inventory`-jával; **hiányzók átmásolása** | Console |
| 4 | `users/df4ea95f-042f-444b-8c0d-4045f79c95bd` → **törlés** | Console |
| 5 | `device_map/df4ea95f-042f-444b-8c0d-4045f79c95bd` → **törlés** | Console |
| 6 | `localStorage.removeItem("realtime_space_travel_device_id")` a **hosztolt domainen** | DevTools |
| 7 | `localStorage.removeItem("realtime_space_travel_device_id")` a **`localhost:5173`-on** | DevTools |
| 8 | Ellenőrzés: mindkét böngészőben belépés → **ugyanaz a kredit** (`1837`) és ugyanaz a nickname | Alkalmazás |

> 💡 **Ebben a node-ban NINCS `wallet` ág → kredit nem veszik el.** A `MCyVmgd2yGYM5IWBTxA8WJHYHPu2` node `1837` kreditje a helyes, megtartandó érték. A 6–7. lépés után az érintett originok friss `deviceId`-t generálnak, és a `df4ea95f` többé nem kerül szóba.
>
> Alternatíva a 2–5. lépésre: az **A–D blokk deploya után** egyszerűen bejelentkezni azon az originon, ahol a `df4ea95f` a `deviceId` — a self-healing elvégzi a beolvasztást és a törlést. A kézi út azért marad a tervben, mert **nem függ** a kód deployától, és mert a `wallet` hiánya miatt itt **kockázatmentes**.

---

## 6. i18n

**Új felhasználói szöveg várhatóan nincs.** A javítás hatása felhasználói szempontból „a kredit végre stimmel" — nem jár új UI-elemmel.

Ha a migrációs hibaág felszínre kerül (`setAuthError`), akkor:

| Változat | Kulcs | Döntés |
|---|---|---|
| **Javasolt** | a meglévő `login.error.generic` újrahasznosítása | nincs i18n munka |
| Opcionális | új `login.error.migrationFailed` | **csak külön döntés után**; ekkor az `i18n` agent feladata **mind az 5 nyelven** (`en`, `hu`, `fr`, `de`, `es`) — teljes paritás kötelező ([[000-i18n-nyelvesites]]) |

Az `orphanDiscardedCredits` / `migratedFrom` **belső audit-mezők**, nem jelennek meg a UI-ban → nincs i18n vonatkozásuk.

---

## 7. Kockázatok / figyelmeztetések / regresszió

### 7.1 Regresszió-kockázat a Stripe-tervek felé

Mindkét Stripe-terv **közvetlenül a `wallet` node-ra épül**, ezért a következőket **ennek a tervnek a lezárása után újra kell tesztelni**:

| Terület | Miért érintett | Újratesztelendő |
|---|---|---|
| [[012-stripe-fraud-defense]] E fázis — `credit_claims/{sessionId}` ledger | a ledger a user node-hoz kötött; szétcsúszott identitás mellett a claim a **rossz** node alatt köt ki | `session_id` kapu + a claim egyszer-felhasználhatósága a **uid** node-on |
| [[012-stripe-fraud-defense]] — `wallet` **írásonkénti növekmény-limit** (max 2000⭐) | a `migrateGuestData` **első belépéskor** egy lépésben írhat `wallet/credits`-et; ha az érték > 2000, a jövőbeli rule **elutasítja** a migrációt | ⚠️ **Nyitott forward-compat pont** — lásd 7.2 |
| [[012-stripe-fraud-defense]] — `lastTopUpAt` ütemkorlát | a migrációs írás nem top-up, mégis a `wallet` alá esik | a rule ne akadjon meg a migráción |
| [[013-stripe-go-live]] | valós pénz | az élesítés **előtt** ennek a tervnek **késznek kell lennie** — ez a [[013-stripe-go-live]] A fázisának de facto bővítése |

### 7.2 Nyitott forward-compat pont a [[012-stripe-fraud-defense]] felé

A [[012-stripe-fraud-defense]] tervezett `wallet` növekmény-limit szabálya (`newData.val() <= data.val() + 2000` jellegű) **két helyen ütközik** ezzel a tervvel:

1. **Első belépés:** `data.val()` **`null`** (nincs `wallet` ág) → a szabálynak **null-safe** ágat kell tartalmaznia (`!data.exists()`), különben az `ensureUserNode` create-ág **és** a migrációs kredit-átvétel is bukik.
2. **Migrációs átvétel:** ha egy guest node > 2000⭐-ot hozna, az egylépéses írás túllépi a limitet.

Mivel a wallet-politika szerint a migráció **csak akkor** ír kreditet, ha a targetnek **egyáltalán nincs** `wallet` ága, a (2) eset a (1) alá esik → **egy jól megírt, `!data.exists()`-re felkészített szabály mindkettőt megoldja.** Ezt a [[012-stripe-fraud-defense]] E fázisában rögzíteni kell.

### 7.3 További kockázatok

- **A `rtdbKey` mező törlése breaking change a store API-jában.** Minden hívási hely átírandó (11 találat, 4 fájl). A `tsc --noEmit` teljes körűen elkapja — ez a B) változat egyik előnye.
- **`useAuthStore(selectRtdbKey)` referencia-stabilitás:** a selector `string`-et ad vissza → biztonságos. **Ha valaki később objektumot adna vissza egy hasonló selectorból, `useShallow` kell.**
- **`ensureDeviceMap` sorrendfüggés:** ha a `device_map` írása elhasal, a `users/{deviceId}` **olvasása** is bukik → a self-healing kimarad (de **nem** csúszik el az identitás). Ez elfogadható degradáció; a `console.error` megmarad (`authBootstrap.ts:105-107`).
- **Tranziens 0 kredit** pending migráció esetén (2.4) — szándékos, visszafordítható kompromisszum.
- **Debug mód `DEBUG_STARTING_CREDITS = 9000`:** debugban a `seedWallet: false` ág azt jelenti, hogy a debug-kredit sem jelenik meg addig, míg a migráció le nem fut. A `↺ Reset` gomb továbbra is működik.
- **Multi-path `update` és `undefined`:** az RTDB kliens `undefined` értékre **dob**, nem ignorál. Ez a tervben kétszer szerepel (B blokk TODO + F blokk teszt), mert a `DeepPartial` típus mellett a legkönnyebben elkövethető hiba.
- **Stale bundle:** ha a konzolban a régi viselkedés látszik, **Ctrl+Shift+R** (a [[004-firebase-auth-bugfix]] 6. szekciójában dokumentált Vite HMR probléma).

---

## 8. Tesztelés

### 8.1 Automatizált (Vitest)

A projekt **jelenleg nem mockol Firebase-t** (a meglévő tesztek: `src/services/faceRecognition.test.ts`, `src/state/useGameStore.test.ts` — jsdom, `src/test/setup.ts`, nincs firebase mock). Ez a terv vezeti be az első Firebase-mockot, a meglévő stílushoz illeszkedve (`describe`/`it`/`expect`/`beforeEach`, store-ok `setState`-tel resetelve).

**Mock-minta:**

```ts
// src/firebase/userData.test.ts
vi.mock("./config", () => ({ getFirebaseDB: () => ({}) }));
vi.mock("firebase/database", () => ({
  ref: (_db: unknown, path?: string) => ({ path: path ?? "" }),
  get: vi.fn(),
  update: vi.fn(async () => {}),
  set: vi.fn(async () => {}),
  onValue: vi.fn(),
}));
```

> ℹ️ A `migrateGuestData` a `get`-et **dinamikus** importtal hozza be (`await import("firebase/database")`, `userData.ts:158`). A `vi.mock` **mindkét** import-formát elfogja, tehát ugyanaz a mock érvényes — ezt érdemes egy megjegyzésben rögzíteni a tesztfájlban.

**Tesztesetek** (a F blokk TODO-jával 1:1):

| # | Bemenet | Elvárás |
|---|---|---|
| 1 | guest node `wallet` **nélkül** | **nem dob** `TypeError`-t (a `userData.ts:176` regressziós teszt) |
| 2 | guest node `profile` **nélkül** | nem dob; `profile/*` mezők nem kerülnek az `updates`-be |
| 3 | guest node nem létezik | `{ kind: "noop" }`, `update` **nem hívva** |
| 4 | guest node üres objektum | `{ kind: "noop" }` vagy csak takarítás; nincs kredit-írás |
| 5 | target `profile/migratedFrom/{deviceId} === true` | `{ kind: "cleaned" }`; **nincs** kredit-írás; **van** guest + `device_map` törlés |
| 6 | target `wallet: { credits: 1837 }`, guest `wallet: { credits: 500 }` | `users/{uid}/wallet/credits` **nem** kerül az `updates`-be; `profile/orphanDiscardedCredits/{deviceId} === 500`; `console.warn` hívva |
| 7 | target `wallet` **nincs**, guest `wallet: { credits: 500 }` | `users/{uid}/wallet/credits === 500` |
| 8 | inventory: guest `{ships:{a:true}}`, target `{ships:{b:true}}` | `users/{uid}/inventory/ships/a === true`; `b` **nem** kerül újra kiírásra |
| 9 | stats: guest 900, target 1200 | `stats/bestServiceSeconds` **nem** kerül az `updates`-be |
| 10 | stats: guest 1200, target 900 | `stats/bestServiceSeconds === 1200` |
| 11 | bármely fenti | `Object.values(updates)` **egyetlen `undefined`-ot sem** tartalmaz |
| 12 | bármely fenti | `Object.keys(updates)` között **nincs prefix-átfedés** (segédfüggvény a tesztben) |

**`useAuthStore` invariáns tesztek:**

| # | Művelet | Elvárás |
|---|---|---|
| 13 | `setUser({ uid: "U1", isAnonymous: true })` | `selectRtdbKey === deviceId` |
| 14 | `setUser({ uid: "U1", isAnonymous: false })` | `selectRtdbKey === "U1"` |
| 15 | (14) után `setDeviceId("D2")` | `selectRtdbKey` **továbbra is** `"U1"` |
| 16 | `setUser(null)` | `selectRtdbKey === deviceId` |
| 17 | `"setRtdbKey" in useAuthStore.getState()` | **`false`** (az action nem létezik) |

**`authBootstrap` invariáns teszt:**

| # | Forgatókönyv | Elvárás |
|---|---|---|
| 18 | Google user; `migrateGuestData` **rejected promise** | `getRtdbKey() === user.uid`; `subscribeUser` a **uid**-dal hívva; `ensureUserNode` `seedWallet: false`-szal hívva |

### 8.2 Kézi ellenőrzés

1. **A hibás állapot reprodukciója a javítás ELŐTT** (regressziós alap): DevTools → `localStorage` `deviceId` feljegyzése; belépés; RTDB-ben megnézni, melyik node-ba ír.
2. **Két böngésző, ugyanaz a Google fiók** → **ugyanaz a kredit** mindkettőben.
3. **`localhost` + hosztolt domain** ugyanazzal a fiókkal → ugyanaz a kredit (a két `deviceId` **különbözik**, de mindkettő a uid-node-ot használja).
4. **Vásárlás az egyik böngészőben** → a másikban **F5** → a levont kredit látszik (az RTDB `onValue` élőben is szinkronizál).
5. **Kijelentkezés → guest** → a `deviceId`-node látszik (0 kredit normál módban) → **újra belépés** → a uid-node kreditje **visszatér**, és **nem adódik hozzá semmi**.
6. **Kredit-duplikáció teszt:** guest vásárol → belépés → kijelentkezés → guest vásárol → belépés → **nincs duplikáció** (`migratedFrom` jelölés + wallet-politika).
7. **Self-healing teszt:** kézzel létrehozott `users/{sajátDeviceId}` node (`inventory` + `nickname`, `wallet` nélkül) + `device_map` bejegyzés → belépés → az árva **beolvad** és **törlődik**; a `migratedFrom` jelölés megjelenik.
8. **Self-healing árva kredittel:** ugyanez, de `wallet: { credits: 42 }` a guest node-ban, miközben a target `wallet` létezik → a kredit **nem** adódik hozzá, de `profile/orphanDiscardedCredits/{deviceId} === 42` megjelenik, és `console.warn` látszik.
9. **`PERMISSION_DENIED` nem jelenik meg** egyetlen forgatókönyvben sem (a root multi-path `update` engedélyezettségének élő igazolása).
10. `npm run test` + `npm run build` + `npm run build:gh-pages` + `tsc --noEmit` — mind zöld.

---

## 9. Becsült ráfordítás

| Blokk | Feladat | Nagyságrend |
|---|---|---|
| A | `rtdbKey` derivált érték + 11 call site átírása | ~2 óra |
| B | `migrateGuestData` újraírás (null-safe, atomikus, idempotens) | ~3–4 óra |
| C | `ensureUserNode` `createdAt` + `seedWallet` | ~1 óra |
| D | Self-healing (sorrend rögzítés, rotáció eltávolítás, limitáció-dokumentálás) | ~1 óra |
| E | Kézi takarítás (Console + localStorage) | ~30 perc |
| F | Tesztek (első Firebase-mock a projektben + 18 eset) | ~3–4 óra |
| G | Dokumentáció (`security.rules.json` komment, lessons-learned, kereszthivatkozások) | ~1 óra |
| — | Kézi ellenőrzés (10 pont, 2 origin, 2 böngésző) | ~1–2 óra |

**Összesen:** ~1,5 fejlesztői nap.

---

## 10. Kész definíció

- A `useAuthStore`-ban **nincs `rtdbKey` state mező és nincs `setRtdbKey` action**; a kulcs kizárólag `selectRtdbKey` / `getRtdbKey` úton érhető el, és `!user.isAnonymous` esetén **bizonyítottan** `user.uid`.
- A `migrateGuestData` **egyetlen `undefined`-ot sem** ír, **nem dob** hiányzó `wallet`/`profile`/`settings`/`stats` ág esetén, **egyetlen atomikus** írásban végzi a merge-öt + takarítást, és **idempotens** (`profile/migratedFrom/{deviceId}`).
- A **kredit soha nem adódik össze**: létező target `wallet` mindig győz; az elesett nem-nulla árva kredit `console.warn`-nal és `profile/orphanDiscardedCredits/{deviceId}` audit-mezővel **visszakövethető**.
- Az `ensureUserNode` exists-ága **kitölti a hiányzó `createdAt`-ot**, és pending migráció esetén **nem seedel `wallet`-et**.
- Ugyanaz a Google fiók **két böngészőben és két originon ugyanazt a kreditet** és ugyanazt az inventoryt látja.
- A saját origin árva node-ja **belépéskor automatikusan beolvad és törlődik**; a cross-origin limitáció **kódban és tervben is kimondva**.
- A mostani `df4ea95f` árva node és a hozzá tartozó `device_map` bejegyzés **eltűnt**, a `nickname` a uid-node-on van, az `1837` kredit **érintetlen**.
- `npm run test` (18 új eset), `npm run build`, `npm run build:gh-pages`, `tsc --noEmit` — **mind zöld**; `grep -r "setRtdbKey" src/` → **0 találat**.
- A [[012-stripe-fraud-defense]] `wallet`-szabályaira vonatkozó **forward-compat pont** (7.2) átvezetve abba a tervbe.

---

## 11. Kapcsolódó tervek

> 🔧 **Utólagos javítás:** [[010-firebase-guest-merge-single-gate]] — az itt bevezetett per-`deviceId` `migratedFrom` idempotencia-jelölés a `deviceId`-rotáció megszüntetése után **adatvesztővé** vált (a visszatérő `deviceId`-n frissen vásárolt vendég-kredit a következő Google-belépéskor a `cleanupGuestNode`-on át törlődött, merge és audit nélkül; ráadásul a `device_map/{deviceId}` nem törlődött → árva mappingek). A 010 ezt **fiók-szintű** `guestMergeClaimed` kapura cseréli, az első merge-nél **összeadja** a kreditet, és minden ágon takarítja a `device_map`-et.

- [[004-firebase-auth-bugfix]] — **közvetlen előfeltétel.** Ez a terv az ottani **O.** blokk (`migrateGuestData`, `rtdbKey`, `setRtdbKey`) és **P.** blokk (`deviceId`-rotáció) hibáit javítja: a `catch`-ági fallback törlődik, a rotáció kikerül a migrációs útból, a `rtdbKey` derivált értékké válik.
- [[012-stripe-fraud-defense]] — **erre a tervre épül.** A `credit_claims/{sessionId}` ledger és a `wallet` növekmény-limit csak stabil identitás fölött értelmes. A 7.2 forward-compat pont (`!data.exists()` ág a wallet-szabályban) ott rögzítendő.
- [[013-stripe-go-live]] — **erre a tervre épül.** Valós pénzes fizetés **nem indulhat** azelőtt, hogy ez a terv kész: egy identitás-szétválás kifizetett kreditet tüntetne el → chargeback / dispute.
- [[005-ingame-shop-strapi-stripe]] — a kredit-jóváírás célútvonala (`users/{rtdbKey}/wallet/credits`) itt válik megbízhatóvá.
- [[003-firebase-auth-settings]] — az RTDB séma és a Phase-1/Phase-2 rules eredeti forrása; a séma itt **additívan** bővül (`profile.migratedFrom`, `profile.orphanDiscardedCredits`).
- [[002-ingame-shop-frontend]] — a `useShopStore` kredit/birtoklás modellje; a `partialize` viselkedése itt **bizonyítékként** szolgál (a kredit nem perzisztálódik lokálisan).
- [[000-i18n-nyelvesites]] — csak akkor lép be, ha új `login.error.*` kulcs mellett döntünk (6. szekció).
