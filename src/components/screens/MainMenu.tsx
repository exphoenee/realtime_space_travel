import { useState } from "react";
import { useTranslation } from "react-i18next";
import useGameStore from "../../state/useGameStore";
import useAuthStore from "../../state/useAuthStore";
import { startGoogleAuth, getAuthErrorMessage } from "../../firebase/auth";
import styles from "./MainMenu.module.css";

const MainMenu = () => {
  const { t } = useTranslation();
  const transitionTo = useGameStore((s) => s.transitionTo);
  const authUser = useAuthStore((s) => s.user);
  const authStatus = useAuthStore((s) => s.status);
  const authError = useAuthStore((s) => s.authError);
  const setAuthError = useAuthStore((s) => s.setAuthError);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Local login error takes precedence, falling back to the global auth error.
  const errorKey = loginError ?? authError;

  const handleStart = () => transitionTo("missionSelect");
  const handleSettings = () => transitionTo("settings");
  const handleIntro = () => transitionTo("intro");
  const handleShop = () => transitionTo("shop");

  const handleLogin = async () => {
    setLoginError(null);
    setAuthError(null);
    try {
      // Unified popup-first flow (same as the Settings button); links the
      // anonymous account when possible, redirect fallback if popup blocked.
      await startGoogleAuth();
    } catch (err) {
      console.error("Login failed:", err);
      setLoginError(getAuthErrorMessage(err));
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.panel}>
        <h1 className={styles.title}>{t("intro.headline")}</h1>
        <p className={styles.motto}>{t("intro.motto")}</p>

        <div className={styles.actions}>
          <button
            type="button"
            className={`${styles.button} ${styles.primary}`}
            onClick={handleStart}
          >
            {t("mainMenu.start")}
          </button>
          <button type="button" className={styles.button} onClick={handleShop}>
            {t("mainMenu.shop")}
          </button>
          <button
            type="button"
            className={styles.button}
            onClick={handleSettings}
          >
            {t("mainMenu.settings")}
          </button>
          <button type="button" className={styles.button} onClick={handleIntro}>
            {t("mainMenu.intro")}
          </button>
          {(!authUser || authUser.isAnonymous) && (
            <button
              type="button"
              className={styles.button}
              onClick={handleLogin}
              disabled={authStatus === "loading"}
            >
              {authStatus === "loading" ? "..." : t("mainMenu.login")}
            </button>
          )}
        </div>

        {errorKey && (
          <p className={styles.loginError} role="alert">
            {t(errorKey)}
          </p>
        )}
      </div>
    </div>
  );
};

export default MainMenu;
