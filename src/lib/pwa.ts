/**
 * pwa.ts
 * Everything the app needs to behave like an installed application: service
 * worker registration, update detection, the install prompt, and knowing which
 * surface it is running on.
 *
 * The install prompt is the awkward part of the platform. Chrome fires
 * `beforeinstallprompt` once, early, and it must be captured before React has
 * mounted or it is gone. So the listener is registered at module load and the
 * event is parked here for the UI to pick up later. iOS fires nothing at all,
 * which is why `canInstallManually` exists.
 */

// File: silkllm-frontend/src/lib/pwa.ts

import { useEffect, useState, useSyncExternalStore } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let updateReady: (() => void) | null = null;

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
};

// ── Surface detection ───────────────────────────────────────────────────────

/** True when running as an installed app rather than in a browser tab. */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: window-controls-overlay)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    // iOS Safari predates display-mode and uses a non-standard flag.
    (navigator as any).standalone === true
  );
}

export const isIOS = () =>
  typeof navigator !== "undefined" &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPadOS 13+ reports as a Mac; the touch points give it away.
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

export const isSafari = () =>
  typeof navigator !== "undefined" &&
  /^((?!chrome|android|crios|fxios).)*safari/i.test(navigator.userAgent);

/**
 * iOS has no install API: the user must use the share sheet. When this is true
 * the UI shows instructions rather than a button that cannot work.
 */
export const canInstallManually = () => isIOS() && !isStandalone();

// ── Install prompt ──────────────────────────────────────────────────────────

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    // Suppress the browser's own mini-infobar so the app can ask in context.
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    emit();
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    try { localStorage.setItem("silk_installed", "1"); } catch { /* private mode */ }
    emit();
  });
}

const getPromptAvailable = () => deferredPrompt !== null;
const getServerFalse = () => false;

/** Whether the browser has offered an installable event we can replay. */
export function useInstallAvailable(): boolean {
  return useSyncExternalStore(subscribe, getPromptAvailable, getServerFalse);
}

/** Show the browser's install dialog. Resolves to whether the user accepted. */
export async function promptInstall(): Promise<boolean> {
  if (!deferredPrompt) return false;
  const event = deferredPrompt;
  // The event is single-use: clear it before awaiting so a double click cannot
  // call prompt() twice, which throws.
  deferredPrompt = null;
  emit();
  await event.prompt();
  const { outcome } = await event.userChoice;
  return outcome === "accepted";
}

// ── Service worker ──────────────────────────────────────────────────────────

/**
 * Register the worker and watch for a newer one.
 *
 * Registration is deliberately deferred until after load: a service worker
 * install competes for bandwidth with the page's own assets, and a slower first
 * paint is a worse trade than a slightly later cache.
 */
export function registerServiceWorker(onUpdate?: () => void) {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  // The dev server serves modules that must not be cached.
  if (import.meta.env.DEV) return;

  window.addEventListener("load", async () => {
    try {
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });

      reg.addEventListener("updatefound", () => {
        const incoming = reg.installing;
        if (!incoming) return;
        incoming.addEventListener("statechange", () => {
          // A worker that reaches "installed" while one is already controlling
          // the page is a new version waiting to take over.
          if (incoming.state === "installed" && navigator.serviceWorker.controller) {
            updateReady = () => {
              incoming.postMessage("SKIP_WAITING");
            };
            onUpdate?.();
            emit();
          }
        });
      });

      // Reload once the new worker takes control, so the user lands on the new
      // build rather than a half-swapped one.
      let refreshing = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      });
    } catch {
      // A failed registration costs offline support, not the app. Stay quiet.
    }
  });
}

/** Apply a pending update. The page reloads when the new worker takes over. */
export function applyUpdate() {
  updateReady?.();
  updateReady = null;
}

// ── Connectivity ────────────────────────────────────────────────────────────

/** Live online/offline state, for the offline banner. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

/** Standalone state as a hook, so layout can react to being installed. */
export function useStandalone(): boolean {
  const [standalone, setStandalone] = useState(isStandalone);
  useEffect(() => {
    const mq = window.matchMedia("(display-mode: standalone)");
    const handler = () => setStandalone(isStandalone());
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, []);
  return standalone;
}

// EOF silkllm-frontend/src/lib/pwa.ts
