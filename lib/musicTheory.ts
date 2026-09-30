// Pure music-theory helpers (data-model.md §2–3). No React — keep it that way so it stays testable.
import chordLibraryJson from "@/data/chord-library.json";
import progressionsJson from "@/data/progressions.json";

export const PITCH_CLASSES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;
export type NoteName = (typeof PITCH_CLASSES)[number];

/** Tab strings, high to low — the order every tab block and chord chip renders in. */
export const TAB_STRINGS = ["e", "B", "G", "D", "A", "E"] as const;
export type TabString = (typeof TAB_STRINGS)[number];

/** Open-string MIDI notes for E standard (E2 A2 D3 G3 B3 E4), keyed by tab-string label. */
export const OPEN_STRING_MIDI: Record<TabString, number> = { E: 40, A: 45, D: 50, G: 55, B: 59, e: 64 };

export type Degree = "I" | "ii" | "iii" | "IV" | "V" | "vi" | "vii";

export type PowerChord = {
  rootString: TabString;
  rootFret: number;
  fifthString: TabString;
  fifthFret: number;
  twoNoteTab: Record<TabString, string>;
  enharmonic?: string;
};

export type Progression = {
  id: string;
  degrees: Degree[];
  brightness: number;
  tag: string;
  note?: string;
};

export type ResolvedChord = {
  root: NoteName;
  /** Display name, e.g. "A5", "F#5". */
  name: string;
  chord: PowerChord;
};

const chordLibrary = chordLibraryJson.chords as unknown as Record<NoteName, PowerChord>;
export const degreeOffsets = progressionsJson.degreeOffsets as Record<Degree, number>;
export const progressions = progressionsJson.progressions as Progression[];

export function pitchClassOf(noteName: NoteName): number {
  return PITCH_CLASSES.indexOf(noteName);
}

export function noteNameFor(pitchClass: number): NoteName {
  return PITCH_CLASSES[((pitchClass % 12) + 12) % 12];
}

/** Flat spelling for a sharp key (from the chord library), or undefined for naturals. */
export function enharmonicOf(noteName: NoteName): string | undefined {
  return chordLibrary[noteName].enharmonic;
}

/** "A#/Bb" for accidentals, plain letter for naturals. */
export function keyDisplayName(noteName: NoteName): string {
  const flat = enharmonicOf(noteName);
  return flat ? `${noteName}/${flat}` : noteName;
}

export function chordFor(root: NoteName): ResolvedChord {
  return { root, name: `${root}5`, chord: chordLibrary[root] };
}

export function chordForDegree(key: NoteName, degree: Degree): ResolvedChord {
  return chordFor(noteNameFor(pitchClassOf(key) + degreeOffsets[degree]));
}

export function getProgression(progressionId: string): Progression {
  const prog = progressions.find((p) => p.id === progressionId);
  if (!prog) throw new Error(`Unknown progression: ${progressionId}`);
  return prog;
}

export function resolveDegrees(key: NoteName, degrees: Degree[]): ResolvedChord[] {
  return degrees.map((d) => chordForDegree(key, d));
}

export function resolveProgression(key: NoteName, progressionId: string): ResolvedChord[] {
  return resolveDegrees(key, getProgression(progressionId).degrees);
}

/** MIDI notes (root, fifth) for a power chord — `openStringMidi[string] + fret` (data-model.md §7). */
export function chordMidiNotes(chord: PowerChord): number[] {
  return [
    OPEN_STRING_MIDI[chord.rootString] + chord.rootFret,
    OPEN_STRING_MIDI[chord.fifthString] + chord.fifthFret,
  ];
}

export type SortMode = "most-common" | "brightest" | "darkest" | "simplest" | "home-start" | "minor-start";

/** progressions.json → sortHeuristic. Stable: ties keep curated order. */
export function sortProgressions(list: Progression[], mode: SortMode): Progression[] {
  const indexed = list.map((p, i) => ({ p, i }));
  const distinct = (p: Progression) => new Set(p.degrees).size;
  const first = (p: Progression, d: Degree) => (p.degrees[0] === d ? 0 : 1);
  indexed.sort((a, b) => {
    if (mode === "brightest") return b.p.brightness - a.p.brightness || a.i - b.i;
    if (mode === "darkest") return a.p.brightness - b.p.brightness || a.i - b.i;
    if (mode === "simplest") return distinct(a.p) - distinct(b.p) || a.p.degrees.length - b.p.degrees.length || a.i - b.i;
    if (mode === "home-start") return first(a.p, "I") - first(b.p, "I") || a.i - b.i;
    if (mode === "minor-start") return first(a.p, "vi") - first(b.p, "vi") || a.i - b.i;
    return a.i - b.i;
  });
  return indexed.map(({ p }) => p);
}
