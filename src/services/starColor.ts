/**
 * Star colour model — blackbody (Kelvin → RGB) conversion and the spectral-class
 * distribution used by the starfield.
 *
 * Pure functions only: no canvas, no DOM, no `Math.random()` calls. Everything
 * that draws a random number takes it as a parameter, so the distribution can be
 * tested deterministically without mocking `Math.random`.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface SpectralClass {
  /** Short label, e.g. "O/B". */
  id: string;
  /** Effective temperature in Kelvin. */
  kelvin: number;
  /** Share of the starfield, in `[0, 1]`. All weights sum to exactly 1. */
  weight: number;
}

export interface StarColor extends Rgb {
  /**
   * Pre-built, opaque `rgb(...)` string. There are only six of these in the
   * whole application — one per spectral class — and every star holds a
   * reference to a shared instance. Never rebuilt per frame; transparency comes
   * from `ctx.globalAlpha` instead.
   */
  css: string;
}

/** Below this the Tanner Helland approximation is not meaningful. */
const KELVIN_MIN = 1000;
const KELVIN_MAX = 40000;
/** The blackbody whitepoint — all three channels saturate at 255 here. */
const KELVIN_FALLBACK = 6600;

const clampChannel = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.min(255, Math.max(0, Math.round(value)));
};

/**
 * Blackbody colour approximation (Tanner Helland). Returns integer channels in
 * `0…255`.
 *
 * Never returns `NaN`: non-finite input falls back to the 6600 K whitepoint, and
 * the temperature is clamped to `[1000, 40000]` before the curves are evaluated.
 */
export const kelvinToRgb = (kelvin: number): Rgb => {
  const safe = Number.isFinite(kelvin) ? kelvin : KELVIN_FALLBACK;
  const t = Math.min(KELVIN_MAX, Math.max(KELVIN_MIN, safe)) / 100;

  const red = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592);

  const green =
    t <= 66
      ? 99.4708025861 * Math.log(t) - 161.1195681661
      : 288.1221695283 * Math.pow(t - 60, -0.0755148492);

  const blue =
    t >= 66
      ? 255
      : t <= 19
        ? 0
        : 138.5177312231 * Math.log(t - 10) - 305.0447927307;

  return { r: clampChannel(red), g: clampChannel(green), b: clampChannel(blue) };
};

/**
 * Interpolates a colour toward white.
 *
 * Raw blackbody colours are too strong for a 400-star field — it reads as
 * "disco" rather than sky. On the real night sky the eye perceives faint stars
 * as near-white (scotopic vision); only the brightest show obvious colour.
 *
 * `saturation = 0` → pure white · `1` → the raw blackbody colour.
 */
export const desaturateTowardWhite = (rgb: Rgb, saturation: number): Rgb => {
  const s = Number.isFinite(saturation) ? Math.min(1, Math.max(0, saturation)) : 1;
  const mix = (channel: number) => clampChannel(255 + (channel - 255) * s);
  return { r: mix(rgb.r), g: mix(rgb.g), b: mix(rgb.b) };
};

/**
 * Spectral distribution weighted for **naked-eye visible** stars, deliberately
 * not the true mass function.
 *
 * About 76% of the galaxy's stars are M dwarfs, but they are far too faint to
 * see — a "physically correct" distribution would paint almost the entire field
 * red, which is what the sky does *not* look like. These weights approximate the
 * visible sky, where the hot, luminous classes are over-represented.
 */
export const SPECTRAL_CLASSES: readonly SpectralClass[] = Object.freeze([
  { id: "O/B", kelvin: 15000, weight: 0.1 },
  { id: "A", kelvin: 8500, weight: 0.2 },
  { id: "F", kelvin: 6500, weight: 0.2 },
  { id: "G", kelvin: 5600, weight: 0.2 },
  { id: "K", kelvin: 4300, weight: 0.2 },
  { id: "M", kelvin: 3200, weight: 0.1 },
]);

/**
 * Cumulative weights, rounded at each step so that floating-point drift cannot
 * push a boundary off its exact value (plain accumulation gives
 * `0.1 + 0.2 === 0.30000000000000004`, which would misclassify `rand = 0.3`).
 */
const CUMULATIVE_WEIGHTS: readonly number[] = (() => {
  let acc = 0;
  return SPECTRAL_CLASSES.map((spectralClass) => {
    acc = Math.round((acc + spectralClass.weight) * 1e6) / 1e6;
    return acc;
  });
})();

/**
 * Maps a random number in `[0, 1)` to an index into {@link SPECTRAL_CLASSES}.
 *
 * `rand` is a parameter rather than an internal `Math.random()` call so the
 * class boundaries can be unit-tested exactly.
 */
export const pickSpectralClass = (rand: number): number => {
  const last = SPECTRAL_CLASSES.length - 1;
  if (!Number.isFinite(rand)) return last;

  for (let i = 0; i < CUMULATIVE_WEIGHTS.length; i++) {
    if (rand < CUMULATIVE_WEIGHTS[i]) return i;
  }
  return last;
};

/**
 * Builds the six-entry colour table used by the render loop.
 *
 * Called **once** per starfield instance. Each star stores a reference to one of
 * these six `css` strings, so the draw loop allocates nothing.
 */
export const buildStarColorTable = (saturation: number): readonly StarColor[] =>
  SPECTRAL_CLASSES.map((spectralClass) => {
    const { r, g, b } = desaturateTowardWhite(kelvinToRgb(spectralClass.kelvin), saturation);
    return { r, g, b, css: `rgb(${r}, ${g}, ${b})` };
  });
