import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#1f2933",
        ember: "#d97706",
        leaf: "#16803c",
        tomato: "#dc2626"
      },
      boxShadow: {
        soft: "0 4px 24px rgba(31, 41, 51, 0.06)",
        "soft-lg": "0 10px 40px rgba(31, 41, 51, 0.10)",
        glow: "0 0 0 3px rgba(245, 158, 11, 0.15)"
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1rem"
      }
    }
  },
  plugins: []
};

export default config;
