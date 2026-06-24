import { describe, it, expect, beforeEach } from "vitest";
import useGameStore from "../state/useGameStore";
import useUIStore from "../state/useUIStore";

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
