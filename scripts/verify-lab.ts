// Chord Lab invariants (docs/chord-lab-prd.md §8), part of `npm run verify`: every dictionary voicing in every
// tuning, root and type plays exactly its chord, within reach, with a finger for every fretted note and a
// mute for every skipped string; every voicing names back to its own chord; the curated open shapes are what
// they say; the Lab plays at its one fixed tempo.
import assert from "node:assert/strict";
import openChordsJson from "@/data/open-chords.json";
import {
  CHORD_TYPE_IDS,
  MAX_FRET,
  STRING_COUNT,
  TUNING_IDS,
  chordName,
  chordPitchClasses,
  keysFor,
  nameShape,
  parseShape,
  playsChord,
  shapeNotes,
  shapeText,
  stretchOk,
  voicingsFor,
} from "@/lib/lab/chords";
import movesJson from "@/data/chord-moves.json";
import { type DegreeId, DEGREES, DEGREE_IDS, degreeRoot, nextMoves, typesFor } from "@/lib/lab/keys";
import { brightness, classicness, restlessness } from "@/lib/lab/mood";
import { LAB_BPM, arpeggioBars, loopBars, strumBars } from "@/lib/lab/sound";
import { progressions } from "@/lib/musicTheory";

let voicings = 0;
const perTuning: Record<string, number> = {};

for (const tuning of TUNING_IDS) {
  perTuning[tuning] = 0;
  for (let root = 0; root < 12; root++) {
    for (const type of CHORD_TYPE_IDS) {
      const name = chordName(root, type);
      const list = voicingsFor(root, type, tuning);
      assert.ok(list.length >= 1, `${tuning} ${name}: no voicing`);
      if (tuning === "e-standard") assert.ok(list.length >= 2, `E standard ${name}: only ${list.length} voicing`);
      const seen = new Set<string>();
      for (const v of list) {
        const id = `${tuning} ${name} ${shapeText(v.frets)}`;
        assert.ok(!seen.has(shapeText(v.frets)), `${id}: listed twice`);
        seen.add(shapeText(v.frets));
        assert.equal(v.frets.length, STRING_COUNT, id);
        // Exactly the chord: root in the bass, every required note, nothing else.
        assert.ok(playsChord(v.frets, tuning, root, type), `${id}: doesn't play ${name}`);
        const notes = shapeNotes(v.frets, tuning).filter((n): n is number => n !== null);
        const pcs = new Set(notes.map((n) => n % 12));
        assert.ok([...pcs].every((p) => chordPitchClasses(root, type).includes(p)), `${id}: plays a note outside ${name}`);
        assert.equal(Math.min(...notes) % 12, root, `${id}: root not in the bass`);
        // On the neck and within reach.
        assert.ok(v.frets.every((f) => f === null || (f >= 0 && f <= MAX_FRET)), `${id}: off the neck`);
        assert.ok(stretchOk(v.frets, type), `${id}: too wide a stretch`);
        // A finger for every fretted note, at most four, none for open or unplayed strings; the barre is finger 1.
        v.frets.forEach((f, s) => {
          if (f === null) assert.equal(v.fingers[s], null, `${id}: finger on an unplayed string`);
          else if (f === 0) assert.equal(v.fingers[s], 0, `${id}: finger on an open string`);
          else assert.ok(v.fingers[s]! >= 1 && v.fingers[s]! <= 4, `${id}: string ${s} has no finger`);
        });
        if (v.barre) for (let s = v.barre.from; s <= v.barre.to; s++) if (v.frets[s] === v.barre.fret) assert.equal(v.fingers[s], 1, `${id}: barre isn't the index finger`);
        // The same finger never holds two different frets (a barre holds one fret).
        const byFinger = new Map<number, Set<number>>();
        v.frets.forEach((f, s) => f && byFinger.set(v.fingers[s]!, (byFinger.get(v.fingers[s]!) ?? new Set()).add(f)));
        for (const [finger, frets] of byFinger) assert.equal(frets.size, 1, `${id}: finger ${finger} on two frets`);
        // Every skipped string inside the shape has a fretted neighbour to mute it.
        for (const s of v.muted) assert.ok((v.frets[s - 1] ?? 0) > 0 || (v.frets[s + 1] ?? 0) > 0, `${id}: string ${s} skipped with nothing to mute it`);
        assert.ok(v.difficulty >= 1 && v.difficulty <= 5, `${id}: difficulty ${v.difficulty}`);
        // Naming round-trips: the shape names back to its own chord.
        assert.equal(nameShape(v.frets, tuning)[0]?.name, name, `${id}: named ${nameShape(v.frets, tuning)[0]?.name}`);
        // And its text form reads back.
        assert.deepEqual(parseShape(shapeText(v.frets)), v.frets, `${id}: shape text doesn't read back`);
        voicings++;
        perTuning[tuning]++;
      }
      // Up the neck from the nut.
      for (let i = 1; i < list.length; i++) assert.ok(list[i].low >= list[i - 1].low, `${tuning} ${name}: out of order`);
    }
  }
}

// Curated open shapes are the chords they say, in E standard.
for (const o of openChordsJson.shapes) {
  const name = nameShape(o.frets, "e-standard")[0]?.name;
  assert.equal(name, o.chord, `open shape ${shapeText(o.frets)} is ${name}, not ${o.chord}`);
}

// Naming: a few hand-checked shapes, including inversions and near misses.
const named = (text: string, tuning: (typeof TUNING_IDS)[number] = "e-standard") => nameShape(parseShape(text)!, tuning).map((n) => n.name);
assert.equal(named("320003")[0], "G");
assert.equal(named("x32010")[0], "C");
assert.equal(named("x02210")[0], "Am");
assert.equal(named("x32033")[0], "Cadd9");
assert.equal(named("xx0212")[0], "D7");
assert.equal(named("022000")[0], "Em");
assert.equal(named("x30013")[0], "Csus2");
assert.equal(named("3x0013")[0], "Gsus4");
assert.equal(named("x-x-0-2-3-2")[0], "D");
assert.equal(named("x02200")[0], "Asus2");
assert.equal(named("355xxx")[0], "G5");
assert.equal(named("335xxx")[0], "C5/G", "a fourth under the root is a slash power chord");
assert.equal(named("3xx0xx")[0], "G octave");
assert.equal(named("032010").includes("C/E"), true, "inversions get a slash");
assert.equal(named("000xxx", "drop-d")[0], "D5", "one-finger power chord in Drop D");
assert.equal(named("x3xxxx").length, 0, "one note is not a chord");
assert.equal(parseShape("x3201"), null, "five strings is not a shape");
assert.equal(parseShape("x-3-2-0-1-16"), null, "past the 15th fret");

// Keys: a major chord is I, IV and V of three keys; a minor chord ii, iii and vi; a dominant 7th only V7.
for (let root = 0; root < 12; root++) {
  assert.deepEqual(keysFor(root, "maj").map((k) => k.numeral).sort(), ["I", "IV", "V"]);
  assert.deepEqual(keysFor(root, "min").map((k) => k.numeral).sort(), ["ii", "iii", "vi"]);
  assert.deepEqual(keysFor(root, "7").map((k) => k.numeral), ["V7"]);
  assert.equal(keysFor(root, "5").length, 6, "a power chord sits on six degrees");
}

// Sound: one fixed feel, Pop Strum at 150 BPM; a strum is one bar, a loop a bar per chord.
assert.equal(LAB_BPM, 150);
assert.equal(strumBars([43, 47, 50]).length, 1);
assert.deepEqual(arpeggioBars([50, 43, 47])[0].cells.slice(0, 3).map((c) => c!.notes[0]), [43, 47, 50]);
assert.equal(loopBars([[43], [50], [52]]).length, 3);

// Builder data: every degree has moves, every move goes to a real degree, and the three suggestions are the top three.
for (const d of DEGREE_IDS) {
  const moves = (movesJson.moves as Record<string, Record<string, number>>)[d];
  assert.ok(moves, `no moves from ${d}`);
  for (const [to, w] of Object.entries(moves)) assert.ok(DEGREE_IDS.includes(to as DegreeId) && w > 0, `${d} -> ${to}`);
  assert.equal(nextMoves(d).length, 3, `${d}: three suggestions`);
  assert.ok(typesFor(d)[0] === DEGREES.find((x) => x.id === d)!.quality, `${d}: natural quality first`);
  for (const k of Object.keys(movesJson.brightness.degree)) assert.ok(DEGREE_IDS.includes(k as DegreeId), `brightness for unknown degree ${k}`);
}
// The degrees in a key: I of G is G, V is D, bVII is F, iv is C (minor).
assert.deepEqual((["I", "V", "vi", "IV", "bVII", "iv"] as DegreeId[]).map((d) => degreeRoot(7, d)), [7, 2, 4, 0, 5, 0]);

// Vibe: scores stay in 0..1, the genre's ten loops are all classic, the brighter ones (data/progressions.json)
// score brighter on average than the darker ones, and a loop that ends on V is more restless than one ending on I.
const asLoop = (degrees: string[], type: "5" | "maj" = "maj") => degrees.map((degree) => ({ degree: degree as DegreeId, type: degree === "vi" || degree === "ii" || degree === "iii" ? ("min" as const) : type }));
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
for (const p of progressions) {
  for (const type of ["5", "maj"] as const) {
    const loop = asLoop(p.degrees, type);
    for (const v of [brightness(loop), restlessness(loop), classicness(loop)]) assert.ok(v >= 0 && v <= 1, `${p.id}: score ${v} out of range`);
    assert.equal(classicness(loop), 1, `${p.id} isn't classic`);
  }
}
const scoreOf = (min: number, max: number) => avg(progressions.filter((p) => p.brightness >= min && p.brightness <= max).map((p) => brightness(asLoop(p.degrees))));
assert.ok(scoreOf(5, 5) > scoreOf(4, 4) && scoreOf(4, 4) > scoreOf(2, 3), "brightness doesn't follow data/progressions.json");
assert.ok(restlessness(asLoop(["I", "IV", "V"])) > restlessness(asLoop(["V", "IV", "I"])), "ending on V should be more restless than on I");
assert.ok(classicness(asLoop(["I", "bVII", "bIII"])) < 1);

console.log(
  `verify-lab: ${voicings} voicings checked (${Object.entries(perTuning)
    .map(([t, n]) => `${t} ${n}`)
    .join(", ")}): exact chord tones, root in the bass, within reach, fingered, muted, named back.`,
);
