"use client";

import { type ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import * as audio from "@/lib/audio/engine";
import type { PlaybackBar } from "@/lib/playback";
import { type ChordTypeId, type TuningId } from "@/lib/lab/chords";
import { type LoopChord, START_LOOP } from "@/lib/lab/mood";
import { LAB_BPM } from "@/lib/lab/sound";
import type { NoteName } from "@/lib/musicTheory";

/**
 * The Chord Lab's own state (docs/chord-lab-prd.md §4): its key, tuning and handedness, the chord being
 * looked up, and one player for the whole page. None of it is shared with the Generator, and none of it is
 * remembered between visits.
 */
type Lab = {
  key: NoteName;
  setKey: (k: NoteName) => void;
  tuning: TuningId;
  setTuning: (t: TuningId) => void;
  left: boolean;
  setLeft: (left: boolean) => void;
  /** The Dictionary's chord: other tools put a chord here to look it up. */
  chord: { root: number; type: ChordTypeId };
  /** `shape` (e.g. "x32010") asks the Dictionary to open on that voicing; each request counts once. */
  setChord: (root: number, type: ChordTypeId, shape?: string) => void;
  shapeRequest: { shape: string; n: number } | null;
  /** The Builder's loop: the Mood map shows it as a star. */
  loop: LoopChord[];
  setLoop: (loop: LoopChord[]) => void;
  /** The Builder sends its loop to the Key finder as chord names; each request counts once. */
  finderRequest: { text: string; n: number } | null;
  sendToFinder: (text: string) => void;
  /** What's playing (an id the tool chose), or null. One thing at a time. */
  playing: string | null;
  /** Plays `bars` under `id`, or stops if `id` is already playing. Loops play until stopped. */
  toggle: (id: string, bars: PlaybackBar[], loop?: boolean) => void;
  stop: () => void;
};

const LabContext = createContext<Lab | null>(null);

export function LabProvider({ children }: { children: ReactNode }) {
  const [key, setKey] = useState<NoteName>("G");
  const [tuning, setTuning] = useState<TuningId>("e-standard");
  const [left, setLeft] = useState(false);
  const [chord, setChordState] = useState<{ root: number; type: ChordTypeId }>({ root: 7, type: "maj" });
  const [shapeRequest, setShapeRequest] = useState<{ shape: string; n: number } | null>(null);
  const [loop, setLoop] = useState<LoopChord[]>(START_LOOP);
  const [finderRequest, setFinderRequest] = useState<{ text: string; n: number } | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);

  const stop = useCallback(() => {
    audio.stop();
    setPlaying(null);
  }, []);

  const toggle = useCallback(
    (id: string, bars: PlaybackBar[], loop = false) => {
      if (playing === id) return stop();
      setPlaying(id);
      void audio.play({ bars, bpm: LAB_BPM, loop, onEnd: () => setPlaying((p) => (p === id ? null : p)) }).then((ok) => {
        if (!ok) setPlaying((p) => (p === id ? null : p));
      });
    },
    [playing, stop],
  );

  // A new tuning changes every sound: stop whatever was playing in the old one.
  useEffect(() => stop(), [tuning, stop]);
  useEffect(() => () => audio.stop(), []);

  const setChord = useCallback((root: number, type: ChordTypeId, shape?: string) => {
    setChordState({ root, type });
    if (shape) setShapeRequest((r) => ({ shape, n: (r?.n ?? 0) + 1 }));
  }, []);

  const sendToFinder = useCallback((text: string) => setFinderRequest((r) => ({ text, n: (r?.n ?? 0) + 1 })), []);

  const value = useMemo<Lab>(
    () => ({ key, setKey, tuning, setTuning, left, setLeft, chord, setChord, shapeRequest, loop, setLoop, finderRequest, sendToFinder, playing, toggle, stop }),
    [key, tuning, left, chord, setChord, shapeRequest, loop, finderRequest, sendToFinder, playing, toggle, stop],
  );
  return <LabContext.Provider value={value}>{children}</LabContext.Provider>;
}

export function useLab(): Lab {
  const lab = useContext(LabContext);
  if (!lab) throw new Error("useLab outside LabProvider");
  return lab;
}
