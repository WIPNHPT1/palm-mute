"use client";

import { SegmentedControl } from "@/components/SegmentedControl";
import { type FeelId, MID_TEMPO, feels } from "@/lib/generator";

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
  const options = feels.map((f) => ({
    value: f.id,
    label: f.label,
    // Fast Punk / Half-Time: fixed readouts from feels.json. Mid-Tempo: the live, adjustable tempo.
    sub: `${typeof f.displayBpm === "number" ? f.displayBpm : midTempoBpm} BPM`,
  }));

  return (
    <div className="flex flex-col gap-[10px]">
      <SegmentedControl label="Feel" options={options} value={feel} onChange={onFeelChange} />
      {feel === "mid-tempo" && (
        <div className="flex items-center gap-[8px] font-mono text-[10px] text-text-muted">
          <span className="uppercase tracking-[0.08em] text-text-faint">Tempo</span>
          <button
            type="button"
            aria-label="Decrease tempo"
            onClick={() => onBpmChange(midTempoBpm - 1)}
            disabled={midTempoBpm <= MID_TEMPO.min}
            className="h-[22px] w-[22px] rounded-small border border-line bg-paper text-[12px] disabled:opacity-40"
          >
            −
          </button>
          <input
            type="range"
            aria-label="Mid-tempo BPM"
            min={MID_TEMPO.min}
            max={MID_TEMPO.max}
            value={midTempoBpm}
            onChange={(e) => onBpmChange(Number(e.target.value))}
            className="min-w-0 flex-1 accent-accent"
          />
          <button
            type="button"
            aria-label="Increase tempo"
            onClick={() => onBpmChange(midTempoBpm + 1)}
            disabled={midTempoBpm >= MID_TEMPO.max}
            className="h-[22px] w-[22px] rounded-small border border-line bg-paper text-[12px] disabled:opacity-40"
          >
            +
          </button>
          <span className="w-[52px] text-right font-bold text-text-primary">{midTempoBpm} BPM</span>
        </div>
      )}
    </div>
  );
}
