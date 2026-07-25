import { useTranslation } from "react-i18next";
import styles from "./ShopScreen.module.css";

interface CreditSuccessProps {
  credits: number;
  newBalance: number;
  onContinue: () => void;
}

const CreditSuccess = ({ credits, newBalance, onContinue }: CreditSuccessProps) => {
  const { t } = useTranslation();

  return (
    <div className={styles.successView}>
      <div className={styles.successIcon}>⭐</div>
      <h2 className={styles.successTitle}>{t("shop.credits.successTitle")}</h2>
      <p className={styles.successText}>
        {t("shop.credits.successText", { credits })}
      </p>
      <p className={styles.successText}>
        {t("shop.credits.newBalance", { balance: newBalance })}
      </p>
      <button
        type="button"
        className={styles.successContinueBtn}
        onClick={onContinue}
      >
        {t("shop.credits.back")}
      </button>
    </div>
  );
};

export default CreditSuccess;
