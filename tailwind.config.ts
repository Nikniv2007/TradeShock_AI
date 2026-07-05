import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // War-room palette — dark navy / graphite / charcoal
        base: {
          950: "#05070d",
          900: "#0a0e17",
          850: "#0d121d",
          800: "#111725",
          700: "#1a2234",
          600: "#232d42",
          500: "#2f3a52",
        },
        ink: {
          DEFAULT: "#e6edf7",
          muted: "#9aa7bd",
          faint: "#6b7890",
        },
        // Accent system
        amber: {
          DEFAULT: "#f5a623",
          soft: "#f5a62322",
        },
        emerald: {
          DEFAULT: "#2dd4a7",
          soft: "#2dd4a722",
        },
        danger: {
          DEFAULT: "#ff5b6a",
          soft: "#ff5b6a22",
        },
        cyan: {
          DEFAULT: "#3ec7e0",
          soft: "#3ec7e022",
        },
        slateaccent: {
          DEFAULT: "#7c8cff",
          soft: "#7c8cff22",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(124,140,255,0.15), 0 8px 40px -12px rgba(124,140,255,0.35)",
        card: "0 1px 0 0 rgba(255,255,255,0.03) inset, 0 12px 40px -20px rgba(0,0,0,0.8)",
      },
      backgroundImage: {
        "grid-faint":
          "linear-gradient(to right, rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.025) 1px, transparent 1px)",
      },
    },
  },
  plugins: [],
};

export default config;
