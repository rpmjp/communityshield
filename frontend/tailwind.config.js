/** @type {import('tailwindcss').Config} */
import typography from "@tailwindcss/typography";

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "#EAF2EF",
          100: "#CFE0D9",
          200: "#A4C3B6",
          300: "#76A593",
          400: "#4F8772",
          500: "#2D5F4F",
          600: "#244D40",
          700: "#1B3B31",
          800: "#132A23",
          900: "#0A1814",
          DEFAULT: "#2D5F4F",
        },
        accent: {
          50:  "#FBF1E3",
          100: "#F6DFBE",
          200: "#F0C68A",
          300: "#EAAC55",
          400: "#E8A04C",
          500: "#D58A2F",
          600: "#A86C23",
          700: "#7B4F19",
          800: "#4E3210",
          900: "#211505",
          DEFAULT: "#E8A04C",
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      typography: ({ theme }) => ({
        cs: {
          css: {
            "--tw-prose-body": theme("colors.brand.100"),
            "--tw-prose-headings": theme("colors.brand.50"),
            "--tw-prose-lead": theme("colors.brand.200"),
            "--tw-prose-links": theme("colors.accent.400"),
            "--tw-prose-bold": theme("colors.brand.50"),
            "--tw-prose-counters": theme("colors.brand.300"),
            "--tw-prose-bullets": theme("colors.brand.500"),
            "--tw-prose-hr": theme("colors.brand.700"),
            "--tw-prose-quotes": theme("colors.brand.100"),
            "--tw-prose-quote-borders": theme("colors.accent.500"),
            "--tw-prose-captions": theme("colors.brand.300"),
            "--tw-prose-code": theme("colors.accent.200"),
            "--tw-prose-pre-code": theme("colors.brand.100"),
            "--tw-prose-pre-bg": theme("colors.brand.800"),
            "--tw-prose-th-borders": theme("colors.brand.600"),
            "--tw-prose-td-borders": theme("colors.brand.700"),
            "code::before": { content: "''" },
            "code::after": { content: "''" },
            code: {
              backgroundColor: theme("colors.brand.800"),
              padding: "0.15rem 0.4rem",
              borderRadius: "0.25rem",
              fontWeight: "400",
            },
            table: {
              fontSize: "0.875rem",
            },
            "th, td": {
              paddingTop: "0.5rem",
              paddingBottom: "0.5rem",
            },
          },
        },
      }),
    },
  },
  plugins: [typography],
};