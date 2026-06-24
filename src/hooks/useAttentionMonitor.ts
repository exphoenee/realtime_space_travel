import { useEffect } from "react";
import { Destination } from "../types";
import useGameStore from "../state/useGameStore";
import useUIStore from "../state/useUIStore";

export const useAttentionMonitor = (
  faceStatus: { detected: boolean; timestamp: number },
  destination: Destination | null,
) => {
  const setIsPaused = useGameStore((s) => s.setIsPaused);
  const setIsAttentionLost = useGameStore((s) => s.setIsAttentionLost);
  const setInactivitySeconds = useGameStore((s) => s.setInactivitySeconds);

  useEffect(() => {
    if (!destination) return;

    const gameSnapshot = useGameStore.getState();
    const uiSnapshot = useUIStore.getState();

    const attentionLost = !faceStatus.detected;
    const blockingOverlay =
      uiSnapshot.showExitConfirm ||
      gameSnapshot.crewLost ||
      !!uiSnapshot.cameraError ||
      gameSnapshot.missionComplete;

    // --- gamePhase transitions for attention ---
    if (attentionLost && !gameSnapshot.debugIgnoreAttention && !blockingOverlay) {
      if (gameSnapshot.gamePhase === "playing") {
        gameSnapshot.transitionTo("paused");
      }
    } else if (!blockingOverlay) {
      if (gameSnapshot.gamePhase === "paused" || gameSnapshot.gamePhase === "countdown") {
        gameSnapshot.transitionTo("playing");
      }
    }

    // --- legacy boolean setters (backward compat) ---
    setIsAttentionLost(attentionLost && !blockingOverlay);

    if (attentionLost && !gameSnapshot.debugIgnoreAttention) {
      setIsPaused(true);
    } else if (!blockingOverlay) {
      setIsPaused(false);
    }

    if (!attentionLost) {
      setInactivitySeconds(0);
    }
  }, [
    faceStatus.timestamp,
    faceStatus.detected,
    destination,
    setIsPaused,
    setIsAttentionLost,
    setInactivitySeconds,
  ]);
};
