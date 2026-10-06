// Renders Palm/Mute's icons and share images with Playwright's Chromium (a dev dependency):
// `npm run build:brand`. The art (the studio, the ember-gradient bolt, the glass card) is in scripts/brand-art.ts.
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
import { iconSvg, studioHtml } from "./brand-art";

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

/** The share image: the studio, the gradient bolt, and a glass card with the Verse the home page shows (A, Fast Punk). */
function shareHtml(): string {
  const verse = renderSection("verse", { key: "A", feel: "fast-punk", progressionId: "I-V-vi-IV", seed: 1 });
  const tab = tabText(verse.tab.slice(0, 1)).split("\n").filter((l) => l.trim());
  return studioHtml({
    width: 1200, height: 630, tab, mark: 84,
    card: "<i>01</i><b>Verse 1</b><span>KEY OF A · FAST PUNK · ×2</span>",
    copy: "Songwriting formulas from the bands that built pop-punk. Pick a key and a feel; get the whole song.",
    foot: "E STANDARD · 12 KEYS · REAL TABS", url: "palmmute.ai",
  });
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
  writeFileSync(join(root, "app/favicon.ico"), ico(await Promise.all([16, 32, 48].map(async (s) => ({ size: s, data: await png(iconSvg(s, { pad: 0.14, small: s < 48 }), s) })))));
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
