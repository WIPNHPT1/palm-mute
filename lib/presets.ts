// Style presets (docs/song-builder-prd.md B11, data/style-presets.json): a starting point for a song. Pure.
import presetsJson from "@/data/style-presets.json";
import { type FeelId, type SectionInputs, type SectionOptions, SECTION_IDS, type SectionId, grooveChoices } from "@/lib/generator";

export type PresetId = "skate" | "poppunk" | "emo";
export type Preset = {
  label: string;
  description: string;
  feel: FeelId;
  progressionId?: string;
  lengthSec: number;
  grooves: Partial<Record<SectionId, string[]>>;
  options: Partial<Record<SectionId, SectionOptions>>;
};

export const PRESETS = presetsJson.presets as Record<PresetId, Preset>;
export const PRESET_IDS = Object.keys(PRESETS) as PresetId[];

/**
 * A section's Options under a preset: the first of its preferred grooves that can play with these inputs (key,
 * feel, progression, difficulty), plus the preset's other options. Sections it doesn't mention get none.
 */
export function presetOptions(preset: Preset, id: SectionId, inputs: SectionInputs): SectionOptions {
  const choices = grooveChoices(id, inputs);
  const groove = (preset.grooves[id] ?? []).find((name) => choices.some((c) => c.name === name && c.available));
  return { ...(preset.options[id] ?? {}), ...(groove ? { groove } : {}) };
}

/** Every section's Options under a preset. */
export function presetSectionOptions(preset: Preset, inputs: (id: SectionId) => SectionInputs): Record<SectionId, SectionOptions> {
  return Object.fromEntries(SECTION_IDS.map((id) => [id, presetOptions(preset, id, inputs(id))])) as Record<SectionId, SectionOptions>;
}
