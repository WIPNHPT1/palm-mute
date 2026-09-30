// "How to use" guides under the Generator and Chords titles (components/PageGuide.tsx). Hiding one is
// remembered per page; a script in <head> applies it before first paint, so a hidden guide never flashes.
export type GuidePage = "generator" | "chords";

export const GUIDE_PAGES: GuidePage[] = ["generator", "chords"];
export const guideStorageKey = (page: GuidePage) => `palm-mute-guide-${page}`;
export const guideHiddenClass = (page: GuidePage) => `guide-hidden-${page}`;

/** Runs in <head>: adds guide-hidden-{page} to <html> for each guide the reader has hidden. */
export const GUIDE_SCRIPT = `(function(){try{${GUIDE_PAGES.map(
  (p) => `if(localStorage.getItem("${guideStorageKey(p)}")==="hidden")document.documentElement.classList.add("${guideHiddenClass(p)}");`,
).join("")}}catch(e){}})();`;
