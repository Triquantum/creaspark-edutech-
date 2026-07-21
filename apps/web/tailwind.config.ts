import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: "#2F6FB8", hover: "#255C99" },
        accent: "#4AA3FF",
        success: "#22C55E",
        warning: "#F59E0B",
        danger: "#EF4444",
        surface: "#F5F8FC",
        sidebar: "#12263F",
        ink: "#334155",
        night: "#0F172A",
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(15,23,42,0.04), 0 8px 24px -12px rgba(47,111,184,0.18)",
        lift: "0 12px 40px -12px rgba(47,111,184,0.30)",
      },
      borderRadius: { xl2: "1.25rem" },
    },
  },
  plugins: [],
} satisfies Config;
