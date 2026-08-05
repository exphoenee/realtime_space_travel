import { describe, it, expect, vi, afterEach } from "vitest";
import {
  computeRotatedCanvasLayout,
  getSensorRotationAngle,
  isTouchPrimaryDevice,
  shouldCompensateOrientation,
} from "./cameraOrientation";
import {
  CAMERA_ROTATION_SIGN,
  CAMERA_ROTATION_OFFSET_DEG,
} from "../constants/constants";

/**
 * The effective full rotation the layout must realise: the signed base rotation
 * plus the fixed sensor-mount offset, normalized to {0, 90, 180, 270}. Mirrors
 * the production formula so the tests pin the *formula* against whatever the
 * live-tuned constants happen to be, not a hard-coded number.
 */
const expectedEffectiveDeg = (angle: number): number =>
  (((CAMERA_ROTATION_SIGN * angle + CAMERA_ROTATION_OFFSET_DEG) % 360) + 360) %
  360;

describe("computeRotatedCanvasLayout", () => {
  it.each([0, 90, 180, 270] as const)(
    "derives dimensions and rotation from the effective angle for screen %i°",
    (angle) => {
      const layout = computeRotatedCanvasLayout(640, 480, angle);
      const effectiveDeg = expectedEffectiveDeg(angle);
      const swap = effectiveDeg === 90 || effectiveDeg === 270;

      expect(layout.canvasWidth).toBe(swap ? 480 : 640);
      expect(layout.canvasHeight).toBe(swap ? 640 : 480);
      expect(layout.translateX).toBe(layout.canvasWidth / 2);
      expect(layout.translateY).toBe(layout.canvasHeight / 2);
      expect(layout.rotationRad).toBeCloseTo(
        (effectiveDeg * Math.PI) / 180,
        10,
      );
    },
  );

  // Explicit expectations for the shipped constants (sign = -1, offset = 90),
  // so a change to either is caught here as well as by the formula above.
  it("with the default sign=-1 / offset=90: screen 0° → effective 90° (swap)", () => {
    const layout = computeRotatedCanvasLayout(640, 480, 0);
    expect(layout.canvasWidth).toBe(480);
    expect(layout.canvasHeight).toBe(640);
    expect(layout.rotationRad).toBeCloseTo(Math.PI / 2, 10);
  });

  it("with the default sign=-1 / offset=90: screen 90° → effective 0° (no swap)", () => {
    const layout = computeRotatedCanvasLayout(640, 480, 90);
    expect(layout.canvasWidth).toBe(640);
    expect(layout.canvasHeight).toBe(480);
    expect(layout.rotationRad).toBe(0);
  });

  it("with the default sign=-1 / offset=90: screen 180° → effective 270° (swap)", () => {
    const layout = computeRotatedCanvasLayout(640, 480, 180);
    expect(layout.canvasWidth).toBe(480);
    expect(layout.canvasHeight).toBe(640);
    expect(layout.rotationRad).toBeCloseTo((270 * Math.PI) / 180, 10);
  });

  it("with the default sign=-1 / offset=90: screen 270° → effective 180° (no swap)", () => {
    const layout = computeRotatedCanvasLayout(640, 480, 270);
    expect(layout.canvasWidth).toBe(640);
    expect(layout.canvasHeight).toBe(480);
    expect(layout.rotationRad).toBeCloseTo(Math.PI, 10);
  });

  it("omitting offsetDeg matches passing the constant explicitly", () => {
    for (const angle of [0, 90, 180, 270] as const) {
      const fromDefault = computeRotatedCanvasLayout(640, 480, angle);
      const fromExplicit = computeRotatedCanvasLayout(
        640,
        480,
        angle,
        CAMERA_ROTATION_OFFSET_DEG,
      );
      expect(fromExplicit).toEqual(fromDefault);
    }
  });

  it("the offsetDeg override drives the effective angle (screen 0°, offset 0° → effective 0°, no swap)", () => {
    const layout = computeRotatedCanvasLayout(640, 480, 0, 0);
    expect(layout.canvasWidth).toBe(640);
    expect(layout.canvasHeight).toBe(480);
    expect(layout.rotationRad).toBe(0);
  });

  it("the offsetDeg override drives the effective angle (screen 0°, offset 180° → effective 180°, no swap)", () => {
    const layout = computeRotatedCanvasLayout(640, 480, 0, 180);
    expect(layout.canvasWidth).toBe(640);
    expect(layout.canvasHeight).toBe(480);
    expect(layout.rotationRad).toBeCloseTo(Math.PI, 10);
  });

  it("the offsetDeg override drives the effective angle (screen 0°, offset 270° → effective 270°, swap)", () => {
    const layout = computeRotatedCanvasLayout(640, 480, 0, 270);
    expect(layout.canvasWidth).toBe(480);
    expect(layout.canvasHeight).toBe(640);
    expect(layout.rotationRad).toBeCloseTo((270 * Math.PI) / 180, 10);
  });
});

describe("computeRotatedCanvasLayout effective-angle formula (mocked constants)", () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("../constants/constants");
  });

  const loadWith = async (sign: number, offset: number) => {
    vi.resetModules();
    vi.doMock("../constants/constants", async () => {
      const actual = await vi.importActual<
        typeof import("../constants/constants")
      >("../constants/constants");
      return {
        ...actual,
        CAMERA_ROTATION_SIGN: sign,
        CAMERA_ROTATION_OFFSET_DEG: offset,
      };
    });
    const mod = await import("./cameraOrientation");
    return mod.computeRotatedCanvasLayout;
  };

  const cases: Array<{ sign: number; offset: number }> = [
    { sign: -1, offset: 90 },
    { sign: -1, offset: 270 },
    { sign: 1, offset: 90 },
    { sign: 1, offset: 0 },
    { sign: -1, offset: 180 },
  ];

  it.each(cases)(
    "swap + rotation follow the effective angle for sign=$sign offset=$offset",
    async ({ sign, offset }) => {
      const compute = await loadWith(sign, offset);
      for (const angle of [0, 90, 180, 270] as const) {
        const effectiveDeg = (((sign * angle + offset) % 360) + 360) % 360;
        const swap = effectiveDeg === 90 || effectiveDeg === 270;
        const layout = compute(640, 480, angle);
        expect(layout.canvasWidth).toBe(swap ? 480 : 640);
        expect(layout.canvasHeight).toBe(swap ? 640 : 480);
        expect(layout.rotationRad).toBeCloseTo(
          (effectiveDeg * Math.PI) / 180,
          10,
        );
      }
    },
  );
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
