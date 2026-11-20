import type { Config } from "tailwindcss";

// color-mix agar modifier opacity Tailwind (mis. bg-warning/15) tetap bekerja dengan CSS variables
const c = (v: string) => `color-mix(in srgb, var(--${v}) calc(<alpha-value> * 100%), transparent)`;

export default {
  darkMode: ["class", '[data-theme="dark"]'],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    // Layout tunggal mobile (lihat REQUIREMENTS 5.1): tanpa breakpoint md/lg/xl.
    screens: {},
    extend: {
      colors: {
        bg: c("bg"),
        surface: c("surface"),
        "surface-glass": c("surface-glass"),
        border: c("border"),
        "border-glass": c("border-glass"),
        text: c("text"),
        muted: c("text-muted"),
        primary: c("primary"),
        "on-primary": c("on-primary"),
        "primary-soft": c("primary-soft"),
        accent: c("accent"),
        income: c("income"),
        expense: c("expense"),
        warning: c("warning"),
        info: c("info"),
        background: c("bg"),
      },
      fontFamily: { sans: ["var(--font-jakarta)", "system-ui", "sans-serif"] },
      fontSize: {
        display: ["32px", { lineHeight: "40px", fontWeight: "700" }],
        h1: ["22px", { lineHeight: "28px", fontWeight: "700" }],
        h2: ["18px", { lineHeight: "24px", fontWeight: "600" }],
        body: ["15px", { lineHeight: "22px" }],
        caption: ["12px", { lineHeight: "16px", fontWeight: "500" }],
        input: ["16px", { lineHeight: "24px", fontWeight: "500" }],
      },
      borderRadius: { btn: "14px", card: "20px", sheet: "28px", nav: "24px" },
      boxShadow: {
        card: "0 1px 2px rgba(15,23,42,0.06), 0 4px 16px rgba(15,23,42,0.04)",
        glass: "0 8px 32px rgba(15,23,42,0.12)",
        fab: "0 8px 24px rgba(15,118,110,0.35)",
      },
      transitionTimingFunction: { zude: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
      maxWidth: { app: "430px" },
    },
  },
  plugins: [],
} satisfies Config;
