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
  easiestVoicing,
  keysFor,
  nameShape,
  noteName,
  parseShape,
  playsChord,
  shapeNotes,
  shapeText,
  stretchOk,
  voicingsFor,
} from "@/lib/lab/chords";
import movesJson from "@/data/chord-moves.json";
import { type DegreeId, DEGREES, DEGREE_IDS, degreeRoot, findKeys, nextMoves, parseChord, shapeFor, splitChords, transpose, typesFor } from "@/lib/lab/keys";
import { MAP, MOOD_LOOPS, labelsClash, brightness, classicness, moodPoints, nearestPoint, placeScores, quadrantOf, restlessness, vibeOf, naturalLoop } from "@/lib/lab/mood";
import { LAB_BPM, arpeggioBars, loopBars, strumBars } from "@/lib/lab/sound";
import { PITCH_CLASSES, progressions } from "@/lib/musicTheory";

let voicings = 0;
const perTuning: Record<string, number> = {};

for (const tuning of TUNING_IDS) {
  perTuning[tuning] = 0;
  for (let root = 0; root < 12; root++) {
    for (const type of CHORD_TYPE_IDS) {
      const name = chordName(root, type);
      const list = voicingsFor(root, type, tuning);
      // The Dictionary keeps its promise: a real choice of shapes up the neck for every chord (at least 4 in the two
      // tunings that keep E standard's string intervals, at least 3 in the drop tunings), never an endless list.
      const floor = tuning === "e-standard" || tuning === "eb-standard" ? 4 : 3;
      assert.ok(list.length >= floor && list.length <= 12, `${tuning} ${name}: ${list.length} voicings (want ${floor} to 12)`);
      assert.ok(list.some((v) => v.low <= 4) && list.some((v) => v.low >= 8), `${tuning} ${name}: shapes don't reach from the nut up the neck`);
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

// Key finder: every one of the app's ten progressions, in all twelve keys, as full chords and as power chords,
// is found in its own key, first.
const OFFSET = { I: 0, ii: 2, iii: 4, IV: 5, V: 7, vi: 9, vii: 11 } as const;
const QUALITY = { I: "", ii: "m", iii: "m", IV: "", V: "", vi: "m", vii: "" } as const;
let keyChecks = 0;
for (const kind of ["full", "power"] as const) {
  for (const p of progressions) {
    for (let k = 0; k < 12; k++) {
      const chords = p.degrees.map((d) => parseChord(PITCH_CLASSES[(k + OFFSET[d]) % 12] + (kind === "power" ? "5" : QUALITY[d]))!);
      assert.equal(findKeys(chords)[0].key, k, `${kind} ${p.id} in ${PITCH_CLASSES[k]}`);
      keyChecks++;
    }
  }
}
// Round trip: every name the Lab writes for any shape (the best one, the alternatives, slash chords) reads
// back as the same chord, so a name from Name that chord can be pasted into the Key finder.
let roundTrips = 0;
for (const tuning of TUNING_IDS) {
  for (let root = 0; root < 12; root++) {
    for (const type of CHORD_TYPE_IDS) {
      for (const v of voicingsFor(root, type, tuning)) {
        for (const n of nameShape(v.frets, tuning)) {
          const back = parseChord(n.name);
          assert.ok(back, `${n.name} (${shapeText(v.frets)}) isn't readable`);
          assert.equal(back.root, n.root, `${n.name}: root`);
          assert.equal(back.type, n.type, `${n.name}: type`);
          assert.equal(back.bass, n.bass === n.root ? undefined : n.bass, `${n.name}: bass`);
          assert.equal(back.note, undefined, `${n.name}: should need no 'read as' note`);
          roundTrips++;
        }
      }
    }
  }
}
// Names the Lab has no type for are read as the nearest one, and say so.
const readAs = (t: string) => { const c = parseChord(t)!; return `${chordName(c.root, c.type)}${c.bass !== undefined ? `/${noteName(c.bass)}` : ""}|${c.note ?? ""}`; };
assert.equal(readAs("G/B"), "G/B|");
assert.equal(readAs("Fsus4/C"), "Fsus4/C|");
assert.equal(readAs("G6"), "G|Read G6 as G");
assert.equal(readAs("Am6"), "Am|Read Am6 as Am");
assert.equal(readAs("G9"), "G7|Read G9 as G7");
assert.equal(readAs("Gmaj9"), "Gmaj7|Read Gmaj9 as Gmaj7");
assert.equal(readAs("Gm9"), "Gm7|Read Gm9 as Gm7");
assert.equal(readAs("Gdim"), "Gm|Read Gdim as Gm");
assert.equal(readAs("G°"), "Gm|Read G° as Gm");
assert.equal(readAs("Em7b5"), "Em|Read Em7b5 as Em");
assert.equal(readAs("Gaug"), "G|Read Gaug as G");
assert.equal(readAs("G+"), "G|Read G+ as G");
assert.equal(readAs("A7sus4"), "Asus4|Read A7sus4 as Asus4");
assert.equal(parseChord("G/"), null);
assert.equal(parseChord("G/H"), null);
assert.equal(parseChord("G/B/D"), null);
assert.deepEqual(splitChords("G octave C5/G"), ["G octave", "C5/G"]);
// Reading chord names.
assert.deepEqual(splitChords("G D, Em | C"), ["G", "D", "Em", "C"]);
assert.deepEqual(["F#m7", "Bbadd9", "Dsus4", "Gsus", "E5", "Cmaj7", "Am"].map((t) => parseChord(t)?.type), ["m7", "add9", "sus4", "sus4", "5", "maj7", "min"]);
assert.equal(parseChord("Bbadd9")!.root, 10);
assert.equal(parseChord("H"), null);
assert.equal(parseChord("Gxyz"), null);
// Borrowed chords are flagged, not rejected: F in G major is the bVII.
const inG = findKeys(["G", "F", "C", "G"].map((t) => parseChord(t)!), 12).find((f) => f.key === 7)!;
assert.deepEqual(inG.numerals.map((n) => n.numeral), ["I", "bVII", "IV", "I"]);
assert.equal(inG.numerals[1].borrowed, true);

// Transposing up and back is the identity, and capo + tuning maths agree with the shapes: in every tuning,
// with every capo, the shape to play sounds as the chord asked for.
for (const tuning of TUNING_IDS) {
  for (let root = 0; root < 12; root++) {
    for (const type of ["maj", "min", "5", "7", "sus4"] as const) {
      const c = { text: chordName(root, type), root, type };
      for (let semi = -11; semi <= 11; semi++) assert.deepEqual(transpose(transpose(c, semi), -semi), c, `${c.text} ${semi}`);
      for (let capo = 0; capo <= 7; capo++) {
        const shape = shapeFor(c, capo);
        const v = easiestVoicing(shape.root, shape.type, tuning);
        assert.ok(v, `${tuning} ${shape.text}: no shape`);
        const sounds = new Set(shapeNotes(v.frets, tuning).filter((n): n is number => n !== null).map((n) => (n + capo) % 12));
        assert.ok([...sounds].every((p) => chordPitchClasses(root, type).includes(p)), `${tuning} capo ${capo}: shape ${shape.text} doesn't sound ${c.text}`);
        assert.equal(Math.min(...shapeNotes(v.frets, tuning).filter((n): n is number => n !== null)) + capo >= 0, true);
      }
    }
  }
}

// Mood map: every loop is unique and made of real degrees, the ten of the app are all on it, every dot sits
// inside the plot, no two dots print their names on top of each other, every corner of the map has loops, and
// a dot never strays far from its true place (the nudge that keeps names apart is bounded).
const points = moodPoints();
assert.equal(new Set(MOOD_LOOPS.map((l) => l.id)).size, MOOD_LOOPS.length, "duplicate loops on the map");
assert.equal(points.filter((p) => p.own).length, progressions.length);
let farthest = 0;
for (const p of points) {
  assert.ok(p.degrees.length >= 3 && p.degrees.length <= 5 && p.degrees.every((d) => DEGREE_IDS.includes(d)), `${p.id}: bad loop`);
  assert.ok(p.x >= MAP.x0 - 2 && p.x <= MAP.x1 + 2 && p.y >= MAP.y0 - 3 && p.y <= MAP.y1 + 3, `${p.id}: off the plot (${p.x}, ${p.y})`);
  assert.ok(p.bright >= 0 && p.bright <= 1 && p.restless >= 0 && p.restless <= 1, `${p.id}: score out of range`);
  const v = vibeOf(naturalLoop(p.degrees));
  const home = placeScores(v.brightness, v.restlessness);
  farthest = Math.max(farthest, Math.hypot(home.x - p.x, home.y - p.y));
}
assert.ok(farthest <= 30, `a dot was nudged ${farthest.toFixed(0)}% from its place`);
for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) {
  assert.equal(labelsClash(points[i], points[j]), false, `${points[i].id} and ${points[j].id} overlap`);
}
for (const q of ["Tense", "Anthem", "Brooding", "Feel-good"]) assert.ok(points.some((p) => quadrantOf(p.bright, p.restless) === q), `nothing in ${q}`);
// Tapping empty space finds the nearest loop; a loop's own place finds itself.
for (const p of points) assert.equal(nearestPoint(points, p.x, p.y).id, p.id);
// The darkest loop is a minor-heavy one, the brightest has no minor chord.
const byBright = [...points].sort((a, b) => a.bright - b.bright);
assert.ok(byBright[0].degrees.some((d) => ["vi", "iii", "ii", "iv"].includes(d)), `darkest is ${byBright[0].id}`);
assert.ok(byBright.at(-1)!.degrees.every((d) => !["vi", "iii", "ii", "iv"].includes(d)), `brightest is ${byBright.at(-1)!.id}`);

console.log(
  `verify-lab: ${voicings} voicings checked (${Object.entries(perTuning)
    .map(([t, n]) => `${t} ${n}`)
    .join(", ")}): exact chord tones, root in the bass, within reach, fingered, muted, named back; ${roundTrips} names (slash chords too) read back as the same chord; ${keyChecks} loops found in their own key; the capo maths agrees with the shapes in every tuning; ${points.length} mood-map loops placed, none overlapping.`,
);
