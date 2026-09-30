// Power-chord engine invariants (docs/power-chord-engine-brief.md §11), for every key × progression ×
// feel × section × 50 seeds, plus reference tabs at seed 0. Part of `npm run verify`.
// `npx tsx scripts/verify-voicings.ts --update-fixtures` rewrites scripts/fixtures/reference-tabs.json (then hand-check the diff).
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chordLibraryJson } from "./generate-chord-library";
import { type TabLineGroup, OPEN_STRING_MIDI, TAB_STRINGS, midiOf, pitchClass, tabText } from "@/lib/fretboard";
import {
  type FeelId,
  type RenderedSection,
  FEEL_IDS,
  type SectionId,
  type SectionInputs,
  SECTION_IDS,
  getTemplate,
  libraryVoicings,
  nextSeed,
  renderSection,
  sectionTarget,
} from "@/lib/generator";
import { PITCH_CLASSES, type Degree, type NoteName, getProgression, pitchClassOf, progressions, degreeOffsets } from "@/lib/musicTheory";
import { sectionBars } from "@/lib/playback";
import { SETTINGS, checkVoicing } from "@/lib/voicings";

const FEELS: FeelId[] = FEEL_IDS;
const SEEDS = 50;
const LIMIT = SETTINGS.fretLimit;
let renders = 0;
let shiftCount = 0;

// ---------------------------------------------------------------------------
// Tab parsing: rebuild every cell's notes from the rendered text alone, so "audio = tab" compares the
// sound against what a guitarist would actually read.

type ParsedCell = { notes: number[]; dead: boolean } | null;

function parseTab(groups: TabLineGroup[]): ParsedCell[][] {
  const bars: ParsedCell[][] = [];
  for (const g of groups) {
    const rows = g.strings.map((r) => r.slice(2)); // drop "e|"
    // bar lines must line up on every string
    const bars0 = [...rows[0]].flatMap((c, i) => (c === "|" ? [i] : []));
    for (const r of rows) assert.deepEqual([...r].flatMap((c, i) => (c === "|" ? [i] : [])), bars0, "bar lines misaligned");
    let start = 0;
    for (const end of bars0) {
      const cells: ParsedCell[] = [];
      let p = start;
      while (p < end) {
        const runs = rows.map((r) => /^[0-9x]*/.exec(r.slice(p, end))![0]);
        const width = Math.max(1, ...runs.map((x) => x.length)) + 1;
        const notes = runs.flatMap((x, k) => (/^\d+$/.test(x) ? [OPEN_STRING_MIDI[TAB_STRINGS[k]] + Number(x)] : []));
        const dead = runs.some((x) => x === "x");
        cells.push(notes.length ? { notes: notes.sort((a, b) => a - b), dead: false } : dead ? { notes: [], dead: true } : null);
        p += width;
      }
      assert.equal(cells.length, 8, "a bar must have 8 cells");
      bars.push(cells);
      start = end + 1;
    }
  }
  return bars;
}

// ---------------------------------------------------------------------------

function checkLayout(s: RenderedSection, where: string) {
  for (const g of s.tab) {
    const len = g.strings[0].length;
    for (const row of [...g.strings, ...g.header]) assert.equal(row.length, len, `${where}: rows differ in length`);
    const barCount = (g.strings[0].match(/\|/g) ?? []).length - 1;
    assert.ok(barCount >= 1 && barCount <= 2, `${where}: ${barCount} bars on a line (want 2 per line)`);
    // Articulation spans close on a bar line.
    for (const h of g.header) {
      for (const m of h.matchAll(/(P\.M\.|let ring)-*\|/g)) {
        const close = m.index! + m[0].length - 1;
        const atBar = g.strings[0][close + 1] === "|";
        const atStop = h.slice(close + 1, close + 5) === "N.C.";
        assert.ok(atBar || atStop, `${where}: articulation span doesn't end at a bar line or a stop`);
      }
    }
  }
  for (const b of s.bars) assert.equal(b.cells.length, 8, `${where}: bar isn't 8 cells`);
}

function avgPosition(s: RenderedSection): number {
  const ps = s.voicings.map((v) => v.voicing.position);
  return ps.reduce((a, b) => a + b, 0) / ps.length;
}

function checkChordSection(s: RenderedSection, inputs: SectionInputs, where: string) {
  // 1 + 2: correct notes, limits, allowed root strings; pitch classes match the degrees in this key.
  for (const { chord, voicing } of s.voicings) {
    assert.deepEqual(checkVoicing(voicing), [], `${where} ${chord.name}: ${checkVoicing(voicing).join("; ")}`);
    assert.equal(voicing.rootPc, pitchClassOf(chord.root), `${where}: ${chord.name} voiced on the wrong root`);
  }
  for (const bar of s.bars)
    for (const ev of bar.cells) if (ev) for (const n of ev.notes) assert.ok(n.fret >= 0 && n.fret <= LIMIT, `${where}: fret ${n.fret}`);
  // Degrees: every bar's chord is the right chord for the template / progression in this key.
  const keyPc = pitchClassOf(inputs.key);
  if (s.id === "chorus") {
    const degrees = getProgression(inputs.progressionId).degrees;
    s.chords.forEach((c, i) => assert.equal(pitchClassOf(c.root), (keyPc + degreeOffsets[degrees[Math.min(i, degrees.length - 1)]]) % 12, `${where}: bar ${i + 1} chord`));
  } else {
    const degrees = getTemplate(s.id).degreeSequence as Degree[];
    s.chords.forEach((c, i) => assert.equal(pitchClassOf(c.root), (keyPc + degreeOffsets[degrees[i]]) % 12, `${where}: bar ${i + 1} chord`));
  }
  // 3: hand moves inside a section stay within maxMove frets unless recorded as a shift.
  for (let i = 1; i < s.bars.length; i++) {
    const a = s.voicings.find((v) => v.chord.root === s.bars[i - 1].chord!.root)!.voicing;
    const b = s.voicings.find((v) => v.chord.root === s.bars[i].chord!.root)!.voicing;
    const move = Math.abs(a.position - b.position);
    if (move > SETTINGS.maxMove) {
      assert.ok(s.shifts.includes(i), `${where}: ${move}-fret jump at bar ${i + 1} not recorded as a shift`);
      shiftCount++;
    }
  }
  // 7: audio = tab (parsed from the text), including dead strums; the Verse plays its bars twice.
  const parsed = parseTab(s.tab);
  const audio = sectionBars(s);
  assert.equal(audio.length, parsed.length * s.repeat, `${where}: audio bar count`);
  audio.forEach((bar, b) => {
    const tabBar = parsed[b % parsed.length];
    bar.cells.forEach((hit, c) => {
      const cell = tabBar[c];
      if (!hit) return assert.equal(cell, null, `${where}: tab has a note the audio doesn't play (bar ${b + 1}, cell ${c + 1})`);
      assert.ok(cell, `${where}: audio plays a note the tab doesn't show (bar ${b + 1}, cell ${c + 1})`);
      if (hit.dead) assert.ok(cell!.dead, `${where}: dead strum mismatch`);
      else assert.deepEqual([...hit.notes].sort((x, y) => x - y), cell!.notes, `${where}: bar ${b + 1} cell ${c + 1} notes`);
    });
  });
}

// ---------------------------------------------------------------------------
// The sweep


for (const key of PITCH_CLASSES) {
  for (const prog of progressions) {
    for (const feel of FEELS) {
      for (let seed = 0; seed < SEEDS; seed++) {
        const inputs: SectionInputs = { key, feel, progressionId: prog.id, seed };
        const rendered = {} as Record<SectionId, RenderedSection>;
        for (const id of SECTION_IDS) {
          // Sections other than the Chorus don't depend on the progression: check them once per key/feel/seed.
          if (id !== "chorus" && prog !== progressions[0]) continue;
          const where = `${key} ${prog.id} ${feel} ${id} seed ${seed}`;
          const s = renderSection(id, inputs);
          renders++;
          rendered[id] = s;
          checkLayout(s, where);
          if (id !== "solo") checkChordSection(s, inputs, where);
          // 6: deterministic.
          assert.equal(tabText(renderSection(id, inputs).tab), tabText(s.tab), `${where}: same seed, different tab`);
        }
        // 4: the chorus lifts above the verse (same seed), or matches it when the verse is already high.
        if (rendered.verse) {
          const verse = rendered.verse;
          for (const p of progressions) {
            const chorus = p === prog ? rendered.chorus : renderSection("chorus", { ...inputs, progressionId: p.id });
            const where = `${key} ${p.id} ${feel} seed ${seed}`;
            const high = sectionTarget("verse", key) >= LIMIT - 3 - SETTINGS.chorusLift;
            assert.ok(avgPosition(chorus) > avgPosition(verse) || (high && avgPosition(chorus) >= avgPosition(verse)), `${where}: chorus (${avgPosition(chorus)}) doesn't lift above verse (${avgPosition(verse)})`);
          }
        }
      }
    }
  }
}

// 6: a new seed is visibly different and (checked above) still valid.
for (const key of PITCH_CLASSES)
  for (const id of SECTION_IDS)
    for (const feel of FEELS) {
      const inputs = { key, feel, progressionId: "I-V-vi-IV", seed: 0 };
      assert.notEqual(tabText(renderSection(id, { ...inputs, seed: nextSeed(id, inputs) }).tab), tabText(renderSection(id, inputs).tab), `${key} ${id} ${feel}: regenerate is a no-op`);
    }

// Library voicings (chips + progression playback) are valid too.
for (const key of PITCH_CLASSES)
  for (const p of progressions)
    for (const { chord, voicing } of libraryVoicings(key, p.id)) {
      assert.deepEqual(checkVoicing(voicing), [], `${key} ${p.id} library ${chord.name}`);
      assert.equal(voicing.rootPc, pitchClassOf(chord.root));
    }

// data/chord-library.json is generated from the shapes and must be up to date.
assert.equal(readFileSync(join(process.cwd(), "data/chord-library.json"), "utf8"), chordLibraryJson(), "data/chord-library.json is stale: run npm run generate:chords");

// ---------------------------------------------------------------------------
// Brief §4's hand-checked paths, key of G, I-V-vi-IV = G5 D5 E5 C5.

const notes = (vs: { voicing: { notes: { string: string; fret: number }[] } }[]) => vs.map((v) => v.voicing.notes.map((n) => `${n.string}${n.fret}`).join("+"));
assert.deepEqual(notes(libraryVoicings("G", "I-V-vi-IV")), ["E3+A5", "A5+D7", "A7+D9", "A3+D5"], "compact low/mid path (brief §4)");
const liftedG = renderSection("chorus", { key: "G", feel: "fast-punk", progressionId: "I-V-vi-IV", seed: 0 });
// The brief's lifted path with the octave on top (3-note chorus shapes): the lower two notes are exact.
assert.deepEqual(notes(liftedG.voicings), ["A10+D12+G12", "E10+A12+D12", "A7+D9+G9", "E8+A10+D10"], "lifted chorus path (brief §4)");
// Hand check of the pitches: A+10 = G, D+12 = D, E+10 = D, A+12 = A, A+7 = E, D+9 = B, E+8 = C, A+10 = G.
const pc = (s: "E" | "A" | "D" | "G", f: number) => "C C# D D# E F F# G G# A A# B".split(" ")[pitchClass(midiOf({ string: s, fret: f }))];
assert.deepEqual([pc("A", 10), pc("D", 12), pc("E", 10), pc("A", 12), pc("A", 7), pc("D", 9), pc("E", 8), pc("A", 10)], ["G", "D", "D", "A", "E", "B", "C", "G"]);

// ---------------------------------------------------------------------------
// Reference tabs at seed 0 (hand-checked; see scripts/fixtures/reference-tabs.json).

const REFERENCES: { name: string; id: SectionId; key: NoteName; feel: FeelId; progressionId: string }[] = [
  { name: "G chorus, fast punk (brief §4 lifted path)", id: "chorus", key: "G", feel: "fast-punk", progressionId: "I-V-vi-IV" },
  { name: "G verse, fast punk (brief §7: G5 G5 D5 D5, shared A-string note)", id: "verse", key: "G", feel: "fast-punk", progressionId: "I-V-vi-IV" },
  { name: "G intro, fast punk", id: "intro", key: "G", feel: "fast-punk", progressionId: "I-V-vi-IV" },
  { name: "A verse, fast punk (open strings)", id: "verse", key: "A", feel: "fast-punk", progressionId: "I-V-vi-IV" },
  { name: "E breakdown (half-time, dead strums, stop)", id: "breakdown", key: "E", feel: "fast-punk", progressionId: "I-V-vi-IV" },
  { name: "D intro, half-time", id: "intro", key: "D", feel: "half-time", progressionId: "I-V-vi-IV" },
  { name: "C chorus, half-time, I-IV-V (3 chords over 4 bars)", id: "chorus", key: "C", feel: "half-time", progressionId: "I-IV-V" },
  { name: "F# verse, mid-tempo", id: "verse", key: "F#", feel: "mid-tempo", progressionId: "I-V-vi-IV" },
  { name: "D# chorus, fast punk, vi-IV-I-V (high key)", id: "chorus", key: "D#", feel: "fast-punk", progressionId: "vi-IV-I-V" },
  { name: "B chorus, mid-tempo, I-V-IV-V", id: "chorus", key: "B", feel: "mid-tempo", progressionId: "I-V-IV-V" },
  { name: "G chorus, pop strum (let ring, pushes)", id: "chorus", key: "G", feel: "pop-strum", progressionId: "I-V-vi-IV" },
  { name: "D verse, ballad (palm-muted quarters)", id: "verse", key: "D", feel: "ballad", progressionId: "I-V-vi-IV" },
];

const fixturePath = join(process.cwd(), "scripts/fixtures/reference-tabs.json");
const actual = REFERENCES.map((r) => ({ name: r.name, tab: tabText(renderSection(r.id, { key: r.key, feel: r.feel, progressionId: r.progressionId, seed: 0 }).tab).split("\n") }));
if (process.argv.includes("--update-fixtures")) {
  writeFileSync(fixturePath, JSON.stringify(actual, null, 2) + "\n");
  console.log("Wrote", fixturePath);
} else {
  const expected = JSON.parse(readFileSync(fixturePath, "utf8")) as typeof actual;
  assert.equal(expected.length, REFERENCES.length, "reference fixture count");
  actual.forEach((a, i) => assert.deepEqual(a.tab, expected[i].tab, `reference tab "${a.name}" changed`));
}
for (const a of actual.slice(0, 2)) console.log(`\n${a.name}:\n${a.tab.join("\n")}`);

console.log(`\nVoicing engine: ${renders} distinct section renders checked, covering 12 keys × 6 progressions × ${FEELS.length} feels × 5 sections × ${SEEDS} seeds (only the Chorus depends on the progression), ${shiftCount} recorded position shifts, ${REFERENCES.length} reference tabs.`);
console.log("All voicing-engine checks passed.");
