import { describe, it, expect } from "vitest";
import { analyzeFace } from "../services/faceRecognition";
import { Keypoint } from "@tensorflow-models/face-detection";

const createMockFace = (keypoints: Record<string, { x: number; y: number }>) => {
  const keypointList: Keypoint[] = Object.entries(keypoints).map(
    ([name, coords]) => ({
      name,
      x: coords.x,
      y: coords.y,
    })
  );

  return {
    keypoints: keypointList,
    box: { xMin: 0, yMin: 0, width: 100, height: 100 },
  };
};

describe("analyzeFace", () => {
  it("should return forward: false when keypoints are missing", () => {
    const face = createMockFace({});
    const result = analyzeFace(face as any);
    expect(result.forward).toBe(false);
  });

  it("should detect a forward-facing face", () => {
    const face = createMockFace({
      noseTip: { x: 50, y: 50 },
      leftEye: { x: 35, y: 40 },
      rightEye: { x: 65, y: 40 },
      leftEarTragion: { x: 10, y: 60 },
      rightEarTragion: { x: 90, y: 60 },
    });

    const result = analyzeFace(face as any);
    expect(result.forward).toBe(true);
    expect(result.balanceRatio).toBeGreaterThan(0.4);
    expect(result.balanceRatio).toBeLessThan(2.5);
    expect(result.eyeVerticalRatio).toBeLessThan(0.35);
  });

  it("should detect a turned face", () => {
    const face = createMockFace({
      noseTip: { x: 90, y: 50 },
      leftEye: { x: 80, y: 40 },
      rightEye: { x: 95, y: 40 },
      leftEarTragion: { x: 30, y: 60 },
      rightEarTragion: { x: 98, y: 60 },
    });

    const result = analyzeFace(face as any);
    expect(result.forward).toBe(false);
  });

  it("should return zero balanceRatio when ear distances are zero", () => {
    const face = createMockFace({
      noseTip: { x: 50, y: 50 },
      leftEye: { x: 35, y: 40 },
      rightEye: { x: 65, y: 40 },
      leftEarTragion: { x: 50, y: 50 },
      rightEarTragion: { x: 50, y: 50 },
    });

    const result = analyzeFace(face as any);
    expect(result.forward).toBe(false);
    expect(result.balanceRatio).toBe(0);
  });
});
