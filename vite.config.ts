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
          "three-vendor": ["three", "@react-three/fiber", "@react-three/drei"],
          "react-vendor":  ["react", "react-dom", "react-router-dom"],
          "chart-vendor":  ["recharts"],
        },
      },
    },
  },
});

// EOF silkllm-frontend/vite.config.ts
