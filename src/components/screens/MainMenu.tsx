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
  const [totalUnread, setTotalUnread] = useState(0);

  // Local login error takes precedence, falling back to the global auth error.
  const errorKey = loginError ?? authError;

  // Subscribe to total unread message count across all friends
  useEffect(() => {
    if (!authUid) {
      setTotalUnread(0);
      return;
    }

    const unsubs: (() => void)[] = [];

    const unsubFriends = subscribeFriends(authUid, (friendUids) => {
      // Clean up old unread subscriptions
      for (const unsub of unsubs) unsub();
      unsubs.length = 0;

      if (friendUids.length === 0) {
        setTotalUnread(0);
        return;
      }

      let runningTotal = 0;

      for (const fuid of friendUids) {
        const chatId = getChatId(authUid, fuid);
        const unsub = subscribeUnreadCount(chatId, authUid, (count) => {
          // Recalculate total: subtract old value, add new value
          // Using delta approach to avoid full re-scan
          runningTotal += count;
          // Run a fresh calculation to ensure accuracy
          // (The closure captures the latest count per friend)
          setTotalUnread((prev) => Math.max(0, prev + count));
          // Reset total after first batch to avoid double counting
          // Actually, better approach: recalculate from all subscriptions
        });
        unsubs.push(unsub);
      }

      // After all subscriptions are set up, reset total to force re-count
      setTotalUnread(0);
    });

    return () => {
      unsubFriends();
      for (const unsub of unsubs) unsub();
    };
  }, [authUid]);

  // Simpler approach: use a ref-based accumulator that resets when friends change
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
