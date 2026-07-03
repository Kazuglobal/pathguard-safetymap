import type { Config } from "tailwindcss"

const config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
    "*.{js,ts,jsx,tsx,mdx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        app: [
          "var(--font-app)",
          '"Zen Maru Gothic"',
          '"Hiragino Maru Gothic ProN"',
          '"M PLUS Rounded 1c"',
          "system-ui",
          "sans-serif",
        ],
        inter: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        "tanken-card":
          "0 1.5px 0 rgba(67,57,43,.07), 0 14px 30px -18px rgba(67,57,43,.38)",
        "tanken-soft":
          "0 1px 0 rgba(67,57,43,.06), 0 6px 16px -10px rgba(67,57,43,.28)",
        "tanken-float":
          "0 1px 0 rgba(67,57,43,.05), 0 10px 26px -14px rgba(67,57,43,.45)",
        "press-green": "0 4px 0 #0C7A55",
        "press-sun": "0 4px 0 #E2A812",
        "press-accent": "0 4px 0 #D8660A",
        "press-paper": "0 3px 0 rgba(67,57,43,.16)",
      },
      colors: {
        paper: {
          DEFAULT: "#FBF5E9",
          deep: "#F3EAD6",
          card: "#FFFDF7",
        },
        ink: {
          DEFAULT: "#43392B",
          soft: "#847661",
          faint: "#B7AB93",
        },
        forest: {
          DEFAULT: "#159E72",
          strong: "#0C7A55",
          soft: "#DFF3E9",
        },
        safety: {
          DEFAULT: "#F4801F",
          strong: "#D8660A",
          soft: "#FDEBD7",
        },
        sun: {
          DEFAULT: "#FFC93E",
          deep: "#E2A812",
          soft: "#FFF3CE",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--background))",
          foreground: "hsl(var(--foreground))",
          accent: "hsl(var(--muted))",
          "accent-foreground": "hsl(var(--muted-foreground))",
          primary: "hsl(var(--primary))",
          "primary-foreground": "hsl(var(--primary-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config

export default config
