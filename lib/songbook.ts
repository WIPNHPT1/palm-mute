// The PDF songbook's layout (docs/song-builder-prd.md B8, §8): the song as pages of drawing operations in
// millimetres. A cover (title on a split-flap board, the song's facts, its running order), a chart (every chord
// shape as a box, the form with bar numbers and times, each section's plan), then every section in full as a
// songbook tab (bar numbers, rhythm stems, repeat marks) with its chords, and a legend for lead techniques.
// Pure and deterministic: lib/pdf.ts draws it with jsPDF, and verify checks the layout itself (everything on
// the page, nothing overlapping, every bar of every section present). Brand colours are the light tokens.
import type { TabLineGroup } from "@/lib/fretboard";
import { type RenderedSection, SECTION_IDS, type SectionId, chordLabel, rhythmOf, tabFor } from "@/lib/generator";
import type { Degree } from "@/lib/musicTheory";
import type { Song } from "@/lib/song";
import { barSeconds, formatLength } from "@/lib/songLength";
import { formLabel } from "@/lib/songPlan";

export type Font = "mono" | "monoBold" | "display";
export type Color = [number, number, number];
/** Text width in mm for a font at a size in points (the renderer's own metrics). */
export type Measure = (text: string, font: Font, size: number) => number;

export type Op =
  | { kind: "rect"; x: number; y: number; w: number; h: number; fill?: Color; stroke?: Color; lw?: number; r?: number }
  | { kind: "line"; x1: number; y1: number; x2: number; y2: number; color: Color; lw: number }
  | { kind: "circle"; x: number; y: number; r: number; fill?: Color; stroke?: Color; lw?: number }
  | { kind: "poly"; points: [number, number][]; fill: Color }
  /** Text at its baseline; `w` is its measured width (so verify can check it stays on the page). */
  | { kind: "text"; x: number; y: number; text: string; font: Font; size: number; color: Color; align?: "left" | "right" | "center"; w: number; role?: string };

export type Page = { ops: Op[]; cover?: boolean };
export type PaperSize = "a4" | "letter";
export type Songbook = { size: PaperSize; width: number; height: number; margin: number; pages: Page[]; title: string };

export const PAPER: Record<PaperSize, [number, number]> = { a4: [210, 297], letter: [215.9, 279.4] };

// Light tokens (tailwind.config.js palettes.light): the songbook prints on white, always light.
const INK: Color = [23, 19, 16];
const BOARD: Color = [15, 12, 10];
const BOARD_CELL: Color = [33, 27, 21];
const INK_SOFT: Color = [42, 36, 28];
const INK_MID: Color = [70, 59, 48];
const PAPER_TINT: Color = [246, 241, 228];
const ON_DARK: Color = [246, 241, 228];
const ON_DARK_FAINT: Color = [168, 156, 134];
const ACCENT: Color = [194, 58, 38];
const ACCENT_ON_INK: Color = [229, 87, 63];
const LINE: Color = [228, 218, 195];
const LINE_STRONG: Color = [220, 211, 190];
const TEXT: Color = [23, 19, 16];
const SECONDARY: Color = [78, 71, 56];
const MUTED: Color = [107, 97, 82];
const FAINT: Color = [114, 103, 90];

const PT = 0.3528; // mm per point
const MARGIN = 16;

export type SongbookInput = {
  song: Song;
  rendered: Record<SectionId, RenderedSection>;
  title: string;
  keyName: string;
  feel: string;
  bpm: number;
  progressionId: string;
  /** Each chord section's degrees bar by bar (for the chart's chord names with numerals). */
  degrees: Partial<Record<SectionId, Degree[]>>;
  /** e.g. "30 September 2026" (passed in, so the layout is deterministic). */
  date: string;
  size: PaperSize;
};

/** The lightning bolt from the wordmark (components/Wordmark.tsx), as a polygon at (x, y), `h` mm tall. */
function bolt(x: number, y: number, h: number, fill: Color): Op {
  const s = h / 20;
  const pts: [number, number][] = [[9.2, 0], [0.4, 12], [5.8, 12], [3.4, 20], [11.8, 7.6], [6.4, 7.6]];
  return { kind: "poly", points: pts.map(([px, py]) => [x + px * s, y + py * s]), fill };
}

/** A chord box: six strings (low E on the left), four frets from the lowest fretted one, dots, × and ○. */
function chordBox(x: number, y: number, w: number, notes: { string: string; fret: number }[], name: string, measure: Measure, degree?: string): { ops: Op[]; h: number } {
  const ops: Op[] = [];
  const strings = ["E", "A", "D", "G", "B", "e"];
  const gap = w / 5;
  const fretH = gap * 1.15;
  const top = y + 4.5;
  const fretted = notes.filter((n) => n.fret > 0).map((n) => n.fret);
  const base = fretted.length ? Math.min(...fretted) : 1;
  for (let i = 0; i < 6; i++) ops.push({ kind: "line", x1: x + i * gap, y1: top, x2: x + i * gap, y2: top + 4 * fretH, color: MUTED, lw: 0.15 });
  for (let j = 0; j <= 4; j++) ops.push({ kind: "line", x1: x, y1: top + j * fretH, x2: x + w, y2: top + j * fretH, color: MUTED, lw: j === 0 && base === 1 ? 0.7 : 0.15 });
  strings.forEach((s, i) => {
    const n = notes.find((v) => v.string === s);
    const cx = x + i * gap;
    if (!n) ops.push(text(cx, top - 1, "×", "mono", 6, FAINT, measure, "center"));
    else if (n.fret === 0) ops.push({ kind: "circle", x: cx, y: top - 2, r: 0.8, stroke: TEXT, lw: 0.2 });
    else ops.push({ kind: "circle", x: cx, y: top + (n.fret - base + 0.5) * fretH, r: gap * 0.38, fill: ACCENT });
  });
  if (base > 1) ops.push(text(x + w + 1, top + fretH * 0.5 + 1, String(base), "mono", 5.5, FAINT, measure));
  const nameY = top + 4 * fretH + 4;
  ops.push(text(x + w / 2, nameY, name, "monoBold", 7.5, TEXT, measure, "center"));
  if (degree) ops.push(text(x + w / 2, nameY + 3, degree, "mono", 6, FAINT, measure, "center"));
  return { ops, h: nameY + (degree ? 4 : 1) - y };
}

function text(x: number, y: number, s: string, font: Font, size: number, color: Color, measure: Measure, align: "left" | "right" | "center" = "left", role?: string): Op {
  return { kind: "text", x, y, text: s, font, size, color, align, w: measure(s, font, size), ...(role ? { role } : {}) };
}

/** Words that fit a width, line by line. */
function wrap(s: string, width: number, font: Font, size: number, measure: Measure): string[] {
  const out: string[] = [];
  let line = "";
  for (const word of s.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && measure(next, font, size) > width) {
      out.push(line);
      line = word;
    } else line = next;
  }
  if (line) out.push(line);
  return out;
}

/** The songbook for a song. */
export function layoutSongbook(input: SongbookInput, measure: Measure): Songbook {
  const [W, H] = PAPER[input.size];
  const content = W - 2 * MARGIN;
  const pages: Page[] = [];
  const { song, rendered } = input;
  const barSec = barSeconds(input.bpm);

  // Where each part starts, in bars and seconds.
  let at = 0;
  const parts = song.parts.map((p) => {
    const bars = p.section.bars.length * p.section.repeat * p.times;
    const part = { name: p.slot.name, section: p.slot.section, bars, times: p.times, start: at, variation: p.slot.variation };
    at += bars;
    return part;
  });

  // ---------------------------------------------------------------------------
  // Cover: full-bleed ink.
  {
    const ops: Op[] = [{ kind: "rect", x: 0, y: 0, w: W, h: H, fill: INK }];
    const y0 = MARGIN + 6;
    ops.push(text(MARGIN, y0, "PALM", "display", 15, ON_DARK, measure));
    const palmW = measure("PALM", "display", 15);
    ops.push(bolt(MARGIN + palmW + 0.6, y0 - 5.2, 5.8, ACCENT_ON_INK));
    ops.push(text(MARGIN + palmW + 5.2, y0, "MUTE", "display", 15, ON_DARK, measure));
    ops.push(text(W - MARGIN, y0, "SONGBOOK", "mono", 8.5, ACCENT_ON_INK, measure, "right"));

    // The title on a split-flap board: a cell per letter, words wrapped to the page.
    const size = 26;
    const cellW = 9.2;
    const cellH = 12;
    const gap = 1.1;
    const wordGap = 5;
    const words = input.title.toUpperCase().split(/\s+/);
    const rows: string[][] = [[]];
    let rowW = 0;
    for (const w of words) {
      const ww = w.length * (cellW + gap) - gap;
      if (rows[rows.length - 1].length && rowW + wordGap + ww > content - 8) {
        rows.push([]);
        rowW = 0;
      }
      rowW += (rows[rows.length - 1].length ? wordGap : 0) + ww;
      rows[rows.length - 1].push(w);
    }
    const boardTop = 70;
    const boardH = rows.length * (cellH + gap) + 7;
    ops.push({ kind: "rect", x: MARGIN, y: boardTop, w: content, h: boardH, fill: BOARD, r: 2 });
    rows.forEach((row, r) => {
      let x = MARGIN + 4;
      const y = boardTop + 3.5 + r * (cellH + gap);
      row.forEach((w, wi) => {
        if (wi) x += wordGap;
        for (const ch of w) {
          ops.push({ kind: "rect", x, y, w: cellW, h: cellH, fill: BOARD_CELL, r: 0.8 });
          ops.push({ kind: "line", x1: x, y1: y + cellH / 2, x2: x + cellW, y2: y + cellH / 2, color: BOARD, lw: 0.25 });
          ops.push(text(x + cellW / 2, y + cellH / 2 + (size * PT) / 2.9, ch, "display", size, ON_DARK, measure, "center", "title"));
          x += cellW + gap;
        }
        x -= gap;
      });
    });

    // The song's facts, two columns.
    const facts: [string, string][] = [
      ["KEY", input.keyName],
      ["FEEL", input.feel],
      ["TEMPO", `${input.bpm} BPM`],
      ["CHORDS", input.progressionId],
      ["LENGTH", `${formatLength(song.plan.seconds)} · ${song.plan.bars} bars`],
      ["FORM", formLabel(song.plan.form)],
    ];
    let fy = boardTop + boardH + 14;
    facts.forEach(([k, v], i) => {
      const col = i % 2;
      const x = MARGIN + col * (content / 2);
      if (col === 0 && i) fy += 12;
      ops.push(text(x, fy, k, "mono", 7.5, ON_DARK_FAINT, measure));
      ops.push(text(x, fy + 5.2, v, "monoBold", 11, ON_DARK, measure));
    });

    // The running order: a box per part, sized by its bars, wrapping.
    let oy = fy + 20;
    ops.push(text(MARGIN, oy, "RUNNING ORDER", "mono", 7.5, ACCENT_ON_INK, measure));
    oy += 3;
    // Boxes sized by bars (at least as wide as their words), packed into rows, each full row stretched to the page.
    const perRow = Math.max(24, song.plan.bars / 2.2);
    const boxH = 12;
    const boxes = parts.map((p) => {
      const words = Math.max(measure(p.name, "monoBold", 6.5), measure(`${formatLength(p.start * barSec)} · ${p.bars}`, "mono", 6)) + 5;
      return { p, w: Math.min(content, Math.max(words, (p.bars / perRow) * content)) };
    });
    const rowsOf: (typeof boxes)[] = [[]];
    let used = 0;
    for (const b of boxes) {
      if (rowsOf[rowsOf.length - 1].length && used + b.w > content + 0.01) {
        rowsOf.push([]);
        used = 0;
      }
      rowsOf[rowsOf.length - 1].push(b);
      used += b.w;
    }
    rowsOf.forEach((row, r) => {
      const sum = row.reduce((a, b) => a + b.w, 0);
      const stretch = r < rowsOf.length - 1 ? content / sum : 1;
      let ox = MARGIN;
      for (const { p, w } of row) {
        const bw = w * stretch;
        ops.push({ kind: "rect", x: ox, y: oy, w: bw - 1, h: boxH, fill: p.section === "chorus" ? INK_MID : INK_SOFT, r: 0.8 });
        ops.push(text(ox + 2, oy + 4.8, p.name, "monoBold", 6.5, ON_DARK, measure));
        ops.push(text(ox + 2, oy + 9.2, `${formatLength(p.start * barSec)} · ${p.bars}`, "mono", 6, ON_DARK_FAINT, measure));
        ox += bw;
      }
      oy += boxH + 1.5;
    });
    ops.push(text(MARGIN, H - MARGIN, `Made with Palm/Mute · ${input.date}`, "mono", 7, ON_DARK_FAINT, measure));
    ops.push(text(W - MARGIN, H - MARGIN, "Chord patterns only · no tabs stored", "mono", 7, ON_DARK_FAINT, measure, "right"));
    pages.push({ ops, cover: true });
  }

  // ---------------------------------------------------------------------------
  // Pages after the cover: a cursor that starts a new page when a block doesn't fit.
  const top = MARGIN + 8;
  const bottom = H - MARGIN - 6;
  let page: Page = { ops: [] };
  let y = top;
  const newPage = () => {
    page = { ops: [] };
    pages.push(page);
    y = top;
  };
  const room = (h: number) => {
    if (y + h > bottom) newPage();
  };
  newPage();

  // Chart: every chord shape, the form, each section's plan.
  page.ops.push(text(MARGIN, y + 6, "Chart", "display", 18, TEXT, measure, "left", "heading"));
  y += 14;
  const shapes = new Map<string, { name: string; notes: { string: string; fret: number }[]; degree?: string }>();
  for (const id of SECTION_IDS) {
    const s = rendered[id];
    s.voicings.forEach(({ chord, voicing }) => {
      const sig = `${chord.name}:${voicing.notes.map((n) => `${n.string}${n.fret}`).join("")}`;
      const bar = s.chords.findIndex((c) => c.root === chord.root);
      // Named as the app names it: an octave shape is "A oct", not a power chord.
      if (!shapes.has(sig)) shapes.set(sig, { name: chordLabel(chord, voicing), notes: voicing.notes, degree: input.degrees[id]?.[bar] });
    });
  }
  page.ops.push(text(MARGIN, y, "CHORD SHAPES", "mono", 7.5, ACCENT, measure));
  y += 3;
  const boxW = 13;
  const perLine = Math.floor((content + 6) / (boxW + 9));
  [...shapes.values()].forEach((shape, i) => {
    const col = i % perLine;
    if (col === 0 && i) y += 30;
    if (col === 0) room(30);
    const box = chordBox(MARGIN + 2 + col * (boxW + 9), y, boxW, shape.notes, shape.name, measure, shape.degree);
    page.ops.push(...box.ops);
  });
  y += 32;

  // The form: part, start, bars, and each bar's chords.
  room(14);
  page.ops.push(text(MARGIN, y, "FORM", "mono", 7.5, ACCENT, measure));
  y += 5;
  const cols = [MARGIN, MARGIN + 38, MARGIN + 54, MARGIN + 68];
  ["Part", "Starts", "Bars", "Chords"].forEach((h, i) => page.ops.push(text(cols[i], y, h.toUpperCase(), "mono", 6.5, FAINT, measure)));
  y += 2;
  parts.forEach((p, i) => {
    const s = song.parts[i].section;
    const chords = s.chords.map((c) => c.name).join(" ");
    const lines = wrap(chords + (p.times > 1 ? ` (×${p.times})` : ""), content - (cols[3] - MARGIN), "mono", 7.5, measure);
    room(4.6 * lines.length + 1.5);
    page.ops.push({ kind: "line", x1: MARGIN, y1: y, x2: MARGIN + content, y2: y, color: LINE, lw: 0.2 });
    y += 4.2;
    page.ops.push(text(cols[0], y, p.name + (p.variation === "keyUp" ? " (up a tone)" : ""), "monoBold", 7.5, TEXT, measure));
    page.ops.push(text(cols[1], y, formatLength(p.start * barSec), "mono", 7.5, SECONDARY, measure));
    page.ops.push(text(cols[2], y, String(p.bars), "mono", 7.5, SECONDARY, measure));
    lines.forEach((l, k) => page.ops.push(text(cols[3], y + k * 4.2, l, "mono", 7.5, SECONDARY, measure)));
    y += 4.2 * (lines.length - 1) + 1.3;
  });
  y += 8;

  // ---------------------------------------------------------------------------
  // Sections, each in full.
  SECTION_IDS.forEach((id, index) => {
    const s = rendered[id];
    const uses = parts.filter((p) => p.section === id);
    const where = uses.map((u) => `${u.name}${u.times > 1 ? ` ×${u.times}` : ""} ${formatLength(u.start * barSec)}`).join(" · ");
    const frets = s.frets[1] === 0 ? "open strings" : `frets ${s.frets[0] === 0 ? "open" : s.frets[0]}–${s.frets[1]}`;
    const detail = `${s.caption} · ${frets}${s.repeat > 1 ? ` · bars played ×${s.repeat}` : ""}`;
    const whereLines = wrap(`Plays at: ${where}`, content, "mono", 7, measure);
    // The heading block stays with the first tab line: at least 50 mm of room.
    room(50);
    page.ops.push({ kind: "line", x1: MARGIN, y1: y, x2: MARGIN + content, y2: y, color: LINE_STRONG, lw: 0.3 });
    y += 7;
    page.ops.push(text(MARGIN, y, String(index + 1).padStart(2, "0"), "monoBold", 11, FAINT, measure));
    page.ops.push(text(MARGIN + 9, y, s.label, "display", 15, TEXT, measure, "left", `section:${id}`));
    page.ops.push(text(MARGIN + content, y, `${s.bars.length * s.repeat} bars`, "mono", 8, MUTED, measure, "right"));
    y += 5.2;
    for (const l of wrap(detail, content, "mono", 7.5, measure)) {
      page.ops.push(text(MARGIN, y, l, "mono", 7.5, SECONDARY, measure));
      y += 3.8;
    }
    for (const l of whereLines) {
      page.ops.push(text(MARGIN, y, l, "mono", 7, FAINT, measure));
      y += 3.6;
    }
    y += 2;
    // Its chords as boxes.
    if (s.voicings.length) {
      s.voicings.forEach(({ chord, voicing }, i) => {
        const bar = s.chords.findIndex((c) => c.root === chord.root);
        page.ops.push(...chordBox(MARGIN + 2 + i * 20, y, 11, voicing.notes, chordLabel(chord, voicing), measure, input.degrees[id]?.[bar]).ops);
      });
      y += 27;
    }
    // The tab: 4 bars a line (a 16th-note bar counts as two), shrunk only if a line is wider than the page.
    const groups = tabFor(s, 4);
    const widest = Math.max(...groups.map((g) => g.strings[0].length));
    let size = 7.6;
    while (measure("0".repeat(widest), "mono", size) > content && size > 5) size -= 0.2;
    const lines = drawTab(groups, rhythmOf(s), s.repeat, size, measure);
    let firstBar = 1;
    lines.forEach((line) => {
      room(line.h + 1);
      page.ops.push(...line.ops(MARGIN, y, firstBar));
      firstBar += line.bars;
      y += line.h + 2.5;
    });
    // Lead lines: the techniques they use, in words.
    if (s.lead) {
      const marks = [
        ["b", "bend"],
        ["h", "hammer-on"],
        ["p", "pull-off"],
        ["/", "slide up"],
        ["\\", "slide down"],
        ["~", "vibrato"],
      ].filter(([m]) => groups.some((g) => g.strings.some((r) => r.slice(2).includes(m))));
      if (marks.length) {
        room(5);
        page.ops.push(text(MARGIN, y + 1, `Techniques: ${marks.map(([m, w]) => `${m} ${w}`).join(" · ")}`, "mono", 7, MUTED, measure));
        y += 5;
      }
    }
    y += 6;
  });

  // Header and footer on every page after the cover.
  const total = pages.length;
  pages.forEach((p, i) => {
    if (p.cover) return;
    const hy = MARGIN - 4;
    p.ops.unshift(
      text(MARGIN, hy, "PALM", "display", 8, TEXT, measure),
      bolt(MARGIN + measure("PALM", "display", 8) + 0.4, hy - 2.8, 3.1, ACCENT),
      text(MARGIN + measure("PALM", "display", 8) + 2.8, hy, "MUTE", "display", 8, TEXT, measure),
      text(MARGIN + content, hy, input.title, "mono", 7.5, MUTED, measure, "right"),
      { kind: "line", x1: MARGIN, y1: hy + 2.2, x2: MARGIN + content, y2: hy + 2.2, color: ACCENT, lw: 0.5 },
    );
    p.ops.push(text(MARGIN, H - MARGIN + 6, `${input.keyName} · ${input.feel} · ${input.bpm} BPM · ${input.progressionId}`, "mono", 6.5, FAINT, measure));
    p.ops.push(text(MARGIN + content, H - MARGIN + 6, `${i + 1} / ${total}`, "mono", 6.5, FAINT, measure, "right", "page"));
  });

  return { size: input.size, width: W, height: H, margin: MARGIN, pages, title: input.title };
}

/**
 * A section's tab as songbook lines, each placed later at (x, y): bar numbers, chord names, P.M./let ring and
 * accents, the six strings on a tinted panel, rhythm stems under them, and repeat marks. Returns each line's
 * height, how many bars it holds, and a function that writes its operations.
 */
function drawTab(groups: TabLineGroup[], rhythm: (number | null)[][], repeat: number, size: number, measure: Measure) {
  const adv = measure("0", "mono", size);
  const lineH = size * PT * 1.32;
  const last = groups.length - 1;
  let barIndex = 0;
  return groups.map((g, gi) => {
    const header = g.header.filter((h) => h.trim());
    const numbersH = 3;
    const stemsH = 4.2;
    const h = numbersH + (header.length + 6) * lineH + stemsH + 1.5;
    const firstIndex = barIndex;
    barIndex += g.layout!.length;
    const ops = (x: number, y: number, firstBar: number): Op[] => {
      const out: Op[] = [];
      const width = g.strings[0].length * adv;
      out.push({ kind: "rect", x: x - 1.5, y: y - 0.5, w: width + 3, h: h, fill: PAPER_TINT, r: 1 });
      // Bar numbers over each bar line.
      g.layout!.forEach((b, k) => out.push(text(x + (b.cells[0] - 1) * adv, y + 2.4, String(firstBar + k), "mono", 5.5, FAINT, measure, "left", "bar")));
      if (gi === last && repeat > 1) out.push(text(x + (g.layout![g.layout!.length - 1].end + 1) * adv, y + 2.4, `×${repeat}`, "monoBold", 6.5, ACCENT, measure, "right"));
      let ry = y + numbersH + lineH * 0.8;
      for (const row of header) {
        const chords = !/P\.M\.|let ring|N\.C\.|^[\s>]*$/.test(row);
        out.push(text(x, ry, row.replace(/\s+$/, ""), chords ? "monoBold" : "mono", size, chords ? ACCENT : MUTED, measure));
        ry += lineH;
      }
      const firstString = ry;
      g.strings.forEach((row) => {
        out.push(text(x, ry, row, "mono", size, TEXT, measure, "left", "string"));
        ry += lineH;
      });
      const centre = (k: number) => firstString + k * lineH - size * PT * 0.3;
      // Repeat dots inside the first and last bar lines.
      if (repeat > 1) {
        const dots = (dx: number) => [2.5, 3.5].map((k) => ({ kind: "circle" as const, x: dx, y: (centre(Math.floor(k)) + centre(Math.ceil(k))) / 2, r: 0.35, fill: TEXT }));
        if (gi === 0) out.push(...dots(x + (g.layout![0].cells[0] - 1) * adv + adv * 1.05));
        if (gi === last) out.push(...dots(x + g.layout![g.layout!.length - 1].end * adv - adv * 0.05));
      }
      // Rhythm stems: eighths beamed in a beat, sixteenths in fours, flags on a lone short note.
      const top = ry - lineH + 1.2;
      const bottomY = top + stemsH - 0.6;
      g.layout!.forEach((b, k) => {
        const cells = rhythm[firstIndex + k];
        if (!cells) return;
        const sx = (i: number) => x + (b.cells[i] + 0.5) * adv;
        const perBeat = cells.length / 4;
        const short = (i: number) => cells[i] !== null && cells[i]! < perBeat;
        cells.forEach((len, i) => {
          if (len !== null) out.push({ kind: "line", x1: sx(i), y1: top, x2: sx(i), y2: bottomY, color: SECONDARY, lw: 0.18 });
        });
        for (let beat = 0; beat < 4; beat++) {
          const inBeat = Array.from({ length: perBeat }, (_, q) => beat * perBeat + q).filter(short);
          if (inBeat.length >= 2) {
            out.push({ kind: "line", x1: sx(inBeat[0]), y1: bottomY, x2: sx(inBeat[inBeat.length - 1]), y2: bottomY, color: SECONDARY, lw: 0.5 });
            if (perBeat === 4)
              for (let q = 0; q + 1 < inBeat.length; q++)
                if (inBeat[q + 1] === inBeat[q] + 1 && cells[inBeat[q]] === 1 && cells[inBeat[q + 1]] === 1)
                  out.push({ kind: "line", x1: sx(inBeat[q]), y1: bottomY - 0.8, x2: sx(inBeat[q + 1]), y2: bottomY - 0.8, color: SECONDARY, lw: 0.4 });
          } else if (inBeat.length === 1) {
            const i = inBeat[0];
            out.push({ kind: "line", x1: sx(i), y1: bottomY, x2: sx(i) + 0.9, y2: bottomY - 1.3, color: SECONDARY, lw: 0.18 });
          }
        }
      });
      return out;
    };
    return { h, bars: g.layout!.length, ops };
  });
}
