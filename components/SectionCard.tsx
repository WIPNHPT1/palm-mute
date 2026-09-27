"use client";

import { LockIcon } from "@/components/icons/LockIcon";
import { RegenerateIcon } from "@/components/icons/RegenerateIcon";
import { PlayButton } from "@/components/PlayButton";
import { TabBlock } from "@/components/TabBlock";
import type { RenderedSection } from "@/lib/generator";

const GLYPH_WORDS = { "▼": "down", "▲": "up", "·": "rest" } as const;

/** 44×44 icon button whose negative margins keep the header as tight as the small icons it shows. */
const ICON_BUTTON = "-my-[14px] flex h-[44px] w-[44px] items-center justify-center rounded-mid";

export function SectionCard({
  section,
  index,
  locked,
  lockedIn,
  updateTo,
  highlighted,
  playing,
  onRegenerate,
  onToggleLock,
  onUpdate,
  onTogglePlay,
  className = "",
}: {
  section: RenderedSection;
  index: number;
  locked: boolean;
  /** Locked sections: what they were locked in, e.g. "A" or "A · I-V-vi-IV". */
  lockedIn?: string;
  /** Locked sections whose key (or Chorus progression) is out of date: what "Update to …" would give. */
  updateTo?: string;
  /** Chorus is always the highlighted card (open decision → recommended default). */
  highlighted: boolean;
  playing: boolean;
  onRegenerate: () => void;
  onToggleLock: () => void;
  onUpdate: () => void;
  onTogglePlay: () => void;
  className?: string;
}) {
  // Numeral coloring is cosmetic (component-spec §2): accent on the first card and the highlighted one.
  const accentNumeral = index === 0 || highlighted;
  return (
    <section
      aria-label={section.label}
      className={`flex min-w-0 flex-col gap-[9px] rounded-outer bg-surface p-[14px] tablet:p-[12px] ${
        highlighted ? "border-[1.5px] border-accent shadow-card-highlight" : "border border-line shadow-card"
      } ${className}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-[7px]">
          <div className={`font-mono text-[15px] font-bold ${accentNumeral ? "text-accent" : "text-text-faint"}`}>{String(index + 1).padStart(2, "0")}</div>
          <h2 className="font-mono text-[12px] uppercase tracking-[0.06em] text-text-muted">{section.label}</h2>
        </div>
        <div className="-mr-[12px] flex items-center">
          <button
            type="button"
            onClick={onRegenerate}
            disabled={locked}
            aria-label={locked ? `${section.label} is locked` : `Regenerate ${section.label}`}
            title={locked ? "Unlock to regenerate" : "Regenerate this section"}
            className={`${ICON_BUTTON} text-text-muted enabled:hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40`}
          >
            <RegenerateIcon />
          </button>
          <button
            type="button"
            onClick={onToggleLock}
            aria-pressed={locked}
            aria-label={locked ? `Unlock ${section.label}` : `Lock ${section.label}`}
            title={locked ? "Unlock" : "Lock"}
            className={`${ICON_BUTTON} ${locked ? "text-text-primary" : "text-text-muted hover:text-text-primary"}`}
          >
            <LockIcon />
          </button>
        </div>
      </div>
      <TabBlock lines={section.tabLines} spoken={section.spoken} />
      {section.strum && (
        <div className="font-mono text-[10px] tracking-[3px] text-accent">
          <span aria-hidden="true" data-strum>
            {section.strum.join("")}
          </span>
          <span className="sr-only">Strum: {section.strum.map((g) => GLYPH_WORDS[g]).join(", ")}</span>
        </div>
      )}
      <div className="mt-auto flex flex-col gap-[9px]">
      <div className="flex items-center justify-between gap-[6px]">
        <div className="min-w-0 font-mono text-[12px] leading-[1.35] text-text-faint">
          {locked && lockedIn && <div className="font-bold text-text-muted">Locked in {lockedIn}</div>}
          <div>{section.caption}</div>
        </div>
        <PlayButton playing={playing} onClick={onTogglePlay} label={section.label} iconSize={12} className="-my-[10px] -mr-[12px]" />
      </div>
      {locked && updateTo && (
        <button
          type="button"
          onClick={onUpdate}
          className="-mb-[4px] min-h-[44px] rounded-mid border border-line bg-paper px-[10px] text-left font-mono text-[12px] font-bold text-text-primary hover:border-accent"
        >
          Update to {updateTo}
        </button>
      )}
      </div>
    </section>
  );
}
