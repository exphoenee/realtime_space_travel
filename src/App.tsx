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
  FACE_BALANCE_MAX_RATIO,
  FACE_BALANCE_MIN_RATIO,
  EYE_LEVEL_MAX_OFFSET_RATIO,
  INACTIVITY_LIMIT_SECONDS,
  INTRO_AUTO_SKIP_TIMEOUT_MS,
  MAX_WEATHER_UPDATE_INTERVAL_MS,
  MIN_WEATHER_UPDATE_INTERVAL_MS,
  SHIP_SPEED_KM_PER_SECOND,
  SHIP_SPEED_LIGHTYEARS_PER_YEAR,
  MUSIC_ACTIVE_VOLUME,
  SERVICE_UPDATE_INTERVAL_MS,
  TRAVEL_YEARS_PER_SECOND,
} from "./constants/constants";
import { weatherConditions } from "./constants/universeData";
import {
  createFaceDetector,
  isFaceLookingForward,
  analyzeFace,
  FaceAnalysis,
} from "./services/faceRecognition";

const DEBUG_MODE = import.meta.env.VITE_DEBUG_MODE === "true";
const DEBUG_KEYPOINT_COLORS: Record<string, string> = {
  noseTip: "#fbbf24",
  leftEye: "#38bdf8",
  rightEye: "#38bdf8",
  leftEarTragion: "#f97316",
  rightEarTragion: "#f97316",
};

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
  const [localWeather, setLocalWeather] = useState(weatherConditions[0]);
  const [faceStatus, setFaceStatus] = useState<{
    detected: boolean;
    timestamp: number;
  }>({
    detected: false,
    timestamp: Date.now(),
  });
  const [debugMetrics, setDebugMetrics] = useState<FaceAnalysis | null>(null);

  const isDebugMode = DEBUG_MODE;
  const videoRef = useRef<HTMLVideoElement>(null);
  const debugCanvasRef = useRef<HTMLCanvasElement | null>(null);
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

  useEffect(() => {
    const pickWeather = () =>
      weatherConditions[Math.floor(Math.random() * weatherConditions.length)];

    if (!destination) {
      setLocalWeather(weatherConditions[0]);
      return;
    }

    let timeoutId: number | null = null;

    const scheduleNext = () => {
      const delay =
        MIN_WEATHER_UPDATE_INTERVAL_MS +
        Math.random() *
          (MAX_WEATHER_UPDATE_INTERVAL_MS - MIN_WEATHER_UPDATE_INTERVAL_MS);
      timeoutId = window.setTimeout(() => {
        setLocalWeather(pickWeather());
        scheduleNext();
      }, delay);
    };

    setLocalWeather(pickWeather());
    scheduleNext();

    return () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [destination]);

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
    isDebugMode && destination ? (
      <div className="absolute bottom-6 left-6 z-50 pointer-events-none flex flex-col gap-2">
        <canvas
          ref={debugCanvasRef}
          className="rounded border border-cyan-400/60 shadow-lg shadow-black/50 bg-black/80"
          style={{
            width: `${debugWidth}px`,
            height: `${debugHeight}px`,
          }}
        />
        <div className="px-3 py-2 bg-black/70 text-cyan-100 text-xs rounded border border-cyan-400/40">
          <p>
            Kamera állapot:{" "}
            <span
              className={
                faceStatus.detected ? "text-green-400 font-semibold" : "text-red-400 font-semibold"
              }
            >
              {faceStatus.detected ? "Arc érzékelve" : "Nincs arc"}
            </span>
          </p>
          <p className="mt-1 text-[11px] text-cyan-200/80">
            Utolsó frissítés: {lastUpdateAgoSeconds.toFixed(1)}s
          </p>
          <div className="mt-2 space-y-1 text-[11px] text-cyan-200/90">
            <p>
              Balance arány:{" "}
              {debugMetrics
                ? `${debugMetrics.balanceRatio.toFixed(2)} (céltartomány ${FACE_BALANCE_MIN_RATIO.toFixed(2)}-${FACE_BALANCE_MAX_RATIO.toFixed(2)})`
                : "N/A"}
            </p>
            <p>
              Szem döntés arány:{" "}
              {debugMetrics
                ? `${debugMetrics.eyeVerticalRatio.toFixed(2)} (limit ${EYE_LEVEL_MAX_OFFSET_RATIO.toFixed(2)})`
                : "N/A"}
            </p>
            <p>
              Szem-fül különbség:{" "}
              {debugMetrics
                ? `${debugMetrics.eyeEarMargin.toFixed(2)}`
                : "N/A"}{" "}
              (pozitív érték szükséges)
            </p>
          </div>
        </div>
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
      setFaceStatus({ detected: false, timestamp: Date.now() });
      setDebugMetrics(null);
      const canvas = debugCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
      return;
    }

    let detector: FaceDetector | null = null;
    let detectionInterval: number;
    const debugCanvas = debugCanvasRef.current;
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
          let primaryAnalysis: FaceAnalysis | null = null;
          const hasForwardFacingFace = faces.some((face) => {
            const analysis = analyzeFace(face);
            if (!primaryAnalysis) {
              primaryAnalysis = analysis;
            }
            return analysis.forward;
          });

          if (isDebugMode && debugCanvas) {
            const ctx = debugCanvas.getContext("2d");
            if (ctx) {
              debugCanvas.width = video.videoWidth;
              debugCanvas.height = video.videoHeight;
              ctx.drawImage(video, 0, 0, debugCanvas.width, debugCanvas.height);
              ctx.strokeStyle = hasForwardFacingFace ? "#22c55e" : "#ef4444";
              ctx.lineWidth = 4;
              faces.forEach((face) => {
                const box = face.box;
                ctx.strokeRect(box.xMin, box.yMin, box.width, box.height);
                face.keypoints?.forEach((kp) => {
                  if (!kp.name) return;
                  const color = DEBUG_KEYPOINT_COLORS[kp.name];
                  if (!color) return;
                  ctx.beginPath();
                  ctx.fillStyle = color;
                  ctx.strokeStyle = "#0f172a";
                  ctx.lineWidth = 2;
                  ctx.arc(kp.x, kp.y, 6, 0, Math.PI * 2);
                  ctx.fill();
                  ctx.stroke();
                });
              });
            }
          }
          setDebugMetrics(primaryAnalysis);
          setFaceStatus({
            detected: hasForwardFacingFace,
            timestamp: Date.now(),
          });

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
    isDebugMode,
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
          localWeather={localWeather}
          currentSpeedKmPerSecond={SHIP_SPEED_KM_PER_SECOND}
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
      {debugOverlay}

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
