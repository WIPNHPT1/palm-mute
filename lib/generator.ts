// Section/tab/rhythm generation (data-model.md §1, §4; interaction-spec.md §3). Pure functions, no React.
import feelsJson from "@/data/feels.json";
import rhythmJson from "@/data/rhythm-patterns.json";
import recipesJson from "@/data/section-recipes.json";
import templatesJson from "@/data/song-section-templates.json";
import {
  type Fretted,
  type TabBar,
  type TabLineGroup,
  CELLS_PER_BAR,
  describeFretted,
  describeNotes,
  renderTab,
  tabText,
} from "@/lib/fretboard";
import {
  type Degree,
  type NoteName,
  type ResolvedChord,
  type TabString,
  OPEN_STRING_MIDI,
  leadLickRootFret,
  pitchClassOf,
  progressions,
  resolveDegrees,
  resolveProgression,
} from "@/lib/musicTheory";
import { type ShapeTag, type Voicing, registerTarget, voicePaths } from "@/lib/voicings";

export type FeelId = "fast-punk" | "half-time" | "mid-tempo";
export type SectionId = "intro" | "verse" | "chorus" | "solo" | "breakdown";
export type Glyph = "▼" | "▲" | "·";

export const SECTION_IDS: SectionId[] = ["intro", "verse", "chorus", "solo", "breakdown"];

export type Feel = {
  id: FeelId;
  label: string;
  tempoSource: "punkMaster" | "midTempoDefault";
  displayBpm: number | string;
  drumFeel: string;
  rhythmPatternId: string;
};

export type RhythmPattern = {
  id: string;
  name: string;
  feel: FeelId;
  glyphs: Glyph[];
  beatLabel: string;
  description: string;
  tagColor: "ink" | "muted" | "brass";
};

type SectionTemplate = {
  id: SectionId;
  label: string;
  bars: number;
  muted: boolean;
  degreeSequence?: Degree[] | "USE_SELECTED_PROGRESSION";
  type?: "lead-lick";
  caption: string;
  lockedByDefault: boolean;
  highlightInUI?: boolean;
  forceFeel?: FeelId;
  leadLickFormula?: { pattern: Record<"e" | "B", string[]> };
};

export const feels = feelsJson.feels as Feel[];
export const rhythmPatterns = rhythmJson.patterns as RhythmPattern[];
export const sectionTemplates = templatesJson.sections as SectionTemplate[];

export const PUNK_MASTER_BPM = feelsJson.masterTempos.punkMaster.bpm;
export const MID_TEMPO = {
  default: feelsJson.masterTempos.midTempoDefault.bpm,
  min: feelsJson.masterTempos.midTempoDefault.min,
  max: feelsJson.masterTempos.midTempoDefault.max,
};

export function getFeel(id: FeelId): Feel {
  return feels.find((f) => f.id === id)!;
}

export function patternForFeel(id: FeelId): RhythmPattern {
  const feel = getFeel(id);
  return rhythmPatterns.find((p) => p.id === feel.rhythmPatternId)!;
}

export function getTemplate(id: SectionId): SectionTemplate {
  return sectionTemplates.find((s) => s.id === id)!;
}

/**
 * The playback clock for a feel. Fast Punk and Half-Time share the punk master tempo (the
 * half-time feel comes from the drum template, not a tempo change); Mid-Tempo is independent.
 */
export function playbackBpm(feel: FeelId, midTempoBpm: number): number {
  return getFeel(feel).tempoSource === "punkMaster" ? PUNK_MASTER_BPM : midTempoBpm;
}

// ---------------------------------------------------------------------------
// Seeded randomness — a seed of 0 always reproduces the canonical (mockup-matching) output.

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Rhythmic-phrasing variation (interaction-spec §3): mute or add 1–2 strokes, beat 1 always stays. */
export function varyGlyphs(base: Glyph[], seed: number): Glyph[] {
  if (seed === 0) return base;
  const rng = mulberry32(seed * 7919 + 17);
  const out = [...base];
  const toggles = rng() < 0.5 ? 1 : 2;
  for (let i = 0; i < toggles; i++) {
    const idx = 1 + Math.floor(rng() * (out.length - 1));
    out[idx] = out[idx] !== "·" ? "·" : idx % 2 === 0 ? "▼" : "▲";
  }
  return out;
}

// Solo lead licks. Seed 0 = the template (e and B both r, r+2, r, r+2 — "5,7,5,7" in A).
// Any other seed writes a new phrase from the key's major pentatonic, played in the box around the
// template's anchor fret (fret r-1 … r+3 on the G, B and e strings), always resolving on the root.

const MAJOR_PENTATONIC = [0, 2, 4, 7, 9];
const LEAD_STRINGS: TabString[] = ["G", "B", "e"];

export type LickNote = { string: TabString; fret: number; midi: number };

/** Every major-pentatonic note in the anchor box, lowest pitch first (duplicate pitches dropped). */
export function pentatonicBox(key: NoteName): LickNote[] {
  const r = leadLickRootFret(key);
  const keyPc = pitchClassOf(key);
  const notes: LickNote[] = [];
  for (const string of LEAD_STRINGS) {
    for (let fret = Math.max(0, r - 1); fret <= r + 3; fret++) {
      const midi = OPEN_STRING_MIDI[string] + fret;
      if (MAJOR_PENTATONIC.includes((((midi - keyPc) % 12) + 12) % 12)) notes.push({ string, fret, midi });
    }
  }
  notes.sort((a, b) => a.midi - b.midi);
  return notes.filter((n, i) => i === 0 || n.midi !== notes[i - 1].midi);
}

export type Lick = {
  notes: { string: TabString; fret: number }[];
  gaps: number[];
  /** Template lick doubles every note on e and B (as in the original mockup). */
  doubleStop: boolean;
};

// Melodic motion per step, in box positions: mostly stepwise, some skips, the odd repeated note.
const LICK_STEPS = [-2, -1, -1, -1, 0, 1, 1, 1, 2];

export function leadLick(key: NoteName, seed: number): Lick {
  const r = leadLickRootFret(key);
  if (seed === 0) {
    const template = getTemplate("solo").leadLickFormula!.pattern.e;
    return {
      notes: template.map((t) => ({ string: "e" as TabString, fret: t === "r" ? r : r + 2 })),
      gaps: [2, 2, 2, 2],
      doubleStop: true,
    };
  }
  const rng = mulberry32(seed * 104729 + 3);
  const box = pentatonicBox(key);
  const keyPc = pitchClassOf(key);
  const length = 6 + Math.floor(rng() * 2);
  let i = Math.floor(rng() * box.length);
  const path = [i];
  let prevStep = 1;
  for (let n = 1; n < length - 1; n++) {
    let step = LICK_STEPS[Math.floor(rng() * LICK_STEPS.length)];
    if (step === 0 && prevStep === 0) step = i < box.length / 2 ? 1 : -1; // no note three times running
    if (i + step < 0 || i + step >= box.length) step = -step; // bounce off the edges of the box
    i += step;
    prevStep = step;
    path.push(i);
  }
  // Resolve to the root nearest the last note.
  const roots = box.map((note, idx) => ({ idx, pc: (((note.midi - keyPc) % 12) + 12) % 12 })).filter((n) => n.pc === 0);
  const last = path[path.length - 1];
  path.push(roots.reduce((best, n) => (Math.abs(n.idx - last) < Math.abs(best.idx - last) ? n : best)).idx);

  return {
    notes: path.map((idx) => ({ string: box[idx].string, fret: box[idx].fret })),
    gaps: path.map((_, n) => (n === 0 ? 2 : 1 + Math.floor(rng() * 2))),
    doubleStop: false,
  };
}

// ---------------------------------------------------------------------------
// Sections: recipe (how it's played) + voicing path (where on the neck) → bars of eighth-note events.
// The tab, the spoken text and the audio are all rendered from these same events.

export type SectionInputs = {
  key: NoteName;
  feel: FeelId;
  progressionId: string;
  seed: number;
};

/** One eighth-note cell that sounds: a strum (hit) or a dead strum (x). */
export type SectionEvent = {
  kind: "hit" | "dead";
  notes: Fretted[];
  accent: boolean;
  up: boolean;
  palmMuted: boolean;
  /** How many eighth notes it sounds for (let-ring hits ring until the next event or a stop). */
  cells: number;
};

export type SectionBar = {
  chord: ResolvedChord | null;
  cells: (SectionEvent | null)[];
  articulation?: "pm" | "ring";
  /** Full-band stop after this cell (the rest of the bar is silent, drums too). */
  stopAt?: number;
};

type RhythmSpec = {
  bars: string[];
  articulation: ("pm" | "ring")[];
  accents?: number[];
  pushes?: number[];
  stopBar?: number;
};
type Variant = { name: string; shapes: string[]; rhythms: Partial<Record<FeelId, RhythmSpec>> };
type SectionRecipe = { register: "low" | "lift"; openStrings: boolean; repeat: number; prefer?: ShapeTag[]; variants: Variant[] };

export const recipes = recipesJson.sections as unknown as Record<Exclude<SectionId, "solo">, SectionRecipe>;
export const libraryRecipe = recipesJson.library as { register: "low" | "lift"; openStrings: boolean; shapes: string[] };

export type RenderedSection = {
  id: SectionId;
  label: string;
  /** The feel the section actually renders in (Breakdown forces half-time). */
  feel: FeelId;
  /** Bars shown in the tab (the Verse is shown once and played `repeat` times). */
  bars: SectionBar[];
  repeat: number;
  /** One chord per bar (empty for the Solo). */
  chords: ResolvedChord[];
  /** The voicing each distinct chord uses, in order of appearance (for chips, tests, screen readers). */
  voicings: { chord: ResolvedChord; voicing: Voicing }[];
  tab: TabLineGroup[];
  /** e.g. "Palm-muted chugs" or "Pentatonic, 2 bars". */
  caption: string;
  /** Bars where the hand jumps more than maxMove frets (an explicit position shift). */
  shifts: number[];
  /** Fret range used, e.g. [3, 7]; 0 means open strings. */
  frets: [number, number];
  /** What the tab says, in words, for screen readers (the ASCII tab itself is hidden from them). */
  spoken: string;
};

/** Chord sections' bar-by-bar chords: the template's degrees, or the progression stretched to 4 bars. */
function sectionChords(id: SectionId, inputs: SectionInputs, t: SectionTemplate): ResolvedChord[] {
  if (t.degreeSequence === "USE_SELECTED_PROGRESSION") {
    const prog = resolveProgression(inputs.key, inputs.progressionId);
    return Array.from({ length: 4 }, (_, i) => prog[Math.min(i, prog.length - 1)]);
  }
  return resolveDegrees(inputs.key, t.degreeSequence!);
}

/** Target hand position for a section in a key. */
export function sectionTarget(id: Exclude<SectionId, "solo">, key: NoteName): number {
  return registerTarget(pitchClassOf(key), recipes[id].register);
}

// The chord section played before each one, for a soft pull on its first chord (so boundaries stay playable).
const PREVIOUS: Partial<Record<SectionId, Exclude<SectionId, "solo">>> = { verse: "intro", chorus: "verse", breakdown: "chorus" };

/** Library voicings: what chord chips show and progression play buttons play (2-note, low/mid, compact). */
export function libraryVoicings(key: NoteName, progressionId: string): { chord: ResolvedChord; voicing: Voicing }[] {
  const chords = resolveProgression(key, progressionId);
  const [path] = voicePaths(
    chords.map((c) => pitchClassOf(c.root)),
    { target: registerTarget(pitchClassOf(key), libraryRecipe.register), shapes: libraryRecipe.shapes, openStrings: libraryRecipe.openStrings, fastMuted: true },
  );
  return chords.map((chord, i) => ({ chord, voicing: path.voicings[i] }));
}

function eventsFor(pattern: string, voicing: Voicing, articulation: "pm" | "ring", accents: number[]): (SectionEvent | null)[] {
  return [...pattern].map((ch, i) => {
    if (ch === "D" || ch === "U")
      return { kind: "hit", notes: voicing.notes.map(({ string, fret }) => ({ string, fret })), accent: accents.includes(i), up: ch === "U", palmMuted: articulation === "pm", cells: 1 };
    if (ch === "x") return { kind: "dead", notes: voicing.notes.map(({ string, fret }) => ({ string, fret })), accent: false, up: false, palmMuted: true, cells: 1 };
    return null; // "-" (ring on) and "." (rest) are both silent cells; ringing is set below
  });
}

/** Let-ring hits sound until the next event, the end of a stop, or the end of the section. */
function setRingLengths(bars: SectionBar[]) {
  const flat: { bar: SectionBar; i: number }[] = bars.flatMap((bar) => bar.cells.map((_, i) => ({ bar, i })));
  flat.forEach(({ bar, i }, k) => {
    const ev = bar.cells[i];
    if (!ev || ev.kind !== "hit" || ev.palmMuted) return;
    let len = 1;
    while (k + len < flat.length && !flat[k + len].bar.cells[flat[k + len].i]) {
      const next = flat[k + len];
      if (next.bar.stopAt !== undefined && next.i > next.bar.stopAt) break;
      if (next.bar.articulation !== "ring") break;
      len++;
    }
    ev.cells = len;
  });
}

function fretRange(notes: Fretted[]): [number, number] {
  const frets = notes.map((n) => n.fret);
  return frets.length ? [Math.min(...frets), Math.max(...frets)] : [0, 0];
}

export function renderSection(id: SectionId, inputs: SectionInputs): RenderedSection {
  const t = getTemplate(id);
  const feel = t.forceFeel ?? inputs.feel;
  if (t.type === "lead-lick") return renderLick(inputs, t, feel);

  const recipe = recipes[id as Exclude<SectionId, "solo">];
  const variant = recipe.variants[inputs.seed % recipe.variants.length];
  const rhythm = variant.rhythms[feel] ?? variant.rhythms[Object.keys(variant.rhythms)[0] as FeelId]!;
  const chords = sectionChords(id, inputs, t);
  const keyPc = pitchClassOf(inputs.key);
  const prev = PREVIOUS[id];
  const muted = rhythm.articulation.filter((a) => a === "pm").length > rhythm.articulation.length / 2;
  const paths = voicePaths(
    chords.map((c) => pitchClassOf(c.root)),
    {
      target: registerTarget(keyPc, recipe.register),
      shapes: variant.shapes,
      openStrings: recipe.openStrings,
      fastMuted: muted && feel === "fast-punk",
      prefer: recipe.prefer,
      carryFrom: prev ? registerTarget(keyPc, recipes[prev].register) : undefined,
    },
  );
  const path = paths[Math.floor(inputs.seed / recipe.variants.length) % paths.length];

  const bars: SectionBar[] = chords.map((chord, b) => {
    const articulation = rhythm.articulation[b % rhythm.articulation.length];
    const pattern = rhythm.bars[b % rhythm.bars.length];
    const cells = eventsFor(pattern, path.voicings[b], articulation, rhythm.accents ?? []);
    // Push: the next bar's chord arrives on this bar's last eighth.
    if (rhythm.pushes?.includes(b) && b + 1 < chords.length && chords[b + 1].root !== chord.root) {
      const next = path.voicings[b + 1];
      cells[CELLS_PER_BAR - 1] = { kind: "hit", notes: next.notes.map(({ string, fret }) => ({ string, fret })), accent: true, up: false, palmMuted: articulation === "pm", cells: 1 };
    }
    const stopAt = rhythm.stopBar === b ? pattern.search(/[DUx]/) : undefined;
    return { chord, cells, articulation, stopAt };
  });
  setRingLengths(bars);

  const voicings: { chord: ResolvedChord; voicing: Voicing }[] = [];
  chords.forEach((chord, i) => {
    if (!voicings.some((v) => v.chord.root === chord.root)) voicings.push({ chord, voicing: path.voicings[i] });
  });
  const repeat = recipe.repeat;
  const allNotes = voicings.flatMap((v) => v.voicing.notes);
  const art = muted ? "palm-muted" : "let ring";
  const dead = bars.some((b) => b.cells.some((c) => c?.kind === "dead"));
  const spoken =
    `${t.label}, key of ${inputs.key}: ${variant.name.toLowerCase()}, ${art}${dead ? ", with dead strums" : ""}` +
    `${rhythm.stopBar !== undefined ? ", ending on a stop" : ""}. ` +
    `${bars.length} bars${repeat > 1 ? `, played ${repeat} times` : ""}: ${chords.map((c) => c.name).join(", ")}. ` +
    voicings.map((v) => `${v.chord.name}: ${describeNotes(v.voicing.notes)}`).join(". ") +
    ".";

  return {
    id,
    label: t.label,
    feel,
    bars,
    repeat,
    chords,
    voicings,
    tab: renderTab(tabBars(bars)),
    caption: `${bars.length * repeat} bars · ${variant.name}`,
    shifts: path.shifts,
    frets: fretRange(allNotes),
    spoken,
  };
}

/** Section bars → tab bars: fret numbers on hits, x on dead strums, chord names over each bar. */
export function tabBars(bars: SectionBar[]): TabBar[] {
  return bars.map((bar) => ({
    label: bar.chord?.name,
    articulation: bar.articulation,
    stopAt: bar.stopAt,
    cells: bar.cells.map((ev) => ({
      frets: ev ? Object.fromEntries(ev.notes.map((n) => [n.string, ev.kind === "dead" ? "x" : String(n.fret)])) : {},
      accent: ev?.accent,
    })),
  }));
}

/** The Solo's lead lick (replaced by the lead engine in a later phase), laid out in eighth-note bars. */
function renderLick(inputs: SectionInputs, t: SectionTemplate, feel: FeelId): RenderedSection {
  const { notes, gaps, doubleStop } = leadLick(inputs.key, inputs.seed);
  const cells: (SectionEvent | null)[] = [];
  notes.forEach((n, i) => {
    const length = i + 1 < gaps.length ? gaps[i + 1] : 2;
    const placed: Fretted[] = doubleStop ? [{ string: "e", fret: n.fret }, { string: "B", fret: n.fret }] : [n];
    cells.push({ kind: "hit", notes: placed, accent: false, up: false, palmMuted: false, cells: length });
    for (let k = 1; k < length; k++) cells.push(null);
  });
  while (cells.length % CELLS_PER_BAR) cells.push(null);
  const bars: SectionBar[] = [];
  for (let b = 0; b < cells.length; b += CELLS_PER_BAR) bars.push({ chord: null, cells: cells.slice(b, b + CELLS_PER_BAR) });
  const all = notes.flatMap((n) => (doubleStop ? [{ string: "e" as TabString, fret: n.fret }, { string: "B" as TabString, fret: n.fret }] : [n]));
  const spoken = `${t.label}, lead lick in ${inputs.key}: ${notes.map((n) => (doubleStop ? `${describeFretted({ string: "e", fret: n.fret })} with ${describeFretted({ string: "B", fret: n.fret })}` : describeFretted(n))).join("; ")}.`;
  return { id: "solo", label: t.label, feel, bars, repeat: 1, chords: [], voicings: [], tab: renderTab(tabBars(bars)), caption: t.caption, shifts: [], frets: fretRange(all), spoken };
}

function signature(s: RenderedSection): string {
  return tabText(s.tab);
}

/** Next seed that visibly changes the section, so "regenerate" is never a no-op. */
export function nextSeed(id: SectionId, inputs: SectionInputs): number {
  const current = signature(renderSection(id, inputs));
  let seed = inputs.seed + 1;
  for (let tries = 0; tries < 50; tries++, seed++) {
    if (signature(renderSection(id, { ...inputs, seed })) !== current) return seed;
  }
  return seed;
}

/** Chorus regeneration swaps to a different one of the 6 progressions. */
export function nextProgressionId(current: string, rng: () => number = Math.random): string {
  const others = progressions.filter((p) => p.id !== current);
  return others[Math.floor(rng() * others.length)].id;
}
