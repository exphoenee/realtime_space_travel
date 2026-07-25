import { useTranslation } from "react-i18next";
import type { ShipProduct, CartItem } from "../../types";
import useShopStore from "../../state/useShopStore";
import Modal from "../ui/Modal";
import styles from "./ShopScreen.module.css";

interface ShipPreviewModalProps {
  product: ShipProduct;
  onAddToCart: (item: CartItem) => void;
  onClose: () => void;
}

const ShipPreviewModal = ({
  product,
  onAddToCart,
  onClose,
}: ShipPreviewModalProps) => {
  const { t } = useTranslation();

  const isOwned = useShopStore((s) => s.isOwned)("ship", product.id);
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
      category: "ship",
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
      title={product.name}
      closeAriaLabel={t("shop.ship.modal.close")}
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
              {t("shop.ship.modal.close")}
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
      {/* Ship icon / visual placeholder */}
      <div className={styles.shipPreviewVisual}>
        <span className={styles.shipPreviewEmoji}>🚀</span>
      </div>

      {/* Description */}
      <p className={styles.shipDescription}>
        {t(product.descriptionKey)}
      </p>

      {/* Specs */}
      <h3 className={styles.modalSectionTitle}>
        {t("shop.ship.modal.specs")}
      </h3>
      <div className={styles.modalInfoGrid}>
        <div className={styles.modalInfoRow}>
          <span className={styles.modalLabel}>
            {t("shop.ship.speedLabel")}
          </span>
          <span className={styles.modalValue}>
            {product.speedKmPerSecond.toLocaleString()} km/s
          </span>
        </div>
        <div className={styles.modalInfoRow}>
          <span className={styles.modalLabel}>
            {t("shop.ship.manufacturerLabel")}
          </span>
          <span className={styles.modalValue}>{product.manufacturer}</span>
        </div>
        <div className={styles.modalInfoRow}>
          <span className={styles.modalLabel}>
            {t("shop.ship.capacityLabel")}
          </span>
          <span className={styles.modalValue}>
            {product.capacity} {t("shop.ship.crew")}
          </span>
        </div>
        <div className={styles.modalInfoRow}>
          <span className={styles.modalLabel}>
            {t("shop.ship.rangeLabel")}
          </span>
          <span className={styles.modalValue}>
            {product.rangeLy} {t("shop.ship.ly")}
          </span>
        </div>
      </div>
    </Modal>
  );
};

export default ShipPreviewModal;
