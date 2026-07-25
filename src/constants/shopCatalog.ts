import type { CreditPack, ShipProduct, MusicProduct, ExoplanetProduct } from "../types";

export const CREDITS_PER_EUR = 100;          // 100 ⭐ = 1 € (tájékoztató jellegű)
export const STARTING_CREDITS = 0;           // kezdő egyenleg normál módban — nulláról indul!
export const DEBUG_STARTING_CREDITS = 9000;  // kezdő egyenleg VITE_DEBUG_MODE=true esetén (teszteléshez)

export const eurFromCredits = (c: number) => Math.round((c / CREDITS_PER_EUR) * 100) / 100;

export const CREDIT_PACKS: CreditPack[] = [
  { id: "credits-starter",  nameKey: "shop.credits.starter",  priceEur: 10,  credits: 100  },
  { id: "credits-advanced", nameKey: "shop.credits.advanced", priceEur: 25,  credits: 300  },
  { id: "credits-premium",  nameKey: "shop.credits.premium",  priceEur: 50,  credits: 700  },
  { id: "credits-ultra",    nameKey: "shop.credits.ultra",    priceEur: 100, credits: 2000 },
];

export const SHOP_SHIPS: ShipProduct[] = [
  {
    id: "ship-nomad-x1",
    category: "ship",
    name: "Nomad X1",
    priceCredits: 1200,
    priceEur: 12.00,
    speedKmPerSecond: 380,
    manufacturer: "Orion Shipyards",
    capacity: 4,
    rangeLy: 20,
    descriptionKey: "shop.ship.nomadX1.desc",
  },
  {
    id: "ship-vega-runner",
    category: "ship",
    name: "Vega Runner",
    priceCredits: 4500,
    priceEur: 45.00,
    speedKmPerSecond: 920,
    manufacturer: "Helios Dynamics",
    capacity: 8,
    rangeLy: 60,
    descriptionKey: "shop.ship.vegaRunner.desc",
  },
  {
    id: "ship-aether-titan",
    category: "ship",
    name: "Aether Titan",
    priceCredits: 12000,
    priceEur: 120.00,
    speedKmPerSecond: 2400,
    manufacturer: "Nova Consortium",
    capacity: 20,
    rangeLy: 200,
    descriptionKey: "shop.ship.aetherTitan.desc",
  },
];

export const SHOP_MUSIC: MusicProduct[] = [
  { id: "music-dust-on-the-highway",   category: "music", name: "Dust on the Highway",   priceCredits: 300, priceEur: 3.00, file: "dust_on_the_highway.mp3", title: "Dust on the Highway" },
  { id: "music-late-night-urgency",    category: "music", name: "Late Night Urgency",    priceCredits: 300, priceEur: 3.00, file: "late_night_urgency.mp3",  title: "Late Night Urgency" },
  { id: "music-neon-heartbeat",        category: "music", name: "Neon Heartbeat",        priceCredits: 300, priceEur: 3.00, file: "neon_heartbeat.mp3",      title: "Neon Heartbeat" },
  { id: "music-neon-static",           category: "music", name: "Neon Static",           priceCredits: 300, priceEur: 3.00, file: "neon_static.mp3",         title: "Neon Static" },
  { id: "music-rust-in-the-gears",     category: "music", name: "Rust in the Gears",     priceCredits: 300, priceEur: 3.00, file: "rust_in_the_gears.mp3",   title: "Rust in the Gears" },
];

/** Exobolygó ár-képlet (determinisztikus, csak a bolygó-adatból) */
export const calcExoplanetPrice = (
  distanceLy: number,
  massEarth: number | null,
  temperatureK: number | null,
): number => {
  return Math.round(
    200
    + distanceLy * 25
    + (massEarth ?? 1) * 60
    + Math.abs((temperatureK ?? 288) - 288) * 0.8
  );
};

/** Exobolygó wage (küldetés-jutalom, determinisztikus) */
export const calcExoplanetWage = (
  distanceLy: number,
  massEarth: number | null,
): number => {
  return Math.round(distanceLy * 15 + (massEarth ?? 1) * 5);
};

/** A 3 alap exobolygó — a játékos induláskor birtokolja őket */
export const BASE_EXOPLANETS: ExoplanetProduct[] = [
  {
    id: "exo-proxima-centauri",
    category: "exoplanet",
    name: "Proxima Centauri",
    priceCredits: 0,
    priceEur: 0,
    distanceLy: 4.24,
    wage: 50,
    starName: "Proxima Centauri",
    temperatureK: null,
    massEarth: null,
  },
  {
    id: "exo-wolf-424",
    category: "exoplanet",
    name: "Wolf 424",
    priceCredits: 0,
    priceEur: 0,
    distanceLy: 14.31,
    wage: 250,
    starName: "Wolf 424",
    temperatureK: null,
    massEarth: null,
  },
  {
    id: "exo-ross-780",
    category: "exoplanet",
    name: "Ross 780",
    priceCredits: 0,
    priceEur: 0,
    distanceLy: 15.34,
    wage: 1000,
    starName: "Ross 780",
    temperatureK: null,
    massEarth: null,
  },
];

export const BASE_EXOPLANET_IDS = BASE_EXOPLANETS.map((e) => e.id);

/** slug helper: bolygónév → azonosító */
const slugify = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

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
    id: "exo-" + slugify(raw.name) + (index > 0 ? `-${index}` : ""),
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
