"use client";

import { ControlCard } from "@/components/ControlCard";
import { FeelToggle } from "@/components/FeelToggle";
import { GenerateButton } from "@/components/GenerateButton";
import { KeyPicker } from "@/components/KeyPicker";
import { MobileNavRow } from "@/components/Nav";
import { OriginalityBadge } from "@/components/OriginalityBadge";
import { PageHeader } from "@/components/PageHeader";
import { PowerChordsPanel } from "@/components/PowerChordsPanel";
import { RhythmLane } from "@/components/RhythmLane";
import { SectionCard } from "@/components/SectionCard";
import { useGenerator } from "@/context/GeneratorContext";
import { SECTION_IDS, getTemplate } from "@/lib/generator";
import { keyDisplayName } from "@/lib/musicTheory";

export default function GeneratorPage() {
  const { state, rendered, setKey, setFeel, setMidTempoBpm, generate, regenerateSection, toggleLock, togglePlay } = useGenerator();

  return (
    <div className="flex flex-col gap-[14px] px-[20px] pb-[28px] pt-[22px] tablet:gap-[18px] tablet:px-[32px] tablet:pb-[36px] tablet:pt-[28px] desktop:gap-[20px] desktop:flex-1 desktop:px-[56px] desktop:pb-[22px] desktop:pt-[32px]">
      <MobileNavRow />
      <PageHeader kicker="SONGWRITING ENGINE" title="SONG GENERATOR" aside={<OriginalityBadge status={state.originalityStatus} />} />

      <div className="flex flex-col gap-[14px] tablet:flex-row tablet:flex-wrap tablet:items-stretch tablet:gap-[12px]">
        <ControlCard label="Key" className="tablet:basis-full desktop:basis-auto">
          <KeyPicker value={state.key} onChange={setKey} />
        </ControlCard>
        <ControlCard label="Feel">
          <FeelToggle feel={state.feel} midTempoBpm={state.midTempoBpm} onFeelChange={setFeel} onBpmChange={setMidTempoBpm} />
        </ControlCard>
        <GenerateButton onClick={generate} />
      </div>

      <div className="grid grid-cols-1 gap-[12px] tablet:grid-cols-2 desktop:grid-cols-5">
        {SECTION_IDS.map((id, i) => (
          <SectionCard
            key={id}
            section={rendered[id]}
            index={i}
            locked={state.sections[id].locked}
            highlighted={!!getTemplate(id).highlightInUI}
            onRegenerate={() => regenerateSection(id)}
            onToggleLock={() => toggleLock(id)}
            className={id === "breakdown" ? "tablet:col-span-2 desktop:col-span-1" : ""}
          />
        ))}
      </div>

      <div className="flex flex-col gap-[14px] tablet:gap-[18px] desktop:flex-grow desktop:flex-row desktop:gap-[14px]">
        <PowerChordsPanel keyName={state.key} selectedId={state.progressionId} playingId={state.playingProgressionId} onTogglePlay={togglePlay} />
        <RhythmLane activeFeel={state.feel} subtitle={`Strums for ${state.progressionId} in ${keyDisplayName(state.key)}`} />
      </div>
    </div>
  );
}
