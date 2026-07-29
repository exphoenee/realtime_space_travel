import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import useGameStore from "../../state/useGameStore";
import useAuthStore from "../../state/useAuthStore";
import useUIStore from "../../state/useUIStore";
import useNotificationStore from "../../state/useNotificationStore";
import useToastStore from "../../state/useToastStore";
import { startGoogleAuth, getAuthErrorMessage } from "../../firebase/auth";
import { subscribeFriends, subscribeUnreadCount, getChatId } from "../../firebase/userData";
import { needsCameraConsent } from "../../services/cameraPermission";
import styles from "./MainMenu.module.css";

const DEBUG_ENV = import.meta.env.VITE_DEBUG_MODE === "true";

/** Guest notices are two sentences long — give them longer than the default. */
const GUEST_NOTICE_DURATION_MS = 7000;

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

  // The Start button is always clickable — if consent is not granted,
  // handleStart redirects to the camera consent screen instead.
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  // Guests (signed out or anonymous) have no registered account: the friend
  // graph is keyed by the Google auth uid, and purchases must survive past a
  // throwaway session — so friends/chat and the shop are unavailable to them.
  const isGuest = !authUser || authUser.isAnonymous;
  const addToast = useToastStore((s) => s.addToast);

  // Local login error takes precedence, falling back to the global auth error.
  const errorKey = loginError ?? authError;

  // Subscribe to unread message counts per friend (map-based, avoids double-counting)
  useEffect(() => {
    // Guests cannot have friends — no point holding RTDB listeners for them.
    if (!authUid || isGuest) {
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
  }, [authUid, isGuest]);

  /**
   * Navigate, or explain why not when the player has no registered account.
   * The explanation goes to the toast stack so it is noticed even though the
   * button sits mid-list; `addToast` ignores a duplicate that is still visible.
   */
  const guardedNav = (phase: "shop" | "friends", noticeKey: string) =>
    isGuest
      ? () => addToast("warning", t(noticeKey), GUEST_NOTICE_DURATION_MS)
      : () => transitionTo(phase);

  // Unread system notifications (friend requests etc.) — fed by the single
  // `useNotificationListener` subscription in App, cleared when the Friends
  // screen mounts.
  const unreadNotifications = useNotificationStore((s) => s.unreadCount);

  // One badge on the Friends button: unread chat messages + notifications.
  const totalUnread =
    Object.values(unreadCounts).reduce((sum, c) => sum + c, 0) +
    (isGuest ? 0 : unreadNotifications);

  const handleStart = async () => {
    const ui = useUIStore.getState();

    // The stored consent lives in RTDB and follows the account across
    // devices, so it can say "granted" in a browser that never granted
    // anything — `needsCameraConsent` also asks the browser itself.
    if (await needsCameraConsent(ui.cameraConsent)) {
      // The consent screen requests the browser permission and, because the
      // player pressed Start, continues straight into mission selection.
      ui.setCameraConsentOrigin("start");
      transitionTo("cameraConsent");
      return;
    }

    // Consent and browser permission are both in place — no prompt needed.
    transitionTo("missionSelect");
  };
  const handleSettings = () => transitionTo("settings");
  const handleIntro = () => {
    // A replay from the menu is just the intro: it ends in the menu and
    // never asks about the camera, even when permission is missing.
    useUIStore.getState().setIntroReplay(true);
    transitionTo("intro");
  };

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
        {/* Artwork is decorative (figures on either side); the headline and
            motto are real text so they follow the selected language. */}
        <div className={styles.titleBanner}>
          <img
            className={styles.titleImage}
            src={`${import.meta.env.BASE_URL}title.webp`}
            alt=""
            aria-hidden="true"
          />
          <div className={styles.titleOverlay}>
            <h1 className={styles.title}>{t("intro.headline")}</h1>
            <p className={styles.motto}>{t("intro.motto")}</p>
          </div>
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={`${styles.button} ${styles.primary}`}
            onClick={handleStart}
          >
            {t("mainMenu.start")}
          </button>
          <button
            type="button"
            className={styles.button}
            onClick={guardedNav("shop", "shop.guestNotice")}
            title={isGuest ? t("shop.guestNotice") : ""}
          >
            {isGuest ? "🔒 " : ""}
            {t("mainMenu.shop")}
          </button>
          <button type="button" className={styles.button} onClick={() => transitionTo("wallOfShame")}>
            {t("mainMenu.wallOfShame")}
          </button>
          <button
            type="button"
            className={styles.button}
            onClick={guardedNav("friends", "friends.guestNotice")}
            title={isGuest ? t("friends.guestNotice") : ""}
          >
            <span>
              {isGuest ? "🔒 " : ""}
              {t("mainMenu.friends")}
            </span>
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

      <a
        className={styles.creatorLink}
        href="https://viktor.bozzay.online"
        target="_blank"
        rel="noopener noreferrer"
      >
        {t("mainMenu.meetCreator")}
      </a>
    </div>
  );
};

export default MainMenu;
