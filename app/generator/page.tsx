"use client";

import { useCallback, useRef, useState } from "react";
import { ControlCard } from "@/components/ControlCard";
import { FeelToggle } from "@/components/FeelToggle";
import { GenerateButton, PlaySongButton, RebuildButton } from "@/components/GenerateButton";
import { KeyPicker } from "@/components/KeyPicker";
import { LengthControl } from "@/components/LengthControl";
import { OriginalityBadge } from "@/components/OriginalityBadge";
import { type GuideStep, PageGuide } from "@/components/PageGuide";
import { PageHeader } from "@/components/PageHeader";
import { ProgressionRow } from "@/components/ProgressionRow";
import { FormStrip } from "@/components/FormStrip";
import { SectionCard } from "@/components/SectionCard";
import { SectionOptionsPanel } from "@/components/SectionOptionsPanel";
import { SetupSummary } from "@/components/SetupSummary";
import { SongHeader } from "@/components/SongHeader";
import { type GeneratorState, inputsFor, useGenerator } from "@/context/GeneratorContext";
import { SECTION_IDS, type SectionId, getFeel, grooveChoices, libraryVoicings, plannedDegrees, renderSection } from "@/lib/generator";
import { styleLabel } from "@/lib/melody";
import { sectionBars } from "@/lib/playback";
import { keyDisplayName, progressions } from "@/lib/musicTheory";
import { barSeconds, formatLength } from "@/lib/songLength";
import { VARIATIONS, formLabel, formSpec, planNote, usesProgression } from "@/lib/songPlan";

// "How to use": the Setlist posters with the song builder's steps (docs/song-builder-prd.md B13).
const GUIDE: GuideStep[] = [
  { title: "Set up", body: <>Pick a <b>key</b>, a <b>feel</b>, the <b>chords</b> and how <b>long</b> the song runs, from 2:30 to 5:30.</> },
  { title: "Build", body: <><b>BUILD SONG</b> writes every part as real power-chord tabs, sized to fit your length.</> },
  { title: "Shape each part", body: <>Open a part&apos;s <b>Options</b> to change its rhythm, style, bars or drums. <b>Lock</b> what you love; ↻ tries a new take.</> },
  { title: "Take it away", body: <>Practise with <b>loop</b> and <b>speed</b>, then download the <b>PDF</b> songbook or <b>MIDI</b>, or copy a link.</> },
];

/** The setup's cards, in step order (the summary's buttons reopen the setup at one of them). */
const STEPS = ["setup-key", "setup-feel", "setup-chords", "setup-length"] as const;

/** "Fast Punk" from "FAST PUNK". */
const titleCase = (s: string) => s.toLowerCase().replace(/(^|[\s-])\w/g, (m) => m.toUpperCase());

/**
 * "Locked in A · I-V-vi-IV" (the progression for every part built on it) and, if the page has moved on,
 * what "Update to …" gives.
 */
function lockInfo(state: GeneratorState, id: SectionId): { lockedIn?: string; updateTo?: string } {
  const frozen = state.sections[id].locked ? state.sections[id].frozen : null;
  if (!frozen) return {};
  const follows = usesProgression(id);
  const lockedIn = keyDisplayName(frozen.key) + (follows ? ` · ${frozen.progressionId}` : "");
  const changes: string[] = [];
  if (frozen.key !== state.key) changes.push(keyDisplayName(state.key));
  if (follows && frozen.progressionId !== state.progressionId) changes.push(state.progressionId);
  return { lockedIn, updateTo: changes.length ? changes.join(" · ") : undefined };
}

export default function GeneratorPage() {
  const {
    state,
    rendered,
    song,
    plan,
    bpm,
    setKey,
    setFeel,
    setMidTempoBpm,
    setLength,
    setOptions,
    setLead,
    playCustom,
    generate,
    regenerateSection,
    toggleLock,
    updateLocked,
    setProgression,
    togglePlay,
    playSongFrom,
    clearIntroLead,
    activeSection,
    activePart,
  } = useGenerator();

  // The setup is open until BUILD SONG, then folds to a one-line summary (EDIT SETUP opens it again).
  const [setupOpen, setSetupOpen] = useState(true);
  const songRef = useRef<HTMLElement>(null);
  const reducedMotion = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  const build = () => {
    generate();
    setSetupOpen(false);
    requestAnimationFrame(() => songRef.current?.scrollIntoView({ block: "start", behavior: reducedMotion() ? "auto" : "smooth" }));
  };
  const editSetup = (step: number) => {
    setSetupOpen(true);
    requestAnimationFrame(() => {
      const card = document.getElementById(STEPS[step]);
      card?.scrollIntoView({ block: "start", behavior: reducedMotion() ? "auto" : "smooth" });
      card?.querySelector<HTMLElement>("button, input")?.focus({ preventScroll: true });
    });
  };

  // One pass of a section's material, in bars (the Verse's 4 bars × 2): what the length plan multiplies.
  const materialBars = useCallback((id: SectionId) => rendered[id].bars.length * rendered[id].repeat, [rendered]);

  /** How many times each place can play a section in the song's form (the Structure option's range). */
  const timesRange = (id: SectionId): [number, number] => {
    const slots = formSpec(plan.form).filter((s) => s.section === id);
    return slots.length ? [Math.min(...slots.map((s) => s.min)), Math.max(...slots.map((s) => s.max))] : [1, 2];
  };
  /** ▷ on a groove: the section with that groove, looped on its own (the song doesn't change). */
  const previewGroove = (id: SectionId, groove: string) => {
    const inputs = inputsFor(state, id);
    playCustom(`groove:${id}:${groove}`, sectionBars(renderSection(id, { ...inputs, options: { ...inputs.options, groove } })), true);
  };
  const previewing = (id: SectionId) => {
    const prefix = `custom:groove:${id}:`;
    return state.playing?.startsWith(prefix) ? state.playing.slice(prefix.length) : null;
  };

  const feelLabel = titleCase(getFeel(state.feel).label);
  const parts = (() => {
    let at = 0;
    return song.map(({ slot, section, times }) => {
      const bars = section.bars.length * section.repeat * times;
      const part = { slot, bars, start: at * barSeconds(bpm) };
      at += bars;
      return part;
    });
  })();

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-[14px] px-[20px] pb-[28px] pt-[22px] tablet:gap-[18px] tablet:px-[32px] tablet:pb-[36px] tablet:pt-[28px] desktop:gap-[20px] desktop:flex-1 desktop:px-[56px] desktop:pb-[22px] desktop:pt-[32px]">
      <PageHeader kicker="SONGWRITING ENGINE" title="SONG GENERATOR" aside={<OriginalityBadge />} />
      <PageGuide page="generator" label="How to use the Generator" steps={GUIDE} signature="YOUR KEY · YOUR LENGTH · EVERY PART" />

      {setupOpen ? (
        <section aria-label="Set up your song" data-setup className="flex flex-col gap-[14px] tablet:gap-[12px]">
          <div className="flex flex-col gap-[14px] tablet:flex-row tablet:flex-wrap tablet:items-stretch tablet:gap-[12px]">
            {/* Key gets its own row until Key and the five-feel control fit side by side (1440px). */}
            <ControlCard id={STEPS[0]} step={1} label="Key" picked={keyDisplayName(state.key)} className="tablet:basis-full min-[1440px]:basis-auto">
              <KeyPicker value={state.key} onChange={setKey} />
            </ControlCard>
            <ControlCard id={STEPS[1]} step={2} label="Feel" picked={feelLabel} className="tablet:flex-1">
              <FeelToggle feel={state.feel} midTempoBpm={state.midTempoBpm} onFeelChange={setFeel} onBpmChange={setMidTempoBpm} />
            </ControlCard>
          </div>
          <ControlCard id={STEPS[2]} step={3} label="Chords" picked={state.progressionId} hint={`Tap to use · ▷ to hear it in ${keyDisplayName(state.key)}`}>
            <div className="grid grid-cols-1 gap-[6px] tablet:grid-cols-2 tablet:gap-[8px]">
              {progressions.map((p, i) => (
                <ProgressionRow
                  key={p.id}
                  variant="panel"
                  progression={p}
                  chords={libraryVoicings(state.key, p.id)}
                  variantIndex={i}
                  highlighted={p.id === state.progressionId}
                  selected={p.id === state.progressionId}
                  badge={p.tag === "most-common" ? "Most common" : undefined}
                  selectLabel={`Use ${p.id} for the song`}
                  onSelect={() => setProgression(p.id)}
                  playing={state.playing === `progression:${p.id}`}
                  onTogglePlay={() => togglePlay(`progression:${p.id}`)}
                />
              ))}
            </div>
          </ControlCard>
          <ControlCard id={STEPS[3]} step={4} label="Length" hint="2:30 to 5:30">
            <div className="flex flex-col gap-[14px] tablet:flex-row tablet:items-end tablet:gap-[24px]">
              <div className="min-w-0 flex-1">
                <LengthControl seconds={state.lengthSec} plan={plan} bpm={bpm} materialBars={materialBars} onChange={setLength} />
              </div>
              <GenerateButton onClick={build} label="BUILD SONG" />
            </div>
          </ControlCard>
        </section>
      ) : (
        <SetupSummary
          items={[
            { step: 0, label: "Key", value: keyDisplayName(state.key) },
            { step: 1, label: "Feel", value: `${feelLabel} · ${bpm}` },
            { step: 2, label: "Chords", value: state.progressionId },
            { step: 3, label: "Length", value: formatLength(state.lengthSec) },
          ]}
          onEdit={editSetup}
        />
      )}

      <section ref={songRef} aria-label="Your song" className="flex scroll-mt-[96px] flex-col gap-[12px] tablet:gap-[14px]">
        <SongHeader
          title={state.title}
          facts={`${keyDisplayName(state.key)} · ${feelLabel} · ${bpm} BPM · ${state.progressionId}`}
          detail={`${formatLength(plan.seconds)} · ${plan.bars} bars · ${formLabel(plan.form)}`}
          actions={
            <>
              {/* Another take of the whole song on the same setup, without reopening it. */}
              <RebuildButton onClick={generate} />
              <PlaySongButton playing={state.playing === "song"} onClick={() => togglePlay("song")} />
            </>
          }
        />

        <FormStrip parts={parts} activePart={activePart} locked={(slot) => state.sections[slot.section].locked} onPlayFrom={playSongFrom} />

        {/* One full-width card per section (docs/song-builder-prd.md B5): repeats in the running order reuse its material. */}
        <div className="flex flex-col gap-[12px]" data-sections>
          {SECTION_IDS.map((id, i) => {
            const section = rendered[id];
            const s = state.sections[id];
            return (
              <SectionCard
                key={id}
                section={section}
                index={i}
                locked={s.locked}
                {...lockInfo(state, id)}
                active={activeSection === id}
                progressionId={id === "chorus" ? inputsFor(state, "chorus").progressionId : undefined}
                plan={planNote(id, inputsFor(state, id).progressionId)}
                uses={song.flatMap(({ slot }, part) =>
                  slot.section === id
                    ? [
                        {
                          name: slot.times > 1 ? `${slot.name} ×${slot.times}` : slot.name,
                          start: formatLength(parts[part].start),
                          variation: slot.variation && VARIATIONS[slot.variation].label,
                          active: activePart === part,
                        },
                      ]
                    : [],
                )}
                playing={state.playing === `section:${id}`}
                onRegenerate={() => regenerateSection(id)}
                onToggleLock={() => toggleLock(id)}
                onUpdate={() => updateLocked(id)}
                onTogglePlay={() => togglePlay(`section:${id}`)}
                extraAction={id === "intro" && s.lead && !s.locked ? { label: "Back to power chords", onClick: clearIntroLead } : undefined}
                degrees={id === "solo" || section.lead ? undefined : plannedDegrees(id, inputsFor(state, id).progressionId, section.groove)}
                optionsSummary={section.lead ? `${styleLabel(id === "solo" ? "solo" : "intro", section.lead.inputs.style)} · ${section.lead.chords.length} bars` : section.groove}
                options={
                  <SectionOptionsPanel
                    id={id}
                    section={section}
                    label={section.label}
                    locked={s.locked}
                    options={s.options}
                    lead={s.lead ? { style: s.lead.style, bars: s.lead.bars } : null}
                    grooves={grooveChoices(id, inputsFor(state, id))}
                    timesRange={timesRange(id)}
                    materialBars={materialBars(id)}
                    previewing={previewing(id)}
                    onChange={(options) => setOptions(id, options)}
                    onLead={(lead) => setLead(id, lead)}
                    onPreview={(groove) => previewGroove(id, groove)}
                  />
                }
              />
            );
          })}
        </div>
      </section>
    </div>
  );
}
