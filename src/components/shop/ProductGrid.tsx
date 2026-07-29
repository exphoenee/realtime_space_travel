import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { CartItem, ShipProduct, ExoplanetProduct } from "../../types";
import { DEFAULT_SHIP, SHOP_SHIPS, SHOP_MUSIC, BASE_EXOPLANETS } from "../../constants/shopCatalog";
import { mapExoplanet } from "../../constants/shopCatalog";
import type { ExoplanetRaw } from "../../constants/shopCatalog";
import useShopStore from "../../state/useShopStore";
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

/** Extract sortable values from any product item. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getSortValues = (item: any) => {
  if ("product" in item && item.product) {
    return { priceCredits: item.product.priceCredits ?? 0, distanceLy: item.product.distanceLy ?? 0, speedKmPerSecond: 0 };
  }
  return {
    priceCredits: item.priceCredits ?? 0,
    distanceLy: "distanceLy" in item ? (item.distanceLy ?? 0) : 0,
    speedKmPerSecond: "speedKmPerSecond" in item ? (item.speedKmPerSecond ?? 0) : 0,
  };
};

const ProductGrid = ({ category, onAddToCart }: ProductGridProps) => {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("price-asc");
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

  const boughtCreditPacks = useShopStore((s) => s.boughtCreditPacks);
  const whaleUnlocked = boughtCreditPacks.length >= 4;

  const products = useMemo(() => {
    // Exoplanets: JSON exoplanets wrapped with raw data, PLUS base planets as flat items
    if (category === "exoplanets")
      return [...BASE_EXOPLANETS, ...exoplanets];
    if (category === "ships") {
      // Hide the whale ship (LD-42 Long Drop) until all 4 credit packs are bought
      const ships = [DEFAULT_SHIP, ...SHOP_SHIPS];
      if (!whaleUnlocked) {
        return ships.filter((s) => s.id !== "ship-17");
      }
      return ships;
    }
    if (category === "music") return SHOP_MUSIC;
    return [];
  }, [category, exoplanets, whaleUnlocked]);

  const filtered = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let result: any[] = products;

    // Apply search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((p) => {
        const name = "product" in p ? p.product.name : p.name;
        return name.toLowerCase().includes(q);
      });
    }

    // Apply sorting (always active — default is price-asc)
    const [field, dir] = sortBy.split("-") as [string, "asc" | "desc"];
    const multiplier = dir === "asc" ? 1 : -1;

    result = [...result].sort((a, b) => {
      const va = getSortValues(a);
      const vb = getSortValues(b);
      let diff = 0;
      if (field === "price") diff = va.priceCredits - vb.priceCredits;
      else if (field === "speed") diff = va.speedKmPerSecond - vb.speedKmPerSecond;
      else if (field === "distance") diff = va.distanceLy - vb.distanceLy;
      return diff * multiplier;
    });

    return result;
  }, [products, search, sortBy]);

  return (
    <div className={styles.productGridWrapper}>
      <div className={styles.filterRow}>
        <input
          type="text"
          className={styles.searchInput}
          placeholder={t("shop.search")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {category !== "music" && (
          <select
            className={styles.sortSelect}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            {category === "ships" && (
              <>
                <option value="price-asc">{t("shop.sort.priceAsc")}</option>
                <option value="price-desc">{t("shop.sort.priceDesc")}</option>
                <option value="speed-asc">{t("shop.sort.speedAsc")}</option>
                <option value="speed-desc">{t("shop.sort.speedDesc")}</option>
              </>
            )}
            {category === "exoplanets" && (
              <>
                <option value="price-asc">{t("shop.sort.priceAsc")}</option>
                <option value="price-desc">{t("shop.sort.priceDesc")}</option>
                <option value="distance-asc">{t("shop.sort.distanceAsc")}</option>
                <option value="distance-desc">{t("shop.sort.distanceDesc")}</option>
              </>
            )}
          </select>
        )}
      </div>
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
