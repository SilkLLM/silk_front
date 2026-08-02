/**
 * useTheme.ts
 * Theme state as a tiny module-level store rather than per-component state, so
 * every consumer (toggle, charts, the shell) sees the same value and re-renders
 * together when it changes.
 *
 * Three modes are persisted: "light", "dark", and "system". "system" follows the
 * OS and keeps following it live. `resolved` is always the concrete theme that is
 * actually painted, which is what charts and colour lookups need.
 */

// File: silkllm-frontend/src/hooks/useTheme.ts

import { useCallback, useSyncExternalStore } from "react";

export type ThemeMode = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "silk_theme";

const mql = typeof window !== "undefined" && window.matchMedia
  ? window.matchMedia("(prefers-color-scheme: dark)")
  : null;

function readStored(): ThemeMode {
  if (typeof localStorage === "undefined") return "dark";
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === "light" || saved === "dark" || saved === "system") return saved;
  // Legacy installs stored only "light"/"dark"; anything else falls back to the
  // product's default, which is dark.
  return "dark";
}

let mode: ThemeMode = readStored();
const listeners = new Set<() => void>();

function resolve(m: ThemeMode): ResolvedTheme {
  if (m === "system") return mql?.matches ? "dark" : "light";
  return m;
}

/** Paint the document and tell the browser which native chrome to use. */
function apply() {
  if (typeof document === "undefined") return;
  const resolved = resolve(mode);
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.dataset.theme = resolved;
  root.style.colorScheme = resolved;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", resolved === "dark" ? "#0D0F10" : "#F6F5F2");
}

function emit() {
  apply();
  listeners.forEach((l) => l());
}

/** Set the theme once, before React mounts, to avoid a first-paint flash. */
export function initTheme() {
  apply();
  mql?.addEventListener?.("change", () => {
    if (mode === "system") emit();
  });
}

export function setThemeMode(next: ThemeMode) {
  mode = next;
  try { localStorage.setItem(STORAGE_KEY, next); } catch { /* private mode */ }
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

const getMode = () => mode;
const getServerMode = (): ThemeMode => "dark";

export function useTheme() {
  const current = useSyncExternalStore(subscribe, getMode, getServerMode);
  const resolved = resolve(current);

  /** Cycle light → dark → system, which is what the header button does. */
  const cycle = useCallback(() => {
    setThemeMode(mode === "light" ? "dark" : mode === "dark" ? "system" : "light");
  }, []);

  /** Straight flip between the two concrete themes. */
  const toggle = useCallback(() => {
    setThemeMode(resolve(mode) === "dark" ? "light" : "dark");
  }, []);

  return { mode: current, theme: resolved, resolved, setMode: setThemeMode, toggle, cycle };
}

// EOF silkllm-frontend/src/hooks/useTheme.ts
