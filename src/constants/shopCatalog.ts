import type { CreditPack, ShipProduct, MusicProduct, ExoplanetProduct } from "../types";

export const CREDITS_PER_EUR = 100;          // 100 ⭐ = 1 € (tájékoztató jellegű)
export const STARTING_CREDITS = 0;           // kezdő egyenleg normál módban — nulláról indul!
export const DEBUG_STARTING_CREDITS = 9000;  // kezdő egyenleg VITE_DEBUG_MODE=true esetén (teszteléshez)

export const eurFromCredits = (c: number) => Math.round((c / CREDITS_PER_EUR) * 100) / 100;

export const CREDIT_PACKS: CreditPack[] = [
  {
    id: "credits-starter",
    nameKey: "shop.credits.starter",
    priceEur: 5,
    credits: 100,
    stripePaymentLink: "https://buy.stripe.com/test_6oU14o2bg8sSfIM3XAeIw00",
  },
  {
    id: "credits-advanced",
    nameKey: "shop.credits.advanced",
    priceEur: 10,
    credits: 300,
    stripePaymentLink: "https://buy.stripe.com/test_28E5kE6rwcJ89koalYeIw01",
  },
  {
    id: "credits-premium",
    nameKey: "shop.credits.premium",
    priceEur: 25,
    credits: 700,
    stripePaymentLink: "https://buy.stripe.com/test_5kQdRacPUgZocwA9hUeIw02",
  },
  {
    id: "credits-ultra",
    nameKey: "shop.credits.ultra",
    priceEur: 100,
    credits: 2000,
    stripePaymentLink: "https://buy.stripe.com/test_5kQ9AUg26fVk0NSalYeIw03",
  },
];

/**
 * Pick the Payment Link matching the current environment.
 *
 * A Payment Link's `after_completion.redirect.url` is stored on the Stripe
 * object, so it cannot be chosen at click time — dev and prod need their own
 * link. Run `node scripts/create_payment_links.mjs` with a localhost redirect
 * to generate the dev set, then fill in `stripePaymentLinkDev` above.
 */
export const getPaymentLinkUrl = (pack: CreditPack): string =>
  (import.meta.env.DEV && pack.stripePaymentLinkDev) || pack.stripePaymentLink;

export const SHOP_SHIPS: ShipProduct[] = [
  {
    id: "ship-0",
    category: "ship",
    name: "Nomad X1",
    priceCredits: 150,
    priceEur: 1.50,
    speedKmPerSecond: 380,
    manufacturer: "Orion Shipyards",
    capacity: 4,
    rangeLy: 20,
    descriptionKey: "shop.ship.nomadX1.desc",
  },
  {
    id: "ship-1",
    category: "ship",
    name: "Vega Runner",
    priceCredits: 400,
    priceEur: 4.00,
    speedKmPerSecond: 920,
    manufacturer: "Helios Dynamics",
    capacity: 8,
    rangeLy: 60,
    descriptionKey: "shop.ship.vegaRunner.desc",
  },
  {
    id: "ship-2",
    category: "ship",
    name: "Aether Titan",
    priceCredits: 1000,
    priceEur: 10.00,
    speedKmPerSecond: 2400,
    manufacturer: "Nova Consortium",
    capacity: 20,
    rangeLy: 200,
    descriptionKey: "shop.ship.aetherTitan.desc",
  },
];

export const SHOP_MUSIC: MusicProduct[] = [
  { id: "music-0", category: "music", name: "Dust on the Highway",   priceCredits: 30, priceEur: 0.30, file: "dust_on_the_highway.mp3", title: "Dust on the Highway" },
  { id: "music-1", category: "music", name: "Late Night Urgency",    priceCredits: 30, priceEur: 0.30, file: "late_night_urgency.mp3",  title: "Late Night Urgency" },
  { id: "music-2", category: "music", name: "Neon Heartbeat",        priceCredits: 30, priceEur: 0.30, file: "neon_heartbeat.mp3",      title: "Neon Heartbeat" },
  { id: "music-3", category: "music", name: "Neon Static",           priceCredits: 30, priceEur: 0.30, file: "neon_static.mp3",         title: "Neon Static" },
  { id: "music-4", category: "music", name: "Rust in the Gears",     priceCredits: 30, priceEur: 0.30, file: "rust_in_the_gears.mp3",   title: "Rust in the Gears" },
];

/** Exobolygó ár-képlet (determinisztikus, csak a bolygó-adatból) */
export const calcExoplanetPrice = (
  distanceLy: number,
  massEarth: number | null,
  temperatureK: number | null,
): number => {
  return Math.round(
    50
    + distanceLy * 5
    + (massEarth ?? 1) * 10
    + Math.abs((temperatureK ?? 288) - 288) * 0.2
  );
};

/** Exobolygó wage (küldetés-jutalom, determinisztikus) */
export const calcExoplanetWage = (
  distanceLy: number,
  massEarth: number | null,
): number => {
  return Math.round(distanceLy * 3 + (massEarth ?? 1) * 2);
};

/** A 3 alap exobolygó — a játékos induláskor birtokolja őket */
export const BASE_EXOPLANETS: ExoplanetProduct[] = [
  {
    id: "exo-0",
    category: "exoplanet",
    name: "Proxima Centauri",
    priceCredits: 0,
    priceEur: 0,
    distanceLy: 4.24,
    wage: 15,
    starName: "Proxima Centauri",
    temperatureK: null,
    massEarth: null,
  },
  {
    id: "exo-1",
    category: "exoplanet",
    name: "Wolf 424",
    priceCredits: 0,
    priceEur: 0,
    distanceLy: 14.31,
    wage: 45,
    starName: "Wolf 424",
    temperatureK: null,
    massEarth: null,
  },
  {
    id: "exo-2",
    category: "exoplanet",
    name: "Ross 780",
    priceCredits: 0,
    priceEur: 0,
    distanceLy: 15.34,
    wage: 50,
    starName: "Ross 780",
    temperatureK: null,
    massEarth: null,
  },
];

export const BASE_EXOPLANET_IDS = BASE_EXOPLANETS.map((e) => e.id);

/** Nyers exobolygó JSON struktúra */
export interface ExoplanetRaw {
  name: string;
  distance: {
    parsec: number;
    lightYears: number;
  };
  coordinates?: {
    ra?: number;
    dec?: number;
  };
  star?: {
    name?: string;
    temperature?: number;
    mass?: number;
    radius?: number;
    age?: number;
    spectralType?: string;
  };
  planet?: {
    massEarth?: number;
    radiusEarth?: number;
    density?: number;
    orbitalPeriodDays?: number;
    semiMajorAxisAU?: number;
    eccentricity?: number;
    temperatureK?: number;
    insolationEarth?: number;
  };
  discovery?: {
    year?: number;
    method?: string;
    facility?: string;
  };
  images?: {
    ESA?: string;
    NASA?: string;
    Wikipedia?: string;
  };
  links?: {
    NASA?: string;
    Wikipedia?: string;
  };
}

/** Nyers exobolygó adat → ExoplanetProduct */
export const mapExoplanet = (raw: ExoplanetRaw, index: number): ExoplanetProduct => {
  const distanceLy = raw.distance?.lightYears ?? 0;
  const massEarth = raw.planet?.massEarth ?? null;
  const temperatureK = raw.planet?.temperatureK ?? null;

  return {
    id: `exo-${BASE_EXOPLANETS.length + index}`,
    category: "exoplanet",
    name: raw.name,
    priceCredits: calcExoplanetPrice(distanceLy, massEarth, temperatureK),
    priceEur: eurFromCredits(calcExoplanetPrice(distanceLy, massEarth, temperatureK)),
    distanceLy,
    wage: calcExoplanetWage(distanceLy, massEarth),
    starName: raw.star?.name ?? "Unknown",
    temperatureK,
    massEarth,
  };
};
