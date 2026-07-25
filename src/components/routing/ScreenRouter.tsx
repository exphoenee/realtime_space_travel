import React from "react";
import { Destination, GamePhase } from "../../types";
import IntroScreen from "../screens/IntroScreen";
import MainMenu from "../screens/MainMenu";
import MissionSelector from "../screens/MissionSelector";
import SettingsScreen from "../screens/SettingsScreen";
import LoadingScreen from "../screens/LoadingScreen";

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
 * - 'intro'        → IntroScreen
 * - 'mainMenu'     → MainMenu (login / start game / shop / settings / intro)
 * - 'missionSelect'→ MissionSelector (mission selection)
 * - 'settings'     → SettingsScreen (music volume, language, difficulty)
 * - 'loading'      → LoadingScreen (camera/model initialization)
 * - All others     → children (the game view with overlays)
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
    case "mainMenu":
      return <MainMenu />;
    case "missionSelect":
      return <MissionSelector onSelectDestination={onSelectDestination} />;
    case "settings":
      return <SettingsScreen />;
    case "loading":
      return <LoadingScreen onComplete={onLoadingComplete} />;
    default:
      return <>{children}</>;
  }
};

export default ScreenRouter;
