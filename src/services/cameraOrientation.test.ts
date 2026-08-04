import { describe, it, expect, vi, afterEach } from "vitest";
import {
  computeRotatedCanvasLayout,
  getSensorRotationAngle,
  isTouchPrimaryDevice,
  shouldCompensateOrientation,
} from "./cameraOrientation";
import { CAMERA_ROTATION_SIGN } from "../constants/constants";

describe("computeRotatedCanvasLayout", () => {
  it("leaves dimensions unchanged and rotation at 0 for 0°", () => {
    const layout = computeRotatedCanvasLayout(640, 480, 0);
    expect(layout.canvasWidth).toBe(640);
    expect(layout.canvasHeight).toBe(480);
    expect(layout.rotationRad).toBe(0);
    expect(layout.translateX).toBe(320);
    expect(layout.translateY).toBe(240);
  });

  it("swaps dimensions for 90°", () => {
    const layout = computeRotatedCanvasLayout(640, 480, 90);
    expect(layout.canvasWidth).toBe(480);
    expect(layout.canvasHeight).toBe(640);
    expect(layout.translateX).toBe(240);
    expect(layout.translateY).toBe(320);
  });

  it("swaps dimensions for 270°", () => {
    const layout = computeRotatedCanvasLayout(640, 480, 270);
    expect(layout.canvasWidth).toBe(480);
    expect(layout.canvasHeight).toBe(640);
  });

  it("keeps dimensions for 180° with a ±π rotation", () => {
    const layout = computeRotatedCanvasLayout(640, 480, 180);
    expect(layout.canvasWidth).toBe(640);
    expect(layout.canvasHeight).toBe(480);
    expect(Math.abs(layout.rotationRad)).toBeCloseTo(Math.PI, 10);
  });

  it("applies CAMERA_ROTATION_SIGN to the rotation direction", () => {
    const layout = computeRotatedCanvasLayout(640, 480, 90);
    expect(layout.rotationRad).toBeCloseTo(
      (CAMERA_ROTATION_SIGN * 90 * Math.PI) / 180,
      10,
    );
    // Sign matches the constant (constant is -1 → negative rotation).
    expect(Math.sign(layout.rotationRad)).toBe(CAMERA_ROTATION_SIGN);
  });
});

describe("getSensorRotationAngle", () => {
  const originalOrientationDescriptor = Object.getOwnPropertyDescriptor(
    window.screen,
    "orientation",
  );

  afterEach(() => {
    if (originalOrientationDescriptor) {
      Object.defineProperty(
        window.screen,
        "orientation",
        originalOrientationDescriptor,
      );
    } else {
      Object.defineProperty(window.screen, "orientation", {
        value: undefined,
        configurable: true,
      });
    }
    (window as unknown as { orientation?: number }).orientation = undefined;
  });

  const setScreenAngle = (angle: number | undefined) => {
    Object.defineProperty(window.screen, "orientation", {
      value: angle === undefined ? undefined : { angle },
      configurable: true,
    });
  };

  it.each([0, 90, 180, 270])(
    "reads screen.orientation.angle %i verbatim",
    (angle) => {
      setScreenAngle(angle);
      expect(getSensorRotationAngle()).toBe(angle);
    },
  );

  it("falls back to window.orientation when screen.orientation is missing", () => {
    setScreenAngle(undefined);
    (window as Window & { orientation?: number }).orientation = 90;
    expect(getSensorRotationAngle()).toBe(90);
  });

  it("maps legacy window.orientation -90 to 270", () => {
    setScreenAngle(undefined);
    (window as Window & { orientation?: number }).orientation = -90;
    expect(getSensorRotationAngle()).toBe(270);
  });

  it("maps legacy window.orientation 180 to 180", () => {
    setScreenAngle(undefined);
    (window as Window & { orientation?: number }).orientation = 180;
    expect(getSensorRotationAngle()).toBe(180);
  });

  it("returns 0 when neither source is available", () => {
    setScreenAngle(undefined);
    expect(getSensorRotationAngle()).toBe(0);
  });
});

describe("isTouchPrimaryDevice", () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  const mockMatchMedia = (matches: Record<string, boolean>) => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: matches[query] ?? false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;
  };

  it("returns true for a coarse pointer with no hover", () => {
    mockMatchMedia({ "(pointer: coarse)": true, "(hover: none)": true });
    expect(isTouchPrimaryDevice()).toBe(true);
  });

  it("returns false for a fine pointer that can hover", () => {
    mockMatchMedia({ "(pointer: coarse)": false, "(hover: none)": false });
    expect(isTouchPrimaryDevice()).toBe(false);
  });

  it("returns false when matchMedia is unavailable and the UA is a desktop", () => {
    // @ts-expect-error deliberately removing the API to hit the fallback branch
    delete window.matchMedia;
    expect(isTouchPrimaryDevice()).toBe(false);
  });
});

describe("shouldCompensateOrientation", () => {
  it("is false on desktop at any angle", () => {
    expect(shouldCompensateOrientation(0, false)).toBe(false);
    expect(shouldCompensateOrientation(90, false)).toBe(false);
    expect(shouldCompensateOrientation(180, false)).toBe(false);
    expect(shouldCompensateOrientation(270, false)).toBe(false);
  });

  it("is false on a touch device held upright (0°)", () => {
    expect(shouldCompensateOrientation(0, true)).toBe(false);
  });

  it("is true on a touch device that is rotated", () => {
    expect(shouldCompensateOrientation(90, true)).toBe(true);
    expect(shouldCompensateOrientation(180, true)).toBe(true);
    expect(shouldCompensateOrientation(270, true)).toBe(true);
  });
});

describe("shouldCompensateOrientation with the kill switch off", () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("../constants/constants");
  });

  it("is always false when CAMERA_ORIENTATION_COMPENSATION is false", async () => {
    vi.resetModules();
    vi.doMock("../constants/constants", async () => {
      const actual = await vi.importActual<
        typeof import("../constants/constants")
      >("../constants/constants");
      return { ...actual, CAMERA_ORIENTATION_COMPENSATION: false };
    });
    const { shouldCompensateOrientation: guarded } = await import(
      "./cameraOrientation"
    );
    expect(guarded(90, true)).toBe(false);
    expect(guarded(180, true)).toBe(false);
    expect(guarded(270, true)).toBe(false);
  });
});
