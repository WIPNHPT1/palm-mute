// A groove for each part the home page shows, by name from the Generator's section recipes (data/section-recipes.json):
// the one each section's card offers for that job.
import { recipes } from "@/lib/generator";

const named = (section: keyof typeof recipes, name: string) => recipes[section].variants.find((v) => v.name === name)?.name ?? recipes[section].variants[0].name;

export const RHYTHM_NAMES = {
  intro: named("intro", "Chugs into open hits"),
  verse: named("verse", "Gallop"),
  prechorus: named("prechorus", "Quarter-note climb"),
  chorus: named("chorus", "Driving eighths"),
};
