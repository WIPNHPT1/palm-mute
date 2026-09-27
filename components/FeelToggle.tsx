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
        // Phones: the slider gets its own full-width row so it stays a comfortable size.
        <div className="flex flex-wrap items-center gap-[4px] font-mono text-[12px] text-text-muted tablet:flex-nowrap">
          <span className="mr-[4px] uppercase tracking-[0.08em] text-text-faint">Tempo</span>
          <button
            type="button"
            aria-label="Decrease tempo"
            onClick={() => onBpmChange(midTempoBpm - 1)}
            disabled={midTempoBpm <= MID_TEMPO.min}
            className="h-[44px] w-[44px] shrink-0 rounded-mid border border-line bg-paper text-[16px] disabled:opacity-40"
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
            className="order-last h-[44px] min-w-0 basis-full accent-accent tablet:order-none tablet:basis-auto tablet:flex-1"
          />
          <button
            type="button"
            aria-label="Increase tempo"
            onClick={() => onBpmChange(midTempoBpm + 1)}
            disabled={midTempoBpm >= MID_TEMPO.max}
            className="h-[44px] w-[44px] shrink-0 rounded-mid border border-line bg-paper text-[16px] disabled:opacity-40"
          >
            +
          </button>
          <span className="ml-auto w-[62px] shrink-0 text-right font-bold text-text-primary tablet:ml-0">{midTempoBpm} BPM</span>
        </div>
      )}
    </div>
  );
}
