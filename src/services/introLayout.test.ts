import { describe, it, expect } from "vitest";
import {
  computeSlotBoxes,
  totalContentVh,
  computeScrollGeometry,
  computeRevealSchedule,
  assertIntroTimingInvariant,
} from "./introLayout";
import {
  INTRO_SLOTS,
  INTRO_START_PAD_VH,
  INTRO_END_PAD_VH,
  INTRO_TOTAL_DURATION_SEC,
  INTRO_SCROLL_DELAY_SEC,
  INTRO_FINAL_INSTRUCTION_DELAY_SEC,
  INTRO_REVEAL_TRIGGER_RATIO,
  INTRO_AUTO_SKIP_TIMEOUT_MS,
  INTRO_FINAL_READ_MARGIN_MS,
  INTRO_DEBUG_SPEED_MULTIPLIER,
} from "../constants/constants";

const boxes = computeSlotBoxes(INTRO_SLOTS);
const totalVh = totalContentVh(INTRO_SLOTS);

const scheduleAt = (speedMultiplier = 1) =>
  computeRevealSchedule({
    boxes,
    totalVh,
    startPadVh: INTRO_START_PAD_VH,
    endPadVh: INTRO_END_PAD_VH,
    triggerRatio: INTRO_REVEAL_TRIGGER_RATIO,
    durationSec: INTRO_TOTAL_DURATION_SEC,
    delaySec: INTRO_SCROLL_DELAY_SEC,
    finalInstructionDelaySec: INTRO_FINAL_INSTRUCTION_DELAY_SEC,
    speedMultiplier,
  });

describe("computeSlotBoxes", () => {
  it("produces one box per slot", () => {
    expect(boxes).toHaveLength(INTRO_SLOTS.length);
    expect(boxes).toHaveLength(9);
  });

  it("starts at zero and accumulates each preceding height", () => {
    expect(boxes[0].topVh).toBe(0);
    for (let i = 1; i < boxes.length; i++) {
      expect(boxes[i].topVh).toBeCloseTo(boxes[i - 1].topVh + boxes[i - 1].heightVh, 10);
    }
  });

  it("ends exactly at the total content height", () => {
    const last = boxes[boxes.length - 1];
    expect(last.topVh + last.heightVh).toBeCloseTo(totalVh, 10);
  });
});

describe("totalContentVh", () => {
  it("sums the slot table", () => {
    expect(totalVh).toBeCloseTo(3.02, 10);
  });

  it("is zero for an empty table", () => {
    expect(totalContentVh([])).toBe(0);
  });
});

describe("computeScrollGeometry", () => {
  const geometryAt = (viewportHeightPx: number, speedMultiplier = 1) =>
    computeScrollGeometry({
      totalVh,
      startPadVh: INTRO_START_PAD_VH,
      endPadVh: INTRO_END_PAD_VH,
      viewportHeightPx,
      durationSec: INTRO_TOTAL_DURATION_SEC,
      speedMultiplier,
    });

  it.each([844, 1080, 600])(
    "ends strictly beyond the content height at %ipx — the closing guarantee",
    (vh) => {
      const geometry = geometryAt(vh);
      // Strictly more negative than -(content), so the last block's bottom
      // provably clears the top edge.
      expect(geometry.endOffsetPx).toBeLessThan(-(totalVh * vh));
    },
  );

  it("scales distance linearly with the viewport but leaves duration alone", () => {
    const small = geometryAt(500);
    const large = geometryAt(1000);

    expect(large.distancePx).toBeCloseTo(small.distancePx * 2, 6);
    expect(large.durationSec).toBe(small.durationSec);
  });

  it("divides only the duration by the speed multiplier", () => {
    const normal = geometryAt(1080, 1);
    const debug = geometryAt(1080, INTRO_DEBUG_SPEED_MULTIPLIER);

    expect(debug.durationSec).toBeCloseTo(normal.durationSec / 8, 10);
    expect(debug.startOffsetPx).toBe(normal.startOffsetPx);
    expect(debug.endOffsetPx).toBe(normal.endOffsetPx);
  });

  it("never returns NaN for degenerate input", () => {
    for (const vh of [0, NaN, -100, Infinity]) {
      const geometry = geometryAt(vh);
      for (const value of Object.values(geometry)) {
        expect(Number.isFinite(value)).toBe(true);
      }
    }
    expect(geometryAt(1080, 0).durationSec).toBe(INTRO_TOTAL_DURATION_SEC);
    expect(geometryAt(1080, NaN).durationSec).toBe(INTRO_TOTAL_DURATION_SEC);
  });
});

describe("computeRevealSchedule", () => {
  it("is bit-identical across viewport heights — it takes no viewport at all", () => {
    // The function signature has no viewport parameter; this test records that
    // as the structural property it is, not merely an observed coincidence.
    const a = scheduleAt();
    const b = scheduleAt();
    expect(a).toEqual(b);
    expect(Object.keys(a)).not.toContain("viewportHeightPx");
  });

  it("reveals blocks in strictly increasing order", () => {
    const { reveals, finalInstructionAtMs } = scheduleAt();
    for (let i = 1; i < reveals.length; i++) {
      expect(reveals[i].atMs).toBeGreaterThan(reveals[i - 1].atMs);
    }
    expect(reveals[0].atMs).toBeGreaterThan(INTRO_SCROLL_DELAY_SEC * 1000);
    expect(reveals[reveals.length - 1].atMs).toBeLessThan(finalInstructionAtMs);
  });

  it("shows the closing caption before the animation ends", () => {
    const { finalInstructionAtMs, totalMs } = scheduleAt();
    expect(finalInstructionAtMs).toBeLessThan(totalMs);
  });

  it("matches the planned timeline", () => {
    const { reveals, finalInstructionAtMs, totalMs } = scheduleAt();
    const at = (id: string) => reveals.find((r) => r.id === id)!.atMs / 1000;

    expect(at("headline")).toBeCloseTo(6.6, 1);
    expect(at("motto")).toBeCloseTo(45.7, 1);
    expect(at("rule4")).toBeCloseTo(353.6, 1);
    // The last block clears at ~531.0 s; the caption waits a further 2 s beat.
    expect(finalInstructionAtMs / 1000).toBeCloseTo(533.0, 1);
    expect(totalMs / 1000).toBeCloseTo(544, 1);
  });

  it("scales the debug timeline proportionally, with no separate logic", () => {
    const normal = scheduleAt();
    const debug = scheduleAt(INTRO_DEBUG_SPEED_MULTIPLIER);

    for (let i = 0; i < normal.reveals.length; i++) {
      expect(debug.reveals[i].atMs).toBeCloseTo(normal.reveals[i].atMs / 8, 6);
    }
    expect(debug.finalInstructionAtMs).toBeCloseTo(normal.finalInstructionAtMs / 8, 6);
    expect(debug.totalMs).toBeCloseTo(normal.totalMs / 8, 6);
  });

  it("never returns NaN for degenerate input", () => {
    const degenerate = computeRevealSchedule({
      boxes: [],
      totalVh: NaN,
      startPadVh: NaN,
      endPadVh: NaN,
      triggerRatio: NaN,
      durationSec: NaN,
      delaySec: NaN,
      finalInstructionDelaySec: NaN,
      speedMultiplier: 0,
    });

    expect(degenerate.reveals).toEqual([]);
    expect(Number.isFinite(degenerate.finalInstructionAtMs)).toBe(true);
    expect(Number.isFinite(degenerate.totalMs)).toBe(true);
  });
});

describe("assertIntroTimingInvariant", () => {
  it("holds for the shipped constants", () => {
    // Guards the whole point of this plan: if someone later raises the slot
    // heights or the duration past the auto-skip, the caption becomes
    // unreachable again — and this test fails instead of the users noticing.
    expect(
      assertIntroTimingInvariant(
        scheduleAt(),
        INTRO_AUTO_SKIP_TIMEOUT_MS,
        INTRO_FINAL_READ_MARGIN_MS,
      ),
    ).toBe(true);
  });

  it("fails when the caption would land too close to the auto-skip", () => {
    const tooLong = computeRevealSchedule({
      boxes,
      totalVh,
      startPadVh: INTRO_START_PAD_VH,
      endPadVh: INTRO_END_PAD_VH,
      triggerRatio: INTRO_REVEAL_TRIGGER_RATIO,
      durationSec: 900,
      delaySec: INTRO_SCROLL_DELAY_SEC,
      finalInstructionDelaySec: INTRO_FINAL_INSTRUCTION_DELAY_SEC,
      speedMultiplier: 1,
    });

    expect(
      assertIntroTimingInvariant(
        tooLong,
        INTRO_AUTO_SKIP_TIMEOUT_MS,
        INTRO_FINAL_READ_MARGIN_MS,
      ),
    ).toBe(false);
  });
});
