import { useTranslation } from "react-i18next";
import useGameStore from "../../state/useGameStore";
import useAuthStore from "../../state/useAuthStore";
import { signInWithGoogle } from "../../firebase/auth";
import styles from "./MainMenu.module.css";

const MainMenu = () => {
  const { t } = useTranslation();
  const transitionTo = useGameStore((s) => s.transitionTo);
  const authUser = useAuthStore((s) => s.user);
  const authStatus = useAuthStore((s) => s.status);

  const handleStart = () => transitionTo("missionSelect");
  const handleSettings = () => transitionTo("settings");
  const handleIntro = () => transitionTo("intro");
  const handleShop = () => transitionTo("shop");

  const handleLogin = async () => {
    try {
      // signInWithGoogle redirects the page — App.tsx handles the result on return
      await signInWithGoogle();
    } catch (err) {
      console.error("Login failed:", err);
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
          <button
            type="button"
            className={styles.button}
            onClick={handleLogin}
            disabled={authStatus === "loading"}
          >
            {authUser && !authUser.isAnonymous
              ? authUser.displayName ?? t("mainMenu.login")
              : t("mainMenu.login")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MainMenu;
