import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ShopCategory, CartItem, OwnedItems } from "../types";
import { CREDIT_PACKS, STARTING_CREDITS, DEBUG_STARTING_CREDITS, BASE_EXOPLANET_IDS, DEFAULT_SHIP } from "../constants/shopCatalog";
import { getRtdbKey } from "./useAuthStore";
import { updateUserWallet, updateUserInventory } from "../firebase/userData";

interface ShopState {
  credits: number;
  /** True once credits have been loaded from RTDB (before that, show "—"). */
  creditsLoaded: boolean;
  owned: OwnedItems;
  cart: CartItem[];
  isPreviewing: boolean;
  activePreviewId: string | null;
  /** Persisted: which shop tab was active ("exoplanets" | "ships" | "music" | "credits") */
  activeShopTab: string;

  isOwned: (category: ShopCategory, id: string) => boolean;
  isInCart: (id: string) => boolean;
  addToCart: (item: CartItem) => void;
  removeFromCart: (id: string) => void;
  cartTotalCredits: () => number;
  checkout: () => { ok: boolean };
  buyCredits: (packId: string) => void;
  setPreviewing: (v: boolean) => void;
  setActivePreviewId: (id: string | null) => void;
  setActiveShopTab: (tab: string) => void;
  resetShop: () => void;
  /** Set credits externally (e.g. from RTDB sync) */
  setCredits: (credits: number) => void;
  /** Set owned items externally (e.g. from RTDB sync) */
  setOwned: (owned: OwnedItems) => void;
}

const useShopStore = create<ShopState>()(
  persist(
    (set, get) => ({
      // RTDB is the single source of truth for credits. Start at 0 / not-loaded;
      // the real balance arrives via setCredits from the RTDB sync.
      credits: 0,
      creditsLoaded: false,
      owned: { ships: [], music: [], exoplanets: [...BASE_EXOPLANET_IDS] },
      cart: [],
      isPreviewing: false,
      activePreviewId: null,
      activeShopTab: "exoplanets",

      isOwned: (category, id) => {
        const { owned } = get();
        switch (category) {
          case "exoplanet": return owned.exoplanets.includes(id);
          case "ship": return id === DEFAULT_SHIP.id || owned.ships.includes(id);
          case "music": return owned.music.includes(id);
          default: return false;
        }
      },

      isInCart: (id) => {
        return get().cart.some((item) => item.id === id);
      },

      addToCart: (item) => {
        const { credits, cart, owned } = get();
        if (owned.ships.includes(item.id) ||
            owned.music.includes(item.id) ||
            owned.exoplanets.includes(item.id)) return;
        if (cart.some((c) => c.id === item.id)) return;
        const cartTotal = cart.reduce((sum, i) => sum + i.priceCredits, 0);
        // Don't allow adding an item if it would exceed the user's credit balance
        if (credits < cartTotal + item.priceCredits) return;
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

        const newCredits = credits - total;

        set({
          credits: newCredits,
          owned: newOwned,
          cart: [],
        });

        // Persist to RTDB if signed in (use rtdbKey — derived from auth state)
        const rtdbKey = getRtdbKey();
        if (rtdbKey) {
          updateUserWallet(rtdbKey, newCredits).catch(console.error);
          // Update inventory per category
          if (cart.some((i) => i.category === "ship")) {
            updateUserInventory(rtdbKey, "ships",
              Object.fromEntries(newOwned.ships.map((id) => [id, true]))
            ).catch(console.error);
          }
          if (cart.some((i) => i.category === "music")) {
            updateUserInventory(rtdbKey, "music",
              Object.fromEntries(newOwned.music.map((id) => [id, true]))
            ).catch(console.error);
          }
          if (cart.some((i) => i.category === "exoplanet")) {
            updateUserInventory(rtdbKey, "exoplanets",
              Object.fromEntries(newOwned.exoplanets.map((id) => [id, true]))
            ).catch(console.error);
          }
        }

        return { ok: true };
      },

      /**
       * Buy credits (DEBUG / non-Stripe path).
       *
       * This adds credits to the LOCAL store and then OVERWRITES the server
       * balance with `updateUserWallet` (set-based). This is used for:
       * - Debug/add-credits button
       * - Non-Stripe test flows
       *
       * For Stripe Payment Link purchases, the return flow uses
       * `incrementUserWallet` (runTransaction-based) in ShopScreen.tsx
       * which ATOMICALLY adds credits to the server balance without
       * overwriting existing credits.
       */
      buyCredits: (packId) => {
        const pack = CREDIT_PACKS.find((p) => p.id === packId);
        if (!pack) return;
        const newCredits = get().credits + pack.credits;
        set({ credits: newCredits });
        // Persist to RTDB if signed in (use rtdbKey)
        const rtdbKey = getRtdbKey();
        if (rtdbKey) {
          updateUserWallet(rtdbKey, newCredits).catch(console.error);
        }
      },

      setCredits: (credits) => set({ credits, creditsLoaded: true }),
      setOwned: (owned) => set({ owned }),

      setPreviewing: (v) => set({ isPreviewing: v }),
      setActivePreviewId: (id) => set({ activePreviewId: id }),
      setActiveShopTab: (tab) => set({ activeShopTab: tab }),

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
        // Store állapot frissítése
        set({
          credits: debugCredits,
          owned: resetOwned,
          cart: [],
          isPreviewing: false,
          activePreviewId: null,
        });

        // Persist reset to RTDB if signed in (use rtdbKey)
        const rtdbKey = getRtdbKey();
        if (rtdbKey) {
          updateUserWallet(rtdbKey, debugCredits).catch(console.error);
          const emptyInventory = (ids: string[]) =>
            Object.fromEntries(ids.map((id) => [id, true]));
          updateUserInventory(rtdbKey, "ships", {}).catch(console.error);
          updateUserInventory(rtdbKey, "music", {}).catch(console.error);
          updateUserInventory(rtdbKey, "exoplanets",
            emptyInventory(resetOwned.exoplanets)
          ).catch(console.error);
        }
      },
    }),
    {
      name: "space-travel-shop",
      storage: createJSONStorage(() => localStorage),
      // Only persist the activeShopTab — all other state (credits, owned, cart)
      // is session-only or synced from Firebase RTDB.
      partialize: (state) => ({
        activeShopTab: state.activeShopTab,
      }),
    },
  ),
);

export default useShopStore;
