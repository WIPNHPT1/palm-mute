// Wired directly from design-tokens.json — keep these in sync if the tokens file changes.
// Colors are emitted as CSS variables (light on :root, dark on .dark) so the whole app themes from
// this one file; components keep using plain classes like `bg-ink` / `text-text-muted`.
const plugin = require("tailwindcss/plugin");

// Light palette = design-tokens.json. Dark palette = the v1 dark theme (see DECISIONS.md).
// Semantics that matter for dark mode:
//   paper   = page + inset backgrounds       surface = card backgrounds
//   ink     = "deep" panels (nav, chord chips, dark cards, selected pill) — stays the darkest
//             layer in both themes, so text on it always uses the `text-on-dark*` colors
//   text.*  = foreground on paper/surface
const palettes = {
  light: {
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
    "text-primary": "#171310",
    "text-secondary": "#4E4738",
    "text-muted": "#6B6152",
    "text-faint": "#8C8172",
    "text-faintest": "#A89C86",
    "text-disabled": "#B5AA92",
    "text-on-dark": "#F6F1E4",
    "text-on-dark-muted": "#D9CFB9",
    "text-on-dark-faint": "#A89C86",
    "text-on-accent": "#FFF9EF",
    "chip-bg": "#171310",
    "chip-label": "#F6F1E4",
    "chip-tab": "#C9BFA9",
  },
  dark: {
    ink: "#0B0908",
    paper: "#15110E",
    surface: "#1F1A16",
    accent: "#E0503A",
    brass: "#C9973C",
    line: "#352D25",
    "line-strong": "#463B30",
    "ink-soft": "#2A241C",
    "ink-mid": "#6B5A45",
    backdrop: "#0F0C0A",
    success: "#52A862",
    "text-primary": "#F1EADB",
    "text-secondary": "#CFC5B0",
    "text-muted": "#A89C86",
    "text-faint": "#8C8172",
    "text-faintest": "#766B5C",
    "text-disabled": "#5E5446",
    "text-on-dark": "#F6F1E4",
    "text-on-dark-muted": "#D9CFB9",
    "text-on-dark-faint": "#A89C86",
    "text-on-accent": "#FFF9EF",
    "chip-bg": "#0B0908",
    "chip-label": "#F6F1E4",
    "chip-tab": "#C9BFA9",
  },
};

const shadows = {
  light: {
    card: "0 1px 2px rgba(23,19,16,0.04), 0 10px 20px -14px rgba(23,19,16,0.18)",
    // design-tokens.json shadow.cardHighlightTemplate / buttonTemplate, resolved with the accent.
    "card-highlight": "0 1px 2px rgba(23,19,16,0.04), 0 14px 24px -14px #C23A2644",
    button: "0 8px 20px -8px #C23A2699",
  },
  dark: {
    card: "0 1px 2px rgba(0,0,0,0.3), 0 10px 20px -14px rgba(0,0,0,0.6)",
    "card-highlight": "0 1px 2px rgba(0,0,0,0.3), 0 14px 24px -14px #E0503A66",
    button: "0 8px 20px -8px #E0503A80",
  },
};

const toChannels = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
};
const cssVars = (mode) => ({
  ...Object.fromEntries(Object.entries(palettes[mode]).map(([k, v]) => [`--color-${k}`, toChannels(v)])),
  ...Object.fromEntries(Object.entries(shadows[mode]).map(([k, v]) => [`--shadow-${k}`, v])),
});
const color = (name) => `rgb(var(--color-${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./context/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        ink: color("ink"),
        paper: color("paper"),
        surface: color("surface"),
        accent: color("accent"),
        brass: color("brass"),
        line: color("line"),
        "line-strong": color("line-strong"),
        "ink-soft": color("ink-soft"),
        "ink-mid": color("ink-mid"),
        backdrop: color("backdrop"),
        success: color("success"),
        text: {
          primary: color("text-primary"),
          secondary: color("text-secondary"),
          muted: color("text-muted"),
          faint: color("text-faint"),
          faintest: color("text-faintest"),
          disabled: color("text-disabled"),
          "on-dark": color("text-on-dark"),
          "on-dark-muted": color("text-on-dark-muted"),
          "on-dark-faint": color("text-on-dark-faint"),
          "on-accent": color("text-on-accent"),
        },
        chip: {
          bg: color("chip-bg"),
          label: color("chip-label"),
          tab: color("chip-tab"),
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
        card: "var(--shadow-card)",
        "card-highlight": "var(--shadow-card-highlight)",
        button: "var(--shadow-button)",
      },
      screens: {
        // tablet matches design-tokens.json. desktop is 1280 (not the tokens' 1440) so common laptop
        // widths get the 5-column layout — see DECISIONS.md.
        tablet: "834px",
        desktop: "1280px",
      },
    },
  },
  plugins: [
    plugin(({ addBase }) => {
      addBase({
        ":root": { ...cssVars("light"), colorScheme: "light" },
        ".dark": { ...cssVars("dark"), colorScheme: "dark" },
      });
    }),
  ],
};
