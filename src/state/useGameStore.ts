import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { Destination, GamePhase, CrewLostReason, EventType, EventInstance } from "../types";
import type { StateUpdater } from "./utils";
import { resolveState } from "./utils";
import { SHIP_SPEED_KM_PER_SECOND } from "../constants/constants";
import { SHOP_SHIPS } from "../constants/shopCatalog";
import type { ShipProduct } from "../types";
import useUIStore from "./useUIStore";

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

  // --- event system ---
  /** Currently active event (null = no event) */
  activeEvent: EventInstance | null;
  /** Accumulated penalty years from failed events */
  eventPenaltyYears: number;
  /** Cockpit variant for rescue transfer — changes the dashboard ship image */
  cockpitVariant: "default" | "rescue";
  /** Asteroid warning flag — shows a warning bar on dashboard */
  asteroidWarning: boolean;
  /** Next scheduled event info for debug display (type + target timestamp) */
  nextScheduledEvent: { eventType: EventType; triggerAt: number } | null;
  /** Timestamp (Date.now()) when the ship will be destroyed after ignoring rescue transfer, or null */
  pendingDestructionAt: number | null;

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

  // --- event actions ---
  /** Trigger an event immediately by its type */
  triggerEvent: (event: EventInstance) => void;
  /** Resolve the current event (success or failure).
   * @param success - true if the player succeeded, false if failed
   * @param isAutoFail - true when the timer expired (player didn't respond).
   *   When set, time-penalty events get a random severe consequence instead.
   * @param dodgePenalty - optional years to add when asteroid was successfully avoided.
   *   If omitted for asteroid success, a random 5-10 will be generated. */
  resolveEvent: (success: boolean, isAutoFail?: boolean, dodgePenalty?: number) => void;
  /** Dismiss the current event without penalty */
  dismissEvent: () => void;
  /** Schedule ship destruction after a delay (ms). Used when ignoring rescue-transfer. */
  scheduleDestruction: (delayMs: number) => void;
  /** Cancel any pending destruction. */
  cancelDestruction: () => void;
  /** Set the next scheduled event preview (for debug bar) */
  setNextScheduledEvent: (info: { eventType: EventType; triggerAt: number } | null) => void;

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

/**
 * Pick a random shop ship weighted by price (cheaper = much higher chance).
 * Used by the rescue-transfer event — on success the player gets a random
 * replacement ship instead of the generic rescue vessel.
 */
function pickRandomRescueShip(): ShipProduct {
  const ships = SHOP_SHIPS;
  const minPrice = Math.min(...ships.map((s) => s.priceCredits));
  const maxPrice = Math.max(...ships.map((s) => s.priceCredits));
  const range = maxPrice - minPrice;
  // Weight = inverted position in the price range: cheapest ships get the
  // highest weight. +1 ensures every ship has at least some chance.
  const weights = ships.map((s) => range - (s.priceCredits - minPrice) + 1);
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  let random = Math.random() * totalWeight;
  for (let i = 0; i < ships.length; i++) {
    random -= weights[i];
    if (random <= 0) return ships[i];
  }
  // Fallback: cheapest ship
  return ships.reduce((a, b) => (a.priceCredits < b.priceCredits ? a : b));
}

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
      activeEvent: null,
      eventPenaltyYears: 0,
      cockpitVariant: "default",
      asteroidWarning: false,
      nextScheduledEvent: null,
      pendingDestructionAt: null,

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

      // --- event actions ---
      triggerEvent: (event) =>
        set(() => {
          // Set asteroid warning when asteroid event triggers
          const updates: Partial<GameState> = {
            activeEvent: event,
          };
          if (event.id === "asteroid") {
            updates.asteroidWarning = true;
          }
          return updates as any;
        }),
      resolveEvent: (success, isAutoFail, dodgePenalty) =>
        set((state) => {
          if (!state.activeEvent) return {};
          const def = state.activeEvent.definition;
          const isRescueTransfer = state.activeEvent.id === "rescue-transfer";
          const isAsteroid = state.activeEvent.id === "asteroid";

          if (success) {
            const updates: Record<string, unknown> = {
              activeEvent: null,
            };
            // Rescue transfer success → pick a random cheap ship
            if (isRescueTransfer) {
              const rescueShip = pickRandomRescueShip();
              updates.shipSpeedKmPerSecond = rescueShip.speedKmPerSecond;
              updates.cockpitVariant = "default";
              // Update UI store so the starfield shows the new ship's image
              useUIStore.getState().setActiveShipId(rescueShip.id);
            }
            // Asteroid avoided → clear warning + add random 5-10 year detour penalty
            if (isAsteroid) {
              updates.asteroidWarning = false;
              const detourYears = dodgePenalty ?? (Math.floor(Math.random() * 6) + 5);
              updates.remainingYears = state.remainingYears + detourYears;
              updates.eventPenaltyYears = state.eventPenaltyYears + detourYears;
            }
            return updates;
          }
          // Auto-fail (timer expired): random severe consequence
          if (isAutoFail && def.penaltyType === "time") {
            const isCrewLost = Math.random() < 0.5;
            if (isCrewLost) {
              return {
                activeEvent: null,
                asteroidWarning: false,
                gamePhase: "crewLost" as GamePhase,
                ...phaseToFlags("crewLost"),
                crewLostReason: "event",
              };
            }
            // Massive time penalty (5× the normal amount)
            const massivePenalty = def.penaltyAmount * 5;
            return {
              activeEvent: null,
              asteroidWarning: false,
              eventPenaltyYears: state.eventPenaltyYears + massivePenalty,
              remainingYears: state.remainingYears + massivePenalty,
            };
          }
          // Failure: apply penalty
          if (isAsteroid) {
            return {
              activeEvent: null,
              asteroidWarning: false,
              eventPenaltyYears: state.eventPenaltyYears + def.penaltyAmount,
              remainingYears: state.remainingYears + def.penaltyAmount,
            };
          }
          if (def.penaltyType === "time") {
            return {
              activeEvent: null,
              eventPenaltyYears: state.eventPenaltyYears + def.penaltyAmount,
              remainingYears: state.remainingYears + def.penaltyAmount,
            };
          }
          // crewLost penalty — use phaseToFlags then override reason
          return {
            activeEvent: null,
            gamePhase: "crewLost" as GamePhase,
            ...phaseToFlags("crewLost"),
            crewLostReason: "event",
          };
        }),
      dismissEvent: () =>
        set(() => ({
          activeEvent: null,
          asteroidWarning: false,
        })),
      scheduleDestruction: (delayMs) =>
        set({ pendingDestructionAt: Date.now() + delayMs }),
      cancelDestruction: () => set({ pendingDestructionAt: null }),
      setNextScheduledEvent: (info) => set({ nextScheduledEvent: info }),

      // --- reset cockpit variant when starting a mission ---
      startMission: (destination, shipSpeedKmPerSecond) =>
        set(() => ({
          destination,
          pendingDestination: null,
          remainingYears: destination.travelYears,
          shipSpeedKmPerSecond: shipSpeedKmPerSecond ?? SHIP_SPEED_KM_PER_SECOND,
          gamePhase: "loading",
          inactivitySeconds: 0,
          serviceSeconds: 0,
          cockpitVariant: "default",
          ...phaseToFlags("loading"),
        })),

      // --- ship select ---
      selectDestinationForShip: (destination) =>
        set(() => ({
          pendingDestination: destination,
          gamePhase: "shipSelect",
          ...phaseToFlags("shipSelect"),
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
          cockpitVariant: "default",
          asteroidWarning: false,
          activeEvent: null,
          eventPenaltyYears: 0,
          pendingDestructionAt: null,
        })),
    }),
    {
      name: "space-travel-game",
      storage: createJSONStorage(() => localStorage),
      // Only persist the fields that should survive a page refresh.
      // Derived flags (crewLost, missionComplete, isPaused, etc.) are
      // regenerated by phaseToFlags() from the persisted gamePhase.
      partialize: (state) => ({
        gamePhase: state.gamePhase,
        destination: state.destination,
        pendingDestination: state.pendingDestination,
        remainingYears: state.remainingYears,
        shipSpeedKmPerSecond: state.shipSpeedKmPerSecond,
        serviceSeconds: state.serviceSeconds,
        bestServiceSeconds: state.bestServiceSeconds,
        // inactivitySeconds is stored but recalculated on page leave return
      }),
    },
  ),
);

export default useGameStore;
