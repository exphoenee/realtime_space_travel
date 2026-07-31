/**
 * Font-size fitting for the intro crawl.
 *
 * The intro uses one font size per block, shared by all five languages and
 * chosen so the *longest* language still fits its slot. That is what keeps both
 * the positions and the type size identical everywhere; shorter languages
 * simply leave more slack at the bottom of their slot.
 *
 * None of these functions touch the DOM. Measured heights come in as
 * parameters, which is what makes the whole fitting policy testable under jsdom
 * where there is no real layout.
 */

const finiteOr = (value: number, fallback: number): number =>
  Number.isFinite(value) ? value : fallback;

export interface FitEstimateParams {
  probeFontSizePx: number;
  measuredHeightPx: number;
  targetHeightPx: number;
  minPx: number;
  maxPx: number;
}

/**
 * First guess at the font size that makes `measuredHeightPx` become
 * `targetHeightPx`, assuming height scales linearly with font size.
 *
 * The assumption is only approximately true — line breaking is discrete — so
 * this is a starting point for bisection, not an answer.
 */
export const estimateFittedFontSize = ({
  probeFontSizePx,
  measuredHeightPx,
  targetHeightPx,
  minPx,
  maxPx,
}: FitEstimateParams): number => {
  const probe = finiteOr(probeFontSizePx, 0);
  const measured = finiteOr(measuredHeightPx, 0);
  const target = finiteOr(targetHeightPx, 0);

  if (measured <= 0 || probe <= 0 || target <= 0) return probe;

  const low = finiteOr(minPx, probe);
  const high = finiteOr(maxPx, probe);

  const estimate = (probe * target) / measured;
  return Math.min(high, Math.max(low, estimate));
};

export interface FitSample {
  fontSizePx: number;
  heightPx: number;
}

/**
 * The largest sampled font size whose measured height still fits the slot.
 *
 * Falls back to `minPx` when nothing fits — the caller can detect that with
 * {@link didFitOverflow} and treat it as a signal that the slot table needs
 * tuning, rather than shipping text that silently overflows.
 */
export const pickLargestFitting = (
  samples: readonly FitSample[],
  targetHeightPx: number,
  minPx: number,
): number => {
  const target = finiteOr(targetHeightPx, 0);
  const floor = finiteOr(minPx, 0);

  let best = Number.NEGATIVE_INFINITY;
  for (const sample of samples) {
    const size = finiteOr(sample.fontSizePx, Number.NaN);
    const height = finiteOr(sample.heightPx, Number.NaN);
    if (!Number.isFinite(size) || !Number.isFinite(height)) continue;
    if (height <= target && size > best) best = size;
  }

  return Number.isFinite(best) ? best : floor;
};

/**
 * Candidate font sizes for the bisection refinement, from the midpoint inward.
 *
 * Measuring is the caller's job — this only decides where to probe, so the
 * search policy stays testable without a layout engine.
 */
export const bisectionCandidates = (
  lowPx: number,
  highPx: number,
  steps: number,
): number[] => {
  let low = finiteOr(lowPx, 0);
  let high = finiteOr(highPx, 0);
  if (high < low) [low, high] = [high, low];

  const count = Math.max(0, Math.floor(finiteOr(steps, 0)));
  const candidates: number[] = [];

  for (let i = 0; i < count; i++) {
    const mid = (low + high) / 2;
    candidates.push(mid);
    // Walk toward the upper half: we want the largest size that still fits, so
    // the interesting region is above each midpoint we accept.
    low = mid;
  }

  return candidates;
};

/**
 * Index of the tallest measurement — i.e. which language needs the most room.
 *
 * Ties resolve to the lowest index so the choice is deterministic across runs.
 * Returns `-1` for an empty or entirely non-finite input.
 */
export const tallestIndex = (heights: readonly number[]): number => {
  let bestIndex = -1;
  let bestHeight = Number.NEGATIVE_INFINITY;

  for (let i = 0; i < heights.length; i++) {
    const height = heights[i];
    if (!Number.isFinite(height)) continue;
    if (height > bestHeight) {
      bestHeight = height;
      bestIndex = i;
    }
  }

  return bestIndex;
};

/**
 * Whether fitting bottomed out at the minimum size, meaning the text may still
 * overflow its slot. A developer-facing warning signal, not a runtime error.
 */
export const didFitOverflow = (fittedPx: number, minPx: number): boolean =>
  finiteOr(fittedPx, 0) <= finiteOr(minPx, 0);
