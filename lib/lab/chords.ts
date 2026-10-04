// Chord Lab chord maths (docs/chord-lab-prd.md §5.1–5.3): chord types, tunings, every playable voicing of a
// chord, naming any shape, and the keys a chord belongs to. Voicings are correct by construction: each one is
// a curated open shape or a moveable template slid up the neck, kept only if it plays exactly the chord's notes
// with the root in the bass, fits four fingers, and stays within reach. `npm run verify` (verify-lab) sweeps it.
// Pure, no React.
import chordTypesJson from "@/data/chord-types.json";
import openChordsJson from "@/data/open-chords.json";
import templatesJson from "@/data/chord-templates.json";
import tuningsJson from "@/data/tunings.json";
import { PITCH_CLASSES } from "@/lib/musicTheory";

// ---------------------------------------------------------------------------
// Tunings

export type TuningId = "e-standard" | "eb-standard" | "drop-d" | "drop-c-sharp";
export type Tuning = { id: TuningId; label: string; short: string; strings: { name: string; midi: number }[] };

export const TUNINGS = tuningsJson.tunings as Tuning[];
export const TUNING_IDS = TUNINGS.map((t) => t.id);
export const STRING_COUNT = 6;
/** The neck the Lab draws and searches: open strings to the 15th fret. */
export const MAX_FRET = 15;

export function getTuning(id: TuningId): Tuning {
  return TUNINGS.find((t) => t.id === id) ?? TUNINGS[0];
}

/** How far a tuning sits from E standard on its top five strings (Eb and Drop C#: −1), for capo maths. */
export function tuningOffset(id: TuningId): number {
  return getTuning(id).strings[1].midi - TUNINGS[0].strings[1].midi;
}

// ---------------------------------------------------------------------------
// Chord types and names

export type ChordTypeId = "5" | "oct" | "maj" | "min" | "sus2" | "sus4" | "add9" | "7" | "maj7" | "m7";
export type ChordType = { id: ChordTypeId; label: string; name: string; symbol: string; intervals: number[]; optional?: number[]; sounds: string };

export const CHORD_TYPES = chordTypesJson.types as ChordType[];
export const CHORD_TYPE_IDS = CHORD_TYPES.map((t) => t.id);

export function chordType(id: ChordTypeId): ChordType {
  const t = CHORD_TYPES.find((x) => x.id === id);
  if (!t) throw new Error(`Unknown chord type: ${id}`);
  return t;
}

const pc = (n: number) => ((n % 12) + 12) % 12;
export const noteName = (pitchClass: number) => PITCH_CLASSES[pc(pitchClass)];

/** "G", "F#m7", "A5", "E octave". */
export function chordName(root: number, type: ChordTypeId): string {
  return noteName(root) + chordType(type).symbol;
}

/** Pitch classes of a chord, root first. */
export function chordPitchClasses(root: number, type: ChordTypeId): number[] {
  return chordType(type).intervals.map((i) => pc(root + i));
}

export type Role = "R" | "2" | "3" | "4" | "5" | "7" | "9";

/** A note's job in a chord, from its interval above the root ("9" in add9, "2" in sus2). */
export function roleOf(interval: number, type: ChordTypeId): Role {
  const i = pc(interval);
  if (i === 0) return "R";
  if (i === 3 || i === 4) return "3";
  if (i === 7) return "5";
  if (i === 10 || i === 11) return "7";
  if (i === 5) return "4";
  if (i === 2) return type === "add9" ? "9" : "2";
  return "R";
}

// ---------------------------------------------------------------------------
// Shapes

/** Frets per string, low string first; null = not played. */
export type Frets = (number | null)[];

/** MIDI notes a shape sounds in a tuning, per string (null where not played). */
export function shapeNotes(frets: Frets, tuning: TuningId): (number | null)[] {
  const strings = getTuning(tuning).strings;
  return frets.map((f, s) => (f === null ? null : strings[s].midi + f));
}

/** "x32010" style, with dashes when a fret has two digits ("x-10-12-12-10-x"). */
export function shapeText(frets: Frets): string {
  const parts = frets.map((f) => (f === null ? "x" : String(f)));
  return parts.some((p) => p.length > 1) ? parts.join("-") : parts.join("");
}

/** Reads "x32010", "3-2-0-0-0-3" or "x 3 2 0 1 0" back into frets (null if it isn't six strings). */
export function parseShape(text: string): Frets | null {
  const t = text.trim().toLowerCase();
  if (!t) return null;
  const parts = /[\s,\-/|.]/.test(t) ? t.split(/[\s,\-/|.]+/).filter(Boolean) : [...t];
  if (parts.length !== STRING_COUNT) return null;
  const frets = parts.map((p) => (p === "x" ? null : /^\d{1,2}$/.test(p) && Number(p) <= MAX_FRET ? Number(p) : undefined));
  return frets.includes(undefined) ? null : (frets as Frets);
}

export type Barre = { fret: number; from: number; to: number };

export type Voicing = {
  root: number;
  type: ChordTypeId;
  frets: Frets;
  /** Finger per string (1–4), 0 for open, null for not played. */
  fingers: (number | null)[];
  barre: Barre | null;
  /** Lowest and highest fretted frets (0 and 0 for an all-open shape). */
  low: number;
  high: number;
  /** Rings any open strings. */
  open: boolean;
  /** Strings inside the shape that aren't played: a fretting finger leans on them to mute them. */
  muted: number[];
  difficulty: number;
  /** "open", "E-shape barre", "power, A root"… */
  shape: string;
};

type Template = { type: ChordTypeId; name: string; rootString: number; frets: (number | null)[] };
type OpenShape = { chord: string; frets: Frets; fingers: (number | null)[] };
const TEMPLATES = templatesJson.templates as Template[];
const OPEN_SHAPES = openChordsJson.shapes as OpenShape[];

/** Played strings, low to high. */
const played = (frets: Frets) => frets.flatMap((f, s) => (f === null ? [] : [s]));

/** Unplayed strings between the lowest and highest played ones. */
export function innerMutes(frets: Frets): number[] {
  const p = played(frets);
  if (!p.length) return [];
  const out: number[] = [];
  for (let s = p[0] + 1; s < p[p.length - 1]; s++) if (frets[s] === null) out.push(s);
  return out;
}

/**
 * Whether the index finger should lie across the lowest fret: three or more strings there, or two when the
 * lower one is the bass (the A-shape barre), with nothing lower or open in between.
 */
function needsBarre(frets: Frets): Barre | null {
  const fretted = frets.flatMap((f, s) => (f !== null && f > 0 ? [{ f, s }] : []));
  if (!fretted.length) return null;
  const low = Math.min(...fretted.map((x) => x.f));
  const at = fretted.filter((x) => x.f === low).map((x) => x.s);
  const from = at[0];
  const to = at[at.length - 1];
  if (at.length < 2 || (at.length === 2 && from !== played(frets)[0])) return null;
  for (let s = from; s <= to; s++) if (frets[s] === null || frets[s]! < low) return null;
  return { fret: low, from, to };
}

/** The barre a fingering makes: one finger holding two or more strings at the same fret. */
export function barreOf(frets: Frets, fingers: (number | null)[]): Barre | null {
  for (const finger of [1, 2, 3, 4]) {
    const strings = frets.flatMap((f, s) => (f && fingers[s] === finger ? [s] : []));
    if (strings.length >= 2) return { fret: frets[strings[0]]!, from: strings[0], to: strings[strings.length - 1] };
  }
  return null;
}

/**
 * Fingers for a shape: the barre (if any) is the index finger; every other fretted note takes the next free
 * finger, up the neck. Null if it needs more than four fingers.
 */
export function fingerShape(frets: Frets): (number | null)[] | null {
  const barre = needsBarre(frets);
  const fingers: (number | null)[] = frets.map((f) => (f === null ? null : f === 0 ? 0 : -1));
  const fretted = frets.flatMap((f, s) => (f !== null && f > 0 ? [{ f, s }] : []));
  if (!fretted.length) return fingers;
  const used = new Set<number>();
  let floor = 1;
  if (barre) {
    for (let s = barre.from; s <= barre.to; s++) if (frets[s] === barre.fret) fingers[s] = 1;
    used.add(1);
    floor = 2;
  }
  // Up the neck, then low string to high: each note takes the next finger, so a higher fret never gets a
  // lower finger than a note below it.
  const rest = fretted.filter((x) => fingers[x.s] === -1).sort((a, b) => a.f - b.f || a.s - b.s);
  let finger = floor;
  for (const { s } of rest) {
    while (used.has(finger)) finger++;
    if (finger > 4) return null;
    fingers[s] = finger;
    used.add(finger);
  }
  return fingers;
}

/** How hard a shape is, 1 (two fingers) to 5 (a full barre plus a stretch). */
export function difficultyOf(frets: Frets, fingers: (number | null)[]): number {
  const fingerCount = new Set(fingers.filter((f): f is number => f !== null && f > 0)).size;
  const fretted = frets.filter((f): f is number => f !== null && f > 0);
  const span = fretted.length ? Math.max(...fretted) - Math.min(...fretted) : 0;
  const barre = barreOf(frets, fingers);
  let d = 1;
  if (fingerCount >= 3) d++;
  if (fingerCount >= 4) d++;
  if (barre && barre.to - barre.from >= 3) d++;
  if (span >= 3) d++;
  if (innerMutes(frets).length) d++;
  return Math.min(5, d);
}

/** Furthest a hand reaches, max fret − min fret: 3 for four fingers on four frets; add9 shapes may reach 4 (not from the 1st fret). */
export function stretchOk(frets: Frets, type: ChordTypeId): boolean {
  const fretted = frets.filter((f): f is number => f !== null && f > 0);
  if (!fretted.length) return true;
  const span = Math.max(...fretted) - Math.min(...fretted);
  if (span <= 3) return true;
  return type === "add9" && span === 4 && Math.min(...fretted) > 1;
}

/** True if a shape plays exactly this chord in this tuning: root in the bass, every required note, nothing else. */
export function playsChord(frets: Frets, tuning: TuningId, root: number, type: ChordTypeId): boolean {
  const notes = shapeNotes(frets, tuning).filter((n): n is number => n !== null);
  if (!notes.length) return false;
  if (pc(Math.min(...notes)) !== pc(root)) return false;
  const t = chordType(type);
  const want = new Set(t.intervals.map((i) => pc(root + i)));
  const required = t.intervals.filter((i) => !t.optional?.includes(i)).map((i) => pc(root + i));
  const have = new Set(notes.map(pc));
  if (type === "oct") return notes.length >= 2 && have.size === 1;
  if (type === "5" && notes.length < 2) return false;
  return [...have].every((p) => want.has(p)) && required.every((p) => have.has(p));
}

/** Muted inner strings need a fretted neighbour to lean on. */
function mutesOk(frets: Frets): boolean {
  return innerMutes(frets).every((s) => (frets[s - 1] ?? 0) > 0 || (frets[s + 1] ?? 0) > 0);
}

function build(frets: Frets, root: number, type: ChordTypeId, shape: string, fingers?: (number | null)[]): Voicing | null {
  if (frets.some((f) => f !== null && (f < 0 || f > MAX_FRET))) return null;
  if (!stretchOk(frets, type) || !mutesOk(frets)) return null;
  const f = fingers ?? fingerShape(frets);
  if (!f) return null;
  const fretted = frets.filter((x): x is number => x !== null && x > 0);
  return {
    root: pc(root),
    type,
    frets,
    fingers: f,
    barre: barreOf(frets, f),
    low: fretted.length ? Math.min(...fretted) : 0,
    high: fretted.length ? Math.max(...fretted) : 0,
    open: frets.some((x) => x === 0),
    muted: innerMutes(frets),
    difficulty: difficultyOf(frets, f),
    shape,
  };
}

const cache = new Map<string, Voicing[]>();

/**
 * Every playable voicing of a chord in a tuning, up the neck from the nut: curated open shapes first (with
 * their usual fingering), then each moveable template at every fret where it plays the chord.
 */
export function voicingsFor(root: number, type: ChordTypeId, tuning: TuningId): Voicing[] {
  const id = `${pc(root)}|${type}|${tuning}`;
  const hit = cache.get(id);
  if (hit) return hit;
  const out = new Map<string, Voicing>();
  for (const o of OPEN_SHAPES) {
    if (!playsChord(o.frets, tuning, root, type)) continue;
    const v = build(o.frets, root, type, "open", o.fingers);
    if (v) out.set(shapeText(o.frets), v);
  }
  const strings = getTuning(tuning).strings;
  for (const t of TEMPLATES.filter((x) => x.type === type)) {
    for (let r = 0; r <= MAX_FRET; r++) {
      if (pc(strings[t.rootString].midi + r) !== pc(root)) continue;
      const frets = t.frets.map((f) => (f === null ? null : f + r));
      if (!playsChord(frets, tuning, root, type)) continue;
      const key = shapeText(frets);
      if (out.has(key)) continue;
      const v = build(frets, root, type, frets.some((f) => f === 0) && frets.every((f) => f === null || f <= 4) ? "open" : t.name);
      if (v) out.set(key, v);
    }
  }
  const list = [...out.values()].sort((a, b) => a.low - b.low || Number(b.open) - Number(a.open) || played(b.frets).length - played(a.frets).length || a.difficulty - b.difficulty);
  cache.set(id, list);
  return list;
}

export type Position = "all" | "open" | "low" | "mid" | "high";

/** Where on the neck a voicing sits: open (rings open strings near the nut), low (1–4), mid (5–9), high (10+). */
export function positionOf(v: Voicing): Exclude<Position, "all"> {
  if (v.open && v.high <= 4) return "open";
  const base = v.low || 0;
  return base <= 4 ? "low" : base <= 9 ? "mid" : "high";
}

/** "open", "frets 3–5", "fret 7". */
export function fretRange(v: Voicing): string {
  if (positionOf(v) === "open") return "open";
  return v.low === v.high ? `fret ${v.low}` : `frets ${v.low}–${v.high}`;
}

/** The easiest voicing to strum, lowest on the neck (the builder and mood map play these). */
export function easiestVoicing(root: number, type: ChordTypeId, tuning: TuningId): Voicing | null {
  const all = voicingsFor(root, type, tuning).filter((v) => v.frets.filter((f) => f !== null).length >= (type === "5" ? 2 : 3));
  return [...all].sort((a, b) => a.difficulty - b.difficulty || a.low - b.low)[0] ?? voicingsFor(root, type, tuning)[0] ?? null;
}

const STRING_ORDINAL = ["6th", "5th", "4th", "3rd", "2nd", "1st"];
const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"}`;

/** Spoken version of a shape: "low E string 3rd fret, A string 2nd fret, D string open, …, high e string muted". */
export function describeShape(frets: Frets, tuning: TuningId): string {
  const strings = getTuning(tuning).strings;
  return frets
    .map((f, s) => `${strings[s].name} string (${STRING_ORDINAL[s]}) ${f === null ? "not played" : f === 0 ? "open" : `${ordinal(f)} fret`}`)
    .join(", ");
}

// ---------------------------------------------------------------------------
// Naming a shape (Name that chord)

export type ShapeName = { root: number; type: ChordTypeId; bass: number; name: string; omits: number };

const TYPE_RANK: ChordTypeId[] = ["5", "maj", "min", "7", "sus4", "sus2", "add9", "maj7", "m7", "oct"];

/** Every chord a shape could be, best first (root in the bass, nothing left out, simplest type). */
export function nameShape(frets: Frets, tuning: TuningId): ShapeName[] {
  const notes = shapeNotes(frets, tuning).filter((n): n is number => n !== null);
  if (notes.length < 2) return [];
  const have = new Set(notes.map(pc));
  const bass = pc(Math.min(...notes));
  if (have.size === 1) return [{ root: bass, type: "oct", bass, name: chordName(bass, "oct"), omits: 0 }];
  const out: (ShapeName & { score: number })[] = [];
  for (const root of have) {
    for (const t of CHORD_TYPES) {
      if (t.id === "oct") continue;
      const want = new Set(t.intervals.map((i) => pc(root + i)));
      const required = t.intervals.filter((i) => !t.optional?.includes(i)).map((i) => pc(root + i));
      if (![...have].every((p) => want.has(p)) || !required.every((p) => have.has(p))) continue;
      const omits = [...want].filter((p) => !have.has(p)).length;
      const name = chordName(root, t.id) + (root === bass ? "" : `/${noteName(bass)}`);
      out.push({ root, type: t.id, bass, name, omits, score: (root === bass ? 0 : 10) + omits * 2 + TYPE_RANK.indexOf(t.id) * 0.1 });
    }
  }
  return out.sort((a, b) => a.score - b.score).map((n) => ({ root: n.root, type: n.type, bass: n.bass, name: n.name, omits: n.omits }));
}

/**
 * A dictionary voicing one fret away from a shape (one string moved by one fret), for "did you mean…?" when a
 * tapped shape isn't a chord. Null if none is that close.
 */
export function nearestVoicing(frets: Frets, tuning: TuningId): { voicing: Voicing; string: number; from: number; to: number } | null {
  let best: { voicing: Voicing; string: number; from: number; to: number } | null = null;
  for (let root = 0; root < 12; root++) {
    for (const t of CHORD_TYPE_IDS) {
      if (t === "oct" || t === "5") continue;
      for (const v of voicingsFor(root, t, tuning)) {
        let diff = -1;
        let ok = true;
        for (let s = 0; s < STRING_COUNT && ok; s++) {
          const a = frets[s];
          const b = v.frets[s];
          if (a === b) continue;
          if (a === null || b === null || Math.abs(a - b) !== 1 || diff >= 0) ok = false;
          else diff = s;
        }
        if (ok && diff >= 0 && (!best || v.difficulty < best.voicing.difficulty)) best = { voicing: v, string: diff, from: frets[diff]!, to: v.frets[diff]! };
      }
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Keys a chord belongs to

export const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
export const MAJOR_PENTATONIC = [0, 2, 4, 7, 9];
const NUMERALS = ["I", "II", "III", "IV", "V", "VI", "VII"];
/** Triad quality on each degree of the major scale: major, minor, or diminished (vii). */
const DEGREE_QUALITY = ["maj", "min", "min", "maj", "maj", "min", "dim"] as const;

/** Numeral of a chord in a major key ("IV", "vi", "V7", "IVmaj7", "ii7", "Isus4"), or null if it isn't in the key. */
export function numeralIn(key: number, root: number, type: ChordTypeId): string | null {
  const scale = MAJOR_SCALE.map((i) => pc(key + i));
  if (!chordPitchClasses(root, type).every((p) => scale.includes(p))) return null;
  const degree = scale.indexOf(pc(root));
  const base = NUMERALS[degree];
  const quality = DEGREE_QUALITY[degree];
  const lower = quality !== "maj";
  const n = lower ? base.toLowerCase() : base;
  switch (type) {
    case "maj":
      return n;
    case "min":
      return n;
    case "7":
      return `${n}7`;
    case "maj7":
      return `${n}maj7`;
    case "m7":
      return `${n}7`;
    case "5":
      return `${n}5`;
    case "oct":
      return n;
    default:
      return `${n}${chordType(type).symbol}`;
  }
}

/** The major keys a chord fits in (all its notes in the scale), with its numeral in each. */
export function keysFor(root: number, type: ChordTypeId): { key: number; numeral: string }[] {
  const out: { key: number; numeral: string }[] = [];
  for (let key = 0; key < 12; key++) {
    const numeral = numeralIn(key, root, type);
    if (numeral) out.push({ key, numeral });
  }
  return out;
}
