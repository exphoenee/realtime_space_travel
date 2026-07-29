import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import useGameStore from "../../state/useGameStore";
import useUIStore from "../../state/useUIStore";
import useToastStore from "../../state/useToastStore";
import LanguageSwitcher from "../ui/LanguageSwitcher";
import styles from "./CameraConsentScreen.module.css";

const CameraConsentScreen: React.FC = () => {
  const { t } = useTranslation();
  const transitionTo = useGameStore((s) => s.transitionTo);
  const persistCameraConsent = useUIStore((s) => s.persistCameraConsent);
  const consentOrigin = useUIStore((s) => s.cameraConsentOrigin);
  const addToast = useToastStore((s) => s.addToast);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleAllow = async () => {
    if (isProcessing) return;
    setIsProcessing(true);

    // The browser prompt goes first. It has to run inside the click's user
    // gesture (Safari requires it), and awaiting an RTDB write beforehand
    // could delay — or, on a stalled connection, entirely swallow — it.
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((track) => track.stop());
    } catch (err) {
      // Browser denied the request or another error occurred — determine
      // the specific reason so we can show a helpful toast.
      let errorKey = "app.camera.needAccess";
      if (err instanceof DOMException) {
        switch (err.name) {
          case "NotAllowedError":
            errorKey = "app.camera.denied";
            break;
          case "NotFoundError":
            errorKey = "app.camera.notFound";
            break;
          case "NotReadableError":
            errorKey = "app.camera.notReadable";
            break;
        }
      }
      addToast("error", t(errorKey), 7000);

      // Reset consent so the whole flow repeats on the next Start click.
      void persistCameraConsent("denied");
      setIsProcessing(false);
      transitionTo("mainMenu");
      return;
    }

    // UI consent + browser permission are both in place. The RTDB write is
    // fire-and-forget: it updates the local state synchronously, and the
    // navigation must not wait for the round trip.
    void persistCameraConsent("granted");

    // Only a Start-button consent may continue into the game. Coming from
    // the first-load intro or from Settings, the player gets the menu back
    // and decides for themselves when to launch.
    transitionTo(consentOrigin === "start" ? "missionSelect" : "mainMenu");
  };

  const handleDeny = () => {
    if (isProcessing) return;
    void persistCameraConsent("denied");
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
