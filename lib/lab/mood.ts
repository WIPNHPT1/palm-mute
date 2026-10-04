// Chord Lab vibe scoring (docs/chord-lab-prd.md L14, L19): how bright, how restless and how classic a loop of
// chords is. The builder shows them as meters and the mood map plots them. Scores come from the degrees and
// chord types in data/chord-moves.json (brightness and pull) and the app's ten progressions (classic).
// Pure, no React.
import moodJson from "@/data/mood-map.json";
import movesJson from "@/data/chord-moves.json";
import { type ChordTypeId } from "@/lib/lab/chords";
import { type DegreeId, DEGREES } from "@/lib/lab/keys";
import { progressions } from "@/lib/musicTheory";

export type LoopChord = { degree: DegreeId; type: ChordTypeId };

/** Where a new Builder loop starts: the genre's most common one, as power chords. */
export const START_LOOP: LoopChord[] = (["I", "V", "vi", "IV"] as DegreeId[]).map((degree) => ({ degree, type: "5" }));

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

/**
 * 0 (settled) to 1 (restless): mostly how much the last chord wants to go on (a sus or 7th chord leans on
 * more), a little how far from home the rest of the loop strays, and more if the loop never visits home.
 */
export function restlessness(loop: LoopChord[]): number {
  if (!loop.length) return 0.5;
  const last = loop[loop.length - 1];
  const end = (PULL.degree[last.degree] ?? 0.5) + (PULL.type[last.type] ?? 0);
  const strays = loop.reduce((sum, c) => sum + (PULL.degree[c.degree] ?? 0.5), 0) / loop.length;
  return clamp(0.7 * end + 0.3 * strays + (loop.some((c) => c.degree === "I") ? 0 : PULL.neverHome));
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

// ---------------------------------------------------------------------------
// The mood map (docs/chord-lab-prd.md §5.6): x is dark to bright, y is settled to restless.

export type MoodLoop = { id: string; degrees: DegreeId[]; own: boolean };
export type MoodPoint = MoodLoop & { bright: number; restless: number; x: number; y: number };

/** Plot space, in percent of the map: scores land between these margins. */
export const MAP = { x0: 8, x1: 92, y0: 18, y1: 82, rowGap: 6, labelChar: 0.973, labelPad: 1.9, dotReach: 3, labelOffset: 4.7, margin: 1, nudge: 2 };

/**
 * The four corner labels (Tense, Anthem, Brooding, Feel-good), as boxes on the map in percent, sized for the
 * smallest map (a square plot of about 224px on a 320px phone, where the 12px labels are about 40% wide and 13%
 * tall): no dot or name may sit on one.
 */
export const CORNERS = [
  { name: "Tense", x0: 0, x1: 40, y0: 0, y1: 13 },
  { name: "Anthem", x0: 60, x1: 100, y0: 0, y1: 13 },
  { name: "Brooding", x0: 0, x1: 40, y0: 87, y1: 100 },
  { name: "Feel-good", x0: 60, x1: 100, y0: 87, y1: 100 },
] as const;

/** True if a dot (with its name) would sit on a corner label. */
export function cornerClash(p: { id: string; x: number; y: number }): boolean {
  const [l, r] = reach(p.id, p.x);
  return CORNERS.some((c) => l < c.x1 + MAP.margin && c.x0 < r + MAP.margin && p.y - MAP.rowGap / 2 < c.y1 && p.y + MAP.rowGap / 2 > c.y0);
}

/** A dot's name goes beside it: to the left on the right third of the map (so it stays inside), else to the right. */
export const labelSide = (x: number): "left" | "right" => (x > MAP.x0 + (MAP.x1 - MAP.x0) * 0.66 ? "left" : "right");

/**
 * The stretch of the map a dot and its name cover, in percent across (the name's width is estimated from its
 * length at the narrowest plot where names show, 740px: 12px mono text is about 7.2px a character).
 */
export function reach(id: string, x: number): [number, number] {
  const w = id.length * MAP.labelChar + MAP.labelPad;
  return labelSide(x) === "left" ? [x - MAP.labelOffset - w, x + MAP.dotReach] : [x - MAP.dotReach, x + MAP.labelOffset + w];
}

/** True if two dots (with their names) would print on top of each other. */
export function labelsClash(a: { id: string; x: number; y: number }, b: { id: string; x: number; y: number }): boolean {
  if (Math.abs(a.y - b.y) >= MAP.rowGap) return false;
  const [al, ar] = reach(a.id, a.x);
  const [bl, br] = reach(b.id, b.x);
  return al < br + MAP.margin && bl < ar + MAP.margin;
}

/** A loop's chords in their natural quality (full chords: the 3rd is what makes a loop bright or dark). */
export const naturalLoop = (degrees: DegreeId[]): LoopChord[] => degrees.map((degree) => ({ degree, type: DEGREES.find((d) => d.id === degree)!.quality }));

/** The app's ten progressions, then the extra loops in data/mood-map.json. */
export const MOOD_LOOPS: MoodLoop[] = [
  ...progressions.map((p) => ({ id: p.id, degrees: p.degrees as DegreeId[], own: true })),
  ...(moodJson.loops as DegreeId[][]).map((degrees) => ({ id: degrees.join("-"), degrees, own: false })),
];
function MOOD_LOOPS_RAW(): DegreeId[][] {
  return MOOD_LOOPS.map((l) => l.degrees);
}

// The map spreads its loops across the whole plot: each score is read against the lowest and highest of the
// loops on it, so "bright" and "restless" mean "brighter / more restless than most", not an absolute scale.
const raw = MOOD_LOOPS_RAW().map((l) => vibeOf(naturalLoop(l)));
const RANGE = {
  b: [Math.min(...raw.map((v) => v.brightness)), Math.max(...raw.map((v) => v.brightness))],
  r: [Math.min(...raw.map((v) => v.restlessness)), Math.max(...raw.map((v) => v.restlessness))],
};
const spread = (v: number, [lo, hi]: number[]) => clamp(hi > lo ? (v - lo) / (hi - lo) : 0.5);
/** A score pair read against the map's loops: 0 to 1 each way. */
export const onMap = (bright: number, restless: number) => ({ bright: spread(bright, RANGE.b), restless: spread(restless, RANGE.r) });

/** Where a score pair sits on the map (percent from the left and from the top). */
export function placeScores(bright: number, restless: number) {
  const m = onMap(bright, restless);
  return { x: MAP.x0 + m.bright * (MAP.x1 - MAP.x0), y: MAP.y1 - m.restless * (MAP.y1 - MAP.y0) };
}

/**
 * Every loop's place on the map. Loops that would print their names on top of each other (within `labelGap`
 * across and `rowGap` down) are nudged up or down, in a fixed order, so the map reads the same every time.
 */
export function moodPoints(loops: MoodLoop[] = MOOD_LOOPS): MoodPoint[] {
  const placed: MoodPoint[] = [];
  for (const loop of loops) {
    const v = vibeOf(naturalLoop(loop.degrees));
    const { x, y } = placeScores(v.brightness, v.restlessness);
    const m = onMap(v.brightness, v.restlessness);
    const clash = (xx: number, yy: number) => cornerClash({ id: loop.id, x: xx, y: yy }) || placed.some((q) => labelsClash({ id: loop.id, x: xx, y: yy }, q));
    // The nearest free spot: straight up or down first, then a little to the side.
    let spot = { x, y };
    search: for (let k = 0; k <= 40; k++) {
      for (const dx of [0, 5, -5, 10, -10, 15, -15, 20, -20, 25, -25]) {
        for (const dy of k === 0 ? [0] : [k * MAP.rowGap, -k * MAP.rowGap]) {
          const cx = x + dx;
          if (cx < MAP.x0 - 2 || cx > MAP.x1 + 2) continue;
          const cy = y + dy;
          if (cy < MAP.y0 - MAP.nudge || cy > MAP.y1 + MAP.nudge || clash(cx, cy)) continue;
          spot = { x: cx, y: cy };
          break search;
        }
      }
    }
    const at = spot.y;
    placed.push({ ...loop, bright: m.bright, restless: m.restless, x: spot.x, y: at });
  }
  return placed;
}

/** The loop nearest to a point on the map (percent coordinates). */
export function nearestPoint(points: MoodPoint[], x: number, y: number): MoodPoint {
  return points.reduce((best, p) => (Math.hypot(p.x - x, p.y - y) < Math.hypot(best.x - x, best.y - y) ? p : best));
}

export type Quadrant = "Tense" | "Anthem" | "Brooding" | "Feel-good" | "Middle of the map";
/** The corner a loop sits in, or "Middle of the map" when both its scores are in the middle band (0.35 to 0.65). */
export const quadrantOf = (bright: number, restless: number): Quadrant =>
  bright > 0.35 && bright < 0.65 && restless > 0.35 && restless < 0.65
    ? "Middle of the map"
    : restless >= 0.5
      ? bright >= 0.5
        ? "Anthem"
        : "Tense"
      : bright >= 0.5
        ? "Feel-good"
        : "Brooding";
