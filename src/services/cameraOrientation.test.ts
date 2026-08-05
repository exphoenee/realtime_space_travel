import { describe, it, expect, vi, afterEach } from "vitest";
import {
  computeRotatedCanvasLayout,
  getAutoOffsetDeg,
  getSensorRotationAngle,
  isTouchPrimaryDevice,
  shouldCompensateOrientation,
} from "./cameraOrientation";
import { CAMERA_ROTATION_OFFSET_BASE_DEG } from "../constants/constants";

describe("getAutoOffsetDeg", () => {
  // With the shipped base (0), the automatic offset equals the live screen
  // angle — the user-verified 90@landscape-A, 270@landscape-B behaviour.
  it("equals the screen angle when the base offset is 0", () => {
    expect(CAMERA_ROTATION_OFFSET_BASE_DEG).toBe(0);
    expect(getAutoOffsetDeg(0)).toBe(0);
    expect(getAutoOffsetDeg(90)).toBe(90);
    expect(getAutoOffsetDeg(180)).toBe(180);
    expect(getAutoOffsetDeg(270)).toBe(270);
  });

  it("follows normalize(angle + base) for a mocked base of 180", async () => {
    vi.resetModules();
    vi.doMock("../constants/constants", async () => {
      const actual = await vi.importActual<
        typeof import("../constants/constants")
      >("../constants/constants");
      return { ...actual, CAMERA_ROTATION_OFFSET_BASE_DEG: 180 };
    });
    const { getAutoOffsetDeg: autoOffset } = await import("./cameraOrientation");
    expect(autoOffset(0)).toBe(180);
    expect(autoOffset(90)).toBe(270);
    expect(autoOffset(180)).toBe(0);
    expect(autoOffset(270)).toBe(90);
    vi.resetModules();
    vi.doUnmock("../constants/constants");
  });
});

describe("computeRotatedCanvasLayout", () => {
  // Without an explicit offset the automatic, screen-angle-driven offset is
  // used: offset = getAutoOffsetDeg(angle) = normalize(angle + base). With the
  // shipped base (0) and sign (-1) the effective angle is
  // normalize(-angle + angle) = 0 for EVERY screen angle → no net rotation on
  // the verified device: dimensions unchanged, rotationRad === 0.
  it.each([0, 90, 180, 270] as const)(
    "auto offset yields no net rotation for screen %i° (base 0, sign -1)",
    (angle) => {
      const layout = computeRotatedCanvasLayout(640, 480, angle);
      expect(layout.canvasWidth).toBe(640);
      expect(layout.canvasHeight).toBe(480);
      expect(layout.translateX).toBe(320);
      expect(layout.translateY).toBe(240);
      expect(layout.rotationRad).toBe(0);
    },
  );

  it("omitting offsetDeg matches passing getAutoOffsetDeg(angle) explicitly", () => {
    for (const angle of [0, 90, 180, 270] as const) {
      const fromDefault = computeRotatedCanvasLayout(640, 480, angle);
      const fromExplicit = computeRotatedCanvasLayout(
        640,
        480,
        angle,
        getAutoOffsetDeg(angle),
      );
      expect(fromExplicit).toEqual(fromDefault);
    }
  });

  // Explicit offset overrides (the debug live-rotate control) drive the
  // effective angle directly: effective = normalize(sign*angle + offset).
  it("explicit offset 0° at screen 0° → effective 0° (no swap)", () => {
    const layout = computeRotatedCanvasLayout(640, 480, 0, 0);
    expect(layout.canvasWidth).toBe(640);
    expect(layout.canvasHeight).toBe(480);
    expect(layout.rotationRad).toBe(0);
  });

  it("explicit offset 90° at screen 0° → effective 90° (swap)", () => {
    const layout = computeRotatedCanvasLayout(640, 480, 0, 90);
    expect(layout.canvasWidth).toBe(480);
    expect(layout.canvasHeight).toBe(640);
    expect(layout.rotationRad).toBeCloseTo(Math.PI / 2, 10);
  });

  it("explicit offset 180° at screen 0° → effective 180° (no swap)", () => {
    const layout = computeRotatedCanvasLayout(640, 480, 0, 180);
    expect(layout.canvasWidth).toBe(640);
    expect(layout.canvasHeight).toBe(480);
    expect(layout.rotationRad).toBeCloseTo(Math.PI, 10);
  });

  it("explicit offset 270° at screen 0° → effective 270° (swap)", () => {
    const layout = computeRotatedCanvasLayout(640, 480, 0, 270);
    expect(layout.canvasWidth).toBe(480);
    expect(layout.canvasHeight).toBe(640);
    expect(layout.rotationRad).toBeCloseTo((270 * Math.PI) / 180, 10);
  });
});

describe("computeRotatedCanvasLayout effective-angle formula (explicit offset, mocked sign)", () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("../constants/constants");
  });

  const loadWith = async (sign: number) => {
    vi.resetModules();
    vi.doMock("../constants/constants", async () => {
      const actual = await vi.importActual<
        typeof import("../constants/constants")
      >("../constants/constants");
      return { ...actual, CAMERA_ROTATION_SIGN: sign };
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
    "swap + rotation follow the effective angle for sign=$sign explicit offset=$offset",
    async ({ sign, offset }) => {
      const compute = await loadWith(sign);
      for (const angle of [0, 90, 180, 270] as const) {
        const effectiveDeg = (((sign * angle + offset) % 360) + 360) % 360;
        const swap = effectiveDeg === 90 || effectiveDeg === 270;
        const layout = compute(640, 480, angle, offset);
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
