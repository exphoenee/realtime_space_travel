import type { CreditPack, ShipProduct, MusicProduct, ExoplanetProduct } from "../types";
import { SHIP_SPEED_KM_PER_SECOND } from "./constants";

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
    stripePaymentLinkDev: "https://buy.stripe.com/test_8x28wQ03810q7cg2TweIw04",
  },
  {
    id: "credits-advanced",
    nameKey: "shop.credits.advanced",
    priceEur: 10,
    credits: 300,
    stripePaymentLink: "https://buy.stripe.com/test_28E5kE6rwcJ89koalYeIw01",
    stripePaymentLinkDev: "https://buy.stripe.com/test_6oUfZi7vA7oO548dyaeIw05",
  },
  {
    id: "credits-premium",
    nameKey: "shop.credits.premium",
    priceEur: 25,
    credits: 700,
    stripePaymentLink: "https://buy.stripe.com/test_5kQdRacPUgZocwA9hUeIw02",
    stripePaymentLinkDev: "https://buy.stripe.com/test_eVq3cw4joaB0eEIdyaeIw06",
  },
  {
    id: "credits-ultra",
    nameKey: "shop.credits.ultra",
    priceEur: 100,
    credits: 2000,
    stripePaymentLink: "https://buy.stripe.com/test_5kQ9AUg26fVk0NSalYeIw03",
    stripePaymentLinkDev: "https://buy.stripe.com/test_9B64gA2bg9wW68c9hUeIw07",
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
    speedKmPerSecond: 248,
    manufacturer: "Orion Shipyards",
    capacity: 4,
    rangeLy: 20,
    descriptionKey: "shop.ship.nomadX1.desc",
    image: "modern3.webp",
  },
  {
    id: "ship-1",
    category: "ship",
    name: "Vega Runner",
    priceCredits: 690,
    priceEur: 6.90,
    speedKmPerSecond: 452,
    manufacturer: "Helios Dynamics",
    capacity: 8,
    rangeLy: 60,
    descriptionKey: "shop.ship.vegaRunner.desc",
    image: "modern2.webp",
  },
  {
    id: "ship-2",
    category: "ship",
    name: "Aether Titan",
    priceCredits: 1010,
    priceEur: 10.10,
    speedKmPerSecond: 574,
    manufacturer: "Nova Consortium",
    capacity: 20,
    rangeLy: 200,
    descriptionKey: "shop.ship.aetherTitan.desc",
    image: "ultramodern1.webp",
  },
  {
    id: "ship-3",
    category: "ship",
    name: "Red Star",
    priceCredits: 400,
    priceEur: 4.00,
    speedKmPerSecond: 343,
    manufacturer: "Krasnyi Kosmos",
    capacity: 5,
    rangeLy: 25,
    descriptionKey: "shop.ship.redStar.desc",
    image: "russian1.webp",
  },
  {
    id: "ship-4",
    category: "ship",
    name: "Nebula Pioneer",
    priceCredits: 750,
    priceEur: 7.50,
    speedKmPerSecond: 475,
    manufacturer: "Orion Shipyards",
    capacity: 10,
    rangeLy: 80,
    descriptionKey: "shop.ship.nebulaPioneer.desc",
    image: "modern4.webp",
  },
  {
    id: "ship-5",
    category: "ship",
    name: "Quantum Voyager",
    priceCredits: 850,
    priceEur: 8.50,
    speedKmPerSecond: 513,
    manufacturer: "Helios Dynamics",
    capacity: 14,
    rangeLy: 120,
    descriptionKey: "shop.ship.quantumVoyager.desc",
    image: "modern5.webp",
  },
  {
    id: "ship-6",
    category: "ship",
    name: "Brass Monarch",
    priceCredits: 620,
    priceEur: 6.20,
    speedKmPerSecond: 426,
    manufacturer: "Steamforge Atelier",
    capacity: 12,
    rangeLy: 90,
    descriptionKey: "shop.ship.brassMonarch.desc",
    image: "steampunk2.webp",
  },
  {
    id: "ship-7",
    category: "ship",
    name: "Cosmos Seeker",
    priceCredits: 950,
    priceEur: 9.50,
    speedKmPerSecond: 551,
    manufacturer: "Nova Consortium",
    capacity: 24,
    rangeLy: 250,
    descriptionKey: "shop.ship.cosmosSeeker.desc",
    image: "modern6.webp",
  },
  {
    id: "ship-8",
    category: "ship",
    name: "Xenomorph",
    priceCredits: 800,
    priceEur: 8.00,
    speedKmPerSecond: 494,
    manufacturer: "XenoTech",
    capacity: 10,
    rangeLy: 100,
    descriptionKey: "shop.ship.xenomorph.desc",
    image: "alien1.webp",
  },
  {
    id: "ship-9",
    category: "ship",
    name: "Void Walker",
    priceCredits: 900,
    priceEur: 9.00,
    speedKmPerSecond: 532,
    manufacturer: "Unknown Origin",
    capacity: 16,
    rangeLy: 150,
    descriptionKey: "shop.ship.voidWalker.desc",
    image: "alien2.webp",
  },
  {
    id: "ship-10",
    category: "ship",
    name: "Star Song",
    priceCredits: 500,
    priceEur: 5.00,
    speedKmPerSecond: 380,
    manufacturer: "Orion Shipyards",
    capacity: 6,
    rangeLy: 40,
    descriptionKey: "shop.ship.starSong.desc",
    image: "modern1.webp",
  },
  {
    id: "ship-11",
    category: "ship",
    name: "Siberian Storm",
    priceCredits: 450,
    priceEur: 4.50,
    speedKmPerSecond: 362,
    manufacturer: "Krasnyi Kosmos",
    capacity: 6,
    rangeLy: 30,
    descriptionKey: "shop.ship.siberianStorm.desc",
    image: "russian2.webp",
  },
  {
    id: "ship-12",
    category: "ship",
    name: "Santa's Sleigh",
    priceCredits: 2000,
    priceEur: 20.00,
    speedKmPerSecond: 5000,
    manufacturer: "North Pole Workshop",
    capacity: 2,
    rangeLy: 500,
    descriptionKey: "shop.ship.santasSleigh.desc",
    image: "santas1.webp",
  },
  {
    id: "ship-13",
    category: "ship",
    name: "Gift Carrier",
    priceCredits: 1500,
    priceEur: 15.00,
    speedKmPerSecond: 3500,
    manufacturer: "North Pole Workshop",
    capacity: 30,
    rangeLy: 300,
    descriptionKey: "shop.ship.giftCarrier.desc",
    image: "santas2.webp",
  },
  {
    id: "ship-14",
    category: "ship",
    name: "Iron Baron",
    priceCredits: 550,
    priceEur: 5.50,
    speedKmPerSecond: 399,
    manufacturer: "Steamforge Atelier",
    capacity: 8,
    rangeLy: 70,
    descriptionKey: "shop.ship.ironBaron.desc",
    image: "steampunk1.webp",
  },
  {
    id: "ship-15",
    category: "ship",
    name: "Phantom",
    priceCredits: 980,
    priceEur: 9.80,
    speedKmPerSecond: 562,
    manufacturer: "Unknown Origin",
    capacity: 3,
    rangeLy: 180,
    descriptionKey: "shop.ship.phantom.desc",
    image: "strang1.webp",
  },
  {
    id: "ship-16",
    category: "ship",
    name: "Star Phoenix",
    priceCredits: 1040,
    priceEur: 10.40,
    speedKmPerSecond: 585,
    manufacturer: "Nova Consortium",
    capacity: 30,
    rangeLy: 300,
    descriptionKey: "shop.ship.starPhoenix.desc",
    image: "ultramodern2.webp",
  },
  {
    id: "ship-debug",
    category: "ship",
    name: "ASDasd123!",
    priceCredits: 1234,
    priceEur: 12.34,
    speedKmPerSecond: 1234,
    manufacturer: "Debug Dynamics Ltd.",
    capacity: 1,
    rangeLy: 9999,
    descriptionKey: "shop.ship.asdasd123.desc",
    image: "russian1.webp",
  },
  {
    id: "ship-17",
    category: "ship",
    name: "LD-42 Long Drop",
    priceCredits: 10000,
    priceEur: 100.00,
    speedKmPerSecond: 0,
    manufacturer: "Latrina Aerospace",
    capacity: 2,
    rangeLy: 0,
    descriptionKey: "shop.ship.longDrop.desc",
    image: "potty.webp",
  },
];

export const DEFAULT_SHIP: ShipProduct = {
  id: "ship-default",
  category: "ship",
  name: "Alap Hajó",
  priceCredits: 0,
  priceEur: 0,
  speedKmPerSecond: SHIP_SPEED_KM_PER_SECOND,
  manufacturer: "Standard",
  capacity: 2,
  rangeLy: 10,
  descriptionKey: "shipSelect.defaultDesc",
  image: "russian1.webp",
};

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

/** Default ship image used when no ship is selected (russian1.webp) */
export const DEFAULT_SHIP_IMAGE = "russian1.webp";

/**
 * Resolve the cockpit image path for a given ship ID.
 * Returns null if the ship ID is unknown (safety fallback).
 */
export const getShipImageById = (activeShipId: string | null): string | null => {
  if (activeShipId === null) return DEFAULT_SHIP_IMAGE;
  const found = SHOP_SHIPS.find((s) => s.id === activeShipId);
  return found?.image ?? DEFAULT_SHIP_IMAGE;
};

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
