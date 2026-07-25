# Projekt Állapot

> Ez a fájl a Realtime Space Travel projekt jelenlegi fejlettségi szintjét dokumentálja.

## Fázisonkénti állapot

| Fázis | Leírás | Állapot |
|---|---|---|
| **0 — i18n** | Nyelvesítési alapréteg (react-i18next, 5 nyelv) | ✅ Kész |
| **1 — Firebase Auth + Beállítások** | Autentikáció + perzisztens beállítások + Settings menü | ⬜ Nem kezdődött |
| **2 — Hajóválasztó + Sebesség** | Küldetés utáni hajóválasztás, sebesség-integráció | ⬜ Nem kezdődött |
| **3 — Bolt Backend** | Strapi katalógus + Cloud Functions + Stripe | ⬜ Nem kezdődött |
| **4 — Bolt Frontend** | Bolt UI + Stripe redirect + fordítások | ⬜ Nem kezdődött |

## Implementált funkciók

### ✅ Alap játékmenet
- Intro képernyő (Star Wars-szerű csillagmező scroll)
- Főmenü (Játék / Áruház / Beállítások / Intro / Login)
- Küldetésválasztó (Proxima Centauri, Wolf 424, Ross 780)
- Beállítások (zene hangerő, nehézség, nyelv)
- Betöltő képernyő (kamera + modell inicializálás)
- Műszerfal (sebesség, cél, időjárás, hátralévő idő)
- Szünet menü + figyelmeztető rendszer

### ✅ Arcfelismerés és figyelemfigyelés
- Webkamera stream kezelés (`useCamera`)
- MediaPipe arcfelismerés (`useFaceDetection`)
- Figyelemmonitorozás (`useAttentionMonitor`)
- Arc alapú szüneteltetés + visszaszámlálás
- Billentyűzet beavatkozás detektálás

### ✅ Állapotkezelés
- `useGameStore` (Zustand + persist)
- `useUIStore` (Zustand + persist)
- GamePhase állapotgép
- `phaseToFlags` leképezés

### ✅ Nemzetköziesítés
- 5 nyelv: `en`, `hu`, `fr`, `de`, `es`
- `react-i18next` + `i18next-browser-languagedetector`
- `LanguageSwitcher` komponens
- Minden komponens `t()` / `<Trans>` használatra átállítva

### ✅ Technikai
- Vite build pipeline
- TypeScript típusbiztonság
- CSS Modules
- Vitest tesztelés
- GitHub Actions deploy
- Debug mód (kamera előnézet, metrikák)
- Képernyő orientáció/felbontás ellenőrzés
- ErrorBoundary hakezelés

## Hiányzó funkciók (tervezett)

### ⬜ Firebase Auth
- Google OAuth bejelentkezés
- Anonymous → Google fiók linkelés
- `useAuthStore` + RTDB listener

### ⬜ Perzisztens beállítások
- `useSettingsStore` (aktív hajó/zene, némítás, nyelv)
- `useInventoryStore` (birtokolt hajók/zenék/DLC, kredit)
- Firebase RTDB séma + Security Rules

### ⬜ Settings menü (fejlesztett)
- Fiók szekció (login/logout)
- Zene választó (birtokolt zenékből)
- Hajó kijelzés
- Rekord megjelenítés

### ⬜ Hajóválasztó
- `GamePhase: "shipSelect"`
- `ShipSelect` komponens
- Sebesség-integráció (aktív hajó → travelYears)

### ⬜ Bolt (Strapi + Stripe)
- Strapi projekt + Product/Order content type-ok
- Firebase ID token ellenőrzés
- `/api/checkout` + `/api/webhooks/stripe`
- Cloud Functions (`awardWage`, `purchaseWithCredits`)

### ⬜ Bolt Frontend
- `ShopScreen` + `ProductCard` + `ShopTabs`
- `CreditBalance` + `PurchaseModal`
- `CheckoutReturn` (Stripe visszatérés)
- `GamePhase: "shop"`

## Megjegyzések

- **A jelenlegi `Difficulty` beállítás** nincs bekötve a játékmenetbe (nehézség-hatás később).
- **A `useAudio`** jelenleg nem használja az aktív zene ID-t (Fázis 2-ben kerül bekötésre).
- **A harang gomb** (zene némítás) eltávolításra került — a némítás a Settings menüben érhető el (hangerő 0-ra állításával).
- **A `bestServiceSeconds`** jelenleg csak localStorage-ban mentődik — Fázis 1 után az RTDB lesz a mérvadó forrás.
