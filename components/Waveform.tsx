// The little 4-bar "waveform" glyph on progression rows (kept as divs, per component-spec §5).
// Literal class strings so Tailwind can see them; "sm" = the Generator's Chords step, "lg" = Chords page card.
const HEIGHTS = {
  sm: [
    ["h-[6px]", "h-[12px]", "h-[16px]", "h-[9px]"],
    ["h-[5px]", "h-[9px]", "h-[7px]", "h-[11px]"],
    ["h-[7px]", "h-[11px]", "h-[9px]", "h-[6px]"],
    ["h-[8px]", "h-[14px]", "h-[6px]", "h-[12px]"],
    ["h-[10px]", "h-[6px]", "h-[12px]", "h-[8px]"],
    ["h-[6px]", "h-[10px]", "h-[14px]", "h-[7px]"],
  ],
  lg: [
    ["h-[8px]", "h-[16px]", "h-[20px]", "h-[12px]"],
    ["h-[7px]", "h-[13px]", "h-[10px]", "h-[16px]"],
    ["h-[9px]", "h-[14px]", "h-[11px]", "h-[8px]"],
    ["h-[10px]", "h-[18px]", "h-[8px]", "h-[15px]"],
    ["h-[12px]", "h-[8px]", "h-[15px]", "h-[10px]"],
    ["h-[8px]", "h-[12px]", "h-[18px]", "h-[9px]"],
  ],
};

export function Waveform({ variant, active, size }: { variant: number; active: boolean; size: "sm" | "lg" }) {
  const heights = HEIGHTS[size][variant % HEIGHTS[size].length];
  return (
    <div className={`flex shrink-0 items-end gap-[2px] ${size === "lg" ? "h-[20px]" : "h-[16px]"}`} aria-hidden="true">
      {heights.map((h, i) => (
        <div key={i} className={`w-[3px] ${h} ${active ? (i === 0 || i === 3 ? "bg-accent/75" : "bg-accent") : "bg-text-disabled"}`} />
      ))}
    </div>
  );
}
