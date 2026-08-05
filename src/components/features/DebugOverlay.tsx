import React, { useState, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import type { FaceAnalysis } from "../../services/faceRecognition";
import type { Destination } from "../../types";
import useUIStore from "../../state/useUIStore";
import { getSensorRotationAngle } from "../../services/cameraOrientation";
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
  const { t } = useTranslation();
  const [isCollapsed, setIsCollapsed] = useState(true);
  const debugRotationOffsetDeg = useUIStore((s) => s.debugRotationOffsetDeg);
  const cycleDebugRotationOffset = useUIStore((s) => s.cycleDebugRotationOffset);
  // null override → the automatic screen-angle-driven offset is in force.
  const offsetLabel =
    debugRotationOffsetDeg === null ? "auto" : `${debugRotationOffsetDeg}°`;

  if (!destination) return null;

  const maxWidth = canvasBounds ? canvasBounds.width / 4 : 320;
  // In compensated (orientation-swapped) mode the canvas turns portrait and,
  // driven by width alone, grows taller than a phone's landscape viewport —
  // overflowing off the top and pushing the rotate control out of view. Cap the
  // display height to a fraction of the game viewport and keep the aspect ratio.
  const maxHeight = canvasBounds ? canvasBounds.height * 0.4 : 240;
  const debugCanvas = debugCanvasRef.current;
  const videoElement = videoRef.current;
  // The debug canvas already carries the correct (possibly orientation-swapped)
  // aspect ratio once a frame has been drawn — the compensated path sizes it to
  // the rotated dimensions, the plain path to the video's. Prefer it; fall back
  // to the raw video only before the first draw.
  const videoAspect =
    debugCanvas && debugCanvas.width > 0 && debugCanvas.height > 0
      ? debugCanvas.width / debugCanvas.height
      : videoElement && videoElement.videoHeight > 0
        ? videoElement.videoWidth / videoElement.videoHeight
        : 16 / 9;
  // Fit within the (maxWidth × maxHeight) box, height-capped, aspect preserved.
  const debugHeight = Math.min(maxWidth / videoAspect, maxHeight);
  const debugWidth = debugHeight * videoAspect;
  const lastUpdateAgoSeconds = Math.max(
    0,
    (Date.now() - faceStatus.timestamp) / 1000,
  );

  return (
    <div className={`${styles.overlay} ${isCollapsed ? styles.collapsed : ""}`}>
      {/* Toggle header — always visible */}
      <button
        type="button"
        className={styles.toggleHeader}
        onClick={() => setIsCollapsed((prev) => !prev)}
        aria-expanded={!isCollapsed}
      >
        <span className={styles.chevron}>{isCollapsed ? "▶" : "▼"}</span>
        <span className={styles.headerLabel}>
          {isCollapsed ? "Debug Camera" : "Camera"}
        </span>
        {isCollapsed && faceStatus.detected && (
          <span className={styles.statusDot} />
        )}
      </button>

      {!isCollapsed && (
        <>
          <canvas
            ref={debugCanvasRef as React.RefObject<HTMLCanvasElement>}
            className={styles.canvas}
            style={{
              width: `${debugWidth}px`,
              height: `${debugHeight}px`,
            }}
          />
          {/* Debug-only live rotate control. Hardcoded label to match the
              "Debug Camera"/"Camera" strings above — this overlay only renders
              in debug mode. */}
          <div className={styles.rotateRow}>
            <button
              type="button"
              className={styles.rotateButton}
              onClick={() => cycleDebugRotationOffset()}
            >
              🔄 Forgatás 90°
            </button>
            <span className={styles.rotateOffset}>Offset: {offsetLabel}</span>
            <span className={styles.rotateOffset}>
              Angle: {getSensorRotationAngle()}°
            </span>
          </div>
          <div className={styles.info}>
            <p>
              {t("debug.cameraStatus")}{" "}
              <span style={{ color: faceStatus.detected ? "#22c55e" : "#f87171" }}>
                {faceStatus.detected ? t("debug.faceDetected") : t("debug.noFace")}
              </span>
            </p>
            <p>{t("debug.lastUpdate", { value: lastUpdateAgoSeconds.toFixed(1) })}</p>
            <p>
              {t("debug.balanceRatio")}{" "}
              {debugMetrics
                ? `${debugMetrics.balanceRatio.toFixed(2)}`
                : "N/A"}
            </p>
            <p>
              {t("debug.eyeVerticalRatio")}{" "}
              {debugMetrics
                ? `${debugMetrics.eyeVerticalRatio.toFixed(2)}`
                : "N/A"}
            </p>
            <p>
              {t("debug.eyeEarMargin")}{" "}
              {debugMetrics ? `${debugMetrics.eyeEarMargin.toFixed(2)}` : "N/A"}
            </p>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={debugIgnoreAttention}
                onChange={(e) => setDebugIgnoreAttention(e.target.checked)}
              />
              <span>{t("debug.ignore")}</span>
            </label>
          </div>
        </>
      )}
    </div>
  );
};

export default DebugOverlay;
