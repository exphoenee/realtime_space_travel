import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import useGameStore from "../../state/useGameStore";
import useUIStore from "../../state/useUIStore";
import styles from "./CameraConsentModal.module.css";

const CameraConsentModal: React.FC = () => {
  const { t } = useTranslation();
  const transitionTo = useGameStore((s) => s.transitionTo);
  const setCameraConsent = useUIStore((s) => s.setCameraConsent);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleAllow = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      // Immediately stop the stream — we just need the permission
      stream.getTracks().forEach((track) => track.stop());
      setCameraConsent("granted");
      transitionTo("mainMenu");
    } catch (err) {
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        setError(t("cameraConsent.browserDenied"));
      } else if (err instanceof DOMException && err.name === "NotFoundError") {
        setError(t("app.camera.notFound"));
      } else {
        setError(t("cameraConsent.error"));
      }
      setCameraConsent("denied");
      setIsProcessing(false);
      transitionTo("mainMenu");
    }
  };

  const handleDeny = () => {
    setCameraConsent("denied");
    transitionTo("mainMenu");
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.icon}>📷</div>
        <h2 className={styles.title}>{t("cameraConsent.title")}</h2>
        <p className={styles.description}>{t("cameraConsent.description")}</p>
        {error && <p className={styles.error}>{error}</p>}
        <div className={styles.actions}>
          <button
            onClick={handleAllow}
            className={`${styles.btn} ${styles.allowBtn}`}
            disabled={isProcessing}
          >
            {isProcessing ? "..." : t("cameraConsent.allow")}
          </button>
          <button
            onClick={handleDeny}
            className={`${styles.btn} ${styles.denyBtn}`}
            disabled={isProcessing}
          >
            {t("cameraConsent.deny")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CameraConsentModal;
