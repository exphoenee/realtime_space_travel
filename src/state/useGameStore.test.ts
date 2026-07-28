import { describe, it, expect, beforeEach } from "vitest";
import useGameStore from "../state/useGameStore";
import useUIStore from "../state/useUIStore";
import type { EventType, EventInstance } from "../types";

describe("useGameStore", () => {
  beforeEach(() => {
    useGameStore.setState({
      destination: null,
      remainingYears: 0,
      isPaused: true,
      showIntro: true,
      isAttentionLost: false,
      inactivitySeconds: 0,
      crewLost: false,
      crewLostReason: null,
      missionComplete: false,
      serviceSeconds: 0,
      bestServiceSeconds: 0,
      isInitializing: false,
      debugIgnoreAttention: false,
    });
  });

  it("should have correct initial state", () => {
    const state = useGameStore.getState();
    expect(state.destination).toBeNull();
    expect(state.isPaused).toBe(true);
    expect(state.showIntro).toBe(true);
    expect(state.crewLost).toBe(false);
    expect(state.missionComplete).toBe(false);
  });

  it("should start a mission correctly", () => {
    const destination = { name: "Proxima Centauri", travelYears: 100 };
    useGameStore.getState().startMission(destination);

    const state = useGameStore.getState();
    expect(state.destination).toEqual(destination);
    expect(state.remainingYears).toBe(100);
    expect(state.isPaused).toBe(true);
    expect(state.isInitializing).toBe(true);
    expect(state.crewLost).toBe(false);
    expect(state.missionComplete).toBe(false);
    expect(state.serviceSeconds).toBe(0);
  });

  it("should reset to menu correctly", () => {
    useGameStore.getState().startMission({
      name: "Proxima Centauri",
      travelYears: 100,
    });
    useGameStore.getState().resetToMenu();

    const state = useGameStore.getState();
    expect(state.destination).toBeNull();
    expect(state.remainingYears).toBe(0);
    expect(state.isPaused).toBe(true);
    expect(state.crewLost).toBe(false);
    expect(state.missionComplete).toBe(false);
  });

  it("should set crew lost with reason", () => {
    useGameStore.getState().setCrewLost(true);
    useGameStore.getState().setCrewLostReason("attention");

    const state = useGameStore.getState();
    expect(state.crewLost).toBe(true);
    expect(state.crewLostReason).toBe("attention");
  });

  it("should update service seconds", () => {
    useGameStore.getState().setServiceSeconds(100);

    const state = useGameStore.getState();
    expect(state.serviceSeconds).toBe(100);
  });

  it("should update best service seconds", () => {
    useGameStore.getState().setBestServiceSeconds(200);

    const state = useGameStore.getState();
    expect(state.bestServiceSeconds).toBe(200);
  });

  // -----------------------------------------------------------------------
  // Event system
  // -----------------------------------------------------------------------

  describe("event system", () => {
    const mockEvent = (id: EventType, penaltyType: "time" | "crewLost" = "time"): EventInstance => ({
      id,
      definition: {
        id,
        minDifficulty: "medium" as const,
        minIntervalMs: 180_000,
        baseIntervalMs: [180_000, 300_000] as [number, number],
        durationMs: 15_000,
        penaltyType,
        penaltyAmount: 10,
        i18nKey: `event.${id}`,
        isRare: false,
      },
      triggeredAt: Date.now(),
    });

    beforeEach(() => {
      useGameStore.setState({
        activeEvent: null,
        eventPenaltyYears: 0,
        cockpitVariant: "default",
        asteroidWarning: false,
        gamePhase: "playing",
        remainingYears: 100,
      });
    });

    it("starts with default event state", () => {
      const state = useGameStore.getState();
      expect(state.activeEvent).toBeNull();
      expect(state.eventPenaltyYears).toBe(0);
      expect(state.cockpitVariant).toBe("default");
      expect(state.asteroidWarning).toBe(false);
    });

    it("triggerEvent sets activeEvent", () => {
      const event = mockEvent("horn");
      useGameStore.getState().triggerEvent(event);

      expect(useGameStore.getState().activeEvent).toEqual(event);
    });

    it("triggerEvent with asteroid sets asteroidWarning", () => {
      const event = mockEvent("asteroid");
      useGameStore.getState().triggerEvent(event);

      expect(useGameStore.getState().asteroidWarning).toBe(true);
    });

    it("triggerEvent with non-asteroid does NOT set asteroidWarning", () => {
      const event = mockEvent("horn");
      useGameStore.getState().triggerEvent(event);

      expect(useGameStore.getState().asteroidWarning).toBe(false);
    });

    it("resolveEvent(true) clears activeEvent", () => {
      useGameStore.getState().triggerEvent(mockEvent("horn"));
      useGameStore.getState().resolveEvent(true);

      expect(useGameStore.getState().activeEvent).toBeNull();
    });

    it("resolveEvent(true) with rescue-transfer sets cockpitVariant to rescue", () => {
      useGameStore.getState().triggerEvent(mockEvent("rescue-transfer"));
      useGameStore.getState().resolveEvent(true);

      expect(useGameStore.getState().cockpitVariant).toBe("rescue");
    });

    it("resolveEvent(true) with non-rescue leaves cockpitVariant as default", () => {
      useGameStore.getState().triggerEvent(mockEvent("horn"));
      useGameStore.getState().resolveEvent(true);

      expect(useGameStore.getState().cockpitVariant).toBe("default");
    });

    it("resolveEvent(true) with asteroid clears asteroidWarning", () => {
      useGameStore.getState().triggerEvent(mockEvent("asteroid"));
      useGameStore.getState().resolveEvent(true);

      expect(useGameStore.getState().asteroidWarning).toBe(false);
    });

    it("resolveEvent(false) with time penalty adds penalty years", () => {
      useGameStore.getState().triggerEvent(mockEvent("horn"));
      useGameStore.getState().resolveEvent(false);

      const state = useGameStore.getState();
      expect(state.eventPenaltyYears).toBe(10);
      expect(state.remainingYears).toBe(110); // 100 + 10
    });

    it("resolveEvent(false) with asteroid clears asteroidWarning and adds time", () => {
      useGameStore.getState().triggerEvent(mockEvent("asteroid"));
      useGameStore.getState().resolveEvent(false);

      const state = useGameStore.getState();
      expect(state.asteroidWarning).toBe(false);
      expect(state.eventPenaltyYears).toBe(10);
      expect(state.remainingYears).toBe(110);
    });

    it("resolveEvent(false) with crewLost penalty transitions to crewLost", () => {
      const event = mockEvent("solar-flare", "crewLost");
      useGameStore.getState().triggerEvent(event);
      useGameStore.getState().resolveEvent(false);

      const state = useGameStore.getState();
      expect(state.gamePhase).toBe("crewLost");
      expect(state.crewLost).toBe(true);
      expect(state.crewLostReason).toBe("event");
    });

    it("dismissEvent clears activeEvent and asteroidWarning", () => {
      useGameStore.getState().triggerEvent(mockEvent("asteroid"));
      useGameStore.getState().dismissEvent();

      const state = useGameStore.getState();
      expect(state.activeEvent).toBeNull();
      expect(state.asteroidWarning).toBe(false);
    });

    it("startMission resets cockpitVariant to default", () => {
      // First set rescue variant
      useGameStore.getState().triggerEvent(mockEvent("rescue-transfer"));
      useGameStore.getState().resolveEvent(true);
      expect(useGameStore.getState().cockpitVariant).toBe("rescue");

      // Start a new mission
      useGameStore.getState().startMission({
        name: "Alpha Centauri",
        travelYears: 50,
      });

      expect(useGameStore.getState().cockpitVariant).toBe("default");
    });

    it("resetToMenu clears all event state", () => {
      useGameStore.getState().triggerEvent(mockEvent("asteroid"));
      useGameStore.getState().setServiceSeconds(100);
      useGameStore.getState().resetToMenu();

      const state = useGameStore.getState();
      expect(state.activeEvent).toBeNull();
      expect(state.asteroidWarning).toBe(false);
      expect(state.cockpitVariant).toBe("default");
      expect(state.eventPenaltyYears).toBe(0);
    });

    it("accumulates penalty years across multiple failures", () => {
      useGameStore.getState().triggerEvent(mockEvent("horn"));
      useGameStore.getState().resolveEvent(false);

      useGameStore.getState().triggerEvent(mockEvent("asteroid"));
      useGameStore.getState().resolveEvent(false);

      expect(useGameStore.getState().eventPenaltyYears).toBe(20); // 10 + 10
      expect(useGameStore.getState().remainingYears).toBe(120); // 100 + 20
    });
  });
});

describe("useUIStore", () => {
  beforeEach(() => {
    useUIStore.setState({
      cameraError: null,
      showExitConfirm: false,
      isMusicMuted: false,
    });
  });

  it("should have correct initial state", () => {
    const state = useUIStore.getState();
    expect(state.cameraError).toBeNull();
    expect(state.showExitConfirm).toBe(false);
    expect(state.isMusicMuted).toBe(false);
  });

  it("should toggle music mute", () => {
    useUIStore.getState().setIsMusicMuted(true);

    const state = useUIStore.getState();
    expect(state.isMusicMuted).toBe(true);
  });

  it("should set camera error", () => {
    useUIStore.getState().setCameraError("Camera not found");

    const state = useUIStore.getState();
    expect(state.cameraError).toBe("Camera not found");
  });

  it("should set exit confirm", () => {
    useUIStore.getState().setShowExitConfirm(true);

    const state = useUIStore.getState();
    expect(state.showExitConfirm).toBe(true);
  });
});
