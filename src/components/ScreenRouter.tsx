import React from "react";
import { Destination, GamePhase } from "../types";
import IntroScreen from "./IntroScreen";
import MainMenu from "./MainMenu";

interface ScreenRouterProps {
  phase: GamePhase;
  onSkipIntro: () => void;
  onSelectDestination: (destination: Destination) => Promise<void>;
  /** Rendered when phase is a game-related phase (loading/playing/paused/countdown/crewLost/missionComplete) */
  children?: React.ReactNode;
}

/**
 * Routes rendering based on the current GamePhase.
 * - 'intro'  → IntroScreen
 * - 'menu'   → MainMenu
 * - All others → children (the game view with overlays)
 */
const ScreenRouter: React.FC<ScreenRouterProps> = ({
  phase,
  onSkipIntro,
  onSelectDestination,
  children,
}) => {
  switch (phase) {
    case "intro":
      return <IntroScreen onSkip={onSkipIntro} />;
    case "menu":
      return <MainMenu onSelectDestination={onSelectDestination} />;
    default:
      return <>{children}</>;
  }
};

export default ScreenRouter;
