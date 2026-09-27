// "Stuck on a song title?" mad-lib (data/title-generator.json). Pure text, no music logic.
import titleJson from "@/data/title-generator.json";

export type TitlePick = { subject: number; modifier: number };

export const INITIAL_TITLE: TitlePick = { subject: 0, modifier: 0 };

export function formatTitle({ subject, modifier }: TitlePick): string {
  return titleJson.template
    .replace("{subject}", titleJson.subjects[subject])
    .replace("{modifier}", titleJson.modifiers[modifier]);
}

/** Random subject + modifier, never identical to the previous title. */
export function nextTitle(prev: TitlePick, rng: () => number = Math.random): TitlePick {
  const total = titleJson.subjects.length * titleJson.modifiers.length;
  const prevIndex = prev.subject * titleJson.modifiers.length + prev.modifier;
  // Pick uniformly from every combination except the previous one.
  let index = Math.floor(rng() * (total - 1));
  if (index >= prevIndex) index += 1;
  return { subject: Math.floor(index / titleJson.modifiers.length), modifier: index % titleJson.modifiers.length };
}
