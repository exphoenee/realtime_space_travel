import useGameStore from "./useGameStore";
import useShopStore from "./useShopStore";
import { BASE_EXOPLANET_IDS } from "../constants/shopCatalog";

/**
 * Drop every locally cached value that belongs to ONE account.
 *
 * Most stores are re-hydrated from RTDB (`handleUserData` treats RTDB as the
 * single source of truth for wallet + inventory), but that only happens once
 * the new identity's node arrives. Until then the previous account's numbers
 * stay on screen — and `failureRecords` / `successRecords` are never replaced
 * at all, only merged into, so they would leak permanently.
 *
 * Deliberately LOCAL-only: no RTDB writes. `useShopStore.resetShop()` is not
 * used here precisely because it persists the reset remotely, which would
 * damage the account being left behind.
 *
 * Device-level preferences (music volume, language, difficulty, camera
 * consent) are intentionally kept — they belong to the browser, not the user.
 */
export const clearUserScopedData = (): void => {
  useGameStore.getState().clearUserScopedData();

  useShopStore.setState({
    credits: 0,
    creditsLoaded: false,
    owned: { ships: [], music: [], exoplanets: [...BASE_EXOPLANET_IDS] },
    cart: [],
    purchaseHistory: [],
  });
};
