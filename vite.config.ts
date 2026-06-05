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
      // Proxy API calls to the FastAPI backend in development
      "/api": {
        target: "https://silkllm.onrender.com",
        changeOrigin: true,
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
