"use client";

import { PlayButton } from "@/components/PlayButton";
import { type FeelId, getFeel, rhythmPatterns } from "@/lib/generator";
import { type NoteName, keyDisplayName } from "@/lib/musicTheory";

// Dark mode: the muted tag drops to a deeper brown. The brass tag takes dark text in both themes, for contrast.
const TAG_CLASSES = {
  ink: "bg-ink text-text-on-dark",
  muted: "bg-text-muted text-text-on-dark dark:bg-ink-mid",
  brass: "bg-brass text-ink",
  red: "bg-accent text-text-on-accent",
  outline: "border-[1.5px] border-text-primary text-text-primary",
} as const;

/**
 * All five strum patterns from rhythm-patterns.json; the one for the active feel is highlighted.
 * Tapping a card picks its feel (like the Feel control); its play button plays that strum over the
 * Chorus progression. Cards are stretched buttons with the play button on top, like Power Chords rows.
 * The header mirrors the Power Chords panel beside it (same two lines, same spacing), so both
 * panels' first cards start level. Tablet: all five in one row (owner's pick), name over tag.
 */
export function RhythmLane({
  activeFeel,
  progressionId,
  keyName,
  playing,
  onSelect,
  onTogglePlay,
}: {
  activeFeel: FeelId;
  progressionId: string;
  keyName: NoteName;
  /** The active feel's strum is playing. */
  playing: boolean;
  onSelect: (feel: FeelId) => void;
  onTogglePlay: (feel: FeelId) => void;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-[12px] rounded-outer border border-line bg-surface p-[16px] tablet:px-[20px]">
      <div>
        <h2 className="mb-[4px] font-display text-[12.5px]">RHYTHM LANE</h2>
        <div className="font-mono text-[12px] text-text-muted">
          Strums for {progressionId} · Key of {keyDisplayName(keyName)}
          <span className="hidden tablet:inline"> · E standard</span>
        </div>
        <div className="mt-[2px] font-mono text-[12px] text-text-faint">Tap a strum to use its feel.</div>
      </div>
      <div className="grid flex-grow grid-cols-1 gap-[8px] tablet:grid-cols-5 desktop:grid-cols-1">
        {rhythmPatterns.map((p) => {
          const active = p.feel === activeFeel;
          const label = getFeel(p.feel).label;
          return (
            <div
              key={p.id}
              data-strum={p.feel}
              aria-current={active ? "true" : undefined}
              className={`relative flex flex-col justify-center gap-[5px] rounded-mid border bg-paper px-[12px] py-[10px] tablet:px-[10px] desktop:px-[12px] desktop:py-[9px] ${
                active ? "border-accent" : "border-line hover:border-text-faintest"
              }`}
            >
              <button
                type="button"
                onClick={() => onSelect(p.feel)}
                aria-label={`Use ${p.name} (${label})`}
                aria-pressed={active}
                className="absolute inset-0 rounded-[inherit]"
              />
              <div className="pointer-events-none relative flex items-center justify-between gap-[6px] tablet:flex-col tablet:items-start desktop:flex-row desktop:items-center">
                <div className="font-mono text-[12px] font-bold">{p.name}</div>
                <div className={`shrink-0 rounded-small px-[6px] py-[2px] font-mono text-[12px] ${TAG_CLASSES[p.tagColor]}`}>{label}</div>
              </div>
              <div
                className="pointer-events-none relative font-mono text-[13px] tracking-[3px] text-accent tablet:tracking-[1px] desktop:tracking-[3px]"
                aria-label={`Strum: ${p.glyphs.map((g) => (g === "▼" ? "down" : g === "▲" ? "up" : "rest")).join(", ")}`}
              >
                {p.glyphs.join("")}
              </div>
              <div className="pointer-events-none relative font-mono text-[12px] tracking-[1px] text-text-faint">{p.beatLabel}</div>
              <div className="pointer-events-none relative flex items-center justify-between gap-[8px]">
                <div className="font-mono text-[12px] text-text-muted">{p.description}</div>
                <PlayButton
                  playing={playing && active}
                  onClick={() => onTogglePlay(p.feel)}
                  label={`${p.name} strum`}
                  iconSize={12}
                  className="pointer-events-auto relative z-10 -my-[10px] -mr-[12px] tablet:-mr-[10px] desktop:-mr-[12px]"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
