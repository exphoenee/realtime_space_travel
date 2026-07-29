import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import BackButton from "../ui/BackButton";
import { Destination } from "../../types";
import { SHIP_SPEED_LIGHTYEARS_PER_YEAR } from "../../constants/constants";
import { baseDestinations } from "../../constants/universeData";
import { mapExoplanet, calcExoplanetWage, BASE_EXOPLANETS } from "../../constants/shopCatalog";
import type { ExoplanetRaw } from "../../constants/shopCatalog";
import type { ExoplanetProduct } from "../../types";
import useGameStore from "../../state/useGameStore";
import useShopStore from "../../state/useShopStore";
import MissionExoplanetModal from "./MissionExoplanetModal";
import styles from "./MissionSelector.module.css";

import exoplanetsData from "../../data/exoplanets.json";

interface MissionSelectorProps {
  onSelectDestination: (destination: Destination) => void;
}

interface DestinationCard {
  name: string;
  distanceLy: number;
  wage: number;
  travelYears: number;
  /** Nyers adat (csak JSON exobolygóknál van) */
  raw: ExoplanetRaw | null;
  /** ExoplanetProduct adat (minden exobolygóhoz, alap + JSON) */
  product: ExoplanetProduct;
}

const MissionSelector = ({ onSelectDestination }: MissionSelectorProps) => {
  const { t } = useTranslation();
  const transitionTo = useGameStore((s) => s.transitionTo);
  const ownedExoplanetIds = useShopStore((s) => s.owned.exoplanets);
  const [previewTarget, setPreviewTarget] = useState<DestinationCard | null>(null);

  const destinations: DestinationCard[] = useMemo(() => {
    // Base (free) destinations — look up from BASE_EXOPLANETS for product data
    const base = baseDestinations.map((dest) => {
      const product = BASE_EXOPLANETS.find(
        (p) => p.name === dest.name,
      ) ?? BASE_EXOPLANETS[0];
      return {
        ...dest,
        travelYears: dest.distanceLy / SHIP_SPEED_LIGHTYEARS_PER_YEAR,
        raw: null as ExoplanetRaw | null,
        product,
      };
    });

    // Owned exoplanets from the shop
    const raw = exoplanetsData as unknown as ExoplanetRaw[];
    const owned: DestinationCard[] = [];
    raw.forEach((r, i) => {
      const product = mapExoplanet(r, i);
      if (ownedExoplanetIds.includes(product.id)) {
        const distanceLy = r.distance?.lightYears ?? 0;
        const massEarth = r.planet?.massEarth ?? null;
        owned.push({
          name: r.name,
          distanceLy,
          wage: calcExoplanetWage(distanceLy, massEarth),
          travelYears: distanceLy / SHIP_SPEED_LIGHTYEARS_PER_YEAR,
          raw: r,
          product,
        });
      }
    });

    return [...base, ...owned];
  }, [ownedExoplanetIds]);

  return (
    <div className={styles.overlay}>
      <BackButton className={styles.backButton} onClick={() => transitionTo("mainMenu")}>
        ← {t("settings.back")}
      </BackButton>
      <div className={styles.panel}>
        <h1 className={styles.title}>{t("menu.title")}</h1>

        <div className={styles.grid}>
          {destinations.map((dest) => (
            <div key={dest.name} className={styles.missionCard}>
              <button
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
              <button
                type="button"
                className={styles.infoButton}
                onClick={() => setPreviewTarget(dest)}
                aria-label="Info"
                title="Info"
              >
                ℹ Info
              </button>
            </div>
          ))}
        </div>

      </div>

      {/* Exoplanet info modal */}
      {previewTarget && (
        <MissionExoplanetModal
          data={previewTarget.raw}
          product={previewTarget.product}
          onClose={() => setPreviewTarget(null)}
        />
      )}
    </div>
  );
};

export default MissionSelector;
