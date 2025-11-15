import React, { useState, useEffect, useRef, useCallback } from "react";
import type { FaceDetector } from "@tensorflow-models/face-detection";

import Starfield from "./components/Starfield";
import Dashboard from "./components/Dashboard";
import PauseMenu from "./components/PauseMenu";
import MainMenu from "./components/MainMenu";
import IntroScreen from "./components/IntroScreen";

import useGameStore from "./state/useGameStore";

import { Destination } from "./types";
import {
  AUDIO_FADE_INTERVAL_MS,
  AUDIO_FADE_STEP,
  ATTENTION_INTERVAL_MS,
  FACE_DETECTION_INTERVAL_MS,
  INACTIVITY_LIMIT_SECONDS,
  INTRO_AUTO_SKIP_TIMEOUT_MS,
  MUSIC_ACTIVE_VOLUME,
  SERVICE_UPDATE_INTERVAL_MS,
  TRAVEL_YEARS_PER_SECOND,
} from "./constants/constants";
import {
  createFaceDetector,
  isFaceLookingForward,
} from "./services/faceRecognition";

const App: React.FC = () => {
  const {
    destination,
    remainingYears,
    isPaused,
    cameraError,
    showExitConfirm,
    isAttentionLost,
    inactivitySeconds,
    crewLost,
    crewLostReason,
    missionComplete,
    canvasBounds,
    serviceSeconds,
    bestServiceSeconds,
    isMusicMuted,
    isInitializing,
    showIntro,
    setRemainingYears,
    setIsPaused,
    setCameraError,
    setShowExitConfirm,
    setIsAttentionLost,
    setInactivitySeconds,
    setCrewLost,
    setCrewLostReason,
    setMissionComplete,
    setCanvasBounds,
    setServiceSeconds,
    setBestServiceSeconds,
    setIsMusicMuted,
    setIsInitializing,
    setShowIntro,
    startMission,
    resetToMenu,
  } = useGameStore();
  const [isAudioReady, setIsAudioReady] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const isDetectingRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const volumeIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const audio = new Audio(`${import.meta.env.BASE_URL}main_theme.mp3`);
    audio.loop = true;
    audio.volume = 0;
    audioRef.current = audio;
    setIsAudioReady(true);

    return () => {
      if (volumeIntervalRef.current !== null) {
        window.clearInterval(volumeIntervalRef.current);
        volumeIntervalRef.current = null;
      }
      audio.pause();
      audioRef.current = null;
      setIsAudioReady(false);
    };
  }, []);

  const handleSelectDestination = (selectedDestination: Destination) => {
    startMission(selectedDestination);
  };

  const handleRequestExit = () => {
    setShowExitConfirm(true);
    setIsPaused(true);
  };

  const handleConfirmExit = () => {
    updateBestServiceTime(serviceSeconds);
    resetToMenu();
  };

  const handleCancelExit = () => {
    setShowExitConfirm(false);
    if (!crewLost && !missionComplete) {
      setIsPaused(false);
    }
  };

  const attentionCountdown =
    isAttentionLost && !missionComplete
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
    setShowIntro(false);
  }, [setShowIntro]);

  const serviceMinutes = serviceSeconds / 60;
  const bestServiceMinutes = bestServiceSeconds / 60;
  const crewLostMessage =
    crewLostReason === "buttons"
      ? "Az egész hibernált legénység elpusztult, mert piszkáltad a gombokat!"
      : "Vége játéknak, a teljes legénység meghalt, mert nem figyeltél oda.";
  const isPauseOverlayVisible =
    !crewLost &&
    !missionComplete &&
    isPaused &&
    !cameraError &&
    !showExitConfirm;
  const showBellOverlay =
    !!canvasBounds && (!destination || isPauseOverlayVisible);
  const bellOverlay =
    showBellOverlay && canvasBounds ? (
      <div
        className="absolute z-[80] pointer-events-none"
        style={{
          top: canvasBounds.top,
          left: canvasBounds.left,
          width: canvasBounds.width,
          height: canvasBounds.height,
        }}
      >
        <button
          onClick={handleToggleMusic}
          className="absolute bottom-6 right-6 text-3xl text-cyan-200 hover:text-white transition focus:outline-none pointer-events-auto drop-shadow-[0_0_10px_rgba(0,0,0,0.7)]"
          aria-label={isMusicMuted ? "Zene bekapcsolása" : "Zene némítása"}
        >
          {isMusicMuted ? "🔕" : "🔔"}
        </button>
      </div>
    ) : null;

  const fadeAudio = useCallback((targetVolume: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const clampedTarget = Math.max(0, Math.min(1, targetVolume));

    if (volumeIntervalRef.current !== null) {
      window.clearInterval(volumeIntervalRef.current);
      volumeIntervalRef.current = null;
    }

    const step = AUDIO_FADE_STEP;
    const intervalDuration = AUDIO_FADE_INTERVAL_MS;

    volumeIntervalRef.current = window.setInterval(() => {
      if (!audioRef.current) {
        if (volumeIntervalRef.current !== null) {
          window.clearInterval(volumeIntervalRef.current);
          volumeIntervalRef.current = null;
        }
        return;
      }

      const currentVolume = audio.volume;
      const diff = clampedTarget - currentVolume;

      if (Math.abs(diff) <= step) {
        audio.volume = clampedTarget;
        if (volumeIntervalRef.current !== null) {
          window.clearInterval(volumeIntervalRef.current);
          volumeIntervalRef.current = null;
        }
        if (clampedTarget === 0) {
          audio.pause();
        }
        return;
      }

      audio.volume = currentVolume + Math.sign(diff) * step;
    }, intervalDuration);
  }, []);

  const updateBestServiceTime = useCallback(
    (seconds: number) => {
      if (seconds <= 0) return;
      setBestServiceSeconds((prev) => (seconds <= prev ? prev : seconds));
    },
    [setBestServiceSeconds],
  );

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

    const handleKeyDown = () => {
      const { crewLost, missionComplete, serviceSeconds } =
        useGameStore.getState();
      if (crewLost || missionComplete) {
        return;
      }

      updateBestServiceTime(serviceSeconds);
      setCrewLost(true);
      setCrewLostReason("buttons");
      setShowExitConfirm(false);
      setIsPaused(true);
      setIsAttentionLost(false);
      setInactivitySeconds(0);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    destination,
    setCrewLost,
    setCrewLostReason,
    setShowExitConfirm,
    setIsPaused,
    setIsAttentionLost,
    setInactivitySeconds,
    updateBestServiceTime,
  ]);

  const shouldPlayMusic =
    !destination ||
    (!showExitConfirm &&
      !cameraError &&
      !crewLost &&
      !missionComplete &&
      isPaused);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !isAudioReady) return;

    const targetVolume =
      shouldPlayMusic && !isMusicMuted ? MUSIC_ACTIVE_VOLUME : 0;

    if (shouldPlayMusic && !isMusicMuted) {
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {
          // Autoplay might be blocked; ignore errors.
        });
      }
    }

    fadeAudio(targetVolume);
  }, [shouldPlayMusic, isMusicMuted, fadeAudio, isAudioReady]);

  useEffect(() => {
    if (!destination || isPaused || crewLost || missionComplete) {
      return;
    }

    let lastTimestamp = performance.now();
    const interval = window.setInterval(() => {
      const now = performance.now();
      const deltaSeconds = (now - lastTimestamp) / 1000;
      lastTimestamp = now;

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
    setServiceSeconds,
    setRemainingYears,
  ]);

  useEffect(() => {
    if (!isAttentionLost) {
      setInactivitySeconds(0);
    }
  }, [isAttentionLost, setInactivitySeconds]);

  useEffect(() => {
    if (!destination || !isAttentionLost || crewLost || missionComplete) {
      return;
    }

    const interval = window.setInterval(() => {
      setInactivitySeconds((prev) => {
        const next = prev + 1;
        if (next >= INACTIVITY_LIMIT_SECONDS) {
          updateBestServiceTime(useGameStore.getState().serviceSeconds);
          setCrewLost(true);
          setCrewLostReason("attention");
          setShowExitConfirm(false);
          setIsPaused(true);
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
    setInactivitySeconds,
    setCrewLost,
    setCrewLostReason,
    setShowExitConfirm,
    setIsPaused,
  ]);

  useEffect(() => {
    if (!destination || missionComplete || crewLost) {
      return;
    }

    if (remainingYears <= 0) {
      updateBestServiceTime(useGameStore.getState().serviceSeconds);
      setMissionComplete(true);
      setIsPaused(true);
      setIsAttentionLost(false);
      setInactivitySeconds(0);
      setShowExitConfirm(false);
    }
  }, [
    destination,
    remainingYears,
    missionComplete,
    crewLost,
    updateBestServiceTime,
    setMissionComplete,
    setIsPaused,
    setIsAttentionLost,
    setInactivitySeconds,
    setShowExitConfirm,
  ]);

  // Camera and face detection effect
  useEffect(() => {
    if (!destination) {
      setIsInitializing(false);
      return;
    }

    let detector: FaceDetector | null = null;
    let detectionInterval: number;
    let isCancelled = false;

    const setup = async () => {
      // 1. Setup camera
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play();
        }
      } catch (err) {
        if (!isCancelled) {
          console.error("Error accessing camera:", err);
          setCameraError(
            "Kamera hozzáférés szükséges a játékhoz. Engedélyezd a kamerát és frissítsd az oldalt.",
          );
          setIsPaused(true);
          setIsInitializing(false);
        }
        return;
      }

      // 2. Load model
      try {
        detector = await createFaceDetector();
      } catch (error) {
        if (!isCancelled) {
          console.error("Error loading face detection model:", error);
          setCameraError(
            "Hiba a gépi látás modell betöltése közben. Próbáld meg frissíteni az oldalt.",
          );
          setIsPaused(true);
          setIsInitializing(false);
        }
        return;
      }

      // 3. Start detection loop
      const detectFace = async () => {
        if (isDetectingRef.current || !videoRef.current || !detector) return;

        const video = videoRef.current;
        if (video.readyState < 3) return; // Wait for enough data to play

        isDetectingRef.current = true;

        try {
          const faces = await detector.estimateFaces(video, {
            flipHorizontal: false,
          });
          const hasForwardFacingFace = faces.some(isFaceLookingForward);
          const attentionLost = !hasForwardFacingFace;
          const stateSnapshot = useGameStore.getState();
          const blockingOverlay =
            stateSnapshot.showExitConfirm ||
            stateSnapshot.crewLost ||
            !!stateSnapshot.cameraError ||
            stateSnapshot.missionComplete;

          setIsAttentionLost(attentionLost && !blockingOverlay);

          if (attentionLost) {
            setIsPaused(true);
          } else if (!blockingOverlay) {
            setIsPaused(false);
          }

          if (!attentionLost) {
            setInactivitySeconds(0);
          }
        } catch (error) {
          console.error("Error detecting face:", error);
          setIsPaused(true);
        } finally {
          isDetectingRef.current = false;
        }
      };

      detectionInterval = window.setInterval(
        detectFace,
        FACE_DETECTION_INTERVAL_MS,
      );
      if (!isCancelled) {
        setIsInitializing(false);
      }
    };

    setup();

    return () => {
      isCancelled = true;
      clearInterval(detectionInterval);
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
      if (detector) {
        detector.dispose();
      }
    };
  }, [
    destination,
    setIsInitializing,
    setCameraError,
    setIsPaused,
    setIsAttentionLost,
    setInactivitySeconds,
  ]);

  if (!destination) {
    return (
      <main className="relative w-screen h-screen bg-black overflow-hidden font-mono">
        <Starfield onCanvasBoundsChange={handleCanvasBoundsChange} />
        {showIntro ? (
          <IntroScreen onSkip={handleSkipIntro} />
        ) : (
          <>
            <MainMenu onSelectDestination={handleSelectDestination} />
            {bellOverlay}
          </>
        )}
      </main>
    );
  }

  return (
    <main className="relative w-screen h-screen bg-black overflow-hidden font-mono">
      <Starfield
        onCanvasBoundsChange={handleCanvasBoundsChange}
        isPaused={isPauseOverlayVisible}
      />
      {canvasBounds && (
        <div
          className="absolute z-60 pointer-events-none"
          style={{
            top: canvasBounds.top,
            left: canvasBounds.left,
            width: canvasBounds.width,
            height: canvasBounds.height,
          }}
        >
          <button
            onClick={handleRequestExit}
            className="absolute top-6 right-6 px-4 py-2 bg-red-600/80 hover:bg-red-600 text-white font-semibold rounded shadow-lg transition focus:outline-none focus:ring-2 focus:ring-red-400 pointer-events-auto"
          >
            Kilépés
          </button>
          <div className="absolute top-6 left-6 bg-black/60 text-cyan-100 px-4 py-2 rounded shadow pointer-events-none font-semibold tracking-wide text-left space-y-1">
            <p>Szolgálati idő: {serviceMinutes.toFixed(2)} perc</p>
            <p className="text-sm text-cyan-200 font-normal">
              Rekord: {bestServiceMinutes.toFixed(2)} perc
            </p>
          </div>
        </div>
      )}
      <div className="absolute inset-0 flex flex-col justify-end items-center pointer-events-none">
        <Dashboard
          remainingYears={remainingYears}
          destinationName={destination.name}
        />
      </div>

      {missionComplete && (
        <div className="absolute inset-0 bg-black/80 flex flex-col justify-center items-center z-50 px-6 text-center">
          <div className="bg-emerald-900/40 border border-emerald-400/60 rounded-2xl p-8 max-w-xl shadow-2xl">
            <h2 className="text-3xl md:text-4xl font-bold text-emerald-200 mb-4 uppercase tracking-widest">
              Megérkeztél!
            </h2>
            <p className="text-lg text-emerald-100 leading-relaxed">
              Megérkeztél! Az uticélod a jobb oldalon van!
            </p>
            <button
              onClick={handleConfirmExit}
              className="mt-8 px-6 py-2 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold rounded shadow"
            >
              Vissza a főmenübe
            </button>
          </div>
        </div>
      )}

      {crewLost && (
        <div className="absolute inset-0 bg-black/85 flex flex-col justify-center items-center z-50 px-6 text-center">
          <div className="bg-red-950/40 border border-red-500/60 rounded-2xl p-8 max-w-xl shadow-2xl">
            <h2 className="text-3xl md:text-4xl font-bold text-red-300 mb-4 uppercase tracking-widest">
              Vége a játéknak
            </h2>
            <p className="text-lg text-red-200 leading-relaxed">
              {crewLostMessage}
            </p>
            <button
              onClick={handleConfirmExit}
              className="mt-8 px-6 py-2 bg-red-600 hover:bg-red-500 text-white font-semibold rounded shadow"
            >
              Vissza a főmenübe
            </button>
          </div>
        </div>
      )}

      {showExitConfirm ? (
        <div className="absolute inset-0 bg-black/80 flex flex-col justify-center items-center z-50 px-6">
          <div className="bg-slate-900/90 border border-cyan-400/40 rounded-xl p-8 max-w-lg text-center shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-4">
              Biztosan kilépsz?
            </h2>
            <p className="text-cyan-200 leading-relaxed">
              A játék nem menti az eddigi elért eredményeidet!
            </p>
            <div className="mt-8 flex flex-wrap gap-4 justify-center">
              <button
                onClick={handleConfirmExit}
                className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white font-semibold rounded"
              >
                Igen
              </button>
              <button
                onClick={handleCancelExit}
                className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded"
              >
                Nem
              </button>
            </div>
          </div>
        </div>
      ) : cameraError ? (
        <div className="absolute inset-0 bg-black/70 flex flex-col justify-center items-center z-50 backdrop-blur-md">
          <div className="text-center p-4">
            <h2 className="text-2xl font-bold text-red-400 tracking-widest uppercase">
              Hiba
            </h2>
            <p className="mt-4 text-lg text-red-300">{cameraError}</p>
          </div>
        </div>
      ) : isPauseOverlayVisible ? (
        <PauseMenu
          countdownSeconds={attentionCountdown}
          isInitializing={isInitializing}
        />
      ) : null}

      {bellOverlay}

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ display: "none", position: "absolute" }}
      />
    </main>
  );
};

export default App;
