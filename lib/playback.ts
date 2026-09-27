// What the audio engine plays, as plain data: bars of 8 eighth-note cells. Built from exactly what
// the page shows (a progression row, a section card, or the whole song), so the sound always matches
// the tab. Pure functions, no Tone.js — lib/audio/engine.ts turns this into sound.
import { CELLS_PER_BAR, midiOf } from "@/lib/fretboard";
import type { FeelId, RenderedSection } from "@/lib/generator";
import { libraryVoicings, patternForFeel } from "@/lib/generator";
import type { NoteName } from "@/lib/musicTheory";

export { CELLS_PER_BAR };

export type Hit = {
  /** MIDI notes sounded together (`open[string] + fret` of the tabbed notes). */
  notes: number[];
  /** Length in eighth-note cells (palm-muted hits are cut short by the engine regardless). */
  cells: number;
  velocity: number;
  palmMuted: boolean;
  /** Dead strum: a percussive click, no pitch. */
  dead?: boolean;
};

export type PlaybackBar = {
  /** Drum template for this bar (the Breakdown is always half-time). */
  feel: FeelId;
  cells: (Hit | null)[];
  /** Full-band stop: drums drop out from this cell on. */
  drumsStopAt?: number;
};

/** A progression row: its chip voicings, one bar per chord, strummed with the feel's pattern. */
export function progressionBars(key: NoteName, progressionId: string, feel: FeelId): PlaybackBar[] {
  const strum = patternForFeel(feel).glyphs;
  return libraryVoicings(key, progressionId).map(({ voicing }) => ({
    feel,
    cells: strum.map((g) =>
      g === "·" ? null : { notes: voicing.notes.map(midiOf), cells: 1, velocity: g === "▲" ? 0.6 : 0.9, palmMuted: feel !== "mid-tempo" },
    ),
  }));
}

/** A section card: its bars exactly as tabbed, repeated as the card says (the Verse plays twice). */
export function sectionBars(section: RenderedSection): PlaybackBar[] {
  const bars: PlaybackBar[] = section.bars.map((bar) => ({
    feel: section.feel,
    cells: bar.cells.map((ev) =>
      ev
        ? {
            notes: ev.notes.map(midiOf),
            cells: ev.cells,
            velocity: ev.kind === "dead" ? 0.5 : ev.accent ? 1 : ev.up ? 0.6 : 0.8,
            palmMuted: ev.palmMuted,
            ...(ev.kind === "dead" ? { dead: true } : {}),
          }
        : null,
    ),
    ...(bar.stopAt !== undefined ? { drumsStopAt: bar.stopAt + 1 } : {}),
  }));
  return Array.from({ length: section.repeat }, () => bars).flat();
}

/** The whole song, top to bottom, played once. */
export function songBars(sections: RenderedSection[]): PlaybackBar[] {
  return sections.flatMap(sectionBars);
}

