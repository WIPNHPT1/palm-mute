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
  describeNotes,
  renderTab,
  tabText,
} from "@/lib/fretboard";
import {
  type Degree,
  type NoteName,
  type ResolvedChord,
  pitchClassOf,
  progressions,
  resolveDegrees,
  resolveProgression,
} from "@/lib/musicTheory";
import { type Lead, type LeadPart, type LeadStyle, defaultLeadStyle, generateLead, styleLabel } from "@/lib/melody";
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
  type?: "lead";
  caption: string;
  lockedByDefault: boolean;
  forceFeel?: FeelId;
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

// ---------------------------------------------------------------------------
// Sections: recipe (how it's played) + voicing path (where on the neck) → bars of eighth-note events.
// The tab, the spoken text and the audio are all rendered from these same events.

export type SectionInputs = {
  key: NoteName;
  feel: FeelId;
  progressionId: string;
  seed: number;
  /** A lead part in this section: the Solo always has one; the Intro when the Chords page sends a melody. */
  lead?: { style: LeadStyle; bars: number } | null;
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
  /** Lead sections (Solo, or an Intro melody): the line itself, for playback and copying. */
  lead?: Lead;
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
  if (id === "solo" || (id === "intro" && inputs.lead)) return renderLeadSection(id, inputs, feel);

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
  // The Chorus never sits below the Verse (brief §11.4): in high keys, where the lift has little room
  // under fret 12, keep only takes at or above this seed's Verse register (else the highest take).
  let pool = paths;
  if (id === "chorus") {
    const avg = (vs: Voicing[]) => {
      const distinct = [...new Map(vs.map((v) => [v.rootPc, v])).values()];
      return distinct.reduce((a, v) => a + v.position, 0) / distinct.length;
    };
    const verse = renderSection("verse", { ...inputs, lead: null });
    const floor = avg(verse.voicings.map((v) => v.voicing));
    const high = paths.filter((p) => avg(p.voicings) >= floor - 1e-9);
    pool = high.length ? high : [paths.reduce((a, b) => (avg(b.voicings) > avg(a.voicings) ? b : a))];
  }
  const path = pool[Math.floor(inputs.seed / recipe.variants.length) % pool.length];

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

/** The Solo, or an Intro melody sent from the Chords page: a lead line over the section's progression. */
function renderLeadSection(id: SectionId, inputs: SectionInputs, feel: FeelId): RenderedSection {
  const part: LeadPart = id === "solo" ? "solo" : "intro";
  const { style, bars: length } = inputs.lead ?? defaultLeadStyle(part);
  const lead = generateLead({ key: inputs.key, progressionId: inputs.progressionId, part, style, bars: length, seed: inputs.seed });
  const bars: SectionBar[] = lead.chords.map((chord, b) => ({
    chord,
    cells: Array.from({ length: CELLS_PER_BAR }, (_, c) => {
      const n = lead.notes.find((x) => x.bar === b && x.cell === c);
      return n
        ? { kind: "hit" as const, notes: [{ string: n.string, fret: n.fret }, ...(n.double ? [{ string: n.double.string, fret: n.double.fret }] : [])], accent: false, up: false, palmMuted: false, cells: n.cells }
        : null;
    }),
  }));
  const frets = lead.notes.flatMap((n) => [n.technique?.kind === "bend" ? n.technique.fromFret : n.fret, ...(n.double ? [n.double.fret] : [])]);
  return {
    id,
    label: getTemplate(id).label,
    feel,
    bars,
    repeat: 1,
    chords: lead.chords,
    voicings: [],
    tab: lead.tab,
    caption: `${length} bars · ${styleLabel(part, style)} ${part === "intro" ? "melody" : "solo"}`,
    shifts: [],
    frets: [Math.min(...frets), Math.max(...frets)],
    spoken: lead.spoken,
    lead,
  };
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
