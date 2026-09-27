import { TAB_STRINGS, type ResolvedChord } from "@/lib/musicTheory";

/**
 * Chord name + full 6-string mini tab, straight from chord-library.json's twoNoteTab.
 * The name slot is always 3 monospace characters wide (the longest names, like "F#5"), so every
 * chip is the same width whether the chord is natural or sharp.
 */
export function ChordChip({ chord }: { chord: ResolvedChord }) {
  return (
    <div className="flex flex-col items-center gap-[4px] rounded-small bg-chip-bg px-[8px] py-[6px]">
      <div className="w-[3ch] text-center font-mono text-[10px] font-bold text-chip-label">{chord.name}</div>
      <div className="whitespace-pre font-mono text-[7px] leading-[1.4] text-chip-tab" aria-label={`${chord.name} tab`}>
        {TAB_STRINGS.map((s) => `${s}|${chord.chord.twoNoteTab[s]}`).join("\n")}
      </div>
    </div>
  );
}
