import { create } from "zustand";
import type { ShopCategory, CartItem, OwnedItems } from "../types";
import { CREDIT_PACKS, STARTING_CREDITS, DEBUG_STARTING_CREDITS, BASE_EXOPLANET_IDS } from "../constants/shopCatalog";
import useAuthStore from "./useAuthStore";
import { updateUserWallet, updateUserInventory } from "../firebase/userData";

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
  /** Set credits externally (e.g. from RTDB sync) */
  setCredits: (credits: number) => void;
  /** Set owned items externally (e.g. from RTDB sync) */
  setOwned: (owned: OwnedItems) => void;
}

const initialCredits =
  import.meta.env.VITE_DEBUG_MODE === "true" ? DEBUG_STARTING_CREDITS : STARTING_CREDITS;

const useShopStore = create<ShopState>()((set, get) => ({
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

    const newCredits = credits - total;

    set({
      credits: newCredits,
      owned: newOwned,
      cart: [],
    });

    // Persist to RTDB if signed in
    const uid = useAuthStore.getState().uid;
    if (uid) {
      updateUserWallet(uid, newCredits).catch(console.error);
      // Update inventory per category
      if (cart.some((i) => i.category === "ship")) {
        updateUserInventory(uid, "ships",
          Object.fromEntries(newOwned.ships.map((id) => [id, true]))
        ).catch(console.error);
      }
      if (cart.some((i) => i.category === "music")) {
        updateUserInventory(uid, "music",
          Object.fromEntries(newOwned.music.map((id) => [id, true]))
        ).catch(console.error);
      }
      if (cart.some((i) => i.category === "exoplanet")) {
        updateUserInventory(uid, "exoplanets",
          Object.fromEntries(newOwned.exoplanets.map((id) => [id, true]))
        ).catch(console.error);
      }
    }

    return { ok: true };
  },

  buyCredits: (packId) => {
    const pack = CREDIT_PACKS.find((p) => p.id === packId);
    if (!pack) return;
    const newCredits = get().credits + pack.credits;
    set({ credits: newCredits });
    // Persist to RTDB if signed in
    const uid = useAuthStore.getState().uid;
    if (uid) {
      updateUserWallet(uid, newCredits).catch(console.error);
    }
  },

  setCredits: (credits) => set({ credits }),
  setOwned: (owned) => set({ owned }),

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
    // Store állapot frissítése
    set({
      credits: debugCredits,
      owned: resetOwned,
      cart: [],
      isPreviewing: false,
      activePreviewId: null,
    });

    // Persist reset to RTDB if signed in
    const uid = useAuthStore.getState().uid;
    if (uid) {
      updateUserWallet(uid, debugCredits).catch(console.error);
      const emptyInventory = (ids: string[]) =>
        Object.fromEntries(ids.map((id) => [id, true]));
      updateUserInventory(uid, "ships", {}).catch(console.error);
      updateUserInventory(uid, "music", {}).catch(console.error);
      updateUserInventory(uid, "exoplanets",
        emptyInventory(resetOwned.exoplanets)
      ).catch(console.error);
    }
  },
}));

export default useShopStore;
