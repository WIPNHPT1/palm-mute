// The MIDI export (docs/song-builder-prd.md §7): for songs across keys, feels, lengths and card options, the
// file reads back exactly (a round trip through a strict parser), every note sits in its lane (the guitars at
// concert pitch), the guitars and drums are exactly what the audio plays, and the markers, tempo and key are
// right. Part of `npm run verify`.
import assert from "node:assert/strict";
import { LANES, PPQ, arrange, arrangementBars, fileName, midiFile } from "@/lib/arrange";
import { drumHits } from "@/lib/drums";
import { type FeelId, type SectionInputs, FEEL_IDS, SECTION_IDS, type SectionId, playbackBpm } from "@/lib/generator";
import { notesOf, parseMidi } from "@/lib/midi";
import type { NoteName } from "@/lib/musicTheory";
import { buildSong } from "@/lib/song";

const KEYS: NoteName[] = ["A", "C", "F#", "D#"];
const LENGTHS = [150, 195, 330];
const OPTION_SETS: { name: string; options: Partial<Record<SectionId, SectionInputs["options"]>> }[] = [
  { name: "the takes' own", options: {} },
  { name: "Last chorus up a tone, Verse 2 without its push, no drums in the Breakdown", options: { chorus: { keyUp: true }, verse: { noPush: true }, breakdown: { drums: "none" } } },
];
const BAR = PPQ * 4;
let songs = 0;
let notes = 0;

for (const key of KEYS)
  for (const feel of FEEL_IDS as FeelId[])
    for (const lengthSec of LENGTHS)
      for (const set of OPTION_SETS) {
        const where = `${key} ${feel} ${lengthSec}s, ${set.name}`;
        const inputs = Object.fromEntries(
          SECTION_IDS.map((id) => [id, { key, feel, progressionId: "I-V-vi-IV", seed: 0, lead: id === "solo" ? { style: "classic", bars: 8 } : null, options: set.options[id] }]),
        ) as Record<SectionId, SectionInputs>;
        const bpm = playbackBpm(feel, 140);
        const song = buildSong(inputs, lengthSec, bpm);
        const input = { song, bpm, key, progressionId: "I-V-vi-IV", title: "Your Ex's New Place" };
        const arranged = arrange(input);
        const bytes = midiFile(input);
        assert.deepEqual(midiFile(input), bytes, `${where}: not deterministic`);
        const parsed = parseMidi(bytes);
        songs++;

        // The file: type 1, the conductor track and one track per lane, each named, with its instrument.
        assert.equal(parsed.format, 1, where);
        assert.equal(parsed.ppq, PPQ, where);
        assert.equal(parsed.tracks.length, LANES.length + 1, `${where}: tracks`);
        assert.deepEqual(parsed.tracks.slice(1).map((t) => t.name), LANES.map((l) => l.name), `${where}: track names`);
        const conductor = parsed.tracks[0].events;
        const tempo = conductor.find((e) => e.type === 0x51)!.data!;
        assert.equal((tempo[0] << 16) | (tempo[1] << 8) | tempo[2], Math.round(60_000_000 / bpm), `${where}: tempo`);
        assert.deepEqual(conductor.find((e) => e.type === 0x58)!.data, [4, 2, 24, 8], `${where}: 4/4`);
        // Markers: one per part of the running order, where it starts.
        const markers = conductor.filter((e) => e.type === 0x06);
        assert.equal(markers.length, song.parts.length, `${where}: markers`);
        let at = 0;
        song.parts.forEach((p, i) => {
          assert.equal(markers[i].tick, at * BAR, `${where}: marker ${p.slot.name}`);
          assert.ok(markers[i].text!.startsWith(p.slot.name), `${where}: marker text ${markers[i].text}`);
          at += p.section.bars.length * p.section.repeat * p.times;
        });
        assert.equal(at, song.plan.bars, `${where}: song length in bars`);

        // Round trip: every track's notes read back exactly as written; every note sits in its lane.
        arranged.tracks.forEach((t, i) => {
          const lane = LANES[i];
          const back = notesOf(parsed.tracks[i + 1]);
          const want = t.notes
            .map((n) => ({ tick: n.tick, dur: Math.max(1, n.dur), pitch: n.pitch, velocity: Math.max(1, Math.min(127, Math.round(n.velocity))) }))
            .sort((a, b) => a.tick - b.tick || a.pitch - b.pitch);
          assert.deepEqual(back, want, `${where}: ${lane.name} doesn't read back`);
          notes += back.length;
          for (const n of back) {
            assert.ok(n.tick + n.dur <= song.plan.bars * BAR, `${where}: ${lane.name} note past the end`);
            if (lane.lo !== undefined && !lane.concert) assert.ok(n.pitch >= lane.lo && n.pitch <= lane.hi!, `${where}: ${lane.name} note ${n.pitch} outside ${lane.lo}–${lane.hi}`);
          }
          const program = parsed.tracks[i + 1].events.find((e) => e.kind === "program");
          if (lane.id === "drums") assert.equal(program, undefined);
          else assert.equal(program!.value, lane.program, `${where}: ${lane.name} instrument`);
          assert.ok(parsed.tracks[i + 1].events.filter((e) => e.kind === "on").every((e) => e.channel === lane.channel), `${where}: ${lane.name} channel`);
        });

        // The guitars and drums are what the audio plays (the same playback bars, the same drum hits).
        const { bars } = arrangementBars(song);
        const track = (id: string) => notesOf(parsed.tracks[LANES.findIndex((l) => l.id === id) + 1]);
        const strums = bars.flatMap((bar, b) => bar.cells.flatMap((h, c) => (h ? h.notes.map((pitch) => `${b * BAR + (c * BAR) / bar.cells.length}:${pitch}`) : [])));
        assert.deepEqual(track("rhythmGuitar").map((n) => `${n.tick}:${n.pitch}`).sort(), strums.sort(), `${where}: rhythm guitar ≠ audio`);
        const leads = bars.flatMap((bar, b) => (bar.lead ?? []).flatMap((h, c) => (h ? h.notes.map((pitch) => `${b * BAR + c * (PPQ / 2)}:${pitch}`) : [])));
        assert.deepEqual(track("leadGuitar").map((n) => `${n.tick}:${n.pitch}`).sort(), leads.sort(), `${where}: lead guitar ≠ audio`);
        const hits = bars.flatMap((bar, b) => drumHits(bar, b).map((h) => b * BAR + h.sixteenth * (PPQ / 4)));
        assert.deepEqual(track("drums").map((n) => n.tick).sort((x, y) => x - y), hits.sort((x, y) => x - y), `${where}: drums ≠ audio`);
        if (set.options.breakdown?.drums === "none") {
          const breakdownBars = new Set(arrangementBars(song).owner.flatMap((p, b) => (song.parts[p].slot.section === "breakdown" ? [b] : [])));
          assert.ok(track("drums").every((n) => !breakdownBars.has(Math.floor(n.tick / BAR))), `${where}: drums under a Breakdown set to no drums`);
        }
        // Every part plays where it should: pads and piano in the choruses, a vocal over verses and choruses, the arp in the Last chorus.
        for (const id of ["bass", "sub", "pianoLeft", "vocal", "pianoRight", "pads", "synth"]) assert.ok(track(id).length > 0, `${where}: ${id} is empty`);
        // The Last chorus up a tone: its bass and vocal move up two semitones with it.
        if (set.options.chorus?.keyUp) assert.ok(markers.some((m) => m.text === "Last chorus (up a tone)"), `${where}: no key-change marker`);
      }

// Without drums: the drum track is left out.
{
  const inputs = Object.fromEntries(SECTION_IDS.map((id) => [id, { key: "A", feel: "fast-punk", progressionId: "I-V-vi-IV", seed: 0, lead: id === "solo" ? { style: "classic", bars: 8 } : null }])) as Record<SectionId, SectionInputs>;
  const parsed = parseMidi(midiFile({ song: buildSong(inputs, 195, 180), bpm: 180, key: "A", progressionId: "I-V-vi-IV", title: "T", drums: false }));
  assert.equal(parsed.tracks.length, LANES.length, "no drum track when drums are off");
  assert.ok(!parsed.tracks.some((t) => t.name === "Drums"));
}
assert.equal(fileName("Your Ex's New Place", "mid"), "your-exs-new-place-palm-mute.mid");

console.log(`MIDI: ${songs} songs (${KEYS.length} keys × ${FEEL_IDS.length} feels × ${LENGTHS.length} lengths × ${OPTION_SETS.length} option sets), ${notes} notes: every file reads back exactly, every note in its lane, guitars and drums = audio.`);
console.log("\nAll MIDI checks passed.");
