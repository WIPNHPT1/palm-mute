import type { TabLineGroup } from "@/lib/fretboard";

// SVG units: 12px monospace, each character exactly 0.6em wide (textLength pins it, so columns can't
// drift whatever the font's real advance is). The SVG is drawn at 12px and shrinks to fit its card,
// so a tab never scrolls sideways; wide tabs get smaller text rather than a scrollbar.
const FONT = 12;
const ADVANCE = FONT * 0.6;
const LINE = FONT * 1.4;
const GROUP_GAP = FONT * 0.8;

/**
 * Bar-by-bar tab (lib/fretboard.ts renderTab), 2 bars per line. The tab art is hidden from screen
 * readers, which read `spoken` (chord and note names) instead of rows of dashes.
 */
export function TabBlock({ groups, spoken }: { groups: TabLineGroup[]; spoken: string }) {
  const rows: { text: string; kind: "chords" | "header" | "string"; y: number }[] = [];
  let y = FONT;
  groups.forEach((g, gi) => {
    if (gi > 0) y += GROUP_GAP;
    g.header.forEach((text, hi) => {
      rows.push({ text, kind: hi === 0 && /[A-G]#?5/.test(text) ? "chords" : "header", y });
      y += LINE;
    });
    g.strings.forEach((text) => {
      rows.push({ text, kind: "string", y });
      y += LINE;
    });
  });
  const chars = Math.max(...rows.map((r) => r.text.length));
  const width = Math.ceil(chars * ADVANCE);
  const height = Math.ceil(y - LINE + FONT * 0.45);

  return (
    <div className="rounded-[5px] bg-paper p-[9px]">
      <svg
        aria-hidden="true"
        data-tab
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        className="block h-auto max-w-full font-mono"
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
