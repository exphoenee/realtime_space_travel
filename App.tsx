import React, { useState, useEffect, useRef, useCallback } from "react";
import Starfield from "./components/Starfield";
import Dashboard from "./components/Dashboard";
import PauseMenu from "./components/PauseMenu";
import MainMenu from "./components/MainMenu";
import * as tf from "@tensorflow/tfjs";
import * as faceDetection from "@tensorflow-models/face-detection";

export interface Destination {
  name: string;
  travelYears: number;
}

const isFaceLookingForward = (face: faceDetection.Face) => {
  const namedKeypoints = face.keypoints.reduce<Record<string, faceDetection.Keypoint>>((acc, keypoint) => {
    if (keypoint.name) {
      acc[keypoint.name] = keypoint;
    }
    return acc;
  }, {});

  const leftEar = namedKeypoints.leftEarTragion;
  const rightEar = namedKeypoints.rightEarTragion;
  const leftEye = namedKeypoints.leftEye;
  const rightEye = namedKeypoints.rightEye;
  const nose = namedKeypoints.noseTip;

  if (!leftEar || !rightEar || !leftEye || !rightEye || !nose) {
    return false;
  }

  const distance = (a: faceDetection.Keypoint, b: faceDetection.Keypoint) =>
    Math.hypot(a.x - b.x, a.y - b.y);
  const leftEarDistance = distance(nose, leftEar);
  const rightEarDistance = distance(nose, rightEar);

  if (leftEarDistance === 0 || rightEarDistance === 0) {
    return false;
  }

  // Expect both ears to be almost equally far from the nose when the face is
  // directed toward the camera. The threshold can be tuned if needed.
  const balanceRatio = leftEarDistance / rightEarDistance;
  const symmetricalFace = balanceRatio > 0.65 && balanceRatio < 1 / 0.65;

  const eyeHorizontalSpan = Math.abs(leftEye.x - rightEye.x);
  const eyeVerticalOffset = Math.abs(leftEye.y - rightEye.y);
  const eyesLevel = eyeHorizontalSpan > 0 && eyeVerticalOffset / eyeHorizontalSpan < 0.35;

  return symmetricalFace && eyesLevel;
};

const INACTIVITY_LIMIT_SECONDS = 60;

const App: React.FC = () => {
  const [destination, setDestination] = useState<Destination | null>(null);
  const [remainingYears, setRemainingYears] = useState(0);
  const [isPaused, setIsPaused] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [isAttentionLost, setIsAttentionLost] = useState(false);
  const [inactivitySeconds, setInactivitySeconds] = useState(0);
  const [crewLost, setCrewLost] = useState(false);
  const [missionComplete, setMissionComplete] = useState(false);
  const [canvasBounds, setCanvasBounds] = useState<DOMRectReadOnly | null>(null);
  const [serviceSeconds, setServiceSeconds] = useState(0);
  const [bestServiceSeconds, setBestServiceSeconds] = useState(0);
  const [isMusicMuted, setIsMusicMuted] = useState(false);
  const [isAudioReady, setIsAudioReady] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const isDetectingRef = useRef(false);
  const showExitConfirmRef = useRef(showExitConfirm);
  const cameraErrorRef = useRef<string | null>(cameraError);
  const crewLostRef = useRef(crewLost);
  const missionCompleteRef = useRef(missionComplete);
  const serviceSecondsRef = useRef(serviceSeconds);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const volumeIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    showExitConfirmRef.current = showExitConfirm;
  }, [showExitConfirm]);

  useEffect(() => {
    cameraErrorRef.current = cameraError;
  }, [cameraError]);

  useEffect(() => {
    crewLostRef.current = crewLost;
  }, [crewLost]);

  useEffect(() => {
    missionCompleteRef.current = missionComplete;
  }, [missionComplete]);

  useEffect(() => {
    serviceSecondsRef.current = serviceSeconds;
  }, [serviceSeconds]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("bestServiceSeconds");
    if (!stored) return;
    const parsed = parseFloat(stored);
    if (!Number.isNaN(parsed) && parsed > 0) {
      setBestServiceSeconds(parsed);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (bestServiceSeconds > 0) {
      window.localStorage.setItem(
        "bestServiceSeconds",
        bestServiceSeconds.toString(),
      );
    }
  }, [bestServiceSeconds]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedMute = window.localStorage.getItem("musicMuted");
    if (storedMute === "true") {
      setIsMusicMuted(true);
    }
  }, []);

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
    setDestination(selectedDestination);
    setRemainingYears(selectedDestination.travelYears);
    setIsPaused(true); // Start paused until face is detected
    setShowExitConfirm(false);
    setCrewLost(false);
    setIsAttentionLost(false);
    setInactivitySeconds(0);
    setMissionComplete(false);
    setServiceSeconds(0);
  };

  const handleRequestExit = () => {
    setShowExitConfirm(true);
    setIsPaused(true);
  };

  const handleConfirmExit = () => {
    updateBestServiceTime(serviceSeconds);
    setShowExitConfirm(false);
    setDestination(null);
    setRemainingYears(0);
    setCameraError(null);
    setIsPaused(true);
    setCrewLost(false);
    setIsAttentionLost(false);
    setInactivitySeconds(0);
    setMissionComplete(false);
    setServiceSeconds(0);
  };

  const handleCancelExit = () => {
    setShowExitConfirm(false);
    if (!crewLost && !missionComplete) {
      setIsPaused(false);
    }
  };

  const attentionCountdown = isAttentionLost && !missionComplete
    ? Math.max(0, INACTIVITY_LIMIT_SECONDS - inactivitySeconds)
    : null;

  const handleCanvasBoundsChange = useCallback((bounds: DOMRectReadOnly) => {
    setCanvasBounds(bounds);
  }, []);

  const handleToggleMusic = useCallback(() => {
    setIsMusicMuted((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        window.localStorage.setItem("musicMuted", next ? "true" : "false");
      }
      return next;
    });
  }, []);

  const serviceMinutes = serviceSeconds / 60;
  const bestServiceMinutes = bestServiceSeconds / 60;
  const isPauseOverlayVisible =
    !crewLost && !missionComplete && isPaused && !cameraError && !showExitConfirm;
  const showBellOverlay = !!canvasBounds && (!destination || isPauseOverlayVisible);
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

    const step = 0.05;
    const intervalDuration = 50;

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
      setBestServiceSeconds((prev) => {
        if (seconds <= prev) {
          return prev;
        }
        if (typeof window !== "undefined") {
          window.localStorage.setItem(
            "bestServiceSeconds",
            seconds.toString(),
          );
        }
        return seconds;
      });
    },
    [],
  );

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

    const targetVolume = shouldPlayMusic && !isMusicMuted ? 0.6 : 0;

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

  // Countdown timer effect
  useEffect(() => {
    if (!destination) return;

    const timer = setInterval(() => {
      if (isPaused) return;

      setRemainingYears((prevYears) => {
        if (prevYears <= 0) {
          clearInterval(timer);
          return 0;
        }
        return prevYears - 0.001;
      });
    }, 50);

    return () => clearInterval(timer);
  }, [isPaused, destination]);

  useEffect(() => {
    if (!destination || isPaused || crewLost || missionComplete) {
      return;
    }

    const interval = window.setInterval(() => {
      setServiceSeconds((prev) => prev + 1);
    }, 1000);

    return () => window.clearInterval(interval);
  }, [destination, isPaused, crewLost, missionComplete]);

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
      setInactivitySeconds((prev) => {
        const next = prev + 1;
        if (next >= INACTIVITY_LIMIT_SECONDS) {
          updateBestServiceTime(serviceSecondsRef.current);
          setCrewLost(true);
          setShowExitConfirm(false);
          setIsPaused(true);
          return INACTIVITY_LIMIT_SECONDS;
        }
        return next;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [destination, isAttentionLost, crewLost, missionComplete, updateBestServiceTime]);

  useEffect(() => {
    if (!destination || missionComplete || crewLost) {
      return;
    }

    if (remainingYears <= 0) {
      updateBestServiceTime(serviceSecondsRef.current);
      setMissionComplete(true);
      setIsPaused(true);
      setIsAttentionLost(false);
      setInactivitySeconds(0);
      setShowExitConfirm(false);
    }
  }, [destination, remainingYears, missionComplete, crewLost, updateBestServiceTime]);

  // Camera and face detection effect
  useEffect(() => {
    if (!destination) return;

    let detector: faceDetection.FaceDetector | null = null;
    let detectionInterval: number;

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
        console.error("Error accessing camera:", err);
        setCameraError(
          "Kamera hozzáférés szükséges a játékhoz. Engedélyezd a kamerát és frissítsd az oldalt.",
        );
        setIsPaused(true);
        return;
      }

      // 2. Load model
      try {
        await tf.setBackend("webgl");
        const model = faceDetection.SupportedModels.MediaPipeFaceDetector;
        const detectorConfig: faceDetection.MediaPipeFaceDetectorTfjsModelConfig =
          {
            runtime: "tfjs",
          };
        detector = await faceDetection.createDetector(model, detectorConfig);
      } catch (error) {
        console.error("Error loading face detection model:", error);
        setCameraError(
          "Hiba a gépi látás modell betöltése közben. Próbáld meg frissíteni az oldalt.",
        );
        setIsPaused(true);
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
          const blockingOverlay =
            showExitConfirmRef.current ||
            crewLostRef.current ||
            !!cameraErrorRef.current ||
            missionCompleteRef.current;

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

      detectionInterval = window.setInterval(detectFace, 500);
    };

    setup();

    return () => {
      clearInterval(detectionInterval);
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
      if (detector) {
        detector.dispose();
      }
    };
  }, [destination]);

  if (!destination) {
    return (
      <main className="relative w-screen h-screen bg-black overflow-hidden font-mono">
        <Starfield onCanvasBoundsChange={handleCanvasBoundsChange} />
        <MainMenu onSelectDestination={handleSelectDestination} />
        {bellOverlay}
      </main>
    );
  }

  return (
    <main className="relative w-screen h-screen bg-black overflow-hidden font-mono">
      <Starfield onCanvasBoundsChange={handleCanvasBoundsChange} />
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
              Vége játéknak, a teljes legénység meghalt, mert nem figyeltél oda.
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
        <PauseMenu countdownSeconds={attentionCountdown} />
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
