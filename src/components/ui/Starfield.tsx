
import React, { useRef, useEffect } from "react";
import { RenderStar } from "../../types";
import {
  STAR_COUNT,
  STAR_SPEED,
  STAR_COLOR_SATURATION,
  STAR_MAG_SIZE_MIN,
  STAR_MAG_SIZE_MAX,
  STAR_MAG_ALPHA_MIN,
  STAR_MAG_ALPHA_MAX,
  STAR_BASE_RADIUS_SCALE,
  STAR_MIN_RADIUS_PX,
  STAR_MAX_DEVICE_PIXEL_RATIO,
  STAR_STREAK_LENGTH_FACTOR,
  STAR_DRIFT_SMOOTHING,
  STAR_ROLL_MAX_DEGREES,
} from "../../constants/constants";
import {
  buildStarColorTable,
  pickSpectralClass,
  StarColor,
} from "../../services/starColor";
import {
  magnitudeFromRandom,
  subpixelAlphaScale,
  deltaFrames,
  frameRateAdjustedLerp,
  randomRollRadians,
  getStretchFactor,
} from "../../services/starfieldMath";
import useGameStore from "../../state/useGameStore";

interface StarfieldProps {
  onCanvasBoundsChange?: (bounds: DOMRectReadOnly) => void;
  isPaused?: boolean;
  /** Custom cockpit image URL — overrides the default russian1.webp */
  cockpitImageUrl?: string;
  /** Ship speed in km/s — controls star elongation for warp-speed effect */
  speedKmPerSecond?: number;
}

const lerp = (from: number, to: number, t: number): number => from + (to - from) * t;

/**
 * Fills a star with a fresh position, spectral colour and magnitude.
 *
 * Mutates in place rather than returning a new object: `resetStar` runs dozens
 * of times per second, and allocating there would put the render loop back on
 * the GC treadmill this rewrite exists to get off.
 *
 * Colour and magnitude are re-drawn on every reset, not just at creation. If
 * only the position were recycled, the field would "freeze" into its initial
 * distribution within a few minutes — the same stars staying bright, in the same
 * colours, just at new positions.
 */
const fillStar = (
  star: RenderStar,
  logicalWidth: number,
  logicalHeight: number,
  colorTable: readonly StarColor[],
  atFarPlane: boolean,
): void => {
  star.x = (Math.random() - 0.5) * logicalWidth;
  star.y = (Math.random() - 0.5) * logicalHeight;
  star.z = atFarPlane ? logicalWidth : Math.random() * logicalWidth;

  const color = colorTable[pickSpectralClass(Math.random())];
  star.r = color.r;
  star.g = color.g;
  star.b = color.b;
  star.color = color.css;

  star.mag = magnitudeFromRandom(Math.random());
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

    // Six spectral classes → six shared `rgb(...)` strings, built once per
    // starfield instance. Every star holds a reference to one of them, so the
    // draw loop never builds a colour string.
    const colorTable = buildStarColorTable(STAR_COLOR_SATURATION);

    let stars: RenderStar[] = [];
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

    // Physical backing-store scale, and the logical (CSS pixel) drawing size.
    // Everything in `draw`/`setup` works in logical units — `canvas.width` is a
    // backing-store dimension only, and must not be read as a coordinate.
    let dpr = 1;
    let logicalWidth = 0;
    let logicalHeight = 0;

    const getDpr = () =>
      Math.min(window.devicePixelRatio || 1, STAR_MAX_DEVICE_PIXEL_RATIO);

    const resizeCanvas = () => {
      const { innerWidth, innerHeight } = window;

      logicalWidth = innerWidth;
      logicalHeight = innerHeight;
      dpr = getDpr();

      canvas.width = Math.round(logicalWidth * dpr);
      canvas.height = Math.round(logicalHeight * dpr);

      canvas.style.width = `${logicalWidth}px`;
      canvas.style.height = `${logicalHeight}px`;
      canvas.style.left = "0px";
      canvas.style.top = "0px";

      // Any write to canvas.width/height resets the entire 2D context state,
      // transform included — so this must come after the sizing above.
      // `setTransform` rather than `scale` because it is idempotent: `scale`
      // multiplies the existing matrix and would compound to dpr² on a resize.
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

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
        const star: RenderStar = {
          x: 0,
          y: 0,
          z: 0,
          r: 255,
          g: 255,
          b: 255,
          color: colorTable[0].css,
          mag: 0,
        };
        fillStar(star, logicalWidth, logicalHeight, colorTable, false);
        stars.push(star);
      }
    };

    const resetStar = (star: RenderStar) => {
      fillStar(star, logicalWidth, logicalHeight, colorTable, true);
    };

    // Evasive drift state — triggered by button press, lasts 1-3 seconds
    let driftX = 0;
    let driftY = 0;
    let driftTargetX = 0;
    let driftTargetY = 0;
    // Evasive roll — an independent random spin, deliberately NOT derived from
    // the drift direction (that would be aircraft-style banking, which reads as
    // a controlled manoeuvre; the intended feel here is a hit or a near-miss).
    let roll = 0;
    let rollTarget = 0;
    let lastEvasiveTrigger = 0;
    let driftEndTime = 0;
    let lastFrameTime = 0;

    let animationFrameId: number;
    const draw = (now: number) => {
      // Normalised to 60 FPS so the field moves at the same apparent speed on a
      // 144 Hz display. `deltaFrames` returns 1 for the very first frame, so no
      // special case is needed here.
      const frames = deltaFrames(lastFrameTime === 0 ? 0 : now - lastFrameTime);
      lastFrameTime = now;

      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, logicalWidth, logicalHeight);

      const stretchFactor = getStretchFactor(speedRef.current);

      const maxDist = Math.sqrt(
        logicalWidth * logicalWidth / 4 + logicalHeight * logicalHeight / 4,
      );

      // --- Evasive drift + roll update (trigger-based, 1-3 second burst) ---
      // `wallClock` is deliberately separate from the rAF `now` above: the
      // manoeuvre's lifetime is wall-clock based (and so already frame-rate
      // independent), while `now` drives the delta normalisation.
      const wallClock = Date.now();
      if (evasiveManeuverAtRef.current !== lastEvasiveTrigger) {
        lastEvasiveTrigger = evasiveManeuverAtRef.current;
        // Pick a random evasive direction
        driftTargetX = (Math.random() - 0.5) * 40;
        driftTargetY = (Math.random() - 0.5) * 40;
        // Independent draw — must not be derived from driftTargetX.
        rollTarget = randomRollRadians(Math.random(), STAR_ROLL_MAX_DEGREES);
        driftEndTime = wallClock + 1000 + Math.random() * 2000; // 1-3 seconds
      }

      // One smoothing factor for driftX, driftY and roll — all three are the
      // same "8% per frame" easing. Computed once: the roll shares it so the
      // spin and the slide stay in lockstep and read as a single manoeuvre.
      const k = frameRateAdjustedLerp(STAR_DRIFT_SMOOTHING, frames);

      if (wallClock < driftEndTime && !isPausedRef.current) {
        // Smooth interpolation toward target
        driftX += (driftTargetX - driftX) * k;
        driftY += (driftTargetY - driftY) * k;
        roll += (rollTarget - roll) * k;
      } else {
        // Return to center when not evading
        driftX *= 1 - k;
        driftY *= 1 - k;
        roll *= 1 - k;
      }

      ctx.save();
      ctx.translate(logicalWidth / 2 + driftX, logicalHeight / 2 + driftY);
      // Rotate AFTER translate, so the spin is centred on the drifted origin.
      ctx.rotate(roll);

      // Counter-rotate the drift vector into the rotated local basis, once per
      // frame. The streak compensation below measures each star's distance from
      // the true screen centre; `sx`/`sy` live in the rotated basis while
      // `driftX`/`driftY` are screen-space, so adding them directly would mix
      // bases and give a wrong distance. At roll = 0 this reduces exactly to the
      // previous formula, which is what makes the change safe — and also why a
      // mistake here stays invisible until the ship actually rolls.
      const cosR = Math.cos(roll);
      const sinR = Math.sin(roll);
      const driftXr = driftX * cosR + driftY * sinR;
      const driftYr = -driftX * sinR + driftY * cosR;

      for (const star of stars) {
        if (!isPausedRef.current) {
          star.z -= STAR_SPEED * frames;
          if (star.z <= 0) {
            resetStar(star);
          }
        }

        const sx = (star.x / star.z) * logicalWidth;
        const sy = (star.y / star.z) * logicalHeight;

        const depth = (logicalWidth - star.z) / logicalWidth;
        const magSize = lerp(STAR_MAG_SIZE_MIN, STAR_MAG_SIZE_MAX, star.mag);
        const magAlpha = lerp(STAR_MAG_ALPHA_MIN, STAR_MAG_ALPHA_MAX, star.mag);

        // Below the radius floor the light is taken off the alpha instead, so a
        // sub-pixel star fades out rather than flickering against the grid.
        const rawRadius = depth * STAR_BASE_RADIUS_SCALE * magSize;
        const radius = Math.max(rawRadius, STAR_MIN_RADIUS_PX);
        const alpha =
          depth * magAlpha * subpixelAlphaScale(rawRadius, STAR_MIN_RADIUS_PX);

        ctx.globalAlpha = Math.min(1, Math.max(0, alpha));

        if (stretchFactor > 1.05) {
          // Stretched star — draw a motion trail pointing INWARD (toward center)
          const dist = Math.sqrt(sx * sx + sy * sy);
          if (dist > 1) {
            const dx = sx / dist;
            const dy = sy / dist;
            // Streak length based on distance from ACTUAL screen center
            // (compensating for drift) — keeps 3D depth even during turns
            const actualDist = Math.sqrt(
              (sx + driftXr) * (sx + driftXr) + (sy + driftYr) * (sy + driftYr)
            );
            const lateralFactor = actualDist / maxDist;
            // Depth factor: far stars (z close to logicalWidth) get much
            // shorter streaks — creates proper layered 3D depth perception
            const depthFactor = Math.max(0, (logicalWidth - star.z) / logicalWidth);
            const streakLen =
              radius *
              stretchFactor *
              STAR_STREAK_LENGTH_FACTOR *
              lateralFactor *
              depthFactor *
              depthFactor;

            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(sx - dx * streakLen, sy - dy * streakLen);
            ctx.strokeStyle = star.color;
            ctx.lineWidth = radius * 2;
            ctx.lineCap = "round";
            ctx.stroke();
          }
        }

        // Always draw the bright dot at the star's current position
        ctx.beginPath();
        ctx.arc(sx, sy, radius, 0, Math.PI * 2);
        ctx.fillStyle = star.color;
        ctx.fill();
      }

      // Restores the transform AND globalAlpha. The cockpit below therefore
      // always draws fully opaque — do not remove this save/restore pair without
      // resetting globalAlpha by hand, or the cockpit turns translucent.
      ctx.restore();

      if (cockpitLoaded) {
        const scale = Math.max(
          logicalWidth / cockpitImage.width,
          logicalHeight / cockpitImage.height,
        );
        const drawWidth = cockpitImage.width * scale;
        const drawHeight = cockpitImage.height * scale;
        const offsetX = (logicalWidth - drawWidth) / 2;
        const offsetY = (logicalHeight - drawHeight) / 2;
        ctx.drawImage(cockpitImage, offsetX, offsetY, drawWidth, drawHeight);
      }

      animationFrameId = requestAnimationFrame(draw);
    };

    setup();
    // Must pass a timestamp: without it `now` is undefined, the delta is NaN and
    // every star's z becomes NaN. Since `NaN <= 0` is false the reset branch
    // never fires, and the field disappears permanently.
    draw(performance.now());

    /**
     * Rescale the existing field instead of rebuilding it.
     *
     * `setup()` would re-roll every star's position, colour and magnitude, and
     * `resize` fires continuously while a window is being dragged — so the whole
     * field would be replaced dozens of times a second, which reads as the stars
     * swarming. Scaling keeps each star's identity and only stretches the field
     * to the new window.
     */
    const handleResize = () => {
      const previousWidth = logicalWidth;
      const previousHeight = logicalHeight;

      resizeCanvas();

      if (previousWidth <= 0 || previousHeight <= 0) {
        setup();
        return;
      }

      const scaleX = logicalWidth / previousWidth;
      const scaleY = logicalHeight / previousHeight;

      for (const star of stars) {
        star.x *= scaleX;
        star.y *= scaleY;
        // z is measured against the logical width (see `fillStar`), so it has to
        // follow the horizontal scale or the stars' approach speed would shift.
        star.z *= scaleX;
      }
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
