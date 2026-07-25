import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import useShopStore from "../../state/useShopStore";
import { SHOP_SHIPS, SHOP_MUSIC, mapExoplanet, CREDITS_PER_EUR } from "../../constants/shopCatalog";
import type { ExoplanetRaw } from "../../constants/shopCatalog";
import styles from "./ShopScreen.module.css";
import exoplanetsData from "../../data/exoplanets.json";

interface CartViewProps {
  onCheckout: () => void;
  onBack: () => void;
  onBuyCredits: () => void;
}

const useExoplanetLookup = () => {
  return useMemo(() => {
    const raw = exoplanetsData as unknown as ExoplanetRaw[];
    const map = new Map<string, string>();
    raw.forEach((r, i) => {
      const exo = mapExoplanet(r, i);
      map.set(exo.id, exo.name);
    });
    return map;
  }, []);
};

const getNameById = (
  id: string,
  category: string,
  exoLookup: Map<string, string>,
): string => {
  if (category === "ship") {
    const ship = SHOP_SHIPS.find((s) => s.id === id);
    if (ship) return ship.name;
  }
  if (category === "music") {
    const music = SHOP_MUSIC.find((m) => m.id === id);
    if (music) return music.name;
  }
  if (category === "exoplanet") {
    return exoLookup.get(id) ?? id;
  }
  return id;
};

const CartView = ({ onCheckout, onBack, onBuyCredits }: CartViewProps) => {
  const { t } = useTranslation();
  const cart = useShopStore((s) => s.cart);
  const credits = useShopStore((s) => s.credits);
  const removeFromCart = useShopStore((s) => s.removeFromCart);
  const exoLookup = useExoplanetLookup();

  const totalCredits = cart.reduce((sum, item) => sum + item.priceCredits, 0);
  const totalEur = cart.reduce((sum, item) => sum + item.priceCredits / CREDITS_PER_EUR, 0);
  const notEnough = credits < totalCredits;

  return (
    <div className={styles.cartView}>
      <h2 className={styles.title}>{t("shop.cart.title")}</h2>
      {cart.length === 0 ? (
        <div className={styles.successView}>
          <p className={styles.noResult}>{t("shop.cart.empty")}</p>
          <button type="button" className={styles.cartBackBtn} onClick={onBack}>
            ← {t("shop.back")}
          </button>
        </div>
      ) : (
        <>
          <div className={styles.cartList}>
            {cart.map((item) => (
              <div key={item.id} className={styles.cartItem}>
                <div className={styles.cartItemInfo}>
                  <span className={styles.cartItemName}>{getNameById(item.id, item.category, exoLookup)}</span>
                  <span className={styles.cartItemPrice}>⭐ {item.priceCredits}</span>
                </div>
                <button
                  type="button"
                  className={styles.cartRemoveBtn}
                  onClick={() => removeFromCart(item.id)}
                >
                  {t("shop.remove")}
                </button>
              </div>
            ))}
          </div>
          <div className={styles.cartFooter}>
            <div className={styles.cartTotal}>
              <span>{t("shop.cart.total")}</span>
              <span>⭐ {totalCredits.toFixed(0)} (€{totalEur.toFixed(2)})</span>
            </div>
            {notEnough && (
              <>
                <p className={styles.errorText}>{t("shop.notEnoughCredits")}</p>
                <p className={styles.hintText} onClick={onBuyCredits}>
                  {t("shop.credits.notEnoughCreditsHint")}
                </p>
              </>
            )}
            <div className={styles.cartActions}>
              <button type="button" className={styles.cartBackBtn} onClick={onBack}>
                ← {t("shop.back")}
              </button>
              <button
                type="button"
                className={styles.checkoutBtn}
                onClick={onCheckout}
                disabled={notEnough}
              >
                {t("shop.cart.checkout")}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default CartView;
