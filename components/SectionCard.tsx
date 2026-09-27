"use client";

import { useState } from "react";
import { LockIcon } from "@/components/icons/LockIcon";
import { RegenerateIcon } from "@/components/icons/RegenerateIcon";
import { PlayButton } from "@/components/PlayButton";
import { TabBlock } from "@/components/TabBlock";
import type { RenderedSection } from "@/lib/generator";

/** Full-width secondary action under a card's details. */
const ACTION_BUTTON =
  "min-h-[44px] rounded-mid border border-line bg-paper px-[10px] text-left font-mono text-[12px] font-bold text-text-primary hover:border-accent";

/** 44×44 icon button whose negative margins keep the header as tight as the small icons it shows. */
const ICON_BUTTON = "-my-[14px] flex h-[44px] w-[44px] items-center justify-center rounded-mid";

export function SectionCard({
  section,
  index,
  locked,
  lockedIn,
  updateTo,
  active,
  progressionId,
  playing,
  onRegenerate,
  onToggleLock,
  onUpdate,
  onTogglePlay,
  extraAction,
  tabChars,
  wideOnTablet = false,
  className = "",
}: {
  section: RenderedSection;
  index: number;
  locked: boolean;
  /** Locked sections: what they were locked in, e.g. "A" or "A · I-V-vi-IV". */
  lockedIn?: string;
  /** Locked sections whose key (or Chorus progression) is out of date: what "Update to …" would give. */
  updateTo?: string;
  /** Sounding right now (its own play button, or Play song has reached it): the red border. */
  active: boolean;
  /** The Chorus: the Power Chords progression it plays. */
  progressionId?: string;
  playing: boolean;
  onRegenerate: () => void;
  onToggleLock: () => void;
  onUpdate: () => void;
  onTogglePlay: () => void;
  /** An extra button under the footer (e.g. the Intro's "Back to power chords"). */
  extraAction?: { label: string; onClick: () => void };
  /** The widest tab in the row, in characters: every card draws its tab at that one scale. */
  tabChars?: number;
  /** The card spans both tablet columns (the Breakdown): its tab keeps the single-column scale. */
  wideOnTablet?: boolean;
  className?: string;
}) {
  // Red means "sounding now", as in the rest of the page (selected progression, active feel).
  // Locked cards get an ink border instead; everything else stays neutral.
  // Long tabs (an 8-bar solo or melody) show their first 4 bars, like the other cards, until expanded.
  const [expanded, setExpanded] = useState(false);
  const long = section.tab.length > 2;
  const groups = long && !expanded ? section.tab.slice(0, 2) : section.tab;
  const tabId = `tab-${section.id}`;
  return (
    // Four rows shared with the other cards in the grid row (subgrid): header, tab, details, actions.
    // Every card's tab, caption and play button therefore start on the same lines.
    <section
      aria-label={section.label}
      data-active={active}
      data-locked={locked}
      className={`row-span-4 grid min-w-0 grid-rows-subgrid gap-y-[9px] rounded-outer bg-surface p-[14px] transition-[border-color,box-shadow] duration-200 tablet:p-[12px] ${
        active
          ? "border-[1.5px] border-accent shadow-card-highlight"
          : locked
            ? "border-[1.5px] border-ink shadow-card dark:border-text-faint"
            : "border-[1.5px] border-line shadow-card"
      } ${className}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-[7px]">
          <div className={`font-mono text-[15px] font-bold ${active ? "text-accent" : "text-text-faint"}`}>{String(index + 1).padStart(2, "0")}</div>
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
      <div id={tabId} data-tab-area>
        <TabBlock
          groups={groups}
          spoken={section.spoken}
          chars={tabChars}
          alignRows
          className="h-full"
          // Half the double-width tab area, less the extra card padding and the column gap it absorbs.
          svgClassName={wideOnTablet ? "tablet:max-w-[calc(50%-27px)] desktop:max-w-full" : ""}
        />
      </div>
      <div data-details className="flex items-start justify-between gap-[6px]">
        <div className="min-w-0 font-mono text-[12px] leading-[1.35] text-text-faint">
          {progressionId && <div className="font-bold text-text-muted">Chords: {progressionId}</div>}
          <div>{section.caption}</div>
          <div data-frets>
            {section.frets[1] === 0 ? "Open strings" : `Frets ${section.frets[0] === 0 ? "open" : section.frets[0]}–${section.frets[1]}`}
            {section.repeat > 1 ? ` · ×${section.repeat}` : ""}
          </div>
          {locked && lockedIn && <div className="font-bold text-text-muted">Locked in {lockedIn}</div>}
        </div>
        <PlayButton playing={playing} onClick={onTogglePlay} label={section.label} iconSize={12} className="-mb-[12px] -mr-[12px] -mt-[13px]" />
      </div>
      <div data-actions className="flex flex-col gap-[8px] empty:hidden">
        {long && (
          <button type="button" onClick={() => setExpanded((e) => !e)} aria-expanded={expanded} aria-controls={tabId} className={ACTION_BUTTON}>
            {expanded ? "Show the first 4 bars" : `Show all ${section.bars.length} bars`}
          </button>
        )}
        {locked && updateTo && (
          <button type="button" onClick={onUpdate} className={ACTION_BUTTON}>
            Update to {updateTo}
          </button>
        )}
        {extraAction && (
          <button type="button" onClick={extraAction.onClick} className={ACTION_BUTTON}>
            {extraAction.label}
          </button>
        )}
      </div>
    </section>
  );
}
