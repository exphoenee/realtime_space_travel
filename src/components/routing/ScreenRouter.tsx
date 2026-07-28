import React from "react";
import { Destination, GamePhase } from "../../types";
import useGameStore from "../../state/useGameStore";
import IntroScreen from "../screens/IntroScreen";
import MainMenu from "../screens/MainMenu";
import MissionSelector from "../screens/MissionSelector";
import SettingsScreen from "../screens/SettingsScreen";
import LoadingScreen from "../screens/LoadingScreen";
import ShopScreen from "../shop/ShopScreen";
import ShipSelectScreen from "../screens/ShipSelectScreen";
import WallOfShame from "../screens/WallOfShame";

interface ScreenRouterProps {
  phase: GamePhase;
  onSkipIntro: () => void;
  onSelectDestination: (destination: Destination) => Promise<void>;
  /** Called when the LoadingScreen has completed its animation and is ready to start the game */
  onLoadingComplete: () => void;
  /** Camera check before mission start (called from ShipSelectScreen) */
  onCheckCamera?: () => Promise<boolean>;
  /** Rendered when phase is a game-related phase (playing/paused/countdown/crewLost/missionComplete) */
  children?: React.ReactNode;
}

/**
 * Routes rendering based on the current GamePhase.
 * - 'intro'        → IntroScreen
 * - 'mainMenu'     → MainMenu (login / start game / shop / settings / intro)
 * - 'missionSelect'→ MissionSelector (mission selection)
 * - 'shipSelect'  → ShipSelectScreen (ship selection before mission)
 * - 'settings'     → SettingsScreen (music volume, language, difficulty)
 * - 'shop'         → ShopScreen (in-game shop)
 * - 'loading'      → LoadingScreen (camera/model initialization)
 * - 'wallOfShame'  → WallOfShame (failure log)
 * - All others     → children (the game view with overlays)
 */
const ScreenRouter: React.FC<ScreenRouterProps> = ({
  phase,
  onSkipIntro,
  onSelectDestination,
  onLoadingComplete,
  onCheckCamera,
  children,
}) => {
  switch (phase) {
    case "intro":
      return <IntroScreen onSkip={onSkipIntro} />;
    case "mainMenu":
      return <MainMenu />;
    case "missionSelect":
      return <MissionSelector onSelectDestination={onSelectDestination} />;
    case "shipSelect":
      return <ShipSelectScreen onCheckCamera={onCheckCamera} />;
    case "settings":
      return <SettingsScreen />;
    case "shop":
      return <ShopScreen />;
    case "wallOfShame":
      return (
        <WallOfShame onBack={() => useGameStore.getState().transitionTo("mainMenu")} />
      );
    case "loading":
      return <LoadingScreen onComplete={onLoadingComplete} />;
    default:
      return <>{children}</>;
  }
};

export default ScreenRouter;
