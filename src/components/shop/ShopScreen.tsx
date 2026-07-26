import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import useGameStore from "../../state/useGameStore";
import useShopStore from "../../state/useShopStore";
import { CREDIT_PACKS } from "../../constants/shopCatalog";
import CreditBalance from "./CreditBalance";
import CartButton from "./CartButton";
import ShopTabs from "./ShopTabs";
import ProductGrid from "./ProductGrid";
import CartView from "./CartView";
import CheckoutSuccess from "./CheckoutSuccess";
import CreditShopView, { PENDING_PURCHASE_KEY } from "./CreditShopView";
import CreditSuccess from "./CreditSuccess";
import styles from "./ShopScreen.module.css";

type ShopView = "browse" | "cart" | "success" | "creditSuccess";

/** Max age for a pending purchase (10 minutes). */
const PENDING_PURCHASE_TTL = 10 * 60 * 1000;

const ShopScreen = () => {
  const { t } = useTranslation();
  const transitionTo = useGameStore((s) => s.transitionTo);
  const [view, setView] = useState<ShopView>("browse");
  const activeTab = useShopStore((s) => s.activeShopTab);
  const setActiveTab = useShopStore((s) => s.setActiveShopTab);
  const [lastCredits, setLastCredits] = useState(0);
  const lastCreditsAmount = useShopStore((s) => s.credits);

  // On mount, check for a pending Stripe purchase (user returning from Payment Link).
  // Reads from both sessionStorage and localStorage — the data was saved to both
  // before redirecting to Stripe (see CreditShopView), and localStorage survives
  // a full page load on the same origin.
  useEffect(() => {
    let raw = sessionStorage.getItem(PENDING_PURCHASE_KEY);
    if (!raw) {
      // Fall back to localStorage (persists across page loads on same origin)
      raw = localStorage.getItem(PENDING_PURCHASE_KEY);
    }
    if (!raw) return;

    const clear = () => {
      sessionStorage.removeItem(PENDING_PURCHASE_KEY);
      localStorage.removeItem(PENDING_PURCHASE_KEY);
    };

    try {
      const pending = JSON.parse(raw);
      // Expired or invalid
      if (!pending.packId || !pending.credits || Date.now() - pending.timestamp > PENDING_PURCHASE_TTL) {
        clear();
        return;
      }

      // Find the pack to confirm the credits amount matches
      const pack = CREDIT_PACKS.find((p) => p.id === pending.packId);
      if (!pack || pack.credits !== pending.credits) {
        clear();
        return;
      }

      // Add credits locally + persist to RTDB (buyCredits handles the write)
      useShopStore.getState().buyCredits(pack.id);

      // Show success screen
      setLastCredits(pack.credits);
      setView("creditSuccess");

      // Clean up both storages
      clear();
    } catch {
      clear();
    }
  }, []);

  /**
   * Clean up the URL by removing the /shop/success path segment,
   * so a page refresh doesn't re-trigger the success flow.
   */
  const cleanSuccessUrl = () => {
    const path = window.location.pathname;
    if (path.includes("/shop/success")) {
      const cleanPath = path.replace(/\/shop\/success.*$/, "") || "/";
      window.history.replaceState(null, "", cleanPath);
    }
  };

  const handleBack = () => {
    if (view !== "browse") {
      cleanSuccessUrl();
      setView("browse");
    } else {
      transitionTo("mainMenu");
    }
  };

  const handleCheckout = () => {
    const result = useShopStore.getState().checkout();
    if (result.ok) {
      setView("success");
    }
  };

  const isDebug = import.meta.env.VITE_DEBUG_MODE === "true";

  const handleReset = () => {
    useShopStore.getState().resetShop();
    setView("browse");
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.container}>
        {/* Header */}
        <div className={styles.header}>
          <button className={styles.backButton} onClick={handleBack}>
            {t("shop.back")}
          </button>
          <h1 className={styles.title}>{t("shop.title")}</h1>
          <div className={styles.headerRight}>
            {isDebug && view === "browse" && (
              <button
                type="button"
                className={styles.resetBtn}
                onClick={handleReset}
                title="Reset shop (debug)"
              >
                ↺ Reset
              </button>
            )}
            <CreditBalance />
            {view === "browse" && (
              <div className={activeTab === "credits" ? styles.cartButtonGhost : undefined}>
                <CartButton onClick={() => setView("cart")} />
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className={styles.content}>
          {view === "browse" && (
            <>
              <ShopTabs activeTab={activeTab} onTabChange={setActiveTab} />
              <div className={styles.tabPanel}>
                {activeTab === "credits" ? (
                  <CreditShopView />
                ) : (
                  <ProductGrid
                    category={activeTab}
                    onAddToCart={(item) => {
                      useShopStore.getState().addToCart(item);
                    }}
                  />
                )}
              </div>
            </>
          )}
          {view === "cart" && (
            <CartView
              onCheckout={handleCheckout}
              onBack={() => setView("browse")}
              onBuyCredits={() => {
                setActiveTab("credits");
                setView("browse");
              }}
            />
          )}
          {view === "success" && (
            <CheckoutSuccess onContinue={() => { cleanSuccessUrl(); setView("browse"); }} />
          )}
          {view === "creditSuccess" && (
            <CreditSuccess
              credits={lastCredits}
              newBalance={lastCreditsAmount}
              onContinue={() => { cleanSuccessUrl(); setView("browse"); }}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default ShopScreen;
