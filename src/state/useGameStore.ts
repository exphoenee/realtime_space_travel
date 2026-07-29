import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { Destination, GamePhase, CrewLostReason, EventType, EventInstance, FailureRecord, SuccessRecord, EventLogEntry, MultiplayerSession } from "../types";
import type { StateUpdater } from "./utils";
import { resolveState } from "./utils";
import { SHIP_SPEED_KM_PER_SECOND } from "../constants/constants";
import { SHOP_SHIPS, DEFAULT_SHIP } from "../constants/shopCatalog";
import { getDestinationWage } from "../constants/universeData";
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

  // --- Social / Multiplayer ---
  /** Current multiplayer session, or null if not in one */
  multiplayerSession: MultiplayerSession | null;
  /** Set the full multiplayer session object */
  setMultiplayerSession: (session: MultiplayerSession | null) => void;
  /** UID of the friend whose wall is being viewed */
  friendWallTargetUid: string | null;
  /** Display name of the friend whose wall is being viewed */
  friendWallTargetName: string | null;
  /** UID of the friend the `chat` screen is talking to */
  chatTargetUid: string | null;
  /** Display name of the friend the `chat` screen is talking to */
  chatTargetName: string | null;

  // --- Wall of Shame / failure tracking ---
  /** All recorded failure events (persisted to localStorage + RTDB) */
  failureRecords: FailureRecord[];
  /** All recorded successful missions (persisted to localStorage) */
  successRecords: SuccessRecord[];
  /** Events encountered during the current mission (cleared on new mission) */
  missionEventLog: EventLogEntry[];
  /** Timestamp when the current mission was launched */
  launchTimestamp: number;
  /** Name of the ship used for the current mission */
  selectedShipName: string;
  /** ID of the ship used for the current mission */
  selectedShipId: string | null;

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
  /** Record the current mission as a failure in the Wall of Shame */
  recordFailure: () => void;
  /** Record an exit as a failure (player abandoned ship) and reset to menu */
  exitMission: () => void;
  /** Record the current mission as a successful arrival */
  recordMissionComplete: () => void;
  /** Debug: inject a dummy success record */
  addDummySuccessRecord: () => void;
  /** Debug: inject a dummy failure record */
  addDummyFailureRecord: () => void;
  resetToMenu: () => void;
  /**
   * Wipe everything that belongs to a single account: mission history, best
   * time and social targets. Called when the signed-in identity changes
   * (sign-out or account switch) so nothing leaks to the next user of this
   * browser. Does NOT touch device-level preferences (volume, language).
   */
  clearUserScopedData: () => void;
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
    case "cameraConsent":
      return {
        showIntro: false,
        isPaused: true,
        isAttentionLost: false,
        crewLost: false,
        crewLostReason: null as CrewLostReason,
        missionComplete: false,
        isInitializing: false,
      };
    case "wallOfShame":
    case "friends":
    case "friendWall":
    case "chat":
      return {
        showIntro: false,
        isPaused: true,
        isAttentionLost: false,
        crewLost: false,
        crewLostReason: null as CrewLostReason,
        missionComplete: false,
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

      // --- Social / Multiplayer ---
      multiplayerSession: null,
      friendWallTargetUid: null,
      friendWallTargetName: null,
      chatTargetUid: null,
      chatTargetName: null,

      // --- multiplayer session action ---
      setMultiplayerSession: (session) => set({ multiplayerSession: session }),

      // --- Wall of Shame ---
      failureRecords: [],
      successRecords: [],
      missionEventLog: [],
      launchTimestamp: 0,
      selectedShipName: "",
      selectedShipId: null,

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

          // Create event log entry for this resolution
          const logEntry: EventLogEntry = {
            type: state.activeEvent.id,
            result: success ? "success" : "fail",
            timestamp: Date.now(),
          };
          const updatedLog = [...state.missionEventLog, logEntry];

          if (success) {
            const updates: Record<string, unknown> = {
              activeEvent: null,
              missionEventLog: updatedLog,
            };
            // Rescue transfer success → pick a random cheap ship
            if (isRescueTransfer) {
              const rescueShip = pickRandomRescueShip();
              updates.shipSpeedKmPerSecond = rescueShip.speedKmPerSecond;
              updates.cockpitVariant = "rescue";
              // Update UI store so the starfield shows the new ship's image
              useUIStore.getState().setActiveShipId(rescueShip.id);
              // Also update failure-tracking ship name so the Wall of Shame
              // reflects the vessel actually in use at the time of failure
              updates.selectedShipName = rescueShip.name;
              updates.selectedShipId = rescueShip.id;
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
            // Asteroid auto-fail always causes crew death (collision)
            if (isAsteroid) {
              return {
                activeEvent: null,
                asteroidWarning: false,
                missionEventLog: updatedLog,
                gamePhase: "crewLost" as GamePhase,
                ...phaseToFlags("crewLost"),
                crewLostReason: "event",
              };
            }
            // Other events: 50% crew death, 50% massive time penalty
            const isCrewLost = Math.random() < 0.5;
            if (isCrewLost) {
              return {
                activeEvent: null,
                asteroidWarning: false,
                missionEventLog: updatedLog,
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
              missionEventLog: updatedLog,
              eventPenaltyYears: state.eventPenaltyYears + massivePenalty,
              remainingYears: state.remainingYears + massivePenalty,
            };
          }
          // Failure: apply penalty
          if (isAsteroid) {
            return {
              activeEvent: null,
              asteroidWarning: false,
              missionEventLog: updatedLog,
              eventPenaltyYears: state.eventPenaltyYears + def.penaltyAmount,
              remainingYears: state.remainingYears + def.penaltyAmount,
            };
          }
          if (def.penaltyType === "time") {
            return {
              activeEvent: null,
              missionEventLog: updatedLog,
              eventPenaltyYears: state.eventPenaltyYears + def.penaltyAmount,
              remainingYears: state.remainingYears + def.penaltyAmount,
            };
          }
          // crewLost penalty — use phaseToFlags then override reason
          return {
            activeEvent: null,
            missionEventLog: updatedLog,
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
        set((state) => {
          const pendingAt = Date.now() + delayMs;
          return {
            pendingDestructionAt: pendingAt,
            nextScheduledEvent: {
              eventType: "doom" as EventType,
              triggerAt: pendingAt,
            },
          };
        }),
      cancelDestruction: () =>
        set({ pendingDestructionAt: null, nextScheduledEvent: null }),
      setNextScheduledEvent: (info) => set({ nextScheduledEvent: info }),

      // --- reset cockpit variant when starting a mission ---
      startMission: (destination, shipSpeedKmPerSecond) =>
        set(() => {
          // Read the active ship from UI store for Wall of Shame tracking
          const activeShipId = useUIStore.getState().activeShipId;
          let selectedShipName = DEFAULT_SHIP.name;
          if (activeShipId) {
            const shopShip = SHOP_SHIPS.find((s) => s.id === activeShipId);
            if (shopShip) selectedShipName = shopShip.name;
          }
          return {
            destination,
            pendingDestination: null,
            remainingYears: destination.travelYears,
            shipSpeedKmPerSecond: shipSpeedKmPerSecond ?? SHIP_SPEED_KM_PER_SECOND,
            gamePhase: "loading",
            inactivitySeconds: 0,
            serviceSeconds: 0,
            cockpitVariant: "default",
            // Reset mission tracking for Wall of Shame
            missionEventLog: [],
            launchTimestamp: Date.now(),
            selectedShipName,
            selectedShipId: activeShipId,
            ...phaseToFlags("loading"),
          };
        }),

      // --- record mission success for Wall of Shame ---
      recordMissionComplete: () =>
        set((state) => {
          // Only record if we have destination info (valid mission)
          if (!state.destination) return {};

          const rewardCredits = getDestinationWage(
            state.destination.name,
            state.destination.travelYears,
          );

          const record: SuccessRecord = {
            id: `success-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            shipName: state.selectedShipName || DEFAULT_SHIP.name,
            shipId: state.selectedShipId,
            destinationName: state.destination.name,
            launchedAt: state.launchTimestamp || Date.now(),
            completedAt: Date.now(),
            serviceSeconds: state.serviceSeconds,
            travelYears: state.destination.travelYears,
            events: [...state.missionEventLog],
            rewardCredits,
          };

          return {
            successRecords: [...state.successRecords, record],
          };
        }),

      // --- debug: inject a dummy success record ---
      addDummySuccessRecord: () =>
        set((state) => {
          const dummyDestinations = ["Proxima b", "TRAPPIST-1e", "Kepler-442b", "TOI-700 d", "GJ 1061 c", "Barnard's Star b"];
          const dest = dummyDestinations[Math.floor(Math.random() * dummyDestinations.length)];
          const randomSeconds = Math.floor(Math.random() * 600) + 60; // 1-10 min
          const launchedAt = Date.now() - randomSeconds * 1000;

          // Generate 5–8 random events
          const allTypes: EventType[] = ["horn", "asteroid", "rescue-transfer", "solar-flare", "rover", "fake-instruction"];
          const eventCount = Math.floor(Math.random() * 4) + 5; // 5–8
          const events: EventLogEntry[] = [];
          for (let i = 0; i < eventCount; i++) {
            const type = allTypes[Math.floor(Math.random() * allTypes.length)];
            // Roughly 70% success / 30% fail — realistic distribution
            const result: "success" | "fail" = Math.random() < 0.7 ? "success" : "fail";
            // Spread timestamps evenly across the mission duration
            const offset = (randomSeconds * 1000) * ((i + 1) / (eventCount + 1));
            events.push({ type, result, timestamp: launchedAt + offset });
          }          const travelYears = Math.floor(Math.random() * 74001) + 6000; // 6,000 - 80,000
          const rewardCredits = getDestinationWage(dest, travelYears);

          const record: SuccessRecord = {
            id: `success-debug-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            shipName: state.selectedShipName || DEFAULT_SHIP.name,
            shipId: state.selectedShipId,
            destinationName: dest,
            launchedAt,
            completedAt: Date.now(),
            serviceSeconds: randomSeconds,
            travelYears,
            events,
            rewardCredits,
          };

          return {
            successRecords: [...state.successRecords, record],
          };
        }),

      // --- debug: inject a dummy failure record ---
      addDummyFailureRecord: () =>
        set((state) => {
          const dummyDestinations = ["Proxima b", "TRAPPIST-1e", "Kepler-442b", "TOI-700 d", "GJ 1061 c", "Barnard's Star b"];
          const dummyShips = ["Odyssey", "Starhopper", "Voyager", "Pioneer", "Enterprise", "Mercury"];
          const dest = dummyDestinations[Math.floor(Math.random() * dummyDestinations.length)];
          const ship = dummyShips[Math.floor(Math.random() * dummyShips.length)];
          const randomSeconds = Math.floor(Math.random() * 600) + 60; // 1-10 min
          const launchedAt = Date.now() - randomSeconds * 1000;

          // Random death reason
          const reasons: CrewLostReason[] = ["attention", "buttons", "event", "exit"];
          const reason = reasons[Math.floor(Math.random() * reasons.length)];

          // Generate 5-8 random events
          const allTypes: EventType[] = ["horn", "asteroid", "rescue-transfer", "solar-flare", "rover", "fake-instruction"];
          const eventCount = Math.floor(Math.random() * 4) + 5;
          const events: EventLogEntry[] = [];
          for (let i = 0; i < eventCount; i++) {
            const type = allTypes[Math.floor(Math.random() * allTypes.length)];
            const result: "success" | "fail" = Math.random() < 0.7 ? "success" : "fail";
            const offset = (randomSeconds * 1000) * ((i + 1) / (eventCount + 1));
            events.push({ type, result, timestamp: launchedAt + offset });
          }

          const travelYears = Math.floor(Math.random() * 74001) + 6000; // 6,000 - 80,000

          const record: FailureRecord = {
            id: `fail-debug-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            shipName: ship,
            shipId: null,
            destinationName: dest,
            launchedAt,
            failedAt: Date.now(),
            serviceSeconds: randomSeconds,
            travelYears,
            crewLostReason: reason,
            events,
          };

          return {
            failureRecords: [...state.failureRecords, record],
          };
        }),

      // --- record failure for Wall of Shame ---
      recordFailure: () =>
        set((state) => {
          // Avoid duplicate recording if already recorded for this failure
          if (state.gamePhase !== "crewLost") return {};

          // Only record if we have destination info (valid mission)
          if (!state.destination) return {};

          const record: FailureRecord = {
            id: `fail-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            shipName: state.selectedShipName || DEFAULT_SHIP.name,
            shipId: state.selectedShipId,
            destinationName: state.destination.name,
            launchedAt: state.launchTimestamp || Date.now(),
            failedAt: Date.now(),
            serviceSeconds: state.serviceSeconds,
            travelYears: state.destination.travelYears,
            crewLostReason: state.crewLostReason || "attention",
            events: [...state.missionEventLog],
          };

          return {
            failureRecords: [...state.failureRecords, record],
            // Keep missionEventLog so the just-recorded record is complete
          };
        }),

      // --- exit mission (player abandoned ship) ---
      exitMission: () =>
        set((state) => {
          // Only record if we have destination info (valid mission)
          if (!state.destination) return {};

          const record: FailureRecord = {
            id: `fail-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            shipName: state.selectedShipName || DEFAULT_SHIP.name,
            shipId: state.selectedShipId,
            destinationName: state.destination.name,
            launchedAt: state.launchTimestamp || Date.now(),
            failedAt: Date.now(),
            serviceSeconds: state.serviceSeconds,
            travelYears: state.destination.travelYears,
            crewLostReason: "exit" as CrewLostReason,
            events: [...state.missionEventLog],
          };

          return {
            failureRecords: [...state.failureRecords, record],
            destination: null,
            pendingDestination: null,
            remainingYears: 0,
            shipSpeedKmPerSecond: SHIP_SPEED_KM_PER_SECOND,
            inactivitySeconds: 0,
            serviceSeconds: 0,
            gamePhase: "mainMenu" as GamePhase,
            ...phaseToFlags("mainMenu"),
            bestServiceSeconds: state.bestServiceSeconds,
            cockpitVariant: "default",
            asteroidWarning: false,
            activeEvent: null,
            eventPenaltyYears: 0,
            pendingDestructionAt: null,
            missionEventLog: [],
            launchTimestamp: 0,
            selectedShipName: "",
            selectedShipId: null,
          };
        }),

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
          // Clear mission-specific tracking
          missionEventLog: [],
          launchTimestamp: 0,
          selectedShipName: "",
          selectedShipId: null,
        })),

      clearUserScopedData: () =>
        set(() => ({
          // Mission history belongs to ONE account. It is persisted to
          // localStorage and only ever merged into (never replaced), so
          // without this the next person on this browser would see — and be
          // counted with — the previous account's missions.
          failureRecords: [],
          successRecords: [],
          bestServiceSeconds: 0,
          missionEventLog: [],
          // Social targets point at the previous account's friend graph.
          friendWallTargetUid: null,
          friendWallTargetName: null,
          chatTargetUid: null,
          chatTargetName: null,
        })),
    }),
    {
      name: "space-travel-game",
      storage: createJSONStorage(() => localStorage),
      // Only persist the fields that should survive a page refresh.
      // Derived flags (crewLost, missionComplete, isPaused, etc.) are
      // regenerated by phaseToFlags() from the persisted gamePhase.
      //
      // ACCOUNT-SCOPED DATA IS DELIBERATELY NOT PERSISTED:
      // `failureRecords`, `successRecords` and `bestServiceSeconds` live in
      // RTDB (`walls/{rtdbKey}` and `users/{rtdbKey}/stats`) and are loaded
      // from there. Caching them in localStorage — which is shared by every
      // account using this browser — is what let one player's mission history
      // show up for the next one. RTDB is the single source of truth.
      partialize: (state) => ({
        gamePhase: state.gamePhase,
        destination: state.destination,
        pendingDestination: state.pendingDestination,
        remainingYears: state.remainingYears,
        shipSpeedKmPerSecond: state.shipSpeedKmPerSecond,
        serviceSeconds: state.serviceSeconds,
        friendWallTargetUid: state.friendWallTargetUid,
        friendWallTargetName: state.friendWallTargetName,
        // Keep the chat target across a page refresh — the persisted
        // gamePhase restores the `chat` screen and needs to know who with.
        chatTargetUid: state.chatTargetUid,
        chatTargetName: state.chatTargetName,
        // inactivitySeconds is stored but recalculated on page leave return
      }),
    },
  ),
);

export default useGameStore;
