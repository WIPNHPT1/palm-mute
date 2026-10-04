import { type Fretted, TAB_STRINGS, describeNotes } from "@/lib/fretboard";
import type { Degree, ResolvedChord } from "@/lib/musicTheory";

/**
 * Chord name + full 6-string mini tab of the voicing the engine picked, with the chord's degree in the
 * key (I, V, vi …) on top. Fret cells are always 2 characters and the name slot 3, so every chip is
 * the same width whatever the chord or fret. The mini tab is decorative; screen readers hear the notes.
 */
export function ChordChip({ chord, notes, degree }: { chord: ResolvedChord; notes: Fretted[]; degree?: Degree }) {
  const fretOn = (s: string) => notes.find((n) => n.string === s)?.fret;
  return (
    <div
      role="img"
      aria-label={`${degree ? `${degree} chord, ` : ""}${chord.name}: ${describeNotes(notes)}`}
      data-chip
      className="sig-chip flex flex-col items-center gap-[3px] rounded-small bg-chip-bg px-[8px] py-[6px]"
    >
      {degree && <div className="font-mono text-[12px] leading-none text-text-on-dark-faint">{degree}</div>}
      <div className="w-[3ch] text-center font-mono text-[12px] font-bold text-chip-label">{chord.name}</div>
      <div className="whitespace-pre font-mono text-[7px] leading-[1.4] text-chip-tab" aria-hidden="true">
        {TAB_STRINGS.map((s) => `${s}|${String(fretOn(s) ?? "-").padEnd(2, " ")}`).join("\n")}
      </div>
    </div>
  );
}
