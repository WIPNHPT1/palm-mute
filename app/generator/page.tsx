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
import { SectionCard } from "@/components/SectionCard";
import { tabChars } from "@/components/TabBlock";
import { type GeneratorState, inputsFor, useGenerator } from "@/context/GeneratorContext";
import { SECTION_IDS, type SectionId } from "@/lib/generator";
import { keyDisplayName } from "@/lib/musicTheory";

const GUIDE: GuideStep[] = [
  { title: "Key + feel", body: <>Pick a <b>key</b> for every chord, and a <b>feel</b> for the strum and tempo.</> },
  { title: "Generate", body: <><b>GENERATE</b> writes all five sections as real power-chord tabs.</> },
  { title: "Lock & remix", body: <><b>Lock</b> a section to keep it. <b>↻</b> rewrites just that one.</> },
  { title: "Play along", body: <><b>▷</b> loops a section, <b>PLAY SONG</b> plays it all. Tap a Power Chords row to change the chorus.</> },
];

/** "Locked in A" (plus the progression for the Chorus) and, if the page has moved on, what "Update to …" gives. */
function lockInfo(state: GeneratorState, id: SectionId): { lockedIn?: string; updateTo?: string } {
  const frozen = state.sections[id].locked ? state.sections[id].frozen : null;
  if (!frozen) return {};
  const chorus = id === "chorus";
  const lockedIn = keyDisplayName(frozen.key) + (chorus ? ` · ${frozen.progressionId}` : "");
  const changes: string[] = [];
  if (frozen.key !== state.key) changes.push(keyDisplayName(state.key));
  if (chorus && frozen.progressionId !== state.progressionId) changes.push(state.progressionId);
  return { lockedIn, updateTo: changes.length ? changes.join(" · ") : undefined };
}

export default function GeneratorPage() {
  const { state, rendered, setKey, setFeel, setMidTempoBpm, generate, regenerateSection, toggleLock, updateLocked, setProgression, togglePlay, clearIntroLead, activeSection } =
    useGenerator();

  // One tab scale for the chord cards: the widest chord tab showing. Lead tabs (the Solo, an Intro
  // melody) use it too when they fit; a lead line dense with technique marks shrinks only itself.
  const sharedTabChars = Math.max(...SECTION_IDS.filter((id) => !rendered[id].lead).map((id) => tabChars(rendered[id].tab)));

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-[14px] px-[20px] pb-[28px] pt-[22px] tablet:gap-[18px] tablet:px-[32px] tablet:pb-[36px] tablet:pt-[28px] desktop:gap-[20px] desktop:flex-1 desktop:px-[56px] desktop:pb-[22px] desktop:pt-[32px]">
      <PageHeader kicker="SONGWRITING ENGINE" title="SONG GENERATOR" aside={<OriginalityBadge />} />
      <PageGuide page="generator" label="How to use the Generator" steps={GUIDE} signature="FIVE SECTIONS · REAL TABS · ABOUT A MINUTE" />

      <div className="flex flex-col gap-[14px] tablet:flex-row tablet:flex-wrap tablet:items-stretch tablet:gap-[12px]">
        <ControlCard label="Key" className="tablet:basis-full desktop:basis-auto">
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

      <div className="grid grid-cols-1 gap-x-[12px] gap-y-[12px] tablet:grid-cols-2 desktop:grid-cols-5">
        {SECTION_IDS.map((id, i) => (
          <SectionCard
            key={id}
            section={rendered[id]}
            index={i}
            locked={state.sections[id].locked}
            {...lockInfo(state, id)}
            active={activeSection === id}
            progressionId={id === "chorus" ? inputsFor(state, "chorus").progressionId : undefined}
            playing={state.playing === `section:${id}`}
            onRegenerate={() => regenerateSection(id)}
            onToggleLock={() => toggleLock(id)}
            onUpdate={() => updateLocked(id)}
            onTogglePlay={() => togglePlay(`section:${id}`)}
            tabChars={sharedTabChars}
            wideOnTablet={id === "breakdown"}
            extraAction={
              id === "intro" && state.sections.intro.lead && !state.sections.intro.locked
                ? { label: "Back to power chords", onClick: clearIntroLead }
                : undefined
            }
            className={id === "breakdown" ? "tablet:col-span-2 desktop:col-span-1" : ""}
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
        <RhythmLane activeFeel={state.feel} progressionId={state.progressionId} keyName={state.key} />
      </div>
    </div>
  );
}
