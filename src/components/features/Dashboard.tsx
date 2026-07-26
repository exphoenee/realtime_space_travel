import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { WeatherCondition } from "../../constants/universeData";
import styles from "./Dashboard.module.css";

interface DashboardProps {
  remainingYears: number;
  destinationName: string;
  localWeather: WeatherCondition;
  currentSpeedKmPerSecond: number;
  /** Cockpit dashboard image URL for the selected ship */
  shipImageUrl?: string;
  /** Ship name for the alt text */
  shipName?: string;
}

const Dashboard = ({
  remainingYears,
  destinationName,
  localWeather,
  currentSpeedKmPerSecond,
  shipImageUrl,
  shipName,
}: DashboardProps) => {
  const { t } = useTranslation();
  const [shipImgFailed, setShipImgFailed] = useState(false);

  return (
    <div className={styles.container}>
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
          <p className={styles.weatherValue}>
            {t(`weather.${localWeather.key}`, { temp: localWeather.temp })}
          </p>
        </div>
        <div className={`${styles.segment} ${styles.arrival}`}>
          <p className={styles.arrivalLabel}>{t("dashboard.arrival")}</p>
          <p className={styles.arrivalValue}>
            {remainingYears.toFixed(3)} <span>{t("dashboard.earthYears")}</span>
          </p>
        </div>
        {shipImageUrl && !shipImgFailed && (
          <div className={`${styles.segment} ${styles.shipSegment}`}>
            <img
              src={shipImageUrl}
              alt={shipName ?? t("dashboard.ship")}
              className={styles.shipCockpit}
              onError={() => setShipImgFailed(true)}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
