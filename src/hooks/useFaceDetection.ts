import { useRef, useState, useEffect } from "react";
import type { FaceDetector } from "@tensorflow-models/face-detection";
import { FACE_DETECTION_INTERVAL_MS } from "../constants/constants";
import {
  createFaceDetector,
  analyzeFace,
  FaceAnalysis,
} from "../services/faceRecognition";
import { Destination } from "../types";
import useGameStore from "../state/useGameStore";
import useUIStore from "../state/useUIStore";

const DEBUG_KEYPOINT_COLORS: Record<string, string> = {
  noseTip: "#fbbf24",
  leftEye: "#38bdf8",
  rightEye: "#38bdf8",
  leftEarTragion: "#f97316",
  rightEarTragion: "#f97316",
};

export const useFaceDetection = (
  videoRef: React.RefObject<HTMLVideoElement | null>,
  destination: Destination | null,
  isStreamReady: boolean,
  debugMode: boolean,
) => {
  const debugCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDetectingRef = useRef(false);
  const detectorRef = useRef<FaceDetector | null>(null);

  const [faceStatus, setFaceStatus] = useState<{
    detected: boolean;
    timestamp: number;
  }>({
    detected: false,
    timestamp: Date.now(),
  });
  const [debugMetrics, setDebugMetrics] = useState<FaceAnalysis | null>(null);

  const { setIsInitializing, setIsPaused } = useGameStore();
  const { setCameraError } = useUIStore();

  useEffect(() => {
    if (!destination || !isStreamReady) {
      setFaceStatus({ detected: false, timestamp: Date.now() });
      setDebugMetrics(null);

      const canvas = debugCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }

      if (detectorRef.current) {
        detectorRef.current.dispose();
        detectorRef.current = null;
      }

      // Only mark initialization done if we're fully cleaning up (no destination)
      if (!destination) {
        setIsInitializing(false);
      }
      return;
    }

    let detectionInterval: number;
    let isCancelled = false;

    const setup = async () => {
      let detector: FaceDetector;
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
      detectorRef.current = detector;

      const detectFace = async () => {
        if (isDetectingRef.current || !videoRef.current || !detectorRef.current) return;

        const video = videoRef.current;
        if (video.readyState < 3) return;

        isDetectingRef.current = true;

        try {
          const faces = await detectorRef.current.estimateFaces(video, {
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
      if (detectorRef.current) {
        detectorRef.current.dispose();
        detectorRef.current = null;
      }
    };
  }, [
    destination,
    isStreamReady,
    debugMode,
    setIsInitializing,
    setIsPaused,
    setCameraError,
    videoRef,
  ]);

  return { debugCanvasRef, faceStatus, debugMetrics };
};
