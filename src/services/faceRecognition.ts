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
  var FaceDetection: unknown;
}

export interface FaceAnalysis {
  forward: boolean;
  balanceRatio: number;
  eyeVerticalRatio: number;
  earCenterY: number;
  eyeEarMargin: number;
}

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

const waitForFaceDetection = (timeoutMs: number): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (window.FaceDetection) {
      resolve();
      return;
    }

    const startTime = Date.now();
    const checkInterval = setInterval(() => {
      if (window.FaceDetection) {
        clearInterval(checkInterval);
        resolve();
      } else if (Date.now() - startTime > timeoutMs) {
        clearInterval(checkInterval);
        reject(new Error("MediaPipe FaceDetection failed to load from CDN"));
      }
    }, 100);
  });
};

export const createFaceDetector = async () => {
  await setBackend("webgl");

  if (typeof window !== "undefined") {
    await waitForFaceDetection(10000);

    if (import.meta.env.VITE_DEBUG_MODE === "true") {
      console.log(
        "FaceDetection loaded successfully:",
        typeof window.FaceDetection,
      );
    }

    if (!globalThis.FaceDetection) {
      globalThis.FaceDetection = window.FaceDetection;
    }
  }

  const model = SupportedModels.MediaPipeFaceDetector;
  const solutionPath = `${import.meta.env.BASE_URL}mediapipe/face_detection`;

  const detectorConfig: MediaPipeFaceDetectorMediaPipeModelConfig = {
    runtime: "mediapipe",
    solutionPath,
  };

  return createDetector(model, detectorConfig);
};
