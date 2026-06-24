import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Destination, GamePhase } from "../types";

export type CrewLostReason = "attention" | "buttons" | null;

type StateUpdater<T> = T | ((prev: T) => T);

const resolveState = <T>(updater: StateUpdater<T>, current: T): T => {
  return typeof updater === "function"
    ? (updater as (prev: T) => T)(current)
    : updater;
};

interface GameState {
  /** Primary state machine phase */
  gamePhase: GamePhase;

  // --- legacy boolean flags (kept for backward compat, derived from gamePhase) ---
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
  serviceSeconds: number;
  bestServiceSeconds: number;
  isMusicMuted: boolean;
  isInitializing: boolean;
  debugIgnoreAttention: boolean;

  // --- setters (kept for backward compat) ---
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
  setServiceSeconds: (updater: StateUpdater<number>) => void;
  setBestServiceSeconds: (updater: StateUpdater<number>) => void;
  setIsMusicMuted: (updater: StateUpdater<boolean>) => void;
  setIsInitializing: (updater: StateUpdater<boolean>) => void;
  setDebugIgnoreAttention: (updater: StateUpdater<boolean>) => void;

  // --- phase-based transitions (NEW) ---
  transitionTo: (phase: GamePhase) => void;

  // --- existing composite actions ---
  startMission: (destination: Destination) => void;
  resetToMenu: () => void;
}

/**
 * Maps a GamePhase to the corresponding boolean flags.
 * Unaffected overlay flags (cameraError, showExitConfirm) are NOT touched here.
 */
const phaseToFlags = (phase: GamePhase) => {
  switch (phase) {
    case "intro":
      return {
        showIntro: true,
        isPaused: true,
        isAttentionLost: false,
        crewLost: false,
        crewLostReason: null as CrewLostReason,
        missionComplete: false,
        isInitializing: false,
      };
    case "menu":
      return {
        showIntro: false,
        isPaused: true,
        isAttentionLost: false,
        crewLost: false,
        crewLostReason: null as CrewLostReason,
        missionComplete: false,
        isInitializing: false,
      };
    case "loading":
      return {
        showIntro: false,
        isPaused: true,
        isAttentionLost: false,
        crewLost: false,
        crewLostReason: null as CrewLostReason,
        missionComplete: false,
        isInitializing: true,
      };
    case "playing":
      return {
        showIntro: false,
        isPaused: false,
        isAttentionLost: false,
        crewLost: false,
        crewLostReason: null as CrewLostReason,
        missionComplete: false,
        isInitializing: false,
      };
    case "paused":
      return {
        showIntro: false,
        isPaused: true,
        isAttentionLost: false,
        crewLost: false,
        crewLostReason: null as CrewLostReason,
        missionComplete: false,
        isInitializing: false,
      };
    case "countdown":
      return {
        showIntro: false,
        isPaused: true,
        isAttentionLost: true,
        crewLost: false,
        crewLostReason: null as CrewLostReason,
        missionComplete: false,
        isInitializing: false,
      };
    case "crewLost":
      return {
        showIntro: false,
        isPaused: true,
        isAttentionLost: false,
        crewLost: true,
        crewLostReason: null as CrewLostReason,
        missionComplete: false,
        isInitializing: false,
      };
    case "missionComplete":
      return {
        showIntro: false,
        isPaused: true,
        isAttentionLost: false,
        crewLost: false,
        crewLostReason: null as CrewLostReason,
        missionComplete: true,
        isInitializing: false,
      };
  }
};

// Derive initial gamePhase from init flags
const initialPhase: GamePhase = "intro";

const useGameStore = create<GameState>()(
  persist(
    (set) => ({
      // Phase
      gamePhase: initialPhase,

      // Initial values
      destination: null,
      remainingYears: 0,
      cameraError: null,
      showExitConfirm: false,
      inactivitySeconds: 0,
      serviceSeconds: 0,
      bestServiceSeconds: 0,
      isMusicMuted: false,
      debugIgnoreAttention: false,

      // Derived from gamePhase
      ...phaseToFlags(initialPhase),

      // --- legacy setters (kept for backward compat) ---
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
      setDebugIgnoreAttention: (updater) =>
        set((state) => ({
          debugIgnoreAttention: resolveState(updater, state.debugIgnoreAttention),
        })),

      // --- phase-based transition ---
      transitionTo: (phase) =>
        set((state) => ({
          gamePhase: phase,
          ...phaseToFlags(phase),
          // isAttentionLost can be set by the phase, but crewLostReason needs special handling
          crewLostReason:
            phase === "crewLost" ? state.crewLostReason : null,
        })),

      // --- composite actions ---
      startMission: (destination) =>
        set(() => ({
          destination,
          remainingYears: destination.travelYears,
          gamePhase: "loading",
          showExitConfirm: false,
          cameraError: null,
          inactivitySeconds: 0,
          serviceSeconds: 0,
          ...phaseToFlags("loading"),
        })),
      resetToMenu: () =>
        set((state) => ({
          destination: null,
          remainingYears: 0,
          cameraError: null,
          showExitConfirm: false,
          inactivitySeconds: 0,
          serviceSeconds: 0,
          gamePhase: "menu",
          ...phaseToFlags("menu"),
          bestServiceSeconds: state.bestServiceSeconds,
          isMusicMuted: state.isMusicMuted,
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
