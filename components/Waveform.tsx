// The little 4-bar "waveform" glyph on progression rows (kept as divs, per component-spec §5).
// Literal class strings so Tailwind can see them.
const HEIGHTS = [
  ["h-[6px]", "h-[12px]", "h-[16px]", "h-[9px]"],
  ["h-[5px]", "h-[9px]", "h-[7px]", "h-[11px]"],
  ["h-[7px]", "h-[11px]", "h-[9px]", "h-[6px]"],
  ["h-[8px]", "h-[14px]", "h-[6px]", "h-[12px]"],
  ["h-[10px]", "h-[6px]", "h-[12px]", "h-[8px]"],
  ["h-[6px]", "h-[10px]", "h-[14px]", "h-[7px]"],
];

export function Waveform({ variant, active }: { variant: number; active: boolean }) {
  const heights = HEIGHTS[variant % HEIGHTS.length];
  return (
    <div className="flex h-[16px] shrink-0 items-end gap-[2px]" aria-hidden="true">
      {heights.map((h, i) => (
        <div key={i} className={`w-[3px] ${h} ${active ? (i === 0 || i === 3 ? "bg-accent/75" : "bg-accent") : "bg-text-disabled"}`} />
      ))}
    </div>
  );
}
