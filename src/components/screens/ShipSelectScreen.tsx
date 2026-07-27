import { useState, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { SHIP_SPEED_KM_PER_SECOND } from "../../constants/constants";
import { DEFAULT_SHIP, SHOP_SHIPS } from "../../constants/shopCatalog";
import type { ShipProduct } from "../../types";
import useGameStore from "../../state/useGameStore";
import useShopStore from "../../state/useShopStore";
import useUIStore from "../../state/useUIStore";
import ShipInfoModal from "./ShipInfoModal";
import styles from "./ShipSelectScreen.module.css";

interface ShipEntry {
  ship: ShipProduct & { isDefault?: boolean };
  isOwned: boolean;
}

interface ShipSelectScreenProps {
  onCheckCamera?: () => Promise<boolean>;
}

const ShipCardVisual = ({ ship }: { ship: ShipProduct & { isDefault?: boolean } }) => {
  const [failed, setFailed] = useState(false);
  return (
    <div className={styles.shipVisual}>
      {ship.image && !failed ? (
        <img
          src={`${import.meta.env.BASE_URL}spaceships/${ship.image}`}
          alt={ship.name}
          className={styles.shipCockpitImage}
          onError={() => setFailed(true)}
        />
      ) : (
        <span className={styles.shipEmoji}>🚀</span>
      )}
    </div>
  );
};

const ShipSelectScreen = ({ onCheckCamera }: ShipSelectScreenProps) => {
  const { t } = useTranslation();
  const pendingDestination = useGameStore((s) => s.pendingDestination);
  const startMission = useGameStore((s) => s.startMission);
  const transitionTo = useGameStore((s) => s.transitionTo);
  const ownedShipIds = useShopStore((s) => s.owned.ships);
  const [previewShip, setPreviewShip] = useState<ShipEntry | null>(null);

  // Redirect to missionSelect if no pending destination
  useEffect(() => {
    if (!pendingDestination) {
      transitionTo("missionSelect");
    }
  }, [pendingDestination, transitionTo]);

  const availableShips: ShipEntry[] = useMemo(() => {
    const ships: ShipEntry[] = [{ ship: { ...DEFAULT_SHIP, isDefault: true }, isOwned: true }];
    SHOP_SHIPS.forEach((shopShip) => {
      if (ownedShipIds.includes(shopShip.id)) {
        ships.push({ ship: shopShip, isOwned: true });
      }
    });
    return ships;
  }, [ownedShipIds]);

  const handleSelectShip = async (entry: ShipEntry) => {
    if (!pendingDestination) return;

    // Camera check before mission start
    if (onCheckCamera) {
      const ok = await onCheckCamera();
      if (!ok) return;
    }

    // Recalculate travel years: faster ship = shorter travel time
    const travelYears =
      pendingDestination.travelYears /
      (entry.ship.speedKmPerSecond / SHIP_SPEED_KM_PER_SECOND);
    // Persist the selected ship so it shows on the dashboard during gameplay
    useUIStore.getState().setActiveShipId(
      entry.ship.isDefault ? null : entry.ship.id,
    );

    startMission(
      { name: pendingDestination.name, travelYears },
      entry.ship.speedKmPerSecond,
    );
  };

  if (!pendingDestination) return null;

  return (
    <div className={styles.overlay}>
      <button
        type="button"
        className={styles.backButton}
        onClick={() => transitionTo("missionSelect")}
      >
        ← {t("settings.back")}
      </button>
      <div className={styles.panel}>
        <h1 className={styles.title}>{t("shipSelect.title")}</h1>
        <p className={styles.subtitle}>
          {t("shipSelect.subtitle", { destination: pendingDestination.name })}
        </p>

        <div className={styles.grid}>
          {availableShips.map((entry) => (
            <div key={entry.ship.id} className={styles.shipCard}>
              <ShipCardVisual ship={entry.ship} />
              <div className={styles.shipInfo}>
                <h3 className={styles.shipName}>{entry.ship.name}</h3>
                {entry.ship.isDefault ? (
                  <span className={styles.defaultBadge}>
                    {t("shipSelect.default")}
                  </span>
                ) : entry.isOwned ? (
                  <span className={styles.ownedBadge}>
                    {t("shipSelect.owned")}
                  </span>
                ) : null}
                <p className={styles.shipSpec}>
                  ⚡ {entry.ship.speedKmPerSecond.toLocaleString()} km/s
                </p>
                <p className={styles.shipSpec}>
                  🏭 {entry.ship.manufacturer}
                </p>
              </div>
              <div className={styles.shipActions}>
                <button
                  type="button"
                  className={styles.infoBtn}
                  onClick={() => setPreviewShip(entry)}
                  title={t("shipSelect.info")}
                >
                  ℹ {t("shipSelect.info")}
                </button>
                <button
                  type="button"
                  className={styles.selectBtn}
                  onClick={() => handleSelectShip(entry)}
                >
                  {t("shipSelect.launch")}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {previewShip && (
        <ShipInfoModal
          ship={previewShip.ship}
          onClose={() => setPreviewShip(null)}
          onSelect={() => {
            setPreviewShip(null);
            handleSelectShip(previewShip);
          }}
        />
      )}
    </div>
  );
};

export default ShipSelectScreen;
