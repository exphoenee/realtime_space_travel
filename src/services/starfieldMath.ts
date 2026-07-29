/**
 * Starfield maths — the pure decision logic behind the canvas render loop.
 *
 * Everything here is framework- and canvas-free so it can be unit-tested; the
 * functions that need randomness take it as a parameter rather than calling
 * `Math.random()` internally.
 *
 * Every function is `NaN`-safe. This is not defensive decoration: a `NaN` delta
 * turns every star's `z` into `NaN`, and because `NaN <= 0` is false the reset
 * branch never fires — the field would disappear permanently. A `NaN` angle
 * passed to `ctx.rotate` has the same effect.
 */

import {
  STAR_MAG_EXPONENT,
  STAR_MAX_DELTA_FRAMES,
  TARGET_FRAME_MS,
} from "../constants/constants";

/**
 * Per-star brightness from a uniform random number, via a power law.
 *
 * The uniform `[0, 1)` draw is pulled toward 0, so values near 1 (bright stars)
 * are rare — a few dominant stars over a lot of faint ones, like the real sky.
 */
export const magnitudeFromRandom = (rand: number): number => {
  if (!Number.isFinite(rand)) return 0;
  const clamped = Math.min(1, Math.max(0, rand));
  return Math.pow(clamped, STAR_MAG_EXPONENT);
};

/**
 * Energy-preserving alpha correction for stars clamped to the minimum radius.
 *
 * A disc's area — and so the light it emits — scales with the square of its
 * radius. When the radius is floored, scaling alpha by `(raw / min)²` keeps the
 * blob's total energy identical to the un-clamped one, but at a stable position
 * and a stable intensity.
 *
 * Returns `1` at or above the threshold (no correction needed).
 */
export const subpixelAlphaScale = (rawRadius: number, minRadius: number): number => {
  if (!Number.isFinite(rawRadius) || !Number.isFinite(minRadius) || minRadius <= 0) return 1;
  if (rawRadius >= minRadius) return 1;
  if (rawRadius <= 0) return 0;

  const ratio = rawRadius / minRadius;
  return ratio * ratio;
};

/**
 * Elapsed milliseconds → frame count normalised to 60 FPS.
 *
 * Returns `1` for non-positive or non-finite input, which also covers the very
 * first frame (no previous timestamp) — so the caller needs no special case.
 * The result is capped at `maxFrames` to absorb tab switches.
 */
export const deltaFrames = (
  elapsedMs: number,
  maxFrames: number = STAR_MAX_DELTA_FRAMES,
): number => {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return 1;
  return Math.min(elapsedMs / TARGET_FRAME_MS, maxFrames);
};

/**
 * Delta-normalises a per-frame exponential smoothing factor.
 *
 * Exponential smoothing removes a fraction of the *remaining* distance each
 * frame, so two frames of 8% is not 16% but `1 - 0.92² = 15.36%`. Hence
 * `1 - (1 - base) ** frames` and not `base * frames` — the linear form would not
 * just be inaccurate, it would exceed 1 above ~12.5 frames and make the drift
 * oscillate. The exponential form stays in `[0, 1)` for any frame count.
 *
 * At `frames === 1` it returns `base` exactly, which is the regression anchor
 * proving the drift is bit-for-bit unchanged at 60 Hz.
 */
export const frameRateAdjustedLerp = (base: number, frames: number): number => {
  if (!Number.isFinite(base)) return 0;
  const safeBase = Math.min(1, Math.max(0, base));

  // Negative or non-finite frame counts are meaningless — fall back to the
  // unadjusted factor rather than inventing a value.
  if (!Number.isFinite(frames) || frames < 0) return safeBase;

  const safeFrames = Math.min(STAR_MAX_DELTA_FRAMES, frames);

  // Exact, not merely close: `1 - (1 - 0.08)` evaluates to 0.07999999999999996
  // in floating point, which would break the 60 Hz regression test.
  if (safeFrames === 1) return safeBase;

  return 1 - Math.pow(1 - safeBase, safeFrames);
};

/**
 * Random roll angle for an evasive manoeuvre, in **radians** (`ctx.rotate` wants
 * radians, so no conversion happens in the hot loop).
 *
 * Maps `rand ∈ [0, 1]` symmetrically onto `[-maxDegrees, +maxDegrees]`: `0` and
 * `1` hit the extremes, `0.5` is exactly zero. The direction is independent of
 * the drift direction on purpose — see the plan's section 8.5.
 */
export const randomRollRadians = (rand: number, maxDegrees: number): number => {
  if (!Number.isFinite(rand) || !Number.isFinite(maxDegrees)) return 0;
  const clamped = Math.min(1, Math.max(0, rand));
  return (clamped - 0.5) * 2 * maxDegrees * (Math.PI / 180);
};

/**
 * Star stretch factor from ship speed — controls the warp-streak effect.
 *
 * - ≤ 250 km/s → 1.0× (dots, no stretch)
 * -   500 km/s → 1.5×
 * - ≥ 1000 km/s → 2.0×
 *
 * Linear interpolation in between. Moved here from `Starfield.tsx` unchanged.
 */
export const getStretchFactor = (speedKmPerSecond: number): number => {
  if (speedKmPerSecond <= 250) return 1.0;
  if (speedKmPerSecond >= 1000) return 2.0;
  return 1.0 + (speedKmPerSecond - 250) / 750;
};
