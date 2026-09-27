import { type Degree, type ResolvedChord, TAB_STRINGS, describeChord } from "@/lib/musicTheory";

/**
 * Chord name + full 6-string mini tab, straight from chord-library.json's twoNoteTab, with the chord's
 * degree in the key (I, V, vi …) on top. The name slot is always 3 monospace characters wide (the
 * longest names, like "F#5"), so every chip is the same width whether the chord is natural or sharp.
 * The mini tab is decorative; screen readers hear the chord's notes instead.
 */
export function ChordChip({ chord, degree }: { chord: ResolvedChord; degree?: Degree }) {
  return (
    <div
      role="img"
      aria-label={`${degree ? `${degree} chord, ` : ""}${describeChord(chord)}`}
      data-chip
      className="flex flex-col items-center gap-[3px] rounded-small bg-chip-bg px-[8px] py-[6px]"
    >
      {degree && <div className="font-mono text-[12px] leading-none text-text-on-dark-faint">{degree}</div>}
      <div className="w-[3ch] text-center font-mono text-[12px] font-bold text-chip-label">{chord.name}</div>
      <div className="whitespace-pre font-mono text-[7px] leading-[1.4] text-chip-tab" aria-hidden="true">
        {TAB_STRINGS.map((s) => `${s}|${chord.chord.twoNoteTab[s]}`).join("\n")}
      </div>
    </div>
  );
}
