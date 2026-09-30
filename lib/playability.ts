// Song Engine v2 Phase 2: the playability model (docs/song-engine-v2-prd.md R1–R5). How a guitarist's two
// hands experience a section: which strings must be muted and by what (R1), how fast each chord change is
// at the feel's tempo (R2), how long the picking hand downpicks (R3), and a 1–5 rating (R4). Pure
// functions over data/playability.json. No React.
import data from "@/data/playability.json";
import { type Fretted, type TabString, LOW_TO_HIGH, midiOf, pitchClass } from "@/lib/fretboard";
import type { Voicing } from "@/lib/voicings";

export const PLAYABILITY = data;
const CH = data.changes;

// ---------------------------------------------------------------------------
// R1: mute plans

export type MuteSource = "lean" | "underside" | "tip" | "thumb" | "pick";
export type MutePlan = { ok: true; mutes: { string: TabString; by: MuteSource }[] } | { ok: false; reason: string };

/**
 * What silences every string a strum could hit but the chord doesn't play. `pm` bars can rely on an
 * accurate pick for strings below the root; ringing bars can't. See data/playability.json.
 */
export function mutePlan(notes: Fretted[], articulation: "pm" | "ring"): MutePlan {
  const idx = (s: TabString) => LOW_TO_HIGH.indexOf(s);
  const played = [...notes].sort((a, b) => idx(a.string) - idx(b.string));
  const lo = idx(played[0].string), hi = idx(played[played.length - 1].string);
  const fretted = (i: number) => played.some((n) => idx(n.string) === i && n.fret > 0);
  const anyFretted = played.some((n) => n.fret > 0);
  const mutes: { string: TabString; by: MuteSource }[] = [];
  let thumbFree = true;
  for (let i = 0; i < 6; i++) {
    const string = LOW_TO_HIGH[i];
    if (played.some((n) => n.string === string)) continue;
    if (i > lo && i < hi) {
      if (!fretted(i - 1) && !fretted(i + 1)) return { ok: false, reason: `nothing can lean on the ${string} string between two open notes` };
      mutes.push({ string, by: "lean" });
    } else if (i > hi) {
      if (!anyFretted) return { ok: false, reason: `nothing frets, so nothing mutes the ${string} string` };
      mutes.push({ string, by: "underside" });
    }
  }
  // Below the root, nearest first: the root finger's tip, then the thumb (low E only), then the pick (P.M. only).
  for (let i = lo - 1, first = true; i >= 0; i--, first = false) {
    const string = LOW_TO_HIGH[i];
    if (first && fretted(lo)) mutes.push({ string, by: "tip" });
    else if (string === "E" && thumbFree) {
      thumbFree = false;
      mutes.push({ string, by: "thumb" });
    } else if (articulation === "pm") mutes.push({ string, by: "pick" });
    else return { ok: false, reason: `nothing mutes the ${string} string under a ringing ${played[0].string}-string root` };
  }
  return { ok: true, mutes };
}

// ---------------------------------------------------------------------------
// R2: tempo-aware chord changes

export function eighthMs(bpm: number): number {
  return 60000 / bpm / 2;
}

/** How hard a change is, in fret-equivalents (data/playability.json `changes.weights`). */
export function moveDifficulty(a: Voicing, b: Voicing): number {
  if (a.rootPc === b.rootPc && a.shapeId === b.shapeId && a.position === b.position) return 0;
  const w = CH.weights;
  let d = w.fret * Math.abs(a.position - b.position);
  if (a.rootString !== b.rootString) d += w.stringSet;
  if (a.notes.length !== b.notes.length) d += w.shapeChange;
  if (a.open && !b.open) d += w.leaveOpen;
  return d;
}

/** Fret-equivalents per 100 ms. */
export function changeSpeed(difficulty: number, gapCells: number, bpm: number): number {
  return difficulty === 0 ? 0 : difficulty / ((gapCells * eighthMs(bpm)) / 100);
}

/** The cost the path search pays for a change this fast (0 up to comfort), or Infinity over the limit. */
export function speedCost(speed: number): number {
  if (speed > CH.limitPer100ms + 1e-9) return Infinity;
  return Math.max(0, speed - CH.comfortPer100ms) * CH.costWeight;
}

/**
 * Eighths available for each change between consecutive bars, from the rhythm alone (so the search can use
 * it before any voicing exists): from the last fretted hit of bar i-1 to the first of bar i, or to bar i-1's
 * last eighth when bar i-1 pushes. `gaps[0]` is unused.
 */
export function rhythmGaps(patterns: string[], pushes: number[]): number[] {
  // Dead strums don't hold the chord (the fretting hand lifts to mute), so the hand can move during them.
  const onsets = (p: string) => [...p].flatMap((c, i) => (c === "D" || c === "U" ? [i] : []));
  return patterns.map((p, i) => {
    if (i === 0) return 0;
    const prev = onsets(patterns[i - 1]);
    if (pushes.includes(i - 1)) {
      const before = prev.filter((c) => c < 7);
      return before.length ? 7 - before[before.length - 1] : 7;
    }
    const first = onsets(p)[0] ?? 8;
    return 8 - (prev[prev.length - 1] ?? 0) + first;
  });
}

type Hit = { kind: "hit" | "dead"; notes: Fretted[]; up: boolean; cells: number } | null;
type Bar = { cells: Hit[]; articulation?: "pm" | "ring" };

/** Every chord change in rendered bars, with the eighths available (the same rule, read off the events). */
export function changesIn(bars: Bar[], voicingOf: (notes: Fretted[]) => Voicing): { at: number; from: Voicing; to: Voicing; gap: number }[] {
  const flat = bars.flatMap((bar, b) => bar.cells.map((ev, c) => ({ ev, t: b * 8 + c })));
  const picks = flat.filter((x) => x.ev?.kind === "hit") as { ev: NonNullable<Hit>; t: number }[];
  const out: { at: number; from: Voicing; to: Voicing; gap: number }[] = [];
  for (let i = 1; i < picks.length; i++) {
    const a = voicingOf(picks[i - 1].ev.notes), b = voicingOf(picks[i].ev.notes);
    if (a !== b) out.push({ at: picks[i].t, from: a, to: b, gap: picks[i].t - picks[i - 1].t });
  }
  return out;
}

// ---------------------------------------------------------------------------
// R3: picking-hand load

export type Difficulty = "beginner" | "intermediate" | "advanced";
export const DEFAULT_DIFFICULTY = data.picking.default as Difficulty;

/** The longest run of consecutive eighth-note strums all picked down, when eighths come at or above `fastRate`. */
export function longestDownRun(bars: Bar[], bpm: number): number {
  if (1000 / eighthMs(bpm) < data.picking.fastRate) return 0;
  let run = 0, best = 0;
  for (const bar of bars)
    for (const ev of bar.cells) {
      run = ev && !ev.up ? run + 1 : 0;
      best = Math.max(best, run);
    }
  return best;
}

/** The difficulty's cap on fast downpicked runs, or null for none. */
export function downRunCap(difficulty: Difficulty = DEFAULT_DIFFICULTY): number | null {
  return (data.picking.caps as Record<Difficulty, number | null>)[difficulty];
}

// ---------------------------------------------------------------------------
// R5: label honesty

/** The pitch classes a chord label promises: "C5" = root + fifth, "C oct" = the root alone. */
export function labelPitchClasses(label: string, rootPc: number): number[] {
  return / oct$/.test(label) ? [rootPc] : [rootPc, (rootPc + 7) % 12].sort((a, b) => a - b);
}

export function pitchClassesOf(notes: Fretted[]): number[] {
  return [...new Set(notes.map((n) => pitchClass(midiOf(n))))].sort((a, b) => a - b);
}

// ---------------------------------------------------------------------------
// R4: rating

export type Rating = { score: 1 | 2 | 3 | 4 | 5; fastest: number; runs: number; mutes: number; why: string[] };

/** A section's 1–5 difficulty from its hands' work (data/playability.json `rating`). */
export function rateSection(bars: Bar[], voicings: Voicing[], bpm: number, fastMuted: boolean, fastest: number): Rating {
  const p = data.rating.points;
  const why: string[] = [];
  let pts = p.base;
  const add = (points: number, reason: string) => {
    pts += points;
    why.push(reason);
  };
  const overSpeed = Math.max(0, fastest - CH.comfortPer100ms);
  if (overSpeed) add(p.speed * overSpeed, `fast change (${fastest.toFixed(1)} frets/100 ms)`);
  const hard = voicings.filter((v) => {
    const plan = mutePlan(v.notes, "ring");
    return !plan.ok || plan.mutes.some((m) => m.by === "thumb" || m.by === "lean");
  }).length;
  if (hard) add(p.mute * hard, `${hard} shape${hard > 1 ? "s" : ""} with a thumb or lean mute`);
  const runs = longestDownRun(bars, bpm);
  if (runs > 16) add((p.run * (runs - 16)) / 8, `${runs} downstrokes in a row`);
  const stretch = Math.max(0, ...voicings.map((v) => Math.max(...v.notes.map((n) => n.fret)) - Math.min(...v.notes.filter((n) => n.fret > 0).map((n) => n.fret)) - 2));
  if (stretch > 0) add(p.stretch * stretch, "a wide stretch");
  if (voicings.some((v) => v.position > 9)) add(p.high, "high on the neck");
  if (fastMuted && voicings.some((v) => v.notes.length >= 3)) add(p.threeNote, "3-note shapes in fast palm-muting");
  const score = Math.min(5, Math.max(1, Math.round(pts))) as Rating["score"];
  return { score, fastest, runs, mutes: hard, why };
}

/** A song's rating: its hardest section decides (a player has to get through every part). */
export function songRating(sections: { playability?: { rating: Rating } }[]): Rating["score"] {
  return Math.max(1, ...sections.map((s) => s.playability?.rating.score ?? 1)) as Rating["score"];
}
