import { useTranslation } from "react-i18next";
import type { ShipProduct } from "../../types";
import style from "./ShipSelectScreen.module.css";

interface ShipInfoModalProps {
  ship: ShipProduct & { isDefault?: boolean };
  onClose: () => void;
  onSelect: () => void;
}

const ShipInfoModal = ({ ship, onClose, onSelect }: ShipInfoModalProps) => {
  const { t } = useTranslation();

  return (
    <div className={style.infoOverlay} onClick={onClose}>
      <div
        className={style.infoModal}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className={style.infoModalClose}
          onClick={onClose}
          aria-label={t("shop.ship.modal.close")}
        >
          ✕
        </button>

        <h2 className={style.infoModalTitle}>{ship.name}</h2>

        <div className={style.infoModalVisual}>
          <span className={style.shipEmoji}>🚀</span>
        </div>

        <p className={style.infoModalDesc}>
          {ship.isDefault
            ? t("shipSelect.defaultDesc")
            : t(ship.descriptionKey)}
        </p>

        <h3 className={style.infoModalSectionTitle}>
          {t("shop.ship.modal.specs")}
        </h3>
        <div className={style.infoModalGrid}>
          <div className={style.infoModalRow}>
            <span className={style.infoModalLabel}>
              {t("shop.ship.speedLabel")}
            </span>
            <span className={style.infoModalValue}>
              {ship.speedKmPerSecond.toLocaleString()} km/s
            </span>
          </div>
          <div className={style.infoModalRow}>
            <span className={style.infoModalLabel}>
              {t("shop.ship.manufacturerLabel")}
            </span>
            <span className={style.infoModalValue}>{ship.manufacturer}</span>
          </div>
          <div className={style.infoModalRow}>
            <span className={style.infoModalLabel}>
              {t("shop.ship.capacityLabel")}
            </span>
            <span className={style.infoModalValue}>
              {ship.capacity} {t("shop.ship.crew")}
            </span>
          </div>
          <div className={style.infoModalRow}>
            <span className={style.infoModalLabel}>
              {t("shop.ship.rangeLabel")}
            </span>
            <span className={style.infoModalValue}>
              {ship.rangeLy} {t("shop.ship.ly")}
            </span>
          </div>
        </div>

        <button
          type="button"
          className={style.infoModalSelectBtn}
          onClick={onSelect}
        >
          {t("shipSelect.launchWith")}
        </button>
      </div>
    </div>
  );
};

export default ShipInfoModal;
