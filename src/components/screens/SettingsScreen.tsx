import { useState, useMemo, useCallback, useRef, useEffect, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import type { Difficulty } from "../../types";
import { SHOP_MUSIC } from "../../constants/shopCatalog";
import useGameStore from "../../state/useGameStore";
import useShopStore from "../../state/useShopStore";
import useAuthStore, { selectRtdbKey, getRtdbKey } from "../../state/useAuthStore";
import useUIStore from "../../state/useUIStore";
import { startGoogleAuth, signOut, getAuthErrorMessage } from "../../firebase/auth";
import { updateUserSettings, updateUserNickname } from "../../firebase/userData";
import LanguageSwitcher from "../ui/LanguageSwitcher";
import CustomSelect from "../ui/CustomSelect";
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
  const authStatus = useAuthStore((s) => s.status);
  const isAnonymous = useAuthStore((s) => s.isAnonymous);
  const deviceId = useAuthStore((s) => s.deviceId);
  const rtdbKey = useAuthStore(selectRtdbKey);
  const storeDisplayName = useAuthStore((s) => s.displayName);
  const authError = useAuthStore((s) => s.authError);
  const setAuthError = useAuthStore((s) => s.setAuthError);
  const clearUser = useAuthStore((s) => s.clearUser);
  const nickname = useAuthStore((s) => s.nickname);
  const nicknameLoaded = useAuthStore((s) => s.nicknameLoaded);
  const setNickname = useAuthStore((s) => s.setNickname);
  const [loginError, setLoginError] = useState<string | null>(null);
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
      } catch (err) {
        console.error("Failed to save nickname:", err);
      }
    }
  }, [nicknameInput, setNickname]);

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

  // Shared deviceId copy handler (copies the stable deviceId to clipboard)
  const handleCopyUid = useCallback(async () => {
    if (!deviceId) return;
    try {
      await navigator.clipboard.writeText(deviceId);
      setUidCopied(true);
      if (uidTimerRef.current) clearTimeout(uidTimerRef.current);
      uidTimerRef.current = setTimeout(() => setUidCopied(false), 2000);
    } catch {
      // Clipboard API not available — fall back to user-select: all
    }
  }, [deviceId]);

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

  // Local login error takes precedence, falling back to the global auth error.
  const errorKey = loginError ?? authError;

  const ownedMusicTracks = useMemo(() => {
    return SHOP_MUSIC.filter((track) => ownedMusicIds.includes(track.id));
  }, [ownedMusicIds]);

  const hasOwnedMusic = ownedMusicTracks.length > 0;

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
      await signOut();
      // Optimistic local clear; the auth listener re-populates with a fresh
      // anonymous session.
      clearUser();
    } catch (err) {
      console.error("Logout failed:", err);
      setLoginError(getAuthErrorMessage(err));
    }
  }, [setAuthError, clearUser]);

  return (
    <div className={styles.overlay}>
      <div className={styles.panel}>
        <h1 className={styles.title}>{t("settings.title")}</h1>

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

            {/* Device ID */}
            <div className={styles.accountField}>
              <span className={styles.fieldLabel}>{t("settings.userId")}</span>
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
                // Persist to RTDB if signed in
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

        {/* Music track selector — custom select dropdown */}
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
                  // Persist to RTDB if signed in
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
          <span className={styles.label}>{t("language.label")}</span>
          <LanguageSwitcher />
        </div>

        <button
          type="button"
          className={styles.backButton}
          onClick={handleBack}
        >
          {t("settings.back")}
        </button>
      </div>
    </div>
  );
};

export default SettingsScreen;
