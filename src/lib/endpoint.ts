/**
 * endpoint.ts
 * Where the SilkLLM API lives, as far as the browser app is concerned.
 *
 * Nobody using the dashboard, and nobody deploying it, should have to know or
 * set a backend address. The app works this out for itself:
 *
 *   1. VITE_API_URL, if the build defined one   (private or self-hosted deploys)
 *   2. the dev proxy at /api on localhost       (vite forwards it, see vite.config.ts)
 *   3. the managed backend                      (any other host, including production)
 *
 * Step 3 is what makes a static build of this app work wherever it is served
 * from. If the service moves, this file is the only thing that changes.
 */

// File: silkllm-frontend/src/lib/endpoint.ts

/** The managed SilkLLM backend. The "/api" prefix is added below. */
export const BACKEND_ORIGIN = "https://silkllm-backend.169.58.53.167.nip.io";

/** True when the app is being served from a developer's own machine. */
function isLocalHost(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h.endsWith(".local");
}

function resolve(): string {
  const configured = import.meta.env.VITE_API_URL;
  if (configured) return String(configured).replace(/\/$/, "");
  // On localhost the vite dev server proxies /api to the backend, which keeps
  // requests same-origin and avoids a CORS round trip while developing.
  if (isLocalHost()) return "/api";
  return `${BACKEND_ORIGIN}/api`;
}

/** Base URL every API call is made against, with no trailing slash. */
export const API_BASE_URL = resolve();

// EOF silkllm-frontend/src/lib/endpoint.ts
