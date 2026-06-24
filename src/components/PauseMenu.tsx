import styles from "./PauseMenu.module.css";

interface PauseMenuProps {
  countdownSeconds?: number | null;
}

const PauseMenu = ({ countdownSeconds }: PauseMenuProps) => {
  const isCountdown = typeof countdownSeconds === "number";

  if (isCountdown) {
    return (
      <div className={styles.overlay} aria-live="assertive">
        <div>
          <p className={styles.warningIcon}>⚠️</p>
          <h2 className={styles.countdownHeading}>Figyelem!</h2>
          <p className={styles.countdownSub}>
            Még {countdownSeconds} másodperced van visszanézni a képernyőre,
            különben a teljes hibernált legénység odavész!
          </p>
          <div className={styles.countdown}>
            <p className={styles.countdownValue}>{countdownSeconds}</p>
            <p className={styles.countdownUnit}>másodperc</p>
          </div>
          <p className={styles.countdownBlame}>
            Mert te nem végzed a feladatod...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.overlay} aria-live="polite">
      <div>
        <p className={styles.warningIcon}>📡</p>
        <h2 className={styles.heading}>Kapcsolat megszakadt</h2>
        <p className={styles.subtitle}>
          A fedélzeti rendszerek nem érzékelik a jelenlétedet.
        </p>
        <p className={styles.warningText}>
          <strong>60 másodperced</strong> van visszatérni a képernyő elé, mielőtt a
          hajó vészprotokollt aktivál. A legénység sorsa a te figyelmeden múlik.
        </p>
      </div>
    </div>
  );
};

export default PauseMenu;
