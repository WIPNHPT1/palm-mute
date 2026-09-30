// What the audio engine plays, as plain data: bars of 8 eighth-note cells. Built from exactly what
// the page shows (a progression row, a section card, or the whole song), so the sound always matches
// the tab. Pure functions, no Tone.js — lib/audio/engine.ts turns this into sound.
import { CELLS_PER_BAR, midiOf } from "@/lib/fretboard";
import type { FeelId, RenderedSection } from "@/lib/generator";
import { getFeel, libraryVoicings, patternForFeel } from "@/lib/generator";
import type { Lead } from "@/lib/melody";
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
  /** Lead notes: how they're played (on the lead voice, not the rhythm guitar). */
  expression?: {
    /** Bend: the note starts here and glides up to `notes[0]` over about an eighth. */
    bendFrom?: number;
    /** Hammer-on / pull-off: no new pick attack. */
    legato?: boolean;
    /** Slide in from the previous note. */
    slideFrom?: number;
    vibrato?: boolean;
  };
};

export type PlaybackBar = {
  /** Drum template for this bar (the Breakdown is always half-time). */
  feel: FeelId;
  cells: (Hit | null)[];
  /** Full-band stop: drums drop out from this cell on. */
  drumsStopAt?: number;
  /** false = no drums at all (Play lead only). */
  drums?: boolean;
  /** The lead guitar line, cell by cell, played over the rhythm part in `cells`. */
  lead?: (Hit | null)[];
};

/** A progression row: its chip voicings, one bar per chord, strummed with the feel's pattern. */
export function progressionBars(key: NoteName, progressionId: string, feel: FeelId): PlaybackBar[] {
  const strum = patternForFeel(feel).glyphs;
  const { letRing } = getFeel(feel);
  // Let-ring feels: each hit sounds until the next one (or the end of the bar).
  const ring = (i: number) => {
    let len = 1;
    while (letRing && i + len < strum.length && strum[i + len] === "·") len++;
    return len;
  };
  return libraryVoicings(key, progressionId).map(({ voicing }) => ({
    feel,
    cells: strum.map((g, i) =>
      g === "·"
        ? null
        : { notes: voicing.notes.map(midiOf), cells: ring(i), velocity: g === "▲" ? 0.6 : 0.9, palmMuted: feel === "fast-punk" || feel === "half-time" },
    ),
  }));
}

/** A lead's line, cell by cell, exactly as tabbed (bends, legato, slides and vibrato included). */
export function leadLane(lead: Lead, bar: number): (Hit | null)[] {
  const cells: (Hit | null)[] = Array(CELLS_PER_BAR).fill(null);
  const all = lead.notes;
  for (const n of all.filter((x) => x.bar === bar)) {
    const i = all.indexOf(n);
    const t = n.technique;
    cells[n.cell] = {
      notes: [n.midi, ...(n.double ? [n.double.midi] : [])],
      cells: n.cells,
      velocity: t?.kind === "hammer" || t?.kind === "pull" ? 0.55 : 0.85,
      palmMuted: false,
      expression: {
        ...(t?.kind === "bend" ? { bendFrom: t.fromMidi } : {}),
        ...(t?.kind === "hammer" || t?.kind === "pull" ? { legato: true } : {}),
        ...(t?.kind === "slideUp" || t?.kind === "slideDown" ? { slideFrom: all[i - 1].midi } : {}),
        ...(n.vibrato ? { vibrato: true } : {}),
      },
    };
  }
  return cells;
}

/**
 * A lead over its progression: with backing, the chords (their chip voicings, the feel's strum) and
 * drums play under it; lead only, just the line.
 */
export function leadBars(lead: Lead, feel: FeelId, backing: boolean): PlaybackBar[] {
  const strum = patternForFeel(feel).glyphs;
  const voicings = libraryVoicings(lead.inputs.key, lead.inputs.progressionId);
  return lead.chords.map((chord, b) => {
    const voicing = voicings[b % voicings.length].voicing;
    return {
      feel,
      drums: backing,
      cells: backing
        ? strum.map((g) => (g === "·" ? null : { notes: voicing.notes.map(midiOf), cells: 1, velocity: g === "▲" ? 0.4 : 0.55, palmMuted: true }))
        : Array(CELLS_PER_BAR).fill(null),
      lead: leadLane(lead, b),
    };
  });
}

/** A section card: its bars exactly as tabbed, repeated as the card says (the Verse plays twice). */
export function sectionBars(section: RenderedSection): PlaybackBar[] {
  // Lead sections: the line on the lead voice, over the progression's chords and drums.
  if (section.lead) return leadBars(section.lead, section.feel, true);
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

/** One part of the song's running order as it plays: the section (with its variation) and how many times in a row. */
export type SongPart = { section: RenderedSection; times: number };

/** The whole song in its form's running order (data/song-forms.json), played once. */
export function songBars(parts: SongPart[]): PlaybackBar[] {
  return parts.flatMap(({ section, times }) => Array.from({ length: times }, () => sectionBars(section)).flat());
}

/** The running-order index each song bar belongs to (lights the strip and cards as the song plays). */
export function songBarParts(parts: SongPart[]): number[] {
  return parts.flatMap(({ section, times }, i) => Array(sectionBars(section).length * times).fill(i));
}

