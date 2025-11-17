import React, { useEffect, useRef, useState } from "react";
import styles from "./IntroScreen.module.css";

interface IntroScreenProps {
  onSkip: () => void;
}

const DEBUG_MODE = import.meta.env.VITE_DEBUG_MODE === "true";

const IntroScreen: React.FC<IntroScreenProps> = ({ onSkip }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [instructionsVisible, setInstructionsVisible] = useState(false);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;

    const blocks = Array.from(
      root.querySelectorAll<HTMLElement>('[data-intro-block="true"]'),
    );

    const revealed = new Set<HTMLElement>();
    let rafId: number;

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
      }

      rafId = window.requestAnimationFrame(checkBlocks);
    };

    rafId = window.requestAnimationFrame(checkBlocks);

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
                  ["--intro-scroll-duration" as string]: "60s",
                } as React.CSSProperties)
              : undefined
          }
        >
          <div
            className={styles.block}
            data-intro-block="true"
            data-timed-block="true"
          >
            <h1 className={styles.headline}>Realtime Space Travel</h1>
          </div>

          <div
            className={styles.block}
            data-intro-block="true"
            data-timed-block="true"
          >
            <p className={styles.motto}>Az életedre szóló élmény!</p>
          </div>

          <p
            className={`${styles.paragraph} ${styles.block}`}
            data-intro-block="true"
            data-timed-block="true"
          >
            Te vagy a kiválaszott! Te vagy az Emberiség utolsó és egyetlen
            reménye. Ez nem egy játék, a túlélésünk a tét. Ez az utolsó
            esélyünk: egy új otthon ígérete távoli csillagrendszerekben. A
            bárka, amely az emberiség jövőjét hordozza, indulásra kész.
          </p>

          <p
            className={`${styles.paragraph} ${styles.block}`}
            data-intro-block="true"
          >
            A teljes legénység – tudósok, mérnökök, az új civilizáció alapítói –
            mély, kriogén álomba merült. A sorsuk, az álmaik, a jövőnk... Az
            emberiség sorsa most a te kezedben van. Te vagy az az élő, lélegző
            komponens, amelyet semmilyen mesterséges intelligencia nem pótolhat.
          </p>

          <p
            className={`${styles.sectionTitle} ${styles.block}`}
            data-intro-block="true"
          >
            A Feladataid – A Küldetés Legszigorúbb Protokolljai
          </p>

          <p
            className={`${styles.paragraph} ${styles.block}`}
            data-intro-block="true"
          >
            <strong>Az Éberség Protokollja</strong> – folyamatos vizuális
            monitorozás szükséges a navigációs adatok stabilizálásához. Ha a
            figyelmed megszakad, a hajó vészleállást kezdeményez.
          </p>

          <p
            className={`${styles.paragraph} ${styles.block}`}
            data-intro-block="true"
          >
            <strong>A Zéró Beavatkozás Elve</strong> – a rendszerek
            önfenntartóak, a manuális beavatkozás végzetes lehet. A legfontosabb
            képességed a fegyelem és a türelem. Ne cselekedj – felügyelj!
          </p>

          <p
            className={`${styles.paragraph} ${styles.block}`}
            data-intro-block="true"
          >
            <strong>Valós Idejű Utazás</strong> – tapasztald meg a csillagközi
            utazás hiteles valóságát. A csillagok évezredek alatt mozdulnak el;
            a legnagyobb ellenség az idő.
          </p>

          <p
            className={`${styles.paragraph} ${styles.block}`}
            data-intro-block="true"
          >
            <strong>A tét: Minden.</strong> Nincs dicsőség, nincsenek harcok,
            nincsenek jutalmak – csak a csend, a végtelen kozmosz és a válladra
            nehezedő felelősség. A jövő a te szemedben tükröződik.
          </p>
        </div>
        {instructionsVisible && (
          <div className={styles.finalInstruction}>
            Kattints vagy nyomj meg bármilyen gombot a folytatáshoz.
          </div>
        )}
      </div>
    </div>
  );
};

export default IntroScreen;
