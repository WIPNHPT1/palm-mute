// A whole song from its sections' inputs: the length plan (lib/songLength.ts) and the running order's parts,
// each with the material it plays. Pure, no React: the Generator page, the MIDI export and verify all build
// the song through here, so they can't disagree.
import { type RenderedSection, type SectionInputs, SECTION_IDS, type SectionId, renderSection } from "@/lib/generator";
import { noteNameFor, pitchClassOf } from "@/lib/musicTheory";
import type { SongPart } from "@/lib/playback";
import { type SongPlan, planSong } from "@/lib/songLength";
import type { FormSlot } from "@/lib/songPlan";

export type Song = { plan: SongPlan; parts: (SongPart & { slot: FormSlot })[] };

/** The length plan for these sections: a section card's Structure option fixes how many times its places play. */
export function songPlan(inputs: Record<SectionId, SectionInputs>, rendered: Record<SectionId, RenderedSection>, lengthSec: number, bpm: number): SongPlan {
  const fixed: Partial<Record<SectionId, number>> = {};
  for (const id of SECTION_IDS) {
    const times = inputs[id].options?.times;
    if (times) fixed[id] = times;
  }
  return planSong(lengthSec, bpm, (id) => rendered[id].bars.length * rendered[id].repeat, fixed);
}

/**
 * The running order's parts. A repeat plays its section's material; Verse 2 re-renders it with its push (unless
 * the Verse's Options switch it off), and the Last chorus can go up a whole tone (the Chorus's Options).
 */
export function songParts(inputs: Record<SectionId, SectionInputs>, rendered: Record<SectionId, RenderedSection>, plan: SongPlan): Song["parts"] {
  return plan.slots.map((planned) => {
    const own = inputs[planned.section];
    const push = planned.variation === "push" && !own.options?.noPush;
    const keyUp = planned.section === "chorus" && planned.name === "Last chorus" && !!own.options?.keyUp;
    const slot: FormSlot = { ...planned, variation: push ? "push" : keyUp ? "keyUp" : undefined };
    if (!slot.variation) delete slot.variation;
    const section = push
      ? renderSection(slot.section, own, "push")
      : keyUp
        ? renderSection(slot.section, { ...own, key: noteNameFor((pitchClassOf(own.key) + 2) % 12) })
        : rendered[slot.section];
    return { slot, section, times: slot.times };
  });
}

/** Render every section and build the song (verify and the tests use this; the page memoises the steps). */
export function buildSong(inputs: Record<SectionId, SectionInputs>, lengthSec: number, bpm: number): Song & { rendered: Record<SectionId, RenderedSection> } {
  const rendered = Object.fromEntries(SECTION_IDS.map((id) => [id, renderSection(id, inputs[id])])) as Record<SectionId, RenderedSection>;
  const plan = songPlan(inputs, rendered, lengthSec, bpm);
  return { plan, parts: songParts(inputs, rendered, plan), rendered };
}
