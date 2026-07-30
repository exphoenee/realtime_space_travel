/**
 * Debug-only mission record generation.
 *
 * Shared by the in-game debug event bar and the Wall of Shame's debug actions.
 * It lives in one place because the two call sites had already drifted: the
 * event bar only called the store action, which mutates in-memory state and
 * nothing else. Since `successRecords` / `failureRecords` are deliberately
 * excluded from localStorage persistence (RTDB is the single source of truth —
 * see the `partialize` comment in `useGameStore`), those records were lost on
 * reload and never reached the Wall of Shame, which reads from RTDB.
 *
 * Keep both call sites on these helpers so the behaviour cannot diverge again.
 */

import useGameStore from "../state/useGameStore";
import useShopStore from "../state/useShopStore";
import { getRtdbKey } from "../state/useAuthStore";
import {
  saveSuccessRecord,
  saveFailureRecord,
  incrementUserWallet,
} from "../firebase/userData";

/**
 * Injects a random successful arrival: store record, RTDB write and the wallet
 * reward, exactly as a real mission completion would.
 */
export const generateDebugArrival = (): void => {
  useGameStore.getState().addDummySuccessRecord();

  const { successRecords } = useGameStore.getState();
  const latest = successRecords[successRecords.length - 1];
  if (!latest) return;

  const rtdbKey = getRtdbKey();
  if (rtdbKey) {
    saveSuccessRecord(rtdbKey, latest).catch(console.error);
  }

  // Credit the wallet locally even when signed out, so the debug flow still
  // shows the reward; the RTDB increment only runs for a known account.
  const reward = latest.rewardCredits ?? 0;
  if (reward > 0) {
    const { credits } = useShopStore.getState();
    useShopStore.setState({ credits: credits + reward });
    if (rtdbKey) {
      incrementUserWallet(rtdbKey, reward).catch(console.error);
    }
  }
};

/** Injects a random mission failure: store record plus the RTDB write. */
export const generateDebugFailure = (): void => {
  useGameStore.getState().addDummyFailureRecord();

  const rtdbKey = getRtdbKey();
  if (!rtdbKey) return;

  const { failureRecords } = useGameStore.getState();
  const latest = failureRecords[failureRecords.length - 1];
  if (latest) {
    saveFailureRecord(rtdbKey, latest).catch(console.error);
  }
};
