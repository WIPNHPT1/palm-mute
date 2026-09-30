// The MIDI arrangement (docs/song-builder-prd.md §7): the song as a Standard MIDI File with a track per part
// in the owner's lane table (data/midi-lanes.json) plus General MIDI drums. The guitars and drums are exactly
// what the page plays (the same playback bars and drum hits as the audio); the other parts are written from
// each bar's chord: bass on the rhythm guitar's strums, a sub under choruses and the breakdown, piano left
// hand (root and fifth), piano right hand (triads) and pads in the choruses, a guide vocal melody over the
// verses and choruses, and a synth arpeggio in the Last chorus. Every note sits inside its lane, except the
// guitars, which export at concert pitch (the owner's call). Pure, no React.
import lanesJson from "@/data/midi-lanes.json";
import { DRUM_VELOCITY, drumHits } from "@/lib/drums";
import type { SectionId } from "@/lib/generator";
import { generateLead } from "@/lib/melody";
import { type MidiNote, type MidiSong, type MidiTrack, writeMidi } from "@/lib/midi";
import { type NoteName, noteNameFor, pitchClassOf } from "@/lib/musicTheory";
import { type BarChord, type PlaybackBar, songBarParts, songBars } from "@/lib/playback";
import type { Song } from "@/lib/song";

export type LaneId = "sub" | "bass" | "pianoLeft" | "rhythmGuitar" | "vocal" | "pianoRight" | "pads" | "leadGuitar" | "synth" | "drums";
export type Lane = {
  id: LaneId;
  name: string;
  lane: string;
  lo?: number;
  hi?: number;
  concert?: boolean;
  channel: number;
  program: number;
  sections: "all" | (SectionId | "lastChorus")[];
};

export const LANES = lanesJson.lanes as Lane[];
export const PPQ = lanesJson.ppq;
const BAR = PPQ * 4;
const EIGHTH = PPQ / 2;
const DRUM_NOTES = lanesJson.drumNotes as Record<string, number>;

/** Key signature for a major key: sharps (+) or flats (−). */
const KEY_SHARPS: Record<number, number> = { 0: 0, 7: 1, 2: 2, 9: 3, 4: 4, 11: 5, 6: 6, 1: -5, 8: -4, 3: -3, 10: -2, 5: -1 };

/** The lowest pitch of pitch class `pc` at or above `lo`. */
const above = (pc: number, lo: number) => lo + ((((pc - lo) % 12) + 12) % 12);

/** A chord's triad as pitch classes: root, third (minor or major), fifth. */
const triad = (c: BarChord) => [c.rootPc, (c.rootPc + (c.minor ? 3 : 4)) % 12, (c.rootPc + 7) % 12];

/** A triad voiced close, every note at or above `lo` and within an octave of it. */
const voiced = (c: BarChord, lo: number) => triad(c).map((pc) => above(pc, lo)).sort((a, b) => a - b);

const velocity = (v: number) => Math.max(1, Math.min(127, Math.round(v * 127)));

/** Semitones → a pitch bend value (General MIDI's default range is ±2 semitones). */
const bendValue = (semitones: number) => Math.max(-8192, Math.min(8191, Math.round((8192 * semitones) / 2)));

export type ArrangeInput = {
  song: Song;
  bpm: number;
  key: NoteName;
  progressionId: string;
  title: string;
  /** Include the General MIDI drum track (the export's "Include drums"). */
  drums?: boolean;
};

/** The song's playback bars with, for each, the running-order part it belongs to. */
export function arrangementBars(song: Song): { bars: PlaybackBar[]; owner: number[] } {
  return { bars: songBars(song.parts), owner: songBarParts(song.parts) };
}

/** The arrangement as data (tracks of notes, markers, tempo, key): what `midiFile` writes. */
export function arrange({ song, bpm, key, progressionId, title, drums = true }: ArrangeInput): MidiSong {
  const { bars, owner } = arrangementBars(song);
  const notes: Record<LaneId, MidiNote[]> = { sub: [], bass: [], pianoLeft: [], rhythmGuitar: [], vocal: [], pianoRight: [], pads: [], leadGuitar: [], synth: [], drums: [] };
  const bends: { tick: number; value: number }[] = [];
  const lane = Object.fromEntries(LANES.map((l) => [l.id, l])) as Record<LaneId, Lane>;
  const plays = (id: LaneId, section: SectionId, last: boolean) => {
    const s = lane[id].sections;
    return s === "all" || s.includes(section) || (last && s.includes("lastChorus"));
  };

  // Each part's first bar, so a section's bar count restarts in every place it plays (for the vocal guide).
  const partStart: number[] = [];
  owner.forEach((p, b) => {
    if (partStart[p] === undefined) partStart[p] = b;
  });

  // The guide vocal: a hook-style melody over the progression, one per section and key, shifted by octaves
  // into the vocal lane (and a note that still sticks out moved by an octave).
  const vocalCache = new Map<string, { bar: number; cell: number; cells: number; midi: number }[][]>();
  const vocalLine = (section: SectionId, keyPc: number) => {
    const id = `${section}:${keyPc}`;
    if (!vocalCache.has(id)) {
      const lead = generateLead({ key: noteNameFor(keyPc), progressionId, part: "intro", style: "hook", bars: 8, seed: section === "chorus" ? 0 : 3 });
      const { lo, hi } = lane.vocal as Required<Pick<Lane, "lo" | "hi">>;
      const low = Math.min(...lead.notes.map((n) => n.midi));
      const high = Math.max(...lead.notes.map((n) => n.midi));
      let shift = Math.ceil((lo - low) / 12) * 12;
      while (high + shift > hi && low + shift - 12 >= lo) shift -= 12;
      const fit = (m: number) => {
        let x = m + shift;
        while (x > hi) x -= 12;
        while (x < lo) x += 12;
        return x;
      };
      const byBar = lead.chords.map((_, b) => lead.notes.filter((n) => n.bar === b).map((n) => ({ bar: b, cell: n.cell, cells: n.cells, midi: fit(n.midi) })));
      vocalCache.set(id, byBar);
    }
    return vocalCache.get(id)!;
  };

  bars.forEach((bar, b) => {
    const part = song.parts[owner[b]];
    const section = part.slot.section;
    const last = part.slot.name === "Last chorus";
    const start = b * BAR;
    const cellTicks = BAR / bar.cells.length;
    const chord = bar.chord;

    // Rhythm guitar: every strum as the audio plays it, at concert pitch.
    bar.cells.forEach((hit, c) => {
      if (!hit) return;
      const tick = start + c * cellTicks;
      const dur = hit.dead ? 30 : hit.palmMuted ? Math.max(30, cellTicks / 2) : hit.cells * cellTicks - 8;
      for (const pitch of hit.notes) notes.rhythmGuitar.push({ tick, dur, pitch, velocity: hit.dead ? 40 : velocity(hit.velocity) });
      // Bass: the chord's root on every strum (not the dead ones), as long as the strum.
      if (chord && !hit.dead && plays("bass", section, last)) notes.bass.push({ tick, dur, pitch: above(chord.rootPc, lane.bass.lo!), velocity: velocity(hit.velocity * 0.95) });
    });

    // Lead guitar: the lead line, at concert pitch, with its bends as pitch bends.
    bar.lead?.forEach((hit, c) => {
      if (!hit) return;
      const tick = start + c * EIGHTH;
      const dur = hit.cells * EIGHTH - 8;
      hit.notes.forEach((pitch) => notes.leadGuitar.push({ tick, dur, pitch, velocity: velocity(hit.velocity) }));
      const from = hit.expression?.bendFrom;
      if (from !== undefined) {
        const semis = from - hit.notes[0];
        bends.push({ tick, value: bendValue(semis) }, { tick: tick + 40, value: bendValue((semis * 2) / 3) }, { tick: tick + 80, value: bendValue(semis / 3) }, { tick: tick + 120, value: 0 });
      }
    });

    if (chord) {
      // Sub: the root, held for the bar, under choruses and the breakdown.
      if (plays("sub", section, last)) notes.sub.push({ tick: start, dur: BAR - 10, pitch: above(chord.rootPc, lane.sub.lo!), velocity: 90 });
      // Piano left hand: root and fifth, held (the fifth above, or below when above would leave the lane).
      if (plays("pianoLeft", section, last)) {
        const root = above(chord.rootPc, lane.pianoLeft.lo!);
        const fifth = root + 7 <= lane.pianoLeft.hi! ? root + 7 : root - 5;
        for (const pitch of [root, fifth]) notes.pianoLeft.push({ tick: start, dur: BAR - 10, pitch, velocity: 70 });
      }
      // Piano right hand: the triad on every beat.
      if (plays("pianoRight", section, last))
        for (let beat = 0; beat < 4; beat++)
          for (const pitch of voiced(chord, lane.pianoRight.lo!)) notes.pianoRight.push({ tick: start + beat * PPQ, dur: PPQ * 0.8, pitch, velocity: beat === 0 ? 72 : 62 });
      // Pads: the triad, held for the bar.
      if (plays("pads", section, last)) for (const pitch of voiced(chord, lane.pads.lo!)) notes.pads.push({ tick: start, dur: BAR - 10, pitch, velocity: 48 });
      // Synth arpeggio (the Last chorus): the triad up and back in eighths.
      if (plays("synth", section, last)) {
        const up = voiced(chord, lane.synth.lo!);
        if (up[0] + 12 <= lane.synth.hi!) up.push(up[0] + 12);
        const seq = [...up, ...up.slice(1, -1).reverse()];
        for (let e = 0; e < 8; e++) notes.synth.push({ tick: start + e * EIGHTH, dur: EIGHTH - 10, pitch: seq[e % seq.length], velocity: 58 });
      }
      // Guide vocal: the section's melody, bar for bar, restarting where each part starts.
      if (plays("vocal", section, last)) {
        const line = vocalLine(section, chord.keyPc);
        for (const n of line[(b - partStart[owner[b]]) % line.length]) notes.vocal.push({ tick: start + n.cell * EIGHTH, dur: n.cells * EIGHTH - 10, pitch: n.midi, velocity: 80 });
      }
    }

    // Drums: exactly the hits the audio plays.
    if (drums) for (const h of drumHits(bar, b)) notes.drums.push({ tick: start + h.sixteenth * (PPQ / 4), dur: 60, pitch: DRUM_NOTES[h.drum], velocity: velocity(DRUM_VELOCITY[h.drum] * 0.86) });
  });

  const tracks: MidiTrack[] = LANES.filter((l) => l.id !== "drums" || drums).map((l) => ({
    name: l.name,
    channel: l.channel,
    ...(l.id === "drums" ? {} : { program: l.program }),
    notes: notes[l.id],
    ...(l.id === "leadGuitar" ? { bends } : {}),
  }));
  // A section marker where each part starts ("Verse 2", "Last chorus").
  const markers = song.parts.map((p, i) => ({ tick: partStart[i] * BAR, text: p.slot.variation === "keyUp" ? `${p.slot.name} (up a tone)` : p.slot.name }));
  return { ppq: PPQ, bpm, keySharps: KEY_SHARPS[pitchClassOf(key)], title, markers, tracks };
}

/** The .mid file itself. */
export function midiFile(input: ArrangeInput): Uint8Array {
  return writeMidi(arrange(input));
}

/** "your-exs-new-place-palm-mute.mid" */
export function fileName(title: string, ext: string): string {
  const slug = title
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${slug || "song"}-palm-mute.${ext}`;
}
