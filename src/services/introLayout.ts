/**
 * Intro crawl geometry and timing — the pure logic behind the deterministic
 * intro layout.
 *
 * No DOM, no canvas, no React. The viewport height enters only where pixels are
 * genuinely needed (the scroll offsets); the reveal schedule is deliberately
 * free of it — see {@link computeRevealSchedule}.
 *
 * Every function is `NaN`-safe. A `NaN` offset would break the CSS animation
 * silently, and a `NaN` reveal time would mean a block that never appears.
 */

import type {
  IntroRevealSchedule,
  IntroScrollGeometry,
  IntroSlot,
  IntroSlotBox,
} from "../types";

const finiteOr = (value: number, fallback: number): number =>
  Number.isFinite(value) ? value : fallback;

/** Resolves the slot table into cumulative positions, in viewport multiples. */
export const computeSlotBoxes = (slots: readonly IntroSlot[]): IntroSlotBox[] => {
  let top = 0;
  return slots.map((slot) => {
    const heightVh = Math.max(0, finiteOr(slot.heightVh, 0));
    const box: IntroSlotBox = { id: slot.id, topVh: top, heightVh };
    top += heightVh;
    return box;
  });
};

/** Total content height, in viewport multiples. */
export const totalContentVh = (slots: readonly IntroSlot[]): number =>
  slots.reduce((sum, slot) => sum + Math.max(0, finiteOr(slot.heightVh, 0)), 0);

export interface ScrollGeometryParams {
  totalVh: number;
  startPadVh: number;
  endPadVh: number;
  viewportHeightPx: number;
  durationSec: number;
  speedMultiplier: number;
}

/**
 * Pixel offsets and duration for the scroll animation.
 *
 * The end offset is always more negative than the content height, because
 * `endPadVh` is positive. That is the guarantee that the last block's bottom
 * edge clears the top of the screen — and therefore that the closing caption
 * becomes reachable. The old implementation had no equivalent: its end offset
 * came from the viewport alone, so whether the crawl finished depended on how
 * long the translated text happened to be.
 */
export const computeScrollGeometry = ({
  totalVh,
  startPadVh,
  endPadVh,
  viewportHeightPx,
  durationSec,
  speedMultiplier,
}: ScrollGeometryParams): IntroScrollGeometry => {
  const vh = Math.max(0, finiteOr(viewportHeightPx, 0));
  const total = Math.max(0, finiteOr(totalVh, 0));
  const startPad = Math.max(0, finiteOr(startPadVh, 0));
  const endPad = Math.max(0, finiteOr(endPadVh, 0));

  const rawMultiplier = finiteOr(speedMultiplier, 1);
  const multiplier = rawMultiplier > 0 ? rawMultiplier : 1;

  const baseDuration = Math.max(0, finiteOr(durationSec, 0));

  const startOffsetPx = startPad * vh;
  const endOffsetPx = -(total + endPad) * vh;

  return {
    startOffsetPx,
    endOffsetPx,
    distancePx: startOffsetPx - endOffsetPx,
    durationSec: baseDuration / multiplier,
  };
};

export interface RevealScheduleParams {
  boxes: readonly IntroSlotBox[];
  totalVh: number;
  startPadVh: number;
  endPadVh: number;
  triggerRatio: number;
  durationSec: number;
  delaySec: number;
  /** Extra pause before the closing caption, after the last block clears. */
  finalInstructionDelaySec: number;
  speedMultiplier: number;
}

/**
 * When each block crosses the reveal line, in milliseconds from mount.
 *
 * **Takes no viewport height, on purpose.** With `D = startPad + total + endPad`
 * as the travel distance in viewports, a block at cumulative offset `a`
 * is revealed at:
 *
 * ```
 * t = delay + duration × (startPad + a − triggerRatio) / D
 * ```
 *
 * Both numerator and denominator are viewport-proportional, so the viewport
 * cancels. The screen size changes the px/s speed and nothing else. If a future
 * change adds a viewport parameter here, that is a sign the layout stopped
 * being proportional — not that the signature was incomplete.
 */
export const computeRevealSchedule = ({
  boxes,
  totalVh,
  startPadVh,
  endPadVh,
  triggerRatio,
  durationSec,
  delaySec,
  finalInstructionDelaySec,
  speedMultiplier,
}: RevealScheduleParams): IntroRevealSchedule => {
  const total = Math.max(0, finiteOr(totalVh, 0));
  const startPad = Math.max(0, finiteOr(startPadVh, 0));
  const endPad = Math.max(0, finiteOr(endPadVh, 0));
  const trigger = finiteOr(triggerRatio, 1);
  const duration = Math.max(0, finiteOr(durationSec, 0));
  const delay = Math.max(0, finiteOr(delaySec, 0));

  const rawMultiplier = finiteOr(speedMultiplier, 1);
  const multiplier = rawMultiplier > 0 ? rawMultiplier : 1;

  const travelVh = startPad + total + endPad;
  // A zero-length crawl has nothing to schedule; returning delay-only times
  // keeps the caller's ordering assumptions intact without dividing by zero.
  const perVhSec = travelVh > 0 ? duration / travelVh : 0;

  const toMs = (seconds: number) => (seconds * 1000) / multiplier;

  const reveals = boxes.map((box) => ({
    id: box.id,
    atMs: toMs(delay + Math.max(0, (startPad + box.topVh - trigger) * perVhSec)),
  }));

  // The caption waits for the *bottom* of the last block to clear the top edge,
  // plus a beat so it doesn't land on the final line still fading out.
  const captionPause = Math.max(0, finiteOr(finalInstructionDelaySec, 0));
  const finalInstructionAtMs = toMs(delay + (startPad + total) * perVhSec + captionPause);

  return {
    reveals,
    finalInstructionAtMs,
    totalMs: toMs(delay + duration),
  };
};

/**
 * Whether the closing caption gets its mandatory reading time before the intro
 * auto-skips.
 *
 * Backed by a unit test against the real constants, so raising the slot heights
 * or the total duration past the auto-skip breaks the build instead of quietly
 * making the caption unreachable — which is exactly how the previous layout
 * failed.
 */
export const assertIntroTimingInvariant = (
  schedule: IntroRevealSchedule,
  autoSkipMs: number,
  marginMs: number,
): boolean => {
  if (!Number.isFinite(schedule.finalInstructionAtMs)) return false;
  return schedule.finalInstructionAtMs + marginMs <= autoSkipMs;
};
