import { Trans, useTranslation } from "react-i18next";
import styles from "./PauseMenu.module.css";

interface PauseMenuProps {
  countdownSeconds?: number | null;
}

const PauseMenu = ({ countdownSeconds }: PauseMenuProps) => {
  const { t } = useTranslation();
  const isCountdown = typeof countdownSeconds === "number";

  if (isCountdown) {
    return (
      <div className={styles.overlay} aria-live="assertive">
        <div>
          <p className={styles.warningIcon}>⚠️</p>
          <h2 className={styles.countdownHeading}>{t("pause.attentionTitle")}</h2>
          <p className={styles.countdownSub}>
            {t("pause.countdownSub", { seconds: countdownSeconds })}
          </p>
          <div className={styles.countdown}>
            <p className={styles.countdownValue}>{countdownSeconds}</p>
            <p className={styles.countdownUnit}>{t("pause.seconds")}</p>
          </div>
          <p className={styles.countdownBlame}>{t("pause.blame")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.overlay} aria-live="polite">
      <div>
        <p className={styles.warningIcon}>📡</p>
        <h2 className={styles.heading}>{t("pause.disconnectedTitle")}</h2>
        <p className={styles.subtitle}>{t("pause.disconnectedSub")}</p>
        <p className={styles.warningText}>
          <Trans i18nKey="pause.disconnectedWarning">
            <strong>60 másodperced</strong> van visszatérni a képernyő elé, mielőtt a
            hajó vészprotokollt aktivál. A legénység sorsa a te figyelmeden múlik.
          </Trans>
        </p>
      </div>
    </div>
  );
};

export default PauseMenu;
