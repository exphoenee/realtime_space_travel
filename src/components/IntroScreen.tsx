import React, { useEffect, useRef } from "react";
import styles from "./IntroScreen.module.css";

interface IntroScreenProps {
  onSkip: () => void;
}

const IntroScreen: React.FC<IntroScreenProps> = ({ onSkip }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;

    const blocks = Array.from(
      root.querySelectorAll<HTMLElement>('[data-intro-block="true"]'),
    );

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add(styles.blockVisible);
            observer.unobserve(entry.target);
          }
        });
      },
      { root: null, rootMargin: "0px 0px -20% 0px", threshold: 0 },
    );

    const computeDelaySeconds = (index: number) => {
      if (index === 0) return 0;
      if (index === 1) return 6;
      if (index === 2) return 12;
      return index + 5;
    };

    blocks.forEach((block, index) => {
      block.style.setProperty(
        "--intro-block-delay",
        `${computeDelaySeconds(index)}s`,
      );
      observer.observe(block);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div className={styles.overlay} onClick={onSkip}>
      <div className={`${styles.content} ${styles.fade}`}>
        <div ref={scrollRef} className={styles.scroll}>
          <div className={styles.block} data-intro-block="true">
            <h1 className={styles.headline}>Realtime Space Travel</h1>
          </div>

          <div className={styles.block} data-intro-block="true">
            <p className={styles.motto}>Az életedre szóló élmény!</p>
          </div>

          <p className={`${styles.paragraph} ${styles.block}`} data-intro-block="true">
            Te vagy a kiválaszott! Te vagy az Emberiség utolsó és egyetlen reménye. Ez nem egy játék, a
            túlélésünk a tét. Ez az utolsó esélyünk: egy új otthon ígérete távoli csillagrendszerekben. A
            bárka, amely az emberiség jövőjét hordozza, indulásra kész.
          </p>

          <p className={`${styles.paragraph} ${styles.block}`} data-intro-block="true">
            A teljes legénység – tudósok, mérnökök, az új civilizáció alapítói – mély, kriogén álomba
            merült. A sorsuk, az álmaik, a jövőnk... Az emberiség sorsa most a te kezedben van. Te vagy az
            az élő, lélegző komponens, amelyet semmilyen mesterséges intelligencia nem pótolhat.
          </p>

          <p className={`${styles.sectionTitle} ${styles.block}`} data-intro-block="true">
            A Feladataid – A Küldetés Legszigorúbb Protokolljai
          </p>

          <p className={`${styles.paragraph} ${styles.block}`} data-intro-block="true">
            <strong>Az Éberség Protokollja</strong> – folyamatos vizuális monitorozás szükséges a
            navigációs adatok stabilizálásához. Ha a figyelmed megszakad, a hajó vészleállást kezdeményez.
          </p>

          <p className={`${styles.paragraph} ${styles.block}`} data-intro-block="true">
            <strong>A Zéró Beavatkozás Elve</strong> – a rendszerek önfenntartóak, a manuális beavatkozás
            végzetes lehet. A legfontosabb képességed a fegyelem és a türelem. Ne cselekedj – felügyelj!
          </p>

          <p className={`${styles.paragraph} ${styles.block}`} data-intro-block="true">
            <strong>Valós Idejű Utazás</strong> – tapasztald meg a csillagközi utazás hiteles valóságát.
            A csillagok évezredek alatt mozdulnak el; a legnagyobb ellenség az idő.
          </p>

          <p className={`${styles.paragraph} ${styles.block}`} data-intro-block="true">
            <strong>A tét: Minden.</strong> Nincs dicsőség, nincsenek harcok, nincsenek jutalmak – csak a
            csend, a végtelen kozmosz és a válladra nehezedő felelősség. A jövő a te szemedben tükröződik.
          </p>

          <p className={`${styles.instruction} ${styles.block}`} data-intro-block="true">
            Kattints vagy nyomj meg bármilyen gombot a kihagyáshoz
          </p>
        </div>
      </div>
    </div>
  );
};

export default IntroScreen;
