import { useTranslation } from "react-i18next";
import useShopStore from "../../state/useShopStore";
import styles from "./ShopScreen.module.css";

interface CartButtonProps {
  onClick: () => void;
}

const CartButton = ({ onClick }: CartButtonProps) => {
  const { t } = useTranslation();
  const cart = useShopStore((s) => s.cart);
  const itemCount = cart.length;
  const totalCredits = cart.reduce((sum, item) => sum + item.priceCredits, 0);

  return (
    <button
      type="button"
      className={styles.cartButton}
      onClick={onClick}
      aria-label={t("shop.cart.title")}
    >
      🛒
      {itemCount > 0 && (
        <>
          <span className={styles.cartBadge}>{itemCount}</span>
          <span className={styles.cartTotalLabel}>
            ⭐{totalCredits.toFixed(0)}
          </span>
        </>
      )}
    </button>
  );
};

export default CartButton;
