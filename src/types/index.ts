export type CrewLostReason = "attention" | "buttons" | null;

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
}

export interface ShipProduct extends ShopProductBase {
  category: "ship";
  speedKmPerSecond: number;
  manufacturer: string;
  capacity: number;
  rangeLy: number;
  descriptionKey: string;
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
