export type EventType = "horn" | "asteroid" | "rescue-transfer" | "solar-flare" | "rover" | "fake-instruction";

export type EventPenaltyType = "time" | "crewLost";

export interface EventDefinition {
  id: EventType;
  /** Minimum difficulty required for this event to appear */
  minDifficulty: Difficulty;
  /** Minimum interval between this event and any other event (ms) */
  minIntervalMs: number;
  /** Base random interval range [min, max] in ms */
  baseIntervalMs: [number, number];
  /** How long the player has to respond (ms) */
  durationMs: number;
  /** Penalty type on failure */
  penaltyType: EventPenaltyType;
  /** Penalty amount in years (for time penalties) */
  penaltyAmount: number;
  /** i18n key prefix */
  i18nKey: string;
  /** Whether this is a rare event (10-20 min cooldown) */
  isRare: boolean;
}

export interface EventInstance {
  id: EventType;
  definition: EventDefinition;
  triggeredAt: number;
  data?: Record<string, unknown>;
}

export type CrewLostReason = "attention" | "buttons" | "event" | null;

export type Difficulty = "easy" | "medium" | "hard";

export type GamePhase =
  | "intro"
  | "mainMenu"
  | "missionSelect"
  | "shipSelect"
  | "settings"
  | "loading"
  | "playing"
  | "paused"
  | "countdown"
  | "crewLost"
  | "missionComplete"
  | "shop";

export interface Star {
  x: number;
  y: number;
  z: number;
}

export interface Destination {
  name: string;
  travelYears: number;
}

// --- Shop types ---

export type ShopCategory = "exoplanet" | "ship" | "music" | "credits";

export interface ShopProductBase {
  id: string;
  category: ShopCategory;
  name: string;
  priceCredits: number;
  priceEur: number;
}

export interface CreditPack {
  id: string;
  nameKey: string;
  priceEur: number;
  credits: number;
  /** Stripe Payment Link URL for production — redirects back to Firebase Hosting. */
  stripePaymentLink: string;
  /**
   * Stripe Payment Link URL for local development — redirects back to localhost.
   * A Payment Link's return URL is fixed on the Stripe object itself, so dev and
   * prod need separate links. Falls back to `stripePaymentLink` when unset.
   */
  stripePaymentLinkDev?: string;
}

export interface ShipProduct extends ShopProductBase {
  category: "ship";
  speedKmPerSecond: number;
  manufacturer: string;
  capacity: number;
  rangeLy: number;
  descriptionKey: string;
  /** Relative path to the cockpit dashboard image in public/spaceships/ */
  image?: string;
}

export interface MusicProduct extends ShopProductBase {
  category: "music";
  file: string;
  title: string;
}

export interface ExoplanetProduct extends ShopProductBase {
  category: "exoplanet";
  distanceLy: number;
  wage: number;
  starName: string;
  temperatureK: number | null;
  massEarth: number | null;
}

export interface CartItem {
  id: string;
  category: "exoplanet" | "ship" | "music";
  priceCredits: number;
}

export interface OwnedItems {
  ships: string[];
  music: string[];
  exoplanets: string[];
}
