// "How to use" guides under the Generator and Chord Lab titles (components/PageGuide.tsx). Hiding one is
// remembered per page; a script in <head> applies it before first paint, so a hidden guide never flashes.
export type GuidePage = "generator" | "chords";

export const GUIDE_PAGES: GuidePage[] = ["generator", "chords"];
/**
 * Where hiding a guide is remembered. The Generator's guide got new text for the song builder, so it has a
 * new key: anyone who hid the old guide sees the new one once (docs/song-builder-prd.md B13). The same for the
 * Chords page, which became the Chord Lab (docs/chord-lab-prd.md).
 */
const STORAGE_KEYS: Record<GuidePage, string> = { generator: "palm-mute-guide-generator-v2", chords: "palm-mute-guide-chords-lab" };
export const guideStorageKey = (page: GuidePage) => STORAGE_KEYS[page];
export const guideHiddenClass = (page: GuidePage) => `guide-hidden-${page}`;

/** Runs in <head>: adds guide-hidden-{page} to <html> for each guide the reader has hidden. */
export const GUIDE_SCRIPT = `(function(){try{${GUIDE_PAGES.map(
  (p) => `if(localStorage.getItem("${guideStorageKey(p)}")==="hidden")document.documentElement.classList.add("${guideHiddenClass(p)}");`,
).join("")}}catch(e){}})();`;
