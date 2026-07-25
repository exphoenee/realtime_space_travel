import { useMemo } from "react";
import { Trans, useTranslation } from "react-i18next";
import { Destination } from "../types";
import { SHIP_SPEED_LIGHTYEARS_PER_YEAR } from "../constants/constants";
import { baseDestinations } from "../constants/universeData";
import useGameStore from "../state/useGameStore";
import styles from "./MissionSelector.module.css";

interface MissionSelectorProps {
  onSelectDestination: (destination: Destination) => void;
}

const MissionSelector = ({ onSelectDestination }: MissionSelectorProps) => {
  const { t } = useTranslation();
  const transitionTo = useGameStore((s) => s.transitionTo);
  const destinations = useMemo(
    () =>
      baseDestinations.map((dest) => ({
        ...dest,
        travelYears: dest.distanceLy / SHIP_SPEED_LIGHTYEARS_PER_YEAR,
      })),
    [],
  );

  return (
    <div className={styles.overlay}>
      <button
        type="button"
        className={styles.backButton}
        onClick={() => transitionTo("mainMenu")}
      >
        ← {t("settings.back")}
      </button>
      <div className={styles.panel}>
        <h1 className={styles.title}>{t("menu.title")}</h1>

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
              <p className={styles.missionMeta}>
                {t("menu.lightYears", { distance: dest.distanceLy })}
              </p>
              <p className={styles.missionMeta}>
                {t("menu.reward", { amount: dest.wage })}
              </p>
            </button>
          ))}
        </div>

        <h2 className={styles.dlcText}>
          <Trans i18nKey="menu.dlcMilkyWay">
            Vedd meg a <span>Tejút DLC</span>-t $19.99-ért további
            csillagrendszerekért!
          </Trans>
        </h2>
        <h2 className={styles.dlcText}>{t("menu.dlcComingSoon")}</h2>
      </div>
    </div>
  );
};

export default MissionSelector;
