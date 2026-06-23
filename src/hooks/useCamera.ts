import { useRef, useState, useEffect } from "react";
import type { FaceDetector } from "@tensorflow-models/face-detection";
import {
  FACE_DETECTION_INTERVAL_MS,
  FACE_BALANCE_MAX_RATIO,
  FACE_BALANCE_MIN_RATIO,
  EYE_LEVEL_MAX_OFFSET_RATIO,
} from "../constants/constants";
import {
  createFaceDetector,
  analyzeFace,
  FaceAnalysis,
} from "../services/faceRecognition";
import useGameStore from "../state/useGameStore";

const DEBUG_KEYPOINT_COLORS: Record<string, string> = {
  noseTip: "#fbbf24",
  leftEye: "#38bdf8",
  rightEye: "#38bdf8",
  leftEarTragion: "#f97316",
  rightEarTragion: "#f97316",
};

export const useCamera = (
  destination: unknown,
  debugMode: boolean,
) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const debugCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDetectingRef = useRef(false);

  const [faceStatus, setFaceStatus] = useState<{
    detected: boolean;
    timestamp: number;
  }>({
    detected: false,
    timestamp: Date.now(),
  });
  const [debugMetrics, setDebugMetrics] = useState<FaceAnalysis | null>(null);

  const {
    setCameraError,
    setIsPaused,
    setIsAttentionLost,
    setInactivitySeconds,
    setIsInitializing,
  } = useGameStore();

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
    let isCancelled = false;

    const setup = async () => {
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
              case "OverconstrainedError":
                errorMessage =
                  "A kamera nem teljesítheti a kérést. Próbáld meg más beállításokkal.";
                break;
            }
          }

          setCameraError(errorMessage);
          setIsPaused(true);
          setIsInitializing(false);
        }
        return;
      }

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

      const detectFace = async () => {
        if (isDetectingRef.current || !videoRef.current || !detector) return;

        const video = videoRef.current;
        if (video.readyState < 3) return;

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

          if (debugMode && debugCanvasRef.current) {
            const canvas = debugCanvasRef.current;
            const ctx = canvas.getContext("2d");
            if (ctx) {
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
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

          if (attentionLost && !stateSnapshot.debugIgnoreAttention) {
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
    debugMode,
  ]);

  return { videoRef, debugCanvasRef, faceStatus, debugMetrics };
};
