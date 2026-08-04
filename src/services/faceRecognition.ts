import type {
  Face,
  Keypoint,
  MediaPipeFaceDetectorMediaPipeModelConfig,
} from "@tensorflow-models/face-detection";
import {
  SupportedModels,
  createDetector,
} from "@tensorflow-models/face-detection";
import { setBackend } from "@tensorflow/tfjs";

import {
  FACE_BALANCE_MAX_RATIO,
  FACE_BALANCE_MIN_RATIO,
  EYE_LEVEL_MAX_OFFSET_RATIO,
} from "../constants/constants";

declare global {
  interface Window {
    FaceDetection?: unknown;
  }
}

export interface FaceAnalysis {
  forward: boolean;
  balanceRatio: number;
  eyeVerticalRatio: number;
  earCenterY: number;
  eyeEarMargin: number;
}

/**
 * Assumes an **upright** face: its `eyesLevel` / `eyesAboveEars` heuristics
 * break on a 90°-rotated (sensor-tilted) image. On mobile/tablet the orientation
 * compensation in `useFaceDetection` rotates the frame back to upright *before*
 * detection, so the face this receives is already upright. The logic here is
 * therefore left rotation-dependent on purpose — introducing a rotation-invariant
 * heuristic would needlessly loosen the `crewLost` strictness.
 */
export const analyzeFace = (face: Face): FaceAnalysis => {
  const namedKeypoints = face.keypoints.reduce<Record<string, Keypoint>>(
    (acc, keypoint) => {
      if (keypoint.name) {
        acc[keypoint.name] = keypoint;
      }
      return acc;
    },
    {},
  );

  const leftEar = namedKeypoints.leftEarTragion;
  const rightEar = namedKeypoints.rightEarTragion;
  const leftEye = namedKeypoints.leftEye;
  const rightEye = namedKeypoints.rightEye;
  const nose = namedKeypoints.noseTip;

  if (!leftEar || !rightEar || !leftEye || !rightEye || !nose) {
    return {
      forward: false,
      balanceRatio: 0,
      eyeVerticalRatio: 1,
      earCenterY: 1,
      eyeEarMargin: 0,
    };
  }

  const distance = (a: Keypoint, b: Keypoint) =>
    Math.hypot(a.x - b.x, a.y - b.y);
  const leftEarDistance = distance(nose, leftEar);
  const rightEarDistance = distance(nose, rightEar);

  if (leftEarDistance === 0 || rightEarDistance === 0) {
    return {
      forward: false,
      balanceRatio: 0,
      eyeVerticalRatio: 1,
      earCenterY: 1,
      eyeEarMargin: 0,
    };
  }

  const balanceRatio = leftEarDistance / rightEarDistance;
  const symmetricalFace =
    balanceRatio > FACE_BALANCE_MIN_RATIO &&
    balanceRatio < FACE_BALANCE_MAX_RATIO;

  const eyeHorizontalSpan = Math.abs(leftEye.x - rightEye.x);
  const eyeVerticalOffset = Math.abs(leftEye.y - rightEye.y);
  const eyeVerticalRatio =
    eyeHorizontalSpan > 0 ? eyeVerticalOffset / eyeHorizontalSpan : 1;
  const eyesLevel = eyeVerticalRatio < EYE_LEVEL_MAX_OFFSET_RATIO;

  const averageEarY = (leftEar.y + rightEar.y) / 2;
  const leftEarMargin = averageEarY - leftEye.y;
  const rightEarMargin = averageEarY - rightEye.y;
  const eyeEarMargin = Math.max(leftEarMargin, rightEarMargin);

  const eyesAboveEars = eyeEarMargin > 0;

  return {
    forward: symmetricalFace && eyesLevel && eyesAboveEars,
    balanceRatio,
    eyeVerticalRatio,
    earCenterY: averageEarY,
    eyeEarMargin,
  };
};

export const isFaceLookingForward = (face: Face) => analyzeFace(face).forward;

export const createFaceDetector = async () => {
  try {
    await setBackend("webgl");
  } catch {
    await setBackend("cpu");
  }

  const model = SupportedModels.MediaPipeFaceDetector;
  // Resolve at runtime against the live <base href> (set by index.tsx
  // setBaseHref) so the same bundle works under both Firebase (/) and
  // GitHub Pages (/realtime_space_travel/). Build-time import.meta.env.BASE_URL
  // is fixed and 404s on the other host.
  const solutionPath = new URL("mediapipe/face_detection", document.baseURI).href;

  const detectorConfig: MediaPipeFaceDetectorMediaPipeModelConfig = {
    runtime: "mediapipe",
    solutionPath,
  };

  return createDetector(model, detectorConfig);
};
