import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Destination } from "../types";

export type CrewLostReason = "attention" | "buttons" | null;

type StateUpdater<T> = T | ((prev: T) => T);

const resolveState = <T>(updater: StateUpdater<T>, current: T): T => {
  return typeof updater === "function"
    ? (updater as (prev: T) => T)(current)
    : updater;
};

interface GameState {
  destination: Destination | null;
  remainingYears: number;
  isPaused: boolean;
  cameraError: string | null;
  showExitConfirm: boolean;
  showIntro: boolean;
  isAttentionLost: boolean;
  inactivitySeconds: number;
  crewLost: boolean;
  crewLostReason: CrewLostReason;
  missionComplete: boolean;
  canvasBounds: DOMRectReadOnly | null;
  serviceSeconds: number;
  bestServiceSeconds: number;
  isMusicMuted: boolean;
  isInitializing: boolean;
  setDestination: (updater: StateUpdater<Destination | null>) => void;
  setRemainingYears: (updater: StateUpdater<number>) => void;
  setIsPaused: (updater: StateUpdater<boolean>) => void;
  setCameraError: (updater: StateUpdater<string | null>) => void;
  setShowExitConfirm: (updater: StateUpdater<boolean>) => void;
  setShowIntro: (updater: StateUpdater<boolean>) => void;
  setIsAttentionLost: (updater: StateUpdater<boolean>) => void;
  setInactivitySeconds: (updater: StateUpdater<number>) => void;
  setCrewLost: (updater: StateUpdater<boolean>) => void;
  setCrewLostReason: (updater: StateUpdater<CrewLostReason>) => void;
  setMissionComplete: (updater: StateUpdater<boolean>) => void;
  setCanvasBounds: (updater: StateUpdater<DOMRectReadOnly | null>) => void;
  setServiceSeconds: (updater: StateUpdater<number>) => void;
  setBestServiceSeconds: (updater: StateUpdater<number>) => void;
  setIsMusicMuted: (updater: StateUpdater<boolean>) => void;
  setIsInitializing: (updater: StateUpdater<boolean>) => void;
}

const useGameStore = create<GameState>()(
  persist(
    (set) => ({
      destination: null,
      remainingYears: 0,
      isPaused: true,
      cameraError: null,
      showExitConfirm: false,
      showIntro: true,
      isAttentionLost: false,
      inactivitySeconds: 0,
      crewLost: false,
      crewLostReason: null,
      missionComplete: false,
      canvasBounds: null,
      serviceSeconds: 0,
      bestServiceSeconds: 0,
      isMusicMuted: false,
      isInitializing: false,
      setDestination: (updater) =>
        set((state) => ({
          destination: resolveState(updater, state.destination),
        })),
      setRemainingYears: (updater) =>
        set((state) => ({
          remainingYears: resolveState(updater, state.remainingYears),
        })),
      setIsPaused: (updater) =>
        set((state) => ({
          isPaused: resolveState(updater, state.isPaused),
        })),
      setCameraError: (updater) =>
        set((state) => ({
          cameraError: resolveState(updater, state.cameraError),
        })),
      setShowExitConfirm: (updater) =>
        set((state) => ({
          showExitConfirm: resolveState(updater, state.showExitConfirm),
        })),
      setShowIntro: (updater) =>
        set((state) => ({
          showIntro: resolveState(updater, state.showIntro),
        })),
      setIsAttentionLost: (updater) =>
        set((state) => ({
          isAttentionLost: resolveState(updater, state.isAttentionLost),
        })),
      setInactivitySeconds: (updater) =>
        set((state) => ({
          inactivitySeconds: resolveState(updater, state.inactivitySeconds),
        })),
      setCrewLost: (updater) =>
        set((state) => ({
          crewLost: resolveState(updater, state.crewLost),
        })),
      setCrewLostReason: (updater) =>
        set((state) => ({
          crewLostReason: resolveState(updater, state.crewLostReason),
        })),
      setMissionComplete: (updater) =>
        set((state) => ({
          missionComplete: resolveState(updater, state.missionComplete),
        })),
      setCanvasBounds: (updater) =>
        set((state) => ({
          canvasBounds: resolveState(updater, state.canvasBounds),
        })),
      setServiceSeconds: (updater) =>
        set((state) => ({
          serviceSeconds: resolveState(updater, state.serviceSeconds),
        })),
      setBestServiceSeconds: (updater) =>
        set((state) => ({
          bestServiceSeconds: resolveState(updater, state.bestServiceSeconds),
        })),
      setIsMusicMuted: (updater) =>
        set((state) => ({
          isMusicMuted: resolveState(updater, state.isMusicMuted),
        })),
      setIsInitializing: (updater) =>
        set((state) => ({
          isInitializing: resolveState(updater, state.isInitializing),
        })),
    }),
    {
      name: "space-travel-game",
      partialize: (state) => ({
        bestServiceSeconds: state.bestServiceSeconds,
        isMusicMuted: state.isMusicMuted,
      }),
    },
  ),
);

export default useGameStore;
