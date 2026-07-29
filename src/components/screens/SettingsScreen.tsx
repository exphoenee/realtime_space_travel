import { useState, useMemo, useCallback, useRef, useEffect, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import type { Difficulty } from "../../types";
import { SHOP_MUSIC } from "../../constants/shopCatalog";
import useGameStore from "../../state/useGameStore";
import useShopStore from "../../state/useShopStore";
import useAuthStore, { selectRtdbKey, getRtdbKey } from "../../state/useAuthStore";
import useUIStore from "../../state/useUIStore";
import { startGoogleAuth, signOut, getAuthErrorMessage } from "../../firebase/auth";
import { updateUserSettings, updateUserNickname, updateUserPublicProfile, updateOnlineStatus } from "../../firebase/userData";
import LanguageSwitcher from "../ui/LanguageSwitcher";
import CustomSelect from "../ui/CustomSelect";
import BackButton from "../ui/BackButton";
import CameraHelpModal from "./CameraHelpModal";
import {
  getCameraPermissionState,
  type CameraPermissionState,
} from "../../services/cameraPermission";
import styles from "./SettingsScreen.module.css";

const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];

const SettingsScreen = () => {
  const { t } = useTranslation();
  const transitionTo = useGameStore((s) => s.transitionTo);
  const musicVolume = useUIStore((s) => s.musicVolume);
  const setMusicVolume = useUIStore((s) => s.setMusicVolume);
  const difficulty = useUIStore((s) => s.difficulty);
  const setDifficulty = useUIStore((s) => s.setDifficulty);
  const activeMusicId = useUIStore((s) => s.activeMusicId);
  const setActiveMusicId = useUIStore((s) => s.setActiveMusicId);
  const credits = useShopStore((s) => s.credits);
  const creditsLoaded = useShopStore((s) => s.creditsLoaded);
  const ownedMusicIds = useShopStore((s) => s.owned.music);
  const authUser = useAuthStore((s) => s.user);
  const authUid = useAuthStore((s) => s.uid);
  const authStatus = useAuthStore((s) => s.status);
  const isAnonymous = useAuthStore((s) => s.isAnonymous);
  const deviceId = useAuthStore((s) => s.deviceId);
  const rtdbKey = useAuthStore(selectRtdbKey);
  const mergeNotice = useAuthStore((s) => s.mergeNotice);
  const setMergeNotice = useAuthStore((s) => s.setMergeNotice);
  const storeDisplayName = useAuthStore((s) => s.displayName);
  const cameraConsent = useUIStore((s) => s.cameraConsent);
  const authError = useAuthStore((s) => s.authError);
  const setAuthError = useAuthStore((s) => s.setAuthError);
  const clearUser = useAuthStore((s) => s.clearUser);
  const nickname = useAuthStore((s) => s.nickname);
  const nicknameLoaded = useAuthStore((s) => s.nicknameLoaded);
  const setNickname = useAuthStore((s) => s.setNickname);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [cameraPermission, setCameraPermission] =
    useState<CameraPermissionState>("unknown");
  const [cameraHelpOpen, setCameraHelpOpen] = useState(false);
  const [editingNickname, setEditingNickname] = useState(false);
  const [nicknameInput, setNicknameInput] = useState("");
  const [uidCopied, setUidCopied] = useState(false);
  const uidTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nicknameInputRef = useRef<HTMLInputElement>(null);
  // Sync local input when store value changes / editing starts
  useEffect(() => {
    if (editingNickname) {
      setNicknameInput(nickname);
    }
  }, [editingNickname, nickname]);

  // Focus the input when editing starts
  useEffect(() => {
    if (editingNickname && nicknameInputRef.current) {
      nicknameInputRef.current.focus();
    }
  }, [editingNickname]);

  const handleNicknameSave = useCallback(async () => {
    const trimmed = nicknameInput.trim();
    setNickname(trimmed);
    setEditingNickname(false);
    // Persist to RTDB (use rtdbKey)
    const key = getRtdbKey();
    if (key) {
      try {
        await updateUserNickname(key, trimmed);
        // Also update public profile for search
        await updateUserPublicProfile(key, trimmed, storeDisplayName);
      } catch (err) {
        console.error("Failed to save nickname:", err);
      }
    }
  }, [nicknameInput, setNickname, storeDisplayName]);

  const handleNicknameKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        void handleNicknameSave();
      }
      if (e.key === "Escape") {
        setEditingNickname(false);
        setNicknameInput(nickname); // revert
      }
    },
    [handleNicknameSave, nickname],
  );

  // Shared UID copy handler — copies the correct identifier based on auth state:
  // - Authenticated users: copies the uid (rtdbKey)
  // - Guest/anonymous users: copies the deviceId
  const handleCopyUid = useCallback(async () => {
    const idToCopy = authUser && !isAnonymous ? rtdbKey : deviceId;
    if (!idToCopy) return;
    try {
      await navigator.clipboard.writeText(idToCopy);
      setUidCopied(true);
      if (uidTimerRef.current) clearTimeout(uidTimerRef.current);
      uidTimerRef.current = setTimeout(() => setUidCopied(false), 2000);
    } catch {
      // Clipboard API not available — fall back to user-select: all
    }
  }, [deviceId, rtdbKey, authUser, isAnonymous]);

  const uidKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        void handleCopyUid();
      }
    },
    [handleCopyUid],
  );

  // Clean up the uid copy timeout on unmount
  useEffect(() => {
    return () => {
      if (uidTimerRef.current) clearTimeout(uidTimerRef.current);
    };
  }, []);

  // Ask the browser itself, not just the stored consent: a blocked permission
  // is a dead end our consent screen cannot open, and needs different advice.
  useEffect(() => {
    let cancelled = false;
    getCameraPermissionState().then((state) => {
      if (!cancelled) setCameraPermission(state);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Local login error takes precedence, falling back to the global auth error.
  const errorKey = loginError ?? authError;

  const ownedMusicTracks = useMemo(() => {
    return SHOP_MUSIC.filter((track) => ownedMusicIds.includes(track.id));
  }, [ownedMusicIds]);

  const hasOwnedMusic = ownedMusicTracks.length > 0;

  /** Blocked at the browser level — no prompt can bring it back from here. */
  const isCameraBlocked = cameraPermission === "denied";

  const handleEnableCamera = useCallback(() => {
    // Navigate to the camera consent screen for the full flow. Marking the
    // origin keeps this a settings change: granting here returns to the menu
    // instead of launching a mission.
    useUIStore.getState().setCameraConsentOrigin("settings");
    transitionTo("cameraConsent");
  }, [transitionTo]);

  const handleBack = () => transitionTo("mainMenu");

  const handleGoogleLogin = useCallback(async () => {
    setLoginError(null);
    setAuthError(null);
    try {
      // Unified popup-first flow (links the anonymous account when possible,
      // redirect fallback if the popup is blocked).
      await startGoogleAuth();
    } catch (err) {
      console.error("Login failed:", err);
      setLoginError(getAuthErrorMessage(err));
    }
  }, [setAuthError]);

  const handleLogout = useCallback(async () => {
    setLoginError(null);
    setAuthError(null);
    try {
      // Go offline BEFORE signing out. The RTDB `onDisconnect` handler only
      // fires when the socket actually drops — signing out keeps the
      // connection alive (an anonymous session takes over immediately), so
      // without this the account would stay "online" forever and friends would
      // never see the transition. Must happen while the token is still valid:
      // the `usersPublic/$uid` write rule requires `$uid == auth.uid`.
      if (authUid) {
        await updateOnlineStatus(authUid, "offline").catch(console.error);
      }

      await signOut();
      // Optimistic local clear; the auth listener re-populates with a fresh
      // anonymous session.
      clearUser();
    } catch (err) {
      console.error("Logout failed:", err);
      setLoginError(getAuthErrorMessage(err));
    }
  }, [setAuthError, clearUser, authUid]);

  return (
    <div className={styles.overlay}>
      <div className={styles.panel}>
        <div className={styles.settingsHeader}>
          <h1 className={styles.title}>{t("settings.title")}</h1>
          <BackButton onClick={handleBack}>
            ← {t("settings.back")}
          </BackButton>
        </div>
        <div className={styles.scrollContainer}>

        {/* Account Section — full-width vertical stack */}
        {(authUser && !isAnonymous) ? (
          <div className={styles.accountSection}>
            {/* Header row: name + credits */}
            <div className={styles.accountHeader}>
              <div className={styles.accountNameBlock}>
                <span className={styles.accountDisplayName}>
                  {storeDisplayName}
                </span>
                <span className={styles.accountBadge}>
                  {t("settings.authenticated")}
                </span>
              </div>
              <span className={styles.creditDisplay}>
                {creditsLoaded ? t("shop.creditsLabel", { count: credits }) : "—"}
              </span>
            </div>

            {/* Nickname editor */}
            <div className={styles.accountField}>
              <span className={styles.fieldLabel}>{t("settings.nickname")}</span>
              <div className={styles.nicknameRow}>
                <div className={styles.nicknameInputWrapper}>
                  <input
                    ref={nicknameInputRef}
                    type="text"
                    className={`${styles.nicknameInput}${editingNickname ? ` ${styles.nicknameInputEditing}` : ""}`}
                    value={editingNickname ? nicknameInput : (nickname || storeDisplayName || "")}
                    onChange={(e) => setNicknameInput(e.target.value)}
                    onKeyDown={handleNicknameKeyDown}
                    disabled={!editingNickname}
                    placeholder={storeDisplayName ?? t("settings.nicknamePlaceholder")}
                    maxLength={30}
                    aria-label={t("settings.nickname")}
                  />
                </div>
                <button
                  type="button"
                  className={styles.nicknameToggle}
                  onClick={editingNickname ? handleNicknameSave : () => setEditingNickname(true)}
                  title={editingNickname ? t("settings.nicknameSave") : t("settings.nicknameEdit")}
                  aria-label={editingNickname ? t("settings.nicknameSave") : t("settings.nicknameEdit")}
                >
                  {editingNickname ? "✓" : "✏️"}
                </button>
              </div>
            </div>

            {/* User ID (rtdbKey/uid for authenticated users) */}
            <div className={styles.accountField}>
              <span className={styles.fieldLabel}>{t("settings.userId")}</span>
              <span
                className={`${styles.uidDisplay}${uidCopied ? ` ${styles.uidCopied}` : ""}`}
                title={uidCopied ? t("settings.uidCopied") : rtdbKey}
                onClick={handleCopyUid}
                role="button"
                tabIndex={0}
                onKeyDown={uidKeyDown}
              >
                {uidCopied ? t("settings.uidCopied") : rtdbKey}
              </span>
            </div>

            {/* Merge notice (blocked merge info) */}
            {mergeNotice && (
              <div className={styles.mergeNotice}>
                <span>{t(mergeNotice)}</span>
                <button
                  type="button"
                  className={styles.mergeNoticeDismiss}
                  onClick={() => setMergeNotice(null)}
                  aria-label="Dismiss"
                >
                  ×
                </button>
              </div>
            )}

            {/* Logout */}
            <div className={styles.accountActions}>
              <button
                type="button"
                className={`${styles.authBtn} ${styles.authBtnDanger}`}
                onClick={handleLogout}
                disabled={authStatus === "loading"}
              >
                {t("settings.logout")}
              </button>
              {errorKey && (
                <span className={styles.loginError}>
                  {t(errorKey)}
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className={styles.row}>
            <span className={styles.label}>{t("mainMenu.login")}</span>
            <div className={styles.accountInfo}>
              <div className={styles.guestIdBlock}>
                <span className={styles.fieldLabel}>{t("settings.guestId")}</span>
                <span
                  className={`${styles.uidDisplay}${uidCopied ? ` ${styles.uidCopied}` : ""}`}
                  title={uidCopied ? t("settings.uidCopied") : deviceId}
                  onClick={handleCopyUid}
                  role="button"
                  tabIndex={0}
                  onKeyDown={uidKeyDown}
                >
                  {uidCopied ? t("settings.uidCopied") : deviceId}
                </span>
              </div>
              <button
                type="button"
                className={styles.authBtn}
                onClick={handleGoogleLogin}
                disabled={authStatus === "loading"}
              >
                {authStatus === "loading" ? "..." : t("settings.signIn")}
              </button>
              {errorKey && (
                <span className={styles.loginError}>
                  {t(errorKey)}
                </span>
              )}
            </div>
          </div>
        )}


          <div className={styles.row}>
            <label className={styles.label} htmlFor="music-volume">
              {t("settings.musicVolume")}
            </label>
            <div className={styles.control}>
              <span className={styles.icon} aria-hidden="true">
                {musicVolume === 0 ? "🔇" : musicVolume < 0.5 ? "🔉" : "🔊"}
              </span>
              <input
                id="music-volume"
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={musicVolume}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setMusicVolume(val);
                  if (rtdbKey) {
                    updateUserSettings(rtdbKey, { musicVolume: val }).catch(console.error);
                  }
                }}
                className={styles.slider}
                style={
                  { ["--fill" as string]: `${Math.round(musicVolume * 100)}%` } as CSSProperties
                }
                aria-valuetext={`${Math.round(musicVolume * 100)}%`}
              />
              <span className={styles.value}>{Math.round(musicVolume * 100)}%</span>
            </div>
          </div>

          <div className={styles.row}>
            <label className={`${styles.label}${!hasOwnedMusic ? ` ${styles.labelDisabled}` : ""}`} htmlFor="music-track">
              {t("settings.musicTrack")}
            </label>
            <CustomSelect
              id="music-track"
              value={activeMusicId ?? "__default__"}
              onChange={(val) => {
                const newId = val === "__default__" ? null : val;
                setActiveMusicId(newId);
                if (rtdbKey) {
                  updateUserSettings(rtdbKey, { activeMusicId: newId }).catch(console.error);
                }
              }}
              options={[
                { value: "__default__", label: t("settings.musicDefault") },
                ...ownedMusicTracks.map((track) => ({
                  value: track.id,
                  label: track.title,
                })),
              ]}
              disabled={!hasOwnedMusic}
              ariaLabel={t("settings.musicTrack")}
            />
          </div>

          <div className={styles.row}>
            <span className={styles.label}>{t("settings.difficulty")}</span>
            <div className={styles.segmented} role="group" aria-label={t("settings.difficulty")}>
              {DIFFICULTIES.map((level) => (
                <button
                  key={level}
                  type="button"
                  className={`${styles.segment}${difficulty === level ? ` ${styles.segmentActive}` : ""}`}
                  aria-pressed={difficulty === level}
                  onClick={() => {
                    setDifficulty(level);
                    if (rtdbKey) {
                      updateUserSettings(rtdbKey, { difficulty: level }).catch(console.error);
                    }
                  }}
                >
                  {t(`difficulty.${level}`)}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.row}>
            <span className={styles.label}>
              {isCameraBlocked
                ? t("settings.cameraBlocked")
                : cameraConsent === "granted"
                  ? t("settings.cameraGranted")
                  : t("settings.enableCamera")}
            </span>
            <div className={styles.control}>
              {isCameraBlocked ? (
                <button
                  type="button"
                  className={styles.authBtn}
                  onClick={() => setCameraHelpOpen(true)}
                >
                  {t("settings.cameraHelp.button")}
                </button>
              ) : cameraConsent === "granted" ? (
                <span>✅</span>
              ) : (
                <button
                  type="button"
                  className={styles.authBtn}
                  onClick={handleEnableCamera}
                >
                  {t("settings.enableCamera")}
                </button>
              )}
            </div>
          </div>

          <div className={styles.row}>
            <span className={styles.label}>{t("language.label")}</span>
            <LanguageSwitcher />
          </div>
        </div>
      </div>

      <CameraHelpModal
        isOpen={cameraHelpOpen}
        onClose={() => setCameraHelpOpen(false)}
      />
    </div>
  );
};

export default SettingsScreen;
