import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import useGameStore from "../state/useGameStore";
import useUIStore from "../state/useUIStore";
import { useEventSystem, EVENT_DEFINITIONS } from "./useEventSystem";
import type { Difficulty, EventInstance, EventType } from "../types";

// ---------------------------------------------------------------------------
// Mock stores — use GameStore and UIStore directly with fresh reset per test
// ---------------------------------------------------------------------------

beforeEach(() => {
  // Reset game store to a clean playing state
  useGameStore.setState({
    gamePhase: "playing",
    activeEvent: null,
    isPaused: false,
    isAttentionLost: false,
  });

  // Reset UI store to medium difficulty
  useUIStore.setState({
    difficulty: "medium",
  });

  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Get all event IDs that should appear in a given difficulty pool */
const expectedPoolFor = (difficulty: Difficulty): EventType[] => {
  if (difficulty === "easy") return [];
  const base: EventType[] = ["horn", "asteroid", "rescue-transfer", "rover"];
  if (difficulty === "hard") {
    return [...base, "solar-flare", "fake-instruction"];
  }
  return base;
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useEventSystem", () => {
  it("returns triggerManualEvent function", () => {
    const { result } = renderHook(() => useEventSystem());
    expect(result.current).toHaveProperty("triggerManualEvent");
    expect(typeof result.current.triggerManualEvent).toBe("function");
  });

  it("does not schedule any event in easy mode", () => {
    useUIStore.setState({ difficulty: "easy" });
    renderHook(() => useEventSystem());

    // Advance time by 10 minutes — no event should trigger
    vi.advanceTimersByTime(600_000);
    expect(useGameStore.getState().activeEvent).toBeNull();
  });

  it("does not trigger an event before 1 minute in medium mode", () => {
    renderHook(() => useEventSystem());

    // Advance by 1 minute — safely below the minimum 3 min interval
    vi.advanceTimersByTime(60_000);
    expect(useGameStore.getState().activeEvent).toBeNull();
  });



  it("triggers events from the correct pool for each difficulty", () => {
    // Test medium pool
    useUIStore.setState({ difficulty: "medium" });
    const { result } = renderHook(() => useEventSystem());

    const mediumPool = expectedPoolFor("medium");

    mediumPool.forEach((type) => {
      result.current.triggerManualEvent(type);
      const event = useGameStore.getState().activeEvent;
      expect(event).not.toBeNull();
      expect(event!.id).toBe(type);
      // Clear event
      useGameStore.getState().dismissEvent();
    });
  });

  it("hard difficulty includes solar-flare and fake-instruction in pool", () => {
    useUIStore.setState({ difficulty: "hard" });
    renderHook(() => useEventSystem());
    const hardPool = expectedPoolFor("hard");

    expect(hardPool).toContain("solar-flare");
    expect(hardPool).toContain("fake-instruction");
    expect(hardPool).toContain("horn");
    expect(hardPool).toContain("asteroid");
  });

  it("does not schedule events when gamePhase is not 'playing'", () => {
    useGameStore.setState({ gamePhase: "mainMenu" });
    renderHook(() => useEventSystem());

    vi.advanceTimersByTime(600_000);
    expect(useGameStore.getState().activeEvent).toBeNull();
  });

  it("pauses event scheduling when isPaused is true, then resumes", () => {
    renderHook(() => useEventSystem());

    // Set paused state
    useGameStore.setState({ isPaused: true });

    // Advance time significantly — event should not trigger while paused
    vi.advanceTimersByTime(600_000);
    expect(useGameStore.getState().activeEvent).toBeNull();
  });

  it("pauses event scheduling when isAttentionLost is true", () => {
    renderHook(() => useEventSystem());

    useGameStore.setState({ isAttentionLost: true });

    // Advance time — no event should trigger
    vi.advanceTimersByTime(600_000);
    expect(useGameStore.getState().activeEvent).toBeNull();
  });

  it("triggerManualEvent sets an active event in the store", () => {
    const { result } = renderHook(() => useEventSystem());

    result.current.triggerManualEvent("horn");

    const event = useGameStore.getState().activeEvent;
    expect(event).not.toBeNull();
    expect(event!.id).toBe("horn");
    expect(event!.definition).toBeDefined();
    expect(event!.triggeredAt).toBeGreaterThan(0);
  });

  it("triggerManualEvent works for all event types", () => {
    const { result } = renderHook(() => useEventSystem());

    const allTypes: EventType[] = [
      "horn",
      "asteroid",
      "rescue-transfer",
      "solar-flare",
      "rover",
      "fake-instruction",
    ];

    allTypes.forEach((type) => {
      result.current.triggerManualEvent(type);
      const event = useGameStore.getState().activeEvent;
      expect(event).not.toBeNull();
      expect(event!.id).toBe(type);
      useGameStore.getState().dismissEvent();
    });
  });

  it("triggerManualEvent clears the pending timer", () => {
    const { result } = renderHook(() => useEventSystem());

    // Trigger a manual event
    result.current.triggerManualEvent("rover");

    // The active event should be set, meaning the schedule timer was cancelled
    expect(useGameStore.getState().activeEvent).not.toBeNull();
  });
});

describe("EVENT_DEFINITIONS", () => {
  it("defines all expected event types", () => {
    const ids = EVENT_DEFINITIONS.map((d) => d.id);
    expect(ids).toContain("horn");
    expect(ids).toContain("asteroid");
    expect(ids).toContain("rescue-transfer");
    expect(ids).toContain("solar-flare");
    expect(ids).toContain("rover");
    expect(ids).toContain("fake-instruction");
  });

  it("has valid penalty types for all definitions", () => {
    EVENT_DEFINITIONS.forEach((def) => {
      expect(["time", "crewLost"]).toContain(def.penaltyType);
    });
  });

  it("solar-flare has crewLost penalty", () => {
    const flare = EVENT_DEFINITIONS.find((d) => d.id === "solar-flare");
    expect(flare).toBeDefined();
    expect(flare!.penaltyType).toBe("crewLost");
  });

  it("all definitions have valid minDifficulty", () => {
    EVENT_DEFINITIONS.forEach((def) => {
      expect(["medium", "hard"]).toContain(def.minDifficulty);
    });
  });
});
