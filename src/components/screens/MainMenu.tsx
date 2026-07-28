import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import useGameStore from "../../state/useGameStore";
import useAuthStore from "../../state/useAuthStore";
import useUIStore from "../../state/useUIStore";
import { startGoogleAuth, getAuthErrorMessage } from "../../firebase/auth";
import { subscribeFriends, subscribeUnreadCount, getChatId } from "../../firebase/userData";
import styles from "./MainMenu.module.css";

const DEBUG_ENV = import.meta.env.VITE_DEBUG_MODE === "true";

const MainMenu = () => {
  const { t } = useTranslation();
  const transitionTo = useGameStore((s) => s.transitionTo);
  const authUser = useAuthStore((s) => s.user);
  const authUid = useAuthStore((s) => s.uid);
  const authStatus = useAuthStore((s) => s.status);
  const authError = useAuthStore((s) => s.authError);
  const setAuthError = useAuthStore((s) => s.setAuthError);
  const debugMode = useUIStore((s) => s.debugMode);
  const setDebugMode = useUIStore((s) => s.setDebugMode);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  // Local login error takes precedence, falling back to the global auth error.
  const errorKey = loginError ?? authError;

  // Subscribe to unread message counts per friend (map-based, avoids double-counting)
  useEffect(() => {
    if (!authUid) {
      setUnreadCounts({});
      return;
    }

    const unsubs: (() => void)[] = [];

    const unsubFriends = subscribeFriends(authUid, (friendUids) => {
      // Clean up old unread subscriptions
      for (const unsub of unsubs) unsub();
      unsubs.length = 0;

      // Reset counts
      setUnreadCounts({});

      if (friendUids.length === 0) return;

      for (const fuid of friendUids) {
        const chatId = getChatId(authUid, fuid);
        const unsub = subscribeUnreadCount(chatId, authUid, (count) => {
          setUnreadCounts((prev) => ({ ...prev, [fuid]: count }));
        });
        unsubs.push(unsub);
      }
    });

    return () => {
      unsubFriends();
      for (const unsub of unsubs) unsub();
    };
  }, [authUid]);

  // Compute total from the map
  const totalUnread = Object.values(unreadCounts).reduce((sum, c) => sum + c, 0);

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
          <button type="button" className={styles.button} onClick={() => transitionTo("wallOfShame")}>
            {t("mainMenu.wallOfShame")}
          </button>
          <button type="button" className={styles.button} onClick={() => transitionTo("friends")}>
            <span>{t("mainMenu.friends")}</span>
            {totalUnread > 0 && (
              <span className={styles.notificationBadge}>
                {totalUnread > 99 ? "99+" : totalUnread}
              </span>
            )}
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

        {DEBUG_ENV && (
          <div className={styles.debugActions}>
            <button
              type="button"
              className={`${styles.debugBtn} ${debugMode ? styles.debugBtnActive : ""}`}
              onClick={() => setDebugMode(!debugMode)}
              title={debugMode ? 'Debug ki' : 'Debug be'}
            >
              🛠 Debug {debugMode ? "ON" : "OFF"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MainMenu;
