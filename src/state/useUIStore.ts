import { create } from "zustand";
import { MUSIC_ACTIVE_VOLUME } from "../constants/constants";
import type { Difficulty } from "../types";
import type { StateUpdater } from "./utils";
import { resolveState } from "./utils";

interface UIState {
  /** Camera error message (null = no error) */
  cameraError: string | null;
  /** Exit confirmation dialog visible */
  showExitConfirm: boolean;
  /** Music muted state (persisted) */
  isMusicMuted: boolean;
  /** Music volume 0..1 (persisted locally; Firebase-perzisztencia később) */
  musicVolume: number;
  /** Kiválasztott nehézség (a játékmenetbe később kötjük be) */
  difficulty: Difficulty;
  /** Aktív zene azonosítója (null = main_theme, különben shop zenék) */
  activeMusicId: string | null;
  /** Aktív hajó azonosítója (null = alap hajó, különben shop hajók) */
  activeShipId: string | null;

  setCameraError: (updater: StateUpdater<string | null>) => void;
  setShowExitConfirm: (updater: StateUpdater<boolean>) => void;
  setIsMusicMuted: (updater: StateUpdater<boolean>) => void;
  setMusicVolume: (updater: StateUpdater<number>) => void;
  setDifficulty: (updater: StateUpdater<Difficulty>) => void;
  setActiveMusicId: (id: string | null) => void;
  setActiveShipId: (id: string | null) => void;
}

const useUIStore = create<UIState>()((set) => ({
  cameraError: null,
  showExitConfirm: false,
  isMusicMuted: false,
  musicVolume: MUSIC_ACTIVE_VOLUME,
  difficulty: "medium",
  activeMusicId: null,
  activeShipId: null,

  setActiveMusicId: (id) => set({ activeMusicId: id }),
  setActiveShipId: (id) => set({ activeShipId: id }),

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
  setMusicVolume: (updater) =>
    set((state) => {
      const next = resolveState(updater, state.musicVolume);
      return { musicVolume: Math.max(0, Math.min(1, next)) };
    }),
  setDifficulty: (updater) =>
    set((state) => ({
      difficulty: resolveState(updater, state.difficulty),
    })),
}));

export default useUIStore;
