import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_PATH || "/realtime_space_travel/",
  resolve: {
    alias: {
      // The app loads MediaPipe FaceDetection at runtime via the
      // <script src="mediapipe/face_detection/face_detection.js"> tag in
      // index.html (sets window.FaceDetection). This stub bridges the npm
      // import used by @tensorflow-models/face-detection to that global.
      // It is the PRODUCTION mechanism (not test-only) — keep it here.
      "@mediapipe/face_detection": path.resolve(
        __dirname,
        "./src/stubs/mediapipe-stub.ts",
      ),
    },
  },
  optimizeDeps: {
    exclude: ["@mediapipe/face_detection"],
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
  },
});
