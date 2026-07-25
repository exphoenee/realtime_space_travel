# Megvalósítási ütemterv – közös roadmap

Ez a fájl a három terv **implementációs sorrendjét** rögzíti. A tervek egymásra épülnek, a függőségek határozott sorrendet diktálnak:

- [[i18n-nyelvesites]] – nyelvesítés (react-i18next)
- [[firebase-auth-settings]] – **kánon**: auth + perzisztens beállítások (Firebase), Settings menü, hajóválasztó
- [[ingame-shop-strapi-stripe]] – bolt (Strapi katalógus + Stripe fizetés)

## Sorrend egy pillantásra

```
Fázis 0  i18n alapréteg  ─────────────┐ (független, előre)
                                       ▼
Fázis 1  Firebase auth + RTDB + Settings menü  (gerinc)
                                       ▼
Fázis 2  Hajóválasztó + hajó-sebesség integráció
                                       ▼
Fázis 3  Bolt backend (Strapi + Cloud Functions)
                                       ▼
Fázis 4  Bolt frontend + Stripe + a 4 nyelv fordítása
```

---

## ✅ Összesített haladás

> Minden tervnek van saját, részletes **„Haladás (TODO)"** szekciója jelölőnégyzetekkel (`[ ]`/`[~]`/`[x]`) — ott vezetjük az egyes lépéseket. Ez a tábla a fázisok magas szintű állapotát mutatja; félbeszakadás után innen indulj, majd a részletekért ugorj az adott terv TODO-jára.

| Fázis | Terv | Állapot |
|-------|------|---------|
| 0 — i18n alapréteg | [[i18n-nyelvesites]] | ✅ Kész (infra + mind az 5 nyelv teljes fordítása) |
| 1 — Firebase auth + beállítások + Settings menü | [[firebase-auth-settings]] | ⬜ Nem kezdődött el |
| 2 — Hajóválasztó + sebesség | [[firebase-auth-settings]] | ⬜ Nem kezdődött el |
| 3 — Bolt backend (Strapi + Functions) | [[ingame-shop-strapi-stripe]] | ⬜ Nem kezdődött el |
| 4 — Bolt frontend + Stripe + fordítások | [[ingame-shop-strapi-stripe]] + [[i18n-nyelvesites]] | ⬜ Nem kezdődött el |

Állapot-jelölés: ⬜ nem kezdődött el · 🟨 folyamatban · ✅ kész.

---

## Fázis 0 — i18n alapréteg
**Miért előre:** nincs backend-függősége, és minden későbbi UI (Settings menü, bolt, hajóválasztó) már lokalizáltan születhet — így nem kell utólag visszabontani a hardcode-olt szövegeket.

- react-i18next init, kulcs-kiszervezés, **magyar forrás-JSON** (1:1 a mostani szöveggel).
- Komponensek `t()` / `<Trans>` átállítása.
- Nyelvváltó *működésképesen* a főmenübe/introba.
- ⏸ A 4 nyelv (en/fr/de/es) **tényleges fordítása elhalasztva Fázis 4-re** — most az infrastruktúra a cél.

**Kész, ha:** a felület magyarul kulcsokból renderel, a nyelvváltó vált (fallback: en), a `<html lang>` szinkron.

---

## Fázis 1 — Firebase auth + perzisztens beállítások + Settings menü
**Miért itt:** ez a **gerinc** (kánon-terv), erre épül a kredit/inventory és a bolt. A harang→Settings csere és a nyelvváltó beköltöztetése természetesen összeér az i18n-nel.

- Firebase projekt; **Anonymous auto-login**; Google-belépés + Anonymous→Google **linkelés**.
- RTDB séma + **Security Rules** (`wallet`/`inventory` szerver-only) — biztonsági sarokkő.
- Betöltés bejelentkezéskor: listener → `useAuthStore` / `useSettingsStore` / `useInventoryStore`.
- **Settings menü** a harang gomb helyén: fiók, zene (némítás + sáv), nyelv (i18n switcher ide költözik), rekord.

**Kész, ha:** névtelenül azonnal játszható, Google-lel be lehet lépni (haladat marad), a beállítások RTDB-ből töltődnek, a harang helyén Settings menü van.

---

## Fázis 2 — Hajóválasztó + hajó-sebesség integráció
**Miért külön, de itt:** a `ShipSelect` és a `SHIP_SPEED_KM_PER_SECOND` → **aktív hajó** átállás **közös** a bolt-tervvel — egyszer, itt érdemes megcsinálni. **Bolt nélkül is működik:** üres `inventory.ships` → csak az **alap hajó** választható (pontosan a kért viselkedés).

- Új `GamePhase: "shipSelect"`; `MainMenu` cél-választás → pending destination → `shipSelect`.
- `ShipSelect`: alap hajó mindig + birtokolt hajók; „Indítás" → `settings.activeShipId` + kamera-ellenőrzés + `startMission(ship)`.
- Sebesség-integráció: aktív hajó → `travelYears` / `Dashboard` / `MainMenu` becslés.

**Kész, ha:** küldetésválasztás után hajót lehet választani; üres inventory esetén csak az alapot; a sebesség az aktív hajóból számol.

---

## Fázis 3 — Bolt backend (Strapi katalógus + Cloud Functions)
**Miért csak most:** előfeltétele a Firebase auth + RTDB (Fázis 1).

- Strapi projekt; `Product` + `Order` content type-ok (i18n plugin a `name`/`description`-höz).
- **Firebase ID token** ellenőrzés a védett endpointokon (`verifyIdToken`).
- `/api/checkout` + `/api/webhooks/stripe` (aláírás → `Order` → Admin SDK inventory-írás).
- **Cloud Functions:** `purchaseWithCredits` (kredites vétel) + `awardWage` (küldetés végi kredit — innentől a `wage` valódi kreditet ad).
- Seed: 2-3 hajó, „Tejút DLC", 2-3 zene.

**Kész, ha:** a katalógus lekérhető, a `wage` kreditet ír a Firebase-be, a kredites vétel feloldja az inventory-t.

---

## Fázis 4 — Bolt frontend + Stripe + fordítások
- `ShopScreen` / `ProductCard` / `ShopTabs` / `CreditBalance`; `GamePhase: "shop"` + „Áruház" gomb.
- `PurchaseModal` (kredit → Cloud Function) + Stripe redirect + `CheckoutReturn` (a Firebase inventory frissülését várva).
- DLC-célok és zenék bekötése a birtoklás (Firebase `inventory`) alapján.
- ✅ **A 4 nyelv fordítása (en/fr/de/es)** már elkészült Fázis 0-ban (előrehozva) — itt már csak a **bolt új szövegeinek** fordítása marad.

**Kész, ha:** hajó/DLC/zene vásárolható kreditből és valós pénzből, a tartalom feloldódik, és mind az 5 nyelv él.

---

## Miért nem másképp
- A **bolt nem mehet előre**: a kredit/birtoklás a Firebase RTDB-ben él, az auth is Firebase — enélkül a fizetésnek nincs hová íródnia.
- Az **i18n nem mehet leghátra**: ha a Settings menüt és a boltot előbb építed magyarra hardcode-olva, utána mindent vissza kell bontani.

## Ami párhuzamosítható
- A **4 nyelv fordítása** (fordítói munka) bármikor futhat a háttérben, amint a kulcsstruktúra fix (Fázis 0 vége).
- A **Strapi katalógus feltöltése/seed** (tartalmi munka) készülhet a bolt-frontenddel párhuzamosan.
- A **Stripe és Firebase konzol-beállítások** (projektek, kulcsok, providerek, engedélyezett domainek) előre elintézhetők.

## Kritikus utak (blokkolók)
| Blokkoló | Mit tart fel |
|----------|--------------|
| Firebase Security Rules (Fázis 1) | minden kredit/inventory művelet biztonsága |
| RTDB séma véglegesítése (Fázis 1) | Settings, bolt, hajóválasztó |
| i18n kulcsstruktúra (Fázis 0) | a 4 nyelv fordítása |
| Firebase Admin SDK a Strapiban (Fázis 3) | valós pénzes vétel visszaírása |
