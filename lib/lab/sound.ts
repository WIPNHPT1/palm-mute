// What the Chord Lab plays (docs/chord-lab-prd.md §10.8): one fixed feel for everything, Pop Strum at its
// own tempo (150 BPM, data/feels.json), so a chord, a loop and a mood-map dot all sound the same way. The
// bars go to the app's synth guitar (lib/audio/engine.ts). Pure, no React.
import type { FeelId } from "@/lib/generator";
import { playbackBpm } from "@/lib/generator";
import type { PlaybackBar } from "@/lib/playback";

export const LAB_FEEL: FeelId = "pop-strum";
export const LAB_BPM = playbackBpm(LAB_FEEL);

const CELLS = 8;

/** One chord strummed once and left to ring for a bar. */
export function strumBars(notes: number[]): PlaybackBar[] {
  const cells: PlaybackBar["cells"] = Array(CELLS).fill(null);
  cells[0] = { notes: [...notes].sort((a, b) => a - b), cells: CELLS, velocity: 0.9, palmMuted: false };
  return [{ feel: LAB_FEEL, cells, drums: false }];
}

/** A chord's notes picked one at a time, low to high, each ringing on to the end of the bar. */
export function arpeggioBars(notes: number[]): PlaybackBar[] {
  const sorted = [...notes].sort((a, b) => a - b);
  const cells: PlaybackBar["cells"] = Array.from({ length: CELLS }, (_, i) =>
    i < sorted.length ? { notes: [sorted[i]], cells: CELLS - i, velocity: 0.8, palmMuted: false } : null,
  );
  return [{ feel: LAB_FEEL, cells, drums: false }];
}

/** A loop of chords, a bar each: eighth-note down-up strums with the feel's drums. */
export function loopBars(chords: number[][]): PlaybackBar[] {
  return chords.map((notes) => ({
    feel: LAB_FEEL,
    cells: Array.from({ length: CELLS }, (_, i) => ({ notes: [...notes].sort((a, b) => a - b), cells: 1, velocity: i % 2 ? 0.6 : 0.9, palmMuted: false })),
  }));
}
