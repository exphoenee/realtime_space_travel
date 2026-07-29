import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import Modal from "../ui/Modal";
import styles from "./CameraHelpModal.module.css";

/** Browsers whose unblock steps differ enough to be worth spelling out. */
type BrowserKind = "chrome" | "firefox" | "safari" | "generic";

/**
 * Which browser the player is in, for the unblock instructions only.
 * UA sniffing is the wrong tool for feature decisions, but here the whole
 * point is naming the menu items the player actually sees. Chromium forks
 * (Edge, Opera, Brave) share Chrome's site-settings UI, so they share the
 * steps too.
 */
const detectBrowser = (): BrowserKind => {
  const ua = navigator.userAgent;
  if (/Firefox\//.test(ua)) return "firefox";
  if (/Edg\/|Chrome\/|Chromium\//.test(ua)) return "chrome";
  if (/Safari\//.test(ua)) return "safari";
  return "generic";
};

interface CameraHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Explains how to re-allow the camera after the browser has blocked it.
 *
 * A blocked permission cannot be re-prompted from JavaScript — `getUserMedia`
 * rejects instantly with NotAllowedError and no dialog appears. Only the
 * player can undo it in browser UI, so instructions are the only real remedy.
 */
const CameraHelpModal = ({ isOpen, onClose }: CameraHelpModalProps) => {
  const { t } = useTranslation();
  const browser = useMemo(detectBrowser, []);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("settings.cameraHelp.title")}
      closeAriaLabel={t("settings.cameraHelp.close")}
      footer={
        <>
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={onClose}
          >
            {t("settings.cameraHelp.close")}
          </button>
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={() => window.location.reload()}
          >
            {t("settings.cameraHelp.reload")}
          </button>
        </>
      }
    >
      <p className={styles.intro}>{t("settings.cameraHelp.intro")}</p>

      <p className={styles.browserName}>
        {t(`settings.cameraHelp.${browser}.name`)}
      </p>
      <ol className={styles.steps}>
        <li>{t(`settings.cameraHelp.${browser}.step1`)}</li>
        <li>{t(`settings.cameraHelp.${browser}.step2`)}</li>
        <li>{t(`settings.cameraHelp.${browser}.step3`)}</li>
      </ol>

      <p className={styles.note}>{t("settings.cameraHelp.reloadNote")}</p>
    </Modal>
  );
};

export default CameraHelpModal;
