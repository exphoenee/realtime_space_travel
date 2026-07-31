import React from "react";
import i18n, { SUPPORTED_LANGUAGES } from "../../i18n";
import { INTRO_SLOTS } from "../../constants/constants";
import IntroBlockContent from "./IntroBlockContent";
import styles from "./IntroScreen.module.css";

/** Key under which a probe node is registered: one per block per language. */
export const probeKey = (blockId: string, lng: string): string => `${blockId}:${lng}`;

interface IntroMeasureProbeProps {
  /** Called with each rendered node so the hook can measure it directly. */
  registerNode: (key: string, node: HTMLDivElement | null) => void;
}

/**
 * Off-screen measurement probe: every intro block rendered in all five
 * languages, so the fitting pass can size each block for whichever translation
 * turns out to be tallest.
 *
 * The outer wrapper reproduces the real overlay's padding and the inner element
 * reuses the real `.content` class, so the text column is exactly as wide as it
 * will be on screen. Measuring at any other width would size the type for a
 * column that does not exist.
 *
 * Hidden with `visibility: hidden` rather than `display: none` — a
 * `display: none` subtree has no layout at all and would measure as zero.
 */
const IntroMeasureProbe: React.FC<IntroMeasureProbeProps> = ({ registerNode }) => (
  <div
    aria-hidden="true"
    {...({ inert: "" } as Record<string, string>)}
    style={{
      position: "fixed",
      inset: 0,
      padding: "0 1.5rem",
      visibility: "hidden",
      pointerEvents: "none",
      overflow: "hidden",
      zIndex: -1,
    }}
  >
    <div className={styles.content}>
      {INTRO_SLOTS.map((slot) =>
        SUPPORTED_LANGUAGES.map((lng) => (
          <div
            key={probeKey(slot.id, lng)}
            ref={(node) => registerNode(probeKey(slot.id, lng), node)}
            /* Must match .slot's formatting context. A plain block container
               would let the child's margin-top collapse out of it, so the
               measured height would miss the 1.6-2rem lead that the real flex
               slot does include — and every block would be fitted too large. */
            style={{ display: "flex", flexDirection: "column" }}
          >
            <IntroBlockContent id={slot.id} t={i18n.getFixedT(lng)} />
          </div>
        )),
      )}
    </div>
  </div>
);

export default IntroMeasureProbe;
