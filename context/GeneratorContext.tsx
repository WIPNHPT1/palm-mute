"use client";

// App state (interaction-spec.md §1–2). Mounted in the root layout so key/feel/locks survive
// Generator ↔ Chords navigation (interaction-spec §4).
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from "react";
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
} from "@/lib/generator";
import { type LeadPart, type LeadStyle, defaultLeadStyle } from "@/lib/melody";
import type { NoteName } from "@/lib/musicTheory";
import { type PlaybackBar, progressionBars, sectionBars, songBars } from "@/lib/playback";
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
  lead: { style: LeadStyle; bars: number } | null;
};

/** A melody or solo sent from the Chords page ("Use in my song"). */
export type LeadHandoff = { part: LeadPart; style: LeadStyle; bars: number; seed: number };

export type GeneratorState = {
  key: NoteName;
  feel: FeelId;
  midTempoBpm: number;
  progressionId: string;
  sections: Record<SectionId, SectionState>;
  originalityStatus: OriginalityStatus;
  /** What's playing, if anything: `progression:<id>`, `section:<id>` or `song` (see PlayTarget). */
  playing: PlayTarget | null;
};

/** Something with a play button. Progressions and sections loop; the song plays once. */
export type PlayTarget = `progression:${string}` | `section:${SectionId}` | "song" | `custom:${string}`;

type Action =
  | { type: "setKey"; key: NoteName }
  | { type: "setFeel"; feel: FeelId }
  | { type: "setMidTempoBpm"; bpm: number }
  | { type: "generate"; seeds: Partial<Record<SectionId, number>>; progressionId: string; originality: OriginalityStatus }
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
  for (const id of SECTION_IDS) {
    const locked = getTemplate(id).lockedByDefault;
    const lead = id === "solo" ? defaultLeadStyle("solo") : null;
    sections[id] = { locked, seed: 0, frozen: locked ? { ...DEFAULTS, seed: 0, lead } : null, lead };
  }
  return {
    ...DEFAULTS,
    midTempoBpm: MID_TEMPO.default,
    sections,
    originalityStatus: "pass",
    playing: null,
  };
}

export function inputsFor(state: GeneratorState, id: SectionId): SectionInputs {
  const s = state.sections[id];
  if (s.locked && s.frozen) return s.frozen;
  return { key: state.key, feel: state.feel, progressionId: state.progressionId, seed: s.seed, lead: s.lead };
}

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
        sections[id] = { ...sections[id], seed: action.seeds[id] ?? sections[id].seed };
      }
      const progressionId = state.sections.chorus.locked ? state.progressionId : action.progressionId;
      return { ...state, sections, progressionId, originalityStatus: action.originality };
    }
    case "regenerate": {
      const s = state.sections[action.id];
      if (s.locked) return state; // locked = don't touch, full stop
      return {
        ...state,
        progressionId: action.progressionId ?? state.progressionId,
        sections: { ...state.sections, [action.id]: { ...s, seed: action.seed } },
      };
    }
    case "toggleLock": {
      const s = state.sections[action.id];
      const locked = !s.locked;
      const frozen = locked ? inputsFor(state, action.id) : null;
      return { ...state, sections: { ...state.sections, [action.id]: { ...s, locked, frozen } } };
    }
    case "setProgression":
      return { ...state, progressionId: action.progressionId };
    case "updateLocked": {
      // "Update to {key}": a locked section takes the current key (and, for the Chorus, progression),
      // keeping its own seed and feel, and stays locked.
      const s = state.sections[action.id];
      if (!s.locked || !s.frozen) return state;
      const frozen = { ...s.frozen, key: state.key, progressionId: state.progressionId };
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
        const lead = { style: action.lead.style, bars: action.lead.bars };
        const s = sections[id];
        sections[id] = {
          ...s,
          lead,
          seed: action.lead.seed,
          frozen: s.locked && s.frozen ? { ...s.frozen, key: action.key, progressionId: action.progressionId, seed: action.lead.seed, lead } : s.frozen,
        };
      }
      return { ...state, key: action.key, progressionId: action.progressionId, sections };
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
  /** Starts the target, or stops it if it's the one playing. */
  togglePlay: (target: PlayTarget) => void;
  stopPlayback: () => void;
};

const GeneratorContext = createContext<GeneratorContextValue | null>(null);

export function GeneratorProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);

  const rendered = useMemo(() => {
    const out = {} as Record<SectionId, RenderedSection>;
    for (const id of SECTION_IDS) out[id] = renderSection(id, inputsFor(state, id));
    return out;
  }, [state]);

  const generate = useCallback(() => {
    const seeds: Partial<Record<SectionId, number>> = {};
    for (const id of SECTION_IDS) {
      if (id !== "chorus" && !state.sections[id].locked) seeds[id] = nextSeed(id, inputsFor(state, id));
    }
    const progressionId = nextProgressionId(state.progressionId);
    const preview = SECTION_IDS.map((id) =>
      renderSection(id, { ...inputsFor(state, id), seed: seeds[id] ?? state.sections[id].seed }),
    );
    dispatch({ type: "generate", seeds, progressionId, originality: checkOriginality(preview) });
  }, [state]);

  const regenerateSection = useCallback(
    (id: SectionId) => {
      if (state.sections[id].locked) return;
      if (id === "chorus") {
        dispatch({ type: "regenerate", id, seed: state.sections.chorus.seed, progressionId: nextProgressionId(state.progressionId) });
      } else {
        dispatch({ type: "regenerate", id, seed: nextSeed(id, inputsFor(state, id)) });
      }
    },
    [state],
  );

  // --- Audio -----------------------------------------------------------------
  // Playback always renders from what's on screen, so it follows key, feel, progression, regenerate
  // and lock changes: whenever the bars for the playing target change, playback restarts with them.
  // Custom targets (Chords page previews) keep the bars they were started with.
  const customBars = useRef<PlaybackBar[]>([]);
  const barsFor = useCallback(
    (target: PlayTarget): PlaybackBar[] => {
      if (target.startsWith("custom:")) return customBars.current;
      if (target === "song") return songBars(SECTION_IDS.map((id) => rendered[id]));
      if (target.startsWith("section:")) return sectionBars(rendered[target.slice(8) as SectionId]);
      return progressionBars(state.key, target.slice(12), state.feel);
    },
    [rendered, state.key, state.feel],
  );

  // A token guards against a slow async start() finishing after the user already hit stop.
  const playToken = useRef(0);
  const bpm = playbackBpm(state.feel, state.midTempoBpm);
  const bpmRef = useRef(bpm);
  bpmRef.current = bpm;

  const start = useCallback(async (target: PlayTarget, bars: PlaybackBar[], loop = target !== "song") => {
    const token = ++playToken.current;
    const ok = await audio.play({
      bars,
      bpm: bpmRef.current,
      loop,
      onEnd: () => {
        if (token === playToken.current) dispatch({ type: "setPlaying", target: null });
      },
    });
    if (token !== playToken.current) return;
    if (!ok) dispatch({ type: "setPlaying", target: null });
  }, []);

  const stopPlayback = useCallback(() => {
    playToken.current++;
    audio.stop();
    dispatch({ type: "setPlaying", target: null });
  }, []);

  const togglePlay = useCallback(
    (target: PlayTarget) => {
      if (state.playing === target) return stopPlayback();
      dispatch({ type: "setPlaying", target });
      void start(target, barsFor(target));
    },
    [state.playing, barsFor, start, stopPlayback],
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
      togglePlay,
      stopPlayback,
    }),
    [state, rendered, generate, regenerateSection, togglePlay, stopPlayback, playCustom],
  );

  return <GeneratorContext.Provider value={value}>{children}</GeneratorContext.Provider>;
}

export function useGenerator(): GeneratorContextValue {
  const ctx = useContext(GeneratorContext);
  if (!ctx) throw new Error("useGenerator must be used inside <GeneratorProvider>");
  return ctx;
}
