import { describe, it, expect, beforeEach } from "vitest";
import useGameStore from "../state/useGameStore";

describe("useGameStore", () => {
  beforeEach(() => {
    useGameStore.setState({
      destination: null,
      remainingYears: 0,
      isPaused: true,
      cameraError: null,
      showExitConfirm: false,
      showIntro: true,
      isAttentionLost: false,
      inactivitySeconds: 0,
      crewLost: false,
      crewLostReason: null,
      missionComplete: false,
      serviceSeconds: 0,
      bestServiceSeconds: 0,
      isMusicMuted: false,
      isInitializing: false,
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

  it("should toggle music mute", () => {
    useGameStore.getState().setIsMusicMuted(true);

    const state = useGameStore.getState();
    expect(state.isMusicMuted).toBe(true);
  });
});
