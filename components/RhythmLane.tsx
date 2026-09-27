import { type FeelId, getFeel, rhythmPatterns } from "@/lib/generator";

// Dark mode: the muted tag drops to a deeper brown. The brass tag takes dark text in both themes, for contrast.
const TAG_CLASSES = {
  ink: "bg-ink text-text-on-dark",
  muted: "bg-text-muted text-text-on-dark dark:bg-ink-mid",
  brass: "bg-brass text-ink",
} as const;

/** All three strum patterns from rhythm-patterns.json; the one for the active feel is highlighted. */
export function RhythmLane({ activeFeel, subtitle }: { activeFeel: FeelId; subtitle: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-[10px] rounded-outer border border-line bg-surface p-[16px] tablet:px-[20px]">
      <div>
        <h2 className="mb-[4px] font-display text-[12.5px]">RHYTHM LANE</h2>
        <div className="font-mono text-[12px] text-text-muted">{subtitle}</div>
      </div>
      <div className="grid flex-grow grid-cols-1 gap-[8px] tablet:grid-cols-3 desktop:grid-cols-1">
        {rhythmPatterns.map((p) => {
          const active = p.feel === activeFeel;
          return (
            <div
              key={p.id}
              aria-current={active ? "true" : undefined}
              className={`flex flex-col justify-center gap-[5px] rounded-mid border bg-paper px-[12px] py-[10px] desktop:py-[9px] ${
                active ? "border-accent" : "border-line"
              }`}
            >
              <div className="flex items-center justify-between gap-[6px]">
                <div className="font-mono text-[12px] font-bold">{p.name}</div>
                <div className={`shrink-0 rounded-small px-[6px] py-[2px] font-mono text-[12px] ${TAG_CLASSES[p.tagColor]}`}>
                  {getFeel(p.feel).label}
                </div>
              </div>
              <div className="font-mono text-[13px] tracking-[3px] text-accent" aria-label={`Strum: ${p.glyphs.map((g) => (g === "▼" ? "down" : g === "▲" ? "up" : "rest")).join(", ")}`}>
                {p.glyphs.join("")}
              </div>
              <div className="font-mono text-[12px] tracking-[1px] text-text-faint">{p.beatLabel}</div>
              <div className="font-mono text-[12px] text-text-muted">{p.description}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
