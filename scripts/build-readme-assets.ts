// Builds the README's images from the real app: `npm run build:readme` (after `npm run build`).
//   docs/readme/hero.png             animated PNG: the bolt flips while a playhead sweeps a real engine tab
//   docs/readme/social-preview.png   1280×640 image for GitHub's repository social preview (upload in Settings)
//   docs/readme/*-light.jpg / *-dark.jpg   screenshots of the three pages, served from the static export
import { chromium, type Page } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tabText } from "@/lib/fretboard";
import { renderSection } from "@/lib/generator";

const OUT = join(process.cwd(), "docs/readme");
const PORT = 4323;
const INK = "#171310", PAPER = "#F6F1E4", ACCENT = "#E5573F", MUTED = "#A89C86", CELL = "#211B15", RED = "#C23A26";
const BOLT = "M9.2 0 .4 12h5.4L3.4 20l8.4-12.4H6.4L9.2 0Z";
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

// ---------------------------------------------------------------------------
// APNG: every frame is a same-size PNG screenshot; their IDAT data become the animation's frames.

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function chunks(png: Buffer): { type: string; data: Buffer }[] {
  const out: { type: string; data: Buffer }[] = [];
  for (let p = 8; p < png.length; ) {
    const len = png.readUInt32BE(p);
    out.push({ type: png.toString("ascii", p + 4, p + 8), data: png.subarray(p + 8, p + 8 + len) });
    p += 12 + len;
  }
  return out;
}
/**
 * Frame 0 is the full image; later frames are patches (x, y, png) drawn over it, so only what changes
 * (the playhead, the flipping bolt) is stored for each frame.
 */
type Frame = { png: Buffer; x: number; y: number };
function apng(frames: Frame[], delayMs: number[]): Buffer {
  const ihdr = chunks(frames[0].png).find((c) => c.type === "IHDR")!.data;
  const parts: Buffer[] = [frames[0].png.subarray(0, 8), chunk("IHDR", ihdr)];
  const actl = Buffer.alloc(8);
  actl.writeUInt32BE(frames.length, 0);
  actl.writeUInt32BE(0, 4); // loop forever
  parts.push(chunk("acTL", actl));
  let seq = 0;
  frames.forEach(({ png, x, y }, i) => {
    const hdr = chunks(png).find((c) => c.type === "IHDR")!.data;
    const fctl = Buffer.alloc(26);
    fctl.writeUInt32BE(seq++, 0);
    fctl.writeUInt32BE(hdr.readUInt32BE(0), 4);
    fctl.writeUInt32BE(hdr.readUInt32BE(4), 8);
    fctl.writeUInt32BE(x, 12);
    fctl.writeUInt32BE(y, 16);
    fctl.writeUInt16BE(delayMs[i], 20);
    fctl.writeUInt16BE(1000, 22);
    fctl.writeUInt8(0, 24); // dispose: none
    fctl.writeUInt8(0, 25); // blend: source
    parts.push(chunk("fcTL", fctl));
    for (const c of chunks(png).filter((c) => c.type === "IDAT")) {
      if (i === 0) parts.push(chunk("IDAT", c.data));
      else {
        const s = Buffer.alloc(4);
        s.writeUInt32BE(seq++);
        parts.push(chunk("fdAT", Buffer.concat([s, c.data])));
      }
    }
  });
  parts.push(chunk("IEND", Buffer.alloc(0)));
  return Buffer.concat(parts);
}

// ---------------------------------------------------------------------------

const FONTS = `<link href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Space+Mono:wght@400;700&display=block" rel="stylesheet">`;

function heroHtml(tabLines: string[], specs: string): string {
  return `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>
  * { margin:0; box-sizing:border-box; }
  body { width:1280px; height:440px; background:${INK}; color:${PAPER}; font-family:"Space Mono", monospace; position:relative; overflow:hidden; }
  .dots { position:absolute; inset:0; background-image:radial-gradient(circle, rgba(246,241,228,.07) 1.4px, transparent 1.9px); background-size:12px 12px; }
  .left { position:absolute; left:64px; top:54px; width:620px; }
  .kicker { color:${ACCENT}; font-size:17px; letter-spacing:.16em; }
  .mark { font-family:"Archivo Black", sans-serif; font-size:86px; line-height:1; margin-top:14px; display:flex; align-items:center; letter-spacing:-.01em; }
  .bolt { flex:none; display:inline-block; width:.6em; height:.9em; margin:0 .04em; perspective:200px; }
  .bolt svg { width:100%; height:100%; transform:rotateY(var(--flip)); }
  .tag { font-size:21px; line-height:1.5; margin-top:22px; }
  .specs { position:absolute; left:64px; bottom:48px; font-size:15px; letter-spacing:.1em; color:${MUTED}; }
  .specs b { color:${PAPER}; font-weight:700; }
  .tab { position:absolute; right:56px; top:64px; background:${CELL}; border-radius:14px; padding:20px 22px; font-size:15px; line-height:1.5; white-space:pre; }
  .tab .c { color:${ACCENT}; font-weight:700; } .tab .m { color:${MUTED}; }
  .head { position:absolute; top:14px; bottom:14px; width:2px; background:${ACCENT}; box-shadow:0 0 12px ${ACCENT}; left:var(--x); }
  .bar { position:absolute; left:0; right:0; bottom:0; height:10px; background:${RED}; }
</style></head><body>
<div class="left">
  <div class="kicker">POP-PUNK SONGWRITING ENGINE</div>
  <div class="mark">PALM<span class="bolt"><svg viewBox="0 0 12 20"><path d="${BOLT}" fill="${ACCENT}"/></svg></span>MUTE</div>
  <div class="tag">Pick a key and a feel. Get a whole song: real tabs, lifted choruses, intro melodies and guitar solos.</div>
</div>
<div class="specs">${specs}</div>
<div class="tab" id="tab">${tabLines.map((l, i) => (i === 0 ? `<span class="c">${esc(l)}</span>` : i < 3 ? `<span class="m">${esc(l)}</span>` : esc(l))).join("\n")}<div class="head"></div></div>
<div class="bar"></div>
</body></html>`;
}

function socialHtml(tabLines: string[], specs: string): string {
  return heroHtml(tabLines, specs)
    .replace("height:440px", "height:640px")
    .replace(".left { position:absolute; left:64px; top:54px;", ".left { position:absolute; left:72px; top:92px;")
    .replace("font-size:86px", "font-size:108px")
    .replace(".tab { position:absolute; right:56px; top:64px;", ".tab { position:absolute; right:64px; top:330px;")
    .replace(".specs { position:absolute; left:64px; bottom:48px;", ".specs { position:absolute; left:72px; top:400px; max-width:560px; line-height:1.9;");
}

async function screenshot(page: Page, path: string, file: string, theme: "light" | "dark", setup?: (p: Page) => Promise<void>) {
  await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
  await page.goto(`http://localhost:${PORT}${path}`);
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  if (setup) await setup(page);
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(OUT, `${file}-${theme}.jpg`), type: "jpeg", quality: 84, clip: { x: 0, y: 0, width: 1440, height: 1000 } });
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const chorus = renderSection("chorus", { key: "G", feel: "fast-punk", progressionId: "I-V-vi-IV", seed: 0 });
  const tab = tabText(chorus.tab.slice(0, 1)).split("\n").filter((l) => l.trim());
  const specs = "<b>12</b> KEYS · <b>6</b> PROGRESSIONS · <b>3</b> FEELS · <b>97,200</b> PROOFS PER BUILD";

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 440 } });

  // Hero: 32 frames on a flat background (dots don't compress across frames). The playhead sweeps the two bars; the bolt flips once per loop.
  await page.setContent(heroHtml(tab, specs), { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  const box = await page.locator("#tab").evaluate((el) => {
    const r = el.getBoundingClientRect();
    const ch = (r.width - 44) / Math.max(...el.textContent!.split("\n").map((l) => l.length));
    return { start: 22 + 2 * ch, end: r.width - 22 };
  });
  const FRAMES = 32;
  const rect = (sel: string) => page.locator(sel).evaluate((el) => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  const tabBox = await rect("#tab");
  const boltBox = await rect(".bolt");
  const frames: Frame[] = [];
  let prevX = box.start;
  let prevFlip = 0;
  for (let f = 0; f < FRAMES; f++) {
    const t = f / FRAMES;
    // Flip mid-loop, so the first frame (all that shows where animation is off) has the bolt face-on.
    const flip = t >= 0.5 && t < 0.72 ? ((t - 0.5) / 0.22) * 360 : 0;
    const x = box.start + t * (box.end - box.start);
    await page.evaluate(({ x, flip }) => {
      document.body.style.setProperty("--x", `${x}px`);
      document.body.style.setProperty("--flip", `${flip}deg`);
    }, { x, flip });
    if (f === 0) frames.push({ png: await page.screenshot({ clip: { x: 0, y: 0, width: 1280, height: 440 } }), x: 0, y: 0 });
    else {
      // The patch covers where the playhead was and is (the tab panel's height), plus the bolt when it moves.
      let x0 = tabBox.x + Math.min(prevX, x) - 16, x1 = tabBox.x + Math.max(prevX, x) + 16;
      let y0 = tabBox.y, y1 = tabBox.y + tabBox.h;
      if (flip !== prevFlip) {
        x0 = Math.min(x0, boltBox.x - 20); x1 = Math.max(x1, boltBox.x + boltBox.w + 20);
        y0 = Math.min(y0, boltBox.y - 10); y1 = Math.max(y1, boltBox.y + boltBox.h + 10);
      }
      if (f === FRAMES - 1) x1 = Math.max(x1, tabBox.x + tabBox.w); // tidy the end of the sweep
      const clip = { x: Math.floor(x0), y: Math.floor(y0), width: Math.ceil(x1 - x0), height: Math.ceil(y1 - y0) };
      frames.push({ png: await page.screenshot({ clip }), x: clip.x, y: clip.y });
    }
    prevX = x;
    prevFlip = flip;
  }
  writeFileSync(join(OUT, "hero.png"), apng(frames, frames.map(() => 90)));

  // Social preview (static).
  await page.setViewportSize({ width: 1280, height: 640 });
  await page.setContent(socialHtml(tab, specs), { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate((x) => document.body.style.setProperty("--x", `${x}px`), box.start + 0.4 * (box.end - box.start));
  writeFileSync(join(OUT, "social-preview.png"), await page.screenshot({ clip: { x: 0, y: 0, width: 1280, height: 640 } }));

  // Screenshots of the real pages, from the static export.
  const server = spawn(process.execPath, ["scripts/serve-static.mjs", "out"], { env: { ...process.env, PORT: String(PORT) }, stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 800));
  try {
    const shot = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    for (const theme of ["light", "dark"] as const) {
      await screenshot(shot, "/generator/", "generator", theme);
      await screenshot(shot, "/chords/", "chords", theme, async (p) => {
        await p.getByRole("radiogroup", { name: "Key" }).getByRole("radio", { name: "G", exact: true }).click();
        await p.locator('[data-progression="I-V-vi-IV"] > button').click();
        await p.getByRole("tab", { name: "Lead solo" }).click();
        await p.locator("#progression-panel").scrollIntoViewIfNeeded();
        await p.evaluate(() => window.scrollBy(0, -140));
      });
      await screenshot(shot, "/", "count-in", theme);
    }
  } finally {
    server.kill();
  }
  await browser.close();
  const kb = (f: string) => `${Math.round(readFileSync(join(OUT, f)).length / 1024)} KB`;
  console.log(`Wrote docs/readme: hero.png (${FRAMES} frames, ${kb("hero.png")}), social-preview.png (${kb("social-preview.png")}), 6 screenshots`);
}

void main();
