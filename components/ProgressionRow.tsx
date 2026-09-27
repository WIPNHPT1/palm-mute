"use client";

import { ChordChip } from "@/components/ChordChip";
import { PlayIcon } from "@/components/icons/PlayIcon";
import { StopIcon } from "@/components/icons/StopIcon";
import { Waveform } from "@/components/Waveform";
import type { Progression, ResolvedChord } from "@/lib/musicTheory";

/**
 * A progression: waveform glyph, roman-numeral name, chord chips and a play toggle.
 * Horizontal row from tablet up; a vertical mini-card on mobile.
 * `variant="panel"` is the Generator's Power Chords row, `"card"` the Chords page card.
 */
export function ProgressionRow({
  progression,
  chords,
  variantIndex,
  highlighted,
  playing,
  onTogglePlay,
  variant,
}: {
  progression: Progression;
  chords: ResolvedChord[];
  variantIndex: number;
  highlighted: boolean;
  playing: boolean;
  onTogglePlay: () => void;
  variant: "panel" | "card";
}) {
  const card = variant === "card";
  const container = card
    ? `rounded-outer bg-surface px-[14px] py-[12px] tablet:px-[20px] tablet:py-[16px] tablet:gap-[16px] ${
        highlighted ? "border-[1.5px] border-accent shadow-card-highlight" : "border border-line shadow-card"
      }`
    : "rounded-mid border border-line bg-paper px-[12px] py-[10px] tablet:px-[14px] tablet:gap-[12px]";

  return (
    <div className={`flex flex-col gap-[8px] tablet:flex-row tablet:items-center ${container}`}>
      <div className="flex items-center justify-between tablet:contents">
        <div className="flex items-center gap-[8px] tablet:contents">
          <Waveform variant={variantIndex} active={highlighted} size={card ? "lg" : "sm"} />
          <div
            className={`shrink-0 font-mono font-bold ${card ? "text-[13px] tablet:w-[76px]" : "text-[12px] tablet:w-[66px] tablet:text-[11.5px]"} ${
              highlighted ? "text-accent" : "text-text-muted"
            }`}
          >
            {progression.id}
          </div>
        </div>
        <button
          type="button"
          onClick={onTogglePlay}
          aria-pressed={playing}
          aria-label={playing ? `Stop ${progression.id}` : `Play ${progression.id}`}
          className={`shrink-0 tablet:order-last ${highlighted || playing ? "text-accent" : "text-text-disabled hover:text-text-muted"}`}
        >
          {playing ? <StopIcon size={card ? 13 : 11} /> : <PlayIcon size={card ? 13 : 11} filled={highlighted} />}
        </button>
      </div>
      <div className={`flex flex-wrap tablet:flex-grow ${card ? "gap-[6px]" : "gap-[5px]"}`}>
        {chords.map((c, i) => (
          <ChordChip key={`${c.name}-${i}`} chord={c} />
        ))}
      </div>
    </div>
  );
}
