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
  libraryVoicings,
  nextSeed,
  renderSection,
  sectionTarget,
  tabBars,
} from "@/lib/generator";
import { PITCH_CLASSES, type NoteName, pitchClassOf, progressions, degreeOffsets } from "@/lib/musicTheory";
import { sectionBars, songBarParts, songBars } from "@/lib/playback";
import { FORM_IDS, formSlots, sectionDegrees, timesFor } from "@/lib/songPlan";
import { SETTINGS, type Voicing, checkVoicing } from "@/lib/voicings";
import { type MuteSource, PLAYABILITY, downRunCap, labelPitchClasses, longestDownRun, mutePlan, pitchClassesOf } from "@/lib/playability";
import { fastestChange, riffFastest } from "@/lib/generator";

const FEELS: FeelId[] = FEEL_IDS;
const SEEDS = 50;
const LIMIT = SETTINGS.fretLimit;
let renders = 0;
let shiftCount = 0;

// Playability (Phase 2) tallies, printed at the end.
const muteCounts: Record<MuteSource, number> = { lean: 0, underside: 0, tip: 0, thumb: 0, pick: 0 };
const fastestByFeel: Partial<Record<FeelId, number>> = {};
const runByFeel: Partial<Record<FeelId, number>> = {};
const ratings: Record<string, number[]> = {};
let hitsChecked = 0;
let riffRenders = 0;
const SHAME = JSON.parse(readFileSync(join(process.cwd(), "scripts/fixtures/hall-of-shame.json"), "utf8")) as {
  entries: { what: string; notes: string[]; articulation?: "pm" | "ring"; label?: string }[];
};

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
      assert.ok(cells.length === 8 || cells.length === 16, `a bar must have 8 or 16 cells, not ${cells.length}`);
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
  for (const b of s.bars) assert.ok(b.cells.length === 8 || b.cells.length === 16, `${where}: bar has ${b.cells.length} cells`);
  // Layout D: a 16th-note bar has a line to itself; eighth-note bars pair up.
  for (const g of s.tab) {
    const cellsPerBar = (g.strings[0].slice(2).split("|").filter(Boolean)[0] ?? "").length;
    const bars = (g.strings[0].match(/\|/g) ?? []).length - 1;
    if (bars === 2) assert.ok(cellsPerBar < 40, `${where}: a 16th-note bar shares a line`);
  }
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
  // Guitarist playability: no inverted power chords (fifth under the root reads as a wrong chord);
  // no open D-string root on a ringing bar (nothing mutes the open low E and A strings); octave
  // shapes are named as octaves, not "5" chords.
  s.bars.forEach((bar, i) => {
    const v = s.voicings.find((x) => x.chord.root === bar.chord!.root)!.voicing;
    assert.ok(!v.tags.includes("inverted"), `${where}: bar ${i + 1} uses an inverted power chord`);
    if (bar.articulation === "ring")
      assert.ok(!(v.rootString === "D" && v.open), `${where}: bar ${i + 1} rings an open D-string root`);
    assert.equal(tabBars([bar])[0].label, v.tags.includes("octaveRiff") ? `${bar.chord!.root} oct` : bar.chord!.name, `${where}: bar ${i + 1} label`);
  });
  // Phase 2 playability (lib/playability.ts, data/playability.json), on every hit of every bar.
  const voicingOf = (notes: { string: string; fret: number }[]) =>
    s.voicings.map((v) => v.voicing).find((v) => v.notes.length === notes.length && v.notes.every((n, k) => n.string === notes[k].string && n.fret === notes[k].fret)) as Voicing;
  s.bars.forEach((bar, i) => {
    const label = tabBars([bar])[0].label!;
    const next = s.bars[i + 1];
    bar.cells.forEach((ev, c) => {
      if (!ev || ev.kind !== "hit") return;
      hitsChecked++;
      // R5: the notes are exactly what the label promises (a push at the bar's end plays the next bar's chord).
      const pcs = pitchClassesOf(ev.notes);
      const own = labelPitchClasses(label, pitchClassOf(bar.chord!.root));
      const pushed = c === bar.cells.length - 1 && next ? labelPitchClasses(tabBars([next])[0].label!, pitchClassOf(next.chord!.root)) : null;
      assert.ok(
        JSON.stringify(pcs) === JSON.stringify(own) || (pushed && JSON.stringify(pcs) === JSON.stringify(pushed)),
        `${where}: bar ${i + 1} cell ${c + 1} plays pitch classes ${pcs} under "${label}"`,
      );
      // R1: something silences every string the strum could hit.
      const plan = mutePlan(ev.notes, bar.articulation!);
      assert.ok(plan.ok, `${where}: bar ${i + 1} ${label} has no mute plan (${!plan.ok && plan.reason})`);
      if (plan.ok) for (const m of plan.mutes) muteCounts[m.by]++;
      // Hall of shame: no flagged tab ever comes back.
      const hit = ev.notes.map((n) => `${n.string}${n.fret}`).sort().join("+");
      for (const e of SHAME.entries)
        if ([...e.notes].sort().join("+") === hit && (!e.articulation || e.articulation === bar.articulation) && (!e.label || new RegExp(e.label).test(label)))
          assert.fail(`${where}: bar ${i + 1} is in the hall of shame: ${e.what}`);
    });
  });
  // R2: no chord change faster than the limit at this feel's tempo.
  const bpm = s.playability!.bpm;
  const fastest = fastestChange(s.bars, s.voicings.map((v) => v.voicing), bpm);
  assert.ok(fastest <= PLAYABILITY.changes.limitPer100ms + 1e-9, `${where}: a chord change needs ${fastest.toFixed(2)} frets per 100 ms (limit ${PLAYABILITY.changes.limitPer100ms})`);
  fastestByFeel[s.feel] = Math.max(fastestByFeel[s.feel] ?? 0, fastest);
  // R3: chord strums downpick no longer than the default difficulty's cap (octave riffs are always downpicked
  // and count toward the rating instead).
  const cap = downRunCap();
  const chordsOnly = s.bars.map((bar) => ({ ...bar, cells: bar.cells.map((ev) => (ev && ev.notes.length === 2 && voicingOf(ev.notes)?.tags.includes("octaveRiff") ? { ...ev, up: true } : ev)) }));
  if (cap !== null) assert.ok(longestDownRun(chordsOnly, bpm) <= cap, `${where}: ${longestDownRun(chordsOnly, bpm)} chord downstrokes in a row (cap ${cap})`);
  runByFeel[s.feel] = Math.max(runByFeel[s.feel] ?? 0, longestDownRun(s.bars, bpm));
  (ratings[s.id] ??= [0, 0, 0, 0, 0, 0])[s.playability!.rating.score]++;
  // Degrees: every bar's chord comes from the song's harmonic plan over this progression, in this key (R6).
  const keyPc = pitchClassOf(inputs.key);
  const degrees = sectionDegrees(s.id as Exclude<SectionId, "solo">, inputs.progressionId);
  assert.equal(s.chords.length, degrees.length, `${where}: bar count vs plan`);
  s.chords.forEach((c, i) => assert.equal(pitchClassOf(c.root), (keyPc + degreeOffsets[degrees[i]]) % 12, `${where}: bar ${i + 1} chord`));
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
  // R13: a groove with its own drums puts a kick, snare or crash under every accented hit.
  s.bars.forEach((bar, i) => {
    if (!bar.drums) return;
    bar.cells.forEach((ev, c) => {
      if (!ev?.accent) return;
      const d = bar.drums!;
      assert.ok([d.kick, d.snare, d.crash].some((x) => x?.includes(c)), `${where}: bar ${i + 1} accent on cell ${c + 1} has no kick, snare or crash`);
    });
  });
  checkAudioTab(s, where);
}

/** 7: audio = tab (parsed from the text), including dead strums; the Verse plays its bars twice. Full-band stops silence the drums too. */
function checkAudioTab(s: RenderedSection, where: string) {
  const parsed = parseTab(s.tab);
  const audio = sectionBars(s);
  // R13: a stop is full-band: nothing sounds after it, and the drums drop out from the next cell.
  s.bars.forEach((bar, i) => {
    if (bar.stopAt === undefined) return;
    assert.equal(audio[i].drumsStopAt, bar.stopAt + 1, `${where}: bar ${i + 1} stop doesn't silence the drums`);
    assert.ok(bar.cells.slice(bar.stopAt + 1).every((c) => !c), `${where}: bar ${i + 1} plays after its stop`);
  });
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

/** Intro riffs (R12): in the key's scale, on each bar's chord, playable at tempo, audio = tab. */
function checkRiffSection(s: RenderedSection, inputs: SectionInputs, where: string) {
  const keyPc = pitchClassOf(inputs.key);
  const scale = [0, 2, 4, 5, 7, 9, 11].map((d) => (keyPc + d) % 12);
  const degrees = sectionDegrees("intro", inputs.progressionId);
  s.bars.forEach((bar, i) => {
    assert.equal(pitchClassOf(bar.chord!.root), (keyPc + degreeOffsets[degrees[i]]) % 12, `${where}: bar ${i + 1} chord`);
    assert.equal(tabBars([bar])[0].label, bar.chord!.root, `${where}: bar ${i + 1} is named for its chord's root`);
    const pcs = bar.cells.flatMap((ev) => (ev ? ev.notes.map((n) => pitchClass(midiOf(n))) : []));
    assert.ok(pcs.includes(pitchClassOf(bar.chord!.root)), `${where}: bar ${i + 1} never plays its chord's root`);
    bar.cells.forEach((ev, c) => {
      if (!ev) return;
      hitsChecked++;
      for (const n of ev.notes) {
        assert.ok(n.fret >= 0 && n.fret <= LIMIT, `${where}: fret ${n.fret}`);
        assert.ok(scale.includes(pitchClass(midiOf(n))), `${where}: bar ${i + 1} cell ${c + 1} ${n.string}${n.fret} isn't in the key`);
      }
      if (ev.notes.length > 1) {
        const [lo, hi] = ev.notes.map(midiOf).sort((x, y) => x - y);
        assert.equal(hi - lo, 12, `${where}: bar ${i + 1} cell ${c + 1} isn't an octave`);
        const plan = mutePlan(ev.notes, bar.articulation!);
        assert.ok(plan.ok, `${where}: bar ${i + 1} octave has no mute plan`);
        if (plan.ok) for (const m of plan.mutes) muteCounts[m.by]++;
      }
    });
  });
  const fastest = riffFastest(s.bars, s.playability!.bpm);
  assert.ok(fastest <= PLAYABILITY.changes.limitPer100ms + 1e-9, `${where}: a riff move needs ${fastest.toFixed(2)} frets per 100 ms`);
  fastestByFeel[s.feel] = Math.max(fastestByFeel[s.feel] ?? 0, fastest);
  (ratings[s.id] ??= [0, 0, 0, 0, 0, 0])[s.playability!.rating.score]++;
  riffRenders++;
  checkAudioTab(s, where);
}

// ---------------------------------------------------------------------------
// The sweep: every section follows the progression now (Song Engine v2), so all of them are checked for
// every key × progression × feel × seed.

let pushes = 0;
let lowestLift = Infinity;
const energySum: Partial<Record<SectionId, number>> = {};
let energyCount = 0;

for (const key of PITCH_CLASSES) {
  for (const prog of progressions) {
    for (const feel of FEELS) {
      for (let seed = 0; seed < SEEDS; seed++) {
        const inputs: SectionInputs = { key, feel, progressionId: prog.id, seed };
        const rendered = {} as Record<SectionId, RenderedSection>;
        for (const id of SECTION_IDS) {
          const where = `${key} ${prog.id} ${feel} ${id} seed ${seed}`;
          const s = renderSection(id, inputs);
          renders++;
          rendered[id] = s;
          checkLayout(s, where);
          if (s.riff) checkRiffSection(s, inputs, where);
          else if (id !== "solo") checkChordSection(s, inputs, where);
          // 6: deterministic. Re-rendered on every 5th seed (sampled to keep verify near its ~2 minute budget;
          // every other check here runs on all 50 seeds, and verify-critic re-renders whole songs too).
          if (seed % 5 === 0) assert.equal(tabText(renderSection(id, inputs).tab), tabText(s.tab), `${where}: same seed, different tab`);
        }
        const where = `${key} ${prog.id} ${feel} seed ${seed}`;
        // 4: the chorus lifts above the verse (same seed), or matches it when the verse is already high.
        const high = sectionTarget("verse", key) >= LIMIT - 3 - SETTINGS.chorusLift;
        assert.ok(
          avgPosition(rendered.chorus) > avgPosition(rendered.verse) || (high && avgPosition(rendered.chorus) >= avgPosition(rendered.verse)),
          `${where}: chorus (${avgPosition(rendered.chorus)}) doesn't lift above verse (${avgPosition(rendered.verse)})`,
        );
        // R8 energy arc: the Chorus is the song's peak over the Verse, for every song.
        const lift = rendered.chorus.energy - rendered.verse.energy;
        assert.ok(lift > 0, `${where}: chorus energy ${rendered.chorus.energy.toFixed(3)} ≤ verse ${rendered.verse.energy.toFixed(3)}`);
        lowestLift = Math.min(lowestLift, lift);
        for (const id of SECTION_IDS) energySum[id] = (energySum[id] ?? 0) + rendered[id].energy;
        energyCount++;
        // R7 variation: Verse 2's push is the only difference from Verse 1 (one bar's last eighth, now the next chord).
        const v2 = renderSection("verse", inputs, "push");
        const w2 = `${where} verse 2`;
        checkLayout(v2, w2);
        checkChordSection(v2, inputs, w2);
        if (v2.variation) {
          pushes++;
          const b = v2.variation.bar;
          v2.bars.forEach((bar, i) =>
            bar.cells.forEach((cell, c) => {
              if (i === b && c === bar.cells.length - 1) {
                assert.ok(cell?.kind === "hit" && cell.accent, `${w2}: no push in bar ${b + 1}`);
                const next = rendered.verse.bars[b + 1].cells.find((e) => e?.kind === "hit")!;
                assert.deepEqual(cell!.notes, next.notes, `${w2}: the push isn't the next bar's chord`);
              } else assert.deepEqual(cell, rendered.verse.bars[i].cells[c], `${w2}: bar ${i + 1} cell ${c + 1} differs from Verse 1`);
            }),
          );
        } else assert.equal(tabText(v2.tab), tabText(rendered.verse.tab), `${w2}: no push, yet it differs from Verse 1`);
        // R7 forms: every form renders; Play song plays each part's material (× its repeats), in order.
        if (seed === 0)
          for (const form of FORM_IDS) {
            const parts = formSlots(form).map((slot) => ({ section: slot.variation === "push" ? v2 : rendered[slot.section], times: timesFor(slot.variation) }));
            const bars = songBars(parts);
            const owner = songBarParts(parts);
            assert.equal(bars.length, owner.length, `${where} ${form}: bar owners`);
            let at = 0;
            parts.forEach((p, i) => {
              const own = sectionBars(p.section);
              for (let t = 0; t < p.times; t++)
                own.forEach((bar) => {
                  assert.deepEqual(bars[at], bar, `${where} ${form}: part ${i + 1} bar ${at + 1}`);
                  assert.equal(owner[at++], i);
                });
            });
            assert.equal(at, bars.length, `${where} ${form}: song length`);
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
  { name: "G verse, fast punk (v2: the progression's chords, sparse chugs)", id: "verse", key: "G", feel: "fast-punk", progressionId: "I-V-vi-IV" },
  { name: "G intro, fast punk (v2: the chorus's first two chords)", id: "intro", key: "G", feel: "fast-punk", progressionId: "I-V-vi-IV" },
  { name: "A verse, fast punk (open strings)", id: "verse", key: "A", feel: "fast-punk", progressionId: "I-V-vi-IV" },
  { name: "E breakdown (v2: vi–IV, half-time, stop)", id: "breakdown", key: "E", feel: "fast-punk", progressionId: "I-V-vi-IV" },
  { name: "D intro, half-time", id: "intro", key: "D", feel: "half-time", progressionId: "I-V-vi-IV" },
  { name: "C chorus, half-time, I-IV-V (3 chords over 4 bars)", id: "chorus", key: "C", feel: "half-time", progressionId: "I-IV-V" },
  { name: "F# verse, mid-tempo", id: "verse", key: "F#", feel: "mid-tempo", progressionId: "I-V-vi-IV" },
  { name: "D# chorus, fast punk, vi-IV-I-V (high key)", id: "chorus", key: "D#", feel: "fast-punk", progressionId: "vi-IV-I-V" },
  { name: "B chorus, mid-tempo, I-V-IV-V", id: "chorus", key: "B", feel: "mid-tempo", progressionId: "I-V-IV-V" },
  { name: "G chorus, pop strum (let ring, pushes)", id: "chorus", key: "G", feel: "pop-strum", progressionId: "I-V-vi-IV" },
  { name: "D verse, ballad (palm-muted, sparse)", id: "verse", key: "D", feel: "ballad", progressionId: "I-V-vi-IV" },
  { name: "A pre-chorus, fast punk (v2: IV–V climb into I)", id: "prechorus", key: "A", feel: "fast-punk", progressionId: "I-V-vi-IV" },
  { name: "E pre-chorus, pop strum, vi-IV-I-V (IV–V into vi)", id: "prechorus", key: "E", feel: "pop-strum", progressionId: "vi-IV-I-V" },
  { name: "C breakdown, I-IV-V (no vi: IV–V)", id: "breakdown", key: "C", feel: "fast-punk", progressionId: "I-IV-V" },
  { name: "G ending, fast punk (final hit, let ring)", id: "ending", key: "G", feel: "fast-punk", progressionId: "I-V-vi-IV" },
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

const arc = SECTION_IDS.filter((id) => id !== "solo").map((id) => `${id} ${(energySum[id]! / energyCount).toFixed(2)}`).join(", ");
console.log(`\nVoicing engine: ${renders} section renders checked, covering 12 keys × ${progressions.length} progressions × ${FEELS.length} feels × ${SECTION_IDS.length} sections × ${SEEDS} seeds (every section follows the progression), ${shiftCount} recorded position shifts, ${REFERENCES.length} reference tabs.`);
console.log(`Song plan: ${FORM_IDS.length} forms render for every key × progression × feel; Verse 2 adds its push in ${pushes} of ${energyCount} songs${pushes < energyCount ? " (the rest have no chord change to push into)" : ""}. Energy arc (mean): ${arc}; smallest chorus-over-verse lift ${lowestLift.toFixed(3)}.`);
const dist = (id: string) => ratings[id].slice(1).map((n, k) => `${k + 1}:${n}`).join(" ");
console.log(`Playability: ${hitsChecked} hits, every one labelled honestly and with a mute plan (${Object.entries(muteCounts).map(([k, v]) => `${k} ${v}`).join(", ")}); ${SHAME.entries.length} hall-of-shame tabs never reappear. Fastest change (frets/100 ms, limit ${PLAYABILITY.changes.limitPer100ms}): ${FEELS.map((f) => `${f} ${fastestByFeel[f]!.toFixed(2)}`).join(", ")}. Longest downpicked run (eighths): ${FEELS.map((f) => `${f} ${runByFeel[f]}`).join(", ")}.`);
console.log(`Grooves and riffs: ${riffRenders} Intro riff renders checked (scale, chord root, octaves, mute plans, speed, audio = tab); every stop is full-band and every accented hit in a groove with its own drums has a kick, snare or crash under it.`);
console.log(`Difficulty (1–5, renders per score): ${SECTION_IDS.filter((id) => ratings[id]).map((id) => `${id} ${dist(id)}`).join("; ")}.`);
console.log("All voicing-engine checks passed.");
