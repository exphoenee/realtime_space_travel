import { create } from "zustand";
import { MUSIC_ACTIVE_VOLUME } from "../constants/constants";
import type { Difficulty } from "../types";
import type { StateUpdater } from "./utils";
import { resolveState } from "./utils";
import { getRtdbKey } from "./useAuthStore";
import { updateUserSettings } from "../firebase/userData";

export type CameraConsent = "undecided" | "granted" | "denied";

/**
 * What led to the camera consent screen. Only `"start"` — the main menu Start
 * button — may continue into the game; every other entry point returns to the
 * menu, so the mission can never begin behind the player's back.
 */
export type CameraConsentOrigin = "boot" | "start" | "settings";

interface UIState {
  /** Camera error message (null = no error) */
  cameraError: string | null;
  /** Camera consent state — undecided (default), granted, or denied */
  cameraConsent: CameraConsent;
  /** Which action opened the consent screen — decides where it returns to */
  cameraConsentOrigin: CameraConsentOrigin;
  /**
   * True while the intro is replayed from the main menu. Such a replay ends
   * in the menu without any consent detour, unlike the intro on first load.
   */
  introReplay: boolean;
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
  /** Debug mód bekapcsolva (runtime toggle, csak VITE_DEBUG_MODE=true esetén jelenik meg) */
  debugMode: boolean;

  setCameraError: (updater: StateUpdater<string | null>) => void;
  setCameraConsent: (status: CameraConsent) => void;
  setCameraConsentOrigin: (origin: CameraConsentOrigin) => void;
  setIntroReplay: (replay: boolean) => void;
  /** Set camera consent locally AND persist to Firebase RTDB. */
  persistCameraConsent: (status: CameraConsent) => Promise<void>;
  setShowExitConfirm: (updater: StateUpdater<boolean>) => void;
  setIsMusicMuted: (updater: StateUpdater<boolean>) => void;
  setMusicVolume: (updater: StateUpdater<number>) => void;
  setDifficulty: (updater: StateUpdater<Difficulty>) => void;
  setActiveMusicId: (id: string | null) => void;
  setActiveShipId: (id: string | null) => void;
  setDebugMode: (mode: boolean) => void;
}

const useUIStore = create<UIState>()((set) => ({
  cameraError: null,
  cameraConsent: "undecided" as CameraConsent,
  // "boot" is the safe default: after an F5 on the consent screen the origin
  // is gone, and the game must not start on its own.
  cameraConsentOrigin: "boot" as CameraConsentOrigin,
  introReplay: false,
  showExitConfirm: false,
  isMusicMuted: false,
  musicVolume: MUSIC_ACTIVE_VOLUME,
  difficulty: "medium",
  activeMusicId: null,
  activeShipId: null,
  debugMode: import.meta.env.VITE_DEBUG_MODE === "true",

  setActiveMusicId: (id) => set({ activeMusicId: id }),
  setActiveShipId: (id) => set({ activeShipId: id }),
  setDebugMode: (mode) => set({ debugMode: mode }),

  setCameraError: (updater) =>
    set((state) => ({
      cameraError: resolveState(updater, state.cameraError),
    })),
  setCameraConsent: (status) => set({ cameraConsent: status }),
  setCameraConsentOrigin: (origin) => set({ cameraConsentOrigin: origin }),
  setIntroReplay: (replay) => set({ introReplay: replay }),
  persistCameraConsent: async (status) => {
    // 1. Update local state immediately
    set({ cameraConsent: status });
    // 2. Persist to Firebase RTDB
    const rtdbKey = getRtdbKey();
    if (rtdbKey) {
      try {
        await updateUserSettings(rtdbKey, { cameraConsent: status });
      } catch (err) {
        console.error("Failed to persist cameraConsent:", err);
      }
    }
  },
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
