import { describe, it, expect } from "vitest";
import {
  estimateFittedFontSize,
  pickLargestFitting,
  bisectionCandidates,
  tallestIndex,
  didFitOverflow,
} from "./introFit";

describe("estimateFittedFontSize", () => {
  const base = { probeFontSizePx: 24, minPx: 12, maxPx: 72 };

  it("scales the probe size by the height ratio", () => {
    expect(
      estimateFittedFontSize({ ...base, measuredHeightPx: 200, targetHeightPx: 100 }),
    ).toBe(12);
    expect(
      estimateFittedFontSize({ ...base, measuredHeightPx: 200, targetHeightPx: 400 }),
    ).toBe(48);
  });

  it("clamps in both directions", () => {
    expect(
      estimateFittedFontSize({ ...base, measuredHeightPx: 1000, targetHeightPx: 10 }),
    ).toBe(12);
    expect(
      estimateFittedFontSize({ ...base, measuredHeightPx: 10, targetHeightPx: 1000 }),
    ).toBe(72);
  });

  it("falls back to the probe size for unusable measurements", () => {
    expect(
      estimateFittedFontSize({ ...base, measuredHeightPx: 0, targetHeightPx: 100 }),
    ).toBe(24);
    expect(
      estimateFittedFontSize({ ...base, measuredHeightPx: NaN, targetHeightPx: 100 }),
    ).toBe(24);
    expect(
      estimateFittedFontSize({ ...base, measuredHeightPx: 200, targetHeightPx: 0 }),
    ).toBe(24);
  });
});

describe("pickLargestFitting", () => {
  const samples = [
    { fontSizePx: 16, heightPx: 80 },
    { fontSizePx: 24, heightPx: 120 },
    { fontSizePx: 20, heightPx: 100 },
    { fontSizePx: 32, heightPx: 160 },
  ];

  it("returns the largest size that still fits", () => {
    expect(pickLargestFitting(samples, 120, 12)).toBe(24);
    expect(pickLargestFitting(samples, 100, 12)).toBe(20);
  });

  it("is order-independent", () => {
    const shuffled = [...samples].reverse();
    expect(pickLargestFitting(shuffled, 120, 12)).toBe(24);
  });

  it("returns every candidate's max when all fit", () => {
    expect(pickLargestFitting(samples, 1000, 12)).toBe(32);
  });

  it("falls back to the floor when nothing fits", () => {
    expect(pickLargestFitting(samples, 10, 12)).toBe(12);
    expect(pickLargestFitting([], 100, 12)).toBe(12);
  });

  it("ignores non-finite samples", () => {
    const dirty = [...samples, { fontSizePx: NaN, heightPx: 1 }, { fontSizePx: 99, heightPx: NaN }];
    expect(pickLargestFitting(dirty, 120, 12)).toBe(24);
  });
});

describe("bisectionCandidates", () => {
  it("returns the requested number of candidates inside the range", () => {
    const candidates = bisectionCandidates(12, 72, 5);
    expect(candidates).toHaveLength(5);
    for (const candidate of candidates) {
      expect(candidate).toBeGreaterThanOrEqual(12);
      expect(candidate).toBeLessThanOrEqual(72);
    }
  });

  it("walks monotonically upward", () => {
    const candidates = bisectionCandidates(12, 72, 5);
    for (let i = 1; i < candidates.length; i++) {
      expect(candidates[i]).toBeGreaterThan(candidates[i - 1]);
    }
  });

  it("tolerates a reversed range and a zero step count", () => {
    expect(bisectionCandidates(72, 12, 3)).toHaveLength(3);
    expect(bisectionCandidates(12, 72, 0)).toEqual([]);
    expect(bisectionCandidates(12, 72, NaN)).toEqual([]);
  });
});

describe("tallestIndex", () => {
  it("finds the tallest measurement", () => {
    expect(tallestIndex([10, 30, 20])).toBe(1);
  });

  it("resolves ties to the lowest index, for determinism", () => {
    expect(tallestIndex([30, 30, 10])).toBe(0);
  });

  it("returns -1 when there is nothing usable", () => {
    expect(tallestIndex([])).toBe(-1);
    expect(tallestIndex([NaN, NaN])).toBe(-1);
  });

  it("skips non-finite entries", () => {
    expect(tallestIndex([10, NaN, 20])).toBe(2);
  });
});

describe("didFitOverflow", () => {
  it("flags a fit that bottomed out at the floor", () => {
    expect(didFitOverflow(12, 12)).toBe(true);
    expect(didFitOverflow(11, 12)).toBe(true);
  });

  it("passes a fit with room to spare", () => {
    expect(didFitOverflow(13, 12)).toBe(false);
  });
});
