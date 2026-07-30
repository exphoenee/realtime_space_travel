import React, { useCallback, useEffect, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import LanguageSwitcher from "../ui/LanguageSwitcher";
import styles from "./IntroScreen.module.css";

interface IntroScreenProps {
  onSkip: () => void;
}

const DEBUG_MODE = import.meta.env.VITE_DEBUG_MODE === "true";
const INTRO_SCROLL_DURATION = "210s";

const IntroScreen: React.FC<IntroScreenProps> = ({ onSkip }) => {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [instructionsVisible, setInstructionsVisible] = useState(false);

  // Viewport-reszponzív scroll animáció: a kezdő- és végpozíciót kizárólag
  // a viewport magassága alapján számolja, hogy a szövegek minden nyelven
  // ugyanott jelenjenek meg, és nyelv váltáskor ne ugorjanak.
  //
  // A tartalom magasságát (contentHeight) NEM használjuk, mert az nyelvenként
  // eltérő hosszúságú szövegek miatt változó pozíciókat és ugrálást okozna.
  // Viewport-only számolás: konstans sebesség (~3.5 px/s).
  const updateScrollPositions = useCallback(() => {
    if (DEBUG_MODE) return;

    const el = scrollRef.current;
    if (!el) return;

    const vh = window.innerHeight;
    const PADDING = 100;

    // Start: a tartalom egy viewport-nyival + paddinggel a képernyő alatt
    // kezdődjön, így az első blokk mindig lentről úszik be.
    const startOffset = vh + PADDING;
    // End: a tartalom egy viewport-nyival + paddinggel a képernyő fölött
    // végződjön, hogy az utolsó blokk is eltűnjön felfelé.
    const endOffset = -(vh + PADDING);

    // Teljes görgetési távolság → duration számítás állandó sebességhez
    const totalDist = startOffset - endOffset;
    const PX_PER_SECOND = 3.5;
    const durationSec = Math.max(120, Math.round(totalDist / PX_PER_SECOND));

    el.style.setProperty("--intro-start", `${startOffset}px`);
    el.style.setProperty("--intro-end", `${endOffset}px`);
    el.style.setProperty("--intro-duration", `${durationSec}s`);
  }, []);

  useEffect(() => {
    updateScrollPositions();

    window.addEventListener("resize", updateScrollPositions);
    return () => window.removeEventListener("resize", updateScrollPositions);
  }, [updateScrollPositions]);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;

    const blocks = Array.from(
      root.querySelectorAll<HTMLElement>('[data-intro-block="true"]'),
    );

    const revealed = new Set<HTMLElement>();

    const revealBlock = (block: HTMLElement) => {
      if (revealed.has(block)) return;
      block.classList.add(styles.blockVisible);
      revealed.add(block);
    };

    const checkBlocks = () => {
      const triggerY = (window.innerHeight / 3) * 2;
      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        if (revealed.has(block)) {
          continue;
        }

        if (i > 0 && !revealed.has(blocks[i - 1])) {
          break;
        }

        const rect = block.getBoundingClientRect();
        if (rect.top <= triggerY) {
          revealBlock(block);
        }
        break;
      }

      const lastBlock = blocks[blocks.length - 1];
      if (
        lastBlock &&
        revealed.has(lastBlock) &&
        lastBlock.getBoundingClientRect().bottom <= 0
      ) {
        setInstructionsVisible(true);
        return;
      }
    };

    // A háttér-szöveg CSS transform-animációval mozog, ami nem vált ki scroll
    // eseményt, ezért requestAnimationFrame-mel pollozzuk a blokkok pozícióját,
    // és úgy fedjük fel őket, ahogy a kioldási vonal fölé érnek.
    let rafId = 0;
    const tick = () => {
      checkBlocks();
      rafId = window.requestAnimationFrame(tick);
    };
    rafId = window.requestAnimationFrame(tick);

    return () => window.cancelAnimationFrame(rafId);
  }, []);

  return (
    <div className={styles.overlay} onClick={onSkip}>
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
          ref={scrollRef}
          className={styles.scroll}
          style={
            DEBUG_MODE
              ? ({
                  ["--intro-duration" as string]: INTRO_SCROLL_DURATION,
                } as React.CSSProperties)
              : undefined
          }
        >
          <div
            className={styles.block}
            data-intro-block="true"
            data-timed-block="true"
          >
            <h1 className={styles.headline}>{t("intro.headline")}</h1>
          </div>

          <div
            className={styles.block}
            data-intro-block="true"
            data-timed-block="true"
          >
            <p className={styles.motto}>{t("intro.motto")}</p>
          </div>

          <p
            className={`${styles.paragraph} ${styles.block}`}
            data-intro-block="true"
            data-timed-block="true"
          >
            {t("intro.paragraph1")}
          </p>

          <p
            className={`${styles.paragraph} ${styles.block}`}
            data-intro-block="true"
          >
            {t("intro.paragraph2")}
          </p>

          <p
            className={`${styles.sectionTitle} ${styles.block}`}
            data-intro-block="true"
          >
            {t("intro.sectionTitle")}
          </p>

          <p
            className={`${styles.paragraph} ${styles.block}`}
            data-intro-block="true"
          >
            <Trans
              i18nKey="intro.rule1"
              components={{ 1: <strong key="s1" /> }}
            />
          </p>

          <p
            className={`${styles.paragraph} ${styles.block}`}
            data-intro-block="true"
          >
            <Trans
              i18nKey="intro.rule2"
              components={{ 1: <strong key="s2" /> }}
            />
          </p>

          <p
            className={`${styles.paragraph} ${styles.block}`}
            data-intro-block="true"
          >
            <Trans
              i18nKey="intro.rule3"
              components={{ 1: <strong key="s3" /> }}
            />
          </p>

          <p
            className={`${styles.paragraph} ${styles.block}`}
            data-intro-block="true"
          >
            <Trans
              i18nKey="intro.rule4"
              components={{ 1: <strong key="s4" /> }}
            />
          </p>
        </div>
        {instructionsVisible && (
          <div className={styles.finalInstruction}>
            {t("intro.continue")}
          </div>
        )}
      </div>
    </div>
  );
};

export default IntroScreen;
