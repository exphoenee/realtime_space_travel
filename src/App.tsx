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
import i18n from "./i18n/index";
import { initFirebase } from "./firebase/config";
import { onAuthChange, signInAnonymous, checkRedirectResult } from "./firebase/auth";
import { ensureUserNode, subscribeUser, updateUserSettings } from "./firebase/userData";
import type { UserNode } from "./firebase/userData";

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

  // Watch isMusicMuted changes → persist to RTDB
  useEffect(() => {
    const { uid } = useAuthStore.getState();
    if (uid) {
      updateUserSettings(uid, { musicMuted: isMusicMuted }).catch(console.error);
    }
  }, [isMusicMuted]);

  // Initialize Firebase on mount + listen for auth state changes
  useEffect(() => {
    initFirebase();

    let unsubUser: (() => void) | null = null;
    let anonInit = false;
    let redirectCheckDone = false;

    // Process redirect result FIRST, before onAuthChange fires
    // getRedirectResult must be called to "consume" the OAuth response
    checkRedirectResult().then((redirectUser) => {
      if (redirectUser) {
        const { setUser } = useAuthStore.getState();
        setUser(redirectUser);
        ensureUserNode(redirectUser, "google").catch(console.error);
        // Skip intro on OAuth return — go straight to main menu
        useGameStore.getState().transitionTo("mainMenu");
      }
      redirectCheckDone = true;

      // If onAuthChange already fired with null and we returned early,
      // trigger anonymous auto-login now that redirect check is done
      if (!redirectUser && !anonInit && !useAuthStore.getState().user) {
        anonInit = true;
        signInAnonymous().catch(console.error);
      }
    });

    const unsub = onAuthChange(async (user) => {
      // If no user and redirect still pending, wait WITHOUT clearing the store
      if (!user && !anonInit && !redirectCheckDone) {
        // Don't call setUser(null) — the redirect might be processing
        // and we'd clear the store prematurely. Wait for checkRedirectResult.
        return;
      }

      const { setUser } = useAuthStore.getState();
      setUser(user);

      // Only auto-login anonymously if:
      // 1. No user from auth
      // 2. We haven't already auto-logged in
      if (!user && !anonInit) {
        anonInit = true;
        try {
          await signInAnonymous();
        } catch (err) {
          console.error("Anonymous auto-login failed:", err);
        }
        return;
      }

      // Clean up previous subscription
      if (unsubUser) {
        unsubUser();
        unsubUser = null;
      }

      if (user) {
        try {
          await ensureUserNode(user, user.isAnonymous ? "anonymous" : "google");
          // Subscribe to RTDB user data
          unsubUser = subscribeUser(user.uid, handleUserData);
        } catch (err) {
          console.error("Firebase sync failed:", err);
        }
      }
    });

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
            if (authState.uid) {
              updateUserSettings(authState.uid, { activeShipId: null }).catch(console.error);
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

      // Wallet + Inventory → useShopStore (source of truth when signed in)
      if (data.wallet?.credits !== undefined) {
        // Only overwrite if RTDB has a different value to avoid loops
        if (data.wallet.credits !== shop.credits) {
          shop.setCredits(data.wallet.credits);
        }
      }
      if (data.inventory) {
        const inv = data.inventory;
        const mergeInventory = (
          rtdbItems: Record<string, boolean> | undefined,
          localItems: string[],
        ): string[] => {
          if (!rtdbItems) return localItems;
          return Object.keys(rtdbItems).filter((k) => rtdbItems[k]);
        };
        const newShips = mergeInventory(inv.ships, shop.owned.ships);
        const newMusic = mergeInventory(inv.music, shop.owned.music);
        const newExos = mergeInventory(inv.exoplanets, shop.owned.exoplanets);
        if (
          JSON.stringify(newShips) !== JSON.stringify(shop.owned.ships) ||
          JSON.stringify(newMusic) !== JSON.stringify(shop.owned.music) ||
          JSON.stringify(newExos) !== JSON.stringify(shop.owned.exoplanets)
        ) {
          shop.setOwned({ ships: newShips, music: newMusic, exoplanets: newExos });
        }
      }
    };

    // Listen for language changes → persist to RTDB
    const handleLanguageChange = (lng: string) => {
      const { uid } = useAuthStore.getState();
      if (uid) {
        updateUserSettings(uid, { language: lng }).catch(console.error);
      }
    };
    i18n.on("languageChanged", handleLanguageChange);

    return () => {
      unsub();
      if (unsubUser) unsubUser();
      i18n.off("languageChanged", handleLanguageChange);
    };
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
          <Starfield onCanvasBoundsChange={handleCanvasBoundsChange} />
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
            onCanvasBoundsChange={handleCanvasBoundsChange}
            isPaused={isPauseOverlayVisible}
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
