import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "../ui/LanguageSwitcher";
import IntroBlockContent from "./IntroBlockContent";
import IntroMeasureProbe from "./IntroMeasureProbe";
import useIntroLayout from "../../hooks/useIntroLayout";
import {
  INTRO_SLOTS,
  INTRO_SCHEDULE_TICK_MS,
  INTRO_SCROLL_DELAY_SEC,
  INTRO_DEBUG_SPEED_MULTIPLIER,
} from "../../constants/constants";
import type { IntroBlockId } from "../../types";
import styles from "./IntroScreen.module.css";

interface IntroScreenProps {
  onSkip: () => void;
}

const DEBUG_MODE = import.meta.env.VITE_DEBUG_MODE === "true";

/**
 * The opening crawl.
 *
 * Layout is deterministic by construction: every block occupies a fixed,
 * viewport-proportional slot, and each block's font size is fitted to whichever
 * of the five translations is tallest. Positions, type size and timing are
 * therefore identical in every language and on every screen — the text adapts
 * to the layout rather than the layout to the text.
 *
 * Reveals run off a precomputed schedule instead of polling geometry every
 * frame. Because the slots are proportional and the duration is fixed, the
 * schedule is a viewport-independent constant, so there is nothing to measure
 * per frame.
 */
const IntroScreen: React.FC<IntroScreenProps> = ({ onSkip }) => {
  const { t } = useTranslation();
  const speedMultiplier = DEBUG_MODE ? INTRO_DEBUG_SPEED_MULTIPLIER : 1;

  const { ready, measuring, boxes, fontSizes, geometry, schedule, registerNode } =
    useIntroLayout(speedMultiplier);

  const [revealed, setRevealed] = useState<ReadonlySet<IntroBlockId>>(new Set());
  const [instructionsVisible, setInstructionsVisible] = useState(false);
  const lastBlockRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ready || !schedule) return;

    // The clock starts when the animation does, not when the component mounts —
    // measuring happens first and takes a variable amount of time.
    const baseline = performance.now();

    const tick = () => {
      const elapsed = performance.now() - baseline;

      // Reveal everything already due rather than one block per tick, so a
      // throttled background tab catches up instead of falling behind.
      const due = schedule.reveals
        .filter((reveal) => reveal.atMs <= elapsed)
        .map((reveal) => reveal.id);

      if (due.length > 0) {
        setRevealed((previous) => {
          if (due.every((id) => previous.has(id))) return previous;
          return new Set([...previous, ...due]);
        });
      }
    };

    const interval = window.setInterval(tick, INTRO_SCHEDULE_TICK_MS);
    tick();

    return () => window.clearInterval(interval);
  }, [ready, schedule]);

  // Show the final instruction only after the last block has scrolled past the
  // top of the viewport.  The scroll animation moves .scroll upward via
  // translateY, so once the last block's bottom leaves the viewport, the
  // instruction (placed after it in the DOM) is the next thing to enter view.
  useEffect(() => {
    if (!ready) return;
    const node = lastBlockRef.current;
    if (!node) return;

    let wasVisible = false;
    let shown = false;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          wasVisible = true;
        } else if (wasVisible && !shown) {
          // Block was visible and has now scrolled past the top.
          shown = true;
          setInstructionsVisible(true);
        }
      },
      { threshold: 0 },
    );
    observer.observe(node);

    return () => observer.disconnect();
  }, [ready]);

  const scrollStyle = geometry
    ? ({
        "--intro-start": `${geometry.startOffsetPx}px`,
        "--intro-end": `${geometry.endOffsetPx}px`,
        "--intro-duration": `${geometry.durationSec}s`,
        "--intro-delay": `${INTRO_SCROLL_DELAY_SEC / speedMultiplier}s`,
      } as React.CSSProperties)
    : undefined;

  return (
    <div className={styles.overlay} onClick={onSkip}>
      {measuring && <IntroMeasureProbe registerNode={registerNode} />}

      {/* Language switcher — top-right corner, so the user can read
          the intro in their preferred language before proceeding. */}
      <div
        className={styles.langBar}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        <span className={styles.langLabel}>{t("language.label")}</span>
        <LanguageSwitcher />
      </div>

      <div className={`${styles.content} ${styles.fade}`}>
        <div
          className={styles.scroll}
          data-ready={ready ? "true" : "false"}
          style={scrollStyle}
        >          {INTRO_SLOTS.map((slot, index) => (
            <div
              key={slot.id}
              ref={index === INTRO_SLOTS.length - 1 ? lastBlockRef : undefined}
              className={`${styles.slot} ${styles.block} ${
                revealed.has(slot.id) ? styles.blockVisible : ""
              }`}
              data-intro-block-id={slot.id}
              style=
                {
                  {
                    "--intro-slot-height": `${boxes[index].heightVh * 100}vh`,
                    ...(fontSizes ? { "--intro-font-size": `${fontSizes[slot.id]}px` } : {}),
                  } as React.CSSProperties
                }
            >
              <IntroBlockContent id={slot.id} t={t} />
            </div>
          ))}
        </div>

        {/* Outside .scroll on purpose: inside it the caption would keep moving
            with the crawl and end up just above the top edge, unreadable. */}
        {instructionsVisible && (
          <div className={styles.finalInstruction}>{t("intro.continue")}</div>
        )}
      </div>
    </div>
  );
};

export default IntroScreen;
