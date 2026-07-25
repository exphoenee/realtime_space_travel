
export type CrewLostReason = "attention" | "buttons" | null;

export type Difficulty = "easy" | "medium" | "hard";

export type GamePhase =
  | "intro"
  | "mainMenu"
  | "missionSelect"
  | "settings"
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

