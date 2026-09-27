// Quick self-check for the lib/ data layer: `npm run verify`.
import assert from "node:assert/strict";
import { chordMidiNotes, resolveProgression, sortProgressions, progressions } from "@/lib/musicTheory";
import { tabText } from "@/lib/fretboard";
import { renderSection, nextSeed } from "@/lib/generator";
import { TITLES, MAX_TITLE_LENGTH, createTitleBag } from "@/lib/titleGenerator";

// The Solo is written by the lead engine now (scripts/verify-melody.ts checks it); the old
// "5,7,5,7" template lick was retired with it (docs/melody-and-solo-brief.md §9).
{
  const solo = renderSection("solo", { key: "A", feel: "fast-punk", progressionId: "I-V-vi-IV", seed: 0 });
  assert.ok(solo.lead && solo.lead.inputs.part === "solo" && solo.lead.inputs.bars === 8, "Solo uses the lead engine, 8 bars");
  console.log("Solo, key of A:\n" + tabText(solo.tab));
}

// Progressions resolve per key.
const names = (k: Parameters<typeof resolveProgression>[0]) => resolveProgression(k, "I-V-vi-IV").map((c) => c.name).join(" ");
assert.equal(names("A"), "A5 E5 F#5 D5");
assert.equal(names("C"), "C5 G5 A5 F5");
assert.equal(names("F#"), "F#5 C#5 D#5 B5");
assert.equal(names("D#"), "D#5 A#5 C5 G#5");
// Mockup mislabeled F#5 as A2/D4 — library says F#5 is E2/A4.
const fSharp = resolveProgression("A", "I-V-vi-IV")[2].chord;
assert.equal(fSharp.rootString, "E"); assert.equal(fSharp.rootFret, 2);
assert.deepEqual(chordMidiNotes(resolveProgression("A", "I-IV-V")[0].chord), [45, 52]); // A2 + E3

// Regenerate always changes something; feel changes the rhythm.
for (const id of ["intro", "verse", "chorus", "solo", "breakdown"] as const) {
  const inputs = { key: "G" as const, feel: "mid-tempo" as const, progressionId: "I-IV-V", seed: 0 };
  const a = renderSection(id, inputs);
  const b = renderSection(id, { ...inputs, seed: nextSeed(id, inputs) });
  assert.notEqual(tabText(a.tab), tabText(b.tab), id);
}
const fp = renderSection("verse", { key: "A", feel: "fast-punk", progressionId: "I-V-vi-IV", seed: 0 });
const ht = renderSection("verse", { key: "A", feel: "half-time", progressionId: "I-V-vi-IV", seed: 0 });
assert.notEqual(tabText(fp.tab), tabText(ht.tab));
// Breakdown is forced half-time.
assert.equal(renderSection("breakdown", { key: "A", feel: "fast-punk", progressionId: "I-V-vi-IV", seed: 0 }).feel, "half-time");

// Sort re-orders without changing content.
assert.deepEqual(sortProgressions(progressions, "brightest").map((p) => p.brightness), [5, 5, 4, 3, 3, 2]);
assert.deepEqual(sortProgressions(progressions, "darkest").map((p) => p.brightness), [2, 3, 3, 4, 5, 5]);

// Song titles: 90 unique, short enough for one line, no "(… Mix)" suffix, no em/en dashes.
assert.equal(TITLES.length, 90);
assert.equal(new Set(TITLES.map((t) => t.toLowerCase())).size, 90, "duplicate titles");
for (const t of TITLES) {
  assert.ok(t.length <= MAX_TITLE_LENGTH, `"${t}" is over ${MAX_TITLE_LENGTH} characters`);
  assert.ok(!/\(.*mix\)/i.test(t) && !/[\u2014\u2013]/.test(t), `"${t}" has a Mix suffix or a dash`);
}
// Shuffle bag: starts on titles[0]; every round of 90 shows each title once; no back-to-back repeats, even across rounds.
{
  const bag = createTitleBag();
  const shown = [bag.current()];
  for (let i = 0; i < 90 * 6 - 1; i++) shown.push(bag.next());
  assert.equal(shown[0], TITLES[0]);
  for (let r = 0; r < 6; r++) assert.equal(new Set(shown.slice(r * 90, r * 90 + 90)).size, 90, `round ${r + 1} repeats a title`);
  for (let i = 1; i < shown.length; i++) assert.notEqual(shown[i], shown[i - 1], `back-to-back repeat at ${i}`);
}

console.log("\nAll data-layer checks passed.");
