"use client";

import { type GuideStep, PageGuide } from "@/components/PageGuide";
import { PageHeader } from "@/components/PageHeader";
import { Builder } from "@/components/lab/Builder";
import { Dictionary } from "@/components/lab/Dictionary";
import { KeyFinder } from "@/components/lab/KeyFinder";
import { LabProvider } from "@/components/lab/LabContext";
import { LabSetup } from "@/components/lab/LabSetup";
import { NameIt } from "@/components/lab/NameIt";
import { type LabTool, ToolCard, ToolStrip } from "@/components/lab/ToolCard";

// The Chord Lab (docs/chord-lab-prd.md): a guitarist's chord toolbox, independent of the Generator. Its tools
// stack as full-width cards under one setup (the owner's layout C), with a strip to jump between them.
const TOOLS: LabTool[] = [
  { id: "dictionary", n: 1, title: "Dictionary", hint: "every chord, every position, on the neck" },
  { id: "name-it", n: 2, title: "Name that chord", hint: "tap a shape, get its name" },
  { id: "builder", n: 3, title: "Progression builder", hint: "tap chords into a loop" },
  { id: "key-finder", n: 4, title: "Key finder & transposer", hint: "chords to key; move them" },
];

const GUIDE: GuideStep[] = [
  { title: "Look it up", body: <>Pick a <b>chord</b> and see every way to play it, on a box and on the <b>neck</b>.</> },
  { title: "Name it", body: <>Tap a shape you know onto the neck; it says <b>what chord</b> it is and which keys it lives in.</> },
  { title: "Build a loop", body: <>Tap chords from your key into a <b>loop</b>; it suggests <b>what comes next</b>.</> },
  { title: "Move it", body: <>Find the <b>key</b>, then shift it: another key, a <b>capo</b> or a drop <b>tuning</b>.</> },
];

export default function ChordLabPage() {
  return (
    <LabProvider>
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-[14px] px-[20px] pb-[28px] pt-[22px] tablet:gap-[18px] tablet:px-[32px] tablet:pb-[36px] tablet:pt-[28px] desktop:gap-[20px] desktop:px-[56px] desktop:pb-[40px] desktop:pt-[32px]">
        <PageHeader kicker="SONGWRITING TOOLS" title="CHORD LAB" />
        <PageGuide page="chords" label="How to use the Chord Lab" steps={GUIDE} signature="10 CHORD TYPES · 4 TUNINGS · EVERY POSITION" />
        <LabSetup />
        <ToolStrip tools={TOOLS} />
        <div className="flex flex-col gap-[14px] tablet:gap-[18px]">
          <ToolCard tool={TOOLS[0]}>
            <Dictionary />
          </ToolCard>
          <ToolCard tool={TOOLS[1]}>
            <NameIt />
          </ToolCard>
          <ToolCard tool={TOOLS[2]}>
            <Builder />
          </ToolCard>
          <ToolCard tool={TOOLS[3]}>
            <KeyFinder />
          </ToolCard>
        </div>
      </div>
    </LabProvider>
  );
}
