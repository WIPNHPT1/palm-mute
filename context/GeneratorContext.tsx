"use client";

// App state (interaction-spec.md §1–2). Mounted in the root layout so key/feel/locks survive
// Generator ↔ Chords navigation (interaction-spec §4).
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import * as audio from "@/lib/audio/engine";
import {
  type FeelId,
  type RenderedSection,
  type SectionId,
  type SectionInputs,
  type SectionOptions,
  SECTION_IDS,
  getTemplate,
  nextSeed,
  playbackBpm,
  renderSection,
  songThread,
} from "@/lib/generator";
import { type LeadStyle, defaultLeadStyle } from "@/lib/melody";
import type { NoteName } from "@/lib/musicTheory";
import { type PlaybackBar, type SongPart, progressionBars, sectionBars, songBarParts, songBars } from "@/lib/playback";
import type { FormSlot } from "@/lib/songPlan";
import { type SongPlan, LENGTH } from "@/lib/songLength";
import { songParts, songPlan } from "@/lib/song";
import { type Difficulty, DEFAULT_DIFFICULTY } from "@/lib/playability";
import { type PresetId, PRESETS, presetOptions } from "@/lib/presets";
import { type SharedSong, encodeSong } from "@/lib/share";
import { TITLES, titleBag } from "@/lib/titleGenerator";
import { type Fixed, bestSectionTake, bestSong } from "@/lib/critic";
import type { SongThread } from "@/lib/generator";
import { type OriginalityStatus, checkOriginality } from "@/lib/originalityCheck";

type SectionState = {
  locked: boolean;
  seed: number;
  /**
   * Inputs captured when the section was locked. Locked sections render from this snapshot, so
   * they stay frozen across key/feel changes too (open decision: "frozen once locked").
   */
  frozen: SectionInputs | null;
  /** A lead part (style and length): always for the Solo. */
  lead: { style: LeadStyle; bars: number } | null;
  /**
   * The Solo's song thread (R15, R16), taken when the Solo is written (GENERATE, its ↻, a new progression),
   * so regenerating another section never changes the Solo.
   */
  thread?: SongThread;
  /** The card's Options (rhythm, playing style, voicing, structure, drums). Empty = the take decides. */
  options: SectionOptions;
  /** The section's recent takes (seeds), oldest first, at most TAKES_KEPT; `take` is the one showing. */
  takes: number[];
  take: number;
};

/** How many takes each section remembers (‹ › on its card). */
export const TAKES_KEPT = 8;
/** A section's takes after a new one: appended, the oldest dropped past TAKES_KEPT. */
const withTake = (s: SectionState, seed: number): Pick<SectionState, "seed" | "takes" | "take"> => {
  const takes = [...s.takes, seed].slice(-TAKES_KEPT);
  return { seed, takes, take: takes.length - 1 };
};
/** A fresh history, starting from this take. */
const freshTakes = (seed: number): Pick<SectionState, "seed" | "takes" | "take"> => ({ seed, takes: [seed], take: 0 });

export type GeneratorState = {
  key: NoteName;
  feel: FeelId;
  progressionId: string;
  /**
   * How long the song should run, in seconds (the Length slider, 2:30–5:30). The form and every part's
   * repeats follow from it at the feel's tempo (lib/songLength.ts).
   */
  lengthSec: number;
  /** The song's title (the title generator's shuffle bag deals a new one on every BUILD SONG). */
  title: string;
  /** The Difficulty control (data/difficulty.json): what the Generator may write. */
  difficulty: Difficulty;
  /** The style preset the song started from, if any (data/style-presets.json). */
  preset: PresetId | null;
  /** GENERATE's song seed: the critic's best of N takes for it (data/critic.json). The page opens on song 0. */
  songSeed: number;
  sections: Record<SectionId, SectionState>;
  originalityStatus: OriginalityStatus;
  /** What's playing, if anything: `progression:<id>`, `section:<id>`, `strum` or `song` (see PlayTarget). */
  playing: PlayTarget | null;
};

/**
 * Something with a play button. Progressions and sections loop; the song plays once. `strum` is a
 * Rhythm Lane card: the current feel's strum over the Chorus progression.
 */
export type PlayTarget = `progression:${string}` | `section:${SectionId}` | "strum" | "song" | `custom:${string}`;

type Action =
  | { type: "setKey"; key: NoteName }
  | { type: "setFeel"; feel: FeelId }
  | { type: "generate"; seeds: Partial<Record<SectionId, number>>; songSeed: number; originality: OriginalityStatus; title: string }
  | { type: "setLength"; seconds: number }
  | { type: "setDifficulty"; difficulty: Difficulty }
  | { type: "selectTake"; id: SectionId; take: number }
  | { type: "loadShared"; song: SharedSong }
  | { type: "applyPreset"; preset: PresetId | null }
  | { type: "setOptions"; id: SectionId; options: SectionOptions }
  | { type: "setLead"; id: SectionId; lead: { style: LeadStyle; bars: number } | null }
  | { type: "regenerate"; id: SectionId; seed: number; progressionId?: string }
  | { type: "toggleLock"; id: SectionId }
  | { type: "setProgression"; progressionId: string }
  | { type: "updateLocked"; id: SectionId }
  | { type: "clearIntroLead" }
  | { type: "setPlaying"; target: PlayTarget | null };

const DEFAULTS = { key: "A" as NoteName, feel: "fast-punk" as FeelId, progressionId: "I-V-vi-IV" };

function initialState(): GeneratorState {
  const sections = {} as Record<SectionId, SectionState>;
  // Song 0 is the critic's best take of the default song (take 0 = every section's own best).
  const { seeds } = bestSong(DEFAULTS, 0);
  for (const id of SECTION_IDS) {
    const locked = getTemplate(id).lockedByDefault;
    const lead = id === "solo" ? defaultLeadStyle("solo") : null;
    sections[id] = { locked, ...freshTakes(seeds[id]), frozen: locked ? { ...DEFAULTS, seed: seeds[id], lead } : null, lead, options: {} };
  }
  return rethread({
    ...DEFAULTS,
    lengthSec: LENGTH.default,
    title: TITLES[0],
    difficulty: DEFAULT_DIFFICULTY,
    preset: null,
    songSeed: 0,
    sections,
    originalityStatus: "pass",
    playing: null,
  });
}

/** What a share link carries: the setup and each section's take, options, lead and lock. */
function sharedSong(state: GeneratorState): SharedSong {
  const sections = {} as SharedSong["sections"];
  for (const id of SECTION_IDS) {
    const s = state.sections[id];
    sections[id] = { seed: s.seed, lead: s.lead, options: s.options, ...(s.thread ? { thread: s.thread } : {}), locked: s.locked, frozen: s.locked ? s.frozen : null };
  }
  return {
    key: state.key,
    feel: state.feel,
    progressionId: state.progressionId,
    lengthSec: state.lengthSec,
    difficulty: state.difficulty,
    preset: state.preset,
    songSeed: state.songSeed,
    title: state.title,
    sections,
  };
}

/** Every section's inputs as the page renders them. */
export function inputsForAll(state: GeneratorState): Record<SectionId, SectionInputs> {
  return Object.fromEntries(SECTION_IDS.map((id) => [id, inputsFor(state, id)])) as Record<SectionId, SectionInputs>;
}

export function inputsFor(state: GeneratorState, id: SectionId): SectionInputs {
  const s = state.sections[id];
  if (s.locked && s.frozen) return s.frozen;
  const inputs: SectionInputs = { key: state.key, feel: state.feel, progressionId: state.progressionId, seed: s.seed, lead: s.lead, options: s.options, difficulty: state.difficulty };
  // A Generator-written Solo knows the song (R15, R16): it quotes the Intro and plays over the Chorus's chords.
  if (id === "solo" && s.thread) return { ...inputs, thread: s.thread };
  return inputs;
}

/** The Solo re-reads its song thread (when it's written, or the song's chords change); a locked Solo doesn't. */
function rethread(state: GeneratorState): GeneratorState {
  const solo = state.sections.solo;
  if (solo.locked) return state;
  return { ...state, sections: { ...state.sections, solo: { ...solo, thread: threadFor(state) } } };
}

/** The Solo's song thread from the Intro and Chorus on screen. */
function threadFor(state: GeneratorState) {
  const chorus = inputsFor(state, "chorus");
  return songThread(renderSection("intro", inputsFor(state, "intro")), renderSection("chorus", chorus), chorus.progressionId);
}


function reducer(state: GeneratorState, action: Action): GeneratorState {
  switch (action.type) {
    case "setKey":
      return { ...state, key: action.key };
    case "setFeel":
      return { ...state, feel: action.feel };
    case "generate": {
      const sections = { ...state.sections };
      for (const id of SECTION_IDS) {
        if (sections[id].locked) continue;
        // A new build starts each section's takes afresh.
        sections[id] = { ...sections[id], ...freshTakes(action.seeds[id] ?? sections[id].seed) };
      }
      return rethread({ ...state, sections, songSeed: action.songSeed, originalityStatus: action.originality, title: action.title });
    }
    case "setOptions": {
      const s = state.sections[action.id];
      if (s.locked) return state;
      return { ...state, sections: { ...state.sections, [action.id]: { ...s, options: action.options } } };
    }
    case "setLead": {
      // A lead's style or length from the card (the Solo, or the Intro as a melody); null = the Intro back to chords.
      const s = state.sections[action.id];
      if (s.locked) return state;
      const next = { ...state, sections: { ...state.sections, [action.id]: { ...s, lead: action.lead, ...(action.lead ? {} : { seed: 0 }) } } };
      return action.id === "solo" ? rethread(next) : next;
    }
    case "setDifficulty":
      return { ...state, difficulty: action.difficulty };
    case "applyPreset": {
      // "Your own": the song's own setup again (unlocked sections lose the preset's Options).
      if (!action.preset) {
        const sections = { ...state.sections };
        for (const id of SECTION_IDS) if (!sections[id].locked) sections[id] = { ...sections[id], options: {} };
        return rethread({ ...state, sections, preset: null });
      }
      const p = PRESETS[action.preset];
      const next: GeneratorState = {
        ...state,
        preset: action.preset,
        feel: p.feel,
        progressionId: p.progressionId ?? state.progressionId,
        lengthSec: p.lengthSec,
      };
      // Each unlocked section's Options for the preset, chosen for the song's new key, feel and progression.
      const sections = { ...next.sections };
      for (const id of SECTION_IDS) {
        if (sections[id].locked) continue;
        sections[id] = { ...sections[id], options: presetOptions(p, id, inputsFor(next, id)) };
      }
      return rethread({ ...next, sections });
    }
    case "setLength":
      return { ...state, lengthSec: Math.min(LENGTH.max, Math.max(LENGTH.min, action.seconds)) };
    case "regenerate": {
      const s = state.sections[action.id];
      if (s.locked) return state; // locked = don't touch, full stop
      const next = {
        ...state,
        progressionId: action.progressionId ?? state.progressionId,
        sections: { ...state.sections, [action.id]: { ...s, ...withTake(s, action.seed) } },
      };
      // Only the Solo's own ↻ re-reads its thread: regenerating another section never changes the Solo.
      return action.id === "solo" ? rethread(next) : next;
    }
    case "toggleLock": {
      const s = state.sections[action.id];
      const locked = !s.locked;
      const frozen = locked ? inputsFor(state, action.id) : null;
      const next = { ...state, sections: { ...state.sections, [action.id]: { ...s, locked, frozen } } };
      // An unlocked Solo rejoins the page's song, so it re-reads its thread.
      return action.id === "solo" && !locked ? rethread(next) : next;
    }
    case "setProgression":
      return rethread({ ...state, progressionId: action.progressionId });
    case "updateLocked": {
      // "Update to {key}": a locked section takes the current key (and, for the Chorus, progression),
      // keeping its own seed and feel, and stays locked.
      const s = state.sections[action.id];
      if (!s.locked || !s.frozen) return state;
      const frozen: SectionInputs = { ...s.frozen, key: state.key, progressionId: state.progressionId };
      // A locked Solo that knows the song re-reads its thread in the new key and progression.
      if (action.id === "solo" && frozen.thread) frozen.thread = threadFor({ ...state, sections: { ...state.sections, solo: { ...s, locked: false } } });
      return { ...state, sections: { ...state.sections, [action.id]: { ...s, frozen } } };
    }
    case "clearIntroLead": {
      // "Back to chords": the Intro returns to power chords.
      const s = state.sections.intro;
      if (s.locked) return state;
      return { ...state, sections: { ...state.sections, intro: { ...s, lead: null, ...freshTakes(0) } } };
    }
    case "selectTake": {
      // ‹ › on a card: back or forward through its recent takes.
      const s = state.sections[action.id];
      if (s.locked || action.take < 0 || action.take >= s.takes.length) return state;
      const next = { ...state, sections: { ...state.sections, [action.id]: { ...s, take: action.take, seed: s.takes[action.take] } } };
      return action.id === "solo" ? rethread(next) : next;
    }
    case "loadShared": {
      // A shared link: the whole song as it was sent (lib/share.ts has checked every field).
      const shared = action.song;
      const sections = {} as Record<SectionId, SectionState>;
      for (const id of SECTION_IDS) {
        const x = shared.sections[id];
        sections[id] = { locked: x.locked, frozen: x.frozen, lead: x.lead, options: x.options, ...(x.thread ? { thread: x.thread } : {}), ...freshTakes(x.seed) };
      }
      const next: GeneratorState = {
        ...state,
        key: shared.key,
        feel: shared.feel,
        progressionId: shared.progressionId,
        lengthSec: shared.lengthSec,
        difficulty: shared.difficulty,
        preset: shared.preset,
        songSeed: shared.songSeed,
        title: shared.title,
        sections,
      };
      // A Solo without a thread in the link (an old take) re-reads the song's.
      return shared.sections.solo.thread ? next : rethread(next);
    }
    case "setPlaying":
      return { ...state, playing: action.target };
  }
}

type GeneratorContextValue = {
  state: GeneratorState;
  rendered: Record<SectionId, RenderedSection>;
  /** The song's running order: each part's slot and what it plays (repeats reuse their section's material). */
  song: (SongPart & { slot: FormSlot })[];
  /** The length plan behind it: the form, each part's repeats, and the length in bars and seconds. */
  plan: SongPlan;
  /** The playback tempo for the page's feel. */
  bpm: number;
  setLength: (seconds: number) => void;
  setDifficulty: (difficulty: Difficulty) => void;
  /** ‹ › on a card: show another of its recent takes. */
  selectTake: (id: SectionId, take: number) => void;
  /** Open a shared song (from a "#song=…" link). */
  loadShared: (song: SharedSong) => void;
  /** The song as a link fragment, "song=…" (lib/share.ts). */
  shareFragment: () => string;
  /** Start from a style preset (or null: your own). Locked sections stay as they are. */
  applyPreset: (preset: PresetId | null) => void;
  /** A section card's Options (only that section changes). */
  setOptions: (id: SectionId, options: SectionOptions) => void;
  /** A lead's style and length from its card, or null to put the Intro back to power chords. */
  setLead: (id: SectionId, lead: { style: LeadStyle; bars: number } | null) => void;
  setKey: (key: NoteName) => void;
  setFeel: (feel: FeelId) => void;
  generate: () => void;
  regenerateSection: (id: SectionId) => void;
  toggleLock: (id: SectionId) => void;
  setProgression: (progressionId: string) => void;
  updateLocked: (id: SectionId) => void;
  clearIntroLead: () => void;
  /** Plays bars the caller built (the grooves' previews). */
  playCustom: (id: string, bars: PlaybackBar[], loop: boolean) => void;
  /** A Rhythm Lane card's play button: switches to that feel and plays its strum, or stops it. */
  playStrum: (feel: FeelId) => void;
  /** Starts the target, or stops it if it's the one playing. */
  togglePlay: (target: PlayTarget) => void;
  /** Plays the song from one part of its running order (the strip's parts). */
  playSongFrom: (part: number) => void;
  stopPlayback: () => void;
  /** The section sounding right now, if any (a section play, or wherever Play song has reached). */
  activeSection: SectionId | null;
  /** While the song plays: the running-order part sounding now. */
  activePart: number | null;
  /** Where the music is (the transport's bar count and the card cursor), or null when stopped. */
  position: Position | null;
  /** Practice settings for the transport. */
  practice: Practice;
  setSpeed: (speed: number) => void;
  setCountIn: (on: boolean) => void;
  setLoopPart: (on: boolean) => void;
};

/** Practice: tempo as a share of the song's (0.5–1), a bar of clicks first, loop the part playing. */
export type Practice = { speed: number; countIn: boolean; loopPart: boolean };
/** The song bar sounding (null for a section played on its own), and the bar of that section's tab. */
export type Position = { songBar: number | null; section: SectionId; bar: number };

const GeneratorContext = createContext<GeneratorContextValue | null>(null);

export function GeneratorProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);

  const rendered = useMemo(() => {
    const out = {} as Record<SectionId, RenderedSection>;
    for (const id of SECTION_IDS) out[id] = renderSection(id, inputsFor(state, id));
    return out;
  }, [state]);

  // The length plan (lib/songLength.ts): the form and each part's repeats for the Length slider at this tempo.
  const bpm = playbackBpm(state.feel);
  const plan = useMemo(() => songPlan(inputsForAll(state), rendered, state.lengthSec, bpm), [state, rendered, bpm]);

  // A repeat plays its section's material; a declared variation (Verse 2's push, the Last chorus up a tone)
  // re-renders it from the same inputs, so locking a section locks every place it plays (lib/song.ts).
  const song = useMemo(() => songParts(inputsForAll(state), rendered, plan), [state, rendered, plan]);

  // BUILD SONG (R18): the critic's best of N takes of the song on the chosen progression, for the next song
  // seed, and a new title. Locked sections, and parts carrying a lead line, keep their own inputs.
  const generate = useCallback(() => {
    const started = performance.now();
    const progressionId = state.progressionId;
    const songSeed = state.songSeed + 1;
    const fixed: Fixed = {};
    const current: Partial<Record<SectionId, number>> = {};
    for (const id of SECTION_IDS) {
      const s = state.sections[id];
      current[id] = s.seed;
      if (s.locked && s.frozen) fixed[id] = s.frozen;
      // The Solo takes the next seed: the new progression or Intro changes its song thread, so it's always a new
      // take, and it isn't rendered here (the critic doesn't judge lead lines).
      else if (id === "solo") fixed[id] = { key: state.key, feel: state.feel, progressionId, seed: s.seed + 1, lead: s.lead, options: s.options, difficulty: state.difficulty };
      else if (s.lead) fixed[id] = { ...inputsFor(state, id), progressionId, seed: nextSeed(id, inputsFor(state, id)) };
    }
    const options = Object.fromEntries(SECTION_IDS.map((id) => [id, state.sections[id].options]));
    const best = bestSong({ key: state.key, feel: state.feel, progressionId, difficulty: state.difficulty }, songSeed, fixed, current, undefined, options);
    const seeds: Partial<Record<SectionId, number>> = {};
    for (const id of SECTION_IDS) if (!state.sections[id].locked) seeds[id] = best.seeds[id];
    // The originality check is about chord patterns, so lead lines (the Solo, an Intro melody) aren't previewed.
    const preview = SECTION_IDS.filter((id) => id !== "solo" && !fixed[id]?.lead).map((id) =>
      renderSection(id, fixed[id] ?? { ...inputsFor(state, id), progressionId, seed: best.seeds[id] }),
    );
    // How long the critic took (e2e/critic.spec.ts holds it under the PRD's ~100 ms on a throttled CPU).
    (window as Window & { __palmMuteGenerateMs?: number }).__palmMuteGenerateMs = performance.now() - started;
    dispatch({ type: "generate", seeds, songSeed, originality: checkOriginality(preview), title: titleBag.next() });
  }, [state]);

  const regenerateSection = useCallback(
    (id: SectionId) => {
      if (state.sections[id].locked) return;
      // Every section follows the progression now (Song Engine v2), so the Chorus's ↻ rewrites its
      // rhythm and voicing like the others instead of swapping the progression under the whole song.
      // R19: the critic's best of the section's next N takes, heard in the song as it stands.
      const all = Object.fromEntries(SECTION_IDS.map((x) => [x, inputsFor(state, x)])) as Record<SectionId, SectionInputs>;
      dispatch({ type: "regenerate", id, seed: bestSectionTake(id, all) });
    },
    [state],
  );

  // --- Audio -----------------------------------------------------------------
  // Playback always renders from what's on screen, so it follows key, feel, progression, regenerate
  // and lock changes: whenever the bars for the playing target change, playback restarts with them.
  // Custom targets (groove previews) keep the bars they were started with.
  const customBars = useRef<PlaybackBar[]>([]);
  /** The running-order part Play song starts from (the strip can start it anywhere). */
  const songFrom = useRef(0);
  // Practice (the transport): tempo as a share of the song's, a bar of clicks first, and looping one part.
  const [practice, setPractice] = useState<Practice>({ speed: 1, countIn: false, loopPart: false });
  const practiceRef = useRef(practice);
  practiceRef.current = practice;
  const barsFor = useCallback(
    (target: PlayTarget): PlaybackBar[] => {
      if (target.startsWith("custom:")) return customBars.current;
      // Looping a part: the song's bars for that part alone, played round and round.
      if (target === "song") return songBars(practice.loopPart ? song.slice(songFrom.current, songFrom.current + 1) : song.slice(songFrom.current));
      if (target.startsWith("section:")) return sectionBars(rendered[target.slice(8) as SectionId]);
      if (target === "strum") return progressionBars(state.key, state.progressionId, state.feel);
      return progressionBars(state.key, target.slice(12), state.feel);
    },
    [rendered, song, state.key, state.feel, state.progressionId, practice.loopPart],
  );

  // A token guards against a slow async start() finishing after the user already hit stop.
  const playToken = useRef(0);
  const bpmRef = useRef(bpm);
  bpmRef.current = bpm * practice.speed;

  // The section card that's sounding right now (red border). A section's own play button lights its
  // card straight away; Play song moves the light card by card with the music.
  const [activeSection, setActiveSection] = useState<SectionId | null>(null);
  const [activePart, setActivePart] = useState<number | null>(null);
  /** Where the music is: the song bar sounding (from the top), and the card bar under the cursor. */
  const [position, setPosition] = useState<Position | null>(null);
  const songRef = useRef(song);
  songRef.current = song;
  const renderedRef = useRef(rendered);
  renderedRef.current = rendered;

  const start = useCallback(async (target: PlayTarget, bars: PlaybackBar[], loop = target !== "song" || practiceRef.current.loopPart) => {
    const token = ++playToken.current;
    let barParts: number[] = [];
    const from = songFrom.current;
    const parts = songRef.current;
    if (target === "song") barParts = songBarParts(practiceRef.current.loopPart ? parts.slice(from, from + 1) : parts.slice(from)).map((i) => i + from);
    // Bars before the part it starts from, so the transport can say "bar 63 of 145".
    const offset = parts.slice(0, from).reduce((a, p) => a + p.section.bars.length * p.section.repeat * p.times, 0);
    /** The card bar a sounding bar shows: its material repeats, so it's the bar within one pass of the card's tab. */
    const tabBar = (section: RenderedSection, local: number) => local % (section.lead ? section.lead.chords.length : section.bars.length);
    const light = (part: number) => {
      setActivePart(part);
      setActiveSection(parts[part].slot.section);
    };
    const onSongBar = (i: number) => {
      if (token !== playToken.current) return;
      const part = barParts[i];
      light(part);
      const first = barParts.indexOf(part);
      setPosition({ songBar: offset + i, section: parts[part].slot.section, bar: tabBar(parts[part].section, i - first) });
    };
    const sectionId = target.startsWith("section:") ? (target.slice(8) as SectionId) : null;
    const onSectionBar = (i: number) => {
      if (token !== playToken.current || !sectionId) return;
      setPosition({ songBar: null, section: sectionId, bar: tabBar(renderedRef.current[sectionId], i) });
    };
    if (target === "song") light(from);
    else {
      setActivePart(null);
      setActiveSection(target.startsWith("section:") ? (target.slice(8) as SectionId) : null);
    }
    const ok = await audio.play({
      bars,
      bpm: bpmRef.current,
      loop,
      onBar: target === "song" ? onSongBar : sectionId ? onSectionBar : undefined,
      // A count-in before the song or a section (not before previews and progressions).
      countIn: practiceRef.current.countIn && (target === "song" || !!sectionId),
      onEnd: () => {
        if (token !== playToken.current) return;
        dispatch({ type: "setPlaying", target: null });
        setActiveSection(null);
        setActivePart(null);
        setPosition(null);
      },
    });
    if (token !== playToken.current) return;
    if (!ok) {
      dispatch({ type: "setPlaying", target: null });
      setActiveSection(null);
      setActivePart(null);
      setPosition(null);
    }
  }, []);

  const stopPlayback = useCallback(() => {
    playToken.current++;
    audio.stop();
    setActiveSection(null);
    setActivePart(null);
    setPosition(null);
    dispatch({ type: "setPlaying", target: null });
  }, []);

  const togglePlay = useCallback(
    (target: PlayTarget) => {
      if (state.playing === target) return stopPlayback();
      if (target === "song") songFrom.current = 0;
      dispatch({ type: "setPlaying", target });
      void start(target, barsFor(target));
    },
    [state.playing, barsFor, start, stopPlayback],
  );

  const playSongFrom = useCallback(
    (part: number) => {
      songFrom.current = part;
      dispatch({ type: "setPlaying", target: "song" });
      void start("song", barsFor("song"));
    },
    [barsFor, start],
  );

  const playStrum = useCallback(
    (feel: FeelId) => {
      if (state.playing === "strum" && state.feel === feel) return stopPlayback();
      dispatch({ type: "setFeel", feel });
      dispatch({ type: "setPlaying", target: "strum" });
      // Start at the new feel's tempo straight away (the render that follows would otherwise catch up).
      bpmRef.current = playbackBpm(feel) * practiceRef.current.speed;
      void start("strum", progressionBars(state.key, state.progressionId, feel));
    },
    [state.playing, state.feel, state.key, state.progressionId, start, stopPlayback],
  );

  const playCustom = useCallback(
    (id: string, bars: PlaybackBar[], loop: boolean) => {
      const target = `custom:${id}` as PlayTarget;
      if (state.playing === target) return stopPlayback();
      customBars.current = bars;
      dispatch({ type: "setPlaying", target });
      void start(target, bars, loop);
    },
    [state.playing, start, stopPlayback],
  );

  const playing = state.playing;
  const playingBars = useMemo(() => (playing ? JSON.stringify(barsFor(playing)) : null), [playing, barsFor]);
  const lastBars = useRef(playingBars);
  useEffect(() => {
    const previous = lastBars.current;
    lastBars.current = playingBars;
    if (!playing || !playingBars || previous === null || previous === playingBars) return;
    void start(playing, JSON.parse(playingBars));
  }, [playing, playingBars, start]);

  // Tempo changes (Mid-Tempo stepper, practice speed) go straight to the transport, no restart.
  useEffect(() => {
    if (playing) audio.setBpm(bpm * practice.speed);
  }, [bpm, practice.speed, playing]);

  const setLoopPart = useCallback(
    (loopPart: boolean) => {
      // Looping while the song plays: loop the part sounding now.
      if (loopPart && state.playing === "song" && activePart !== null) songFrom.current = activePart;
      setPractice((p) => ({ ...p, loopPart }));
    },
    [state.playing, activePart],
  );

  // Leaving a page stops the music (there's no stop button anywhere else).
  const pathname = usePathname();
  useEffect(() => stopPlayback, [pathname, stopPlayback]);

  useEffect(() => () => audio.stop(), []);

  const value = useMemo<GeneratorContextValue>(
    () => ({
      state,
      rendered,
      song,
      plan,
      bpm,
      setLength: (seconds) => dispatch({ type: "setLength", seconds }),
      setDifficulty: (difficulty) => dispatch({ type: "setDifficulty", difficulty }),
      selectTake: (id, take) => dispatch({ type: "selectTake", id, take }),
      loadShared: (song) => dispatch({ type: "loadShared", song }),
      shareFragment: () => encodeSong(sharedSong(state)),
      applyPreset: (preset) => dispatch({ type: "applyPreset", preset }),
      setOptions: (id, options) => dispatch({ type: "setOptions", id, options }),
      setLead: (id, lead) => dispatch({ type: "setLead", id, lead }),
      setKey: (key) => dispatch({ type: "setKey", key }),
      setFeel: (feel) => dispatch({ type: "setFeel", feel }),
      generate,
      regenerateSection,
      toggleLock: (id) => dispatch({ type: "toggleLock", id }),
      setProgression: (progressionId) => dispatch({ type: "setProgression", progressionId }),
      updateLocked: (id) => dispatch({ type: "updateLocked", id }),
      clearIntroLead: () => dispatch({ type: "clearIntroLead" }),
      playCustom,
      playStrum,
      togglePlay,
      playSongFrom,
      stopPlayback,
      activeSection,
      activePart,
      position,
      practice,
      setSpeed: (speed) => setPractice((p) => ({ ...p, speed })),
      setCountIn: (countIn) => setPractice((p) => ({ ...p, countIn })),
      setLoopPart,
    }),
    [state, rendered, song, plan, bpm, position, practice, setLoopPart, generate, regenerateSection, togglePlay, playSongFrom, stopPlayback, playCustom, playStrum, activeSection, activePart],
  );

  return <GeneratorContext.Provider value={value}>{children}</GeneratorContext.Provider>;
}

export function useGenerator(): GeneratorContextValue {
  const ctx = useContext(GeneratorContext);
  if (!ctx) throw new Error("useGenerator must be used inside <GeneratorProvider>");
  return ctx;
}
