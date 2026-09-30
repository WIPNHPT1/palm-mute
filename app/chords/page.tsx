"use client";

import { useState } from "react";
import { ControlCard } from "@/components/ControlCard";
import { FeelToggle } from "@/components/FeelToggle";
import { KeyPicker } from "@/components/KeyPicker";
import { type GuideStep, PageGuide } from "@/components/PageGuide";
import { OriginalityBadge } from "@/components/OriginalityBadge";
import { PageHeader } from "@/components/PageHeader";
import { ProgressionPanel } from "@/components/ProgressionPanel";
import { ProgressionRow } from "@/components/ProgressionRow";
import { SegmentedControl } from "@/components/SegmentedControl";
import { useGenerator } from "@/context/GeneratorContext";
import { libraryVoicings } from "@/lib/generator";
import { type SortMode, progressions, sortProgressions } from "@/lib/musicTheory";

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: "most-common", label: "MOST COMMON" },
  { value: "brightest", label: "BRIGHTEST" },
  { value: "darkest", label: "DARKEST" },
];

// Cards take the even grid slots; the open panel slots in right after its card (one column), or after
// its row (two columns, desktop). Literal class names so Tailwind can see them.
const ORDER = ["order-none", "order-1", "order-2", "order-3", "order-4", "order-5", "order-6", "order-7", "order-8", "order-9", "order-10", "order-11"];
const DESKTOP_ORDER = ["desktop:order-none", "desktop:order-1", "desktop:order-2", "desktop:order-3", "desktop:order-4", "desktop:order-5", "desktop:order-6", "desktop:order-7", "desktop:order-8", "desktop:order-9", "desktop:order-10", "desktop:order-11"];
const PANEL_ID = "progression-panel";

const GUIDE: GuideStep[] = [
  { title: "Pick a key", body: <>Every card shows its chords in your <b>key</b>, numbered I, V, vi, IV.</> },
  { title: "Listen", body: <><b>▷</b> plays a progression. <b>Sort</b> by most common, brightest or darkest.</> },
  { title: "Write a lead", body: <><b>Open a card</b> for an intro melody or a guitar solo: style, length, <b>Generate</b>.</> },
  { title: "Use it", body: <><b>USE IN MY SONG</b> sends the key, the chorus and your lead to the Generator.</> },
];

export default function ChordsPage() {
  // Key and feel live in the shared context, so they carry over to/from the Generator.
  const { state, setKey, setFeel, setMidTempoBpm, togglePlay } = useGenerator();
  const [sort, setSort] = useState<SortMode>("most-common");
  const [openId, setOpenId] = useState<string | null>(null);
  const sorted = sortProgressions(progressions, sort);
  const openIndex = sorted.findIndex((p) => p.id === openId);
  const open = openIndex >= 0 ? sorted[openIndex] : null;

  const close = () => {
    const id = openId;
    setOpenId(null);
    // Return focus to the card that opened the panel.
    requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(`[data-progression="${id}"] > button`)?.focus());
  };

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-[14px] px-[20px] pb-[28px] pt-[22px] tablet:gap-[18px] tablet:px-[32px] tablet:pb-[36px] tablet:pt-[28px] desktop:gap-[20px] desktop:flex-1 desktop:px-[56px] desktop:pb-[22px] desktop:pt-[32px]">
      <PageHeader kicker="POWER CHORD LIBRARY" title="CHORDS" aside={<OriginalityBadge />} />
      <PageGuide page="chords" label="How to use the Chords page" steps={GUIDE} signature="6 PROGRESSIONS · 12 KEYS · INTROS + SOLOS" />

      <div className="flex flex-col gap-[14px] tablet:flex-row tablet:flex-wrap tablet:gap-[12px] desktop:items-stretch">
        {/* Key always gets its own row from tablet up: with five feels, Key + Feel + Sort never fit in one. */}
        <ControlCard label="Key" className="tablet:basis-full">
          <KeyPicker value={state.key} onChange={setKey} />
        </ControlCard>
        <ControlCard label="Feel">
          <FeelToggle feel={state.feel} midTempoBpm={state.midTempoBpm} onFeelChange={setFeel} onBpmChange={setMidTempoBpm} />
        </ControlCard>
        {/* min-w-fit: never narrower than its three options; on a narrow row it wraps instead of clipping. */}
        <ControlCard label="Sort" className="min-w-fit tablet:flex-1">
          <SegmentedControl label="Sort" options={SORT_OPTIONS} value={sort} onChange={setSort} stretchOnTablet />
        </ControlCard>
      </div>

      <p className="max-w-[900px] font-mono text-[12px] leading-[1.6] text-text-muted">
        The numerals count up the key&apos;s major scale: <b className="text-text-primary">I</b> is home, <b className="text-text-primary">IV</b> and{" "}
        <b className="text-text-primary">V</b> pull away from it, and <b className="text-text-primary">vi</b> is its sad-sounding minor. Brightest puts
        I, IV and V first; Darkest leans on vi. Pick a card to hear it, write an intro melody or a solo over it, and use it in your song.
      </p>

      <div className={`grid grid-cols-1 gap-[10px] tablet:gap-[12px] desktop:grid-cols-2 ${open ? "" : "desktop:flex-grow desktop:auto-rows-fr"}`}>
        {sorted.map((p, i) => (
          <ProgressionRow
            key={p.id}
            variant="card"
            progression={p}
            chords={libraryVoicings(state.key, p.id)}
            variantIndex={progressions.indexOf(p)}
            // The curated "most common" progression stays pinned as the recommended pick in every sort.
            highlighted={p.tag === "most-common"}
            badge={p.tag === "most-common" ? "Most common" : undefined}
            expanded={p.id === openId}
            controls={p.id === openId ? PANEL_ID : undefined}
            selectLabel={`${p.id}: show options`}
            onSelect={() => setOpenId(p.id === openId ? null : p.id)}
            playing={state.playing === `progression:${p.id}`}
            onTogglePlay={() => togglePlay(`progression:${p.id}`)}
            className={`${ORDER[2 * i]} ${DESKTOP_ORDER[2 * i]}`}
          />
        ))}
        {open && (
          <ProgressionPanel
            id={PANEL_ID}
            progression={open}
            keyName={state.key}
            playing={state.playing === `progression:${open.id}`}
            onTogglePlay={() => togglePlay(`progression:${open.id}`)}
            onClose={close}
            className={`${ORDER[2 * openIndex + 1]} ${DESKTOP_ORDER[2 * (openIndex | 1) + 1] ?? "desktop:order-last"}`}
          />
        )}
      </div>
    </div>
  );
}
