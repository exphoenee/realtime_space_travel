import React from "react";
import styles from "./Dashboard.module.css";

interface DashboardProps {
  remainingYears: number;
  destinationName: string;
  localWeather: string;
  currentSpeedKmPerSecond: number;
}

const Dashboard: React.FC<DashboardProps> = ({
  remainingYears,
  destinationName,
  localWeather,
  currentSpeedKmPerSecond,
}) => {
  return (
    <div className={styles.container}>
      <div className={styles.inner}>
        <div className={`${styles.segment} ${styles.status}`}>
          <h1 className={styles.statusTitle}>Csillagközi Utazás</h1>
          <p className={styles.statusText}>Státusz: Minden rendszer működik</p>
          <p className={styles.speed}>
            Sebesség: {currentSpeedKmPerSecond.toFixed(0)} km/s
          </p>
        </div>
        <div className={`${styles.segment} ${styles.destination}`}>
          <p className={styles.destinationTitle}>Cél</p>
          <p className={styles.destinationName}>{destinationName}</p>
          <p className={styles.weatherLabel}>Helyi időjárás</p>
          <p className={styles.weatherValue}>{localWeather}</p>
        </div>
        <div className={`${styles.segment} ${styles.arrival}`}>
          <p className={styles.arrivalLabel}>Érkezés a célrendszerbe</p>
          <p className={styles.arrivalValue}>
            {remainingYears.toFixed(7)} <span>Földi év</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
