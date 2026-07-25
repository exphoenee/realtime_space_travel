# Lessons Learned — Realtime Space Travel

> Minden olyan tanulság, amit a fejlesztés során késtek és amiket érdemes rögzíteni, hogy hasonlókat már ne kelljen kérni.

---

## ♻️ Újrahasznosítható komponensek — GENERIKUS először

**Ha egy komponensre 2+ helyen van szükség (pl. modal, tab, gomb), előbb hozd létre generikusként (`src/components/ui/`), és csak utána használd a feature-ökben.** A feature-specifikus komponensek SOHA ne kerüljenek a `ui/` mappába.

✅ Helyes: `Modal.tsx` + `Tabs.tsx` → `src/components/ui/` → shop importálja
❌ Helytelen: modal logika beégetve a `ShopScreen.tsx`-be

---

## 📁 Mappastruktúra — feature-ök külön mappában

A komponensek logikai csoportokba rendezve:

| Mappa | Tartalom | Példa |
|-------|----------|-------|
| `screens/` | Teljes képernyős GamePhase nézetek | `MainMenu.tsx`, `SettingsScreen.tsx` |
| `features/` | Játék közbeni funkciók | `Dashboard.tsx`, `PauseMenu.tsx` |
| `shop/` | Áruház (10+ komponens) | `ShopScreen.tsx`, `ProductCard.tsx` |
| `ui/` | Generikus újrahasznosítható UI | `Modal.tsx`, `Tabs.tsx`, `LanguageSwitcher.tsx` |
| `routing/` | Navigációs komponens | `ScreenRouter.tsx` |

**5+ komponensnél nagyobb feature → saját mappa.** Ne rakj mindent egy kupacba.

---

## 🗂️ JSON adat — nested objektumok

A `exoplanets.json`-ban az `images` mező értékei **objektumok**, nem string URL-ek:

```json
{
  "images": {
    "ESA": { "url": "https://...", "type": "artist_impression", "source": "ESA" }
  }
}
```

A kódban **mindig** használj `extractImageUrl()` helper-t, ami kezeli mind a string, mind az objektum formátumot. Ne cast-olj `as [string, string][]`-ként anélkül, hogy megnézted volna a tényleges adatot.

A `links` mező értékei viszont **string URL-ek** — ott nincs szükség a helper-re.

---

## 🔊 MP3 / audio fájlok — egységes névkonvenció

**Minden audio fájl a `public/music/` mappában legyen** — még az alap `main_theme.mp3` is.

Fájlnevek:
- **Csupa kisbetű**
- **Szóköz helyett `_`** (underscore)
- Példa: `dust_on_the_highway.mp3`, `main_theme.mp3`

A kódban a `getTrackUrl(musicId)` helper a `SHOP_MUSIC` katalógusból képzi az URL-t: `${BASE_URL}music/${product.file}`.

---

## 🔄 Zustand persist — rehidratáció + reset trükkök

**Probléma:** A Zustand persist middleware aszinkron módon rehidratál a localStorage-ból. Ha a store-ban resetet hívsz, a persist elmenti az új állapotot, de ha lap újratöltés után a régi adat kerül vissza, a componentek régi adatot látnak.

**Megoldás** (belt-and-suspenders):
```ts
resetShop: () => {
  const resetOwned: OwnedItems = {
    ships: [],
    music: [],
    exoplanets: [...BASE_EXOPLANET_IDS],
  };
  set({
    credits: isDebugMode ? DEBUG_STARTING_CREDITS : STARTING_CREDITS,
    owned: resetOwned,
    cart: [],
    isPreviewing: false,
    activePreviewId: null,
  });
  // localStorage törlés a persist cache miatt
  localStorage.removeItem("space-travel-shop");
  // Második set() kényszeríti a persist újramentését
  set({});
}
```

---

## 🎵 Zenelejátszás — egyszerre csak 1 előnézet

**Singleton minta:** a `MusicPreviewButton` modul-szintű `globalStopPreview` függvényreferenciát használ. Amikor egy új előnézet indul, a globális stop meghívja az előzőt, így garantáltan csak 1 előnézet szól egyszerre.

```ts
let globalStopPreview: (() => void) | null = null;
```

A store-beli `activePreviewId` segít nyomon követni, melyik zene játszik éppen (munkamenet-állapot, **nem perzisztálva**).

**Háttérzene a shopban:** NEM szól — `shouldPlayMusic` kizárja a `"shop"` fázist.

---

## 🔍 Keresőmező — csak termék tabokon

A keresőmező csak az **exobolygók, űrhajók, zenék** tabokon jelenjen meg. A **kredit vásárlás** tabon nincs kereső.

---

## 📜 Scroll — csak a grid scrollázzon

A tabok + keresőmező fixek maradjanak, csak a `.productGrid` container scrollázzon. Használj flex scroll chain-t:

```css
.productGridWrapper {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}
.productGrid {
  flex: 1;
  overflow-y: auto;
  /* ... */
}
```

---

## 🖼️ Kép onError fallback

Ha egy `<img>` betöltése meghiúsul (rossz URL, HTML oldal képként), mindig legyen `onError` handler ami **placeholdert** jelenít meg (pl. `🌌 ESA`), ne hagyjon broken image ikont.

---

## 🧩 Generikus komponensek iránya

A `src/components/ui/`-beli komponensek SOHA nem importálhatnak feature-specifikus modulokat (pl. `shopCatalog`, `useShopStore`). Csak **props-on keresztül** kapnak adatot. A feature-k importálják a `ui/` komponenseket, nem fordítva.

---

## 🎯 `spawn_agents` paraméterezés

A `spawn_agents` hívásnál figyelj a JSON escape-ekre:
- Ne használj backtick-et (`) a prompt-ban — használj sima idézőjeleket
- A params mezők értékei legyenek proper JSON-ban
- Több agent spawn-olásánál minden agent kapjon saját `agent_type` + `prompt` + `params` objektumot

---

## 🌐 i18n kulcsütközések

A `shop.credits` egyszerre volt string („kredit") és object namespace (`shop.credits.title`, `shop.credits.starter`). **Ez nem működik.** Ha egy kulcs alatt vannak alkulcsok, az a kulcs maga nem lehet string-kulcs. Használj másik nevet: `shop.creditsLabel` a string helyett.

---

## 💰 Kredit kezelés

- **Normál mód:** `STARTING_CREDITS = 0` — a játékosnak nincs induló kreditje, vennie kell
- **Debug mód** (`VITE_DEBUG_MODE=true`): `DEBUG_STARTING_CREDITS = 9000`
- A `useShopStore` inicializálásában ellenőrzi a `VITE_DEBUG_MODE` környezeti változót

---

## ⭐ Dupla ⭐ ikon

A kredit egyenleg kijelzőben (`CreditBalance`) a ⭐ ikont CSAK a fordítási kulcs tartalmazza (`"⭐ {{count}} kredit"`). A komponens NE tartalmazzon külön ⭐ ikont — különben duplán jelenik meg.

---

## 🧹 Debug reset

Debug módban a shop fejlécében legyen egy `↺ Reset` gomb, ami:
1. Nullázza a birtoklást (csak a 3 alap exobolygó marad)
2. Visszaállítja a debug kreditet (9000)
3. Kitörli a localStorage-ból a persist cache-t
4. Kényszeríti a persist újramentését

---

## 🏗️ Kártya layout

- `grid-auto-rows: min-content` + `align-items: start` — a termékkártyák ne nyúljanak ki függőlegesen
- `justify-content: center` — kredit kártyák középre igazítva
- A preview modal-okban a képek `onError` handler-t használjanak
