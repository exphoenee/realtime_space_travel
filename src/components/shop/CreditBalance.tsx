import { useTranslation } from "react-i18next";
import useShopStore from "../../state/useShopStore";
import styles from "./ShopScreen.module.css";

const CreditBalance = () => {
  const { t } = useTranslation();
  const credits = useShopStore((s) => s.credits);
  const creditsLoaded = useShopStore((s) => s.creditsLoaded);

  return (
    <div className={styles.creditBalance}>
      <span>{creditsLoaded ? t("shop.creditsLabel", { count: credits }) : "—"}</span>
    </div>
  );
};

export default CreditBalance;
