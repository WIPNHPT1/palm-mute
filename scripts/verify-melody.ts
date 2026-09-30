// Intro melody and lead solo invariants (docs/melody-and-solo-brief.md §12), for every key ×
// progression × part × style × length × 50 seeds, plus reference outputs at seed 0 (including the
// brief's §4 hook). Part of `npm run verify`. `--update-fixtures` rewrites
// scripts/fixtures/reference-leads.json (then hand-check the diff).
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { OPEN_STRING_MIDI, TAB_STRINGS, pitchClass, renderTab, tabText } from "@/lib/fretboard";
import {
  type Lead,
  type LeadInputs,
  type LeadNote,
  INTRO_STYLES,
  MAJOR,
  RULES,
  SOLO_STYLES,
  chordThird,
  chordTones,
  generateLead,
  inScale,
  leadFromNotes,
  leadTabBars,
  motifReturns,
  nextLeadSeed,
} from "@/lib/melody";
import { PITCH_CLASSES, noteNameFor, pitchClassOf, progressions } from "@/lib/musicTheory";
import { leadBars } from "@/lib/playback";

const SEEDS = 50;
const STRONG = RULES.strongCells;
const T = RULES.techniques;
const { maxSemitones, recoverFrom, stepMaxSemitones } = RULES.leap;
let count = 0;
let strongTotal = 0, strongChord = 0, bends = 0, legato = 0, slides = 0, vibratos = 0;

/** Every §12 rule for one lead; returns the problems found (empty = valid). */
export function validateLead(lead: Lead): string[] {
  const p: string[] = [];
  const { inputs, notes } = lead;
  const keyPc = pitchClassOf(inputs.key);
  const limit = RULES.fretLimits[inputs.part];
  const where = (n: LeadNote) => `bar ${n.bar + 1} cell ${n.cell + 1}`;
  const midiAt = (s: string, f: number) => OPEN_STRING_MIDI[s as keyof typeof OPEN_STRING_MIDI] + f;

  // 1. Scale and fret limit; the tabbed fret really plays the pitch.
  for (const n of notes) {
    if (!inScale(n.midi, keyPc)) p.push(`${where(n)}: ${noteNameFor(n.midi)} isn't in the major pentatonic`);
    if (midiAt(n.string, n.fret) !== n.midi) p.push(`${where(n)}: ${n.string}${n.fret} doesn't play ${n.midi}`);
    const frets = [n.fret, n.technique?.kind === "bend" ? n.technique.fromFret : n.fret, n.double?.fret ?? 0];
    if (frets.some((f) => f < 0 || f > limit)) p.push(`${where(n)}: fret outside 0-${limit}`);
    if (n.double) {
      if (midiAt(n.double.string, n.double.fret) !== n.double.midi) p.push(`${where(n)}: doubled note is mis-tabbed`);
      const iv = Math.abs(n.double.midi - n.midi);
      if (n.double.kind === "octave" && iv !== 12) p.push(`${where(n)}: octave isn't an octave`);
      if (n.double.kind !== "octave" && (![3, 4, 8, 9].includes(iv) || !inScale(n.double.midi, keyPc, MAJOR))) p.push(`${where(n)}: harmony isn't a diatonic third or sixth`);
      if (Math.abs(n.double.fret - n.fret) > 3) p.push(`${where(n)}: double-stop stretch`);
    }
  }
  // 2. Strong beats: ≥ 75% chord notes, and never the wrong third for the chord.
  const strong = notes.filter((n) => STRONG.includes(n.cell));
  const onChord = strong.filter((n) => chordTones(lead.degrees[n.bar]).includes(pitchClass(n.midi - keyPc)));
  strongTotal += strong.length;
  strongChord += onChord.length;
  if (onChord.length < RULES.minStrongChordRatio * strong.length) p.push(`only ${onChord.length}/${strong.length} strong beats on chord notes`);
  for (const n of strong) {
    const deg = lead.degrees[n.bar];
    const root = chordTones(deg)[0];
    const wrongThird = pitchClass(root + (chordThird(deg) - root === 4 || chordThird(deg) - root === -8 ? 3 : 4));
    if (pitchClass(n.midi - keyPc) === wrongThird) p.push(`${where(n)}: wrong third for ${deg}`);
  }
  // 3. Leaps.
  for (let i = 1; i < notes.length; i++) {
    const d = notes[i].midi - notes[i - 1].midi;
    if (Math.abs(d) > maxSemitones) p.push(`${where(notes[i])}: leap of ${Math.abs(d)} semitones`);
    if (Math.abs(d) >= recoverFrom) {
      const next = notes[i + 1];
      if (!next) p.push(`${where(notes[i])}: ends on an unresolved leap`);
      else {
        const e = next.midi - notes[i].midi;
        if (Math.sign(e) !== -Math.sign(d) || e === 0 || Math.abs(e) > stepMaxSemitones) p.push(`${where(next)}: leap not followed by a step back`);
      }
    }
  }
  // 4. The ending: root or 3rd, on a strong beat, held.
  const last = notes[notes.length - 1];
  if (![0, 4].includes(pitchClass(last.midi - keyPc))) p.push(`ends on ${noteNameFor(last.midi)}, not the root or 3rd`);
  if (!STRONG.includes(last.cell) || last.cells < 2) p.push("last note isn't held on a strong beat");
  if (last.bar !== inputs.bars - 1) p.push("last note isn't in the last bar");
  // 5. Techniques and hand positions.
  notes.forEach((n, i) => {
    const t = n.technique;
    const prev = notes[i - 1];
    if (t?.kind === "bend") {
      bends++;
      const step = n.midi - t.fromMidi;
      if (!T.bendSteps.includes(step) || n.fret - t.fromFret !== step) p.push(`${where(n)}: bend isn't a half or whole step`);
      if (!inScale(t.fromMidi, keyPc) || !inScale(n.midi, keyPc)) p.push(`${where(n)}: bend from ${noteNameFor(t.fromMidi)} to ${noteNameFor(n.midi)} leaves the scale`);
      if (midiAt(n.string, t.fromFret) !== t.fromMidi || !T.bendStrings.includes(n.string)) p.push(`${where(n)}: bend fingering`);
    }
    if (t?.kind === "hammer" || t?.kind === "pull") {
      legato++;
      if (!prev || prev.string !== n.string || Math.abs(prev.fret - n.fret) > T.legatoMaxFrets || (t.kind === "hammer") !== n.fret > prev.fret) p.push(`${where(n)}: ${t.kind} isn't on one string`);
    }
    if (t?.kind === "slideUp" || t?.kind === "slideDown") {
      slides++;
      if (!prev || prev.string !== n.string || (t.kind === "slideUp") !== n.fret > prev.fret) p.push(`${where(n)}: slide isn't on one string`);
    }
    if (n.vibrato) vibratos++;
  });
  for (let ph = 0; ph < inputs.bars / 2; ph++) {
    const frets = notes.filter((n) => Math.floor(n.bar / 2) === ph).map((n) => (n.technique?.kind === "bend" ? n.technique.fromFret : n.fret));
    if (frets.length && Math.max(...frets) - Math.min(...frets) > 4) p.push(`phrase ${ph + 1} needs frets ${Math.min(...frets)}-${Math.max(...frets)} (more than one hand position)`);
  }
  // Range: the intro stays within about an octave, the solo within two.
  const pitches = notes.map((n) => n.midi);
  const range = Math.max(...pitches) - Math.min(...pitches);
  if (range > (inputs.part === "intro" ? 14 : 26)) p.push(`range of ${range} semitones`);
  return p;
}

/** 8. Audio = tab = text: parse the tab text back into notes and compare with playback and the text version. */
function checkAudioAndText(lead: Lead) {
  const pb = leadBars(lead, "fast-punk", true);
  assert.equal(pb.length, lead.inputs.bars);
  const parsed: { cell: number; midis: number[] }[][] = [];
  for (const g of lead.tab) {
    const rows = g.strings.map((r) => r.slice(2));
    let start = 0;
    for (const end of [...rows[0]].flatMap((c, i) => (c === "|" ? [i] : []))) {
      const cells: { cell: number; midis: number[] }[] = [];
      let cell = 0;
      for (let q = start; q < end; cell++) {
        const runs = rows.map((r) => /^[0-9bhp/\\~]*/.exec(r.slice(q, end))![0]);
        const midis = runs.flatMap((tok, k) => {
          if (!tok) return [];
          const nums = tok.match(/\d+/g)!.map(Number);
          return [OPEN_STRING_MIDI[TAB_STRINGS[k]] + nums[nums.length - 1]]; // "5b7" sounds the 7
        });
        if (midis.length) cells.push({ cell, midis: midis.sort((a, b) => a - b) });
        q += Math.max(1, ...runs.map((x) => x.length)) + 1;
      }
      assert.equal(cell, 8, "lead bar isn't 8 cells");
      parsed.push(cells);
      start = end + 1;
    }
  }
  pb.forEach((bar, b) => {
    const played = bar.lead!.flatMap((h, c) => (h ? [{ cell: c, midis: [...h.notes].sort((x, y) => x - y) }] : []));
    assert.deepEqual(played, parsed[b], `bar ${b + 1}: audio doesn't match the tab`);
    // Timing: each note lasts until the next one or its hold ends, as the tab spaces it.
    for (const n of lead.notes.filter((x) => x.bar === b)) assert.equal(bar.lead![n.cell]!.cells, n.cells);
    // Text version: the same notes, by name, in the same cells.
    const words = lead.text[b].split(": ")[1].split(" ");
    assert.equal(words.length, 8);
    for (const n of lead.notes.filter((x) => x.bar === b)) assert.ok(words[n.cell].includes(noteNameFor(n.midi)), `bar ${b + 1}: text version`);
  });
}

// ---------------------------------------------------------------------------
// The sweep

for (const key of PITCH_CLASSES)
  for (const prog of progressions)
    for (const [part, styles, lengths] of [["intro", INTRO_STYLES, RULES.lengths.intro], ["solo", SOLO_STYLES, RULES.lengths.solo]] as const)
      for (const style of styles)
        for (const bars of lengths)
          for (let seed = 0; seed < SEEDS; seed++) {
            const inputs: LeadInputs = { key, progressionId: prog.id, part, style, bars, seed };
            const where = `${key} ${prog.id} ${part} ${style} ${bars} bars seed ${seed}`;
            const lead = generateLead(inputs);
            count++;
            const problems = validateLead(lead);
            assert.deepEqual(problems, [], `${where}: ${problems.join("; ")}`);
            if (part === "intro") assert.ok(motifReturns(lead), `${where}: the motif never returns`);
            else {
              const peak = Math.max(...lead.notes.map((n) => n.midi));
              const peakBar = lead.notes.find((n) => n.midi === peak)!.bar;
              assert.ok(peakBar >= bars / 2, `${where}: the solo peaks in bar ${peakBar + 1}, not its second half`);
            }
            // 7. Deterministic; a new seed is different.
            if (seed < 3) {
              assert.equal(tabText(generateLead(inputs).tab), tabText(lead.tab), `${where}: same seed, different lead`);
              const next = nextLeadSeed(inputs);
              const other = generateLead({ ...inputs, seed: next });
              assert.notEqual(tabText(other.tab), tabText(lead.tab), `${where}: regenerate is a no-op`);
              assert.deepEqual(validateLead(other), [], `${where}: regenerated take is invalid`);
              checkAudioAndText(lead);
            }
          }

// ---------------------------------------------------------------------------
// Brief §4: key of G, I-V-vi-IV, Hook, 4 bars. The hand-written example must pass every rule and
// render exactly as the brief prints it.

const n = (bar: number, cell: number, cells: number, string: "B" | "e", fret: number): LeadNote => ({
  bar, cell, cells, string, fret, midi: OPEN_STRING_MIDI[string] + fret, role: "chord",
});
const briefNotes: LeadNote[] = [
  n(0, 0, 1, "B", 3), n(0, 1, 1, "B", 5), n(0, 2, 2, "e", 3), n(0, 4, 1, "e", 3), n(0, 5, 1, "e", 5), n(0, 6, 2, "e", 7),
  n(1, 0, 2, "e", 5), n(1, 2, 1, "e", 3), n(1, 3, 1, "B", 5), n(1, 4, 2, "B", 3), n(1, 6, 2, "e", 5),
  n(2, 0, 1, "e", 7), n(2, 1, 1, "e", 5), n(2, 2, 2, "e", 3), n(2, 4, 2, "B", 5), n(2, 6, 2, "e", 3),
  n(3, 0, 1, "e", 3), n(3, 1, 1, "B", 5), n(3, 2, 2, "B", 3), n(3, 4, 2, "B", 5), n(3, 6, 2, "e", 3),
];
const briefLead = leadFromNotes({ key: "G", progressionId: "I-V-vi-IV", part: "intro", style: "hook", bars: 4, seed: 0 }, briefNotes);
// The example passes every rule but one: bar 2 ends on a leap D→A (a fifth) and bar 3 carries on up
// to B, where §3/§12.3 ask for a step back down. Generated leads keep that rule strictly; this is
// flagged for the owner in the PR rather than loosened.
assert.deepEqual(validateLead(briefLead), ["bar 3 cell 1: leap not followed by a step back"], `brief §4 example: ${validateLead(briefLead).join("; ")}`);
assert.equal(
  tabText(renderTab(leadTabBars(briefLead.chords, briefNotes), 4)),
  [
    "  G5               D5               E5               C5",
    "e|----3---3-5-7---|5---3-------5---|7-5-3-------3---|3-----------3---|",
    "B|3-5-------------|------5-3-------|--------5-------|--5-3---5-------|",
    "G|----------------|----------------|----------------|----------------|",
    "D|----------------|----------------|----------------|----------------|",
    "A|----------------|----------------|----------------|----------------|",
    "E|----------------|----------------|----------------|----------------|",
  ].join("\n"),
  "brief §4 tab",
);
assert.deepEqual(briefLead.text, ["G: D E G · G A B ·", "D: A · G E D · A ·", "Em: B A G · E · G ·", "C: G E D · E · G ·"], "brief §4 note names");
const briefStrong = briefNotes.filter((x) => STRONG.includes(x.cell));
assert.equal(briefStrong.filter((x) => chordTones(briefLead.degrees[x.bar]).includes(pitchClass(x.midi - pitchClassOf("G")))).length, 14, "brief §4: 14 of 16 strong beats");
// Bend check in G: A→B on the e string and D→E on the B string are fine; B→C# on the G string isn't in the key.
const g = pitchClassOf("G");
assert.ok(inScale(OPEN_STRING_MIDI.e + 5, g) && inScale(OPEN_STRING_MIDI.e + 7, g), "e|5b7 (A to B)");
assert.ok(inScale(OPEN_STRING_MIDI.B + 3, g) && inScale(OPEN_STRING_MIDI.B + 5, g), "B|3b5 (D to E)");
assert.ok(!inScale(OPEN_STRING_MIDI.G + 6, g), "G|4b6 (B to C#) must be rejected");
{
  const bad = leadFromNotes(briefLead.inputs, briefNotes.map((x, i) => (i === 5 ? { ...x, string: "G", fret: 6, midi: OPEN_STRING_MIDI.G + 6, technique: { kind: "bend", fromFret: 4, fromMidi: OPEN_STRING_MIDI.G + 4 } } : x)));
  assert.ok(validateLead(bad).some((m) => m.includes("leaves the scale") || m.includes("isn't in the major pentatonic")), "a B→C# bend in G is rejected");
}

// ---------------------------------------------------------------------------
// Reference outputs at seed 0 (hand-checked; scripts/fixtures/reference-leads.json).

const REFERENCES: LeadInputs[] = [
  { key: "G", progressionId: "I-V-vi-IV", part: "intro", style: "hook", bars: 4, seed: 0 },
  { key: "A", progressionId: "I-V-vi-IV", part: "intro", style: "hook", bars: 4, seed: 0 },
  { key: "D", progressionId: "I-V-vi-IV", part: "intro", style: "octaves", bars: 4, seed: 0 },
  { key: "C", progressionId: "vi-IV-I-V", part: "intro", style: "harmony", bars: 4, seed: 0 },
  { key: "E", progressionId: "I-IV-V", part: "intro", style: "hook", bars: 8, seed: 0 },
  { key: "G", progressionId: "I-V-vi-IV", part: "solo", style: "classic", bars: 8, seed: 0 },
  { key: "A", progressionId: "vi-V-IV", part: "solo", style: "chill", bars: 8, seed: 0 },
  { key: "F#", progressionId: "I-V-IV-V", part: "solo", style: "shred", bars: 8, seed: 0 },
  { key: "D#", progressionId: "IV-I-V-vi", part: "solo", style: "classic", bars: 16, seed: 0 },
];
const fixturePath = join(process.cwd(), "scripts/fixtures/reference-leads.json");
const actual = REFERENCES.map((r) => {
  const l = generateLead(r);
  return { name: `${r.key} ${r.progressionId} ${r.part} ${r.style} ${r.bars} bars`, tab: tabText(l.tab).split("\n"), text: l.text };
});
if (process.argv.includes("--update-fixtures")) {
  writeFileSync(fixturePath, JSON.stringify(actual, null, 2) + "\n");
  console.log("Wrote", fixturePath);
} else {
  const expected = JSON.parse(readFileSync(fixturePath, "utf8")) as typeof actual;
  assert.equal(expected.length, actual.length, "reference lead count");
  actual.forEach((a, i) => assert.deepEqual(a, expected[i], `reference lead "${a.name}" changed`));
}

console.log(
  `\nLead engine: ${count} leads checked (12 keys × ${progressions.length} progressions × 2 parts × 3 styles × 2 lengths × ${SEEDS} seeds); ` +
    `${((100 * strongChord) / strongTotal).toFixed(1)}% of strong beats on chord notes; ${bends} bends, ${legato} hammer-ons/pull-offs, ${slides} slides, ${vibratos} vibratos; ` +
    `brief §4 hook + ${REFERENCES.length} reference outputs.`,
);
console.log("All lead-engine checks passed.");
