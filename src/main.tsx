/**
 * main.tsx
 * React application entry point.
 *
 * The theme is applied before the first render so the page never paints light
 * and then flips to dark (or the reverse) on mount.
 */

// File: silkllm-frontend/src/main.tsx

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { initTheme } from "./hooks/useTheme";
import { registerServiceWorker } from "./lib/pwa";
import "./styles/globals.css";

initTheme();

// Offline support and update detection. The shell listens for this event to
// show the "new version ready" bar.
registerServiceWorker(() => {
  window.dispatchEvent(new CustomEvent("silk:update-ready"));
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// EOF silkllm-frontend/src/main.tsx
