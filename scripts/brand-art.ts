// Palm/Mute's brand art in the site's current look (owner's call, 2026-10-05): the night studio (a red and brass stage
// light, a faint studio grid), the bolt in the ember gradient (cream warming into red, as the footer's GitHub logo and the
// menu's horns), and a glass card holding a real tab from the engine. Shared by scripts/build-brand-assets.ts (icons, the
// share image) and scripts/build-readme-assets.ts (the README hero, the GitHub social preview).

export const INK = "#0C0A08";
export const CREAM = "#F6F1E4";
export const RED = "#E5573F";
export const DEEP = "#A8321F";
export const BRASS = "#C9973C";
export const MUTED = "#A89C86";
export const BOLT = "M9.2 0 .4 12h5.4L3.4 20l8.4-12.4H6.4L9.2 0Z"; // components/Wordmark.tsx, 12×20
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

/** The bolt in the ember gradient, as an inline SVG (12×20 viewBox); `id` keeps several on one page apart. */
export function boltSvg(id: string, attrs = ""): string {
  return `<svg viewBox="0 0 12 20" ${attrs}><defs><linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="2" y1="0" x2="10" y2="20">` +
    `<stop offset="0.02" stop-color="${CREAM}"/><stop offset="0.55" stop-color="${RED}"/></linearGradient></defs>` +
    `<path d="${BOLT}" fill="url(#${id})"/></svg>`;
}

/**
 * The icon: the gradient bolt on an ink tile lit by a red stage light from above. `pad` is the share of the tile kept
 * clear around the bolt; `small` (16 and 32px) drops the light and draws the bolt a touch redder so it stays crisp.
 */
export function iconSvg(size: number, { pad = 0.2, round = 0.22, small = false } = {}): string {
  const inner = size * (1 - 2 * pad);
  const scale = inner / 20;
  const x = (size - 12 * scale) / 2, y = (size - 20 * scale) / 2;
  const top = small ? 0 : 0.02;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">` +
    `<defs>` +
    `<radialGradient id="g" cx="0.5" cy="-0.05" r="0.95"><stop offset="0" stop-color="${RED}" stop-opacity="${small ? 0 : 0.5}"/><stop offset="0.55" stop-color="${DEEP}" stop-opacity="${small ? 0 : 0.18}"/><stop offset="1" stop-color="${INK}" stop-opacity="0"/></radialGradient>` +
    `<linearGradient id="b" gradientUnits="userSpaceOnUse" x1="2" y1="0" x2="10" y2="20"><stop offset="${top}" stop-color="${CREAM}"/><stop offset="${small ? 0.4 : 0.55}" stop-color="${RED}"/></linearGradient>` +
    `</defs>` +
    `<rect width="${size}" height="${size}" rx="${size * round}" fill="${INK}"/>` +
    `<rect width="${size}" height="${size}" rx="${size * round}" fill="url(#g)"/>` +
    `<path d="${BOLT}" fill="url(#b)" transform="translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${scale.toFixed(4)})"/></svg>`;
}

export const FONTS = `<link href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Space+Mono:wght@400;700&display=block" rel="stylesheet">`;

/**
 * A wide brand card: the studio, the kicker, the wordmark with its gradient bolt, a line of copy, a foot line, and a glass
 * card holding a real tab (its first line the chord names, then P.M./accents, then the strings). Laid out for the given
 * size; the README hero animates `--x` (a playhead in the card) and `--flip` (the bolt).
 */
export function studioHtml(o: { width: number; height: number; tab: string[]; card: string; copy: string; foot: string; url?: string; mark: number; playhead?: boolean }): string {
  const { width: W, height: H } = o;
  const s = H / 630; // everything scales with the height
  const px = (n: number) => `${Math.round(n * s)}px`;
  const rows = o.tab.map((l, i) => (i === 0 ? `<span class="c">${esc(l)}</span>` : /P\.M\.|let ring|^[\s>]*$/.test(l) ? `<span class="m">${esc(l)}</span>` : esc(l))).join("\n");
  return `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>
  * { margin:0; box-sizing:border-box; }
  body { width:${W}px; height:${H}px; background:${INK}; color:${CREAM}; font-family:"Space Mono", monospace; position:relative; overflow:hidden; }
  .light { position:absolute; inset:0; background:
    radial-gradient(48% 70% at 74% 16%, rgba(232,90,66,.42), rgba(232,90,66,.12) 50%, transparent 72%),
    radial-gradient(36% 60% at 92% 78%, rgba(201,151,60,.3), transparent 70%),
    radial-gradient(40% 60% at 4% 92%, rgba(168,50,31,.32), transparent 70%); }
  .grid { position:absolute; inset:0; background-image:linear-gradient(rgba(246,241,228,.04) 1px, transparent 1px), linear-gradient(90deg, rgba(246,241,228,.04) 1px, transparent 1px);
    background-size:${px(64)} ${px(64)}; -webkit-mask:radial-gradient(70% 80% at 70% 45%, #000, transparent); }
  .left { position:absolute; left:${px(72)}; top:${px(70)}; width:${Math.round(W * 0.42)}px; }
  .kicker { color:${RED}; font-size:${px(20)}; letter-spacing:.18em; }
  .mark { font-family:"Archivo Black", sans-serif; font-size:${px(o.mark)}; line-height:1; margin-top:${px(16)}; display:flex; align-items:center; letter-spacing:-.01em; }
  .bolt { flex:none; display:inline-block; width:.6em; height:.9em; margin:0 .04em; perspective:200px; filter:drop-shadow(0 0 ${px(14)} rgba(229,87,63,.55)); }
  .bolt svg { width:100%; height:100%; transform:rotateY(var(--flip, 0deg)); }
  .copy { font-size:${px(25)}; line-height:1.5; margin-top:${px(24)}; color:#E8DFCB; }
  .foot { position:absolute; left:${px(72)}; bottom:${px(54)}; font-size:${px(17)}; letter-spacing:.12em; color:${MUTED}; }
  .foot b { color:${CREAM}; }
  .url { position:absolute; right:${px(72)}; bottom:${px(54)}; font-size:${px(18)}; letter-spacing:.08em; color:${CREAM}; }
  .card { position:absolute; right:${px(56)}; top:auto; bottom:${px(118)}; padding:${px(20)} ${px(22)} ${px(22)}; border-radius:${px(22)};
    background:linear-gradient(160deg, rgba(246,241,228,.11), rgba(246,241,228,.03) 60%), rgba(12,10,8,.55);
    box-shadow:inset 0 1px 0 rgba(255,255,255,.16), 0 ${px(40)} ${px(80)} ${px(-40)} rgba(0,0,0,.9); }
  .card::before { content:""; position:absolute; inset:0; border-radius:inherit; padding:1px; background:linear-gradient(140deg, rgba(255,255,255,.5), rgba(255,255,255,.05) 35%, rgba(229,87,63,.45) 82%, rgba(255,255,255,.1));
    -webkit-mask:linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite:xor; }
  .card::after { content:""; position:absolute; left:10%; right:10%; bottom:${px(-40)}; height:${px(36)}; border-radius:50%; background:radial-gradient(closest-side, rgba(229,87,63,.4), transparent); }
  .hd { display:flex; align-items:center; gap:${px(10)}; margin-bottom:${px(14)}; font-size:${px(14)}; letter-spacing:.12em; color:${MUTED}; }
  .hd i { font-style:normal; padding:${px(2)} ${px(7)}; border-radius:${px(4)}; background:${CREAM}; color:${INK}; font-weight:700; }
  .hd b { font-family:"Archivo Black", sans-serif; font-weight:400; font-size:${px(19)}; letter-spacing:0; color:${CREAM}; }
  .well { position:relative; padding:${px(14)} ${px(16)}; border-radius:${px(14)}; background:rgba(0,0,0,.4); box-shadow:inset 0 0 0 1px rgba(246,241,228,.08);
    font-size:${px(15)}; line-height:1.45; white-space:pre; }
  .well .c { color:${RED}; font-weight:700; } .well .m { color:${MUTED}; }
  .head { position:absolute; top:${px(10)}; bottom:${px(10)}; width:2px; background:${RED}; box-shadow:0 0 12px ${RED}; left:var(--x, -10px); }
  .bar { position:absolute; left:0; right:0; bottom:0; height:${px(8)}; background:linear-gradient(90deg, ${RED}, ${BRASS} 50%, transparent); }
</style></head><body>
<div class="light"></div><div class="grid"></div>
<div class="left">
  <div class="kicker">POP-PUNK SONGWRITING ENGINE</div>
  <div class="mark">PALM<span class="bolt">${boltSvg("mk")}</span>MUTE</div>
  <div class="copy">${o.copy}</div>
</div>
<div class="card"><div class="hd">${o.card}</div><div class="well" id="tab">${rows}${o.playhead ? `<div class="head"></div>` : ""}</div></div>
<div class="foot">${o.foot}</div>
${o.url ? `<div class="url">${o.url}</div>` : ""}
<div class="bar"></div>
</body></html>`;
}
