import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { ExoplanetRaw } from "../../constants/shopCatalog";
import type { ExoplanetProduct, CartItem } from "../../types";
import useShopStore from "../../state/useShopStore";
import Modal from "../ui/Modal";
import styles from "./ShopScreen.module.css";

/** Kép URL kinyerése: lehet string ("https://…") vagy objektum ({url:"https://…"}) */
const extractImageUrl = (value: unknown): string | null => {
  if (typeof value === "string") return value || null;
  if (value && typeof value === "object" && "url" in value) {
    const u = (value as { url: string }).url;
    return typeof u === "string" ? u : null;
  }
  return null;
};

interface ExoplanetPreviewModalProps {
  data: ExoplanetRaw;
  product: ExoplanetProduct;
  onAddToCart: (item: CartItem) => void;
  onClose: () => void;
}

const ExoplanetPreviewModal = ({
  data,
  product,
  onAddToCart,
  onClose,
}: ExoplanetPreviewModalProps) => {
  const { t } = useTranslation();

  const [imgErrors, setImgErrors] = useState<Set<string>>(new Set());
  const onImgError = useCallback((key: string) => {
    setImgErrors((prev) => new Set(prev).add(key));
  }, []);

  const images: [string, string][] = data.images
    ? (Object.entries(data.images)
        .map(([key, value]) => [key, extractImageUrl(value)] as [string, string | null])
        .filter(([, url]) => url !== null) as [string, string][])
    : [];

  const links = data.links
    ? Object.entries(data.links).filter(([, url]) => url) as [string, string][]
    : [];

  const planet = data.planet;
  const star = data.star;
  const discovery = data.discovery;
  const coords = data.coordinates;

  const isOwned = useShopStore((s) => s.isOwned)("exoplanet", product.id);
  const isInCart = useShopStore((s) => s.isInCart)(product.id);

  const handleCartAction = () => {
    if (isOwned) return;
    if (isInCart) {
      useShopStore.getState().removeFromCart(product.id);
      onClose();
      return;
    }
    onAddToCart({
      id: product.id,
      category: "exoplanet",
      priceCredits: product.priceCredits,
    });
    onClose();
  };

  const getButtonLabel = () => {
    if (isOwned) return t("shop.owned");
    if (isInCart) return t("shop.inCart");
    return t("shop.addToCart");
  };

  const getButtonClass = () => {
    if (isOwned) return `${styles.modalCartBtn} ${styles.ownedBtn}`;
    if (isInCart) return `${styles.modalCartBtn} ${styles.inCartBtn}`;
    return `${styles.modalCartBtn} ${styles.addToCartBtn}`;
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={data.name}
      closeAriaLabel={t("shop.exoplanet.modal.close")}
      footer={
        <>
          <div className={styles.modalPrice}>
            ⭐ {product.priceCredits}{" "}
            <span className={styles.productPriceEur}>
              (€{product.priceEur.toFixed(2)})
            </span>
          </div>
          <div className={styles.modalFooterActions}>
            <button
              type="button"
              className={styles.modalCloseBtn}
              onClick={onClose}
            >
              {t("shop.exoplanet.modal.close")}
            </button>
            <button
              type="button"
              className={getButtonClass()}
              onClick={handleCartAction}
              disabled={isOwned}
            >
              {getButtonLabel()}
            </button>
          </div>
        </>
      }
    >
      {/* Images */}
      {images.length > 0 && (
        <div className={styles.modalImages}>
          {images.map(([source, url]) => (
            <a
              key={source}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.modalImageLink}
            >
              {!imgErrors.has(source) ? (
                <img
                  src={url}
                  alt={`${data.name} — ${source}`}
                  className={styles.modalImage}
                  loading="lazy"
                  onError={() => onImgError(source)}
                />
              ) : (
                <div className={styles.modalImage} style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(15, 23, 42, 0.6)",
                  fontSize: "0.75rem",
                  color: "#64748b",
                }}>
                  🌌 {source}
                </div>
              )}
              <span className={styles.modalImageLabel}>{source}</span>
            </a>
          ))}
        </div>
      )}

      {/* Distance */}
      <div className={styles.modalInfoRow}>
        <span className={styles.modalLabel}>
          {t("shop.exoplanet.modal.distance")}
        </span>
        <span className={styles.modalValue}>
          {data.distance?.lightYears?.toFixed(2)} ly
          {data.distance?.parsec != null
            ? ` (${data.distance.parsec.toFixed(3)} pc)`
            : ""}
        </span>
      </div>

      {/* Coordinates */}
      {coords && (coords.ra != null || coords.dec != null) && (
        <div className={styles.modalInfoRow}>
          <span className={styles.modalLabel}>
            {t("shop.exoplanet.modal.coordinates")}
          </span>
          <span className={styles.modalValue}>
            {coords.ra != null ? `RA ${coords.ra.toFixed(4)}°` : ""}
            {coords.ra != null && coords.dec != null ? " · " : ""}
            {coords.dec != null ? `Dec ${coords.dec.toFixed(4)}°` : ""}
          </span>
        </div>
      )}

      {/* Star info */}
      {star && (
        <>
          <h3 className={styles.modalSectionTitle}>
            {t("shop.exoplanet.modal.section.star")}
          </h3>
          <div className={styles.modalInfoGrid}>
            {star.name && (
              <div className={styles.modalInfoRow}>
                <span className={styles.modalLabel}>Name</span>
                <span className={styles.modalValue}>{star.name}</span>
              </div>
            )}
            {star.spectralType && (
              <div className={styles.modalInfoRow}>
                <span className={styles.modalLabel}>Type</span>
                <span className={styles.modalValue}>{star.spectralType}</span>
              </div>
            )}
            {star.temperature != null && (
              <div className={styles.modalInfoRow}>
                <span className={styles.modalLabel}>
                  {t("shop.exoplanet.modal.temperature")}
                </span>
                <span className={styles.modalValue}>
                  {star.temperature.toLocaleString()} K
                </span>
              </div>
            )}
            {star.mass != null && (
              <div className={styles.modalInfoRow}>
                <span className={styles.modalLabel}>
                  {t("shop.exoplanet.modal.mass")}
                </span>
                <span className={styles.modalValue}>
                  {star.mass.toFixed(2)} M☉
                </span>
              </div>
            )}
            {star.radius != null && (
              <div className={styles.modalInfoRow}>
                <span className={styles.modalLabel}>
                  {t("shop.exoplanet.modal.radius")}
                </span>
                <span className={styles.modalValue}>
                  {star.radius.toFixed(2)} R☉
                </span>
              </div>
            )}
            {star.age != null && (
              <div className={styles.modalInfoRow}>
                <span className={styles.modalLabel}>Age</span>
                <span className={styles.modalValue}>
                  {star.age.toFixed(1)} Gyr
                </span>
              </div>
            )}
          </div>
        </>
      )}

      {/* Planet info */}
      {planet && (
        <>
          <h3 className={styles.modalSectionTitle}>
            {t("shop.exoplanet.modal.section.planet")}
          </h3>
          <div className={styles.modalInfoGrid}>
            {planet.massEarth != null && (
              <div className={styles.modalInfoRow}>
                <span className={styles.modalLabel}>
                  {t("shop.exoplanet.modal.mass")}
                </span>
                <span className={styles.modalValue}>
                  {planet.massEarth.toFixed(2)} M⊕
                </span>
              </div>
            )}
            {planet.radiusEarth != null && (
              <div className={styles.modalInfoRow}>
                <span className={styles.modalLabel}>
                  {t("shop.exoplanet.modal.radius")}
                </span>
                <span className={styles.modalValue}>
                  {planet.radiusEarth.toFixed(2)} R⊕
                </span>
              </div>
            )}
            {planet.density != null && (
              <div className={styles.modalInfoRow}>
                <span className={styles.modalLabel}>Density</span>
                <span className={styles.modalValue}>
                  {planet.density.toFixed(2)} g/cm³
                </span>
              </div>
            )}
            {planet.temperatureK != null && (
              <div className={styles.modalInfoRow}>
                <span className={styles.modalLabel}>
                  {t("shop.exoplanet.modal.temperature")}
                </span>
                <span className={styles.modalValue}>
                  {planet.temperatureK.toLocaleString()} K
                </span>
              </div>
            )}
            {planet.orbitalPeriodDays != null && (
              <div className={styles.modalInfoRow}>
                <span className={styles.modalLabel}>Orbital period</span>
                <span className={styles.modalValue}>
                  {planet.orbitalPeriodDays.toFixed(1)} days
                </span>
              </div>
            )}
            {planet.semiMajorAxisAU != null && (
              <div className={styles.modalInfoRow}>
                <span className={styles.modalLabel}>Semi-major axis</span>
                <span className={styles.modalValue}>
                  {planet.semiMajorAxisAU.toFixed(3)} AU
                </span>
              </div>
            )}
            {planet.eccentricity != null && (
              <div className={styles.modalInfoRow}>
                <span className={styles.modalLabel}>Eccentricity</span>
                <span className={styles.modalValue}>
                  {planet.eccentricity.toFixed(3)}
                </span>
              </div>
            )}
            {planet.insolationEarth != null && (
              <div className={styles.modalInfoRow}>
                <span className={styles.modalLabel}>Insolation</span>
                <span className={styles.modalValue}>
                  {planet.insolationEarth.toFixed(2)} × Earth
                </span>
              </div>
            )}
          </div>
        </>
      )}

      {/* Discovery info */}
      {discovery && (discovery.year || discovery.method || discovery.facility) && (
        <>
          <h3 className={styles.modalSectionTitle}>
            {t("shop.exoplanet.modal.section.discovery")}
          </h3>
          <div className={styles.modalInfoGrid}>
            {discovery.year && (
              <div className={styles.modalInfoRow}>
                <span className={styles.modalLabel}>Year</span>
                <span className={styles.modalValue}>{discovery.year}</span>
              </div>
            )}
            {discovery.method && (
              <div className={styles.modalInfoRow}>
                <span className={styles.modalLabel}>Method</span>
                <span className={styles.modalValue}>{discovery.method}</span>
              </div>
            )}
            {discovery.facility && (
              <div className={styles.modalInfoRow}>
                <span className={styles.modalLabel}>Facility</span>
                <span className={styles.modalValue}>{discovery.facility}</span>
              </div>
            )}
          </div>
        </>
      )}

      {/* External links */}
      {links.length > 0 && (
        <div className={styles.modalLinks}>
          <span className={styles.modalLabel}>
            {t("shop.exoplanet.modal.links")}
          </span>
          <div className={styles.modalLinkGroup}>
            {links.map(([source, url]) => (
              <a
                key={source}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.modalLink}
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

export default ExoplanetPreviewModal;
