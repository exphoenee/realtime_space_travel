import { useTranslation } from "react-i18next";
import useShopStore from "../../state/useShopStore";
import styles from "./ShopScreen.module.css";

interface PurchaseHistoryProps {
  onBack: () => void;
}

const PurchaseHistory: React.FC<PurchaseHistoryProps> = ({ onBack }) => {
  const { t } = useTranslation();
  const purchaseHistory = useShopStore((s) => s.purchaseHistory);

  const formatDate = (ts: number): string => {
    const d = new Date(ts);
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getCategoryIcon = (category: string): string => {
    switch (category) {
      case "ship": return "🚀";
      case "music": return "🎵";
      case "exoplanet": return "🪐";
      case "credits": return "⭐";
      default: return "📦";
    }
  };

  return (
    <div className={styles.historyContainer}>
      <div className={styles.historyHeader}>
        <button type="button" className={styles.backButton} onClick={onBack}>
          ← {t("shop.back")}
        </button>
        <h2 className={styles.historyTitle}>{t("shop.history.title")}</h2>
      </div>
      <div className={styles.historyList}>
        {purchaseHistory.length === 0 ? (
          <p className={styles.historyEmpty}>{t("shop.history.empty")}</p>
        ) : (
          purchaseHistory.map((entry) => (
            <div key={entry.id} className={styles.historyEntry}>
              <span className={styles.historyEntryIcon}>
                {getCategoryIcon(entry.category)}
              </span>
              <div className={styles.historyEntryInfo}>
                <span className={styles.historyEntryName}>
                  {entry.category === "credits" ? t(entry.itemName) : entry.itemName}
                </span>
                <span className={styles.historyEntryDate}>
                  {formatDate(entry.purchasedAt)}
                </span>
              </div>
              <span className={styles.historyEntryCredits}>
                {entry.category === "credits" ? "+" : "−"}{entry.credits} ⭐
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default PurchaseHistory;
