// Song Engine v2, Phase 1 (docs/song-engine-v2-prd.md R6–R9): the song's harmonic plan (which chords each
// section plays, from the chosen progression), its form (the running order) and each section's energy.
// Pure functions over data/section-harmony.json, data/song-forms.json and data/energy.json. No React.
import energyJson from "@/data/energy.json";
import harmonyJson from "@/data/section-harmony.json";
import formsJson from "@/data/song-forms.json";
import type { Degree } from "@/lib/musicTheory";
import { getProgression } from "@/lib/musicTheory";

/** Every section, in the order the Generator's cards show them (the order each first plays in the Standard form). */
export type SectionId = "intro" | "verse" | "prechorus" | "chorus" | "solo" | "breakdown" | "ending";
export const SECTION_IDS: SectionId[] = ["intro", "verse", "prechorus", "chorus", "solo", "breakdown", "ending"];
export type ChordSectionId = Exclude<SectionId, "solo">;

// ---------------------------------------------------------------------------
// Harmonic plan (R6)

type HarmonyRule =
  | { rule: "progression"; bars: number }
  | { rule: "pattern"; bars: number; pick: number[] }
  | { rule: "byChorusStart"; bars: number; map: Partial<Record<Degree, Degree[]>> }
  | { rule: "darkest"; bars: number; pairs: Degree[][]; pick: number[]; fallback: Degree[] }
  | { rule: "fixed"; degrees: Degree[] };

const HARMONY = harmonyJson.sections as unknown as Record<ChordSectionId, HarmonyRule & { label: string; why: string }>;

/** A chord section's degrees, bar by bar: a pure function of (section, progression). */
export function sectionDegrees(id: ChordSectionId, progressionId: string): Degree[] {
  const prog = getProgression(progressionId).degrees as Degree[];
  const r = HARMONY[id];
  switch (r.rule) {
    case "progression":
      return Array.from({ length: r.bars }, (_, i) => prog[Math.min(i, prog.length - 1)]);
    case "pattern":
      return Array.from({ length: r.bars }, (_, i) => prog[r.pick[i % r.pick.length] % prog.length]);
    case "byChorusStart": {
      const degrees = r.map[prog[0]];
      if (!degrees) throw new Error(`section-harmony: no ${id} climb into ${prog[0]}`);
      return degrees;
    }
    case "darkest": {
      const pair = r.pairs.find((p) => p.every((d) => prog.includes(d)));
      return pair ? Array.from({ length: r.bars }, (_, i) => pair[r.pick[i % r.pick.length]]) : r.fallback;
    }
    case "fixed":
      return r.degrees;
  }
}

/** The card's plan line: what the section plays in this song, e.g. "Climb: IV-V" or "Home: I". */
export function planNote(id: SectionId, progressionId: string): string {
  if (id === "solo") return `Lead over ${progressionId}`;
  const distinct = [...new Set(sectionDegrees(id, progressionId))];
  return `${HARMONY[id].label}: ${distinct.join("-")}`;
}

/** Whether the section's chords follow the progression (so a locked copy can fall behind it). */
export function usesProgression(id: SectionId): boolean {
  return id === "solo" || HARMONY[id].rule !== "fixed";
}

// ---------------------------------------------------------------------------
// Forms (R7)

export type FormId = "short" | "standard" | "extended";
export type VariationId = "push" | "keyUp";
/** A place in the running order. `times`: how many times in a row it plays its section's material. */
export type FormSlot = { section: SectionId; name: string; variation?: VariationId; times: number };
/** A slot as the data declares it: how far it can grow (lib/songLength.ts), and which growth step grows it. */
export type FormSlotSpec = { section: SectionId; name: string; variation?: VariationId; min: number; max: number; grow?: string };

const FORMS = formsJson.forms as Record<FormId, { label: string; slots: FormSlotSpec[] }>;
export const DEFAULT_FORM = formsJson.default as FormId;
export const FORM_IDS = Object.keys(FORMS) as FormId[];
export const VARIATIONS = formsJson.variations as Record<VariationId, { label: string }>;

/** A form's slots as declared (with their growth ranges). */
export function formSpec(form: FormId = DEFAULT_FORM): FormSlotSpec[] {
  return FORMS[form].slots;
}

/** A form at its shortest: every slot at its minimum. */
export function formSlots(form: FormId = DEFAULT_FORM): FormSlot[] {
  return FORMS[form].slots.map(({ section, name, variation, min }) => ({ section, name, ...(variation ? { variation } : {}), times: min }));
}

export function formLabel(form: FormId): string {
  return FORMS[form].label;
}

// ---------------------------------------------------------------------------
// Energy (R8)

type EnergyBar = {
  articulation?: "pm" | "ring";
  cells: ({ kind: "hit" | "dead"; cells: number } | null)[];
};
const W = energyJson.weights;

/**
 * A chord section's energy from what it actually plays: how many eighths sound, how much rings,
 * 3-note shapes, and how high on the neck. See data/energy.json.
 */
export function sectionEnergy(bars: EnergyBar[], voicings: { notes: unknown[]; position: number }[]): number {
  if (!bars.length || !voicings.length) return 0;
  // Per bar, as a share of its own grid (8 or 16 cells), then averaged.
  const sounding =
    bars.reduce((a, bar) => a + bar.cells.reduce((n, ev) => n + (!ev ? 0 : ev.kind === "dead" ? 0.5 : Math.min(ev.cells, bar.cells.length)), 0) / bar.cells.length, 0) /
    bars.length;
  const ring = bars.filter((b) => b.articulation === "ring").length / bars.length;
  const notes = voicings.filter((v) => v.notes.length >= 3).length / voicings.length;
  const register = voicings.reduce((a, v) => a + v.position, 0) / voicings.length / 12;
  return W.density * Math.min(1, sounding) + W.ring * ring + W.notes * notes + W.register * register;
}
