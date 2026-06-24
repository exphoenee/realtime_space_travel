import React, { useState, useEffect, useCallback } from "react";

import ScreenRouter from "./components/ScreenRouter";
import Starfield from "./components/Starfield";
import Dashboard from "./components/Dashboard";
import PauseMenu from "./components/PauseMenu";

import useGameStore from "./state/useGameStore";
import useUIStore from "./state/useUIStore";
import { useAudio } from "./hooks/useAudio";
import { useWeather } from "./hooks/useWeather";
import { useCamera } from "./hooks/useCamera";
import { useFaceDetection } from "./hooks/useFaceDetection";
import { useAttentionMonitor } from "./hooks/useAttentionMonitor";

import { Destination } from "./types";
import {
  ATTENTION_INTERVAL_MS,
  INACTIVITY_LIMIT_SECONDS,
  INTRO_AUTO_SKIP_TIMEOUT_MS,
  SHIP_SPEED_KM_PER_SECOND,
  SERVICE_UPDATE_INTERVAL_MS,
  TRAVEL_YEARS_PER_SECOND,
} from "./constants/constants";
import styles from "./App.module.css";

const DEBUG_MODE = import.meta.env.VITE_DEBUG_MODE === "true";

const App: React.FC = () => {
  const {
    gamePhase,
    destination,
    remainingYears,
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
    setCameraError,
    setShowExitConfirm,
    setIsMusicMuted,
  } = useUIStore();

  const [canvasBounds, setCanvasBounds] = useState<DOMRectReadOnly | null>(null);

  const { playMusic } = useAudio();
  const localWeather = useWeather(destination);
  const { videoRef, isStreamReady } = useCamera(destination);
  const { debugCanvasRef, faceStatus, debugMetrics } = useFaceDetection(
    videoRef,
    destination,
    isStreamReady,
    DEBUG_MODE,
  );
  useAttentionMonitor(faceStatus, destination);

  const handleSelectDestination = async (selectedDestination: Destination) => {
    if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) {
      setCameraError(
        "A böngésződ nem támogatja a kamera hozzáférést. Próbálj másik böngészőt.",
      );
      return;
    }

    if (!window.FaceDetection) {
      setCameraError(
        "A gépi látás modell nem tölthető be. Próbáld meg frissíteni az oldalt.",
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((t) => t.stop());
    } catch (err) {
      let errorMessage =
        "Kamera hozzáférés szükséges a játékhoz. Engedélyezd a kamerát és frissítsd az oldalt.";
      if (err instanceof DOMException) {
        switch (err.name) {
          case "NotAllowedError":
            errorMessage =
              "Kamera hozzáférés megtagadva. Kérjük, engedélyezd a kamerát a böngésző beállításaiban.";
            break;
          case "NotFoundError":
            errorMessage =
              "Nem található kamera. Csatlakoztass egy webkamerát és próbáld újra.";
            break;
          case "NotReadableError":
            errorMessage =
              "A kamera nem olvasható. Lehet, hogy egy másik alkalmazás használja.";
            break;
        }
      }
      setCameraError(errorMessage);
      return;
    }

    setCameraError(null);
    setShowExitConfirm(false);
    startMission(selectedDestination);
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

  const isPreGame = gamePhase === "intro" || gamePhase === "menu" || gamePhase === "loading";

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

  const handleToggleMusic = useCallback(() => {
    setIsMusicMuted((prev) => !prev);
  }, [setIsMusicMuted]);

  const handleSkipIntro = useCallback(() => {
    useGameStore.getState().transitionTo("menu");
  }, []);

  const serviceMinutes = serviceSeconds / 60;
  const bestServiceMinutes = bestServiceSeconds / 60;
  const crewLostMessage =
    crewLostReason === "buttons"
      ? "Az egész hibernált legénység elpusztult, mert piszkáltad a gombokat!"
      : "Vége játéknak, a teljes legénység meghalt, mert nem figyeltél oda.";

  // Pause overlay visible when in paused/countdown phase and no blocking overlays
  const isPauseOverlayVisible =
    (gamePhase === "paused" || gamePhase === "countdown") &&
    !cameraError &&
    !showExitConfirm;

  const showBellOverlay =
    !!canvasBounds && (isPreGame || isPauseOverlayVisible);
  const bellOverlay =
    showBellOverlay && canvasBounds ? (
      <div
        className={styles.bellOverlay}
        style={{
          top: canvasBounds.top,
          left: canvasBounds.left,
          width: canvasBounds.width,
          height: canvasBounds.height,
        }}
      >
        <button
          onClick={handleToggleMusic}
          className={styles.musicButton}
          aria-label={isMusicMuted ? "Zene bekapcsolása" : "Zene némítása"}
        >
          {isMusicMuted ? "🔕" : "🔔"}
        </button>
      </div>
    ) : null;

  const videoElement = videoRef.current;
  const debugWidth = canvasBounds ? canvasBounds.width / 4 : 320;
  const videoAspect =
    videoElement && videoElement.videoHeight > 0
      ? videoElement.videoWidth / videoElement.videoHeight
      : 16 / 9;
  const debugHeight = debugWidth / videoAspect;
  const lastUpdateAgoSeconds = Math.max(
    0,
    (Date.now() - faceStatus.timestamp) / 1000,
  );
  const debugOverlay =
    DEBUG_MODE && destination ? (
      <div className={styles.debugOverlay}>
        <canvas
          ref={debugCanvasRef}
          className={styles.debugCanvas}
          style={{
            width: `${debugWidth}px`,
            height: `${debugHeight}px`,
          }}
        />
        <div className={styles.debugInfo}>
          <p>
            Kamera állapot:{" "}
            <span style={{ color: faceStatus.detected ? "#22c55e" : "#f87171" }}>
              {faceStatus.detected ? "Arc érzékelve" : "Nincs arc"}
            </span>
          </p>
          <p>Utolsó frissítés: {lastUpdateAgoSeconds.toFixed(1)}s</p>
          <p>
            Balance arány:{" "}
            {debugMetrics
              ? `${debugMetrics.balanceRatio.toFixed(2)}`
              : "N/A"}
          </p>
          <p>
            Szem döntés arány:{" "}
            {debugMetrics
              ? `${debugMetrics.eyeVerticalRatio.toFixed(2)}`
              : "N/A"}
          </p>
          <p>
            Szem-fül különbség:{" "}
            {debugMetrics ? `${debugMetrics.eyeEarMargin.toFixed(2)}` : "N/A"}
          </p>
          <label className={styles.debugToggle}>
            <input
              type="checkbox"
              checked={debugIgnoreAttention}
              onChange={(e) => setDebugIgnoreAttention(e.target.checked)}
            />
            <span>Figyelmen kívül hagyás</span>
          </label>
        </div>
      </div>
    ) : null;

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
    !destination ||
    (!showExitConfirm &&
      !cameraError &&
      !crewLost &&
      !missionComplete &&
      isPaused);

  useEffect(() => {
    playMusic(shouldPlayMusic, isMusicMuted);
  }, [shouldPlayMusic, isMusicMuted, playMusic]);

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
          />
          {bellOverlay}
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
              <button onClick={handleRequestExit} className={styles.exitButton} aria-label="Kilépés a küldetésből">
                Kilépés
              </button>
              <div className={styles.statsPanel}>
                <p>Szolgálati idő: {serviceMinutes.toFixed(2)} perc</p>
                <p className={styles.statsRecord}>
                  Rekord: {bestServiceMinutes.toFixed(2)} perc
                </p>
              </div>
            </div>
          )}
          <div className={styles.dashboardWrapper}>
            <Dashboard
              remainingYears={remainingYears}
              destinationName={destination.name}
              localWeather={localWeather}
              currentSpeedKmPerSecond={SHIP_SPEED_KM_PER_SECOND}
            />
          </div>

          {missionComplete && (
            <div className={styles.overlay}>
              <div className={`${styles.overlayCard} ${styles.successCard}`}>
                <h2 className={styles.overlayTitle}>Megérkeztél!</h2>
                <p className={styles.overlayText}>
                  Megérkeztél! Az uticélod a jobb oldalon van!
                </p>
                <div className={styles.overlayActions}>
                  <button
                    onClick={handleConfirmExit}
                    className={`${styles.button} ${styles.successButton}`}
                  >
                    Vissza a főmenübe
                  </button>
                </div>
              </div>
            </div>
          )}

          {crewLost && (
            <div className={styles.overlay}>
              <div className={`${styles.overlayCard} ${styles.dangerCard}`}>
                <h2 className={styles.overlayTitle}>Vége a játéknak</h2>
                <p className={styles.overlayText}>{crewLostMessage}</p>
                <div className={styles.overlayActions}>
                  <button
                    onClick={handleConfirmExit}
                    className={`${styles.button} ${styles.dangerButton}`}
                  >
                    Vissza a főmenübe
                  </button>
                </div>
              </div>
            </div>
          )}

          {showExitConfirm ? (
            <div className={styles.overlay}>
              <div className={`${styles.overlayCard} ${styles.neutralCard}`}>
                <h2 className={styles.overlayTitle}>Biztosan kilépsz?</h2>
                <p className={styles.overlayText}>
                  A játék nem menti az eddigi elért eredményeidet!
                </p>
                <div className={styles.overlayActions}>
                  <button
                    onClick={handleConfirmExit}
                    className={`${styles.button} ${styles.dangerButton}`}
                  >
                    Igen
                  </button>
                  <button
                    onClick={handleCancelExit}
                    className={`${styles.button} ${styles.neutralButton}`}
                  >
                    Nem
                  </button>
                </div>
              </div>
            </div>
          ) : cameraError ? (
            <div className={`${styles.overlay} ${styles.cameraError}`}>
              <div className={`${styles.overlayCard} ${styles.cameraErrorCard}`}>
                <h2 className={styles.cameraErrorTitle}>Hiba</h2>
                <p className={styles.cameraErrorText}>{cameraError}</p>
                <div className={styles.overlayActions}>
                  <button
                    onClick={() => {
                      useUIStore.getState().setCameraError(null);
                      useGameStore.getState().setIsPaused(false);
                    }}
                    className={`${styles.button} ${styles.neutralButton}`}
                  >
                    Próbáld újra
                  </button>
                </div>
              </div>
            </div>
          ) : isPauseOverlayVisible ? (
            <PauseMenu countdownSeconds={attentionCountdown} />
          ) : null}

          {bellOverlay}
          {debugOverlay}
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
