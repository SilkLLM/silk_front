// File: silkllm-frontend/vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  server: {
    port: 5173,
    proxy: {
      // Proxy API calls to the backend in development, so requests stay
      // same-origin and no CORS setup is needed while working locally.
      // Point VITE_DEV_API_TARGET at http://localhost:8000 to develop against a
      // backend running on your own machine.
      "/api": {
        target: process.env.VITE_DEV_API_TARGET || "https://silkllm-backend.169.58.53.167.nip.io",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Code-split the heavy 3D canvas so it doesn't block first paint
        manualChunks: {
          "react-vendor":  ["react", "react-dom", "react-router-dom"],
          // Recharts is the single heaviest dependency, and only a handful of
          // views draw a chart. Kept in its own chunk so it is fetched when one
          // of them is opened rather than as part of every first visit.
          "chart-vendor":  ["recharts"],
        },
      },
    },
  },
});

// EOF silkllm-frontend/vite.config.ts
