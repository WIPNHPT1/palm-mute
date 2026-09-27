// Wired directly from design-tokens.json — keep these in sync if the tokens file changes.
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#171310",
        paper: "#F6F1E4",
        surface: "#FFFFFF",
        accent: "#C23A26",
        brass: "#B8862E",
        line: "#E4DAC3",
        success: "#3F8F4F",
        text: {
          primary: "#171310",
          secondary: "#4E4738",
          muted: "#6B6152",
          faint: "#8C8172",
          faintest: "#A89C86",
          disabled: "#B5AA92",
        },
        chip: {
          bg: "#171310",
          label: "#F6F1E4",
          tab: "#C9BFA9",
        },
      },
      fontFamily: {
        display: ["var(--font-archivo-black)", "sans-serif"],
        ui: ["var(--font-space-grotesk)", "sans-serif"],
        mono: ["var(--font-space-mono)", "monospace"],
      },
      spacing: {
        4: "4px",
        8: "8px",
        12: "12px",
        16: "16px",
        24: "24px",
        32: "32px",
        48: "48px",
      },
      borderRadius: {
        outer: "8px",
        mid: "6px",
        small: "4px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(23,19,16,0.04), 0 10px 20px -14px rgba(23,19,16,0.18)",
      },
      screens: {
        // matches design-tokens.json breakpoints — mobile-first Tailwind defaults still apply below `tablet`
        tablet: "834px",
        desktop: "1440px",
      },
    },
  },
  plugins: [],
};
