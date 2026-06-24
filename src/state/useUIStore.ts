import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CrewLostReason = "attention" | "buttons" | null;

type StateUpdater<T> = T | ((prev: T) => T);

const resolveState = <T>(updater: StateUpdater<T>, current: T): T => {
  return typeof updater === "function"
    ? (updater as (prev: T) => T)(current)
    : updater;
};

interface UIState {
  /** Camera error message (null = no error) */
  cameraError: string | null;
  /** Exit confirmation dialog visible */
  showExitConfirm: boolean;
  /** Music muted state (persisted) */
  isMusicMuted: boolean;

  setCameraError: (updater: StateUpdater<string | null>) => void;
  setShowExitConfirm: (updater: StateUpdater<boolean>) => void;
  setIsMusicMuted: (updater: StateUpdater<boolean>) => void;
}

const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      cameraError: null,
      showExitConfirm: false,
      isMusicMuted: false,

      setCameraError: (updater) =>
        set((state) => ({
          cameraError: resolveState(updater, state.cameraError),
        })),
      setShowExitConfirm: (updater) =>
        set((state) => ({
          showExitConfirm: resolveState(updater, state.showExitConfirm),
        })),
      setIsMusicMuted: (updater) =>
        set((state) => ({
          isMusicMuted: resolveState(updater, state.isMusicMuted),
        })),
    }),
    {
      name: "space-travel-ui",
      partialize: (state) => ({
        isMusicMuted: state.isMusicMuted,
      }),
    },
  ),
);

export default useUIStore;
