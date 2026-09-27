"use client";

import { useState } from "react";
import { ControlCard } from "@/components/ControlCard";
import { KeyPicker } from "@/components/KeyPicker";
import { MobileNavRow } from "@/components/Nav";
import { PageHeader } from "@/components/PageHeader";
import { ProgressionRow } from "@/components/ProgressionRow";
import { SegmentedControl } from "@/components/SegmentedControl";
import { useGenerator } from "@/context/GeneratorContext";
import { type SortMode, progressions, resolveProgression, sortProgressions } from "@/lib/musicTheory";

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: "most-common", label: "MOST COMMON" },
  { value: "brightest", label: "BRIGHTEST" },
  { value: "darkest", label: "DARKEST" },
];

export default function ChordsPage() {
  // Key lives in the shared context, so it carries over to/from the Generator.
  const { state, setKey, togglePlay } = useGenerator();
  const [sort, setSort] = useState<SortMode>("most-common");
  const sorted = sortProgressions(progressions, sort);

  return (
    <div className="flex flex-col gap-[14px] px-[20px] pb-[28px] pt-[22px] tablet:gap-[18px] tablet:px-[32px] tablet:pb-[36px] tablet:pt-[28px] desktop:gap-[20px] desktop:flex-1 desktop:px-[56px] desktop:pb-[22px] desktop:pt-[32px]">
      <MobileNavRow />
      <PageHeader kicker="POWER CHORD LIBRARY" title="CHORDS" />

      <div className="flex flex-col gap-[14px] tablet:gap-[12px] desktop:flex-row desktop:flex-wrap desktop:items-stretch">
        <ControlCard label="Key">
          <KeyPicker value={state.key} onChange={setKey} />
        </ControlCard>
        <ControlCard label="Sort">
          <SegmentedControl label="Sort" options={SORT_OPTIONS} value={sort} onChange={setSort} stretchOnTablet className="tablet:max-w-[380px] desktop:max-w-none" />
        </ControlCard>
      </div>

      <div className="grid grid-cols-1 gap-[10px] tablet:gap-[12px] desktop:flex-grow desktop:auto-rows-fr desktop:grid-cols-2">
        {sorted.map((p) => (
          <ProgressionRow
            key={p.id}
            variant="card"
            progression={p}
            chords={resolveProgression(state.key, p.id)}
            variantIndex={progressions.indexOf(p)}
            // The curated "most common" progression stays pinned as the recommended pick in every sort.
            highlighted={p.tag === "most-common"}
            playing={state.playingProgressionId === p.id}
            onTogglePlay={() => togglePlay(p.id)}
          />
        ))}
      </div>
    </div>
  );
}
