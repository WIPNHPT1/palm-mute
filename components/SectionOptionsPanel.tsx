"use client";

import { type ReactNode, useId, useState } from "react";
import { PlayButton } from "@/components/PlayButton";
import { SegmentedControl } from "@/components/SegmentedControl";
import { type GrooveChoice, type RenderedSection, type SectionId, type SectionOptions } from "@/lib/generator";
import { type LeadStyle, INTRO_STYLES, RULES, SOLO_STYLES, styleLabel } from "@/lib/melody";

type Tab = "rhythm" | "style" | "structure" | "drums";
type Lead = { style: LeadStyle; bars: number } | null;

/** A groove's first bar as blocks: a strum, an accented strum, a dead strum, a ringing cell, or a rest. */
function Pattern({ pattern, accents }: { pattern: string; accents: number[] }) {
  const cells = [...pattern];
  const eighth = (i: number) => (i * 8) / cells.length;
  return (
    <span className="flex gap-[2px]" aria-hidden="true">
      {cells.map((c, i) => {
        const hit = c === "D" || c === "U";
        const tone = hit ? (accents.includes(eighth(i)) ? "bg-accent" : "bg-text-muted") : c === "x" ? "bg-text-faint" : c === "-" ? "bg-line-strong" : "bg-line";
        return <i key={i} className={`block h-[14px] rounded-[2px] ${cells.length > 8 ? "w-[5px]" : "w-[9px]"} ${tone}`} />;
      })}
    </span>
  );
}

/**
 * A section's Options (docs/song-builder-prd.md §6), under its card: Rhythm (the grooves, each with ▷ to hear
 * it in the song), Playing style (muting, shape size), Structure (how many times it plays; Verse 2's push; the
 * Last chorus up a tone; a lead's length) and Drums. Changes apply at once and only to this section; RESET goes
 * back to what the take chose. Locked sections show why they can't change.
 */
export function SectionOptionsPanel({
  id,
  section,
  label,
  locked,
  options,
  lead,
  grooves,
  timesRange,
  materialBars,
  previewing,
  soloStyles,
  onChange,
  onLead,
  onPreview,
}: {
  id: SectionId;
  section: RenderedSection;
  label: string;
  locked: boolean;
  options: SectionOptions;
  lead: Lead;
  grooves: GrooveChoice[];
  /** How many times each place in the song can play this section (the form's range). */
  timesRange: [number, number];
  /** Bars in one pass of the material (for "16 BARS" labels). */
  materialBars: number;
  /** The groove being previewed, if any. */
  previewing: string | null;
  /** The solo styles the Difficulty allows. */
  soloStyles: string[];
  onChange: (options: SectionOptions) => void;
  onLead: (lead: Lead) => void;
  onPreview: (groove: string) => void;
}) {
  const leadPart = id === "solo" ? "solo" : lead ? "intro" : null;
  // Phones get the short names, so the four tabs share one row without scrolling.
  const tabs: { id: Tab; label: string; short?: string }[] = [
    { id: "rhythm", label: leadPart ? "LEAD STYLE" : "RHYTHM", short: leadPart ? "LEAD" : undefined },
    ...(leadPart ? [] : [{ id: "style" as Tab, label: "PLAYING STYLE", short: "STYLE" }]),
    { id: "structure", label: "STRUCTURE" },
    { id: "drums", label: "DRUMS" },
  ];
  const [tab, setTab] = useState<Tab>("rhythm");
  const base = useId();
  const set = (patch: Partial<SectionOptions>) => {
    const next: SectionOptions = { ...options, ...patch };
    for (const k of Object.keys(next) as (keyof SectionOptions)[]) if (next[k] === undefined || next[k] === false) delete next[k];
    onChange(next);
  };
  const changed = Object.keys(options).length > 0;
  const current = grooves.find((g) => g.name === section.groove);

  if (locked)
    return (
      <p className="m-0 px-[14px] py-[14px] font-mono text-[12px] leading-[1.6] text-text-muted tablet:px-[16px]">
        The {label} is locked. Unlock it to change its options.
      </p>
    );

  const body = () => {
    if (tab === "rhythm" && leadPart) {
      // A solo's styles follow the Difficulty (shred is Intermediate and up).
      const styles = leadPart === "solo" ? SOLO_STYLES.filter((st) => soloStyles.includes(st)) : INTRO_STYLES;
      return (
        <div className="flex flex-col gap-[12px]">
          <p className="m-0 max-w-[72ch] font-mono text-[12px] leading-[1.6] text-text-muted">
            {leadPart === "solo" ? "How the solo plays over the Chorus's chords." : "The Intro plays a melody. Pick its style, or go back to power chords."}
          </p>
          <SegmentedControl
            label={leadPart === "solo" ? "Solo style" : "Melody style"}
            options={styles.map((s) => ({ value: s, label: styleLabel(leadPart, s).toUpperCase() }))}
            value={(lead?.style ?? styles[0]) as LeadStyle}
            onChange={(style) => onLead({ style, bars: lead?.bars ?? RULES.defaults[leadPart].bars })}
          />
        </div>
      );
    }
    if (tab === "rhythm")
      return (
        <div className="flex flex-col gap-[12px]">
          <p className="m-0 max-w-[72ch] font-mono text-[12px] leading-[1.6] text-text-muted">
            {grooves.filter((g) => g.available).length} ways to play the {label.toLowerCase()} here. Tap one to use it; ▷ plays it on its own.
          </p>
          <ul className="grid grid-cols-1 gap-[8px] tablet:grid-cols-2 desktop:grid-cols-3" aria-label={`${label} grooves`}>
            {grooves.map((g) => {
              const inUse = g.name === section.groove;
              return (
                <li
                  key={g.name}
                  className={`relative flex min-h-[72px] flex-col gap-[6px] rounded-outer bg-surface py-[9px] pl-[11px] pr-[48px] ${
                    inUse ? "border-[1.5px] border-accent shadow-card-highlight" : "border border-line"
                  } ${g.available ? "" : "opacity-70"}`}
                >
                  <button
                    type="button"
                    disabled={!g.available}
                    onClick={() => set({ groove: g.name })}
                    aria-pressed={inUse}
                    aria-label={`Use ${g.name}`}
                    className="absolute inset-0 rounded-[inherit] disabled:cursor-not-allowed"
                  />
                  <span className="pointer-events-none font-mono text-[12px] font-bold text-text-primary">{g.name}</span>
                  <span className="pointer-events-none">
                    <Pattern pattern={g.pattern} accents={g.accents} />
                  </span>
                  {!g.available ? (
                    <span className="pointer-events-none font-mono text-[12px] text-text-faint">{g.reason}</span>
                  ) : inUse ? (
                    <span className="pointer-events-none font-mono text-[12px] text-brass">In use</span>
                  ) : null}
                  {g.available && (
                    <PlayButton
                      playing={previewing === g.name}
                      onClick={() => onPreview(g.name)}
                      label={`${g.name} groove`}
                      iconSize={11}
                      className="absolute right-[2px] top-[2px] z-10"
                    />
                  )}
                </li>
              );
            })}
          </ul>
          {id === "intro" && (
            <button
              type="button"
              onClick={() => onLead({ style: "hook", bars: RULES.defaults.intro.bars })}
              className="self-start min-h-[44px] rounded-mid border border-line bg-surface px-[12px] font-mono text-[12px] font-bold hover:border-accent"
            >
              Play a melody instead
            </button>
          )}
        </div>
      );
    if (tab === "style") {
      if (section.riff)
        return (
          <div className="grid grid-cols-1 gap-[12px] tablet:grid-cols-2">
            <Group label="Sound">
              <SegmentedControl
                label={`${label} sound`}
                options={[
                  { value: "own", label: "RIFF'S OWN" },
                  { value: "pm", label: "PALM-MUTED" },
                  { value: "ring", label: "OPEN" },
                ]}
                value={options.sound ?? "own"}
                onChange={(v) => set({ sound: v === "own" ? undefined : (v as "pm" | "ring") })}
              />
            </Group>
            <p className="m-0 self-end font-mono text-[12px] leading-[1.6] text-text-faint">Riffs play single notes and octaves, so there&apos;s no shape size to pick.</p>
          </div>
        );
      const sizes = current?.sizes ?? [];
      return (
        <div className="grid grid-cols-1 gap-[12px] tablet:grid-cols-2">
          <Group label="Sound">
            <SegmentedControl
              label={`${label} sound`}
              options={[
                { value: "own", label: "GROOVE'S OWN" },
                { value: "pm", label: "PALM-MUTED" },
                { value: "ring", label: "OPEN" },
              ]}
              value={options.sound ?? "own"}
              onChange={(v) => set({ sound: v === "own" ? undefined : (v as "pm" | "ring") })}
            />
          </Group>
          <Group label="Shapes">
            <SegmentedControl
              label={`${label} shapes`}
              options={[
                { value: "mix", label: "MIX" },
                ...(sizes.includes("two") ? [{ value: "two", label: "2-NOTE" }] : []),
                ...(sizes.includes("three") ? [{ value: "three", label: "3-NOTE" }] : []),
              ]}
              value={options.shape ?? "mix"}
              onChange={(v) => set({ shape: v === "mix" ? undefined : (v as "two" | "three") })}
            />
          </Group>
        </div>
      );
    }
    if (tab === "structure") {
      const [lo, hi] = timesRange;
      const counts = Array.from({ length: hi - lo + 1 }, (_, k) => lo + k);
      return (
        <div className="grid grid-cols-1 gap-[12px] tablet:grid-cols-2">
          <Group label="Each time it plays">
            <SegmentedControl
              label={`${label}: each time it plays`}
              options={[
                { value: "auto", label: "FITS THE SONG" },
                ...counts.map((n) => ({ value: String(n), label: `${n * materialBars} BARS`, sub: `×${n}` })),
              ]}
              value={options.times ? String(options.times) : "auto"}
              onChange={(v) => set({ times: v === "auto" ? undefined : Number(v) })}
              className="flex-wrap"
            />
          </Group>
          {leadPart && (
            <Group label={leadPart === "solo" ? "Solo length" : "Melody length"}>
              <SegmentedControl
                label={leadPart === "solo" ? "Solo length" : "Melody length"}
                options={RULES.lengths[leadPart].map((b) => ({ value: String(b), label: `${b} BARS` }))}
                value={String(lead?.bars ?? RULES.defaults[leadPart].bars)}
                onChange={(b) => onLead({ style: (lead?.style ?? RULES.defaults[leadPart].style) as LeadStyle, bars: Number(b) })}
              />
            </Group>
          )}
          {id === "verse" && (
            <Group label="Verse 2">
              <SegmentedControl
                label="Verse 2"
                options={[
                  { value: "push", label: "ADDS A PUSH" },
                  { value: "same", label: "SAME AS VERSE 1" },
                ]}
                value={options.noPush ? "same" : "push"}
                onChange={(v) => set({ noPush: v === "same" })}
              />
            </Group>
          )}
          {id === "chorus" && (
            <Group label="Last chorus">
              <SegmentedControl
                label="Last chorus"
                options={[
                  { value: "same", label: "SAME KEY" },
                  { value: "up", label: "UP A TONE" },
                ]}
                value={options.keyUp ? "up" : "same"}
                onChange={(v) => set({ keyUp: v === "up" })}
              />
            </Group>
          )}
        </div>
      );
    }
    return (
      <Group label="Drums">
        <SegmentedControl
          label={`${label} drums`}
          options={[
            { value: "own", label: section.lead ? "FULL BAND" : "GROOVE'S OWN" },
            { value: "half", label: "HALF-TIME" },
            { value: "none", label: "NO DRUMS" },
          ]}
          value={options.drums ?? "own"}
          onChange={(v) => set({ drums: v === "own" ? undefined : (v as "half" | "none") })}
        />
      </Group>
    );
  };

  return (
    <div>
      <div role="tablist" aria-label={`${label} options`} className="flex flex-wrap border-b border-line px-[6px] tablet:gap-[4px] tablet:px-[16px]">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`${base}-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`${base}-panel`}
            onClick={() => setTab(t.id)}
            className={`-mb-px min-h-[44px] flex-auto whitespace-nowrap border-b-2 px-[8px] font-mono text-[12px] tracking-[0.04em] tablet:flex-none tablet:px-[12px] tablet:tracking-[0.06em] ${
              tab === t.id ? "border-accent font-bold text-text-primary" : "border-transparent text-text-muted hover:text-text-primary"
            }`}
          >
            {t.short ? (
              <>
                <span className="tablet:hidden">{t.short}</span>
                <span className="hidden tablet:inline">{t.label}</span>
              </>
            ) : (
              t.label
            )}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${base}-panel`} aria-labelledby={`${base}-${tab}`} className="px-[14px] py-[14px] tablet:px-[16px]">
        {body()}
      </div>
      <div className="flex flex-wrap items-center gap-[8px] px-[14px] pb-[14px] tablet:px-[16px]">
        <span className="mr-auto font-mono text-[12px] text-text-faint">Changes the {label.toLowerCase()} only, everywhere it plays.</span>
        {changed && (
          <button type="button" onClick={() => onChange({})} className="min-h-[44px] rounded-mid border border-line bg-surface px-[12px] font-mono text-[12px] font-bold hover:border-accent">
            RESET TO THE TAKE
          </button>
        )}
      </div>
    </div>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-[6px]">
      <span className="font-mono text-[12px] uppercase tracking-[0.08em] text-text-faint">{label}</span>
      {children}
    </div>
  );
}
