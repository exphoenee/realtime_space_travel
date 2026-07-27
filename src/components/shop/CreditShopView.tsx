import { useTranslation } from "react-i18next";
import { CREDIT_PACKS, getPaymentLinkUrl } from "../../constants/shopCatalog";
import useAuthStore from "../../state/useAuthStore";
import styles from "./ShopScreen.module.css";

/** Key used in sessionStorage + localStorage for pending credit purchases. */
export const PENDING_PURCHASE_KEY = "realtime_space_travel_pending_credit";

const CreditShopView = () => {
  const { t } = useTranslation();
  const isAnonymous = useAuthStore((s) => s.isAnonymous);

  const handleBuy = (packId: string) => {
    const pack = CREDIT_PACKS.find((p) => p.id === packId);
    if (!pack) return;

    // Store pending purchase in sessionStorage + localStorage so we can
    // credit the user when they return from the Stripe hosted payment page.
    // localStorage persists across page loads on the same origin (Firebase
    // Hosting), while sessionStorage is per-tab and cleared on close — using
    // both ensures the data survives the redirect+return cycle.
    const data = JSON.stringify({
      packId: pack.id,
      credits: pack.credits,
      timestamp: Date.now(),
    });
    sessionStorage.setItem(PENDING_PURCHASE_KEY, data);
    localStorage.setItem(PENDING_PURCHASE_KEY, data);

    // Redirect to Stripe Payment Link (dev links return to localhost)
    window.location.href = getPaymentLinkUrl(pack);
  };

  return (
    <>
      {/* Guest warning banner — shown for anonymous users */}
      {isAnonymous && (
        <div className={styles.guestWarning}>
          <span className={styles.guestWarningIcon}>⚠️</span>
          <span className={styles.guestWarningText}>
            {t("shop.credits.guestWarning")}
          </span>
        </div>
      )}
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
              onClick={() => handleBuy(pack.id)}
            >
              {t("shop.credits.buy")}
            </button>
          </div>
        </div>
      ))}
      </div>
    </>
  );
};

export default CreditShopView;
