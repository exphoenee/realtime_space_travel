import React from "react";
import { Destination } from "../types";
import { SHIP_SPEED_LIGHTYEARS_PER_YEAR } from "../constants/constants";
import { baseDestinations } from "../constants/universeData";
import styles from "./MainMenu.module.css";

// ha akarod, itt már előre ráteheted a travelYears-t is
const destinations = baseDestinations.map((dest) => ({
  ...dest,
  travelYears: dest.distanceLy / SHIP_SPEED_LIGHTYEARS_PER_YEAR,
}));

interface MainMenuProps {
  onSelectDestination: (destination: Destination) => void;
}

const MainMenu: React.FC<MainMenuProps> = ({ onSelectDestination }) => {
  return (
    <div className={styles.overlay}>
      <div className={styles.panel}>
        <h1 className={styles.title}>Válassz egy küldetést!</h1>

        <div className={styles.grid}>
          {destinations.map((dest) => (
            <button
              key={dest.name}
              onClick={() =>
                onSelectDestination({
                  name: dest.name,
                  travelYears: dest.travelYears,
                })
              }
              className={styles.missionButton}
            >
              <h2 className={styles.missionName}>{dest.name}</h2>
              <p className={styles.missionMeta}>{dest.distanceLy} fényév</p>
              <p className={styles.missionMeta}>Jutalom {dest.wage}$</p>
            </button>
          ))}
        </div>

        <h2 className={styles.dlcText}>
          Vedd meg a <span>Tejút DLC</span>-t $19.99-ért további
          csillagrendszerekért!
        </h2>
        <h2 className={styles.dlcText}>Hamarosan további DLC-k érkeznek!</h2>
      </div>
    </div>
  );
};

export default MainMenu;
