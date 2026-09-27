// Quick self-check for the lib/ data layer: `npm run verify`.
import assert from "node:assert/strict";
import { chordMidiNotes, leadLickRootFret, resolveProgression, sortProgressions, progressions } from "@/lib/musicTheory";
import { renderSection, nextSeed, leadLick, pentatonicBox } from "@/lib/generator";
import { PITCH_CLASSES, pitchClassOf, OPEN_STRING_MIDI } from "@/lib/musicTheory";
import { TITLES, MAX_TITLE_LENGTH, createTitleBag } from "@/lib/titleGenerator";

// Solo lead lick must be computed: Key of A → 5,7,5,7 on e and B.
assert.deepEqual(leadLick("A", 0).notes.map((n) => n.fret), [5, 7, 5, 7]);
const soloA = renderSection("solo", { key: "A", feel: "fast-punk", progressionId: "I-V-vi-IV", seed: 0 });
console.log("Solo, key of A:\n" + soloA.tabLines.join("\n"));
assert.equal(soloA.tabLines[0], "e|--5--7--5--7--|");
assert.equal(soloA.tabLines[1], "B|--5--7--5--7--|");
assert.equal(leadLickRootFret("C"), 8);
assert.deepEqual(leadLick("C", 0).notes.map((n) => n.fret), [8, 10, 8, 10]);
assert.deepEqual(leadLick("E", 0).notes.map((n) => n.fret), [0, 2, 0, 2]);

// Solo note-level variations: in key, in the anchor box, resolve on the root, and actually vary.
for (const key of PITCH_CLASSES) {
  const r = leadLickRootFret(key);
  const phrases = new Set<string>();
  for (let seed = 1; seed <= 200; seed++) {
    const lick = leadLick(key, seed);
    assert.ok(lick.notes.length >= 6 && lick.notes.length <= 7, `${key}/${seed} length`);
    for (const n of lick.notes) {
      const pc = (OPEN_STRING_MIDI[n.string] + n.fret - pitchClassOf(key) + 120) % 12;
      assert.ok([0, 2, 4, 7, 9].includes(pc), `${key}/${seed}: ${n.string}${n.fret} not in major pentatonic`);
      assert.ok(n.fret >= Math.max(0, r - 1) && n.fret <= r + 3, `${key}/${seed}: fret ${n.fret} outside box`);
    }
    const last = lick.notes[lick.notes.length - 1];
    assert.equal((OPEN_STRING_MIDI[last.string] + last.fret) % 12, pitchClassOf(key), `${key}/${seed} must end on root`);
    phrases.add(JSON.stringify(lick.notes));
  }
  assert.ok(phrases.size > 150, `${key}: only ${phrases.size} distinct phrases in 200 seeds`);
  assert.ok(pentatonicBox(key).length >= 5, `${key}: box too small`);
}
for (const seed of [1, 2, 3]) {
  console.log(`Solo variation, key of A, seed ${seed}:\n` + renderSection("solo", { key: "A", feel: "fast-punk", progressionId: "I-V-vi-IV", seed }).tabLines.join("\n"));
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
