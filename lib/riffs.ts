// Song Engine v2 Phase 4: moving intro riffs (docs/song-engine-v2-prd.md R12). A riff is written in data as
// scale steps over each bar's chord (data/section-recipes.json, intro `riff` variants), so it works in every
// key: step 0 is the chord's root, 2 its third, 4 its fifth, 7 its octave, all inside the key's major scale.
// This turns steps into frets: octave shapes, single notes on the low strings, or a line over an open-string
// pedal. Pure functions, no React.
import { type Fretted, type TabString, OPEN_STRING_MIDI, midiOf, pitchClass } from "@/lib/fretboard";
import { type Degree, degreeOffsets } from "@/lib/musicTheory";
import { PLAYABILITY, changeSpeed } from "@/lib/playability";
import { SETTINGS, candidates } from "@/lib/voicings";

export type RiffSpec = {
  kind: "octaves" | "single" | "pedal";
  articulation: "pm" | "ring";
  /** Cells per bar: 8 (eighths) or 16 (sixteenths). */
  grid: 8 | 16;
  /** Per bar (cycled): [cell, scale step over the bar's chord]. */
  bars: [number, number][][];
  /** Pedal riffs: the cells where the open-string pedal sounds. */
  pedalCells?: number[];
};

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const DEGREE_INDEX: Record<Degree, number> = { I: 0, ii: 1, iii: 2, IV: 3, V: 4, vi: 5, vii: 6 };
/** Open strings a pedal can sit on, and the string its line climbs above it. */
const PEDAL: Partial<Record<TabString, TabString>> = { E: "A", A: "D", D: "G" };

/** Semitones above the key's root for a scale step over a chord degree (can pass an octave). */
export function stepSemitones(degree: Degree, step: number): number {
  const i = DEGREE_INDEX[degree] + step;
  return MAJOR[((i % 7) + 7) % 7] + 12 * Math.floor(i / 7);
}

/** The open string whose note is this pitch class, if any (for a pedal). */
export function openStringFor(pc: number): TabString | undefined {
  return (Object.keys(PEDAL) as TabString[]).find((s) => pitchClass(OPEN_STRING_MIDI[s]) === pc);
}

/** Can this riff play over these chords in this key? Pedal riffs need every chord's root on an open string. */
export function riffFits(spec: RiffSpec, keyPc: number, degrees: Degree[]): boolean {
  return spec.kind !== "pedal" || degrees.every((d) => openStringFor((keyPc + degreeOffsets[d]) % 12) !== undefined);
}

export type RiffEvent = { bar: number; cell: number; notes: Fretted[] };

/**
 * The riff's notes, bar by bar. A Viterbi search over each note's placements picks the path that keeps the
 * hand closest to where it was, moves the way the tune moves (a step up sounds higher), and never moves
 * faster than the playability limit at `bpm` (data/playability.json). Open notes leave the hand where it
 * is. `start` is where the hand begins. Returns null when no placement keeps every move under the limit
 * (then the song doesn't offer that riff).
 */
export function writeRiff(spec: RiffSpec, keyPc: number, degrees: Degree[], start: number, bpm: number): RiffEvent[] | null {
  const limit = SETTINGS.fretLimit;
  type Note = { bar: number; cell: number; step: number; t: number; options: Fretted[][] };
  const notes: Note[] = [];
  const pedals: RiffEvent[] = [];
  degrees.forEach((degree, bar) => {
    const rootPc = (keyPc + degreeOffsets[degree]) % 12;
    for (const [cell, step] of spec.bars[bar % spec.bars.length]) {
      const pc = (keyPc + stepSemitones(degree, step)) % 12;
      let options: Fretted[][];
      if (spec.kind === "octaves") options = candidates(pc, ["OctE", "OctA"], limit).map((v) => v.notes.map(({ string, fret }) => ({ string, fret })));
      else {
        const strings: TabString[] = spec.kind === "pedal" ? [PEDAL[openStringFor(rootPc)!]!] : ["E", "A"];
        options = strings.flatMap((string) => {
          const f = (((pc - pitchClass(OPEN_STRING_MIDI[string])) % 12) + 12) % 12;
          return [f, f + 12].filter((x) => x <= limit && (spec.kind !== "pedal" || x > 0)).map((fret) => [{ string, fret }]);
        });
      }
      notes.push({ bar, cell, step, t: bar * 16 + cell * (16 / spec.grid), options });
    }
    if (spec.kind === "pedal") for (const cell of spec.pedalCells ?? []) pedals.push({ bar, cell, notes: [{ string: openStringFor(rootPc)!, fret: 0 }] });
  });

  // State per placement of the current note: total cost, where the hand is (string, fret, when), the path.
  type State = { cost: number; hand: number; string: TabString | null; at: number; pitch: number; path: number[] };
  const fretted = (ns: Fretted[]) => ns.filter((n) => n.fret > 0);
  const pos = (ns: Fretted[]) => Math.min(...ns.map((n) => n.fret));
  let states: State[] = [{ cost: 0, hand: start, string: null, at: -Infinity, pitch: -1, path: [] }];
  notes.forEach((note, i) => {
    const up = i === 0 ? 0 : Math.sign(note.step - notes[i - 1].step);
    states = note.options.map((ns, k) => {
      let best: State | null = null;
      for (const from of states) {
        const f = fretted(ns);
        let move = 0;
        if (f.length && from.string !== null) {
          move = Math.abs(pos(f) - from.hand) + (f[0].string !== from.string ? PLAYABILITY.changes.weights.stringSet : 0);
          if (changeSpeed(move, (note.t - from.at) / 2, bpm) > PLAYABILITY.changes.limitPer100ms) continue;
        } else if (f.length) move = Math.abs(pos(f) - from.hand);
        const pitch = midiOf(ns[0]);
        const wrongWay = from.pitch >= 0 && up !== 0 && Math.sign(pitch - from.pitch) !== up ? 3 : 0;
        const cost = from.cost + move + wrongWay;
        if (!best || cost < best.cost - 1e-9)
          best = f.length
            ? { cost, hand: pos(f), string: f[0].string, at: note.t, pitch, path: [...from.path, k] }
            : { ...from, cost, pitch, path: [...from.path, k] };
      }
      return best ?? { cost: Infinity, hand: 0, string: null, at: 0, pitch: -1, path: [...states[0].path, k] };
    });
  });
  const winner = states.reduce((a, b) => (b.cost < a.cost ? b : a));
  if (!Number.isFinite(winner.cost)) return null;
  const out: RiffEvent[] = notes.map((n, i) => ({ bar: n.bar, cell: n.cell, notes: n.options[winner.path[i]] }));
  return [...out, ...pedals].sort((a, b) => a.bar - b.bar || a.cell - b.cell);
}
