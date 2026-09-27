"use client";

import { ControlCard } from "@/components/ControlCard";
import { FeelToggle } from "@/components/FeelToggle";
import { GenerateButton, PlaySongButton } from "@/components/GenerateButton";
import { KeyPicker } from "@/components/KeyPicker";
import { OriginalityBadge } from "@/components/OriginalityBadge";
import { PageHeader } from "@/components/PageHeader";
import { PowerChordsPanel } from "@/components/PowerChordsPanel";
import { RhythmLane } from "@/components/RhythmLane";
import { SectionCard } from "@/components/SectionCard";
import { type GeneratorState, useGenerator } from "@/context/GeneratorContext";
import { SECTION_IDS, type SectionId, getTemplate } from "@/lib/generator";
import { keyDisplayName } from "@/lib/musicTheory";

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
  const { state, rendered, setKey, setFeel, setMidTempoBpm, generate, regenerateSection, toggleLock, updateLocked, setProgression, togglePlay } = useGenerator();

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-[14px] px-[20px] pb-[28px] pt-[22px] tablet:gap-[18px] tablet:px-[32px] tablet:pb-[36px] tablet:pt-[28px] desktop:gap-[20px] desktop:flex-1 desktop:px-[56px] desktop:pb-[22px] desktop:pt-[32px]">
      <PageHeader kicker="SONGWRITING ENGINE" title="SONG GENERATOR" aside={<OriginalityBadge />} />

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

      <div className="grid grid-cols-1 gap-[12px] tablet:grid-cols-2 desktop:grid-cols-5">
        {SECTION_IDS.map((id, i) => (
          <SectionCard
            key={id}
            section={rendered[id]}
            index={i}
            locked={state.sections[id].locked}
            {...lockInfo(state, id)}
            highlighted={!!getTemplate(id).highlightInUI}
            playing={state.playing === `section:${id}`}
            onRegenerate={() => regenerateSection(id)}
            onToggleLock={() => toggleLock(id)}
            onUpdate={() => updateLocked(id)}
            onTogglePlay={() => togglePlay(`section:${id}`)}
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
        <RhythmLane activeFeel={state.feel} subtitle={`Strums for ${state.progressionId} in ${keyDisplayName(state.key)}`} />
      </div>
    </div>
  );
}
