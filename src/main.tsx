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
import "./styles/globals.css";

initTheme();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// EOF silkllm-frontend/src/main.tsx
