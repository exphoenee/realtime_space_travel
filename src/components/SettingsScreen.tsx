import { type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import type { Difficulty } from "../types";
import useGameStore from "../state/useGameStore";
import useUIStore from "../state/useUIStore";
import LanguageSwitcher from "./LanguageSwitcher";
import styles from "./SettingsScreen.module.css";

const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];

const SettingsScreen = () => {
  const { t } = useTranslation();
  const transitionTo = useGameStore((s) => s.transitionTo);
  const musicVolume = useUIStore((s) => s.musicVolume);
  const setMusicVolume = useUIStore((s) => s.setMusicVolume);
  const difficulty = useUIStore((s) => s.difficulty);
  const setDifficulty = useUIStore((s) => s.setDifficulty);

  const handleBack = () => transitionTo("mainMenu");

  return (
    <div className={styles.overlay}>
      <div className={styles.panel}>
        <h1 className={styles.title}>{t("settings.title")}</h1>

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
              onChange={(e) => setMusicVolume(Number(e.target.value))}
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
          <span className={styles.label}>{t("settings.difficulty")}</span>
          <div className={styles.segmented} role="group" aria-label={t("settings.difficulty")}>
            {DIFFICULTIES.map((level) => (
              <button
                key={level}
                type="button"
                className={`${styles.segment}${difficulty === level ? ` ${styles.segmentActive}` : ""}`}
                aria-pressed={difficulty === level}
                onClick={() => setDifficulty(level)}
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
