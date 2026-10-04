// Chord Lab key maths (docs/chord-lab-prd.md §5.4–5.5): the builder's degrees in a key, reading typed chord
// names, finding the keys a set of chords fits, transposing, and capo/tuning shapes. Pure, no React.
import movesJson from "@/data/chord-moves.json";
import { type ChordTypeId, MAJOR_SCALE, chordName, chordPitchClasses, noteName, numeralIn } from "@/lib/lab/chords";
import { PITCH_CLASSES } from "@/lib/musicTheory";

export type DegreeId = "I" | "ii" | "iii" | "IV" | "V" | "vi" | "bIII" | "iv" | "bVI" | "bVII";
export type Degree = { id: DegreeId; offset: number; quality: "maj" | "min"; borrowed: boolean };

export const DEGREES = movesJson.degrees as Degree[];
export const DEGREE_IDS = DEGREES.map((d) => d.id);

export function getDegree(id: DegreeId): Degree {
  const d = DEGREES.find((x) => x.id === id);
  if (!d) throw new Error(`Unknown degree: ${id}`);
  return d;
}

const pc = (n: number) => ((n % 12) + 12) % 12;

/** A chord on a degree of a key: its root pitch class. */
export function degreeRoot(key: number, id: DegreeId): number {
  return pc(key + getDegree(id).offset);
}

/** "bVII" → "♭VII" is left to the page's fonts; the Lab writes flats as "b" (like the key pills' "Bb"). */
export function degreeLabel(id: DegreeId): string {
  return id;
}

/** The chord types that make sense on a degree, its natural quality first. */
export function typesFor(id: DegreeId): ChordTypeId[] {
  return getDegree(id).quality === "maj" ? ["maj", "5", "sus2", "sus4", "add9", "7", "maj7"] : ["min", "5", "m7", "sus2", "sus4"];
}

/** The three likeliest next chords after a degree (data/chord-moves.json). */
export function nextMoves(id: DegreeId): DegreeId[] {
  const moves = (movesJson.moves as Record<DegreeId, Partial<Record<DegreeId, number>>>)[id];
  return (Object.entries(moves) as [DegreeId, number][])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([d]) => d);
}

// ---------------------------------------------------------------------------
// Reading chord names ("G D Em C", "F#m7, Bbadd9")

export type ParsedChord = { text: string; root: number; type: ChordTypeId };

const SUFFIX: [RegExp, ChordTypeId][] = [
  [/^(maj7|M7|Δ7?)$/, "maj7"],
  [/^(m7|min7|-7)$/, "m7"],
  [/^7$/, "7"],
  [/^(m|min|-)$/, "min"],
  [/^(maj|M)?$/, "maj"],
  [/^5$/, "5"],
  [/^sus2$/, "sus2"],
  [/^sus4?$/, "sus4"],
  [/^\(?add9\)?$/, "add9"],
];

/** One chord name, or null if the Lab can't read it. */
export function parseChord(text: string): ParsedChord | null {
  const m = /^([A-Ga-g])([#♯b♭]?)(.*)$/.exec(text.trim());
  if (!m) return null;
  let root = PITCH_CLASSES.indexOf(m[1].toUpperCase() as (typeof PITCH_CLASSES)[number]);
  if (m[2] === "#" || m[2] === "♯") root++;
  if (m[2] === "b" || m[2] === "♭") root--;
  const type = SUFFIX.find(([re]) => re.test(m[3]))?.[1];
  return type ? { text: text.trim(), root: pc(root), type } : null;
}

/** Splits typed text into chord names (spaces, commas, bars and dashes between them). */
export function splitChords(text: string): string[] {
  return text.split(/[\s,|]+|\s-\s/).map((t) => t.trim()).filter(Boolean);
}

// ---------------------------------------------------------------------------
// Key finding

export type KeyFit = {
  key: number;
  score: number;
  /** Each chord's numeral in the key (borrowed ones marked), or null if it's outside it. */
  numerals: { text: string; numeral: string | null; borrowed: boolean }[];
};

/** A chord's numeral as a borrowed chord (bIII, iv, bVI, bVII) of the key, or null. */
function borrowedIn(key: number, chord: ParsedChord): string | null {
  for (const d of DEGREES.filter((x) => x.borrowed)) {
    if (pc(key + d.offset) !== chord.root) continue;
    const want = chordPitchClasses(chord.root, d.quality);
    const have = chordPitchClasses(chord.root, chord.type);
    // Power chords and sus chords don't say major or minor: they fit either.
    const fits = chord.type === "5" || chord.type === "oct" || have.every((p) => want.includes(p) || [2, 5].includes(pc(p - chord.root)));
    if (fits && (d.quality === "maj" ? !["min", "m7"].includes(chord.type) : ["min", "m7", "5", "oct"].includes(chord.type))) return d.id;
  }
  return null;
}

/**
 * The major keys a set of chords fits, best first: one point for each chord in the key, half for a borrowed
 * chord, a little extra when the loop starts or ends on the key's I and for each I, IV or V it uses.
 */
export function findKeys(chords: ParsedChord[], top = 3): KeyFit[] {
  if (!chords.length) return [];
  const fits: KeyFit[] = [];
  for (let key = 0; key < 12; key++) {
    let score = 0;
    const numerals = chords.map((c) => {
      const n = numeralIn(key, c.root, c.type);
      if (n) {
        score += 1;
        if (["I", "IV", "V"].includes(n.replace(/(5|7|maj7|sus2|sus4|add9)$/, ""))) score += 0.1;
        return { text: c.text, numeral: n, borrowed: false };
      }
      const b = borrowedIn(key, c);
      if (b) {
        score += 0.5;
        return { text: c.text, numeral: b, borrowed: true };
      }
      return { text: c.text, numeral: null, borrowed: false };
    });
    if (chords[0].root === key) score += 0.3;
    if (chords[chords.length - 1].root === key) score += 0.2;
    fits.push({ key, score, numerals });
  }
  return fits.sort((a, b) => b.score - a.score || a.key - b.key).slice(0, top);
}

/** "G major (E minor)": a key and its relative minor. */
export function keyName(key: number): string {
  return `${noteName(key)} major`;
}
export function relativeMinor(key: number): string {
  return `${noteName(key + 9)} minor`;
}

// ---------------------------------------------------------------------------
// Moving chords

/** A chord moved by some semitones, named again. */
export function transpose(chord: ParsedChord, semitones: number): ParsedChord {
  const root = pc(chord.root + semitones);
  return { text: chordName(root, chord.type), root, type: chord.type };
}

/**
 * The shapes to play for a chord to sound as written: a capo raises every string, and a tuning a semitone
 * down (Eb standard, Drop C#) lowers it, so the shape is the sound minus both.
 */
export function shapeFor(chord: ParsedChord, capo: number, tuningOffset: number): ParsedChord {
  return transpose(chord, -capo - tuningOffset);
}

/** The scale of a key, for the explorer's scale dots. */
export function scaleOf(key: number): number[] {
  return MAJOR_SCALE.map((i) => pc(key + i));
}
