import { useTranslation } from "react-i18next";
import { CREDIT_PACKS } from "../../constants/shopCatalog";
import styles from "./ShopScreen.module.css";

interface CreditShopViewProps {
  onBuyCredits: (packId: string) => void;
}

const CreditShopView = ({ onBuyCredits }: CreditShopViewProps) => {
  const { t } = useTranslation();

  return (
    <div className={styles.productGrid}>
      {CREDIT_PACKS.map((pack) => (
        <div key={pack.id} className={`${styles.productCard} ${styles.creditCard}`}>
          <div className={styles.creditAmount}>⭐ {pack.credits}</div>
          <div className={styles.creditPrice}>
            {t("shop.credits.price", { price: pack.priceEur })}
          </div>
          <div className={styles.productCardActions}>
            <button
              type="button"
              className={styles.buyBtn}
              onClick={() => onBuyCredits(pack.id)}
            >
              {t("shop.credits.buy")}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default CreditShopView;
