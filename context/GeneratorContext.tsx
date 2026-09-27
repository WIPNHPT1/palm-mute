"use client";

// App state (interaction-spec.md §1–2). Mounted in the root layout so key/feel/locks survive
// Generator ↔ Chords navigation (interaction-spec §4).
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
  patternForFeel,
  playbackBpm,
  renderSection,
} from "@/lib/generator";
import { type NoteName, chordMidiNotes, resolveProgression } from "@/lib/musicTheory";
import { type OriginalityStatus, checkOriginality } from "@/lib/originalityCheck";

type SectionState = {
  locked: boolean;
  seed: number;
  /**
   * Inputs captured when the section was locked. Locked sections render from this snapshot, so
   * they stay frozen across key/feel changes too (open decision: "frozen once locked").
   */
  frozen: SectionInputs | null;
};

export type GeneratorState = {
  key: NoteName;
  feel: FeelId;
  midTempoBpm: number;
  progressionId: string;
  sections: Record<SectionId, SectionState>;
  originalityStatus: OriginalityStatus;
  /** Progression currently looping in the audio engine, if any. */
  playingProgressionId: string | null;
};

type Action =
  | { type: "setKey"; key: NoteName }
  | { type: "setFeel"; feel: FeelId }
  | { type: "setMidTempoBpm"; bpm: number }
  | { type: "generate"; seeds: Partial<Record<SectionId, number>>; progressionId: string; originality: OriginalityStatus }
  | { type: "regenerate"; id: SectionId; seed: number; progressionId?: string }
  | { type: "toggleLock"; id: SectionId }
  | { type: "setPlaying"; progressionId: string | null };

const DEFAULTS = { key: "A" as NoteName, feel: "fast-punk" as FeelId, progressionId: "I-V-vi-IV" };

function initialState(): GeneratorState {
  const sections = {} as Record<SectionId, SectionState>;
  for (const id of SECTION_IDS) {
    const locked = getTemplate(id).lockedByDefault;
    sections[id] = { locked, seed: 0, frozen: locked ? { ...DEFAULTS, seed: 0 } : null };
  }
  return {
    ...DEFAULTS,
    midTempoBpm: MID_TEMPO.default,
    sections,
    originalityStatus: "pass",
    playingProgressionId: null,
  };
}

export function inputsFor(state: GeneratorState, id: SectionId): SectionInputs {
  const s = state.sections[id];
  if (s.locked && s.frozen) return s.frozen;
  return { key: state.key, feel: state.feel, progressionId: state.progressionId, seed: s.seed };
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
    case "setPlaying":
      return { ...state, playingProgressionId: action.progressionId };
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
  togglePlay: (progressionId: string) => void;
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
  // A token guards against a slow async start() finishing after the user already hit stop.
  const playToken = useRef(0);

  const startPlayback = useCallback(async (progressionId: string, key: NoteName, feel: FeelId, midTempoBpm: number) => {
    const token = ++playToken.current;
    const ok = await audio.play({
      chords: resolveProgression(key, progressionId).map((c) => chordMidiNotes(c.chord)),
      strum: patternForFeel(feel).glyphs,
      feel,
      bpm: playbackBpm(feel, midTempoBpm),
      palmMuted: feel !== "mid-tempo",
    });
    if (token !== playToken.current) return;
    if (!ok) dispatch({ type: "setPlaying", progressionId: null });
  }, []);

  const togglePlay = useCallback(
    (progressionId: string) => {
      if (state.playingProgressionId === progressionId) {
        playToken.current++;
        audio.stop();
        dispatch({ type: "setPlaying", progressionId: null });
        return;
      }
      dispatch({ type: "setPlaying", progressionId });
      void startPlayback(progressionId, state.key, state.feel, state.midTempoBpm);
    },
    [state.playingProgressionId, state.key, state.feel, state.midTempoBpm, startPlayback],
  );

  // Key or feel change while playing → restart with the re-resolved chords / new drum template.
  const playing = state.playingProgressionId;
  const lastPlayed = useRef({ key: state.key, feel: state.feel });
  useEffect(() => {
    if (!playing) {
      lastPlayed.current = { key: state.key, feel: state.feel };
      return;
    }
    if (lastPlayed.current.key === state.key && lastPlayed.current.feel === state.feel) return;
    lastPlayed.current = { key: state.key, feel: state.feel };
    void startPlayback(playing, state.key, state.feel, state.midTempoBpm);
    // midTempoBpm deliberately omitted: tempo changes go through setBpm below, no restart.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.key, state.feel, playing, startPlayback]);

  useEffect(() => {
    if (playing) audio.setBpm(playbackBpm(state.feel, state.midTempoBpm));
  }, [state.midTempoBpm, state.feel, playing]);

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
      togglePlay,
    }),
    [state, rendered, generate, regenerateSection, togglePlay],
  );

  return <GeneratorContext.Provider value={value}>{children}</GeneratorContext.Provider>;
}

export function useGenerator(): GeneratorContextValue {
  const ctx = useContext(GeneratorContext);
  if (!ctx) throw new Error("useGenerator must be used inside <GeneratorProvider>");
  return ctx;
}
