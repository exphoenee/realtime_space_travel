import React from "react";
import { Destination, GamePhase } from "../types";
import IntroScreen from "./IntroScreen";
import MainMenu from "./MainMenu";
import LoadingScreen from "./LoadingScreen";

interface ScreenRouterProps {
  phase: GamePhase;
  onSkipIntro: () => void;
  onSelectDestination: (destination: Destination) => Promise<void>;
  /** Called when the LoadingScreen has completed its animation and is ready to start the game */
  onLoadingComplete: () => void;
  /** Rendered when phase is a game-related phase (playing/paused/countdown/crewLost/missionComplete) */
  children?: React.ReactNode;
}

/**
 * Routes rendering based on the current GamePhase.
 * - 'intro'    → IntroScreen
 * - 'menu'     → MainMenu
 * - 'loading'  → LoadingScreen (camera/model initialization)
 * - All others → children (the game view with overlays)
 */
const ScreenRouter: React.FC<ScreenRouterProps> = ({
  phase,
  onSkipIntro,
  onSelectDestination,
  onLoadingComplete,
  children,
}) => {
  switch (phase) {
    case "intro":
      return <IntroScreen onSkip={onSkipIntro} />;
    case "menu":
      return <MainMenu onSelectDestination={onSelectDestination} />;
    case "loading":
      return <LoadingScreen onComplete={onLoadingComplete} />;
    default:
      return <>{children}</>;
  }
};

export default ScreenRouter;
