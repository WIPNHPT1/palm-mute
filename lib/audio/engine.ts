// Tone.js playback engine (tech-stack.md). Fully synthesized — no sample pack (open decision
// resolved to the recommended default). One shared Transport drives both the guitar strums and
// the drum sequencer, so tempo and feel template stay two independent concerns (feels.json).
import type { FeelId } from "@/lib/generator";
import { type Hit, type PlaybackBar } from "@/lib/playback";

type ToneModule = typeof import("tone");

export type PlaybackRequest = {
  /** What to play, bar by bar (lib/playback.ts builds these from what the page shows). */
  bars: PlaybackBar[];
  bpm: number;
  /** Loop until stop() (progressions, sections), or play once (the whole song). */
  loop: boolean;
  /** Called when a one-shot request reaches its end. */
  onEnd?: () => void;
  /** Called as each bar starts sounding (index into `bars`), in time with the audio. */
  onBar?: (bar: number) => void;
};

declare global {
  interface Window {
    /** The last request handed to the engine; read by the browser tests to check sound = tab. */
    __palmMuteLastPlayback?: { bars: PlaybackBar[]; bpm: number; loop: boolean } | null;
    /** Strings plucked on the Count In page (MIDI note, velocity), newest last; read by the browser tests. */
    __palmMutePlucks?: { midi: number; velocity: number }[];
  }
}

// Drum templates per feel, as 8th-note step indices within a 4/4 bar (feels.json → drumFeel).
// `crash` only sounds in the first bar of each 4-bar phrase.
const DRUMS: Record<FeelId, { kick: number[]; snare: number[]; hat: number[]; rim?: number[]; crash?: number[] }> = {
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

let tone: ToneModule | null = null;
let voices: {
  guitar: import("tone").PolySynth;
  guitarFilter: import("tone").Filter;
  kick: import("tone").MembraneSynth;
  snare: import("tone").NoiseSynth;
  hat: import("tone").MetalSynth;
  /** Ballad's rim click and Pop Strum's crash. */
  rim: import("tone").NoiseSynth;
  crash: import("tone").NoiseSynth;
  /** Dead strums: a short filtered noise "chk". */
  dead: import("tone").NoiseSynth;
  /** Lead guitar: two mono voices (melody + octave/harmony note), so each can bend on its own. */
  lead: [import("tone").MonoSynth, import("tone").MonoSynth];
  leadVibrato: import("tone").Vibrato;
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
    const rim = new T.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.035, sustain: 0 },
      volume: -10,
    }).connect(new T.Filter(2500, "bandpass").connect(master));
    const crash = new T.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.9, sustain: 0 },
      volume: -24,
    }).connect(new T.Filter(5000, "highpass").connect(master));
    const deadFilter = new T.Filter(1800, "bandpass").connect(master);
    const dead = new T.NoiseSynth({
      noise: { type: "pink" },
      envelope: { attack: 0.001, decay: 0.03, sustain: 0 },
      volume: -14,
    }).connect(deadFilter);
    // Lead: saw → vibrato → distortion → filter, louder than the rhythm part, on its own gain.
    const leadGain = new T.Gain(1.4).connect(master);
    const leadFilter = new T.Filter(3200, "lowpass").connect(leadGain);
    const leadDrive = new T.Distortion(0.5).connect(leadFilter);
    const leadVibrato = new T.Vibrato(5.5, 0).connect(leadDrive);
    const mono = () =>
      new T.MonoSynth({
        oscillator: { type: "sawtooth" },
        envelope: { attack: 0.005, decay: 0.15, sustain: 0.6, release: 0.12 },
        filterEnvelope: { attack: 0.005, decay: 0.2, sustain: 0.8, baseFrequency: 900, octaves: 2.5 },
        volume: -14,
      }).connect(leadVibrato);
    voices = { guitar, guitarFilter, kick, snare, hat, rim, crash, dead, lead: [mono(), mono()], leadVibrato };
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
    // Sixteenth-note steps: a 16-cell bar plays a cell every step, an 8-cell bar every other step.
    const STEPS = 16;
    const steps = Array.from({ length: req.bars.length * STEPS }, (_, i) => i);
    const midiToFreq = (m: number) => T.Frequency(m, "midi").toFrequency();

    sequence = new T.Sequence(
      (time, step) => {
        const barIndex = Math.floor(step / STEPS);
        const bar = req.bars[barIndex];
        const sixteenth = step % STEPS;
        const per = STEPS / bar.cells.length;
        if (sixteenth === 0 && req.onBar) {
          const onBar = req.onBar;
          T.getDraw().schedule(() => mine === generation && onBar(barIndex), time);
        }
        const cell = sixteenth % per === 0 ? sixteenth / per : -1;
        const hit = cell >= 0 ? bar.cells[cell] : null;
        if (hit?.dead) {
          v.dead.triggerAttackRelease("32n", time, hit.velocity);
        } else if (hit) {
          // Palm mute: dark and short. Open hits ring for their full length.
          v.guitarFilter.frequency.setValueAtTime(hit.palmMuted ? 900 : 2400, time);
          const cellLength = T.Time(per === 1 ? "16n" : "8n").toSeconds();
          const length = hit.palmMuted ? T.Time("32n").toSeconds() : cellLength * hit.cells;
          v.guitar.triggerAttackRelease(hit.notes.map(midiToFreq), length, time, hit.velocity);
        }
        const note = sixteenth % 2 === 0 ? bar.lead?.[sixteenth / 2] : null; // lead lines stay on eighths
        if (note) playLead(T, note, time);
        if (bar.drums === false) return; // lead only
        if (bar.drumsStopAt !== undefined && sixteenth >= bar.drumsStopAt * per) return; // full-band stop
        // A groove's own drums (in its grid), else the feel's template (in eighths).
        const own = bar.drumPattern;
        const at = own ? cell : sixteenth % 2 === 0 ? sixteenth / 2 : -1;
        if (at < 0) return;
        const drums = own ?? DRUMS[bar.feel];
        if (drums.kick?.includes(at)) v.kick.triggerAttackRelease("C1", "8n", time);
        if (drums.snare?.includes(at)) v.snare.triggerAttackRelease("16n", time);
        if (drums.hat?.includes(at)) v.hat.triggerAttackRelease("C6", "32n", time, 0.5);
        if (!own && DRUMS[bar.feel].rim?.includes(at)) v.rim.triggerAttackRelease("32n", time);
        if (own?.tom?.includes(at)) v.kick.triggerAttackRelease("G1", "16n", time, 0.7);
        if (drums.crash?.includes(at) && (own || barIndex % 4 === 0)) v.crash.triggerAttackRelease("2n", time);
      },
      steps,
      "16n",
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

/**
 * One lead note: bends start at the source pitch and glide up over about an eighth; slides glide in
 * from the previous note; hammer-ons and pull-offs re-trigger softly (no pick attack); vibrato wobbles
 * long notes.
 */
function playLead(T: ToneModule, hit: Hit, time: number) {
  const v = voices!;
  const eighth = T.Time("8n").toSeconds();
  const length = eighth * hit.cells;
  const ex = hit.expression ?? {};
  const freq = (m: number) => T.Frequency(m, "midi").toFrequency();
  v.leadVibrato.depth.setValueAtTime(ex.vibrato ? 0.12 : 0, time + (ex.vibrato ? Math.min(length * 0.35, eighth) : 0));
  hit.notes.forEach((midi, k) => {
    const synth = v.lead[k];
    if (!synth) return;
    const velocity = ex.legato ? hit.velocity * 0.6 : hit.velocity;
    const start = k === 0 && ex.bendFrom !== undefined ? ex.bendFrom : k === 0 && ex.slideFrom !== undefined ? ex.slideFrom : midi;
    synth.triggerAttackRelease(freq(start), length * 0.95, time, velocity);
    if (start !== midi) synth.frequency.linearRampToValueAtTime(freq(midi), time + (ex.bendFrom !== undefined ? eighth : eighth * 0.35));
  });
}

/**
 * Starts audio from a click or tap (browsers only allow sound after one). Resolves false if audio
 * can't start. Needed before pluckString() makes a sound, since swiping with a mouse isn't a gesture.
 */
export async function enable(): Promise<boolean> {
  try {
    await ensureTone();
    return true;
  } catch {
    return false;
  }
}

/**
 * One string plucked (the Count In strings), on the rhythm guitar voice, ringing open. `delay` in
 * seconds staggers a fast swipe into a strum. Silent (but still recorded) until enable() has run.
 */
export function pluckString(midi: number, velocity: number, delay = 0) {
  (window.__palmMutePlucks ??= []).push({ midi, velocity });
  if (!tone || !voices || tone.getContext().state !== "running") return;
  const T = tone;
  const time = T.now() + 0.01 + delay;
  voices.guitarFilter.frequency.setValueAtTime(2400, time);
  voices.guitar.triggerAttackRelease(T.Frequency(midi, "midi").toFrequency(), 1.4, time, velocity);
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
  voices?.lead.forEach((l) => l.triggerRelease());
}

export function stop() {
  generation++;
  if (typeof window !== "undefined") window.__palmMuteLastPlayback = null;
  if (tone) stopInternal(tone);
}
