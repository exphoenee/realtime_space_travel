import { useState } from "react";
import { useTranslation } from "react-i18next";
import useGameStore from "../../state/useGameStore";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import Modal from "../ui/Modal";
import EventModal from "./EventModal";
import type { WeatherCondition } from "../../constants/universeData";
import styles from "./Dashboard.module.css";

interface DashboardProps {
  remainingYears: number;
  destinationName: string;
  localWeather: WeatherCondition;
  currentSpeedKmPerSecond: number;
}

const Dashboard = ({
  remainingYears,
  destinationName,
  localWeather,
  currentSpeedKmPerSecond,
}: DashboardProps) => {
  const { t } = useTranslation();
  const activeEvent = useGameStore((s) => s.activeEvent);
  const asteroidWarning = useGameStore((s) => s.asteroidWarning);
  const isCompact = useMediaQuery("(max-width: 1100px), (max-height: 590px)");
  const [showDetails, setShowDetails] = useState(false);

  const weatherText = t(`weather.${localWeather.key}`, {
    temp: localWeather.temp,
  });

  return (
    <div className={styles.container}>
      {/* Asteroid warning banner */}
      {asteroidWarning && (
        <div className={styles.asteroidWarning}>
          <span className={styles.asteroidWarningIcon}>☄️</span>
          <span className={styles.asteroidWarningText}>
            {t("event.asteroid.title")}
          </span>
        </div>
      )}

      {isCompact ? (
        /* ── Compact (mobile/small) layout ── */
        <div className={styles.compact}>
          <div className={styles.compactItem}>
            <span className={styles.compactLabel}>{t("dashboard.localWeather")}</span>
            <span className={styles.compactValue}>{weatherText}</span>
          </div>
          <div className={styles.compactItem}>
            <span className={styles.compactLabel}>{t("dashboard.arrival")}</span>
            <span className={styles.compactValue}>
              {remainingYears.toFixed(1)} {t("dashboard.earthYears")}
            </span>
          </div>
          <button
            type="button"
            className={styles.detailsBtn}
            onClick={() => setShowDetails(true)}
            aria-label={t("dashboard.details")}
          >
            {t("dashboard.details")}
          </button>
        </div>
      ) : (
        /* ── Full (desktop) layout ── */
        <div className={styles.inner}>
          <div className={`${styles.segment} ${styles.status}`}>
            <h1 className={styles.statusTitle}>{t("dashboard.title")}</h1>
            <p className={styles.statusText}>{t("dashboard.status")}</p>
            <p className={styles.speed}>
              {t("dashboard.speed", {
                value: currentSpeedKmPerSecond.toFixed(0),
              })}
            </p>
          </div>
          <div className={`${styles.segment} ${styles.destination}`}>
            <p className={styles.destinationTitle}>{t("dashboard.destination")}</p>
            <p className={styles.destinationName}>{destinationName}</p>
            <p className={styles.weatherLabel}>{t("dashboard.localWeather")}</p>
            <p className={styles.weatherValue}>{weatherText}</p>
          </div>
          <div className={`${styles.segment} ${styles.arrival}`}>
            <p className={styles.arrivalLabel}>{t("dashboard.arrival")}</p>
            <p className={styles.arrivalValue}>
              {remainingYears.toFixed(3)} <span>{t("dashboard.earthYears")}</span>
            </p>
          </div>
        </div>
      )}

      {/* Details modal — shows full dashboard info in compact mode */}
      <Modal
        isOpen={showDetails}
        onClose={() => setShowDetails(false)}
        title={t("dashboard.title")}
      >
        <div className={styles.detailsGrid}>
          <div className={styles.detailsRow}>
            <span className={styles.detailsLabel}>{t("dashboard.status")}</span>
            <span className={styles.detailsValue}>{t("dashboard.status")}</span>
          </div>
          <div className={styles.detailsRow}>
            <span className={styles.detailsLabel}>{t("dashboard.speed")}</span>
            <span className={styles.detailsValue}>
              {t("dashboard.speed", {
                value: currentSpeedKmPerSecond.toFixed(0),
              })}
            </span>
          </div>
          <div className={styles.detailsRow}>
            <span className={styles.detailsLabel}>{t("dashboard.destination")}</span>
            <span className={styles.detailsValue}>{destinationName}</span>
          </div>
          <div className={styles.detailsRow}>
            <span className={styles.detailsLabel}>{t("dashboard.localWeather")}</span>
            <span className={styles.detailsValue}>{weatherText}</span>
          </div>
          <div className={styles.detailsRow}>
            <span className={styles.detailsLabel}>{t("dashboard.arrival")}</span>
            <span className={styles.detailsValue}>
              {remainingYears.toFixed(3)} {t("dashboard.earthYears")}
            </span>
          </div>
        </div>
      </Modal>

      {/* Event modal overlay — renders on top of dashboard */}
      {activeEvent && <EventModal event={activeEvent} />}
    </div>
  );
};

export default Dashboard;
