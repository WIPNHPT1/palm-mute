// The drums under each bar, as plain data: which drum sounds on which sixteenth. The audio engine
// (lib/audio/engine.ts) plays these and the MIDI export (lib/arrange.ts) writes them, so the file and the
// sound can't disagree. Pure, no Tone.js.
import type { FeelId } from "@/lib/generator";
import type { PlaybackBar } from "@/lib/playback";

export type Drum = "kick" | "snare" | "hat" | "rim" | "tom" | "crash";

// Drum templates per feel, as 8th-note step indices within a 4/4 bar (feels.json → drumFeel).
// `crash` only sounds in the first bar of each 4-bar phrase.
export const DRUM_TEMPLATES: Record<FeelId, { kick: number[]; snare: number[]; hat: number[]; rim?: number[]; crash?: number[] }> = {
  // straight-8th hats, backbeat snare on 2 and 4, kick on 1 and the "and" of 3
  "fast-punk": { kick: [0, 5], snare: [2, 6], hat: [0, 1, 2, 3, 4, 5, 6, 7] },
  // snare moves to beat 3 only, kick on 1, hats stay busy
  "half-time": { kick: [0], snare: [4], hat: [0, 1, 2, 3, 4, 5, 6, 7] },
  // kick on 1 and 3, hats on the upbeats
  "mid-tempo": { kick: [0, 4], snare: [], hat: [1, 3, 5, 7] },
  // driving 8th hats, backbeat on 2 and 4, kick on 1, 3 and the "and" of 3, crash on the phrase
  "pop-strum": { kick: [0, 4, 5], snare: [2, 6], hat: [0, 1, 2, 3, 4, 5, 6, 7], crash: [0] },
  // sparse: kick on 1 and the "and" of 3, rim click on 3, quarter-note hats
  ballad: { kick: [0, 5], snare: [], hat: [0, 2, 4, 6], rim: [4] },
};

/** How loud each drum plays (0–1), as the engine voices them. */
export const DRUM_VELOCITY: Record<Drum, number> = { kick: 1, snare: 1, hat: 0.5, rim: 1, tom: 0.7, crash: 1 };

/**
 * Every drum hit in a bar, by sixteenth (0–15). `barIndex` is the bar's place in what's playing (the feel's
 * crash marks every fourth bar). A groove's own drums sit in its bar's grid; the feel's template is in eighths.
 * A full-band stop silences everything from its cell; `drums: false` (a lead played alone, or the card's
 * Drums option) has none.
 */
export function drumHits(bar: PlaybackBar, barIndex: number): { sixteenth: number; drum: Drum }[] {
  if (bar.drums === false) return [];
  const per = 16 / bar.cells.length;
  const own = bar.drumPattern;
  const out: { sixteenth: number; drum: Drum }[] = [];
  for (let sixteenth = 0; sixteenth < 16; sixteenth++) {
    if (bar.drumsStopAt !== undefined && sixteenth >= bar.drumsStopAt * per) break;
    const cell = sixteenth % per === 0 ? sixteenth / per : -1;
    const at = own ? cell : sixteenth % 2 === 0 ? sixteenth / 2 : -1;
    if (at < 0) continue;
    const drums = own ?? DRUM_TEMPLATES[bar.feel];
    if (drums.kick?.includes(at)) out.push({ sixteenth, drum: "kick" });
    if (drums.snare?.includes(at)) out.push({ sixteenth, drum: "snare" });
    if (drums.hat?.includes(at)) out.push({ sixteenth, drum: "hat" });
    if (!own && DRUM_TEMPLATES[bar.feel].rim?.includes(at)) out.push({ sixteenth, drum: "rim" });
    if (own?.tom?.includes(at)) out.push({ sixteenth, drum: "tom" });
    if (drums.crash?.includes(at) && (own || barIndex % 4 === 0)) out.push({ sixteenth, drum: "crash" });
  }
  return out;
}
