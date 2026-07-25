import { useTranslation } from "react-i18next";
import useShopStore from "../../state/useShopStore";
import styles from "./ShopScreen.module.css";

const CreditBalance = () => {
  const { t } = useTranslation();
  const credits = useShopStore((s) => s.credits);

  return (
    <div className={styles.creditBalance}>
      <span>{t("shop.creditsLabel", { count: credits })}</span>
    </div>
  );
};

export default CreditBalance;
