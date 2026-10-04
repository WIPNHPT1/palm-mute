// Design scale (owner's pick, 2026-10-06; DECISIONS.md "Design scale"): every pixel size in the site's CSS is
// written in a design unit, --u, so the whole design can be drawn smaller on big screens without browser zoom.
// --u is 1px by default and 0.9px from a 1440px window (app/globals.css). This PostCSS step runs after Tailwind
// and rewrites each `Npx` in a declaration's value (Tailwind's arbitrary values, app/*.css, the token shadows)
// to `calc(N * var(--u))`. Left alone: hairlines (1px and under, so borders stay one device pixel), anything
// inside url(...) or quotes, and media/container query conditions (they're at-rule params, never declarations),
// so breakpoints still match real window widths.

const PX = /(-?\d*\.?\d+)px\b/g;

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

const plugin = () => ({
  postcssPlugin: "design-unit",
  Declaration(decl) {
    if (decl.prop === "--u" || !decl.value.includes("px")) return;
    const next = convert(decl.value);
    if (next !== decl.value) decl.value = next;
  },
});
plugin.postcss = true;
plugin.convert = convert;

module.exports = plugin;
