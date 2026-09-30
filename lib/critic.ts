// Song Engine v2 Phase 3: the song critic and best-of-N (docs/song-engine-v2-prd.md R17–R19). Scores a
// whole song, then picks the best of several takes from derived seeds. Pure and deterministic, no React.
import critic from "@/data/critic.json";
import { type RenderedSection, type SectionInputs, mulberry32, renderSection, nextSeed } from "@/lib/generator";
import { PLAYABILITY, songRating } from "@/lib/playability";
import { type SectionId, SECTION_IDS, formSlots } from "@/lib/songPlan";
import { SETTINGS } from "@/lib/voicings";

export const CRITIC = critic;
const W = critic.weights;

/** A song as the critic sees it: every section but the Solo (a lead line, judged by the lead engine), plus Verse 2. */
export type Song = Record<Exclude<SectionId, "solo">, RenderedSection> & { verse2: RenderedSection };

export function renderSong(inputs: Record<SectionId, SectionInputs>): Song {
  const out = {} as Song;
  for (const id of SECTION_IDS) if (id !== "solo") out[id] = renderSection(id, inputs[id]);
  out.verse2 = renderSection("verse", inputs.verse, "push");
  return out;
}

export type Critique = { total: number; parts: Record<"playability" | "arc" | "hook" | "variety" | "flow", number> };

const CHORD_SECTIONS = ["intro", "verse", "prechorus", "chorus", "breakdown", "ending"] as const;
const chordSection = (s: RenderedSection) => !s.lead && s.voicings.length > 0;
const avgPosition = (s: RenderedSection) => s.voicings.reduce((a, v) => a + v.voicing.position, 0) / Math.max(1, s.voicings.length);
/** Sounding eighths per bar ÷ 8 (a let-ring hit counts for every eighth it sustains). */
const density = (s: RenderedSection) =>
  s.bars.reduce((a, bar) => a + bar.cells.reduce((n, ev) => n + (!ev ? 0 : ev.kind === "dead" ? 0.5 : Math.min(ev.cells, 8)), 0), 0) / (8 * Math.max(1, s.bars.length));

/** The first and last voicing a section's hand plays (its first and last bars). */
function ends(s: RenderedSection): [number, number] {
  const at = (bar: RenderedSection["bars"][number]) => s.voicings.find((v) => v.chord.root === bar.chord?.root)?.voicing.position ?? 0;
  return [at(s.bars[0]), at(s.bars[s.bars.length - 1])];
}

/** R17: one score for a whole song (data/critic.json). Higher is better. */
export function critique(song: Song): Critique {
  const chord = CHORD_SECTIONS.map((id) => song[id]).filter(chordSection);
  // Playability: the song's hardest section, and its fastest change.
  const fastest = Math.max(0, ...chord.map((s) => s.playability?.rating.fastest ?? 0));
  const playability = -W.rating * (songRating(chord) - 1) - W.speed * Math.max(0, fastest - PLAYABILITY.changes.comfortPer100ms);
  // Arc: the Chorus is the peak, the Pre-chorus builds to it.
  const { verse, prechorus: pre, chorus } = song;
  let arc = W.chorusOverVerse * Math.min(W.arcCap, chorus.energy - verse.energy);
  if (chordSection(pre) && pre.energy > verse.energy && pre.energy < chorus.energy) arc += W.build;
  // Hook: the Chorus lifts, fills out and gets busier than the Verse.
  const threeShare = chorus.voicings.filter((v) => v.voicing.notes.length >= 3).length / Math.max(1, chorus.voicings.length);
  const hook =
    W.lift * Math.min(1, Math.max(0, avgPosition(chorus) - avgPosition(verse)) / 5) +
    W.threeNote * threeShare +
    W.contrast * Math.min(1, Math.max(0, density(chorus) - density(verse)));
  // Variety: the sections don't all strum at the same density.
  const variety = W.variety * (new Set(chord.map((s) => Math.round(density(s) * 4))).size / chord.length);
  // Flow: where one section hands over to the next, the hand shouldn't jump further than a move inside one.
  // (The Solo sits between the Chorus and the Breakdown, so that handover isn't a direct jump.)
  let jumps = 0;
  const order = formSlots().map((slot) => (slot.section === "solo" ? null : slot.variation === "push" ? song.verse2 : song[slot.section]));
  for (let i = 1; i < order.length; i++) {
    const a = order[i - 1], b = order[i];
    if (!a || !b || !chordSection(a) || !chordSection(b)) continue;
    jumps += Math.max(0, Math.abs(ends(a)[1] - ends(b)[0]) - SETTINGS.maxMove);
  }
  const flow = -W.boundary * jumps;
  const parts = { playability, arc, hook, variety, flow };
  return { total: Object.values(parts).reduce((a, b) => a + b, 0), parts };
}

// ---------------------------------------------------------------------------
// R18: best of N

/** Sections the critic may re-seed: chord sections that aren't locked and don't carry a lead line. */
export type Fixed = Partial<Record<SectionId, SectionInputs>>;

/**
 * The seeds for take k of song seed `songSeed`: take 0 of song 0 is every section's own best (seed 0);
 * the rest come from a seeded generator, so the same song seed always gives the same takes.
 */
export function takeSeeds(songSeed: number, k: number): Record<SectionId, number> {
  const out = {} as Record<SectionId, number>;
  const rng = mulberry32(songSeed * 1009 + k * 9176 + 1);
  for (const id of SECTION_IDS) out[id] = songSeed === 0 && k === 0 ? 0 : Math.floor(rng() * critic.seedSpace);
  return out;
}

export type BestSong = { seeds: Record<SectionId, number>; score: Critique; scores: number[] };

/**
 * GENERATE (R18): N takes of the song, keeping the critic's best. `base` gives the song's inputs (key, feel,
 * progression); `fixed` sections (locked, or carrying a lead line) keep their own inputs in every take.
 * `avoid`, if given, is the song on screen: takes that change none of the free sections are skipped, so
 * GENERATE always writes something new when it can. Ties keep the earlier take.
 */
export function bestSong(
  base: Omit<SectionInputs, "seed" | "lead">,
  songSeed: number,
  fixed: Fixed = {},
  avoid?: Partial<Record<SectionId, number>>,
  n = critic.candidates,
): BestSong {
  // The Solo isn't judged by the critic, so it keeps whatever the caller gives it (or seed 0).
  const free = SECTION_IDS.filter((id) => !fixed[id] && id !== "solo");
  let best: BestSong | null = null;
  const scores: number[] = [];
  for (let k = 0; k < n; k++) {
    const seeds = takeSeeds(songSeed, k);
    if (avoid && free.every((id) => seeds[id] === avoid[id])) continue;
    const inputs = {} as Record<SectionId, SectionInputs>;
    for (const id of SECTION_IDS) inputs[id] = fixed[id] ?? { ...base, seed: id === "solo" ? 0 : seeds[id], lead: null };
    const score = critique(renderSong(inputs));
    scores.push(score.total);
    if (!best || score.total > best.score.total + 1e-9) best = { seeds, score, scores };
  }
  if (!best) return bestSong(base, songSeed + 1, fixed, avoid, n);
  for (const id of SECTION_IDS) if (fixed[id]) best.seeds[id] = fixed[id]!.seed;
  return { ...best, scores };
}

/**
 * A section's ↻ (R19): the next N takes of that section alone that sound different from the one on screen,
 * each scored in the song as it stands; the best wins. Only that section changes, and it always changes.
 * Takes move forward from the current seed, so pressing again keeps finding new ones.
 */
export function bestSectionTake(id: SectionId, inputs: Record<SectionId, SectionInputs>, n = critic.candidates): number {
  const current = inputs[id];
  if (id === "solo" || current.lead) return nextSeed(id, current);
  const tabs = new Map<number, string>();
  const tab = (seed: number) => {
    if (!tabs.has(seed)) tabs.set(seed, JSON.stringify(renderSection(id, { ...current, seed }).tab));
    return tabs.get(seed)!;
  };
  const now = tab(current.seed);
  const tried: number[] = [];
  let seed = current.seed;
  for (let tries = 0; tried.length < n && tries < 50; tries++) {
    seed = nextSeed(id, { ...current, seed });
    if (tab(seed) !== now && !tried.some((s) => tab(s) === tab(seed))) tried.push(seed);
  }
  if (!tried.length) return nextSeed(id, current);
  let bestSeed = tried[0], bestScore = -Infinity;
  for (const s of tried) {
    const score = critique(renderSong({ ...inputs, [id]: { ...current, seed: s } })).total;
    if (score > bestScore + 1e-9) {
      bestSeed = s;
      bestScore = score;
    }
  }
  return bestSeed;
}
