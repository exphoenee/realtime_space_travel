import { useState } from "react";
import { useTranslation } from "react-i18next";
import useGameStore from "../state/useGameStore";
import styles from "./MainMenu.module.css";

const MainMenu = () => {
  const { t } = useTranslation();
  const transitionTo = useGameStore((s) => s.transitionTo);
  // Melyik "hamarosan" értesítés látszik (login / shop) — még nincs implementálva.
  const [notice, setNotice] = useState<null | "login" | "shop">(null);

  const handleStart = () => transitionTo("missionSelect");
  const handleSettings = () => transitionTo("settings");
  const handleIntro = () => transitionTo("intro");
  // A bejelentkezés és az áruház a későbbi fázisokban kerül bekötésre.
  const handleLogin = () => setNotice("login");
  const handleShop = () => setNotice("shop");

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
          <button type="button" className={styles.button} onClick={handleLogin}>
            {t("mainMenu.login")}
          </button>
        </div>

        {notice && (
          <p className={styles.notice} role="status">
            {notice === "login"
              ? t("mainMenu.loginComingSoon")
              : t("mainMenu.shopComingSoon")}
          </p>
        )}
      </div>
    </div>
  );
};

export default MainMenu;
