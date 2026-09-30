"use client";

import { useSyncExternalStore } from "react";
import { type FeelId, MID_TEMPO, feels, patternForFeel } from "@/lib/generator";

/** True from the tablet breakpoint up (tailwind.config.js). Static pages render the phone layout first. */
function useTabletUp(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = matchMedia("(min-width: 834px)");
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => matchMedia("(min-width: 834px)").matches,
    () => false,
  );
}

/**
 * The five feels. Tablet and desktop: one row of segments, with Mid-Tempo's tempo row underneath.
 * Phones: a list, one row per feel (name and BPM, then its strum), and Mid-Tempo's tempo opens
 * inside its own row (owner's pick, DECISIONS.md). Only one tempo row is ever rendered.
 */
export function FeelToggle({
  feel,
  midTempoBpm,
  onFeelChange,
  onBpmChange,
}: {
  feel: FeelId;
  midTempoBpm: number;
  onFeelChange: (feel: FeelId) => void;
  onBpmChange: (bpm: number) => void;
}) {
  const tabletUp = useTabletUp();
  const tempo = (inRow: boolean) => <TempoRow bpm={midTempoBpm} onChange={onBpmChange} inRow={inRow} />;

  return (
    <div className="flex flex-col gap-[10px]">
      <div role="radiogroup" aria-label="Feel" className="flex flex-col gap-[2px] rounded-[7px] border border-line bg-paper p-[3px] tablet:flex-row">
        {feels.map((f) => {
          const active = f.id === feel;
          const pattern = patternForFeel(f.id);
          // Fixed readouts from feels.json; Mid-Tempo shows the live, adjustable tempo.
          const bpm = typeof f.displayBpm === "number" ? f.displayBpm : midTempoBpm;
          return (
            <div key={f.id} className={`rounded-[5px] tablet:flex-auto ${active ? "bg-ink text-text-on-dark dark:shadow-[inset_0_0_0_1px_theme(colors.line-strong)]" : ""}`}>
              <button
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onFeelChange(f.id)}
                className={`grid min-h-[48px] w-full grid-cols-[1fr_auto] items-center gap-x-[10px] gap-y-[2px] rounded-[5px] px-[12px] py-[7px] text-left font-mono text-[12px] leading-[1.3] tablet:flex tablet:min-h-[44px] tablet:flex-col tablet:justify-center tablet:gap-[2px] tablet:px-[14px] tablet:py-[5px] tablet:text-center tablet:leading-[1.2] ${
                  active ? "" : "text-text-muted hover:text-text-primary"
                }`}
              >
                <span className={active ? "font-bold" : ""}>{f.label}</span>
                <span className={active ? "text-chip-tab" : "text-text-faint"}>{bpm} BPM</span>
                <span className={`col-span-2 flex gap-[10px] tablet:hidden ${active ? "text-chip-tab" : "text-text-faint"}`}>
                  <span>{pattern.name}</span>
                  <span aria-hidden="true" className={`tracking-[2px] ${active ? "text-accent-on-ink" : "text-accent"}`}>
                    {pattern.glyphs.join("")}
                  </span>
                </span>
              </button>
              {active && f.id === "mid-tempo" && !tabletUp && tempo(true)}
            </div>
          );
        })}
      </div>
      {feel === "mid-tempo" && tabletUp && tempo(false)}
    </div>
  );
}

/**
 * − slider +. Under the segments (tablet up) it takes their width and never adds to it (w-0 +
 * min-w-full), so picking Mid-Tempo can't widen the card. Inside the phone row it drops the TEMPO
 * label (the row already names it and shows the BPM), so all three fit on one line at 320px.
 */
function TempoRow({ bpm, onChange, inRow }: { bpm: number; onChange: (bpm: number) => void; inRow: boolean }) {
  const step = `h-[44px] w-[44px] shrink-0 rounded-mid border text-[16px] disabled:opacity-40 ${
    inRow ? "border-text-on-dark-faint text-text-on-dark" : "border-line bg-paper"
  }`;
  return (
    <div className={`flex items-center gap-[4px] font-mono text-[12px] ${inRow ? "w-full px-[12px] pb-[10px]" : "w-0 min-w-full text-text-muted"}`}>
      {!inRow && <span className="mr-[4px] uppercase tracking-[0.08em] text-text-faint">Tempo</span>}
      <button type="button" aria-label="Decrease tempo" onClick={() => onChange(bpm - 1)} disabled={bpm <= MID_TEMPO.min} className={step}>
        −
      </button>
      <input
        type="range"
        aria-label="Mid-tempo BPM"
        min={MID_TEMPO.min}
        max={MID_TEMPO.max}
        value={bpm}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-valuetext={`${bpm} BPM`}
        className={`h-[44px] min-w-0 flex-1 ${inRow ? "accent-accent-on-ink" : "accent-accent"}`}
      />
      <button type="button" aria-label="Increase tempo" onClick={() => onChange(bpm + 1)} disabled={bpm >= MID_TEMPO.max} className={step}>
        +
      </button>
    </div>
  );
}
