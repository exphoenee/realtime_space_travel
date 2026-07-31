import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { SUPPORTED_LANGUAGES } from "../i18n";
import {
  INTRO_SLOTS,
  INTRO_START_PAD_VH,
  INTRO_END_PAD_VH,
  INTRO_TOTAL_DURATION_SEC,
  INTRO_SCROLL_DELAY_SEC,
  INTRO_FINAL_INSTRUCTION_DELAY_SEC,
  INTRO_REVEAL_TRIGGER_RATIO,
  INTRO_MIN_FONT_SIZE_PX,
  INTRO_MAX_FONT_SIZE_PX,
  INTRO_FIT_PROBE_FONT_SIZE_PX,
  INTRO_FIT_BISECTION_STEPS,
  INTRO_RESIZE_DEBOUNCE_MS,
  INTRO_RESIZE_HEIGHT_THRESHOLD_PX,
} from "../constants/constants";
import {
  computeSlotBoxes,
  totalContentVh,
  computeScrollGeometry,
  computeRevealSchedule,
} from "../services/introLayout";
import {
  estimateFittedFontSize,
  pickLargestFitting,
  bisectionCandidates,
  tallestIndex,
  didFitOverflow,
} from "../services/introFit";
import { probeKey } from "../components/screens/IntroMeasureProbe";
import type {
  IntroFitResult,
  IntroRevealSchedule,
  IntroScrollGeometry,
  IntroSlotBox,
} from "../types";

export interface IntroLayout {
  /** True once fitting is done and the animation may start. */
  ready: boolean;
  /** Whether the hidden probe should still be mounted. */
  measuring: boolean;
  boxes: IntroSlotBox[];
  fontSizes: IntroFitResult | null;
  geometry: IntroScrollGeometry | null;
  schedule: IntroRevealSchedule | null;
  registerNode: (key: string, node: HTMLDivElement | null) => void;
}

/**
 * Sets the probe size the same way the real crawl does — through the custom
 * property, not `font-size`.
 *
 * The block classes each declare their own `font-size: var(--intro-font-size, …)`,
 * which overrides anything inherited from the wrapper. Setting `font-size` here
 * would therefore change nothing, and every probe would measure the `clamp()`
 * fallback height instead.
 */
const measureHeight = (node: HTMLElement, fontSizePx: number): number => {
  node.style.setProperty("--intro-font-size", `${fontSizePx}px`);
  return node.getBoundingClientRect().height;
};

/**
 * Measures every intro block in every language and picks one shared font size
 * per block, then derives the scroll geometry and the reveal schedule.
 *
 * The shared-size rule is what keeps the crawl identical across languages: each
 * block is sized for whichever translation is tallest, so nothing ever
 * overflows and nothing shifts. Shorter languages leave their slack at the
 * bottom of the slot, where it reads as spacing rather than misalignment.
 */
const useIntroLayout = (speedMultiplier: number): IntroLayout => {
  const nodesRef = useRef(new Map<string, HTMLDivElement>());
  const boxesRef = useRef(computeSlotBoxes(INTRO_SLOTS));
  const lastViewportRef = useRef({ width: 0, height: 0 });

  const [fontSizes, setFontSizes] = useState<IntroFitResult | null>(null);
  const [geometry, setGeometry] = useState<IntroScrollGeometry | null>(null);
  const [schedule, setSchedule] = useState<IntroRevealSchedule | null>(null);
  const [measuring, setMeasuring] = useState(true);

  const registerNode = useCallback((key: string, node: HTMLDivElement | null) => {
    if (node) nodesRef.current.set(key, node);
    else nodesRef.current.delete(key);
  }, []);

  const runFit = useCallback(() => {
    const nodes = nodesRef.current;
    if (nodes.size === 0) return;

    const viewportHeight = window.innerHeight;
    const result = {} as IntroFitResult;

    for (const slot of INTRO_SLOTS) {
      const targetHeightPx = slot.heightVh * viewportHeight;
      // Per-block bounds carry the typographic hierarchy; the global constants
      // are only an outer safety net.
      const minPx = Math.max(INTRO_MIN_FONT_SIZE_PX, slot.minFontPx);
      const maxPx = Math.min(INTRO_MAX_FONT_SIZE_PX, slot.maxFontPx);
      const langNodes = SUPPORTED_LANGUAGES.map((lng) =>
        nodes.get(probeKey(slot.id, lng)),
      ).filter((node): node is HTMLDivElement => Boolean(node));

      if (langNodes.length === 0) {
        result[slot.id] = maxPx;
        continue;
      }

      // Pass 1 — measure every language at the probe size and find the tallest.
      // Probing at the block's own maximum keeps the linear estimate inside the
      // range it will actually be clamped to.
      const probeSize = Math.min(maxPx, Math.max(minPx, INTRO_FIT_PROBE_FONT_SIZE_PX));
      const probeHeights = langNodes.map((node) => measureHeight(node, probeSize));
      const tallest = tallestIndex(probeHeights);
      const tallestNode = langNodes[tallest === -1 ? 0 : tallest];

      // Pass 2 — refine on the tallest language only. The linear estimate is a
      // starting point; line breaking is discrete, so it can land either side.
      const estimate = estimateFittedFontSize({
        probeFontSizePx: probeSize,
        measuredHeightPx: probeHeights[tallest === -1 ? 0 : tallest],
        targetHeightPx,
        minPx,
        maxPx,
      });

      const candidates = [
        estimate,
        ...bisectionCandidates(minPx, estimate, INTRO_FIT_BISECTION_STEPS),
      ];
      const samples = candidates.map((fontSizePx) => ({
        fontSizePx,
        heightPx: measureHeight(tallestNode, fontSizePx),
      }));

      let fitted = pickLargestFitting(samples, targetHeightPx, INTRO_MIN_FONT_SIZE_PX);

      // Pass 3 — verify against *all* languages at the chosen size. The tallest
      // language at the probe size is not necessarily the tallest at the final
      // size, because the line breaks move.
      const verified = langNodes.map((node) => measureHeight(node, fitted));
      if (verified.some((height) => height > targetHeightPx)) {
        const stepped = samples
          .map((sample) => sample.fontSizePx)
          .filter((size) => size < fitted)
          .sort((a, b) => b - a)[0];
        fitted = stepped ?? INTRO_MIN_FONT_SIZE_PX;
      }

      if (didFitOverflow(fitted, INTRO_MIN_FONT_SIZE_PX)) {
        console.warn(
          `[intro] "${slot.id}" hit the minimum font size — its slot (${slot.heightVh} vh) is too small for the longest translation.`,
        );
      }

      result[slot.id] = fitted;
    }

    const totalVh = totalContentVh(INTRO_SLOTS);

    setFontSizes(result);
    setGeometry(
      computeScrollGeometry({
        totalVh,
        startPadVh: INTRO_START_PAD_VH,
        endPadVh: INTRO_END_PAD_VH,
        viewportHeightPx: viewportHeight,
        durationSec: INTRO_TOTAL_DURATION_SEC,
        speedMultiplier,
      }),
    );
    setSchedule(
      computeRevealSchedule({
        boxes: boxesRef.current,
        totalVh,
        startPadVh: INTRO_START_PAD_VH,
        endPadVh: INTRO_END_PAD_VH,
        triggerRatio: INTRO_REVEAL_TRIGGER_RATIO,
        durationSec: INTRO_TOTAL_DURATION_SEC,
        delaySec: INTRO_SCROLL_DELAY_SEC,
        finalInstructionDelaySec: INTRO_FINAL_INSTRUCTION_DELAY_SEC,
        speedMultiplier,
      }),
    );

    lastViewportRef.current = { width: window.innerWidth, height: window.innerHeight };
    setMeasuring(false);
  }, [speedMultiplier]);

  useLayoutEffect(() => {
    let cancelled = false;

    const start = () => {
      if (!cancelled) runFit();
    };

    // Measuring before the webfonts land would size everything against fallback
    // metrics — every block would be wrong, and consistently so, which makes it
    // hard to spot.
    if (typeof document !== "undefined" && document.fonts?.ready) {
      document.fonts.ready.then(start).catch(start);
    } else {
      start();
    }

    return () => {
      cancelled = true;
    };
  }, [runFit]);

  useEffect(() => {
    let timeout: number | undefined;

    const handleResize = () => {
      const { width, height } = lastViewportRef.current;
      const widthChanged = window.innerWidth !== width;
      const heightDelta = Math.abs(window.innerHeight - height);

      // Mobile browsers fire resize as the URL bar slides away. Re-fitting the
      // whole crawl for that would be wasteful and visibly jumpy, so only a
      // real height change counts — width always does.
      if (!widthChanged && heightDelta < INTRO_RESIZE_HEIGHT_THRESHOLD_PX) return;

      window.clearTimeout(timeout);
      timeout = window.setTimeout(() => {
        setMeasuring(true);
      }, INTRO_RESIZE_DEBOUNCE_MS);
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // A re-measure pass needs the probe mounted again before it can measure.
  useLayoutEffect(() => {
    if (measuring && fontSizes !== null) runFit();
  }, [measuring, fontSizes, runFit]);

  return {
    ready: fontSizes !== null && geometry !== null && schedule !== null && !measuring,
    measuring,
    boxes: boxesRef.current,
    fontSizes,
    geometry,
    schedule,
    registerNode,
  };
};

export default useIntroLayout;
