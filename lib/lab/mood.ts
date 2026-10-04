// Chord Lab vibe scoring (docs/chord-lab-prd.md L14, L19): how bright, how restless and how classic a loop of
// chords is. The builder shows them as meters and the mood map plots them. Scores come from the degrees and
// chord types in data/chord-moves.json (brightness and pull) and the app's ten progressions (classic).
// Pure, no React.
import movesJson from "@/data/chord-moves.json";
import { type ChordTypeId } from "@/lib/lab/chords";
import { type DegreeId } from "@/lib/lab/keys";
import { progressions } from "@/lib/musicTheory";

export type LoopChord = { degree: DegreeId; type: ChordTypeId };

const BRIGHT = movesJson.brightness as { degree: Record<string, number>; type: Record<string, number> };
const PULL = movesJson.pull as { degree: Record<string, number>; type: Record<string, number>; neverHome: number };

const clamp = (n: number) => Math.max(0, Math.min(1, n));
/** Chords with a 3rd say bright or dark by their type; the others only by where they sit in the key. */
const HAS_THIRD: ChordTypeId[] = ["maj", "min", "7", "maj7", "m7", "add9"];

/** 0 (dark) to 1 (bright): the average of each chord's degree and, where it has a 3rd, its type. */
export function brightness(loop: LoopChord[]): number {
  if (!loop.length) return 0.5;
  const each = loop.map((c) => {
    const d = BRIGHT.degree[c.degree] ?? 0.5;
    return HAS_THIRD.includes(c.type) ? 0.5 * d + 0.5 * (BRIGHT.type[c.type] ?? 0.5) : d;
  });
  return clamp(each.reduce((a, b) => a + b, 0) / each.length);
}

/** 0 (settled) to 1 (restless): how much the last chord wants to go on, more if the loop never visits home. */
export function restlessness(loop: LoopChord[]): number {
  if (!loop.length) return 0.5;
  const last = loop[loop.length - 1];
  let pull = PULL.degree[last.degree] ?? 0.5;
  pull += PULL.type[last.type] ?? 0; // a sus or 7th chord leans on
  if (!loop.some((c) => c.degree === "I")) pull += PULL.neverHome;
  return clamp(pull);
}

const CORE: DegreeId[] = ["I", "IV", "V", "vi"];
const KNOWN = progressions.map((p) => p.degrees.join("-"));

const rotations = (ids: string[]) => ids.map((_, i) => [...ids.slice(i), ...ids.slice(0, i)].join("-"));

/** 0 to 1: 1 for one of the genre's ten loops (as written, or started on another chord), else the share of chords from I, IV, V and vi. */
export function classicness(loop: LoopChord[]): number {
  if (!loop.length) return 0;
  const ids = loop.map((c) => c.degree as string);
  if (rotations(ids).some((r) => KNOWN.includes(r))) return 1;
  return clamp(0.6 * (ids.filter((d) => CORE.includes(d as DegreeId)).length / ids.length));
}

export type Vibe = { brightness: number; restlessness: number; classic: number };
export const vibeOf = (loop: LoopChord[]): Vibe => ({ brightness: brightness(loop), restlessness: restlessness(loop), classic: classicness(loop) });

/** A few plain words for each score (the meters' one-line reasons). */
export function brightnessWords(v: number): string {
  return v >= 0.7 ? "Bright: mostly major chords near home." : v >= 0.45 ? "In between: major and minor chords mixed." : "Dark: leans on the minor chords.";
}
export function restlessnessWords(v: number, loop: LoopChord[]): string {
  if (!loop.length) return "Add a chord.";
  return v >= 0.6 ? "It ends away from home, so it wants to go round again." : v >= 0.3 ? "It ends part-way: it could stop or go on." : "It ends at home: settled.";
}
export function classicWords(v: number): string {
  return v >= 1 ? "One of the genre's own loops." : v >= 0.45 ? "Built from the genre's favourite chords." : "Your own twist: few of the usual chords.";
}
