import { describe, it, expect } from "vitest";
import {
  kelvinToRgb,
  desaturateTowardWhite,
  SPECTRAL_CLASSES,
  pickSpectralClass,
  buildStarColorTable,
} from "./starColor";

/** Reference values from the Tanner Helland approximation, at full saturation. */
const REFERENCE: ReadonlyArray<[number, [number, number, number]]> = [
  [6600, [255, 255, 255]], // whitepoint — all channels saturate
  [5600, [255, 239, 225]], // G, the Sun
  [15000, [181, 205, 255]], // O/B, blue-white
  [8500, [215, 226, 255]], // A, white
  [6500, [255, 254, 250]], // F, yellowish white
  [4300, [255, 213, 179]], // K, orange
  [3200, [255, 184, 123]], // M, red
];

describe("kelvinToRgb", () => {
  it.each(REFERENCE)("matches the reference colour at %i K", (kelvin, [r, g, b]) => {
    const rgb = kelvinToRgb(kelvin);
    expect(Math.abs(rgb.r - r)).toBeLessThanOrEqual(2);
    expect(Math.abs(rgb.g - g)).toBeLessThanOrEqual(2);
    expect(Math.abs(rgb.b - b)).toBeLessThanOrEqual(2);
  });

  it("keeps the red channel saturated up to the 6600 K whitepoint", () => {
    for (let kelvin = 1000; kelvin <= 6600; kelvin += 100) {
      expect(kelvinToRgb(kelvin).r).toBe(255);
    }
  });

  it("increases the blue channel monotonically with temperature", () => {
    let previous = -1;
    for (let kelvin = 1000; kelvin <= 40000; kelvin += 250) {
      const blue = kelvinToRgb(kelvin).b;
      expect(blue).toBeGreaterThanOrEqual(previous);
      previous = blue;
    }
  });

  it.each([0, -100, 1e9, NaN, Infinity, -Infinity])(
    "returns finite integer channels in 0…255 for out-of-range input (%p)",
    (input) => {
      const rgb = kelvinToRgb(input);
      for (const channel of [rgb.r, rgb.g, rgb.b]) {
        expect(Number.isInteger(channel)).toBe(true);
        expect(channel).toBeGreaterThanOrEqual(0);
        expect(channel).toBeLessThanOrEqual(255);
      }
    },
  );

  it("falls back to the whitepoint for non-finite input", () => {
    expect(kelvinToRgb(NaN)).toEqual({ r: 255, g: 255, b: 255 });
  });
});

describe("desaturateTowardWhite", () => {
  const orange = { r: 255, g: 184, b: 123 };

  it("returns pure white at saturation 0", () => {
    expect(desaturateTowardWhite(orange, 0)).toEqual({ r: 255, g: 255, b: 255 });
    expect(desaturateTowardWhite({ r: 0, g: 0, b: 0 }, 0)).toEqual({ r: 255, g: 255, b: 255 });
  });

  it("is the identity at saturation 1", () => {
    expect(desaturateTowardWhite(orange, 1)).toEqual(orange);
  });

  it("lands on the midpoint at saturation 0.5", () => {
    const mixed = desaturateTowardWhite(orange, 0.5);
    expect(mixed.r).toBe(255);
    expect(mixed.g).toBe(Math.round(255 + (184 - 255) * 0.5));
    expect(mixed.b).toBe(Math.round(255 + (123 - 255) * 0.5));
  });
});

describe("SPECTRAL_CLASSES", () => {
  it("has exactly six classes", () => {
    expect(SPECTRAL_CLASSES).toHaveLength(6);
  });

  it("has weights summing to 1", () => {
    const total = SPECTRAL_CLASSES.reduce((sum, c) => sum + c.weight, 0);
    expect(total).toBeCloseTo(1, 10);
  });
});

describe("pickSpectralClass", () => {
  const idAt = (rand: number) => SPECTRAL_CLASSES[pickSpectralClass(rand)].id;

  it.each([
    [0, "O/B"],
    [0.0999, "O/B"],
    [0.1, "A"],
    [0.2999, "A"],
    [0.3, "F"],
    [0.5, "G"],
    [0.7, "K"],
    [0.9, "M"],
    [0.99999, "M"],
    [1, "M"],
  ])("maps %p to class %s", (rand, expected) => {
    expect(idAt(rand)).toBe(expected);
  });

  it("guards against non-finite input by returning the last class", () => {
    expect(idAt(NaN)).toBe("M");
  });
});

describe("buildStarColorTable", () => {
  it("builds one entry per spectral class", () => {
    expect(buildStarColorTable(0.65)).toHaveLength(SPECTRAL_CLASSES.length);
  });

  it("produces opaque rgb(...) strings — transparency comes from globalAlpha", () => {
    for (const entry of buildStarColorTable(0.65)) {
      expect(entry.css).toBe(`rgb(${entry.r}, ${entry.g}, ${entry.b})`);
      expect(entry.css).not.toContain("rgba");
    }
  });

  it("collapses every class to white at saturation 0", () => {
    for (const entry of buildStarColorTable(0)) {
      expect(entry.css).toBe("rgb(255, 255, 255)");
    }
  });
});
