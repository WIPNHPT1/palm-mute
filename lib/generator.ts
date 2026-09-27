// Section/tab/rhythm generation (data-model.md §1, §4; interaction-spec.md §3). Pure functions, no React.
import feelsJson from "@/data/feels.json";
import rhythmJson from "@/data/rhythm-patterns.json";
import templatesJson from "@/data/song-section-templates.json";
import {
  type Degree,
  type NoteName,
  type ResolvedChord,
  type TabString,
  TAB_STRINGS,
  leadLickRootFret,
  progressions,
  resolveDegrees,
  resolveProgression,
} from "@/lib/musicTheory";

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

// ---------------------------------------------------------------------------
// Tab rendering

type TabColumn = Partial<Record<TabString, string>>;

/** Renders columns of fret numbers as a 6-line ASCII tab; multi-digit frets stay aligned. */
export function formatTab(columns: TabColumn[], gaps?: number[]): string[] {
  const widths = columns.map((col) => Math.max(1, ...Object.values(col).map((f) => (f ?? "").length)));
  return TAB_STRINGS.map((s) => {
    const body = columns
      .map((col, i) => "-".repeat(gaps?.[i] ?? 2) + (col[s] ?? "").padEnd(widths[i], "-"))
      .join("");
    return `${s}|${body}--|`;
  });
}

function chordColumn(rc: ResolvedChord, rootOnly: boolean): TabColumn {
  const { rootString, rootFret, fifthString, fifthFret } = rc.chord;
  return rootOnly
    ? { [rootString]: String(rootFret) }
    : { [rootString]: String(rootFret), [fifthString]: String(fifthFret) };
}

// Solo variations: note order (still root / root+2 only) and spacing (timing). Index 0 = template.
const LICK_ORDERS: number[][] = [
  [0, 2, 0, 2],
  [2, 0, 2, 0],
  [0, 0, 2, 2],
  [0, 2, 2, 0],
  [2, 2, 0, 0],
  [0, 2, 0, 0],
];
const LICK_GAPS: number[][] = [
  [2, 2, 2, 2],
  [2, 1, 2, 2],
  [2, 2, 1, 1],
  [1, 3, 1, 3],
];

/** Solo lead lick per leadLickFormula: e and B both play r, r+2, r, r+2 (seed 0). */
export function leadLick(key: NoteName, seed: number): { frets: number[]; gaps: number[] } {
  const r = leadLickRootFret(key);
  if (seed === 0) {
    const template = getTemplate("solo").leadLickFormula!.pattern.e;
    return { frets: template.map((t) => (t === "r" ? r : r + 2)), gaps: LICK_GAPS[0] };
  }
  const rng = mulberry32(seed * 104729 + 3);
  const order = LICK_ORDERS[Math.floor(rng() * LICK_ORDERS.length)];
  const gaps = LICK_GAPS[Math.floor(rng() * LICK_GAPS.length)];
  return { frets: order.map((o) => r + o), gaps };
}

// ---------------------------------------------------------------------------
// Sections

export type SectionInputs = {
  key: NoteName;
  feel: FeelId;
  progressionId: string;
  seed: number;
};

export type RenderedSection = {
  id: SectionId;
  label: string;
  tabLines: string[];
  /** Strum notation for chord sections; null for the lead-lick Solo. */
  strum: Glyph[] | null;
  caption: string;
  /** The feel the section actually renders in (Breakdown forces half-time). */
  feel: FeelId;
  chords: ResolvedChord[];
};

export function renderSection(id: SectionId, inputs: SectionInputs): RenderedSection {
  const t = getTemplate(id);
  const feel = t.forceFeel ?? inputs.feel;

  if (t.type === "lead-lick") {
    const { frets, gaps } = leadLick(inputs.key, inputs.seed);
    const cols = frets.map((f) => ({ e: String(f), B: String(f) }));
    return { id, label: t.label, tabLines: formatTab(cols, gaps), strum: null, caption: t.caption, feel, chords: [] };
  }

  const chords =
    t.degreeSequence === "USE_SELECTED_PROGRESSION"
      ? resolveProgression(inputs.key, inputs.progressionId)
      : resolveDegrees(inputs.key, t.degreeSequence!);
  // Intro is "root note only (no full chord) per hit" per its template.
  const rootOnly = id === "intro";
  const base = patternForFeel(feel).glyphs;
  // Chorus variation comes from swapping the progression, not its phrasing (interaction-spec §3).
  const strum = id === "chorus" ? base : varyGlyphs(base, inputs.seed);

  return {
    id,
    label: t.label,
    tabLines: formatTab(chords.map((c) => chordColumn(c, rootOnly))),
    strum,
    caption: t.caption,
    feel,
    chords,
  };
}

function signature(s: RenderedSection): string {
  return s.tabLines.join("\n") + "|" + (s.strum ?? []).join("");
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
