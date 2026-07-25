import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { ExoplanetRaw } from "../../constants/shopCatalog";
import type { ExoplanetProduct } from "../../types";
import Modal from "../ui/Modal";
import styles from "./MissionSelector.module.css";

/** Kép URL kinyerése: lehet string ("https://…") vagy objektum ({url:"https://…"}) */
const extractImageUrl = (value: unknown): string | null => {
  if (typeof value === "string") return value || null;
  if (value && typeof value === "object" && "url" in value) {
    const u = (value as { url: string }).url;
    return typeof u === "string" ? u : null;
  }
  return null;
};

interface MissionExoplanetModalProps {
  data: ExoplanetRaw | null;
  product: ExoplanetProduct;
  onClose: () => void;
}

const MissionExoplanetModal = ({
  data,
  product,
  onClose,
}: MissionExoplanetModalProps) => {
  const { t } = useTranslation();

  const isBasePlanet = data === null;

  const [imgErrors, setImgErrors] = useState<Set<string>>(new Set());
  const onImgError = useCallback((key: string) => {
    setImgErrors((prev) => new Set(prev).add(key));
  }, []);

  const images: [string, string][] = data?.images
    ? (Object.entries(data.images)
        .map(([key, value]) => [key, extractImageUrl(value)] as [string, string | null])
        .filter(([, url]) => url !== null) as [string, string][])
    : [];

  const links = data?.links
    ? (Object.entries(data.links).filter(([, url]) => url) as [string, string][])
    : [];

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={product.name}
      closeAriaLabel={t("shop.exoplanet.modal.close")}
      footer={
        <div className={styles.infoModalFooter}>
          {!isBasePlanet && (
            <div className={styles.infoModalPrice}>
              ⭐ {product.priceCredits}
              <span className={styles.infoModalEur}>
                {" "}(€{product.priceEur.toFixed(2)})
              </span>
            </div>
          )}
          <button
            type="button"
            className={styles.infoModalCloseBtn}
            onClick={onClose}
          >
            {t("shop.exoplanet.modal.close")}
          </button>
        </div>
      }
    >
      {/* Images (only for JSON exoplanets) */}
      {images.length > 0 && (
        <div className={styles.infoModalImages}>
          {images.map(([source, url]) => (
            <a
              key={source}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.infoModalImageLink}
            >
              {!imgErrors.has(source) ? (
                <img
                  src={url}
                  alt={`${product.name} — ${source}`}
                  className={styles.infoModalImage}
                  loading="lazy"
                  onError={() => onImgError(source)}
                />
              ) : (
                <div className={styles.infoModalImage} style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(15, 23, 42, 0.6)",
                  fontSize: "0.75rem",
                  color: "#64748b",
                  width: "280px",
                  height: "100px",
                }}>
                  🌌 {source}
                </div>
              )}
              <span className={styles.infoModalImageLabel}>{source}</span>
            </a>
          ))}
        </div>
      )}

      {/* Distance */}
      <div className={styles.infoModalRow}>
        <span className={styles.infoModalLabel}>
          {t("shop.exoplanet.modal.distance")}
        </span>
        <span className={styles.infoModalValue}>
          {product.distanceLy.toFixed(2)} ly
        </span>
      </div>

      {/* Wage */}
      <div className={styles.infoModalRow}>
        <span className={styles.infoModalLabel}>Reward</span>
        <span className={styles.infoModalValue}>⭐ {product.wage}</span>
      </div>

      {/* Star info (for JSON exoplanets) */}
      {data?.star && !isBasePlanet && (
        <>
          <h3 className={styles.infoModalSectionTitle}>
            {t("shop.exoplanet.modal.section.star")}
          </h3>
          <div className={styles.infoModalGrid}>
            {data.star.name && (
              <div className={styles.infoModalRow}>
                <span className={styles.infoModalLabel}>Name</span>
                <span className={styles.infoModalValue}>{data.star.name}</span>
              </div>
            )}
            {data.star.spectralType && (
              <div className={styles.infoModalRow}>
                <span className={styles.infoModalLabel}>Type</span>
                <span className={styles.infoModalValue}>{data.star.spectralType}</span>
              </div>
            )}
            {data.star.temperature != null && (
              <div className={styles.infoModalRow}>
                <span className={styles.infoModalLabel}>
                  {t("shop.exoplanet.modal.temperature")}
                </span>
                <span className={styles.infoModalValue}>
                  {data.star.temperature.toLocaleString()} K
                </span>
              </div>
            )}
            {data.star.mass != null && (
              <div className={styles.infoModalRow}>
                <span className={styles.infoModalLabel}>
                  {t("shop.exoplanet.modal.mass")}
                </span>
                <span className={styles.infoModalValue}>
                  {data.star.mass.toFixed(2)} M☉
                </span>
              </div>
            )}
            {data.star.radius != null && (
              <div className={styles.infoModalRow}>
                <span className={styles.infoModalLabel}>
                  {t("shop.exoplanet.modal.radius")}
                </span>
                <span className={styles.infoModalValue}>
                  {data.star.radius.toFixed(2)} R☉
                </span>
              </div>
            )}
          </div>
        </>
      )}

      {/* Planet info (for JSON exoplanets) */}
      {data?.planet && !isBasePlanet && (
        <>
          <h3 className={styles.infoModalSectionTitle}>
            {t("shop.exoplanet.modal.section.planet")}
          </h3>
          <div className={styles.infoModalGrid}>
            {data.planet.massEarth != null && (
              <div className={styles.infoModalRow}>
                <span className={styles.infoModalLabel}>
                  {t("shop.exoplanet.modal.mass")}
                </span>
                <span className={styles.infoModalValue}>
                  {data.planet.massEarth.toFixed(2)} M⊕
                </span>
              </div>
            )}
            {data.planet.temperatureK != null && (
              <div className={styles.infoModalRow}>
                <span className={styles.infoModalLabel}>
                  {t("shop.exoplanet.modal.temperature")}
                </span>
                <span className={styles.infoModalValue}>
                  {data.planet.temperatureK.toLocaleString()} K
                </span>
              </div>
            )}
            {data.planet.radiusEarth != null && (
              <div className={styles.infoModalRow}>
                <span className={styles.infoModalLabel}>
                  {t("shop.exoplanet.modal.radius")}
                </span>
                <span className={styles.infoModalValue}>
                  {data.planet.radiusEarth.toFixed(2)} R⊕
                </span>
              </div>
            )}
          </div>
        </>
      )}

      {/* Discovery info (for JSON exoplanets) */}
      {data?.discovery && !isBasePlanet && (
        <>
          <h3 className={styles.infoModalSectionTitle}>
            {t("shop.exoplanet.modal.section.discovery")}
          </h3>
          <div className={styles.infoModalGrid}>
            {data.discovery.year && (
              <div className={styles.infoModalRow}>
                <span className={styles.infoModalLabel}>Year</span>
                <span className={styles.infoModalValue}>{data.discovery.year}</span>
              </div>
            )}
            {data.discovery.method && (
              <div className={styles.infoModalRow}>
                <span className={styles.infoModalLabel}>Method</span>
                <span className={styles.infoModalValue}>{data.discovery.method}</span>
              </div>
            )}
          </div>
        </>
      )}

      {/* External links (for JSON exoplanets) */}
      {links.length > 0 && (
        <div className={styles.infoModalLinks}>
          <span className={styles.infoModalLabel}>
            {t("shop.exoplanet.modal.links")}
          </span>
          <div className={styles.infoModalLinkGroup}>
            {links.map(([source, url]) => (
              <a
                key={source}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.infoModalLink}
              >
                {source} ↗
              </a>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
};

export default MissionExoplanetModal;
