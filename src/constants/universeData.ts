export const baseDestinations = [
  {
    name: "Proxima Centauri",
    distanceLy: 4.24,
    wage: 50,
  },
  {
    name: "Wolf 424",
    distanceLy: 14.31,
    wage: 250,
  },
  {
    name: "Ross 780",
    distanceLy: 15.34,
    wage: 1000,
  },
];

/**
 * Look up the mission reward (wage) for a destination by its name.
 * Falls back to a formula based on travelYears if the destination is not found.
 */
export const getDestinationWage = (
  destinationName: string,
  fallbackYears: number,
): number => {
  // Look up in base destinations first
  const found = baseDestinations.find(
    (d) => d.name.toLowerCase() === destinationName.toLowerCase(),
  );
  if (found) return found.wage;

  // Fallback: proportional to travelYears (for custom/dummy destinations)
  // ~5% of travel years as credits
  if (fallbackYears > 0) {
    return Math.max(10, Math.round(fallbackYears * 0.05));
  }

  return 25; // absolute minimum fallback
};

export interface WeatherCondition {
  /** i18n kulcs a `weather` névtér alatt */
  key: string;
  /** hőmérséklet °C-ban (interpolációhoz) */
  temp: number;
}

export const weatherConditions: WeatherCondition[] = [
  { key: "sunny", temp: 25 },
  { key: "rainy", temp: 20 },
  { key: "snowy", temp: -12 },
  { key: "foggy", temp: 5 },
  { key: "tropicalStorm", temp: 32 },
  { key: "iceStorm", temp: -30 },
  { key: "breezy", temp: 14 },
  { key: "sandStorm", temp: 40 },
  { key: "sleet", temp: 0 },
  { key: "clearSky", temp: -5 },
];
