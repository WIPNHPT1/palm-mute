// Tone.js playback engine (tech-stack.md). Fully synthesized — no sample pack (open decision
// resolved to the recommended default). One shared Transport drives both the guitar strums and
// the drum sequencer, so tempo and feel template stay two independent concerns (feels.json).
import type { FeelId } from "@/lib/generator";
import { CELLS_PER_BAR, type PlaybackBar } from "@/lib/playback";

type ToneModule = typeof import("tone");

export type PlaybackRequest = {
  /** What to play, bar by bar (lib/playback.ts builds these from what the page shows). */
  bars: PlaybackBar[];
  bpm: number;
  /** Loop until stop() (progressions, sections), or play once (the whole song). */
  loop: boolean;
  /** Called when a one-shot request reaches its end. */
  onEnd?: () => void;
};

declare global {
  interface Window {
    /** The last request handed to the engine; read by the browser tests to check sound = tab. */
    __palmMuteLastPlayback?: { bars: PlaybackBar[]; bpm: number; loop: boolean } | null;
  }
}

// Drum templates per feel, as 8th-note step indices within a 4/4 bar (feels.json → drumFeel).
const DRUMS: Record<FeelId, { kick: number[]; snare: number[]; hat: number[] }> = {
  // straight-8th hats, backbeat snare on 2 and 4, kick on 1 and the "and" of 3
  "fast-punk": { kick: [0, 5], snare: [2, 6], hat: [0, 1, 2, 3, 4, 5, 6, 7] },
  // snare moves to beat 3 only, kick on 1, hats stay busy
  "half-time": { kick: [0], snare: [4], hat: [0, 1, 2, 3, 4, 5, 6, 7] },
  // kick on 1 and 3, hats on the upbeats
  "mid-tempo": { kick: [0, 4], snare: [], hat: [1, 3, 5, 7] },
};

let tone: ToneModule | null = null;
let voices: {
  guitar: import("tone").PolySynth;
  guitarFilter: import("tone").Filter;
  kick: import("tone").MembraneSynth;
  snare: import("tone").NoiseSynth;
  hat: import("tone").MetalSynth;
} | null = null;
let sequence: import("tone").Sequence | null = null;
/** Bumped by every play() and stop(), so a play() still waiting on Tone.js can tell it was cancelled. */
let generation = 0;

async function ensureTone(): Promise<ToneModule> {
  if (!tone) tone = await import("tone");
  // Must run inside a user gesture; browsers block audio until then.
  await tone.start();
  if (!voices) {
    const T = tone;
    const master = new T.Gain(0.8).toDestination();
    const guitarFilter = new T.Filter(2400, "lowpass").connect(master);
    const drive = new T.Distortion(0.6).connect(guitarFilter);
    const guitar = new T.PolySynth(T.Synth, {
      oscillator: { type: "sawtooth" },
      envelope: { attack: 0.004, decay: 0.2, sustain: 0.35, release: 0.15 },
      volume: -16,
    }).connect(drive);
    const kick = new T.MembraneSynth({ pitchDecay: 0.03, octaves: 6, volume: -4 }).connect(master);
    const snare = new T.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.14, sustain: 0 },
      volume: -12,
    }).connect(master);
    const hat = new T.MetalSynth({
      envelope: { attack: 0.001, decay: 0.05, release: 0.01 },
      harmonicity: 5.1,
      modulationIndex: 32,
      resonance: 4000,
      octaves: 1.5,
      volume: -30,
    }).connect(master);
    voices = { guitar, guitarFilter, kick, snare, hat };
  }
  return tone;
}

/** Starts (or restarts) playback. Resolves false if audio couldn't start — never throws. */
export async function play(req: PlaybackRequest): Promise<boolean> {
  window.__palmMuteLastPlayback = { bars: req.bars, bpm: req.bpm, loop: req.loop };
  const mine = ++generation;
  try {
    const T = await ensureTone();
    if (mine !== generation) return false; // stopped (or replaced) while audio was starting
    const v = voices!;
    stopInternal(T);

    const transport = T.getTransport();
    transport.bpm.value = req.bpm;
    const steps = Array.from({ length: req.bars.length * CELLS_PER_BAR }, (_, i) => i);
    const midiToFreq = (m: number) => T.Frequency(m, "midi").toFrequency();

    sequence = new T.Sequence(
      (time, step) => {
        const bar = req.bars[Math.floor(step / CELLS_PER_BAR)];
        const cell = step % CELLS_PER_BAR;
        const hit = bar.cells[cell];
        if (hit) {
          // Palm mute: dark and short. Open hits ring for their full length.
          v.guitarFilter.frequency.setValueAtTime(hit.palmMuted ? 900 : 2400, time);
          const eighth = T.Time("8n").toSeconds();
          const length = hit.palmMuted ? T.Time("32n").toSeconds() : eighth * hit.cells;
          v.guitar.triggerAttackRelease(hit.notes.map(midiToFreq), length, time, hit.velocity);
        }
        const drums = DRUMS[bar.feel];
        if (drums.kick.includes(cell)) v.kick.triggerAttackRelease("C1", "8n", time);
        if (drums.snare.includes(cell)) v.snare.triggerAttackRelease("16n", time);
        if (drums.hat.includes(cell)) v.hat.triggerAttackRelease("C6", "32n", time, 0.5);
      },
      steps,
      "8n",
    );
    sequence.loop = req.loop;
    sequence.start(0);
    if (!req.loop && req.onEnd) {
      const onEnd = req.onEnd;
      transport.scheduleOnce((time) => T.getDraw().schedule(onEnd, time), `${req.bars.length}m`);
    }
    transport.start("+0.05");
    return true;
  } catch {
    // Autoplay restrictions or unsupported AudioContext: fail silently (interaction-spec §5).
    return false;
  }
}

/** Live tempo change without restarting (Mid-Tempo stepper). */
export function setBpm(bpm: number) {
  if (tone) tone.getTransport().bpm.value = bpm;
}

function stopInternal(T: ToneModule) {
  const transport = T.getTransport();
  transport.stop();
  transport.cancel();
  transport.position = 0;
  sequence?.dispose();
  sequence = null;
  voices?.guitar.releaseAll();
}

export function stop() {
  generation++;
  if (typeof window !== "undefined") window.__palmMuteLastPlayback = null;
  if (tone) stopInternal(tone);
}
