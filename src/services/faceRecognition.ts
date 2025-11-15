import "@mediapipe/face_detection";
import * as faceDetection from "@tensorflow-models/face-detection";
import * as tf from "@tensorflow/tfjs";

import {
  FACE_BALANCE_MAX_RATIO,
  FACE_BALANCE_MIN_RATIO,
  EYE_LEVEL_MAX_OFFSET_RATIO,
} from "../constants/constants";

export const isFaceLookingForward = (face: faceDetection.Face) => {
  const namedKeypoints = face.keypoints.reduce<
    Record<string, faceDetection.Keypoint>
  >((acc, keypoint) => {
    if (keypoint.name) {
      acc[keypoint.name] = keypoint;
    }
    return acc;
  }, {});

  const leftEar = namedKeypoints.leftEarTragion;
  const rightEar = namedKeypoints.rightEarTragion;
  const leftEye = namedKeypoints.leftEye;
  const rightEye = namedKeypoints.rightEye;
  const nose = namedKeypoints.noseTip;

  if (!leftEar || !rightEar || !leftEye || !rightEye || !nose) {
    return false;
  }

  const distance = (a: faceDetection.Keypoint, b: faceDetection.Keypoint) =>
    Math.hypot(a.x - b.x, a.y - b.y);
  const leftEarDistance = distance(nose, leftEar);
  const rightEarDistance = distance(nose, rightEar);

  if (leftEarDistance === 0 || rightEarDistance === 0) {
    return false;
  }

  const balanceRatio = leftEarDistance / rightEarDistance;
  const symmetricalFace =
    balanceRatio > FACE_BALANCE_MIN_RATIO &&
    balanceRatio < FACE_BALANCE_MAX_RATIO;

  const eyeHorizontalSpan = Math.abs(leftEye.x - rightEye.x);
  const eyeVerticalOffset = Math.abs(leftEye.y - rightEye.y);
  const eyesLevel =
    eyeHorizontalSpan > 0 &&
    eyeVerticalOffset / eyeHorizontalSpan < EYE_LEVEL_MAX_OFFSET_RATIO;

  return symmetricalFace && eyesLevel;
};

export const createFaceDetector = async () => {
  await tf.setBackend("webgl");
  const model = faceDetection.SupportedModels.MediaPipeFaceDetector;

  const solutionPath = import.meta.env.DEV
    ? "https://cdn.jsdelivr.net/npm/@mediapipe/face_detection"
    : `${import.meta.env.BASE_URL}face_detection`;

  const detectorConfig: faceDetection.MediaPipeFaceDetectorMediaPipeModelConfig =
    {
      runtime: "mediapipe",
      solutionPath,
    };

  return faceDetection.createDetector(model, detectorConfig);
};
