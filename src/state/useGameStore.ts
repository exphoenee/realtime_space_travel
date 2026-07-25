import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Destination, GamePhase, CrewLostReason } from "../types";
import type { StateUpdater } from "./utils";
import { resolveState } from "./utils";
import { SHIP_SPEED_KM_PER_SECOND } from "../constants/constants";

interface GameState {
  /** Primary state machine phase */
  gamePhase: GamePhase;

  // --- legacy boolean flags (kept for backward compat, derived from gamePhase) ---
  destination: Destination | null;
  /** Pending destination before ship is selected (shipSelect phase) */
  pendingDestination: Destination | null;
  remainingYears: number;
  /** The selected ship's speed in km/s — used by Dashboard for display */
  shipSpeedKmPerSecond: number;
  isPaused: boolean;
  showIntro: boolean;
  isAttentionLost: boolean;
  inactivitySeconds: number;
  crewLost: boolean;
  crewLostReason: CrewLostReason;
  missionComplete: boolean;
  serviceSeconds: number;
  bestServiceSeconds: number;
  isInitializing: boolean;
  debugIgnoreAttention: boolean;

  // --- setters (kept for backward compat) ---
  setDestination: (updater: StateUpdater<Destination | null>) => void;
  setRemainingYears: (updater: StateUpdater<number>) => void;
  setIsPaused: (updater: StateUpdater<boolean>) => void;
  setShowIntro: (updater: StateUpdater<boolean>) => void;
  setIsAttentionLost: (updater: StateUpdater<boolean>) => void;
  setInactivitySeconds: (updater: StateUpdater<number>) => void;
  setCrewLost: (updater: StateUpdater<boolean>) => void;
  setCrewLostReason: (updater: StateUpdater<CrewLostReason>) => void;
  setMissionComplete: (updater: StateUpdater<boolean>) => void;
  setServiceSeconds: (updater: StateUpdater<number>) => void;
  setBestServiceSeconds: (updater: StateUpdater<number>) => void;
  setIsInitializing: (updater: StateUpdater<boolean>) => void;
  setDebugIgnoreAttention: (updater: StateUpdater<boolean>) => void;

  // --- phase-based transitions ---
  transitionTo: (phase: GamePhase) => void;

  /** Set pending destination and transition to shipSelect */
  selectDestinationForShip: (destination: Destination) => void;

  // --- composite actions ---
  startMission: (destination: Destination, shipSpeedKmPerSecond?: number) => void;
  resetToMenu: () => void;
}

/**
 * Maps a GamePhase to the corresponding boolean flags.
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
    case "mainMenu":
    case "missionSelect":
    case "shipSelect":
    case "settings":
    case "shop":
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
        isAttentionLost: true,
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

const initialPhase: GamePhase = "intro";

const useGameStore = create<GameState>()(
  persist(
    (set) => ({
      // Phase
      gamePhase: initialPhase,

      // Initial values
      destination: null,
      pendingDestination: null,
      remainingYears: 0,
      shipSpeedKmPerSecond: SHIP_SPEED_KM_PER_SECOND,
      inactivitySeconds: 0,
      serviceSeconds: 0,
      bestServiceSeconds: 0,
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
          crewLostReason:
            phase === "crewLost" ? state.crewLostReason : null,
        })),

      // --- ship select ---
      selectDestinationForShip: (destination) =>
        set(() => ({
          pendingDestination: destination,
          gamePhase: "shipSelect",
          ...phaseToFlags("shipSelect"),
        })),

      // --- composite actions ---
      startMission: (destination, shipSpeedKmPerSecond) =>
        set(() => ({
          destination,
          pendingDestination: null,
          remainingYears: destination.travelYears,
          shipSpeedKmPerSecond: shipSpeedKmPerSecond ?? SHIP_SPEED_KM_PER_SECOND,
          gamePhase: "loading",
          inactivitySeconds: 0,
          serviceSeconds: 0,
          ...phaseToFlags("loading"),
        })),
      resetToMenu: () =>
        set((state) => ({
          destination: null,
          pendingDestination: null,
          remainingYears: 0,
          shipSpeedKmPerSecond: SHIP_SPEED_KM_PER_SECOND,
          inactivitySeconds: 0,
          serviceSeconds: 0,
          gamePhase: "mainMenu",
          ...phaseToFlags("mainMenu"),
          bestServiceSeconds: state.bestServiceSeconds,
        })),
    }),
    {
      name: "space-travel-game",
      partialize: (state) => ({
        bestServiceSeconds: state.bestServiceSeconds,
      }),
    },
  ),
);

export default useGameStore;
