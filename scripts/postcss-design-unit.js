// Design scale (owner's pick, 2026-10-06; DECISIONS.md "Design scale"): every pixel size in the site's CSS is
// written in a design unit, --u, so the whole design can be drawn smaller on big screens without browser zoom.
// --u is 1px by default and 0.9px from a 1440px window (app/globals.css). This PostCSS step runs after Tailwind
// and rewrites each `Npx` in a declaration's value (Tailwind's arbitrary values, app/*.css, the token shadows)
// to `calc(N * var(--u))`. Left alone: hairlines (1px and under, so borders stay one device pixel), anything
// inside url(...) or quotes, and media/container query conditions (they're at-rule params, never declarations),
// so breakpoints still match real window widths.
// Text keeps a 12px floor (owner's pick, 2026-10-06): a font-size written at 12px or more never draws under 12px
// when the design is scaled (`max(12px, …)`), so the site's 12px labels stay 12px. Sizes written smaller on purpose
// (tab art, diagram labels) scale as before.

const PX = /(-?\d*\.?\d+)px\b/g;
const MIN_TEXT = 12;

/** True when every px size in a font-size value is at least the floor (so the floor can't enlarge it as written). */
function textAtFloor(value) {
  const sizes = [...value.matchAll(PX)].map((m) => Number(m[1]));
  return sizes.length > 0 && sizes.every((v) => v >= MIN_TEXT);
}

function convert(value) {
  // Split out url(...) and quoted strings so their contents are never touched.
  return value
    .split(/(url\([^)]*\)|"[^"]*"|'[^']*')/g)
    .map((part, i) => {
      if (i % 2) return part;
      return part.replace(PX, (m, n) => {
        const v = Number(n);
        if (Math.abs(v) <= 1) return m;
        return `calc(${n} * var(--u))`;
      });
    })
    .join("");
}

const plugin = () => {
  // PostCSS visits a changed declaration again: the floor's own 12px must not be converted on that second visit.
  const done = new WeakSet();
  return {
    postcssPlugin: "design-unit",
    Declaration(decl) {
      if (done.has(decl) || decl.prop === "--u" || !decl.value.includes("px")) return;
      let next = convert(decl.value);
      if (decl.prop === "font-size" && next !== decl.value && textAtFloor(decl.value)) next = `max(${MIN_TEXT}px, ${next})`;
      if (next !== decl.value) {
        done.add(decl);
        decl.value = next;
      }
    },
  };
};
plugin.postcss = true;
plugin.convert = convert;

module.exports = plugin;
