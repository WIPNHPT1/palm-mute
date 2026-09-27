"use client";

import { ChordChip } from "@/components/ChordChip";
import { PlayButton } from "@/components/PlayButton";
import { Waveform } from "@/components/Waveform";
import type { Progression, ResolvedChord } from "@/lib/musicTheory";
import type { Voicing } from "@/lib/voicings";

/**
 * A progression: waveform glyph, roman-numeral name, chord chips and a play toggle.
 * Horizontal row from tablet up; a vertical mini-card on mobile.
 * `variant="panel"` is the Generator's Power Chords row (click to use it for the Chorus),
 * `"card"` the Chords page card (click to open its panel).
 *
 * The whole row is one button (stretched under the content), and the play button sits on top of it.
 */
export function ProgressionRow({
  progression,
  chords,
  variantIndex,
  highlighted,
  playing,
  onTogglePlay,
  onSelect,
  selectLabel,
  selected,
  expanded,
  controls,
  badge,
  variant,
  className = "",
}: {
  progression: Progression;
  /** Each chord with the voicing its chip shows (lib/generator.ts libraryVoicings). */
  chords: { chord: ResolvedChord; voicing: Voicing }[];
  variantIndex: number;
  highlighted: boolean;
  playing: boolean;
  onTogglePlay: () => void;
  onSelect: () => void;
  /** Accessible name of the row button, e.g. "Use I-V-vi-IV for the Chorus". */
  selectLabel: string;
  /** Panel rows: this progression is the Chorus (aria-pressed). */
  selected?: boolean;
  /** Chords cards: this card's panel is open (aria-expanded). */
  expanded?: boolean;
  /** id of the panel this card opens. */
  controls?: string;
  /** Small label next to the name, e.g. "MOST COMMON". */
  badge?: string;
  variant: "panel" | "card";
  className?: string;
}) {
  const card = variant === "card";
  const container = card
    ? `rounded-outer bg-surface px-[14px] py-[10px] tablet:px-[20px] tablet:py-[12px] tablet:gap-[16px] ${
        highlighted || expanded ? "border-[1.5px] border-accent shadow-card-highlight" : "border border-line shadow-card hover:border-text-faintest"
      }`
    : `rounded-mid border bg-paper px-[12px] py-[8px] tablet:px-[14px] tablet:gap-[12px] ${highlighted ? "border-accent" : "border-line hover:border-text-faintest"}`;

  return (
    <div data-progression={progression.id} className={`relative flex flex-col gap-[8px] tablet:flex-row tablet:items-center ${container} ${className}`}>
      <button
        type="button"
        onClick={onSelect}
        aria-label={selectLabel}
        aria-pressed={expanded === undefined ? !!selected : undefined}
        aria-expanded={expanded}
        aria-controls={controls}
        className="absolute inset-0 rounded-[inherit]"
      />
      <div className="pointer-events-none relative flex items-center justify-between tablet:contents">
        <div className="flex items-center gap-[8px] tablet:contents">
          <Waveform variant={variantIndex} active={highlighted} size={card ? "lg" : "sm"} />
          <div className={`flex shrink-0 flex-col gap-[2px] ${card ? "tablet:w-[92px]" : "tablet:w-[80px]"}`}>
            <div className={`font-mono text-[13px] font-bold ${highlighted ? "text-accent" : "text-text-muted"}`}>{progression.id}</div>
            {badge && <div className="font-mono text-[12px] uppercase tracking-[0.04em] text-accent">{badge}</div>}
          </div>
        </div>
        <PlayButton
          playing={playing}
          onClick={onTogglePlay}
          label={progression.id}
          iconSize={card ? 14 : 12}
          className="pointer-events-auto relative z-10 -my-[8px] -mr-[12px] tablet:order-last"
        />
      </div>
      <div className={`pointer-events-none relative flex flex-wrap tablet:flex-grow ${card ? "gap-[6px]" : "gap-[5px]"}`}>
        {chords.map(({ chord, voicing }, i) => (
          <ChordChip key={`${chord.name}-${i}`} chord={chord} notes={voicing.notes} degree={progression.degrees[i]} />
        ))}
      </div>
    </div>
  );
}
