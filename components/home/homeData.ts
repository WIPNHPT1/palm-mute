// The home page's content, all from the app's own data and engines: the keys, the five feels and their tempos, the
// chord library's power-chord shapes, the length planner, the MIDI export's parts, the Chord Lab's voicings and mood map.
import midiLanes from "@/data/midi-lanes.json";
import { FEEL_IDS, getFeel, getTemplate, playbackBpm } from "@/lib/generator";
import { TUNINGS, positionOf, voicingsFor } from "@/lib/lab/chords";
import { MOOD_LOOPS, moodPoints } from "@/lib/lab/mood";
import { type Degree, type NoteName, type TabString, PITCH_CLASSES, TAB_STRINGS, chordForDegree } from "@/lib/musicTheory";
import { LENGTH, formatLength, planSong } from "@/lib/songLength";

export type HomeState = { key: number; feel: number; length: number; speed: number };

/** The keys as the live card shows them, from A. */
export const KEY_NOTES: NoteName[] = [...PITCH_CLASSES.slice(9), ...PITCH_CLASSES.slice(0, 9)];
export const KEYS = KEY_NOTES.map((n) => n as string);

export const FEELS = FEEL_IDS.map((id) => ({ id, label: getFeel(id).label, bpm: playbackBpm(id) }));

/** The practice speeds (the transport's). */
export const SPEEDS = [1, 0.9, 0.75, 0.5];
export const bpmOf = (s: HomeState) => Math.round(FEELS[s.feel].bpm * SPEEDS[s.speed]);

const LOOP: Degree[] = ["I", "V", "vi", "IV"];

/** I–V–vi–IV in a key, with each chord's two-note tab from the chord library. */
export function chordsFor(keyIndex: number) {
  return LOOP.map((degree) => {
    const c = chordForDegree(KEY_NOTES[keyIndex], degree);
    return { degree, name: c.name, root: c.root, chord: c.chord, tab: TAB_STRINGS.map((s) => `${s}|${c.chord.twoNoteTab[s]}`).join("\n") };
  });
}

/**
 * The loop as a palm-muted verse in a key: one bar per chord (I, V, vi, IV, or the first `bars` of them), eight
 * eighth-note downstrokes each, on the chord library's two-note shapes, so the tab plays what the chips show. Each bar
 * is 16 characters after "e|", with a "|" between bars.
 */
export function loopTab(keyIndex: number, bars = 4) {
  const chords = chordsFor(keyIndex).slice(0, bars);
  const strums = (fret: string) => (fret === "-" ? "-".repeat(16) : `${fret}-`.repeat(8));
  return {
    names: chords.map((c) => c.name),
    rows: TAB_STRINGS.map((s: TabString) => `${s}|${chords.map((c) => strums(c.chord.twoNoteTab[s])).join("|")}|`),
    pm: `  ${chords.map(() => "P.M.------------").join(" ")}`,
  };
}

/** The song lengths the Generator offers (its slider's steps). */
export const LENGTHS: number[] = [];
for (let t = LENGTH.min; t <= LENGTH.max; t += LENGTH.step) LENGTHS.push(t);

/** The song's form for a length, from the Generator's own planner (each section's template bars). */
export function formFor(lengthIndex: number, bpm: number) {
  const plan = planSong(LENGTHS[lengthIndex], bpm, (id) => getTemplate(id).bars);
  return {
    time: formatLength(LENGTHS[lengthIndex]),
    parts: plan.slots.map((s) => ({ name: s.name, section: s.section, weight: getTemplate(s.section).bars * s.times })),
  };
}

/** The MIDI export's ten parts. */
export const LANES = (midiLanes.lanes as { id: string; name: string }[]).map((l) => l.name);

/** The Chord Lab's G major, one shape from each position up the neck (frets low E to high e; null = not played). */
const G_ALL = voicingsFor(7, "maj", "e-standard");
export const G_SHAPES = [...new Set(G_ALL.map(positionOf))].map((pos) => G_ALL.find((v) => positionOf(v) === pos)!).slice(0, 3).map((v) => ({ frets: v.frets, position: positionOf(v) }));

/** The app's own ten loops on the Chord Lab's mood map. */
export const MOOD = moodPoints(MOOD_LOOPS).filter((p) => p.own).map((p) => ({ id: p.degrees.join("–"), x: p.x, y: p.y }));

/** A steady, repeatable level (0–1) for a meter at a beat: the page renders the same picture on the server. */
export function level(beat: number, lane: number): number {
  const n = Math.sin(beat * 12.9898 + lane * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

/** The numbers strip, counted from the data. */
export const STATS: [string, string][] = [
  [String(KEYS.length), "KEYS"],
  [String(FEELS.length), "FEELS"],
  [String(LENGTHS.length), "SONG LENGTHS"],
  [String(TUNINGS.length), "TUNINGS"],
  [String(LANES.length), "MIDI PARTS"],
  ["0", "TABS STORED"],
];
