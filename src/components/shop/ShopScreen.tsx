import { useState } from "react";
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
import CreditShopView from "./CreditShopView";
import CreditSuccess from "./CreditSuccess";
import styles from "./ShopScreen.module.css";

type ShopView = "browse" | "cart" | "success" | "creditSuccess";

const ShopScreen = () => {
  const { t } = useTranslation();
  const transitionTo = useGameStore((s) => s.transitionTo);
  const [view, setView] = useState<ShopView>("browse");
  const [activeTab, setActiveTab] = useState<string>("exoplanets");
  const [lastCredits, setLastCredits] = useState(0);
  const lastCreditsAmount = useShopStore((s) => s.credits);

  const handleBack = () => {
    if (view !== "browse") {
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

  const handleBuyCredits = (packId: string) => {
    useShopStore.getState().buyCredits(packId);
    setLastCredits(
      CREDIT_PACKS.find((p) => p.id === packId)?.credits ?? 0,
    );
    setView("creditSuccess");
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
                  <CreditShopView onBuyCredits={handleBuyCredits} />
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
            <CheckoutSuccess onContinue={() => setView("browse")} />
          )}
          {view === "creditSuccess" && (
            <CreditSuccess
              credits={lastCredits}
              newBalance={lastCreditsAmount}
              onContinue={() => setView("browse")}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default ShopScreen;
