import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  base: "/realtime_space_travel/",
  server: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
  resolve: {
    alias: {
      "@mediapipe/face_detection": path.resolve(
        __dirname,
        "./src/stubs/mediapipe-stub.ts",
      ),
    },
  },
  optimizeDeps: {
    exclude: ["@mediapipe/face_detection"],
  },
});
