import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      "/api": {
        target: "http://localhost:5001",
        changeOrigin: true,
      },
    },
  },
  // Pre-bundle MediaPipe for worker compatibility in dev mode
  optimizeDeps: {
    include: ["@mediapipe/tasks-vision"],
  },
  worker: {
    format: "es",
  },
});
