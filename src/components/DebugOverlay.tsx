import React, { type RefObject } from "react";
import type { FaceAnalysis } from "../services/faceRecognition";
import type { Destination } from "../types";
import styles from "./DebugOverlay.module.css";

interface DebugOverlayProps {
  debugCanvasRef: RefObject<HTMLCanvasElement | null>;
  faceStatus: { detected: boolean; timestamp: number };
  debugMetrics: FaceAnalysis | null;
  debugIgnoreAttention: boolean;
  setDebugIgnoreAttention: (checked: boolean) => void;
  canvasBounds: DOMRectReadOnly | null;
  videoRef: RefObject<HTMLVideoElement | null>;
  destination: Destination | null;
}

const DebugOverlay: React.FC<DebugOverlayProps> = ({
  debugCanvasRef,
  faceStatus,
  debugMetrics,
  debugIgnoreAttention,
  setDebugIgnoreAttention,
  canvasBounds,
  videoRef,
  destination,
}) => {
  if (!destination) return null;

  const debugWidth = canvasBounds ? canvasBounds.width / 4 : 320;
  const videoElement = videoRef.current;
  const videoAspect =
    videoElement && videoElement.videoHeight > 0
      ? videoElement.videoWidth / videoElement.videoHeight
      : 16 / 9;
  const debugHeight = debugWidth / videoAspect;
  const lastUpdateAgoSeconds = Math.max(
    0,
    (Date.now() - faceStatus.timestamp) / 1000,
  );

  return (
    <div className={styles.overlay}>
      <canvas
        ref={debugCanvasRef as React.RefObject<HTMLCanvasElement>}
        className={styles.canvas}
        style={{
          width: `${debugWidth}px`,
          height: `${debugHeight}px`,
        }}
      />
      <div className={styles.info}>
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
        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={debugIgnoreAttention}
            onChange={(e) => setDebugIgnoreAttention(e.target.checked)}
          />
          <span>Figyelmen kívül hagyás</span>
        </label>
      </div>
    </div>
  );
};

export default DebugOverlay;
