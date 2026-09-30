// Theme: light by default for everyone (owner call, 2026-09-30). Dark only when the reader picks it with
// the menu's DARK switch; that choice is stored in localStorage and applied before first paint.
export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "palm-mute-theme";

/** Runs in <head> before first paint so a reader who chose dark never sees a light flash. */
export const THEME_SCRIPT = `(function(){try{if(localStorage.getItem("${THEME_STORAGE_KEY}")==="dark")document.documentElement.classList.add("dark")}catch(e){}})();`;

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
