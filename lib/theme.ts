// Theme: dark by default for everyone (owner call, 2026-10-06; it was light). The page is rendered dark, and is light
// only when the reader turns the menu's DARK switch off; that choice is stored in localStorage and applied before
// first paint. A reader who already chose either theme keeps it.
export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "palm-mute-theme";

/** Runs in <head> before first paint: light only for a reader who chose it (storage blocked: it stays dark). */
export const THEME_SCRIPT = `(function(){try{document.documentElement.classList.toggle("dark",localStorage.getItem("${THEME_STORAGE_KEY}")!=="light")}catch(e){}})();`;

export function currentTheme(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Private mode / storage disabled: the theme still applies for this page view.
  }
}
