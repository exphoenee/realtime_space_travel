import { useTranslation } from "react-i18next";
import type { ShipProduct, MusicProduct, ExoplanetProduct, CartItem } from "../../types";
import useShopStore from "../../state/useShopStore";
import MusicPreviewButton from "./MusicPreviewButton";
import styles from "./ShopScreen.module.css";

type Product = ShipProduct | MusicProduct | ExoplanetProduct;

interface ProductCardProps {
  product: Product;
  onAddToCart: (item: CartItem) => void;
  onPreview?: () => void;
}

const ProductCard = ({ product, onAddToCart, onPreview }: ProductCardProps) => {
  const { t } = useTranslation();
  const isOwned = useShopStore((s) => s.isOwned)(product.category, product.id);
  const isInCart = useShopStore((s) => s.cart.some((item) => item.id === product.id));
  const cart = useShopStore((s) => s.cart);
  const credits = useShopStore((s) => s.credits);
  const cartTotal = cart.reduce((sum, item) => sum + item.priceCredits, 0);
  const canAfford = credits >= (cartTotal + product.priceCredits);

  const handleClick = () => {
    if (isOwned) return;
    if (isInCart) {
      useShopStore.getState().removeFromCart(product.id);
      return;
    }
    onAddToCart({
      id: product.id,
      category: product.category as "exoplanet" | "ship" | "music",
      priceCredits: product.priceCredits,
    });
  };

  const renderMeta = () => {
    if (product.category === "ship") {
      const ship = product as ShipProduct;
      return (
        <>
          <p className={styles.productMeta}>
            {t("shop.ship.speed", { value: ship.speedKmPerSecond })}
          </p>
          <p className={styles.productMeta}>
            {t("shop.ship.manufacturer", { name: ship.manufacturer })}
          </p>
        </>
      );
    }
    if (product.category === "exoplanet") {
      const exo = product as ExoplanetProduct;
      return (
        <>
          <p className={styles.productMeta}>
            {t("shop.exoplanet.distance", { value: exo.distanceLy.toFixed(2) })}
          </p>
          <p className={styles.productMeta}>
            {t("shop.exoplanet.star", { name: exo.starName })}
          </p>
        </>
      );
    }
    if (product.category === "music") {
      const music = product as MusicProduct;
      return (
        <MusicPreviewButton file={music.file} title={music.title} />
      );
    }
    return null;
  };

  const getButtonLabel = () => {
    if (isOwned) return t("shop.owned");
    if (isInCart) return t("shop.remove");
    return t("shop.addToCart");
  };

  const getButtonClass = () => {
    if (isOwned) return `${styles.productButton} ${styles.ownedBtn}`;
    if (isInCart) return `${styles.productButton} ${styles.removeBtn}`;
    if (!canAfford) return `${styles.productButton} ${styles.disabledBtn}`;
    return `${styles.productButton} ${styles.addToCartBtn}`;
  };

  return (
    <div className={styles.productCard}>
      <h3 className={styles.productName}>{product.name}</h3>
      {renderMeta()}
      <p className={styles.productPrice}>
        ⭐ {product.priceCredits}{" "}
        <span className={styles.productPriceEur}>(€{product.priceEur.toFixed(2)})</span>
      </p>
      <div className={styles.productCardActions}>
        {(product.category === "exoplanet" || product.category === "ship") && onPreview && (
          <button
            type="button"
            className={styles.previewBtn}
            onClick={onPreview}
          >
            {product.category === "exoplanet"
              ? t("shop.exoplanet.preview")
              : t("shop.ship.preview")}
          </button>
        )}
        <button
          type="button"
          className={getButtonClass()}
          onClick={handleClick}
          disabled={isOwned || (!isInCart && !canAfford)}
        >
          {getButtonLabel()}
        </button>
      </div>
    </div>
  );
};

export default ProductCard;
