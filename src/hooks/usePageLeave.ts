import { useEffect } from "react";
import useGameStore from "../state/useGameStore";
import { INACTIVITY_LIMIT_SECONDS } from "../constants/constants";

/**
 * LocalStorage key for the timestamp when the page was last hidden.
 * Used to calculate elapsed time on return.
 */
const PAGE_LEAVE_KEY = "space-travel-page-leave";

/**
 * Hook that tracks when the user leaves the page (tab switch, minimize,
 * browser close) and handles the return logic:
 *
 * - If in-game and the user was away > 60s → game over (crewLost).
 * - If in-game and the user was away ≤ 60s → restore the countdown
 *   with the actual elapsed time.
 * - If not in a game phase (intro, mainMenu, shop, etc.) → no action.
 *
 * Also saves a timestamp on window.beforeunload so an accidental F5
 * refresh during a mission restores the correct elapsed time on return.
 */
export const usePageLeave = () => {
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // User left the page — save the current timestamp if in a game phase.
        const gs = useGameStore.getState();
        if (
          gs.gamePhase === "playing" ||
          gs.gamePhase === "paused" ||
          gs.gamePhase === "countdown"
        ) {
          localStorage.setItem(PAGE_LEAVE_KEY, String(Date.now()));
        }
      } else {
        // User returned to the page.
        const raw = localStorage.getItem(PAGE_LEAVE_KEY);
        if (!raw) return;

        localStorage.removeItem(PAGE_LEAVE_KEY);
        const leftAt = parseInt(raw, 10);
        if (Number.isNaN(leftAt)) return;

        const elapsedSeconds = Math.round((Date.now() - leftAt) / 1000);
        if (elapsedSeconds <= 0) return;

        const gs = useGameStore.getState();
        // Only apply the page-leave logic if we were in an active game session.
        if (gs.destination && !gs.crewLost && !gs.missionComplete) {
          if (elapsedSeconds > INACTIVITY_LIMIT_SECONDS) {
            // Away too long — game over. transitionTo sets showIntro=false etc.
            gs.transitionTo("crewLost");
            gs.setCrewLostReason("attention");
          } else {
            // Away ≤ 60s — restore the countdown with the real elapsed time.
            gs.setInactivitySeconds(elapsedSeconds);
            if (
              gs.gamePhase === "playing" ||
              gs.gamePhase === "paused" ||
              gs.gamePhase === "countdown"
            ) {
              gs.transitionTo("paused");
            }
          }
        }
      }
    };

    const handleBeforeUnload = () => {
      const gs = useGameStore.getState();
      if (
        gs.gamePhase === "playing" ||
        gs.gamePhase === "paused" ||
        gs.gamePhase === "countdown"
      ) {
        // Use the raw storage setter because the component may already be
        // unmounting at this point and React state is unreliable.
        try {
          localStorage.setItem(PAGE_LEAVE_KEY, String(Date.now()));
        } catch {
          // Silently fail — localStorage might not be available.
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);
};
