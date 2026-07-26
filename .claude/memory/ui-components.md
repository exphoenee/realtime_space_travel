# UI komponens minták

## ♻️ Újrahasznosítható komponensek — GENERIKUS először

**Ha egy komponensre 2+ helyen van szükség (pl. modal, tab, gomb), előbb hozd létre generikusként (`src/components/ui/`), és csak utána használd a feature-ökben.** A feature-specifikus komponensek SOHA ne kerüljenek a `ui/` mappába.

✅ Helyes: `Modal.tsx` + `Tabs.tsx` → `src/components/ui/` → shop importálja
❌ Helytelen: modal logika beégetve a `ShopScreen.tsx`-be

## 🧩 Generikus komponensek iránya

A `src/components/ui/`-beli komponensek SOHA nem importálhatnak feature-specifikus modulokat (pl. `shopCatalog`, `useShopStore`). Csak **props-on keresztül** kapnak adatot. A feature-k importálják a `ui/` komponenseket, nem fordítva.

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

## Ceruza/pipa toggle mező

**Minta:** Settings fiók szekcióban editable text input ✏️/✓ toggle:
- Zárolt állapot: `disabled` input + ✏️ gomb
- Szerkesztés: aktív input + ✓ gomb
- Enter = mentés, Escape = visszaállítás + zárás
- Store-ba + RTDB-be mentés a pipa gombra vagy Enter-re

**Forrás:** `SettingsScreen.tsx` handleNicknameSave

### 30 karakter maxLength

Az editable nickname mező `maxLength={30}` korlátot kap, hogy ne lehessen túl hosszú neveket tárolni az RTDB-ben.

## Google név + "Hitelesítve" badge két sorban

**Minta:** A Settings fiók szekciójában a bal oldali label:
1. sor: Google display name (nagyobb, vastagabb betű)
2. sor: "Hitelesítve" badge (kisebb, halványabb betű)
Korábban a név és a badge ugyanabban a span-ben volt `??` operátorral — a név helyettesítette a "Hitelesítve" feliratot.

**Forrás:** `SettingsScreen.tsx` account section label, `SettingsScreen.module.css`

## CustomSelect komponens (dropdown)

Natív `<select>` helyett egyedi dropdown `role="combobox"`, billentyűzet navigáció (Enter/Escape/ArrowUp/Down), ARIA attribútumok (`aria-expanded`, `aria-activedescendant`, `aria-haspopup`), dark téma scrollbar.

**Forrás:** `src/components/ui/CustomSelect.tsx`, `CustomSelect.module.css`

## ⭐ Dupla ⭐ ikon

A kredit egyenleg kijelzőben (`CreditBalance`) a ⭐ ikont CSAK a fordítási kulcs tartalmazza (`"⭐ {{count}} kredit"`). A komponens NE tartalmazzon külön ⭐ ikont — különben duplán jelenik meg.

## 🏗️ Kártya layout

- `grid-auto-rows: min-content` + `align-items: start` — a termékkártyák ne nyúljanak ki függőlegesen
- `justify-content: center` — kredit kártyák középre igazítva
- A preview modal-okban a képek `onError` handler-t használjanak

## 📜 Scroll — csak a grid scrollozzon

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
}
```

## 🖼️ Kép onError fallback

Ha egy `<img>` betöltése meghiúsul (rossz URL, HTML oldal képként), mindig legyen `onError` handler ami **placeholdert** jelenít meg (pl. `🌌 ESA`), ne hagyjon broken image ikont.

## 🔍 Keresőmező — csak termék tabokon

A keresőmező csak az **exobolygók, űrhajók, zenék** tabokon jelenjen meg. A **kredit vásárlás** tabon nincs kereső.
