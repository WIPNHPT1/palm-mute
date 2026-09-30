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
  MID_TEMPO,
  SECTION_IDS,
  getTemplate,
  nextProgressionId,
  nextSeed,
  playbackBpm,
  renderSection,
  songThread,
} from "@/lib/generator";
import { type LeadPart, type LeadStyle, defaultLeadStyle } from "@/lib/melody";
import type { NoteName } from "@/lib/musicTheory";
import { type PlaybackBar, type SongPart, progressionBars, sectionBars, songBarParts, songBars } from "@/lib/playback";
import { type FormId, type FormSlot, DEFAULT_FORM, formSlots, timesFor } from "@/lib/songPlan";
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
  /** A lead part (style and length): always for the Solo; for the Intro once the Chords page sends a melody. */
  lead: { style: LeadStyle; bars: number; sent?: boolean } | null;
  /**
   * The Solo's song thread (R15, R16), taken when the Solo is written (GENERATE, its ↻, a new progression),
   * so regenerating another section never changes the Solo.
   */
  thread?: SongThread;
};

/** A melody or solo sent from the Chords page ("Use in my song"). */
export type LeadHandoff = { part: LeadPart; style: LeadStyle; bars: number; seed: number };

export type GeneratorState = {
  key: NoteName;
  feel: FeelId;
  midTempoBpm: number;
  progressionId: string;
  /** The song's form (data/song-forms.json): its running order. No control for it yet (PRD R22, Phase 6). */
  form: FormId;
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
  | { type: "setMidTempoBpm"; bpm: number }
  | { type: "generate"; seeds: Partial<Record<SectionId, number>>; progressionId: string; songSeed: number; originality: OriginalityStatus }
  | { type: "regenerate"; id: SectionId; seed: number; progressionId?: string }
  | { type: "toggleLock"; id: SectionId }
  | { type: "setProgression"; progressionId: string }
  | { type: "updateLocked"; id: SectionId }
  | { type: "useInSong"; key: NoteName; progressionId: string; lead?: LeadHandoff }
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
    sections[id] = { locked, seed: seeds[id], frozen: locked ? { ...DEFAULTS, seed: seeds[id], lead } : null, lead };
  }
  return rethread({
    ...DEFAULTS,
    form: DEFAULT_FORM,
    songSeed: 0,
    midTempoBpm: MID_TEMPO.default,
    sections,
    originalityStatus: "pass",
    playing: null,
  });
}

export function inputsFor(state: GeneratorState, id: SectionId): SectionInputs {
  const s = state.sections[id];
  if (s.locked && s.frozen) return s.frozen;
  const inputs: SectionInputs = { key: state.key, feel: state.feel, progressionId: state.progressionId, seed: s.seed, lead: s.lead };
  // A Generator-written Solo knows the song (R15, R16): it quotes the Intro and plays over the Chorus's chords.
  if (id === "solo" && !s.lead?.sent && s.thread) return { ...inputs, thread: s.thread };
  return inputs;
}

/** The Solo re-reads its song thread (when it's written, or the song's chords change); a sent or locked Solo doesn't. */
function rethread(state: GeneratorState): GeneratorState {
  const solo = state.sections.solo;
  if (solo.locked || solo.lead?.sent) return state;
  return { ...state, sections: { ...state.sections, solo: { ...solo, thread: threadFor(state) } } };
}

/** The Solo's song thread from the Intro and Chorus on screen. */
function threadFor(state: GeneratorState) {
  const chorus = inputsFor(state, "chorus");
  return songThread(renderSection("intro", inputsFor(state, "intro")), renderSection("chorus", chorus), chorus.progressionId);
}

/** A section's lead after the Generator writes a new take of it: its own now, no longer the Chords page's. */
const ownLead = (lead: SectionState["lead"]) => (lead?.sent ? { style: lead.style, bars: lead.bars } : lead);

function reducer(state: GeneratorState, action: Action): GeneratorState {
  switch (action.type) {
    case "setKey":
      return { ...state, key: action.key };
    case "setFeel":
      return { ...state, feel: action.feel };
    case "setMidTempoBpm":
      return { ...state, midTempoBpm: Math.min(MID_TEMPO.max, Math.max(MID_TEMPO.min, action.bpm)) };
    case "generate": {
      const sections = { ...state.sections };
      for (const id of SECTION_IDS) {
        if (sections[id].locked) continue;
        sections[id] = { ...sections[id], seed: action.seeds[id] ?? sections[id].seed, lead: ownLead(sections[id].lead) };
      }
      return rethread({ ...state, sections, progressionId: action.progressionId, songSeed: action.songSeed, originalityStatus: action.originality });
    }
    case "regenerate": {
      const s = state.sections[action.id];
      if (s.locked) return state; // locked = don't touch, full stop
      const next = {
        ...state,
        progressionId: action.progressionId ?? state.progressionId,
        sections: { ...state.sections, [action.id]: { ...s, seed: action.seed, lead: ownLead(s.lead) } },
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
    case "useInSong": {
      // Chords page → Generator: the key, the progression as the Chorus, and optionally a melody for the
      // Intro or a solo for the Solo. An explicit hand-off, so locked sections take it too (and stay locked).
      const sections = { ...state.sections };
      const chorus = sections.chorus;
      if (chorus.locked && chorus.frozen) sections.chorus = { ...chorus, frozen: { ...chorus.frozen, key: action.key, progressionId: action.progressionId } };
      if (action.lead) {
        const id = action.lead.part as SectionId;
        // Sent from the Chords page: it plays exactly as previewed there (no song thread).
        const lead = { style: action.lead.style, bars: action.lead.bars, sent: true };
        const s = sections[id];
        sections[id] = {
          ...s,
          lead,
          seed: action.lead.seed,
          frozen: s.locked && s.frozen ? { ...s.frozen, key: action.key, progressionId: action.progressionId, seed: action.lead.seed, lead } : s.frozen,
        };
      }
      return rethread({ ...state, key: action.key, progressionId: action.progressionId, sections });
    }
    case "clearIntroLead": {
      // "Back to chords": the Intro returns to power chords.
      const s = state.sections.intro;
      if (s.locked) return state;
      return { ...state, sections: { ...state.sections, intro: { ...s, lead: null, seed: 0 } } };
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
  setKey: (key: NoteName) => void;
  setFeel: (feel: FeelId) => void;
  setMidTempoBpm: (bpm: number) => void;
  generate: () => void;
  regenerateSection: (id: SectionId) => void;
  toggleLock: (id: SectionId) => void;
  setProgression: (progressionId: string) => void;
  updateLocked: (id: SectionId) => void;
  sendToSong: (key: NoteName, progressionId: string, lead?: LeadHandoff) => void;
  clearIntroLead: () => void;
  /** Plays bars the caller built (the Chords page's melody and solo previews). */
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
};

const GeneratorContext = createContext<GeneratorContextValue | null>(null);

export function GeneratorProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);

  const rendered = useMemo(() => {
    const out = {} as Record<SectionId, RenderedSection>;
    for (const id of SECTION_IDS) out[id] = renderSection(id, inputsFor(state, id));
    return out;
  }, [state]);

  // A repeat plays its section's material; a declared variation (Verse 2's push) re-renders it from the
  // same inputs, so locking a section locks every place it plays.
  const song = useMemo(
    () =>
      formSlots(state.form).map((slot) => ({
        slot,
        section: slot.variation === "push" ? renderSection(slot.section, inputsFor(state, slot.section), "push") : rendered[slot.section],
        times: timesFor(slot.variation),
      })),
    [state, rendered],
  );

  // GENERATE (R18): a new progression (unless the Chorus is locked), then the critic's best of N takes of the
  // song for the next song seed. Locked sections, and parts carrying a lead line, keep their own inputs.
  const generate = useCallback(() => {
    const started = performance.now();
    const progressionId = state.sections.chorus.locked ? state.progressionId : nextProgressionId(state.progressionId);
    const songSeed = state.songSeed + 1;
    const fixed: Fixed = {};
    const current: Partial<Record<SectionId, number>> = {};
    for (const id of SECTION_IDS) {
      const s = state.sections[id];
      current[id] = s.seed;
      if (s.locked && s.frozen) fixed[id] = s.frozen;
      // The Solo takes the next seed: the new progression or Intro changes its song thread, so it's always a new
      // take, and it isn't rendered here (the critic doesn't judge lead lines).
      else if (id === "solo") fixed[id] = { key: state.key, feel: state.feel, progressionId, seed: s.seed + 1, lead: s.lead };
      else if (s.lead) fixed[id] = { ...inputsFor(state, id), progressionId, seed: nextSeed(id, inputsFor(state, id)) };
    }
    const best = bestSong({ key: state.key, feel: state.feel, progressionId }, songSeed, fixed, current);
    const seeds: Partial<Record<SectionId, number>> = {};
    for (const id of SECTION_IDS) if (!state.sections[id].locked) seeds[id] = best.seeds[id];
    // The originality check is about chord patterns, so lead lines (the Solo, an Intro melody) aren't previewed.
    const preview = SECTION_IDS.filter((id) => id !== "solo" && !fixed[id]?.lead).map((id) =>
      renderSection(id, fixed[id] ?? { ...inputsFor(state, id), progressionId, seed: best.seeds[id] }),
    );
    // How long the critic took (e2e/critic.spec.ts holds it under the PRD's ~100 ms on a throttled CPU).
    (window as Window & { __palmMuteGenerateMs?: number }).__palmMuteGenerateMs = performance.now() - started;
    dispatch({ type: "generate", seeds, progressionId, songSeed, originality: checkOriginality(preview) });
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
  // Custom targets (Chords page previews) keep the bars they were started with.
  const customBars = useRef<PlaybackBar[]>([]);
  /** The running-order part Play song starts from (the strip can start it anywhere). */
  const songFrom = useRef(0);
  const barsFor = useCallback(
    (target: PlayTarget): PlaybackBar[] => {
      if (target.startsWith("custom:")) return customBars.current;
      if (target === "song") return songBars(song.slice(songFrom.current));
      if (target.startsWith("section:")) return sectionBars(rendered[target.slice(8) as SectionId]);
      if (target === "strum") return progressionBars(state.key, state.progressionId, state.feel);
      return progressionBars(state.key, target.slice(12), state.feel);
    },
    [rendered, song, state.key, state.feel, state.progressionId],
  );

  // A token guards against a slow async start() finishing after the user already hit stop.
  const playToken = useRef(0);
  const bpm = playbackBpm(state.feel, state.midTempoBpm);
  const bpmRef = useRef(bpm);
  bpmRef.current = bpm;

  // The section card that's sounding right now (red border). A section's own play button lights its
  // card straight away; Play song moves the light card by card with the music.
  const [activeSection, setActiveSection] = useState<SectionId | null>(null);
  const [activePart, setActivePart] = useState<number | null>(null);
  const songRef = useRef(song);
  songRef.current = song;

  const start = useCallback(async (target: PlayTarget, bars: PlaybackBar[], loop = target !== "song") => {
    const token = ++playToken.current;
    let barParts: number[] = [];
    const from = songFrom.current;
    if (target === "song") barParts = songBarParts(songRef.current.slice(from)).map((i) => i + from);
    const light = (part: number) => {
      setActivePart(part);
      setActiveSection(songRef.current[part].slot.section);
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
      onBar: target === "song" ? (i) => token === playToken.current && light(barParts[i]) : undefined,
      onEnd: () => {
        if (token !== playToken.current) return;
        dispatch({ type: "setPlaying", target: null });
        setActiveSection(null);
        setActivePart(null);
      },
    });
    if (token !== playToken.current) return;
    if (!ok) {
      dispatch({ type: "setPlaying", target: null });
      setActiveSection(null);
      setActivePart(null);
    }
  }, []);

  const stopPlayback = useCallback(() => {
    playToken.current++;
    audio.stop();
    setActiveSection(null);
    setActivePart(null);
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
      bpmRef.current = playbackBpm(feel, state.midTempoBpm);
      void start("strum", progressionBars(state.key, state.progressionId, feel));
    },
    [state.playing, state.feel, state.midTempoBpm, state.key, state.progressionId, start, stopPlayback],
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

  // Tempo changes (Mid-Tempo stepper) go straight to the transport, no restart.
  useEffect(() => {
    if (playing) audio.setBpm(bpm);
  }, [bpm, playing]);

  // Leaving a page stops the music (there's no stop button anywhere else).
  const pathname = usePathname();
  useEffect(() => stopPlayback, [pathname, stopPlayback]);

  useEffect(() => () => audio.stop(), []);

  const value = useMemo<GeneratorContextValue>(
    () => ({
      state,
      rendered,
      song,
      setKey: (key) => dispatch({ type: "setKey", key }),
      setFeel: (feel) => dispatch({ type: "setFeel", feel }),
      setMidTempoBpm: (bpm) => dispatch({ type: "setMidTempoBpm", bpm }),
      generate,
      regenerateSection,
      toggleLock: (id) => dispatch({ type: "toggleLock", id }),
      setProgression: (progressionId) => dispatch({ type: "setProgression", progressionId }),
      updateLocked: (id) => dispatch({ type: "updateLocked", id }),
      sendToSong: (key, progressionId, lead) => dispatch({ type: "useInSong", key, progressionId, lead }),
      clearIntroLead: () => dispatch({ type: "clearIntroLead" }),
      playCustom,
      playStrum,
      togglePlay,
      playSongFrom,
      stopPlayback,
      activeSection,
      activePart,
    }),
    [state, rendered, song, generate, regenerateSection, togglePlay, playSongFrom, stopPlayback, playCustom, playStrum, activeSection, activePart],
  );

  return <GeneratorContext.Provider value={value}>{children}</GeneratorContext.Provider>;
}

export function useGenerator(): GeneratorContextValue {
  const ctx = useContext(GeneratorContext);
  if (!ctx) throw new Error("useGenerator must be used inside <GeneratorProvider>");
  return ctx;
}
