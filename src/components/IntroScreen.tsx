import React, { useEffect, useRef } from "react";

interface IntroScreenProps {
  onSkip: () => void;
}

const IntroScreen: React.FC<IntroScreenProps> = ({ onSkip }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;

    const blocks = Array.from(
      root.querySelectorAll<HTMLElement>(".intro-block"),
    );

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("intro-block-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { root: null, rootMargin: "0px 0px -20% 0px", threshold: 0 },
    );

    const computeDelaySeconds = (index: number) => {
      if (index === 0) return 0;
      if (index === 1) return 4;
      if (index === 2) return 8;
      return index + 3;
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
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 text-center px-6 cursor-pointer overflow-hidden"
      onClick={onSkip}
    >
      <div className="intro-fade flex flex-col items-center justify-center text-white max-h-full px-4">
        <div
          ref={scrollRef}
          className="intro-scroll max-w-4xl space-y-6 text-left pb-20"
        >
          <div className="intro-block space-y-3 text-center">
            <h1 className="text-5xl md:text-6xl font-bold tracking-[0.35em] uppercase text-center">
              Realtime Space Travel
            </h1>
          </div>
          <div className="intro-block space-y-3 text-center">
            <p className="text-2xl italic text-cyan-100">
              Az életedre szóló élmény!
            </p>
          </div>

          <div className="intro-block text-lg leading-8 text-cyan-50">
            Te vagy a kiválaszott! Te vagy az Emberiség utolsó és egyetlen
            reménye. Ez nem egy játék, a túlélésünk a tét. Ez az utolsó
            esélyünk: egy új otthon ígérete távoli csillagrendszerekben. A
            bárka, amely az emberiség jövőjét hordozza, indulásra kész.
          </div>

          <div className="intro-block text-lg leading-8 text-cyan-50">
            A teljes legénység – tudósok, mérnökök, az új civilizáció alapítói –
            mély, kriogén álomba merült. A sorsuk, az álmaik, a jövőnk... Az
            emberiség sorsa most a te kezedben van. Te vagy az az élő, lélegző
            komponens, amelyet semmilyen mesterséges intelligencia nem pótolhat.
          </div>

          <div className="intro-block text-xl font-semibold uppercase tracking-[0.3em] text-cyan-200 text-center">
            A Feladataid – A Küldetés Legszigorúbb Protokolljai
          </div>

          <div className="intro-block space-y-3 text-lg leading-8 text-cyan-50">
            <h2 className="text-lg font-semibold text-cyan-200">
              Az Éberség Protokollja
            </h2>
          </div>
          <div className="intro-block space-y-3 text-lg leading-8 text-cyan-50">
            <p>
              A legfőbb feladatod a parancsnoki híd rendszereinek folyamatos,
              megszakítás nélküli vizuális monitorozása. A hajó komplex autonóm
              rendszereihez egy emberi tudati horgony szükséges, hogy a több
              ezer éves út során a navigációs adatok szinkronizációja tökéletes
              maradjon. A te figyelmed az, ami stabilizálja a rendszert. Ha a
              vizuális kapcsolat megszakad, a hajó vészleállást kezdeményez, és
              a küldetés elbukik. A tekinteted az, ami egyben tartja a jövőt.
            </p>
          </div>

          <div className="intro-block space-y-3 text-lg leading-8 text-cyan-50">
            <h2 className="text-lg font-semibold text-cyan-200">
              A Zéró Beavatkozás Elve
            </h2>
          </div>
          <div className="intro-block space-y-3 text-lg leading-8 text-cyan-50">
            <p>
              A parancsnoki híd rendszerei tökéletesen kalibráltak és
              önfenntartóak. Bármilyen manuális beavatkozás – egyetlen
              gombnyomás, egy felesleges parancs – azonnali és végzetes
              kaszkádhibát idéz elő a létfenntartó rendszerekben. Ennek
              következménye a legénység teljes és visszafordíthatatlan
              pusztulása. A legfontosabb képességed a fegyelem és a türelem. Ne
              cselekedj – felügyelj!
            </p>
          </div>

          <div className="intro-block space-y-3 text-lg leading-8 text-cyan-50">
            <h2 className="text-lg font-semibold text-cyan-200">
              Valós Idejű Utazás
            </h2>
          </div>
          <div className="intro-block space-y-3 text-lg leading-8 text-cyan-50">
            <p>
              Készülj fel, hogy megtapasztald a csillagközi utazás hiteles,
              kompromisszumok nélküli valóságát. Valós időben. Láthatod, ahogy a
              csillagok lassan, szinte észrevétlenül elmozdulnak az évezredek
              alatt. Ez a mélyűr nyers és fenséges valósága, ahol a legnagyobb
              ellenség az idő.
            </p>
          </div>

          <div className="intro-block text-lg leading-8 text-cyan-50 font-semibold uppercase tracking-[0.25em] text-center">
            A tét: Minden.
          </div>

          <div className="intro-block text-lg leading-8 text-cyan-50 text-center">
            Nincs dicsőség, nincsenek harcok, nincsenek jutalmak – csak a csend,
            a végtelen kozmosz és a válladra nehezedő, elképzelhetetlen
            felelősség.
          </div>

          <div className="intro-block text-lg leading-8 text-cyan-50 text-center">
            A felelősség a tiéd. A jövő a te szemedben tükröződik.
          </div>

          <div className="intro-block text-sm uppercase tracking-[0.3em] text-cyan-200/80 text-center">
            Kattints vagy nyomj meg bármilyen gombot a kihagyáshoz
          </div>
        </div>
      </div>
    </div>
  );
};

export default IntroScreen;
