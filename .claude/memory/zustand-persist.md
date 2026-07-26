# Zustand persist tanulságok

## Rehidratáció + reset trükkök

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

## Persist eltávolítása Firebase RTDB migration során

Amikor a store-ok átállnak Firebase RTDB-re, a Zustand `persist` middleware **teljesen eltávolításra kerül** minden store-ból. Az RTDB lesz az egyetlen forrás (`single source of truth`). A `credits: 0` induló érték + `creditsLoaded: boolean` biztosítja, hogy a UI ne mutasson hibás adatot az RTDB első válaszáig.

**Forrás:** `useShopStore.ts`, `useUIStore.ts`, `useGameStore.ts`
