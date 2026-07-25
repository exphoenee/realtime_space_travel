import { useTranslation } from "react-i18next";
import styles from "./ShopScreen.module.css";

interface CheckoutSuccessProps {
  onContinue: () => void;
}

const CheckoutSuccess = ({ onContinue }: CheckoutSuccessProps) => {
  const { t } = useTranslation();

  return (
    <div className={styles.successView}>
      <div className={styles.successIcon}>🚀</div>
      <h2 className={styles.successTitle}>{t("shop.success.title")}</h2>
      <p className={styles.successText}>{t("shop.success.text")}</p>
      <button
        type="button"
        className={styles.successContinueBtn}
        onClick={onContinue}
      >
        {t("shop.success.continue")}
      </button>
    </div>
  );
};

export default CheckoutSuccess;
