import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { CartItem, ShipProduct } from "../../types";
import { SHOP_SHIPS, SHOP_MUSIC, BASE_EXOPLANETS } from "../../constants/shopCatalog";
import { mapExoplanet } from "../../constants/shopCatalog";
import type { ExoplanetRaw } from "../../constants/shopCatalog";
import ProductCard from "./ProductCard";
import ExoplanetPreviewModal from "./ExoplanetPreviewModal";
import ShipPreviewModal from "./ShipPreviewModal";
import styles from "./ShopScreen.module.css";

// Static import of exoplanet data
import exoplanetsData from "../../data/exoplanets.json";

interface ProductGridProps {
  category: string;
  onAddToCart: (item: CartItem) => void;
}

interface ExoplanetWithRaw {
  product: ReturnType<typeof mapExoplanet>;
  raw: ExoplanetRaw;
}

const ProductGrid = ({ category, onAddToCart }: ProductGridProps) => {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [previewExoplanet, setPreviewExoplanet] = useState<ExoplanetWithRaw | null>(null);
  const [previewShip, setPreviewShip] = useState<ShipProduct | null>(null);

  const rawExoplanets = useMemo(
    () => exoplanetsData as unknown as ExoplanetRaw[],
    [],
  );

  const exoplanets = useMemo(() => {
    return rawExoplanets.map((r, i) => ({
      product: mapExoplanet(r, i),
      raw: r,
    }));
  }, [rawExoplanets]);

  const products = useMemo(() => {
    // Exoplanets: JSON exoplanets wrapped with raw data, PLUS base planets as flat items
    if (category === "exoplanets")
      return [...BASE_EXOPLANETS, ...exoplanets];
    if (category === "ships")
      return [...SHOP_SHIPS].sort((a, b) => a.priceCredits - b.priceCredits);
    if (category === "music") return SHOP_MUSIC;
    return [];
  }, [category, exoplanets]);

  const filtered = useMemo(() => {
    if (!search.trim()) return products;
    const q = search.toLowerCase();
    return products.filter((p) => {
      const name = "product" in p ? p.product.name : p.name;
      return name.toLowerCase().includes(q);
    });
  }, [products, search]);

  return (
    <div className={styles.productGridWrapper}>
      <input
        type="text"
        className={styles.searchInput}
        placeholder={t("shop.search")}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {filtered.length === 0 ? (
        <p className={styles.noResult}>{t("shop.searchNoResult")}</p>
      ) : (
        <div className={styles.productGrid}>
          {filtered.map((item) => {
            // Exoplanets with raw data (JSON exoplanets) — has preview
            if ("product" in item) {
              return (
                <ProductCard
                  key={item.product.id}
                  product={item.product}
                  onAddToCart={onAddToCart}
                  onPreview={() => setPreviewExoplanet(item)}
                />
              );
            }
            // Flat items: ships, music, OR base exoplanets (no raw data)
            return (
              <ProductCard
                key={item.id}
                product={item}
                onAddToCart={onAddToCart}
                onPreview={
                  item.category === "ship"
                    ? () => setPreviewShip(item as ShipProduct)
                    : undefined
                }
              />
            );
          })}
        </div>
      )}

      {/* Exoplanet preview modal */}
      {previewExoplanet && (
        <ExoplanetPreviewModal
          data={previewExoplanet.raw}
          product={previewExoplanet.product}
          onAddToCart={onAddToCart}
          onClose={() => setPreviewExoplanet(null)}
        />
      )}

      {/* Ship preview modal */}
      {previewShip && (
        <ShipPreviewModal
          product={previewShip}
          onAddToCart={onAddToCart}
          onClose={() => setPreviewShip(null)}
        />
      )}
    </div>
  );
};

export default ProductGrid;
