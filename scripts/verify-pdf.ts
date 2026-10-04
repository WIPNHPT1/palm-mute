// The PDF songbook (docs/song-builder-prd.md B8, §8): real PDFs, drawn with jsPDF and the embedded brand fonts,
// for songs across keys, feels, lengths, paper sizes and card options. The file: a PDF with every page, the
// three fonts embedded, the song's title. The layout: everything on its page and inside the margins, tab
// panels never overlapping each other or the footer, every section once, every bar of every section numbered
// in order, deterministic. Part of `npm run verify`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { jsPDF } from "jspdf";
import { type FeelId, type SectionInputs, FEEL_IDS, SECTION_IDS, type SectionId, getFeel, plannedDegrees, playbackBpm } from "@/lib/generator";
import type { NoteName } from "@/lib/musicTheory";
import { FONT_FILES, type FontFiles, renderSongbook } from "@/lib/pdf";
import { buildSong } from "@/lib/song";
import type { Op, PaperSize } from "@/lib/songbook";

const fonts = Object.fromEntries(Object.entries(FONT_FILES).map(([k, f]) => [k, readFileSync(`public/fonts/${f}`).toString("base64")])) as FontFiles;
const KEYS: NoteName[] = ["A", "C#", "F"];
const LENGTHS = [150, 330];
const SIZES: PaperSize[] = ["a4", "letter"];
const VARIANTS: { name: string; lead: (id: SectionId) => SectionInputs["lead"]; options: Partial<Record<SectionId, SectionInputs["options"]>> }[] = [
  { name: "own", lead: (id) => (id === "solo" ? { style: "classic", bars: 8 } : null), options: {} },
  { name: "16-bar shred solo, intro melody, chorus tag", lead: (id) => (id === "solo" ? { style: "shred", bars: 16 } : id === "intro" ? { style: "hook", bars: 8 } : null), options: { ending: { groove: "Chorus tag" }, chorus: { keyUp: true } } },
];
const TITLE = "Your Ex's New Place";
let books = 0;
let pages = 0;

const opBox = (op: Op): [number, number, number, number] => {
  switch (op.kind) {
    case "rect":
      return [op.x, op.y, op.x + op.w, op.y + op.h];
    case "line":
      return [Math.min(op.x1, op.x2), Math.min(op.y1, op.y2), Math.max(op.x1, op.x2), Math.max(op.y1, op.y2)];
    case "circle":
      return [op.x - op.r, op.y - op.r, op.x + op.r, op.y + op.r];
    case "poly":
      return [Math.min(...op.points.map((p) => p[0])), Math.min(...op.points.map((p) => p[1])), Math.max(...op.points.map((p) => p[0])), Math.max(...op.points.map((p) => p[1]))];
    case "text": {
      const left = op.align === "right" ? op.x - op.w : op.align === "center" ? op.x - op.w / 2 : op.x;
      return [left, op.y - op.size * 0.3528 * 0.8, left + op.w, op.y];
    }
  }
};

for (const key of KEYS)
  for (const feel of FEEL_IDS as FeelId[])
    for (const lengthSec of LENGTHS)
      for (const size of SIZES)
        for (const v of VARIANTS) {
          const where = `${key} ${feel} ${lengthSec}s ${size} ${v.name}`;
          const inputs = Object.fromEntries(SECTION_IDS.map((id) => [id, { key, feel, progressionId: "I-V-vi-IV", seed: 0, lead: v.lead(id), options: v.options[id] }])) as Record<SectionId, SectionInputs>;
          const bpm = playbackBpm(feel);
          const song = buildSong(inputs, lengthSec, bpm);
          const degrees = Object.fromEntries(SECTION_IDS.flatMap((id) => (id === "solo" || song.rendered[id].lead ? [] : [[id, plannedDegrees(id, "I-V-vi-IV", song.rendered[id].groove)]])));
          const input = { song, rendered: song.rendered, title: TITLE, keyName: key, feel: getFeel(feel).label, bpm, progressionId: "I-V-vi-IV", degrees, date: "30 September 2026", size };
          const { bytes, book } = renderSongbook(jsPDF, fonts, input);
          books++;
          pages += book.pages.length;

          // The file.
          const pdf = Buffer.from(bytes).toString("latin1");
          assert.ok(pdf.startsWith("%PDF-"), `${where}: not a PDF`);
          assert.equal((pdf.match(/\/Type \/Page[^s]/g) ?? []).length, book.pages.length, `${where}: page count`);
          assert.ok((pdf.match(/\/FontFile2/g) ?? []).length >= 3, `${where}: fonts not embedded`);
          assert.ok(pdf.includes(`/Title (${TITLE}`), `${where}: no title in the document info`);

          // The layout: deterministic, on the page, inside the margins.
          assert.equal(JSON.stringify(renderSongbook(jsPDF, fonts, input).book), JSON.stringify(book), `${where}: layout not deterministic`);
          const { width: W, height: H, margin: M } = book;
          book.pages.forEach((page, p) => {
            for (const op of page.ops) {
              const [x0, y0, x1, y1] = opBox(op);
              assert.ok(x0 >= -0.01 && y0 >= -0.01 && x1 <= W + 0.01 && y1 <= H + 0.01, `${where}: page ${p + 1} ${op.kind} off the page`);
              if (!page.cover && op.kind === "text") assert.ok(x0 >= M - 2 && x1 <= W - M + 2, `${where}: page ${p + 1} text "${op.text.slice(0, 30)}" outside the margins (${x0.toFixed(1)}–${x1.toFixed(1)})`);
            }
            // Tab panels (the tinted rectangles) never overlap each other or run into the footer.
            const panels = page.ops.filter((o): o is Extract<Op, { kind: "rect" }> => o.kind === "rect" && !page.cover && !!o.fill && o.fill.join() === "246,241,228");
            panels.forEach((a, i) => {
              assert.ok(a.y + a.h <= H - M, `${where}: page ${p + 1} tab panel runs into the footer`);
              panels.slice(i + 1).forEach((b) => assert.ok(a.y + a.h <= b.y + 0.01 || b.y + b.h <= a.y + 0.01, `${where}: page ${p + 1} tab panels overlap`));
            });
            if (!page.cover) assert.ok(page.ops.some((o) => o.kind === "text" && o.role === "page" && o.text === `${p + 1} / ${book.pages.length}`), `${where}: page number`);
          });
          // Every section once, in order, with every bar numbered 1…n (its whole tab, nothing cut).
          const all = book.pages.flatMap((pg) => pg.ops).filter((o): o is Extract<Op, { kind: "text" }> => o.kind === "text");
          const heads = all.map((o, i) => ({ o, i })).filter(({ o }) => o.role?.startsWith("section:"));
          assert.deepEqual(heads.map(({ o }) => o.role), SECTION_IDS.map((id) => `section:${id}`), `${where}: sections`);
          heads.forEach(({ o, i }, k) => {
            const id = o.role!.slice(8) as SectionId;
            const s = song.rendered[id];
            const bars = s.lead ? s.lead.chords.length : s.bars.length;
            const end = k + 1 < heads.length ? heads[k + 1].i : all.length;
            const numbers = all.slice(i, end).filter((t) => t.role === "bar").map((t) => Number(t.text));
            assert.deepEqual(numbers, Array.from({ length: bars }, (_, b) => b + 1), `${where}: ${id} bar numbers`);
            const strings = all.slice(i, end).filter((t) => t.role === "string").length;
            assert.equal(strings % 6, 0, `${where}: ${id} string rows`);
          });
        }

console.log(`PDF songbook: ${books} songbooks, ${pages} pages (${KEYS.length} keys × ${FEEL_IDS.length} feels × ${LENGTHS.length} lengths × ${SIZES.length} paper sizes × ${VARIANTS.length} option sets): fonts embedded, every page on the paper, nothing outside the margins or overlapping, every section and bar present.`);
console.log("\nAll PDF checks passed.");
