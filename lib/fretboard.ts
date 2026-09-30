// Fretboard maths and bar-by-bar tab rendering, shared by the power-chord engine (lib/voicings.ts,
// lib/generator.ts) and the lead engine. Pure functions, no React.
import { type TabString, OPEN_STRING_MIDI, TAB_STRINGS, noteNameFor } from "@/lib/musicTheory";

export { OPEN_STRING_MIDI, TAB_STRINGS };
export type { TabString };

/** Strings low to high, the order shapes are written in. */
export const LOW_TO_HIGH: TabString[] = ["E", "A", "D", "G", "B", "e"];
export const CELLS_PER_BAR = 8;
/** Bars that need sixteenth notes (gallops, fills) have 16 cells; every other bar keeps 8 (DECISIONS.md, layout D). */
export const SIXTEENTHS_PER_BAR = 16;

export type Fretted = { string: TabString; fret: number };

export function midiOf(n: Fretted): number {
  return OPEN_STRING_MIDI[n.string] + n.fret;
}

export function pitchClass(midi: number): number {
  return ((midi % 12) + 12) % 12;
}

/** Fret span of a chord (open strings don't count: they need no finger). */
export function span(notes: Fretted[]): number {
  const fretted = notes.filter((n) => n.fret > 0).map((n) => n.fret);
  return fretted.length ? Math.max(...fretted) - Math.min(...fretted) : 0;
}

const STRING_NAMES: Record<TabString, string> = { E: "low E", A: "A", D: "D", G: "G", B: "B", e: "high e" };
const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"}`;

/** "E on the D string, 2nd fret" / "A on the A string, open". */
export function describeFretted(n: Fretted): string {
  return `${noteNameFor(midiOf(n))} on the ${STRING_NAMES[n.string]} string, ${n.fret === 0 ? "open" : `${ordinal(n.fret)} fret`}`;
}

/** "G on the low E string, 3rd fret, and D on the A string, 5th fret" (low to high). */
export function describeNotes(notes: Fretted[]): string {
  const sorted = [...notes].sort((a, b) => LOW_TO_HIGH.indexOf(a.string) - LOW_TO_HIGH.indexOf(b.string));
  const parts = sorted.map(describeFretted);
  return parts.length <= 2 ? parts.join(", and ") : `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

// ---------------------------------------------------------------------------
// Tabs

/** One eighth-note cell. `frets` are what's written on each string ("x" = dead/muted); empty = a dash. */
export type TabCell = {
  frets: Partial<Record<TabString, string>>;
  accent?: boolean;
};

export type TabBar = {
  cells: TabCell[];
  /** Shown above the bar's first cell (chord name). */
  label?: string;
  /** Articulation span for the whole bar. */
  articulation?: "pm" | "ring";
  /** Full-band stop: "N.C." is written above this cell. */
  stopAt?: number;
};

export type TabLineGroup = {
  /** Header rows (chord names, articulation, accents), each the same length as the string rows. */
  header: string[];
  /** String rows, high e first, e.g. "e|----|----|". */
  strings: string[];
  /** Where each bar of the line sits, in character columns (for rhythm stems and bar numbers drawn over the tab). */
  layout?: TabBarLayout[];
};

/** A bar within a tab line: the column each cell starts at, and the column of its closing bar line. */
export type TabBarLayout = { cells: number[]; end: number };

const PREFIX = 2; // "e|"

/**
 * Renders bars as ASCII tab, `barsPerLine` bars to a line. Each cell is as wide as its widest fret
 * plus one dash, so two-digit frets stay aligned. Articulation spans ("P.M.----|", "let ring--|")
 * are merged across consecutive bars on a line; accents get their own row when the tab has any.
 */
export function renderTab(bars: TabBar[], barsPerLine = 2): TabLineGroup[] {
  const anyAccent = bars.some((b) => b.cells.some((c) => c.accent));
  const anyLabel = bars.some((b) => b.label);
  const anyArt = bars.some((b) => b.articulation || b.stopAt !== undefined);
  const groups: TabLineGroup[] = [];

  // Layout D (DECISIONS.md): a line holds `barsPerLine` eighth-note bars; a 16th-note bar is as wide as two, so
  // it takes two of them (on a 2-bar line it gets the line to itself), and its text stays as big.
  const weight = (bar: TabBar) => Math.max(1, bar.cells.length / CELLS_PER_BAR);
  const lines: TabBar[][] = [];
  for (let i = 0; i < bars.length; ) {
    const line = [bars[i++]];
    let used = weight(line[0]);
    while (i < bars.length && used + weight(bars[i]) <= barsPerLine) {
      used += weight(bars[i]);
      line.push(bars[i++]);
    }
    lines.push(line);
  }
  for (const line of lines) {
    const strings = TAB_STRINGS.map((s) => `${s}|`);
    let labels = " ".repeat(PREFIX);
    let accents = " ".repeat(PREFIX);
    // Articulation: one char per column, then turned into spans.
    const art: (string | null)[] = [];
    const nc: number[] = [];

    let col = PREFIX; // current column in every row
    const layout: TabBarLayout[] = [];
    for (const bar of line) {
      const barStart = col;
      const cols: number[] = [];
      bar.cells.forEach((cell, i) => {
        cols.push(col);
        const width = Math.max(1, ...Object.values(cell.frets).map((f) => f!.length)) + 1;
        TAB_STRINGS.forEach((s, k) => (strings[k] += (cell.frets[s] ?? "").padEnd(width, "-")));
        accents += (cell.accent ? ">" : "").padEnd(width, " ");
        const stopped = bar.stopAt !== undefined && i > bar.stopAt;
        if (bar.stopAt !== undefined && i === bar.stopAt + 1) nc.push(col);
        for (let w = 0; w < width; w++) art.push(stopped ? null : bar.articulation ?? null);
        labels += " ".repeat(width);
        col += width;
      });
      layout.push({ cells: cols, end: col });
      TAB_STRINGS.forEach((_, k) => (strings[k] += "|"));
      accents += " ";
      art.push("|");
      labels += " ";
      col += 1;
      if (bar.label) labels = labels.slice(0, barStart) + bar.label + labels.slice(barStart + bar.label.length);
    }

    // Articulation row: "P.M." / "let ring" at the start of each run, dashes to its end, "|" to close.
    let artRow = " ".repeat(PREFIX);
    for (let i = 0; i < art.length; ) {
      const kind = art[i];
      if (kind === null || kind === "|") {
        artRow += " ";
        i++;
        continue;
      }
      let j = i;
      while (j < art.length && (art[j] === kind || (art[j] === "|" && art[j + 1] === kind))) j++;
      const text = kind === "pm" ? "P.M." : "let ring";
      const width = j - i;
      artRow += width > text.length + 1 ? text + "-".repeat(width - text.length - 1) + "|" : text.slice(0, width).padEnd(width, " ");
      i = j;
    }
    for (const at of nc) artRow = artRow.slice(0, at) + "N.C." + artRow.slice(at + 4);
    artRow = artRow.slice(0, strings[0].length).padEnd(strings[0].length, " ");

    const header: string[] = [];
    if (anyLabel) header.push(labels.padEnd(strings[0].length, " "));
    if (anyArt) header.push(artRow);
    if (anyAccent) header.push(accents.padEnd(strings[0].length, " "));
    groups.push({ header, strings, layout });
  }
  return groups;
}

/** All rows of a rendered tab, as plain text (for copying, fixtures and the mock-up). */
export function tabText(groups: TabLineGroup[]): string {
  return groups.map((g) => [...g.header, ...g.strings].map((r) => r.trimEnd()).join("\n")).join("\n\n");
}
