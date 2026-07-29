
import React, { useRef, useEffect } from "react";
import { Star } from "../../types";
import {
  STAR_COUNT,
  STAR_SPEED,
} from "../../constants/constants";
import useGameStore from "../../state/useGameStore";

interface StarfieldProps {
  onCanvasBoundsChange?: (bounds: DOMRectReadOnly) => void;
  isPaused?: boolean;
  /** Custom cockpit image URL — overrides the default russian1.webp */
  cockpitImageUrl?: string;
  /** Ship speed in km/s — controls star elongation for warp-speed effect */
  speedKmPerSecond?: number;
}

/**
 * Compute star stretch factor from ship speed.
 * - ≤ 250 km/s → 1.0× (dots, no stretch)
 * -  500 km/s → 1.5×
 * - ≥ 1000 km/s → 2.0×
 * Linear interpolation in between.
 */
const getStretchFactor = (speedKmPerSecond: number): number => {
  if (speedKmPerSecond <= 250) return 1.0;
  if (speedKmPerSecond >= 1000) return 2.0;
  return 1.0 + (speedKmPerSecond - 250) / 750;
};

const Starfield: React.FC<StarfieldProps> = ({
  onCanvasBoundsChange,
  isPaused = false,
  cockpitImageUrl,
  speedKmPerSecond,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isPausedRef = useRef(isPaused);
  const onBoundsChangeRef = useRef(onCanvasBoundsChange);

  // Read speed from store as fallback when no prop is passed
  const storeSpeed = useGameStore((s) => s.shipSpeedKmPerSecond);
  const speedRef = useRef(speedKmPerSecond ?? storeSpeed);
  speedRef.current = speedKmPerSecond ?? storeSpeed;

  // Evasive maneuver drift — triggered by button press during asteroid events
  const evasiveManeuverAt = useGameStore((s) => s.evasiveManeuverAt);
  const evasiveManeuverAtRef = useRef(evasiveManeuverAt);
  evasiveManeuverAtRef.current = evasiveManeuverAt;

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    onBoundsChangeRef.current = onCanvasBoundsChange;
  }, [onCanvasBoundsChange]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let stars: Star[] = [];
    const cockpitImage = new Image();
    let cockpitLoaded = false;
    const cockpitSrc = cockpitImageUrl ?? `${import.meta.env.BASE_URL}spaceships/russian1.webp`;

    cockpitImage.src = cockpitSrc;
    cockpitImage.onload = () => {
      cockpitLoaded = true;
      if (onBoundsChangeRef.current) {
        const rect = canvas.getBoundingClientRect();
        onBoundsChangeRef.current(rect);
      }
    };

    const resizeCanvas = () => {
      const { innerWidth, innerHeight } = window;

      canvas.width = innerWidth;
      canvas.height = innerHeight;

      canvas.style.width = `${innerWidth}px`;
      canvas.style.height = `${innerHeight}px`;
      canvas.style.left = "0px";
      canvas.style.top = "0px";

      queueMicrotask(() => {
        if (onBoundsChangeRef.current) {
          const rect = canvas.getBoundingClientRect();
          onBoundsChangeRef.current(rect);
        }
      });
    };

    const setup = () => {
      resizeCanvas();
      stars = [];
      for (let i = 0; i < STAR_COUNT; i++) {
        stars.push({
          x: (Math.random() - 0.5) * canvas.width,
          y: (Math.random() - 0.5) * canvas.height,
          z: Math.random() * canvas.width,
        });
      }
    };

    const resetStar = (star: Star) => {
      star.x = (Math.random() - 0.5) * canvas.width;
      star.y = (Math.random() - 0.5) * canvas.height;
      star.z = canvas.width;
    };

    // Evasive drift state — triggered by button press, lasts 1-3 seconds
    let driftX = 0;
    let driftY = 0;
    let driftTargetX = 0;
    let driftTargetY = 0;
    let lastEvasiveTrigger = 0;
    let driftEndTime = 0;

    let animationFrameId: number;
    const draw = () => {
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const stretchFactor = getStretchFactor(speedRef.current);

      const maxDist = Math.sqrt(canvas.width * canvas.width / 4 + canvas.height * canvas.height / 4);

      // --- Evasive drift update (trigger-based, 1-3 second burst) ---
      const now = Date.now();
      if (evasiveManeuverAtRef.current !== lastEvasiveTrigger) {
        lastEvasiveTrigger = evasiveManeuverAtRef.current;
        // Pick a random evasive direction
        driftTargetX = (Math.random() - 0.5) * 40;
        driftTargetY = (Math.random() - 0.5) * 40;
        driftEndTime = now + 1000 + Math.random() * 2000; // 1-3 seconds
      }

      if (now < driftEndTime && !isPausedRef.current) {
        // Smooth interpolation toward target
        driftX += (driftTargetX - driftX) * 0.08;
        driftY += (driftTargetY - driftY) * 0.08;
      } else {
        // Return to center when not evading
        driftX *= 0.92;
        driftY *= 0.92;
      }

      ctx.save();
      ctx.translate(canvas.width / 2 + driftX, canvas.height / 2 + driftY);

      for (const star of stars) {
        if (!isPausedRef.current) {
          star.z -= STAR_SPEED;
          if (star.z <= 0) {
            resetStar(star);
          }
        }

        const sx = (star.x / star.z) * canvas.width;
        const sy = (star.y / star.z) * canvas.height;
        const r = Math.max(0.1, (canvas.width - star.z) / canvas.width * 2.5);

        const opacity = (canvas.width - star.z) / canvas.width;

        if (stretchFactor > 1.05) {
          // Stretched star — draw a motion trail pointing INWARD (toward center)
          const dist = Math.sqrt(sx * sx + sy * sy);
          if (dist > 1) {
            const dx = sx / dist;
            const dy = sy / dist;
            // Streak length based on distance from ACTUAL screen center
            // (compensating for drift) — keeps 3D depth even during turns
            const actualDist = Math.sqrt(
              (sx + driftX) * (sx + driftX) + (sy + driftY) * (sy + driftY)
            );
            const lateralFactor = actualDist / maxDist;
            // Depth factor: far stars (z close to canvas.width) get much
            // shorter streaks — creates proper layered 3D depth perception
            const depthFactor = Math.max(0, (canvas.width - star.z) / canvas.width);
            const streakLen = r * stretchFactor * 3 * lateralFactor * depthFactor * depthFactor;

            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(sx - dx * streakLen, sy - dy * streakLen);
            ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
            ctx.lineWidth = r * 2;
            ctx.lineCap = "round";
            ctx.stroke();
          }
        }

        // Always draw the bright dot at the star's current position
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
        ctx.fill();
      }

      ctx.restore();

      if (cockpitLoaded) {
        const scale = Math.max(
          canvas.width / cockpitImage.width,
          canvas.height / cockpitImage.height,
        );
        const drawWidth = cockpitImage.width * scale;
        const drawHeight = cockpitImage.height * scale;
        const offsetX = (canvas.width - drawWidth) / 2;
        const offsetY = (canvas.height - drawHeight) / 2;
        ctx.drawImage(cockpitImage, offsetX, offsetY, drawWidth, drawHeight);
      }

      animationFrameId = requestAnimationFrame(draw);
    };

    setup();
    draw();

    const handleResize = () => {
      setup();
    };

    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
    };
  }, [cockpitImageUrl]);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: "absolute", inset: 0, zIndex: 0 }}
    />
  );
};

export default Starfield;
