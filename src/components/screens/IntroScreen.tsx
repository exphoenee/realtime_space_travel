import React, { useEffect, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
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

  // Viewport-reszponzív scroll animáció: a kezdő- és végpozíciót a viewport-
  // magasság + tartalom alapján számolja, hogy az első blokk mindig a képernyő
  // alatt kezdődjön, az utolsó pedig a képernyő fölött végződjön, a sebesség
  // pedig viewport-mérettől függetlenül állandó maradjon (~3.5 px/s).
  useEffect(() => {
    if (DEBUG_MODE) return; // debug mód saját duration-t használ

    const el = scrollRef.current;
    if (!el || el.scrollHeight < 50) return;

    const vh = window.innerHeight;
    const contentHeight = el.scrollHeight;

    // A .scroll természetes (transzformálatlan) pozíciója a flex center miatt
    // (vh - contentHeight) / 2 pixelre van a viewport tetejétől.
    //
    // Start: az első szövegblokk (headline) a viewport alja alatt legyen.
    // Ehhez a .scroll-t (vh + contentHeight) / 2 + 64px-el kell lenyomni.
    const startOffset = (vh + contentHeight) / 2 + 64;

    // End: az utolsó szövegblokk alja a viewport teteje fölött legyen.
    const endOffset = -(vh + contentHeight) / 2 - 64;

    // Teljes görgetési távolság → duration számítás állandó sebességhez
    const totalDist = startOffset - endOffset;
    const PX_PER_SECOND = 3.5;
    const durationSec = Math.max(120, Math.round(totalDist / PX_PER_SECOND));

    el.style.setProperty("--intro-start", `${startOffset}px`);
    el.style.setProperty("--intro-end", `${endOffset}px`);
    el.style.setProperty("--intro-duration", `${durationSec}s`);
  }, []);

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
            <Trans i18nKey="intro.rule1">
              <strong>Az Éberség Protokollja</strong> – folyamatos vizuális
              monitorozás szükséges a navigációs adatok stabilizálásához. Ha a
              figyelmed megszakad, a hajó vészleállást kezdeményez.
            </Trans>
          </p>

          <p
            className={`${styles.paragraph} ${styles.block}`}
            data-intro-block="true"
          >
            <Trans i18nKey="intro.rule2">
              <strong>A Zéró Beavatkozás Elve</strong> – a rendszerek
              önfenntartóak, a manuális beavatkozás végzetes lehet. A legfontosabb
              képességed a fegyelem és a türelem. Ne cselekedj – felügyelj!
            </Trans>
          </p>

          <p
            className={`${styles.paragraph} ${styles.block}`}
            data-intro-block="true"
          >
            <Trans i18nKey="intro.rule3">
              <strong>Valós Idejű Utazás</strong> – tapasztald meg a csillagközi
              utazás hiteles valóságát. A csillagok évezredek alatt mozdulnak el;
              a legnagyobb ellenség az idő.
            </Trans>
          </p>

          <p
            className={`${styles.paragraph} ${styles.block}`}
            data-intro-block="true"
          >
            <Trans i18nKey="intro.rule4">
              <strong>A tét: Minden.</strong> Nincs dicsőség, nincsenek harcok,
              nincsenek jutalmak – csak a csend, a végtelen kozmosz és a válladra
              nehezedő felelősség. A jövő a te szemedben tükröződik.
            </Trans>
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
