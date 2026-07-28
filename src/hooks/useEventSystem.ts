import { useCallback, useEffect, useRef } from "react";
import useGameStore from "../state/useGameStore";
import useUIStore from "../state/useUIStore";
import type {
  EventDefinition,
  EventInstance,
  EventType,
  Difficulty,
} from "../types";

/** Debug mode multiplier — events fire 3× faster */
const DEBUG_SPEED_MULTIPLIER = 3;

/** Minimum gap between any two events (ms) */
const MIN_EVENT_GAP_MS = 3 * 60 * 1000; // 3 minutes

/** jitter range for normal events (ms) — 3 to 5 minutes */
const NORMAL_EVENT_INTERVAL: [number, number] = [3 * 60 * 1000, 5 * 60 * 1000];

/** jitter range for fake instructions in hard mode (ms) — 5 to 10 minutes */
const FAKE_INSTRUCTION_INTERVAL: [number, number] = [5 * 60 * 1000, 10 * 60 * 1000];

/** jitter range for rare events (ms) — 10 to 20 minutes */
const RARE_EVENT_INTERVAL: [number, number] = [10 * 60 * 1000, 20 * 60 * 1000];

const DEBUG_MODE = import.meta.env.VITE_DEBUG_MODE === "true";

// ---------------------------------------------------------------------------
// Event definitions
// ---------------------------------------------------------------------------

const EVENT_DEFINITIONS: EventDefinition[] = [
  {
    id: "horn",
    minDifficulty: "medium",
    minIntervalMs: MIN_EVENT_GAP_MS,
    baseIntervalMs: NORMAL_EVENT_INTERVAL,
    durationMs: 15_000, // 15 seconds to respond
    penaltyType: "time",
    penaltyAmount: 5, // +5 years on failure
    i18nKey: "event.horn",
    isRare: false,
  },
  {
    id: "asteroid",
    minDifficulty: "medium",
    minIntervalMs: MIN_EVENT_GAP_MS,
    baseIntervalMs: NORMAL_EVENT_INTERVAL,
    durationMs: 15_000,
    penaltyType: "time",
    penaltyAmount: 10, // +10 years on failure
    i18nKey: "event.asteroid",
    isRare: false,
  },
  {
    id: "rescue-transfer",
    minDifficulty: "medium",
    minIntervalMs: MIN_EVENT_GAP_MS,
    baseIntervalMs: RARE_EVENT_INTERVAL,
    durationMs: 20_000,
    penaltyType: "time",
    penaltyAmount: 8, // +8 years on failure
    i18nKey: "event.rescueTransfer",
    isRare: true,
  },
  {
    id: "solar-flare",
    minDifficulty: "hard",
    minIntervalMs: MIN_EVENT_GAP_MS,
    baseIntervalMs: RARE_EVENT_INTERVAL,
    durationMs: 10_000,
    penaltyType: "crewLost",
    penaltyAmount: 0,
    i18nKey: "event.solarFlare",
    isRare: true,
  },
  {
    id: "rover",
    minDifficulty: "medium",
    minIntervalMs: MIN_EVENT_GAP_MS,
    baseIntervalMs: RARE_EVENT_INTERVAL,
    durationMs: 10_000,
    penaltyType: "time",
    penaltyAmount: 3,
    i18nKey: "event.rover",
    isRare: true,
  },
  {
    id: "fake-instruction",
    minDifficulty: "hard",
    minIntervalMs: MIN_EVENT_GAP_MS,
    baseIntervalMs: FAKE_INSTRUCTION_INTERVAL,
    durationMs: 10_000,
    penaltyType: "crewLost", // Falling for the fake instruction = instant crew loss
    penaltyAmount: 0,
    i18nKey: "event.fake",
    isRare: false,
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Get a random integer in [min, max] */
const randomBetween = (min: number, max: number): number =>
  Math.floor(Math.random() * (max - min + 1)) + min;

/**
 * Get the event pool for a given difficulty.
 * Medium: horn, asteroid (rare: rescue-transfer, rover)
 * Hard: medium + solar-flare, fake-instruction
 */
const getEventPool = (difficulty: Difficulty): EventDefinition[] => {
  const base = EVENT_DEFINITIONS.filter(
    (def) =>
      def.id === "horn" || def.id === "asteroid" || def.id === "rescue-transfer" || def.id === "rover",
  );
  if (difficulty === "hard") {
    return [
      ...base,
      ...EVENT_DEFINITIONS.filter(
        (def) => def.id === "solar-flare" || def.id === "fake-instruction",
      ),
    ];
  }
  if (difficulty === "medium") {
    return base;
  }
  return [];
};

/** Pick a random event from a pool, avoiding consecutive repeats */
const pickRandomEvent = (
  pool: EventDefinition[],
  lastType: EventType | null,
): EventDefinition => {
  const filtered = lastType ? pool.filter((e) => e.id !== lastType) : pool;
  // If all events are filtered out (only 1 type in pool), just use the pool
  const choices = filtered.length > 0 ? filtered : pool;
  return choices[Math.floor(Math.random() * choices.length)];
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * useEventSystem — schedules random events based on difficulty.
 *
 * - Easy: no events
 * - Medium: events every 3-5 min
 * - Hard: events every 3-5 min + fake instructions every 5-10 min
 * - Minimum 3-5 min gap between any two events
 * - Paused/AttentionLost: timer pauses
 * - Debug mode: 3× faster
 */
export const useEventSystem = () => {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastEventTimeRef = useRef<number>(0);
  const lastEventTypeRef = useRef<EventType | null>(null);

  const scheduleNext = useCallback(() => {
    const state = useGameStore.getState();
    const difficulty = useUIStore.getState().difficulty;

    // Easy mode or not playing — no events
    if (difficulty === "easy" || state.gamePhase !== "playing") {
      timerRef.current = null;
      return;
    }

    // If there's already an active event, don't schedule another
    if (state.activeEvent) {
      timerRef.current = null;
      return;
    }

    // Destruction is pending (e.g. rescue-transfer ignored) — show doom countdown instead
    if (state.pendingDestructionAt) {
      timerRef.current = null;
      return;
    }

    // Paused / attention lost — don't schedule, will retry when unpaused
    if (state.isPaused || state.isAttentionLost) {
      // Check again in 1 second
      timerRef.current = setTimeout(scheduleNext, 1000);
      return;
    }

    const pool = getEventPool(difficulty);
    if (pool.length === 0) {
      timerRef.current = null;
      return;
    }

    // Calculate delay: random interval + minimum gap from last event
    const picked = pickRandomEvent(pool, lastEventTypeRef.current);
    const [minInterval, maxInterval] = picked.baseIntervalMs;
    let delay = randomBetween(minInterval, maxInterval);

    // Debug mode: 3× faster
    if (DEBUG_MODE) {
      delay = Math.floor(delay / DEBUG_SPEED_MULTIPLIER);
    }

    // Enforce minimum gap from the last event
    const timeSinceLast = Date.now() - lastEventTimeRef.current;
    const gap = Math.max(0, MIN_EVENT_GAP_MS - timeSinceLast);
    delay = Math.max(delay, gap);

    // Store the next event preview for the debug bar
    const triggerAt = Date.now() + delay;
    useGameStore.getState().setNextScheduledEvent({
      eventType: picked.id,
      triggerAt,
    });

    timerRef.current = setTimeout(() => {
      // Double-check we're still playing and not paused
      const currentState = useGameStore.getState();
      const currentDifficulty = useUIStore.getState().difficulty;
      if (
        currentState.gamePhase !== "playing" ||
        currentState.activeEvent ||
        currentState.isPaused ||
        currentState.isAttentionLost ||
        currentDifficulty !== difficulty
      ) {
        // State changed — reschedule
        scheduleNext();
        return;
      }

      // Trigger the event
      const instance: EventInstance = {
        id: picked.id,
        definition: picked,
        triggeredAt: Date.now(),
      };
      lastEventTimeRef.current = Date.now();
      lastEventTypeRef.current = picked.id;

      // Clear preview — this event is now active
      useGameStore.getState().setNextScheduledEvent(null);
      useGameStore.getState().triggerEvent(instance);

      // Schedule the next event
      scheduleNext();
    }, delay);
  }, []);

  // Start / restart the scheduler when the game phase or difficulty changes
  useEffect(() => {
    const state = useGameStore.getState();

    // Clear any existing timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    // Only schedule if playing
    if (state.gamePhase === "playing") {
      scheduleNext();
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [scheduleNext]);

  // Listen for game phase changes via subscription
  useEffect(() => {
    const unsubGame = useGameStore.subscribe((state, prevState) => {
      // Game started playing — begin scheduling
      if (
        state.gamePhase === "playing" &&
        prevState.gamePhase !== "playing"
      ) {
        scheduleNext();
      }

      // Left playing — stop scheduling
      if (
        state.gamePhase !== "playing" &&
        prevState.gamePhase === "playing"
      ) {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
      }

      // Active event resolved — schedule next with gap enforcement
      if (
        state.activeEvent === null &&
        prevState.activeEvent !== null
      ) {
        lastEventTimeRef.current = Date.now();
        if (state.gamePhase === "playing") {
          scheduleNext();
        }
      }
    });

    return () => {
      unsubGame();
    };
  }, [scheduleNext]);

  // Expose a manual trigger function for debug mode
  const triggerManualEvent = useCallback(
    (eventType: EventType) => {
      const def = EVENT_DEFINITIONS.find((d) => d.id === eventType);
      if (!def) return;

      const instance: EventInstance = {
        id: def.id,
        definition: def,
        triggeredAt: Date.now(),
      };
      lastEventTimeRef.current = Date.now();
      lastEventTypeRef.current = def.id;

      // Clear pending timer
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      // Clear preview — we're triggering now
      useGameStore.getState().setNextScheduledEvent(null);
      useGameStore.getState().triggerEvent(instance);

      // Immediately re-roll the next event preview
      const state = useGameStore.getState();
      const difficulty = useUIStore.getState().difficulty;
      if (state.gamePhase === "playing" && difficulty !== "easy") {
        const pool = getEventPool(difficulty);
        if (pool.length > 0) {
          const newPicked = pickRandomEvent(pool, eventType);
          const [minInterval, maxInterval] = newPicked.baseIntervalMs;
          let newDelay = randomBetween(minInterval, maxInterval);
          if (DEBUG_MODE) {
            newDelay = Math.floor(newDelay / DEBUG_SPEED_MULTIPLIER);
          }
          useGameStore.getState().setNextScheduledEvent({
            eventType: newPicked.id,
            triggerAt: Date.now() + newDelay,
          });
        }
      }
    },
    [],
  );

  return { triggerManualEvent };
};

/** Export event definitions for debug bar usage */
export { EVENT_DEFINITIONS };
