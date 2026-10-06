// The home page's content, all from the app's own data and engines: the keys, the five feels and their tempos, the
// chord library's power-chord shapes, the length planner, the MIDI export's parts, the Chord Lab's voicings and mood map.
import midiLanes from "@/data/midi-lanes.json";
import { FEEL_IDS, type RenderedSection, getFeel, getTemplate, playbackBpm, renderSection } from "@/lib/generator";
import { TUNINGS, positionOf, voicingsFor } from "@/lib/lab/chords";
import { MOOD_LOOPS, moodPoints } from "@/lib/lab/mood";
import { type NoteName, PITCH_CLASSES } from "@/lib/musicTheory";
import { LENGTH, formatLength, planSong } from "@/lib/songLength";

export type HomeState = { key: number; feel: number; length: number; speed: number };

/** The keys as the live card shows them, from A. */
export const KEY_NOTES: NoteName[] = [...PITCH_CLASSES.slice(9), ...PITCH_CLASSES.slice(0, 9)];
export const KEYS = KEY_NOTES.map((n) => n as string);

/** `bpm` is the click the page's beat runs at; `shown` is the tempo the Generator shows (Half-time: 90 on a 180 click). */
export const FEELS = FEEL_IDS.map((id) => ({ id, label: getFeel(id).label, bpm: playbackBpm(id), shown: Number(getFeel(id).displayBpm) || playbackBpm(id) }));

/** The practice speeds (the transport's). */
export const SPEEDS = [1, 0.9, 0.75, 0.5];
/** START WRITING: the Generator, in the key and feel picked here (it applies them, keeps the rest, and drops the query). */
export const generatorHref = (s: HomeState) => `/generator/?key=${encodeURIComponent(KEY_NOTES[s.key])}&feel=${FEELS[s.feel].id}`;
export const bpmOf = (s: HomeState) => Math.round(FEELS[s.feel].bpm * SPEEDS[s.speed]);
/** The tempo to show for the feel and practice speed, as the Generator shows it. */
export const shownBpmOf = (s: HomeState) => Math.round(FEELS[s.feel].shown * SPEEDS[s.speed]);

/**
 * A part of the song in a key and feel, written by the Song Generator's own engine (the same take every time:
 * I–V–vi–IV, seed 1), so the home page's tabs, chips and captions are exactly what the Generator writes.
 */
const sections = new Map<string, RenderedSection>();
export function sectionFor(id: "intro" | "verse" | "chorus", keyIndex: number, feelIndex: number): RenderedSection {
  const k = `${id}:${keyIndex}:${feelIndex}`;
  let s = sections.get(k);
  if (!s) {
    s = renderSection(id, { key: KEY_NOTES[keyIndex], feel: FEELS[feelIndex].id, progressionId: "I-V-vi-IV", seed: 1 });
    sections.set(k, s);
  }
  return s;
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
export const G_SHAPES = [...new Set(G_ALL.map(positionOf))].map((pos) => G_ALL.find((v) => positionOf(v) === pos)!).slice(0, 3).map((v) => ({ voicing: v, frets: v.frets, position: positionOf(v) }));

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
