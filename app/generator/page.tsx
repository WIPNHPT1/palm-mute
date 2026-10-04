"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ControlCard } from "@/components/ControlCard";
import { FeelToggle } from "@/components/FeelToggle";
import { GenerateButton, PlaySongButton, RebuildButton } from "@/components/GenerateButton";
import { KeyPicker } from "@/components/KeyPicker";
import { LengthControl } from "@/components/LengthControl";
import { MidiExportCard } from "@/components/MidiExportCard";
import { PdfExportCard } from "@/components/PdfExportCard";
import { OriginalityBadge } from "@/components/OriginalityBadge";
import { type GuideStep, PageGuide } from "@/components/PageGuide";
import { PageHeader } from "@/components/PageHeader";
import { ProgressionRow } from "@/components/ProgressionRow";
import { FormStrip } from "@/components/FormStrip";
import { SectionCard } from "@/components/SectionCard";
import { SectionOptionsPanel } from "@/components/SectionOptionsPanel";
import { SetupSummary } from "@/components/SetupSummary";
import { SongHeader } from "@/components/SongHeader";
import { StageBackground } from "@/components/StageBackground";
import { Transport } from "@/components/Transport";
import { ShareCard, copyText } from "@/components/ShareCard";
import { decodeSong } from "@/lib/share";
import { type GeneratorState, inputsFor, useGenerator } from "@/context/GeneratorContext";
import { DIFFICULTIES, DIFFICULTY, SECTION_IDS, type SectionId, getFeel, grooveChoices, libraryVoicings, plannedDegrees, renderSection } from "@/lib/generator";
import { type PresetId, PRESETS, PRESET_IDS } from "@/lib/presets";
import { SegmentedControl } from "@/components/SegmentedControl";
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

/** What each Difficulty level means for the tabs (data/difficulty.json, data/playability.json). */
const DIFFICULTY_NOTES = {
  beginner: "Eighth notes and 2-note shapes, no riffs, shorter downpicked runs.",
  intermediate: "Gallops and riffs; downpicked runs up to 16.",
  advanced: "Everything, including long downpicked runs.",
} as const;

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
    setLength,
    setDifficulty,
    applyPreset,
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
    position,
    practice,
    setSpeed,
    setCountIn,
    setLoopPart,
    selectTake,
    loadShared,
    shareFragment,
  } = useGenerator();

  // A link ("#song=…"): open that song. A link that is the visitor's own (the address bar follows their song, below,
  // so a reload or Back returns to it) opens quietly; one that came from elsewhere says it's a shared song.
  const [shared, setShared] = useState<"loaded" | "invalid" | null>(null);
  useEffect(() => {
    const open = (quietly: boolean) => {
      if (!location.hash.includes("song=")) return;
      const song = decodeSong(location.hash);
      if (song) {
        loadShared(song);
        setShared(quietly ? null : "loaded");
        setSetupOpen(false);
      } else {
        setShared("invalid");
        history.replaceState(null, "", location.pathname + location.search);
      }
    };
    // The page opening: a reload, or Back to the page, is the visitor's own song; a link followed from elsewhere is a shared one.
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    open(nav?.type === "reload" || nav?.type === "back_forward");
    // A link pasted into the open page only changes its address's hash: that's a link from elsewhere too. (The page's
    // own updates use replaceState, which doesn't fire this.)
    const onHash = () => open(false);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
    // Only when the page opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // The page's address is only known in the browser (the static page renders without it).
  const [here, setHere] = useState("");
  useEffect(() => setHere(location.origin + location.pathname), []);
  const link = here ? `${here}#${shareFragment()}` : "";
  const [linkStatus, setLinkStatus] = useState("");

  // Keyboard: Space plays or stops the song, R builds it again (not while typing, or on a focused control).
  const keys = useRef({ togglePlay, generate });
  keys.current = { togglePlay, generate };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, select, button, a, [role=radio], [role=tab], [contenteditable=true]")) return;
      if (e.code === "Space") {
        e.preventDefault();
        keys.current.togglePlay("song");
      } else if (e.key === "r" || e.key === "R") keys.current.generate();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // The setup is open until BUILD SONG, then folds to a one-line summary (EDIT SETUP opens it again).
  const [setupOpen, setSetupOpen] = useState(true);
  // Once a song is built (or opened from a link) its link follows it in the address bar, so a reload or Back brings
  // it back. Nothing is stored: the song is in the link. A fresh visit with no link behaves as it always did.
  useEffect(() => {
    if (setupOpen) return;
    const t = setTimeout(() => {
      history.replaceState(null, "", `${location.pathname}${location.search}#${shareFragment()}`);
    }, 400);
    return () => clearTimeout(t);
  }, [setupOpen, shareFragment]);
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
    <div data-spotlight className="mx-auto flex w-full max-w-[var(--page-max)] flex-col gap-[14px] px-[20px] pb-[28px] pt-[22px] tablet:gap-[18px] tablet:px-[32px] tablet:pb-[36px] tablet:pt-[28px] desktop:gap-[20px] desktop:flex-1 desktop:px-[56px] desktop:pb-[22px] desktop:pt-[32px]">
      <StageBackground playing={state.playing !== null} />
      <PageHeader kicker="SONGWRITING ENGINE" title="SONG GENERATOR" aside={<OriginalityBadge />} />
      <PageGuide page="generator" label="How to use the Generator" steps={GUIDE} signature="YOUR KEY · YOUR LENGTH · EVERY PART" />

      {setupOpen ? (
        <section aria-label="Set up your song" data-setup className="flex flex-col gap-[14px] tablet:gap-[12px]">
          {/* An optional starting point (docs/song-builder-prd.md B11): it sets the steps below, which stay editable. */}
          <ControlCard label="Start from a style" picked={state.preset ? PRESETS[state.preset].label : "Your own"} hint="Optional · sets the steps below">
            <SegmentedControl
              label="Style preset"
              options={[{ value: "own", label: "YOUR OWN" }, ...PRESET_IDS.map((id) => ({ value: id, label: PRESETS[id].label.toUpperCase() }))]}
              value={state.preset ?? "own"}
              onChange={(v) => applyPreset(v === "own" ? null : (v as PresetId))}
              stretch
              className="flex-wrap tablet:flex-nowrap"
            />
            <p className="m-0 font-mono text-[12px] leading-[1.6] text-text-muted" data-preset-description>
              {state.preset ? PRESETS[state.preset].description : "Pick everything yourself, or start from a style and change what you like."}
            </p>
          </ControlCard>
          <div className="flex flex-col gap-[14px] tablet:flex-row tablet:flex-wrap tablet:items-stretch tablet:gap-[12px]">
            {/* Key gets its own row until Key and the five-feel control fit side by side (1440px). */}
            <ControlCard id={STEPS[0]} step={1} label="Key" picked={keyDisplayName(state.key)} className="tablet:basis-full min-[1440px]:basis-auto">
              <KeyPicker value={state.key} onChange={setKey} />
            </ControlCard>
            <ControlCard id={STEPS[1]} step={2} label="Feel" picked={feelLabel} className="tablet:flex-1">
              <FeelToggle feel={state.feel} onFeelChange={setFeel} />
            </ControlCard>
          </div>
          <ControlCard id={STEPS[2]} step={3} label="Chords" picked={state.progressionId} hint={`Tap to use · ▷ to hear it in ${keyDisplayName(state.key)}`}>
            <div className="grid grid-cols-1 gap-[6px] tablet:grid-cols-2 tablet:gap-[8px]">
              {progressions.map((p, i) => (
                <ProgressionRow
                  key={p.id}
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
              <div className="flex flex-col gap-[6px] tablet:w-[320px]">
                <span className="font-mono text-[12px] uppercase tracking-[0.08em] text-text-faint">Difficulty</span>
                <SegmentedControl
                  label="Difficulty"
                  options={DIFFICULTIES.map((d) => ({ value: d, label: DIFFICULTY[d].label.toUpperCase() }))}
                  value={state.difficulty}
                  onChange={setDifficulty}
                  stretch
                />
                <span className="font-mono text-[12px] leading-[1.5] text-text-faint" data-difficulty-note>
                  {DIFFICULTY_NOTES[state.difficulty]}
                </span>
              </div>
            </div>
            <div className="flex justify-end">
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
            { step: 3, label: "Level", value: DIFFICULTY[state.difficulty].label },
          ]}
          onEdit={editSetup}
        />
      )}

      {shared && (
        <div role="status" data-shared-notice className="sig-notice flex flex-wrap items-center gap-[10px] rounded-outer border border-line bg-surface px-[16px] py-[10px] font-mono text-[12px] text-text-secondary">
          <svg className="sig-notice-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 11v5M12 8h.01" />
          </svg>
          <span className="mr-auto">{shared === "loaded" ? "You're listening to a shared song. Change anything you like: it's yours now." : "That link couldn't be read, so here's a fresh song instead."}</span>
          <button type="button" onClick={() => setShared(null)} className="min-h-[44px] px-[8px] font-bold hover:text-text-primary">
            DISMISS
          </button>
        </div>
      )}

      <section ref={songRef} aria-label="Your song" className="flex scroll-mt-[96px] flex-col gap-[12px] tablet:gap-[14px]">
        <p className="sr-only" role="status">
          {linkStatus}
        </p>
        <SongHeader
          title={state.title}
          facts={`${keyDisplayName(state.key)} · ${feelLabel} · ${bpm} BPM · ${state.progressionId}`}
          detail={`${formatLength(plan.seconds)} · ${plan.bars} bars · ${formLabel(plan.form)}`}
          actions={
            <>
              <button
                type="button"
                onClick={async () => setLinkStatus((await copyText(link)) ? "Link copied." : "Copy the link from Share the song below.")}
                className="flex min-h-[48px] items-center justify-center gap-[8px] rounded-outer border border-line bg-paper px-[16px] font-mono text-[12px] font-bold hover:border-accent"
              >
                COPY LINK
              </button>
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
                nowBar={position?.section === id ? position.bar : null}
                takes={{ take: s.take, count: s.takes.length, onSelect: (take) => selectTake(id, take) }}
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
                    soloStyles={DIFFICULTY[state.difficulty].soloStyles}
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

      {/* Take it away (docs/song-builder-prd.md B8–B9): the song as files. */}
      <section aria-labelledby="export-title" data-export-section className="flex flex-col gap-[12px]">
        <p id="export-title" className="m-0 mt-[8px] font-mono text-[12px] tracking-[0.13em] text-accent">
          TAKE IT AWAY
        </p>
        <div className="grid grid-cols-1 gap-[12px] tablet:grid-cols-2">
          <PdfExportCard
            input={{
              song: { plan, parts: song },
              rendered,
              title: state.title,
              keyName: keyDisplayName(state.key),
              feel: feelLabel,
              bpm,
              progressionId: state.progressionId,
              degrees: Object.fromEntries(
                SECTION_IDS.flatMap((id) => (id === "solo" || rendered[id].lead ? [] : [[id, plannedDegrees(id, inputsFor(state, id).progressionId, rendered[id].groove)]])),
              ),
            }}
          />
          <MidiExportCard song={{ plan, parts: song }} bpm={bpm} keyName={state.key} progressionId={state.progressionId} title={state.title} />
          <ShareCard link={link} />
        </div>
      </section>

      <Transport
        playing={state.playing === "song"}
        onPlay={() => togglePlay("song")}
        partName={activePart !== null ? song[activePart]?.slot.name ?? null : position ? rendered[position.section].label : null}
        songBar={position?.songBar ?? null}
        totalBars={plan.bars}
        barSeconds={barSeconds(bpm)}
        practice={practice}
        onSpeed={setSpeed}
        onCountIn={setCountIn}
        onLoopPart={setLoopPart}
      />
    </div>
  );
}
