import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: "/realtime_space_travel/", // << FONTOS: Cseréld le ezt a saját repository-d nevére!
});
