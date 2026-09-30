"use client";

import { ControlCard } from "@/components/ControlCard";
import { FeelToggle } from "@/components/FeelToggle";
import { GenerateButton, PlaySongButton } from "@/components/GenerateButton";
import { KeyPicker } from "@/components/KeyPicker";
import { OriginalityBadge } from "@/components/OriginalityBadge";
import { type GuideStep, PageGuide } from "@/components/PageGuide";
import { PageHeader } from "@/components/PageHeader";
import { PowerChordsPanel } from "@/components/PowerChordsPanel";
import { RhythmLane } from "@/components/RhythmLane";
import { FormStrip } from "@/components/FormStrip";
import { SectionCard } from "@/components/SectionCard";
import { tabChars } from "@/components/TabBlock";
import { type GeneratorState, inputsFor, useGenerator } from "@/context/GeneratorContext";
import { SECTION_IDS, type SectionId } from "@/lib/generator";
import { keyDisplayName } from "@/lib/musicTheory";
import { VARIATIONS, planNote, usesProgression } from "@/lib/songPlan";

const GUIDE: GuideStep[] = [
  { title: "Key + feel", body: <>Pick a <b>key</b> for every chord, and a <b>feel</b> for the strum and tempo.</> },
  { title: "Generate", body: <><b>GENERATE</b> writes a whole song as real power-chord tabs, every part built on one progression.</> },
  { title: "Lock & remix", body: <><b>Lock</b> a section to keep it. <b>↻</b> rewrites just that one.</> },
  { title: "Play along", body: <><b>▷</b> loops a part, <b>PLAY SONG</b> plays it all (or tap a part in the running order). Tap a Power Chords row to change the progression.</> },
];

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
  const { state, rendered, song, setKey, setFeel, setMidTempoBpm, generate, regenerateSection, toggleLock, updateLocked, setProgression, togglePlay, playSongFrom, playStrum, clearIntroLead, activeSection, activePart } =
    useGenerator();

  // One tab scale for the chord cards: the widest chord tab showing. Lead tabs (the Solo, an Intro
  // melody) use it too when they fit; a lead line dense with technique marks shrinks only itself.
  const sharedTabChars = Math.max(...SECTION_IDS.filter((id) => !rendered[id].lead).map((id) => tabChars(rendered[id].tab)));

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-[14px] px-[20px] pb-[28px] pt-[22px] tablet:gap-[18px] tablet:px-[32px] tablet:pb-[36px] tablet:pt-[28px] desktop:gap-[20px] desktop:flex-1 desktop:px-[56px] desktop:pb-[22px] desktop:pt-[32px]">
      <PageHeader kicker="SONGWRITING ENGINE" title="SONG GENERATOR" aside={<OriginalityBadge />} />
      <PageGuide page="generator" label="How to use the Generator" steps={GUIDE} signature="A WHOLE SONG · REAL TABS · ONE PROGRESSION" />

      <div className="flex flex-col gap-[14px] tablet:flex-row tablet:flex-wrap tablet:items-stretch tablet:gap-[12px]">
        {/* Key gets its own row until Key, the five-feel control and the buttons fit side by side (1440px). */}
        <ControlCard label="Key" className="tablet:basis-full min-[1440px]:basis-auto">
          <KeyPicker value={state.key} onChange={setKey} />
        </ControlCard>
        <ControlCard label="Feel">
          <FeelToggle feel={state.feel} midTempoBpm={state.midTempoBpm} onFeelChange={setFeel} onBpmChange={setMidTempoBpm} />
        </ControlCard>
        <div className="flex flex-col gap-[10px] tablet:ml-auto tablet:justify-center">
          <GenerateButton onClick={generate} />
          <PlaySongButton playing={state.playing === "song"} onClick={() => togglePlay("song")} />
        </div>
      </div>

      <FormStrip
        parts={song.map(({ slot, section, times }) => ({ slot, bars: section.bars.length * section.repeat * times }))}
        activePart={activePart}
        locked={(slot) => state.sections[slot.section].locked}
        onPlayFrom={playSongFrom}
      />

      {/* One card per part (option A, DECISIONS.md): repeats in the running order reuse the card's material. */}
      <div className="grid grid-cols-1 gap-x-[12px] gap-y-[12px] tablet:grid-cols-2 desktop:grid-cols-4">
        {SECTION_IDS.map((id, i) => (
          <SectionCard
            key={id}
            section={rendered[id]}
            index={i}
            locked={state.sections[id].locked}
            {...lockInfo(state, id)}
            active={activeSection === id}
            progressionId={id === "chorus" ? inputsFor(state, "chorus").progressionId : undefined}
            plan={planNote(id, inputsFor(state, id).progressionId)}
            uses={song.flatMap(({ slot }, part) =>
              slot.section === id ? [{ name: slot.name, variation: slot.variation && VARIATIONS[slot.variation].label, active: activePart === part }] : [],
            )}
            playing={state.playing === `section:${id}`}
            onRegenerate={() => regenerateSection(id)}
            onToggleLock={() => toggleLock(id)}
            onUpdate={() => updateLocked(id)}
            onTogglePlay={() => togglePlay(`section:${id}`)}
            tabChars={sharedTabChars}
            wideOnTablet={id === "ending"}
            extraAction={
              id === "intro" && state.sections.intro.lead && !state.sections.intro.locked
                ? { label: "Back to power chords", onClick: clearIntroLead }
                : undefined
            }
            className={id === "ending" ? "tablet:col-span-2 desktop:col-span-1" : ""}
          />
        ))}
      </div>

      <div className="flex flex-col gap-[14px] tablet:gap-[18px] desktop:flex-grow desktop:flex-row desktop:gap-[14px]">
        <PowerChordsPanel
          keyName={state.key}
          selectedId={state.progressionId}
          playing={state.playing}
          onSelect={setProgression}
          onTogglePlay={(id) => togglePlay(`progression:${id}`)}
        />
        <RhythmLane
          activeFeel={state.feel}
          progressionId={state.progressionId}
          keyName={state.key}
          playing={state.playing === "strum"}
          onSelect={setFeel}
          onTogglePlay={playStrum}
        />
      </div>
    </div>
  );
}
