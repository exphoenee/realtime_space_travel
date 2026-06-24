
export type GamePhase =
  | "intro"
  | "menu"
  | "loading"
  | "playing"
  | "paused"
  | "countdown"
  | "crewLost"
  | "missionComplete";

export interface Star {
  x: number;
  y: number;
  z: number;
}

export interface Destination {
  name: string;
  travelYears: number;
}

