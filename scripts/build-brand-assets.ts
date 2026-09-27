// Renders Palm/Mute's icons and share images with Playwright's Chromium (a dev dependency):
// `npm run build:brand`. Colours come from tailwind.config.js tokens; the bolt is the wordmark's.
//   app/icon.svg              favicon (modern browsers)
//   app/favicon.ico           16/32/48px fallback
//   app/apple-icon.png        180px home-screen icon (iOS)
//   public/icons/icon-192.png, icon-512.png, icon-maskable-512.png   web app manifest (Android)
//   app/opengraph-image.png, app/twitter-image.png                   1200×630 share preview
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tabText } from "@/lib/fretboard";
import { renderSection } from "@/lib/generator";

const INK = "#171310";
const PAPER = "#F6F1E4";
const ACCENT = "#C23A26";
const ACCENT_ON_INK = "#E5573F";
const MUTED_ON_INK = "#A89C86";
const BOARD_CELL = "#211B15";
const BOLT = "M9.2 0 .4 12h5.4L3.4 20l8.4-12.4H6.4L9.2 0Z"; // components/Wordmark.tsx, 12×20

/** The icon: the red bolt on an ink tile. `pad` is the share of the tile kept clear around the bolt. */
function iconSvg(size: number, { pad = 0.2, round = 0.22 } = {}): string {
  const inner = size * (1 - 2 * pad);
  const scale = inner / 20;
  const x = (size - 12 * scale) / 2, y = (size - 20 * scale) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">` +
    `<rect width="${size}" height="${size}" rx="${size * round}" fill="${INK}"/>` +
    `<path d="${BOLT}" fill="${ACCENT_ON_INK}" transform="translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${scale.toFixed(4)})"/></svg>`;
}

/** An .ico holding PNG images (supported by every browser that still asks for favicon.ico). */
function ico(pngs: { size: number; data: Buffer }[]): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  const entries: Buffer[] = [];
  let offset = 6 + 16 * pngs.length;
  for (const { size, data } of pngs) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt8(0, 2);
    e.writeUInt8(0, 3);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += data.length;
    entries.push(e);
  }
  return Buffer.concat([header, ...entries, ...pngs.map((p) => p.data)]);
}

function shareHtml(): string {
  // A real tab from the engine: the key of G chorus (brief §4's lifted path), first two bars.
  const chorus = renderSection("chorus", { key: "G", feel: "fast-punk", progressionId: "I-V-vi-IV", seed: 0 });
  const tab = tabText(chorus.tab.slice(0, 1)).split("\n").filter((l) => l.trim());
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  return `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Space+Mono:wght@400;700&display=block" rel="stylesheet">
<style>
  * { margin:0; box-sizing:border-box; }
  body { width:1200px; height:630px; background:${INK}; color:${PAPER}; font-family:"Space Mono", monospace; position:relative; overflow:hidden; }
  .dots { position:absolute; inset:0; background-image:radial-gradient(circle, rgba(246,241,228,.07) 1.4px, transparent 1.9px); background-size:12px 12px; }
  .wrap { position:absolute; inset:64px 72px; display:flex; flex-direction:column; }
  .kicker { color:${ACCENT_ON_INK}; font-size:22px; letter-spacing:.16em; }
  .mark { font-family:"Archivo Black", sans-serif; font-size:124px; line-height:1; letter-spacing:-.01em; margin-top:18px; display:flex; align-items:center; }
  .mark svg { width:.6em; height:.9em; margin:0 .04em; }
  .tag { font-size:27px; line-height:1.45; color:${PAPER}; margin-top:26px; max-width:410px; }
  .tab { position:absolute; right:72px; bottom:118px; background:${BOARD_CELL}; border-radius:14px; padding:22px 26px; font-size:17px; line-height:1.45; white-space:pre; color:${PAPER}; }
  .tab .chord { color:${ACCENT_ON_INK}; font-weight:700; }
  .tab .muted { color:${MUTED_ON_INK}; }
  .foot { position:absolute; left:72px; right:72px; bottom:56px; display:flex; justify-content:space-between; font-size:20px; color:${MUTED_ON_INK}; letter-spacing:.08em; }
  .bar { position:absolute; left:0; right:0; bottom:0; height:12px; background:${ACCENT}; }
</style></head><body>
<div class="dots"></div>
<div class="wrap">
  <div class="kicker">POP-PUNK SONGWRITING ENGINE</div>
  <div class="mark">PALM<svg viewBox="0 0 12 20"><path d="${BOLT}" fill="${ACCENT_ON_INK}"/></svg>MUTE</div>
  <div class="tag">Power-chord songs, intro melodies and solos, in any key.</div>
</div>
<div class="tab">${tab.map((l, i) => (i === 0 ? `<span class="chord">${esc(l)}</span>` : i < 3 ? `<span class="muted">${esc(l)}</span>` : esc(l))).join("\n")}</div>
<div class="foot"><span>E STANDARD · 12 KEYS · REAL TABS</span><span>palmmute.netlify.app</span></div>
<div class="bar"></div>
</body></html>`;
}

async function main() {
  const root = process.cwd();
  mkdirSync(join(root, "public/icons"), { recursive: true });
  writeFileSync(join(root, "app/icon.svg"), iconSvg(64) + "\n");

  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  const png = async (svg: string, size: number) => {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
    return page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  };
  writeFileSync(join(root, "app/favicon.ico"), ico(await Promise.all([16, 32, 48].map(async (s) => ({ size: s, data: await png(iconSvg(s, { pad: 0.14 }), s) })))));
  // iOS rounds the corners itself: a square, full-bleed tile.
  writeFileSync(join(root, "app/apple-icon.png"), await png(iconSvg(180, { round: 0 }), 180));
  writeFileSync(join(root, "public/icons/icon-192.png"), await png(iconSvg(192), 192));
  writeFileSync(join(root, "public/icons/icon-512.png"), await png(iconSvg(512), 512));
  // Maskable: full-bleed, with the bolt inside the 80% safe zone.
  writeFileSync(join(root, "public/icons/icon-maskable-512.png"), await png(iconSvg(512, { pad: 0.28, round: 0 }), 512));

  await page.setViewportSize({ width: 1200, height: 630 });
  await page.setContent(shareHtml(), { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  const share = await page.screenshot({ clip: { x: 0, y: 0, width: 1200, height: 630 } });
  writeFileSync(join(root, "app/opengraph-image.png"), share);
  writeFileSync(join(root, "app/twitter-image.png"), share);
  await browser.close();
  console.log("Wrote app/icon.svg, app/favicon.ico, app/apple-icon.png, public/icons/*, app/opengraph-image.png, app/twitter-image.png");
}

void main();
