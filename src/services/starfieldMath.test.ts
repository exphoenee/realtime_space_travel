import { describe, it, expect } from "vitest";
import {
  magnitudeFromRandom,
  subpixelAlphaScale,
  deltaFrames,
  frameRateAdjustedLerp,
  randomRollRadians,
  getStretchFactor,
} from "./starfieldMath";
import { STAR_DRIFT_SMOOTHING, TARGET_FRAME_MS } from "../constants/constants";

/**
 * Deterministic pseudo-random source for distribution tests — a plain LCG, so
 * the sample is identical on every run without mocking `Math.random`.
 */
const seededRandom = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
};

describe("magnitudeFromRandom", () => {
  it("maps the endpoints to themselves", () => {
    expect(magnitudeFromRandom(0)).toBe(0);
    expect(magnitudeFromRandom(1)).toBe(1);
  });

  it("matches the power law at the midpoint", () => {
    expect(magnitudeFromRandom(0.5)).toBeCloseTo(0.1768, 4);
  });

  it("is monotonically increasing", () => {
    let previous = -1;
    for (let rand = 0; rand <= 1; rand += 0.01) {
      const mag = magnitudeFromRandom(rand);
      expect(mag).toBeGreaterThanOrEqual(previous);
      previous = mag;
    }
  });

  it("is skewed toward faint stars — over half the sample below 0.25", () => {
    const random = seededRandom(12345);
    let faint = 0;
    const samples = 10_000;

    for (let i = 0; i < samples; i++) {
      if (magnitudeFromRandom(random()) < 0.25) faint++;
    }

    expect(faint / samples).toBeGreaterThan(0.5);
  });

  it("never returns NaN", () => {
    expect(magnitudeFromRandom(NaN)).toBe(0);
    expect(magnitudeFromRandom(Infinity)).toBe(0);
    expect(magnitudeFromRandom(-1)).toBe(0);
  });
});

describe("subpixelAlphaScale", () => {
  it("applies no correction at or above the threshold", () => {
    expect(subpixelAlphaScale(0.7, 0.7)).toBe(1);
    expect(subpixelAlphaScale(2, 0.7)).toBe(1);
  });

  it("scales by the area ratio below the threshold", () => {
    expect(subpixelAlphaScale(0.35, 0.7)).toBeCloseTo(0.25, 10);
  });

  it("returns 0 at zero radius", () => {
    expect(subpixelAlphaScale(0, 0.7)).toBe(0);
  });

  it("is monotonically increasing", () => {
    let previous = -1;
    for (let raw = 0; raw <= 1; raw += 0.02) {
      const scale = subpixelAlphaScale(raw, 0.7);
      expect(scale).toBeGreaterThanOrEqual(previous);
      previous = scale;
    }
  });

  it("never returns NaN", () => {
    expect(subpixelAlphaScale(NaN, 0.7)).toBe(1);
    expect(subpixelAlphaScale(0.3, 0)).toBe(1);
  });
});

describe("deltaFrames", () => {
  it("returns ~1 frame at 60 Hz", () => {
    expect(deltaFrames(TARGET_FRAME_MS)).toBeCloseTo(1, 10);
  });

  it("returns ~0.4167 frames at 144 Hz", () => {
    expect(deltaFrames(1000 / 144)).toBeCloseTo(0.4167, 4);
  });

  it("clamps a tab-switch gap to exactly 3 frames", () => {
    expect(deltaFrames(5000)).toBe(3);
  });

  it("returns 1 for the first frame and for invalid input", () => {
    expect(deltaFrames(0)).toBe(1);
    expect(deltaFrames(-5)).toBe(1);
    expect(deltaFrames(NaN)).toBe(1);
    expect(deltaFrames(Infinity)).toBe(1);
  });
});

describe("frameRateAdjustedLerp", () => {
  it("is bit-for-bit the pre-019 drift at 60 Hz", () => {
    // The regression anchor: at one frame the approach factor is exactly 0.08
    // and the decay factor exactly 0.92, as before delta normalisation.
    expect(frameRateAdjustedLerp(STAR_DRIFT_SMOOTHING, 1)).toBe(0.08);
    expect(1 - frameRateAdjustedLerp(STAR_DRIFT_SMOOTHING, 1)).toBe(0.92);
  });

  it("is non-linear across frames", () => {
    // Two frames of 8% is 1 - 0.92² = 0.1536, not 0.16.
    expect(frameRateAdjustedLerp(0.08, 2)).toBeCloseTo(0.1536, 10);
    expect(frameRateAdjustedLerp(0.08, 2)).not.toBeCloseTo(0.16, 4);
  });

  it("returns 0 at zero frames — no movement", () => {
    expect(frameRateAdjustedLerp(0.08, 0)).toBe(0);
  });

  it("is monotonically increasing in frames and never reaches 1", () => {
    let previous = -1;
    for (let frames = 0; frames <= 3; frames += 0.1) {
      const k = frameRateAdjustedLerp(0.08, frames);
      expect(k).toBeGreaterThanOrEqual(previous);
      expect(k).toBeLessThan(1);
      previous = k;
    }
  });

  it("never returns NaN", () => {
    expect(frameRateAdjustedLerp(0.08, NaN)).toBe(0.08);
    expect(frameRateAdjustedLerp(0.08, Infinity)).toBe(0.08);
    expect(frameRateAdjustedLerp(0.08, -1)).toBe(0.08);
    expect(frameRateAdjustedLerp(NaN, 1)).toBe(0);
  });
});

describe("randomRollRadians", () => {
  const maxDegrees = 6;
  const maxRadians = (maxDegrees * Math.PI) / 180;

  it("maps the endpoints and centre exactly", () => {
    expect(randomRollRadians(0, maxDegrees)).toBeCloseTo(-maxRadians, 12);
    expect(randomRollRadians(1, maxDegrees)).toBeCloseTo(maxRadians, 12);
    expect(randomRollRadians(0.5, maxDegrees)).toBe(0);
  });

  it("never exceeds the configured maximum", () => {
    for (let rand = 0; rand <= 1; rand += 0.01) {
      expect(Math.abs(randomRollRadians(rand, maxDegrees))).toBeLessThanOrEqual(maxRadians + 1e-12);
    }
  });

  it("is unbiased — a 50/50 split between the two directions", () => {
    const random = seededRandom(98765);
    let negative = 0;
    const samples = 10_000;

    for (let i = 0; i < samples; i++) {
      if (randomRollRadians(random(), maxDegrees) < 0) negative++;
    }

    expect(negative / samples).toBeGreaterThan(0.48);
    expect(negative / samples).toBeLessThan(0.52);
  });

  it("returns 0 for non-finite input — a NaN angle would erase the whole field", () => {
    expect(randomRollRadians(NaN, maxDegrees)).toBe(0);
    expect(randomRollRadians(0.3, NaN)).toBe(0);
    expect(randomRollRadians(Infinity, maxDegrees)).toBe(0);
  });
});

describe("getStretchFactor", () => {
  it.each([
    [191, 1.0],
    [250, 1.0],
    [625, 1.5],
    [1000, 2.0],
    [5000, 2.0],
  ])("maps %i km/s to %fx", (speed, expected) => {
    expect(getStretchFactor(speed)).toBeCloseTo(expected, 10);
  });
});
