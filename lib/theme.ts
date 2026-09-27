// Dark-mode preference: an explicit choice is stored in localStorage; otherwise follow the OS.
export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "palm-mute-theme";

/** Runs in <head> before first paint so a dark-mode page never flashes light. */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}if(t==="dark")document.documentElement.classList.add("dark")}catch(e){}})();`;

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
