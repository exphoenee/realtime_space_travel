import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ShopCategory, CartItem, OwnedItems } from "../types";
import { CREDIT_PACKS, STARTING_CREDITS, DEBUG_STARTING_CREDITS, BASE_EXOPLANET_IDS } from "../constants/shopCatalog";

interface ShopState {
  credits: number;
  owned: OwnedItems;
  cart: CartItem[];
  isPreviewing: boolean;
  activePreviewId: string | null;

  isOwned: (category: ShopCategory, id: string) => boolean;
  isInCart: (id: string) => boolean;
  addToCart: (item: CartItem) => void;
  removeFromCart: (id: string) => void;
  cartTotalCredits: () => number;
  checkout: () => { ok: boolean };
  buyCredits: (packId: string) => void;
  setPreviewing: (v: boolean) => void;
  setActivePreviewId: (id: string | null) => void;
  resetShop: () => void;
}

const initialCredits =
  import.meta.env.VITE_DEBUG_MODE === "true" ? DEBUG_STARTING_CREDITS : STARTING_CREDITS;

const useShopStore = create<ShopState>()(
  persist(
    (set, get) => ({
      credits: initialCredits,
      owned: { ships: [], music: [], exoplanets: [...BASE_EXOPLANET_IDS] },
      cart: [],
      isPreviewing: false,
      activePreviewId: null,

      isOwned: (category, id) => {
        const { owned } = get();
        switch (category) {
          case "exoplanet": return owned.exoplanets.includes(id);
          case "ship": return owned.ships.includes(id);
          case "music": return owned.music.includes(id);
          default: return false;
        }
      },

      isInCart: (id) => {
        return get().cart.some((item) => item.id === id);
      },

      addToCart: (item) => {
        const { cart, owned } = get();
        if (owned.ships.includes(item.id) ||
            owned.music.includes(item.id) ||
            owned.exoplanets.includes(item.id)) return;
        if (cart.some((c) => c.id === item.id)) return;
        set({ cart: [...cart, item] });
      },

      removeFromCart: (id) => {
        set({ cart: get().cart.filter((item) => item.id !== id) });
      },

      cartTotalCredits: () => {
        return get().cart.reduce((sum, item) => sum + item.priceCredits, 0);
      },

      checkout: () => {
        const { credits, cart, owned } = get();
        const total = cart.reduce((sum, item) => sum + item.priceCredits, 0);
        if (credits < total) return { ok: false };

        const newOwned = { ...owned };
        for (const item of cart) {
          if (item.category === "exoplanet") {
            newOwned.exoplanets = [...newOwned.exoplanets, item.id];
          } else if (item.category === "ship") {
            newOwned.ships = [...newOwned.ships, item.id];
          } else if (item.category === "music") {
            newOwned.music = [...newOwned.music, item.id];
          }
        }

        set({
          credits: credits - total,
          owned: newOwned,
          cart: [],
        });
        return { ok: true };
      },

      buyCredits: (packId) => {
        const pack = CREDIT_PACKS.find((p) => p.id === packId);
        if (!pack) return;
        set((state) => ({ credits: state.credits + pack.credits }));
      },

      setPreviewing: (v) => set({ isPreviewing: v }),
      setActivePreviewId: (id) => set({ activePreviewId: id }),

      resetShop: () => {
        const debugCredits =
          import.meta.env.VITE_DEBUG_MODE === "true"
            ? DEBUG_STARTING_CREDITS
            : STARTING_CREDITS;
        const resetOwned: OwnedItems = {
          ships: [],
          music: [],
          exoplanets: [...BASE_EXOPLANET_IDS],
        };
        // 1. Store állapot frissítése
        set({
          credits: debugCredits,
          owned: resetOwned,
          cart: [],
          isPreviewing: false,
          activePreviewId: null,
        });
        // 2. Persisted localStorage kulcs törlése (biztos, ami biztos)
        try {
          localStorage.removeItem("space-travel-shop");
        } catch { /* ok */ }
        // 3. Újramentés a persist-be a tiszta állapottal
        set({
          credits: debugCredits,
          owned: resetOwned,
          cart: [],
        });
      },
    }),
    {
      name: "space-travel-shop",
      partialize: (state) => ({
        credits: state.credits,
        owned: state.owned,
      }),
    },
  ),
);

export default useShopStore;
