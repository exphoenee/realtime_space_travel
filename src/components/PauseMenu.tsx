import React from "react";
import styles from "./PauseMenu.module.css";

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

  return (
    <div className={styles.overlay} aria-live="assertive">
      <div>
        <h2 className={styles.heading}>{headingText}</h2>
        <p className={styles.subtitle}>Nézz a képernyőre a folytatáshoz</p>
        {typeof countdownSeconds === "number" && (
          <div className={styles.countdown}>
            <p className={styles.countdownValue}>{countdownSeconds}s</p>
            <p className={styles.countdownText}>
              1 perc után vége a játéknak!
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PauseMenu;
