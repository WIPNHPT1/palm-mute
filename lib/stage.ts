// The "stage" layer for big screens (owner's picks from docs/mockups/stage-options.html, 2026-10-05): the Song
// Generator and the Chord Lab grow with the screen ("Fluid" zoom) and a faint moving background (an oscilloscope)
// sits behind each page, gutters included. The fretboard rails that once filled the gutters were dropped (2026-10-05). Phones and tablets are untouched.

/** Zoom starts at this window width and grows with it... */
export const ZOOM_FROM = 1600;
/** ...up to this much. 1.2× at 1920, 1.4× at 2240 and wider. */
export const ZOOM_MAX = 1.4;
/** While zoomed, the page caps at this width (before zoom) so the sides stay free. */
export const ZOOMED_PAGE_MAX = 1280;

/** The page zoom for a window width. */
export const pageZoom = (width: number) => (width < ZOOM_FROM ? 1 : Math.min(ZOOM_MAX, width / ZOOM_FROM));

/**
 * Runs in <head> before first paint: sets --page-zoom on <html> from the window width, and keeps it current as the
 * window is resized. Pages opt in to using it (components/ZoomShell.tsx), so a page that doesn't never scales.
 */
export const ZOOM_SCRIPT = `(function(){var d=document.documentElement;function s(){var w=window.innerWidth;d.style.setProperty("--page-zoom",String(w<${ZOOM_FROM}?1:Math.min(${ZOOM_MAX},w/${ZOOM_FROM})))}s();window.addEventListener("resize",s)})();`;

/** Pages that zoom on big screens and get the moving background. */
export const STAGE_PATHS = ["/generator", "/chords"];
export const isStagePath = (path: string) => STAGE_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
