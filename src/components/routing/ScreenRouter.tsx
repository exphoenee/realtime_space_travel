import React, { useEffect } from "react";
import { Destination, GamePhase } from "../../types";
import useGameStore from "../../state/useGameStore";
import useAuthStore from "../../state/useAuthStore";
import IntroScreen from "../screens/IntroScreen";
import MainMenu from "../screens/MainMenu";
import MissionSelector from "../screens/MissionSelector";
import SettingsScreen from "../screens/SettingsScreen";
import LoadingScreen from "../screens/LoadingScreen";
import ShopScreen from "../shop/ShopScreen";
import ShipSelectScreen from "../screens/ShipSelectScreen";
import WallOfShame from "../screens/WallOfShame";
import FriendsScreen from "../screens/FriendsScreen";
import ChatScreen from "../screens/ChatScreen";
import CameraConsentModal from "../features/CameraConsentModal";
import MultiplayerStatusBar from "../features/MultiplayerStatusBar";

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
 * - 'friends'      → FriendsScreen (friend list / search / requests)
 * - 'chat'         → ChatScreen (1:1 conversation with chatTargetUid)
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
  const authUser = useAuthStore((s) => s.user);
  const authStatus = useAuthStore((s) => s.status);

  // Screens that require a registered account: the friend graph is keyed by
  // the Google auth uid, and shop purchases must outlive a throwaway session.
  // `status === "loading"` is NOT treated as guest: auth resolves
  // asynchronously and would otherwise bounce a signed-in player on refresh.
  const isGuest = authStatus !== "loading" && (!authUser || authUser.isAnonymous);
  const needsAccount =
    phase === "friends" ||
    phase === "chat" ||
    phase === "friendWall" ||
    phase === "shop";
  const blockPhase = isGuest && needsAccount;

  // Covers the persisted-phase case: signing out while on one of these
  // screens, or refreshing into one that localStorage restored.
  useEffect(() => {
    if (blockPhase) {
      useGameStore.getState().transitionTo("mainMenu");
    }
  }, [blockPhase]);

  if (blockPhase) return <MainMenu />;

  switch (phase) {
    case "cameraConsent":
      return <CameraConsentModal />;
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
    case "friends":
      return <FriendsScreen />;
    case "chat":
      return <ChatScreen />;
    case "friendWall": {
      const { friendWallTargetUid, friendWallTargetName, transitionTo } = useGameStore.getState();
      return (
        <WallOfShame
          onBack={() => {
            useGameStore.setState({
              friendWallTargetUid: null,
              friendWallTargetName: null,
            });
            transitionTo("friends");
          }}
          friendUid={friendWallTargetUid ?? undefined}
          friendName={friendWallTargetName ?? undefined}
        />
      );
    }
    case "loading":
      return <LoadingScreen onComplete={onLoadingComplete} />;
    default:
      return (
        <>
          <MultiplayerStatusBar />
          {children}
        </>
      );
  }
};

export default ScreenRouter;
