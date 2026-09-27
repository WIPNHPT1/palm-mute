// Wired directly from design-tokens.json — keep these in sync if the tokens file changes.
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./context/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#171310",
        paper: "#F6F1E4",
        surface: "#FFFFFF",
        accent: "#C23A26",
        brass: "#B8862E",
        line: "#E4DAC3",
        // Secondary neutrals used by the mockups (badge outline, dark-toggle track, About step-card rule).
        "line-strong": "#DCD3BE",
        "ink-soft": "#2A241C",
        "ink-mid": "#362B1F",
        backdrop: "#EDE6D4",
        success: "#3F8F4F",
        text: {
          primary: "#171310",
          secondary: "#4E4738",
          muted: "#6B6152",
          faint: "#8C8172",
          faintest: "#A89C86",
          disabled: "#B5AA92",
          "on-dark": "#F6F1E4",
          "on-dark-muted": "#D9CFB9",
          "on-dark-faint": "#A89C86",
          "on-accent": "#FFF9EF",
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
        pill: "20px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(23,19,16,0.04), 0 10px 20px -14px rgba(23,19,16,0.18)",
        // design-tokens.json shadow.cardHighlightTemplate / buttonTemplate, resolved with the default accent.
        "card-highlight": "0 1px 2px rgba(23,19,16,0.04), 0 14px 24px -14px #C23A2644",
        button: "0 8px 20px -8px #C23A2699",
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
