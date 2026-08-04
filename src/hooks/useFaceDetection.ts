import { useRef, useState, useEffect } from "react";
import type { FaceDetector } from "@tensorflow-models/face-detection";
import { FACE_DETECTION_INTERVAL_MS } from "../constants/constants";
import {
  createFaceDetector,
  analyzeFace,
  FaceAnalysis,
} from "../services/faceRecognition";
import {
  isTouchPrimaryDevice,
  getSensorRotationAngle,
  shouldCompensateOrientation,
  computeRotatedCanvasLayout,
  type RotatedCanvasLayout,
} from "../services/cameraOrientation";
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
  // Reused offscreen canvas for the orientation compensation. Allocated lazily
  // once and never per frame (see the mobile orientation plan, block C).
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  // Lets the orientation-change listener force an immediate re-detection so the
  // debug canvas does not lag a whole interval behind a portrait↔landscape flip.
  const detectFaceRef = useRef<(() => void) | null>(null);

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
  // Subscribed (not read via getState) so the effect below re-runs when the
  // camera fails after this effect has already settled into its idle branch.
  const cameraError = useUIStore((s) => s.cameraError);

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

      // Initialization is over either when we are fully cleaning up (no
      // destination), or when the camera failed outright. Without the second
      // case a broken stream left `isInitializing` true forever and the
      // LoadingScreen spun for good, since it waits for this flag to clear.
      if (!destination || cameraError) {
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

      // Device-primary input does not change during a session, so this is
      // computed once. The screen angle, in contrast, is read live every cycle.
      const isTouch = isTouchPrimaryDevice();

      const getOffscreenCanvas = () => {
        if (!offscreenCanvasRef.current) {
          offscreenCanvasRef.current = document.createElement("canvas");
        }
        return offscreenCanvasRef.current;
      };

      const detectFace = async () => {
        if (isDetectingRef.current || !videoRef.current || !detectorRef.current) return;

        const video = videoRef.current;
        if (video.readyState < 3) return;

        isDetectingRef.current = true;

        try {
          const angle = getSensorRotationAngle();
          const compensate = shouldCompensateOrientation(angle, isTouch);

          // Default path (desktop / webcam / upright device): the raw <video>
          // goes straight to the detector — bit-for-bit today's behaviour.
          let detectionInput: HTMLVideoElement | HTMLCanvasElement = video;
          let layout: RotatedCanvasLayout | null = null;

          if (compensate) {
            const offscreen = getOffscreenCanvas();
            const octx = offscreen.getContext("2d");
            if (octx) {
              layout = computeRotatedCanvasLayout(
                video.videoWidth,
                video.videoHeight,
                angle,
              );
              offscreen.width = layout.canvasWidth;
              offscreen.height = layout.canvasHeight;
              octx.setTransform(1, 0, 0, 1, 0, 0);
              octx.clearRect(0, 0, offscreen.width, offscreen.height);
              octx.translate(layout.translateX, layout.translateY);
              octx.rotate(layout.rotationRad);
              octx.drawImage(
                video,
                -video.videoWidth / 2,
                -video.videoHeight / 2,
                video.videoWidth,
                video.videoHeight,
              );
              octx.setTransform(1, 0, 0, 1, 0, 0);
              detectionInput = offscreen;
            }
          }

          const faces = await detectorRef.current.estimateFaces(detectionInput, {
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
              if (compensate && layout && detectionInput !== video) {
                // Show the same upright image the detector saw. Keypoints are
                // already in this canvas's (upright) coordinate space, so they
                // are drawn directly below — no manual transform.
                canvas.width = layout.canvasWidth;
                canvas.height = layout.canvasHeight;
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.drawImage(detectionInput, 0, 0);
              } else {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              }
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

      detectFaceRef.current = detectFace;

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
      detectFaceRef.current = null;
      if (detectorRef.current) {
        detectorRef.current.dispose();
        detectorRef.current = null;
      }
    };
  }, [
    destination,
    isStreamReady,
    debugMode,
    cameraError,
    setIsInitializing,
    setIsPaused,
    setCameraError,
    videoRef,
  ]);

  // Re-run detection the moment the screen rotates, so the debug canvas and the
  // compensated frame follow a portrait↔landscape flip without waiting up to a
  // full detection interval. Detection itself reads the angle live, so this is
  // purely to smooth the visible one-cycle lag.
  useEffect(() => {
    const handleOrientationChange = () => {
      detectFaceRef.current?.();
    };

    const orientation =
      typeof window !== "undefined" ? window.screen?.orientation : undefined;

    if (orientation && typeof orientation.addEventListener === "function") {
      orientation.addEventListener("change", handleOrientationChange);
      return () =>
        orientation.removeEventListener("change", handleOrientationChange);
    }

    window.addEventListener("orientationchange", handleOrientationChange);
    return () =>
      window.removeEventListener("orientationchange", handleOrientationChange);
  }, []);

  return { debugCanvasRef, faceStatus, debugMetrics };
};
