import {
  CAMERA_ORIENTATION_COMPENSATION,
  CAMERA_ROTATION_SIGN,
  CAMERA_ROTATION_OFFSET_BASE_DEG,
} from "../constants/constants";

/**
 * Pure geometry + device-capability helpers for the mobile/tablet camera
 * orientation compensation. None of these touch a real canvas, so the whole
 * module is unit-testable under jsdom. The actual `ctx.setTransform` /
 * `drawImage` lives in `useFaceDetection`, built from `computeRotatedCanvasLayout`.
 */

export interface RotatedCanvasLayout {
  /** Canvas width in px (swapped with height for 90°/270°). */
  canvasWidth: number;
  /** Canvas height in px (swapped with width for 90°/270°). */
  canvasHeight: number;
  /** Rotation in radians, already carrying `CAMERA_ROTATION_SIGN`. */
  rotationRad: number;
  /** Canvas-centre X the transform translates to before rotating. */
  translateX: number;
  /** Canvas-centre Y the transform translates to before rotating. */
  translateY: number;
}

type SupportedAngle = 0 | 90 | 180 | 270;

interface UserAgentDataLike {
  mobile?: boolean;
}

interface NavigatorWithUAData extends Navigator {
  userAgentData?: UserAgentDataLike;
}

/** Snap an arbitrary angle to the nearest of {0, 90, 180, 270}. */
const normalizeAngle = (raw: number): SupportedAngle => {
  if (!Number.isFinite(raw)) return 0;
  const snapped = ((Math.round(raw / 90) * 90) % 360 + 360) % 360;
  return snapped as SupportedAngle;
};

/**
 * Whether the device's **primary** input is touch (phone/tablet), so the camera
 * sensor is fixed to the device body and rotates with the screen.
 *
 * Layers, first match wins:
 * 1. `(pointer: coarse) and (hover: none)` — the real, capability-based signal.
 * 2. `navigator.maxTouchPoints > 1` — iPadOS desktop-mode reports as Mac.
 * 3. `navigator.userAgentData?.mobile === true` — Chromium on a phone.
 * 4. UA-string regex — **only** when `matchMedia` is unavailable.
 *
 * Missing `navigator` (SSR) returns a safe `false`, i.e. no compensation.
 */
export const isTouchPrimaryDevice = (): boolean => {
  if (typeof navigator === "undefined") return false;

  const hasMatchMedia =
    typeof window !== "undefined" && typeof window.matchMedia === "function";

  if (hasMatchMedia) {
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const noHover = window.matchMedia("(hover: none)").matches;
    if (coarse && noHover) return true;
  }

  // Supplementary capability checks (iPadOS desktop-mode, Chromium mobile).
  if (
    typeof navigator.maxTouchPoints === "number" &&
    navigator.maxTouchPoints > 1
  ) {
    return true;
  }

  const uaData = (navigator as NavigatorWithUAData).userAgentData;
  if (uaData?.mobile === true) return true;

  // UA-string sniffing is the brittle last resort — only when the browser
  // exposes no matchMedia to ask the real capability.
  if (!hasMatchMedia) {
    return /Android|iP(hone|ad|od)|Mobile|Tablet/.test(navigator.userAgent ?? "");
  }

  return false;
};

/**
 * The screen rotation angle, normalized to {0, 90, 180, 270}.
 *
 * Primary source `screen.orientation.angle`; fallback the legacy
 * `window.orientation` (`-90 → 270`, `90 → 90`, `180 → 180`, `0 → 0`).
 * Unknown / unavailable → `0` (no compensation, today's behaviour).
 */
export const getSensorRotationAngle = (): SupportedAngle => {
  if (typeof window === "undefined") return 0;

  const orientationAngle = window.screen?.orientation?.angle;
  if (typeof orientationAngle === "number") {
    return normalizeAngle(orientationAngle);
  }

  const legacy = (window as Window & { orientation?: number }).orientation;
  if (typeof legacy === "number") {
    return normalizeAngle(legacy);
  }

  return 0;
};

/** Az automatikus orientáció-offszet: a live képernyő-szög + fix bázis, negyed-fordulatra normalizálva. */
export const getAutoOffsetDeg = (angle: SupportedAngle): SupportedAngle =>
  normalizeAngle(angle + CAMERA_ROTATION_OFFSET_BASE_DEG);

/**
 * Canvas dimensions + transform that bring a sensor-tilted video upright.
 *
 * Everything derives from the **effective** rotation, i.e. the signed base
 * rotation plus the offset:
 *
 *   baseDeg      = CAMERA_ROTATION_SIGN * angle
 *   effectiveDeg = normalize(baseDeg + offsetDeg)  // → {0,90,180,270}
 *
 * The **effective** angle — not the raw screen `angle` — decides both the
 * dimension swap and the rotation. For an effective 90°/270° the canvas
 * width/height are **swapped** (a landscape sensor frame lands in a portrait
 * canvas). The transform translates to the canvas centre and rotates by
 * `effectiveDeg`; the caller then draws the video centred
 * (`drawImage(video, -videoW/2, -videoH/2, videoW, videoH)`). Effective 0°
 * leaves dimensions unchanged with `rotationRad === 0`; effective 180° leaves
 * dimensions unchanged with `rotationRad === π`; effective 270° swaps
 * dimensions with `rotationRad === 270°` (visually `-90°`, which the full
 * translate+rotate transform handles correctly).
 *
 * @param offsetDeg Optional override for the offset. When omitted, the
 *   screen-angle-driven automatic offset `getAutoOffsetDeg(angle)` is used, so
 *   the offset tracks the live screen angle (effective angle then =
 *   normalize(sign*angle + (angle + base))). The debug live-rotate control
 *   passes an explicit user-cycled quarter-turn here to override the automatic
 *   value on a physical device without a rebuild.
 */
export const computeRotatedCanvasLayout = (
  videoW: number,
  videoH: number,
  angle: SupportedAngle,
  offsetDeg?: number,
): RotatedCanvasLayout => {
  const baseDeg = CAMERA_ROTATION_SIGN * angle;
  const effectiveOffset = offsetDeg ?? getAutoOffsetDeg(angle);
  const effectiveDeg = (((baseDeg + effectiveOffset) % 360) + 360) % 360;

  const swapDimensions = effectiveDeg === 90 || effectiveDeg === 270;
  const canvasWidth = swapDimensions ? videoH : videoW;
  const canvasHeight = swapDimensions ? videoW : videoH;
  const rotationRad = (effectiveDeg * Math.PI) / 180;

  return {
    canvasWidth,
    canvasHeight,
    rotationRad,
    translateX: canvasWidth / 2,
    translateY: canvasHeight / 2,
  };
};

/**
 * Whether to run the orientation compensation for this frame: the kill switch
 * is on, the device is touch-primary, and the screen is rotated.
 */
export const shouldCompensateOrientation = (
  angle: number,
  isTouch: boolean,
): boolean =>
  CAMERA_ORIENTATION_COMPENSATION && isTouch && angle !== 0;
