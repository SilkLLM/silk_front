// File: silkllm-frontend/tailwind.config.js
// Tailwind CSS configuration with SilkLLM brand colors from the brand guide.

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // ── Primary Brand Colors ─────────────────────────────────────────────
        "silk-gold":      "#D29A2D",
        "electric-yellow":"#D0C51E",
        "warm-olive":     "#B5B86B",
        "soft-cream":     "#FEF1DC",
        "bright-glow":    "#FAED26",

        // ── Neutral & Supporting ──────────────────────────────────────────────
        "cloud-grey":     "#EDEFF0",
        "sand":           "#FAC059",
        "dusty-olive":    "#DCE083",
        "warm-grey":      "#C2C9CC",

        // ── Dark Mode ────────────────────────────────────────────────────────
        "deep-charcoal":  "#191B1C",
        "slate-dark":     "#383B3D",
        "muted-metal":    "#595F61",
        "dim-olive":      "#4D4E2A",

        // ── Semantic aliases ─────────────────────────────────────────────────
        brand: {
          DEFAULT: "#D29A2D",
          hover:   "#A87B22",
          light:   "#FEF1DC",
          dark:    "#7D5A17",
        },
      },
      fontFamily: {
        sans:  ["Inter", "system-ui", "-apple-system", "sans-serif"],
        display: ["Satoshi", "General Sans", "Inter", "sans-serif"],
        mono:  ["JetBrains Mono", "Fira Code", "monospace"],
      },
      backgroundImage: {
        "silk-gradient": "linear-gradient(135deg, #D29A2D, #D0C51E, #B5B86B)",
        "dark-surface":  "linear-gradient(180deg, #191B1C 0%, #383B3D 100%)",
      },
      animation: {
        "fade-in":   "fadeIn 0.5s ease-out",
        "slide-up":  "slideUp 0.4s ease-out",
        "glow-pulse":"glowPulse 2s ease-in-out infinite",
      },
      keyframes: {
        fadeIn:  { "0%": { opacity: 0 }, "100%": { opacity: 1 } },
        slideUp: { "0%": { opacity: 0, transform: "translateY(20px)" }, "100%": { opacity: 1, transform: "translateY(0)" } },
        glowPulse: { "0%,100%": { boxShadow: "0 0 8px #D29A2D55" }, "50%": { boxShadow: "0 0 24px #D29A2Daa" } },
      },
    },
  },
  plugins: [],
};

// EOF silkllm-frontend/tailwind.config.js
