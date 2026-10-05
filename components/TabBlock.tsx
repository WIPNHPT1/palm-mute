import type { ReactNode } from "react";
import type { TabLineGroup } from "@/lib/fretboard";

// SVG units: 12px monospace, each character exactly 0.6em wide (textLength pins it, so columns can't
// drift whatever the font's real advance is). The SVG is drawn at 12px and shrinks to fit its card,
// so a tab never scrolls sideways; wide tabs get smaller text rather than a scrollbar.
const FONT = 12;
const ADVANCE = FONT * 0.6;
const LINE = FONT * 1.4;
const GROUP_GAP = FONT * 0.8;
/** Songbook extras: a row of bar numbers over each line, and a band of rhythm stems under it. */
const NUMBER_ROW = 11;
const STEM_BAND = 20;

type RowKind = "chords" | "articulation" | "accents";

/** Which header row this is: chord names, P.M./let ring/N.C., or accent marks. */
export function headerKind(text: string): RowKind {
  if (/P\.M\.|let ring|N\.C\./.test(text)) return "articulation";
  if (/^[\s>]*$/.test(text)) return "accents";
  return "chords";
}

/** Width of a tab in characters (its longest row): cards share the widest so their text matches. */
export function tabChars(groups: TabLineGroup[]): number {
  return Math.max(0, ...groups.flatMap((g) => [...g.header, ...g.strings].map((r) => r.length)));
}

/**
 * Rhythm stems for one bar, songbook style: a stem under every attack, eighths beamed in pairs within a beat
 * (sixteenths in fours, with a second beam between neighbouring sixteenths), a flag on a lone short note, and
 * a plain stem for anything a quarter or longer.
 */
function stems(cells: (number | null)[], cols: number[], top: number): ReactNode[] {
  const out: ReactNode[] = [];
  const bottom = top + STEM_BAND - 6;
  const x = (i: number) => (cols[i] + 0.5) * ADVANCE;
  const perBeat = cells.length / 4; // 2 cells a beat in an 8-cell bar, 4 in a 16-cell bar
  // "Short" = shorter than a quarter note: beamed or flagged.
  const short = (i: number) => cells[i] !== null && cells[i]! < perBeat;
  cells.forEach((len, i) => {
    if (len === null) return;
    out.push(<line key={`s${i}`} x1={x(i)} y1={top} x2={x(i)} y2={bottom} strokeWidth={1.1} className="stroke-text-secondary" />);
  });
  for (let beat = 0; beat < 4; beat++) {
    const inBeat = Array.from({ length: perBeat }, (_, k) => beat * perBeat + k).filter(short);
    if (inBeat.length >= 2) {
      const [a, b] = [inBeat[0], inBeat[inBeat.length - 1]];
      out.push(<line key={`b${beat}`} x1={x(a) - 0.55} y1={bottom - 1.5} x2={x(b) + 0.55} y2={bottom - 1.5} strokeWidth={3} className="stroke-text-secondary" />);
      // Sixteenths: a second beam between neighbours that are both a sixteenth long.
      if (perBeat === 4)
        for (let k = 0; k + 1 < inBeat.length; k++)
          if (inBeat[k + 1] === inBeat[k] + 1 && cells[inBeat[k]] === 1 && cells[inBeat[k + 1]] === 1)
            out.push(<line key={`b2${beat}-${k}`} x1={x(inBeat[k]) - 0.55} y1={bottom - 5.5} x2={x(inBeat[k + 1]) + 0.55} y2={bottom - 5.5} strokeWidth={2.5} className="stroke-text-secondary" />);
    } else if (inBeat.length === 1) {
      const i = inBeat[0];
      out.push(<path key={`f${i}`} d={`M${x(i)} ${bottom} q 5 -3 5 -8`} fill="none" strokeWidth={1.1} className="stroke-text-secondary" />);
    }
  }
  return out;
}

/**
 * Bar-by-bar tab (lib/fretboard.ts renderTab). The tab art is hidden from screen readers, which read
 * `spoken` (chord and note names) instead of rows of dashes.
 *
 * In a row of cards, pass the same `chars` (the widest tab in the row) and `alignRows`: every tab then
 * draws at one scale and keeps a slot for each header row, so chord names and strings line up across
 * the cards.
 *
 * `rhythm` (each bar's attacks, cell by cell: how long, or null) turns on the songbook marks: bar numbers
 * over each line (from `firstBar`), rhythm stems under the strings, and repeat dots with "×N" when the
 * section plays `repeat` times. They need the tab's layout (renderTab records it).
 */
export function TabBlock({
  groups,
  spoken,
  chars,
  alignRows = false,
  rhythm,
  firstBar = 1,
  repeat = 1,
  complete = true,
  nowBar,
  className = "",
  svgClassName = "",
}: {
  groups: TabLineGroup[];
  spoken: string;
  chars?: number;
  alignRows?: boolean;
  rhythm?: (number | null)[][];
  firstBar?: number;
  repeat?: number;
  /** false when only the first lines show: the closing repeat marks belong to the tab's real end. */
  complete?: boolean;
  /** The bar sounding now (0-based within this tab), highlighted while it plays. */
  nowBar?: number | null;
  className?: string;
  /** Extra classes for the drawing (e.g. a max width, so a double-width card keeps the row's scale). */
  svgClassName?: string;
}) {
  const songbook = !!rhythm && groups.every((g) => g.layout);
  const rows: { text: string; kind: "chords" | "header" | "string"; y: number }[] = [];
  const extras: ReactNode[] = [];
  const behind: ReactNode[] = [];
  let y = FONT;
  let bar = firstBar - 1;
  const last = groups.length - 1;
  groups.forEach((g, gi) => {
    if (gi > 0) y += GROUP_GAP;
    const groupTop = y - FONT;
    if (songbook) {
      // Bar numbers over each bar line.
      g.layout!.forEach((b, k) => {
        extras.push(
          <text key={`n${gi}-${k}`} x={(b.cells[0] - 1) * ADVANCE} y={y - 2} fontSize={9} data-row="number" className="fill-text-faint">
            {bar + k + 1}
          </text>,
        );
      });
      if (gi === last && complete && repeat > 1) {
        const end = g.layout![g.layout!.length - 1].end;
        extras.push(
          <text key="times" x={(end + 1) * ADVANCE} y={y - 2} fontSize={10} textAnchor="end" data-row="repeat" className="fill-accent font-bold">
            ×{repeat}
          </text>,
        );
      }
      y += NUMBER_ROW;
    }
    const header = alignRows
      ? (["chords", "articulation", "accents"] as RowKind[]).map((kind) => g.header.find((h) => headerKind(h) === kind) ?? "")
      : g.header;
    header.forEach((text) => {
      if (text) rows.push({ text, kind: headerKind(text) === "chords" ? "chords" : "header", y });
      y += LINE;
    });
    const firstString = y;
    g.strings.forEach((text) => {
      rows.push({ text, kind: "string", y });
      y += LINE;
    });
    if (songbook) {
      const lineY = (k: number) => firstString + k * LINE - FONT * 0.33; // the dashes' centre line
      // Repeat dots: inside the opening bar line of the first bar, and the closing one of the last.
      if (repeat > 1) {
        const dot = (x: number, key: string) =>
          [2.5, 3.5].map((k) => <circle key={`${key}${k}`} cx={x} cy={(lineY(Math.floor(k)) + lineY(Math.ceil(k))) / 2} r={1.7} className="fill-text-primary" />);
        if (gi === 0) extras.push(...dot((g.layout![0].cells[0] - 1) * ADVANCE + ADVANCE * 1.05, "rs"));
        if (gi === last && complete) extras.push(...dot(g.layout![g.layout!.length - 1].end * ADVANCE - ADVANCE * 0.05, "re"));
      }
      const top = y - LINE + FONT * 0.3;
      g.layout!.forEach((b, k) => {
        const cells = rhythm![bar + k - (firstBar - 1)];
        if (cells) extras.push(<g key={`st${gi}-${k}`}>{stems(cells, b.cells, top)}</g>);
      });
      // The cursor: the bar sounding now, from its opening bar line to its closing one.
      const k = nowBar !== null && nowBar !== undefined ? nowBar - (bar - (firstBar - 1)) : -1;
      if (k >= 0 && k < g.layout!.length) {
        const b = g.layout![k];
        const x0 = (b.cells[0] - 1) * ADVANCE;
        behind.push(<rect key={`now${gi}`} data-now={nowBar} x={x0} y={groupTop} width={(b.end - b.cells[0] + 1) * ADVANCE} height={y + STEM_BAND - groupTop - FONT * 0.6} rx={3} className="fill-accent/15" />);
      }
      bar += g.layout!.length;
      y += STEM_BAND;
    }
  });
  const width = Math.ceil(Math.max(chars ?? 0, tabChars(groups)) * ADVANCE);
  const height = Math.ceil(y - LINE + FONT * 0.45);

  return (
    // Phones: the tab takes some of the card's padding, so it can be drawn a little larger.
    <div className={`glass-well -mx-[8px] rounded-[5px] bg-paper p-[6px] tablet:mx-0 tablet:p-[9px] desktop:p-[6px] ${className}`}>
      <svg
        aria-hidden="true"
        data-tab
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        // drawn in design pixels, so it's 10% smaller from 1440px like the rest of the page
        style={{ width: `calc(${width} * var(--u))` }}
        className={`block h-auto max-w-full font-mono ${svgClassName}`}
      >
        {behind}
        {rows.map((r, i) => (
          <text
            key={i}
            x={0}
            y={r.y}
            fontSize={FONT}
            textLength={r.text.length * ADVANCE}
            lengthAdjust="spacingAndGlyphs"
            xmlSpace="preserve"
            data-row={r.kind}
            className={
              r.kind === "string" ? "fill-text-primary" : r.kind === "chords" ? "fill-accent font-bold" : "fill-text-muted"
            }
          >
            {r.text}
          </text>
        ))}
        {extras}
      </svg>
      <p className="sr-only">{spoken}</p>
    </div>
  );
}
