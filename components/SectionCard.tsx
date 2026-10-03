"use client";

import { type ReactNode, useId, useState } from "react";
import { ChordChip } from "@/components/ChordChip";
import { LockIcon } from "@/components/icons/LockIcon";
import { RegenerateIcon } from "@/components/icons/RegenerateIcon";
import { PlayButton } from "@/components/PlayButton";
import { TabBlock } from "@/components/TabBlock";
import { type RenderedSection, rhythmOf, tabFor } from "@/lib/generator";
import { useTabletUp } from "@/lib/hooks/useTabletUp";
import type { Degree } from "@/lib/musicTheory";

/** Secondary action in the card's footer. */
const ACTION_BUTTON =
  "min-h-[44px] rounded-mid border border-line bg-paper px-[12px] text-left font-mono text-[12px] font-bold text-text-primary hover:border-accent";

/** 44×44 icon button. */
const ICON_BUTTON = "flex h-[44px] w-[44px] items-center justify-center rounded-mid";

/**
 * One section of the song, full width (docs/song-builder-prd.md B5): its name, where it plays in the song,
 * play / new take / lock, what it plays in words, its chords, and its tab as a songbook (bar numbers, rhythm
 * stems, repeat marks), 2 bars to a line on phones and 4 from tablet up. Long tabs show their first two
 * lines until expanded. OPTIONS opens the section's own panel (collapsed by default).
 */
export function SectionCard({
  section,
  index,
  locked,
  lockedIn,
  updateTo,
  active,
  progressionId,
  plan,
  uses,
  playing,
  onRegenerate,
  onToggleLock,
  onUpdate,
  onTogglePlay,
  extraAction,
  degrees,
  options,
  optionsSummary,
  nowBar,
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
  /** The Chorus: the progression it plays (the Chords step's pick). */
  progressionId?: string;
  /** What the section plays in the song's plan (e.g. "Climb: IV-V"). */
  plan?: string;
  /** Every place the section plays in the song's running order. */
  uses?: { name: string; start?: string; variation?: string; active: boolean }[];
  playing: boolean;
  onRegenerate: () => void;
  onToggleLock: () => void;
  onUpdate: () => void;
  onTogglePlay: () => void;
  /** An extra button in the footer (e.g. the Intro's "Back to power chords"). */
  extraAction?: { label: string; onClick: () => void };
  /** Each chord's degree in the key (I, V, vi …), bar by bar, for the chord chips. */
  degrees?: Degree[];
  /** The section's Options panel (rhythm, playing style, structure, drums). */
  options?: ReactNode;
  /** What the Options button says is in use, e.g. "Gallop". */
  optionsSummary?: string;
  /** The tab bar sounding now (the transport's cursor), if this section is playing. */
  nowBar?: number | null;
  className?: string;
}) {
  const tabletUp = useTabletUp();
  const [expanded, setExpanded] = useState(false);
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const tabId = `tab-${section.id}`;

  // Red means "sounding now", as in the rest of the page. Locked cards get an ink border instead.
  const groups = tabFor(section, tabletUp ? 4 : 2);
  const long = groups.length > 2;
  const shown = long && !expanded ? groups.slice(0, 2) : groups;
  const bars = section.lead ? section.lead.chords.length : section.bars.length;
  const played = bars * section.repeat;
  const frets = section.frets[1] === 0 ? "Open strings" : `Frets ${section.frets[0] === 0 ? "open" : section.frets[0]}–${section.frets[1]}`;

  return (
    <section
      aria-label={section.label}
      data-active={active}
      data-locked={locked}
      data-section={section.id}
      className={`min-w-0 scroll-mt-[96px] rounded-outer bg-surface transition-[border-color,box-shadow] duration-200 ${
        active
          ? "border-[1.5px] border-accent shadow-card-highlight"
          : locked
            ? "border-[1.5px] border-ink shadow-card dark:border-text-faint"
            : "border-[1.5px] border-line shadow-card"
      } ${className}`}
    >
      <div className="flex flex-wrap items-center gap-x-[12px] gap-y-[4px] px-[14px] pt-[10px] tablet:px-[16px]">
        <div className="flex min-w-0 items-baseline gap-[8px]">
          <span className={`font-mono text-[15px] font-bold ${active ? "text-accent" : "text-text-faint"}`}>{String(index + 1).padStart(2, "0")}</span>
          <h2 className="font-display text-[17px] leading-[1.3]">{section.label}</h2>
          <span className="whitespace-nowrap font-mono text-[12px] text-text-faint">
            {played} {played === 1 ? "bar" : "bars"}
          </span>
        </div>
        <div className="order-last -ml-[12px] flex w-full items-center tablet:order-none tablet:ml-auto tablet:w-auto tablet:-mr-[8px]">
          <PlayButton playing={playing} onClick={onTogglePlay} label={section.label} iconSize={13} />
          <button
            type="button"
            onClick={onRegenerate}
            disabled={locked}
            aria-label={locked ? `${section.label} is locked` : `Regenerate ${section.label}`}
            title={locked ? "Unlock to regenerate" : "A new take of this section"}
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
        {uses && uses.length > 0 && (
          <div data-uses className="flex w-full flex-wrap items-center gap-x-[8px] gap-y-[4px] font-mono text-[12px] text-text-faint tablet:w-auto">
            {uses.length > 1 && <span>Plays {uses.length}× in the song</span>}
            <ul className="flex flex-wrap gap-[4px]">
              {uses.map((u) => (
                <li
                  key={u.name}
                  data-active={u.active}
                  className={`rounded-small border px-[6px] py-[1px] ${u.active ? "border-accent bg-accent text-text-on-accent" : "border-line text-text-muted"}`}
                >
                  {u.name}
                  {u.variation ? ` · ${u.variation}` : ""}
                  {u.start ? <span className={u.active ? "" : "text-text-faint"}>{` · ${u.start}`}</span> : null}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div data-details className="px-[14px] pt-[4px] font-mono text-[12px] leading-[1.45] text-text-faint tablet:px-[16px]">
        <span className="font-bold text-text-muted">{progressionId ? `Chords: ${progressionId}` : plan}</span>
        {" · "}
        {section.caption}
        {" · "}
        <span data-frets>
          {frets}
          {section.repeat > 1 ? ` · ×${section.repeat}` : ""}
        </span>
        {locked && lockedIn && <span className="font-bold text-text-muted">{` · Locked in ${lockedIn}`}</span>}
      </div>

      {section.voicings.length > 0 && (
        <div className="flex flex-wrap gap-[6px] px-[14px] pt-[10px] tablet:px-[16px]" aria-label={`${section.label} chords`} role="group">
          {section.voicings.map(({ chord, voicing }) => (
            <ChordChip key={chord.name} chord={chord} notes={voicing.notes} degree={degrees?.[section.chords.findIndex((c) => c.root === chord.root)]} />
          ))}
        </div>
      )}

      <div id={tabId} data-tab-area className="px-[14px] pt-[10px] tablet:px-[16px]">
        <TabBlock groups={shown} spoken={section.spoken} rhythm={rhythmOf(section)} repeat={section.repeat} complete={shown.length === groups.length} nowBar={nowBar} />
      </div>

      <div data-actions className="flex flex-wrap items-center gap-[8px] px-[14px] pb-[12px] pt-[10px] tablet:px-[16px]">
        {long && (
          <button type="button" onClick={() => setExpanded((e) => !e)} aria-expanded={expanded} aria-controls={tabId} className={ACTION_BUTTON}>
            {expanded ? "Show the first two lines" : `Show all ${bars} bars`}
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
        {options && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls={panelId}
            aria-label={`${section.label} options`}
            data-options-button
            className={`ml-auto flex min-h-[44px] items-center gap-[8px] rounded-mid border px-[12px] font-mono text-[12px] font-bold tracking-[0.06em] ${
              open ? "border-ink bg-ink text-text-on-dark dark:border-line-strong" : "border-line bg-paper text-text-primary hover:border-text-faintest"
            }`}
          >
            OPTIONS
            {optionsSummary && <span className={`hidden font-normal tracking-normal tablet:inline ${open ? "text-text-on-dark-faint" : "text-text-faint"}`}>{optionsSummary}</span>}
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className={open ? "rotate-180" : ""}>
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        )}
      </div>

      {options && open && (
        <div id={panelId} data-options-panel className="rounded-b-[6.5px] border-t border-line bg-paper">
          {options}
        </div>
      )}
    </section>
  );
}
