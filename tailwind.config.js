// File: silkllm-frontend/tailwind.config.js
// Tailwind configuration.
//
// Two colour families live here on purpose:
//
//  1. The literal brand hexes ("silk-gold", "deep-charcoal", ...). The marketing
//     pages (Landing, Docs) are deliberately always-dark and paint themselves with
//     these, so they must keep resolving.
//  2. Semantic, theme-aware tokens ("surface", "ink", "line", ...) backed by CSS
//     custom properties declared in styles/globals.css. Everything inside the app
//     shell uses these, which is what makes light and dark mode a single source of
//     truth instead of a pile of `dark:` overrides.
//
// Tokens are stored as space-separated RGB channels so Tailwind's `<alpha-value>`
// modifiers (bg-surface/60, border-line/40) keep working.

/** @type {import('tailwindcss').Config} */

const token = (name) => `rgb(var(${name}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // ── Semantic tokens (theme-aware) ────────────────────────────────────
        page:        token("--c-page"),        // app background behind everything
        surface:     token("--c-surface"),     // cards, panels, sidebar
        sunken:      token("--c-sunken"),      // wells, table headers, inputs
        raised:      token("--c-raised"),      // popovers, menus, modals
        line:        token("--c-line"),        // hairline borders
        "line-strong": token("--c-line-strong"),
        ink:         token("--c-ink"),         // primary text
        "ink-2":     token("--c-ink-2"),       // secondary text
        "ink-3":     token("--c-ink-3"),       // muted text, placeholders
        accent:      token("--c-accent"),      // brand fill (buttons, marks)
        "accent-ink": token("--c-accent-ink"), // brand as *text* (contrast-safe)
        "on-accent": token("--c-on-accent"),   // text sitting on an accent fill
        success:     token("--c-success"),
        warn:        token("--c-warn"),
        danger:      token("--c-danger"),

        // ── Literal brand palette (marketing pages, legacy call-sites) ───────
        "silk-gold":       "#D29A2D",
        "electric-yellow": "#D0C51E",
        "warm-olive":      "#B5B86B",
        "soft-cream":      "#FEF1DC",
        "bright-glow":     "#FAED26",
        "cloud-grey":      "#EDEFF0",
        "sand":            "#FAC059",
        "dusty-olive":     "#DCE083",
        "warm-grey":       "#C2C9CC",
        "deep-charcoal":   "#191B1C",
        "slate-dark":      "#383B3D",
        "muted-metal":     "#595F61",
        "dim-olive":       "#4D4E2A",

        brand: {
          DEFAULT: "#D29A2D",
          hover:   "#A87B22",
          light:   "#FEF1DC",
          dark:    "#7D5A17",
        },
      },
      fontFamily: {
        sans:    ["Inter", "system-ui", "-apple-system", "sans-serif"],
        display: ["Satoshi", "General Sans", "Inter", "sans-serif"],
        mono:    ["JetBrains Mono", "Fira Code", "monospace"],
      },
      fontSize: {
        // A tighter step below text-xs, for table meta and timestamps.
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],
      },
      borderRadius: {
        card: "0.875rem",
      },
      boxShadow: {
        // Soft, low-contrast elevation. Light mode leans on shadow; dark mode
        // leans on the border, so these stay deliberately gentle.
        xs:      "0 1px 2px 0 rgb(var(--c-shadow) / 0.05)",
        card:    "0 1px 2px 0 rgb(var(--c-shadow) / 0.04), 0 1px 3px 0 rgb(var(--c-shadow) / 0.03)",
        raised:  "0 4px 12px -2px rgb(var(--c-shadow) / 0.10), 0 2px 4px -2px rgb(var(--c-shadow) / 0.06)",
        overlay: "0 24px 48px -12px rgb(var(--c-shadow) / 0.28), 0 8px 16px -8px rgb(var(--c-shadow) / 0.16)",
        focus:   "0 0 0 3px rgb(var(--c-accent) / 0.28)",
      },
      backgroundImage: {
        "silk-gradient": "linear-gradient(135deg, #D29A2D, #D0C51E, #B5B86B)",
        "dark-surface":  "linear-gradient(180deg, #191B1C 0%, #383B3D 100%)",
      },
      animation: {
        "fade-in":    "fadeIn 0.24s ease-out",
        "slide-up":   "slideUp 0.28s cubic-bezier(0.16, 1, 0.3, 1)",
        "scale-in":   "scaleIn 0.16s cubic-bezier(0.16, 1, 0.3, 1)",
        "slide-in-left": "slideInLeft 0.24s cubic-bezier(0.16, 1, 0.3, 1)",
        "glow-pulse": "glowPulse 2s ease-in-out infinite",
        shimmer:      "shimmer 1.6s ease-in-out infinite",
      },
      keyframes: {
        fadeIn:  { "0%": { opacity: 0 }, "100%": { opacity: 1 } },
        slideUp: { "0%": { opacity: 0, transform: "translateY(8px)" }, "100%": { opacity: 1, transform: "translateY(0)" } },
        scaleIn: { "0%": { opacity: 0, transform: "scale(0.97)" }, "100%": { opacity: 1, transform: "scale(1)" } },
        slideInLeft: { "0%": { transform: "translateX(-100%)" }, "100%": { transform: "translateX(0)" } },
        glowPulse: { "0%,100%": { boxShadow: "0 0 8px #D29A2D55" }, "50%": { boxShadow: "0 0 24px #D29A2Daa" } },
        shimmer: { "0%,100%": { opacity: 0.45 }, "50%": { opacity: 0.8 } },
      },
    },
  },
  plugins: [],
};

// EOF silkllm-frontend/tailwind.config.js
