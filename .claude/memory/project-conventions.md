# Projekt konvenciók

## Mappastruktúra

| Mappa | Tartalom | Példa |
|-------|----------|-------|
| `screens/` | Teljes képernyős GamePhase nézetek | `MainMenu.tsx`, `SettingsScreen.tsx` |
| `features/` | Játék közbeni funkciók | `Dashboard.tsx`, `PauseMenu.tsx` |
| `shop/` | Áruház (10+ komponens) | `ShopScreen.tsx`, `ProductCard.tsx` |
| `ui/` | Generikus újrahasznosítható UI | `Modal.tsx`, `Tabs.tsx`, `LanguageSwitcher.tsx` |
| `routing/` | Navigációs komponens | `ScreenRouter.tsx` |

**5+ komponensnél nagyobb feature → saját mappa.**

## 🔊 MP3 / audio fájlok — egységes névkonvenció

**Minden audio fájl a `public/music/` mappában legyen** — még az alap `main_theme.mp3` is.

Fájlnevek:
- **Csupa kisbetű**
- **Szóköz helyett `_`** (underscore)
- Példa: `dust_on_the_highway.mp3`, `main_theme.mp3`

A kódban a `getTrackUrl(musicId)` helper a `SHOP_MUSIC` katalógusból képzi az URL-t: `${BASE_URL}music/${product.file}`.

## 🚀 Hajó műszerfal képek

Minden űrhajó (`ShipProduct`) rendelkezik egy `image?: string` mezővel, ami a `public/spaceships/` mappában lévő cockpit kép fájlnevét adja meg.

A kép URL képzés: `${import.meta.env.BASE_URL}spaceships/${ship.image}`

**Alap hajó képe:** `cockpit.png` (a `DEFAULT_SHIP_IMAGE` konstans `src/constants/shopCatalog.ts`-ben)

**Komponensek, ahol a cockpit kép megjelenik:**
- `Starfield.tsx` — teljes képernyős háttér (canvas drawImage) a `cockpitImageUrl` prop alapján
- `Dashboard.tsx` — kis előnézet a dashboard panelben a `shipImageUrl` prop alapján
- `ShipPreviewModal.tsx` — shop előnézet modál
- `ShipSelectScreen.tsx` — hajóválasztó kártyák (`ShipCardVisual` subkomponens)
- `ShipInfoModal.tsx` — hajó info modál
- `ProductCard.tsx` — shop termékkártyák (`renderVisual()`)

**Kép betöltési hiba esetén:** Minden komponens `useState`-alapú `imgFailed`/`setImgFailed` mechanizmust használ: ha a kép nem tölt be, elrejti és 🚀 emoji-t mutat helyette.

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

## `spawn_agents` paraméterezés

A `spawn_agents` hívásnál figyelj a JSON escape-ekre:
- Ne használj backtick-et (`) a prompt-ban — használj sima idézőjeleket
- A params mezők értékei legyenek proper JSON-ban
- Több agent spawn-olásánál minden agent kapjon saját `agent_type` + `prompt` + `params` objektumot

## Kredit kezelés

- **Normál mód:** `STARTING_CREDITS = 0` — a játékosnak nincs induló kreditje, vennie kell
- **Debug mód** (`VITE_DEBUG_MODE=true`): `DEBUG_STARTING_CREDITS = 9000`
- A `useShopStore` inicializálásában ellenőrzi a `VITE_DEBUG_MODE` környezeti változót

## 🧹 Debug reset

Debug módban a shop fejlécében legyen egy `↺ Reset` gomb, ami:
1. Nullázza a birtoklást (csak a 3 alap exobolygó marad)
2. Visszaállítja a debug kreditet (9000)
3. Kitörli a localStorage-ból a persist cache-t
4. Kényszeríti a persist újramentését
