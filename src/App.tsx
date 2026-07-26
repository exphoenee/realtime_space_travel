import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";

import ScreenRouter from "./components/routing/ScreenRouter";
import Starfield from "./components/ui/Starfield";
import Dashboard from "./components/features/Dashboard";
import PauseMenu from "./components/features/PauseMenu";
import DebugOverlay from "./components/features/DebugOverlay";

import useGameStore from "./state/useGameStore";
import useUIStore from "./state/useUIStore";
import useAuthStore from "./state/useAuthStore";
import useShopStore from "./state/useShopStore";
import { useAudio } from "./hooks/useAudio";
import { useWeather } from "./hooks/useWeather";
import { useCamera } from "./hooks/useCamera";
import { useFaceDetection } from "./hooks/useFaceDetection";
import { useAttentionMonitor } from "./hooks/useAttentionMonitor";
import { usePageLeave } from "./hooks/usePageLeave";
import i18n from "./i18n/index";
import { initFirebase } from "./firebase/config";
import { startAuthBootstrap } from "./firebase/authBootstrap";
import { updateUserSettings } from "./firebase/userData";
import type { UserNode } from "./firebase/userData";
import { BASE_EXOPLANET_IDS, SHOP_SHIPS, getShipImageById } from "./constants/shopCatalog";

import { Destination } from "./types";
import {
  ATTENTION_INTERVAL_MS,
  INACTIVITY_LIMIT_SECONDS,
  INTRO_AUTO_SKIP_TIMEOUT_MS,
  SERVICE_UPDATE_INTERVAL_MS,
  TRAVEL_YEARS_PER_SECOND,
} from "./constants/constants";
import styles from "./App.module.css";

const DEBUG_MODE = import.meta.env.VITE_DEBUG_MODE === "true";

const App: React.FC = () => {
  const { t } = useTranslation();
  const {
    gamePhase,
    destination,
    remainingYears,
    shipSpeedKmPerSecond,
    isPaused,
    isAttentionLost,
    inactivitySeconds,
    crewLost,
    crewLostReason,
    missionComplete,
    serviceSeconds,
    bestServiceSeconds,
    showIntro,
    setRemainingYears,
    setIsPaused,
    setIsAttentionLost,
    setInactivitySeconds,
    setCrewLost,
    setCrewLostReason,
    setMissionComplete,
    setServiceSeconds,
    setBestServiceSeconds,
    setShowIntro,
    debugIgnoreAttention,
    setDebugIgnoreAttention,
    startMission,
    resetToMenu,
  } = useGameStore();

  const {
    cameraError,
    showExitConfirm,
    isMusicMuted,
    musicVolume,
    setCameraError,
    setShowExitConfirm,
  } = useUIStore();

  const [canvasBounds, setCanvasBounds] = useState<DOMRectReadOnly | null>(null);

  const activeMusicId = useUIStore((s) => s.activeMusicId);
  const activeShipId = useUIStore((s) => s.activeShipId);
  const { playMusic } = useAudio(activeMusicId);
  const localWeather = useWeather(destination);
  const { videoRef, isStreamReady } = useCamera(destination);
  const { debugCanvasRef, faceStatus, debugMetrics } = useFaceDetection(
    videoRef,
    destination,
    isStreamReady,
    DEBUG_MODE,
  );
  useAttentionMonitor(faceStatus, destination);
  usePageLeave();

  // Watch isMusicMuted changes → persist to RTDB.
  // Guard against the initial mount: the auth bootstrap (ensureDeviceMap +
  // ensureUserNode) may not have completed yet, and writing to RTDB before
  // the device_map entry exists triggers a PERMISSION_DENIED.
  useEffect(() => {
    const { rtdbKey, _initialized } = useAuthStore.getState();
    if (_initialized && rtdbKey) {
      updateUserSettings(rtdbKey, { musicMuted: isMusicMuted }).catch(console.error);
    }
  }, [isMusicMuted]);

  // Initialize Firebase on mount + boot the auth lifecycle singleton
  useEffect(() => {
    initFirebase();

    /** Sync RTDB user data into local stores. */
    const handleUserData = (data: UserNode | null) => {
      if (!data) return;

      const ui = useUIStore.getState();
      const shop = useShopStore.getState();

      // Settings → useUIStore
      if (data.settings) {
        const s = data.settings;
        if (s.musicMuted !== undefined && s.musicMuted !== ui.isMusicMuted) {
          ui.setIsMusicMuted(s.musicMuted);
        }
        if (s.activeMusicId !== undefined && s.activeMusicId !== ui.activeMusicId) {
          ui.setActiveMusicId(s.activeMusicId);
        }
        if (s.activeShipId !== undefined && s.activeShipId !== ui.activeShipId) {
          // Validate against RTDB snapshot inventory (not store, which may not be synced yet)
          const ownedShipsFromSnapshot = data.inventory?.ships
            ? Object.keys(data.inventory.ships).filter((k) => data.inventory.ships![k])
            : shop.owned.ships;
          if (s.activeShipId === null || ownedShipsFromSnapshot.includes(s.activeShipId)) {
            ui.setActiveShipId(s.activeShipId);
          } else {
            // Not owned anymore — reset to null and write back to RTDB
            ui.setActiveShipId(null);
            const authState = useAuthStore.getState();
            if (authState.rtdbKey) {
              updateUserSettings(authState.rtdbKey, { activeShipId: null }).catch(console.error);
            }
          }
        }
        if (s.musicVolume !== undefined && s.musicVolume !== ui.musicVolume) {
          ui.setMusicVolume(s.musicVolume);
        }
        if (s.difficulty !== undefined && s.difficulty !== ui.difficulty) {
          ui.setDifficulty(s.difficulty as any);
        }
        if (s.language && s.language !== i18n.language) {
          i18n.changeLanguage(s.language);
        }
      }

      // Stats → useGameStore
      if (data.stats?.bestServiceSeconds !== undefined) {
        const gs = useGameStore.getState();
        const rtdb = data.stats.bestServiceSeconds;
        const local = gs.bestServiceSeconds;
        if (rtdb > local) {
          gs.setBestServiceSeconds(rtdb);
        }
      }

      // Profile → useAuthStore (nickname + displayName)
      if (data.profile) {
        if (data.profile.nickname !== undefined) {
          useAuthStore.getState().setNickname(data.profile.nickname);
        }
        // Sync RTDB displayName as fallback (some linked accounts lack
        // Firebase Auth user.displayName, but RTDB persists the correct value).
        if (data.profile.displayName) {
          useAuthStore.getState().setDisplayName(data.profile.displayName);
        }
      }

      // Wallet + Inventory → useShopStore. RTDB is the single source of truth:
      // a missing branch means the value is 0 / empty, NOT "keep the local
      // value". setCredits also flips creditsLoaded → true.
      shop.setCredits(data.wallet?.credits ?? 0);

      const inv = data.inventory;
      // Missing RTDB branch → fallback (empty, except exoplanets → base set).
      const mergeInventory = (
        rtdbItems: Record<string, boolean> | undefined,
        fallback: string[],
      ): string[] => {
        if (!rtdbItems) return fallback;
        return Object.keys(rtdbItems).filter((k) => rtdbItems[k]);
      };
      const newShips = mergeInventory(inv?.ships, []);
      const newMusic = mergeInventory(inv?.music, []);
      const newExos = mergeInventory(inv?.exoplanets, [...BASE_EXOPLANET_IDS]);
      if (
        JSON.stringify(newShips) !== JSON.stringify(shop.owned.ships) ||
        JSON.stringify(newMusic) !== JSON.stringify(shop.owned.music) ||
        JSON.stringify(newExos) !== JSON.stringify(shop.owned.exoplanets)
      ) {
        shop.setOwned({ ships: newShips, music: newMusic, exoplanets: newExos });
      }
    };

    startAuthBootstrap(handleUserData);

    // Detect returning from Stripe Payment Link (/shop/success).
    // The SPA always loads index.html regardless of path, so the path is
    // preserved. Auto-navigate to shop so ShopScreen's useEffect can
    // process the pending purchase from sessionStorage/localStorage.
    if (window.location.pathname.includes("/shop/success")) {
      // Use a micro-task so the current render cycle settles first,
      // then bypass the intro and go straight to the shop.
      queueMicrotask(() => {
        useGameStore.getState().transitionTo("shop");
      });
    }

    // Listen for language changes → persist to RTDB
    const handleLanguageChange = (lng: string) => {
      const { rtdbKey } = useAuthStore.getState();
      if (rtdbKey) {
        updateUserSettings(rtdbKey, { language: lng }).catch(console.error);
      }
    };
    i18n.on("languageChanged", handleLanguageChange);

    return () => {
      // Note: startAuthBootstrap is a module-level singleton and is intentionally
      // NOT torn down here — keeping it alive across a StrictMode remount is what
      // prevents a second anonymous login.
      i18n.off("languageChanged", handleLanguageChange);
    };
  }, []);

  // After Zustand persist rehydrates the saved game state on page refresh,
  // re-apply the boolean flags (showIntro, isPaused, isAttentionLost, etc.)
  // so they are consistent with the restored gamePhase.
  useEffect(() => {
    // Use a macrotask so it runs after persist has finished rehydrating
    // (which happens in a microtask after create()).
    const timer = setTimeout(() => {
      const gs = useGameStore.getState();
      if (gs.gamePhase !== "intro") {
        // Re-derive flags from the restored phase without changing the phase
        gs.transitionTo(gs.gamePhase);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const checkCamera = useCallback(async (): Promise<boolean> => {
    if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) {
      setCameraError(t("app.camera.noSupport"));
      return false;
    }

    if (!window.FaceDetection) {
      setCameraError(t("app.camera.noModel"));
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((track) => track.stop());
      setCameraError(null);
      return true;
    } catch (err) {
      let errorMessage = t("app.camera.needAccess");
      if (err instanceof DOMException) {
        switch (err.name) {
          case "NotAllowedError":
            errorMessage = t("app.camera.denied");
            break;
          case "NotFoundError":
            errorMessage = t("app.camera.notFound");
            break;
          case "NotReadableError":
            errorMessage = t("app.camera.notReadable");
            break;
        }
      }
      setCameraError(errorMessage);
      return false;
    }
  }, [setCameraError, t]);

  const handleSelectDestination = async (selectedDestination: Destination) => {
    setShowExitConfirm(false);
    // Go to ship selection directly (camera check happens after ship select)
    useGameStore.getState().selectDestinationForShip(selectedDestination);
  };

  const handleRequestExit = () => {
    setShowExitConfirm(true);
    setIsPaused(true);
  };

  const updateBestServiceTime = useCallback(
    (seconds: number) => {
      if (seconds <= 0) return;
      setBestServiceSeconds((prev) => (seconds <= prev ? prev : seconds));
    },
    [setBestServiceSeconds],
  );

  const handleConfirmExit = () => {
    updateBestServiceTime(serviceSeconds);
    setShowExitConfirm(false);
    setCameraError(null);
    resetToMenu();
  };

  const handleCancelExit = () => {
    setShowExitConfirm(false);
    if (!crewLost && !missionComplete) {
      if (gamePhase === "paused" || gamePhase === "countdown") {
        useGameStore.getState().transitionTo("playing");
      } else {
        setIsPaused(false);
      }
    }
  };

  const isPreGame =
    gamePhase === "intro" ||
    gamePhase === "mainMenu" ||
    gamePhase === "missionSelect" ||
    gamePhase === "shipSelect" ||
    gamePhase === "settings" ||
    gamePhase === "shop" ||
    gamePhase === "loading";

  const attentionCountdown =
    gamePhase === "countdown"
      ? Math.max(0, INACTIVITY_LIMIT_SECONDS - inactivitySeconds)
      : null;

  const handleCanvasBoundsChange = useCallback(
    (bounds: DOMRectReadOnly) => {
      setCanvasBounds(bounds);
    },
    [setCanvasBounds],
  );

  const handleSkipIntro = useCallback(() => {
    useGameStore.getState().transitionTo("mainMenu");
  }, []);

  const handleLoadingComplete = useCallback(() => {
    useGameStore.getState().transitionTo("playing");
  }, []);

  const serviceMinutes = serviceSeconds / 60;
  const bestServiceMinutes = bestServiceSeconds / 60;
  const crewLostMessage =
    crewLostReason === "buttons"
      ? t("app.crewLostButtons")
      : t("app.crewLostAttention");

  // Pause overlay visible when in paused/countdown phase and no blocking overlays
  const isPauseOverlayVisible =
    (gamePhase === "paused" || gamePhase === "countdown") &&
    !cameraError &&
    !showExitConfirm;

  useEffect(() => {
    if (!showIntro) return;

    const timer = window.setTimeout(
      handleSkipIntro,
      INTRO_AUTO_SKIP_TIMEOUT_MS,
    );
    return () => window.clearTimeout(timer);
  }, [showIntro, handleSkipIntro]);

  useEffect(() => {
    if (!showIntro) return;

    const handleSkip = () => {
      handleSkipIntro();
    };

    window.addEventListener("keydown", handleSkip);
    window.addEventListener("mousedown", handleSkip);
    window.addEventListener("touchstart", handleSkip);

    return () => {
      window.removeEventListener("keydown", handleSkip);
      window.removeEventListener("mousedown", handleSkip);
      window.removeEventListener("touchstart", handleSkip);
    };
  }, [showIntro, handleSkipIntro]);

  useEffect(() => {
    if (!destination) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (e.key === "Escape" || e.key === "Tab" || e.key.startsWith("F")) return;

      const gameState = useGameStore.getState();
      const uiState = useUIStore.getState();
      if (
        gameState.crewLost ||
        gameState.missionComplete ||
        uiState.showExitConfirm
      ) {
        return;
      }      updateBestServiceTime(gameState.serviceSeconds);
          gameState.transitionTo("crewLost");
          gameState.setCrewLostReason("buttons");
          uiState.setShowExitConfirm(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [destination, updateBestServiceTime]);

  const shouldPlayMusic =
    gamePhase !== "shop" &&
    (!destination ||
      (!showExitConfirm &&
        !cameraError &&
        !crewLost &&
        !missionComplete &&
        isPaused));

  useEffect(() => {
    playMusic(shouldPlayMusic, isMusicMuted, musicVolume);
  }, [shouldPlayMusic, isMusicMuted, musicVolume, playMusic]);

  useEffect(() => {
    if (!destination || isPaused || crewLost || missionComplete) {
      return;
    }

    const deltaSeconds = SERVICE_UPDATE_INTERVAL_MS / 1000;
    const interval = window.setInterval(() => {
      setServiceSeconds((prev) => prev + deltaSeconds);
      setRemainingYears((prev) => {
        if (prev <= 0) {
          return 0;
        }

        const next = prev - deltaSeconds * TRAVEL_YEARS_PER_SECOND;
        return next <= 0 ? 0 : next;
      });
    }, SERVICE_UPDATE_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [
    destination,
    isPaused,
    crewLost,
    missionComplete,
  ]);

  useEffect(() => {
    if (!isAttentionLost) {
      setInactivitySeconds(0);
    }
  }, [isAttentionLost]);

  useEffect(() => {
    if (!destination || !isAttentionLost || crewLost || missionComplete) {
      return;
    }

    const interval = window.setInterval(() => {
      const state = useGameStore.getState();

      // First tick: transition from paused → countdown
      if (state.inactivitySeconds === 0 && state.gamePhase === "paused") {
        state.transitionTo("countdown");
      }

      setInactivitySeconds((prev) => {
        const next = prev + 1;
        if (next >= INACTIVITY_LIMIT_SECONDS) {
          updateBestServiceTime(state.serviceSeconds);
          state.transitionTo("crewLost");
          state.setCrewLostReason("attention");
          useUIStore.getState().setShowExitConfirm(false);
          return INACTIVITY_LIMIT_SECONDS;
        }
        return next;
      });
    }, ATTENTION_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [
    destination,
    isAttentionLost,
    crewLost,
    missionComplete,
    updateBestServiceTime,
  ]);

  useEffect(() => {
    if (!destination || missionComplete || crewLost) {
      return;
    }

    if (remainingYears <= 0) {
      const gs = useGameStore.getState();
      updateBestServiceTime(gs.serviceSeconds);
      gs.transitionTo("missionComplete");
      setShowExitConfirm(false);
    }
  }, [
    destination,
    remainingYears,
    missionComplete,
    crewLost,
    updateBestServiceTime,
  ]);

  return (
    <>
      {isPreGame ? (
        <main className={styles.app}>
          <Starfield key="pregame" onCanvasBoundsChange={handleCanvasBoundsChange} />
          <ScreenRouter
            phase={gamePhase}
            onSkipIntro={handleSkipIntro}
            onSelectDestination={handleSelectDestination}
            onLoadingComplete={handleLoadingComplete}
            onCheckCamera={checkCamera}
          />
        </main>
      ) : !destination ? null : (
        <main className={styles.app}>
          <Starfield
            key="gameplay"
            onCanvasBoundsChange={handleCanvasBoundsChange}
            isPaused={isPauseOverlayVisible}
            cockpitImageUrl={`${import.meta.env.BASE_URL}spaceships/${getShipImageById(activeShipId)}`}
          />
          {canvasBounds && (
            <div
              className={styles.canvasControls}
              style={{
                top: canvasBounds.top,
                left: canvasBounds.left,
                width: canvasBounds.width,
                height: canvasBounds.height,
              }}
            >
              <button onClick={handleRequestExit} className={styles.exitButton} aria-label={t("app.exitAria")}>
                {t("app.exit")}
              </button>
              <div className={styles.statsPanel}>
                <p>{t("app.serviceTime", { minutes: serviceMinutes.toFixed(2) })}</p>
                <p className={styles.statsRecord}>
                  {t("app.record", { minutes: bestServiceMinutes.toFixed(2) })}
                </p>
              </div>
            </div>
          )}
          <div className={styles.dashboardWrapper}>
            <Dashboard
              remainingYears={remainingYears}
              destinationName={destination.name}
              localWeather={localWeather}
              currentSpeedKmPerSecond={shipSpeedKmPerSecond}
              shipImageUrl={`${import.meta.env.BASE_URL}spaceships/${getShipImageById(activeShipId)}`}
              shipName={activeShipId ? SHOP_SHIPS.find(s => s.id === activeShipId)?.name : undefined}
            />
          </div>

          {missionComplete && (
            <div className={styles.overlay}>
              <div className={`${styles.overlayCard} ${styles.successCard}`}>
                <h2 className={styles.overlayTitle}>{t("app.missionCompleteTitle")}</h2>
                <p className={styles.overlayText}>
                  {t("app.missionCompleteText")}
                </p>
                <div className={styles.overlayActions}>
                  <button
                    onClick={handleConfirmExit}
                    className={`${styles.button} ${styles.successButton}`}
                  >
                    {t("app.backToMenu")}
                  </button>
                </div>
              </div>
            </div>
          )}

          {crewLost && (
            <div className={styles.overlay}>
              <div className={`${styles.overlayCard} ${styles.dangerCard}`}>
                <h2 className={styles.overlayTitle}>{t("app.gameOverTitle")}</h2>
                <p className={styles.overlayText}>{crewLostMessage}</p>
                <div className={styles.overlayActions}>
                  <button
                    onClick={handleConfirmExit}
                    className={`${styles.button} ${styles.dangerButton}`}
                  >
                    {t("app.backToMenu")}
                  </button>
                </div>
              </div>
            </div>
          )}

          {showExitConfirm ? (
            <div className={styles.overlay}>
              <div className={`${styles.overlayCard} ${styles.neutralCard}`}>
                <h2 className={styles.overlayTitle}>{t("app.exitConfirmTitle")}</h2>
                <p className={styles.overlayText}>
                  {t("app.exitConfirmText")}
                </p>
                <div className={styles.overlayActions}>
                  <button
                    onClick={handleConfirmExit}
                    className={`${styles.button} ${styles.dangerButton}`}
                  >
                    {t("app.yes")}
                  </button>
                  <button
                    onClick={handleCancelExit}
                    className={`${styles.button} ${styles.neutralButton}`}
                  >
                    {t("app.no")}
                  </button>
                </div>
              </div>
            </div>
          ) : cameraError ? (
            <div className={`${styles.overlay} ${styles.cameraError}`}>
              <div className={`${styles.overlayCard} ${styles.cameraErrorCard}`}>
                <h2 className={styles.cameraErrorTitle}>{t("app.errorTitle")}</h2>
                <p className={styles.cameraErrorText}>{cameraError}</p>
                <div className={styles.overlayActions}>
                  <button
                    onClick={() => {
                      useUIStore.getState().setCameraError(null);
                      useGameStore.getState().setIsPaused(false);
                    }}
                    className={`${styles.button} ${styles.neutralButton}`}
                  >
                    {t("app.retry")}
                  </button>
                </div>
              </div>
            </div>
          ) : isPauseOverlayVisible ? (
            <PauseMenu countdownSeconds={attentionCountdown} />
          ) : null}

          {DEBUG_MODE && (
            <DebugOverlay
              debugCanvasRef={debugCanvasRef}
              faceStatus={faceStatus}
              debugMetrics={debugMetrics}
              debugIgnoreAttention={debugIgnoreAttention}
              setDebugIgnoreAttention={setDebugIgnoreAttention}
              canvasBounds={canvasBounds}
              videoRef={videoRef}
              destination={destination}
            />
          )}
        </main>
      )}

      {/* Video element rendered unconditionally so the camera stream persists across phase changes */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ display: "none", position: "absolute" }}
      />
    </>
  );
};

export default App;
