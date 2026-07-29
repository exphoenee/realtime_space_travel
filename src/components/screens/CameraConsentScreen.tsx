import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import useGameStore from "../../state/useGameStore";
import useUIStore from "../../state/useUIStore";
import LanguageSwitcher from "../ui/LanguageSwitcher";
import styles from "./CameraConsentScreen.module.css";

const CameraConsentScreen: React.FC = () => {
  const { t } = useTranslation();
  const transitionTo = useGameStore((s) => s.transitionTo);
  const persistCameraConsent = useUIStore((s) => s.persistCameraConsent);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleAllow = async () => {
    if (isProcessing) return;
    setIsProcessing(true);

    // Step 1: Save UI consent to Firebase.
    // Step 2 (browser permission prompt) happens later, when the user clicks
    // Start in the main menu — never during this screen.
    await persistCameraConsent("granted");
    transitionTo("mainMenu");
  };

  const handleDeny = async () => {
    if (isProcessing) return;
    await persistCameraConsent("denied");
    transitionTo("mainMenu");
  };

  return (
    <div className={styles.screen}>
      {/* Star particles */}
      <div className={styles.starfield}>
        {Array.from({ length: 50 }).map((_, i) => (
          <div
            key={i}
            className={styles.star}
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              width: `${Math.random() * 3 + 1}px`,
              height: `${Math.random() * 3 + 1}px`,
              animationDelay: `${Math.random() * 3}s`,
              opacity: Math.random() * 0.8 + 0.2,
            }}
          />
        ))}
      </div>

      {/* Language switcher — top-right corner, lets the user read the
          consent notice in their preferred language before deciding. */}
      <div className={styles.langBar}>
        <span className={styles.langLabel}>{t("language.label")}</span>
        <LanguageSwitcher />
      </div>

      <div className={styles.panel}>
        <div className={styles.icon}>📷</div>
        <h1 className={styles.title}>{t("app.cameraConsent.title")}</h1>
        <p className={styles.description}>{t("app.cameraConsent.description")}</p>

        <div className={styles.actions}>
          <button
            onClick={handleAllow}
            className={`${styles.btn} ${styles.allowBtn}`}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <span className={styles.spinner}>⟳</span>
            ) : (
              t("app.cameraConsent.allow")
            )}
          </button>
          <button
            onClick={handleDeny}
            className={`${styles.btn} ${styles.denyBtn}`}
            disabled={isProcessing}
          >
            {t("app.cameraConsent.deny")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CameraConsentScreen;
