import type { TabLineGroup } from "@/lib/fretboard";

// SVG units: 12px monospace, each character exactly 0.6em wide (textLength pins it, so columns can't
// drift whatever the font's real advance is). The SVG is drawn at 12px and shrinks to fit its card,
// so a tab never scrolls sideways; wide tabs get smaller text rather than a scrollbar.
const FONT = 12;
const ADVANCE = FONT * 0.6;
const LINE = FONT * 1.4;
const GROUP_GAP = FONT * 0.8;

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
 * Bar-by-bar tab (lib/fretboard.ts renderTab), 2 bars per line. The tab art is hidden from screen
 * readers, which read `spoken` (chord and note names) instead of rows of dashes.
 *
 * In a row of cards, pass the same `chars` (the widest tab in the row) and `alignRows`: every tab then
 * draws at one scale and keeps a slot for each header row, so chord names and strings line up across
 * the cards.
 */
export function TabBlock({
  groups,
  spoken,
  chars,
  alignRows = false,
  className = "",
  svgClassName = "",
}: {
  groups: TabLineGroup[];
  spoken: string;
  chars?: number;
  alignRows?: boolean;
  className?: string;
  /** Extra classes for the drawing (e.g. a max width, so a double-width card keeps the row's scale). */
  svgClassName?: string;
}) {
  const rows: { text: string; kind: "chords" | "header" | "string"; y: number }[] = [];
  let y = FONT;
  groups.forEach((g, gi) => {
    if (gi > 0) y += GROUP_GAP;
    const header = alignRows
      ? (["chords", "articulation", "accents"] as RowKind[]).map((kind) => g.header.find((h) => headerKind(h) === kind) ?? "")
      : g.header;
    header.forEach((text) => {
      if (text) rows.push({ text, kind: headerKind(text) === "chords" ? "chords" : "header", y });
      y += LINE;
    });
    g.strings.forEach((text) => {
      rows.push({ text, kind: "string", y });
      y += LINE;
    });
  });
  const width = Math.ceil(Math.max(chars ?? 0, tabChars(groups)) * ADVANCE);
  const height = Math.ceil(y - LINE + FONT * 0.45);

  return (
    // Phones: the tab takes some of the card's padding, so it can be drawn a little larger.
    <div className={`-mx-[8px] rounded-[5px] bg-paper p-[6px] tablet:mx-0 tablet:p-[9px] desktop:p-[6px] ${className}`}>
      <svg
        aria-hidden="true"
        data-tab
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        className={`block h-auto max-w-full font-mono ${svgClassName}`}
      >
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
      </svg>
      <p className="sr-only">{spoken}</p>
    </div>
  );
}
