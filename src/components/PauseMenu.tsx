import React from "react";

interface PauseMenuProps {
  countdownSeconds?: number | null;
  isInitializing?: boolean;
}

const PauseMenu: React.FC<PauseMenuProps> = ({
  countdownSeconds,
  isInitializing,
}) => {
  const headingText = isInitializing
    ? "Az élmény hamarosan kezdődik!"
    : "Szünet";
  const headingClasses = `text-6xl font-bold text-cyan-300 tracking-widest animate-pulse${
    isInitializing ? "" : " uppercase"
  }`;

  return (
    <div
      className="absolute inset-0 bg-black/70 flex flex-col justify-center items-center z-50 backdrop-blur-md"
      aria-live="assertive"
    >
      <div className="text-center">
        <h2 className={headingClasses}>
          {headingText}
        </h2>
        <p className="mt-4 text-xl text-cyan-400">
          Nézz a képernyőre a folytatáshoz
        </p>
        {typeof countdownSeconds === "number" && (
          <div className="mt-6 text-yellow-300">
            <p className="text-3xl font-semibold tabular-nums">
              {countdownSeconds}s
            </p>
            <p className="mt-2 text-lg text-yellow-200">
              1 perc után vége a játéknak!
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PauseMenu;
