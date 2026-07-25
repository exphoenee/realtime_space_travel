import { useTranslation } from "react-i18next";
import useShopStore from "../../state/useShopStore";
import styles from "./ShopScreen.module.css";

interface CartButtonProps {
  onClick: () => void;
}

const CartButton = ({ onClick }: CartButtonProps) => {
  const { t } = useTranslation();
  const itemCount = useShopStore((s) => s.cart.length);

  return (
    <button
      type="button"
      className={styles.cartButton}
      onClick={onClick}
      aria-label={t("shop.cart.title")}
    >
      🛒
      {itemCount > 0 && (
        <span className={styles.cartBadge}>{itemCount}</span>
      )}
    </button>
  );
};

export default CartButton;
