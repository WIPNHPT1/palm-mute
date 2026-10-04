"use client";

import { ControlCard } from "@/components/ControlCard";
import { KeyPicker } from "@/components/KeyPicker";
import { SegmentedControl } from "@/components/SegmentedControl";
import { useLab } from "@/components/lab/LabContext";
import { type TuningId, TUNINGS, getTuning } from "@/lib/lab/chords";
import { keyDisplayName } from "@/lib/musicTheory";

const TUNING_OPTIONS = TUNINGS.map((t) => ({ value: t.id, label: t.short }));
const HANDED_OPTIONS = [
  { value: "right", label: "RIGHT" },
  { value: "left", label: "LEFT" },
] as const;

/** The Lab setup (docs/chord-lab-prd.md §4): key, tuning and handedness, shared by every tool. */
export function LabSetup() {
  const { key, setKey, tuning, setTuning, left, setLeft } = useLab();
  return (
    <div data-lab-setup className="flex flex-col gap-[12px] tablet:flex-row tablet:flex-wrap desktop:flex-nowrap">
      <ControlCard label="Key" picked={keyDisplayName(key)} className="tablet:basis-full desktop:basis-auto">
        <KeyPicker value={key} onChange={setKey} />
      </ControlCard>
      <ControlCard label="Tuning" picked={getTuning(tuning).label} className="tablet:flex-1">
        <SegmentedControl<TuningId> label="Tuning" options={TUNING_OPTIONS} value={tuning} onChange={setTuning} stretch />
      </ControlCard>
      <ControlCard label="Handed" className="min-w-fit">
        <SegmentedControl<"right" | "left"> label="Handed" options={[...HANDED_OPTIONS]} value={left ? "left" : "right"} onChange={(v) => setLeft(v === "left")} stretch />
      </ControlCard>
    </div>
  );
}
