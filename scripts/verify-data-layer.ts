// Quick self-check for the lib/ data layer: `npm run verify`.
import assert from "node:assert/strict";
import { chordMidiNotes, leadLickRootFret, resolveProgression, sortProgressions, progressions } from "@/lib/musicTheory";
import { renderSection, nextSeed, leadLick } from "@/lib/generator";
import { nextTitle, formatTitle, INITIAL_TITLE } from "@/lib/titleGenerator";

// Solo lead lick must be computed: Key of A → 5,7,5,7 on e and B.
assert.deepEqual(leadLick("A", 0).frets, [5, 7, 5, 7]);
const soloA = renderSection("solo", { key: "A", feel: "fast-punk", progressionId: "I-V-vi-IV", seed: 0 });
console.log("Solo, key of A:\n" + soloA.tabLines.join("\n"));
assert.equal(soloA.tabLines[0], "e|--5--7--5--7--|");
assert.equal(soloA.tabLines[1], "B|--5--7--5--7--|");
assert.equal(leadLickRootFret("C"), 8);
assert.deepEqual(leadLick("C", 0).frets, [8, 10, 8, 10]);
assert.deepEqual(leadLick("E", 0).frets, [0, 2, 0, 2]);

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

for (const key of ["C", "F#", "D#"] as const) {
  const chorus = renderSection("chorus", { key, feel: "fast-punk", progressionId: "I-V-vi-IV", seed: 0 });
  console.log(`\nChorus, key of ${key} (${names(key)}):\n` + chorus.tabLines.join("\n"));
}

// Regenerate always changes something; feel changes strum notation.
for (const id of ["intro", "verse", "solo", "breakdown"] as const) {
  const inputs = { key: "G" as const, feel: "mid-tempo" as const, progressionId: "I-IV-V", seed: 0 };
  const a = renderSection(id, inputs); const b = renderSection(id, { ...inputs, seed: nextSeed(id, inputs) });
  assert.notEqual(a.tabLines.join() + a.strum?.join(), b.tabLines.join() + b.strum?.join(), id);
}
const fp = renderSection("verse", { key: "A", feel: "fast-punk", progressionId: "I-V-vi-IV", seed: 0 });
const ht = renderSection("verse", { key: "A", feel: "half-time", progressionId: "I-V-vi-IV", seed: 0 });
assert.notDeepEqual(fp.strum, ht.strum);
// Breakdown is forced half-time.
assert.equal(renderSection("breakdown", { key: "A", feel: "fast-punk", progressionId: "I-V-vi-IV", seed: 0 }).feel, "half-time");

// Sort re-orders without changing content.
assert.deepEqual(sortProgressions(progressions, "brightest").map((p) => p.brightness), [5, 5, 4, 3, 3, 2]);
assert.deepEqual(sortProgressions(progressions, "darkest").map((p) => p.brightness), [2, 3, 3, 4, 5, 5]);

// Titles never repeat back-to-back.
let t = INITIAL_TITLE;
for (let i = 0; i < 500; i++) { const n = nextTitle(t); assert.ok(formatTitle(n) !== formatTitle(t)); t = n; }
assert.equal(formatTitle(INITIAL_TITLE), "\"Your Ex's New Apartment (Breakdown Mix)\"");

console.log("\nAll data-layer checks passed.");
