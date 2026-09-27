// What the audio engine plays, as plain data: bars of 8 eighth-note cells. Built from exactly what
// the page shows (a progression row, a section card, or the whole song), so the sound always matches
// the tab. Pure functions, no Tone.js — lib/audio/engine.ts turns this into sound.
import type { FeelId, Glyph, RenderedSection } from "@/lib/generator";
import { patternForFeel } from "@/lib/generator";
import { type NoteName, type ResolvedChord, OPEN_STRING_MIDI, chordMidiNotes, resolveProgression } from "@/lib/musicTheory";

export const CELLS_PER_BAR = 8;

export type Hit = {
  /** MIDI notes sounded together. */
  notes: number[];
  /** Length in eighth-note cells (palm-muted hits are cut short by the engine regardless). */
  cells: number;
  velocity: number;
  palmMuted: boolean;
};

export type PlaybackBar = {
  /** Drum template for this bar (the Breakdown is always half-time). */
  feel: FeelId;
  cells: (Hit | null)[];
};

function strumBar(notes: number[], strum: Glyph[], feel: FeelId, palmMuted: boolean): PlaybackBar {
  return {
    feel,
    cells: strum.map((g) => (g === "·" ? null : { notes, cells: 1, velocity: g === "▲" ? 0.6 : 0.9, palmMuted })),
  };
}

/** A progression row: one bar per chord, strummed with the feel's pattern. */
export function progressionBars(key: NoteName, progressionId: string, feel: FeelId): PlaybackBar[] {
  const strum = patternForFeel(feel).glyphs;
  return resolveProgression(key, progressionId).map((c) => strumBar(chordMidiNotes(c.chord), strum, feel, feel !== "mid-tempo"));
}

function rootMidi(c: ResolvedChord): number {
  return OPEN_STRING_MIDI[c.chord.rootString] + c.chord.rootFret;
}

/** A section card: one bar per tab column, strummed as its strum line shows; the Solo plays its lick. */
export function sectionBars(section: RenderedSection): PlaybackBar[] {
  if (!section.strum) {
    // Lead lick: each note starts where the tab spaces it (gaps are in eighth notes).
    const cells: (Hit | null)[] = [];
    section.lead!.forEach((n, i) => {
      const length = section.lead![i + 1] ? section.lead![i + 1].gap : 2;
      cells.push({ notes: n.midi, cells: length, velocity: 0.85, palmMuted: false });
      for (let k = 1; k < length; k++) cells.push(null);
    });
    while (cells.length % CELLS_PER_BAR) cells.push(null);
    const bars: PlaybackBar[] = [];
    for (let b = 0; b < cells.length; b += CELLS_PER_BAR) bars.push({ feel: section.feel, cells: cells.slice(b, b + CELLS_PER_BAR) });
    return bars;
  }
  // Intro: palm-muted root notes. Chorus: open and ringing. Verse/Breakdown: palm-muted unless Mid-Tempo.
  const palmMuted = section.id === "intro" || (section.id !== "chorus" && section.feel !== "mid-tempo");
  return section.chords.map((c) =>
    strumBar(section.id === "intro" ? [rootMidi(c)] : chordMidiNotes(c.chord), section.strum!, section.feel, palmMuted),
  );
}

/** The whole song, top to bottom, played once. */
export function songBars(sections: RenderedSection[]): PlaybackBar[] {
  return sections.flatMap(sectionBars);
}
