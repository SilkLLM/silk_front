/**
 * useTheme.ts
 * Light/dark theme, persisted in localStorage. Toggles the `dark` class on
 * <html>, which Tailwind (darkMode: "class") uses across the app.
 */

// File: silkllm-frontend/src/hooks/useTheme.ts

import { useCallback, useEffect, useState } from "react";

type Theme = "light" | "dark";

function initialTheme(): Theme {
  const saved = typeof localStorage !== "undefined" ? localStorage.getItem("silk_theme") : null;
  if (saved === "light" || saved === "dark") return saved;
  return "dark";
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    localStorage.setItem("silk_theme", theme);
  }, [theme]);

  const toggle = useCallback(() => setTheme((t) => (t === "dark" ? "light" : "dark")), []);

  return { theme, toggle };
}

// EOF silkllm-frontend/src/hooks/useTheme.ts
