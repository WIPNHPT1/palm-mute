"use client";

import { useEffect, useMemo, useState } from "react";
import { PlayIcon } from "@/components/icons/PlayIcon";
import { StopIcon } from "@/components/icons/StopIcon";
import { SegmentedControl } from "@/components/SegmentedControl";
import { ChordBox } from "@/components/lab/ChordBox";
import { useLab } from "@/components/lab/LabContext";
import { type DotColor, type NeckDot, Neck } from "@/components/lab/Neck";
import { GroupLabel } from "@/components/lab/ToolCard";
import {
  type ChordTypeId,
  type Position,
  type Role,
  type TuningId,
  type Voicing,
  CHORD_TYPES,
  MAJOR_PENTATONIC,
  MAJOR_SCALE,
  MAX_FRET,
  chordName,
  chordPitchClasses,
  chordType,
  fretRange,
  getTuning,
  noteName,
  positionOf,
  roleOf,
  shapeNotes,
  shapeText,
  voicingsFor,
} from "@/lib/lab/chords";
import { onRovingKeyDown, rovingTabIndex } from "@/lib/hooks/rovingRadio";
import { arpeggioBars, strumBars } from "@/lib/lab/sound";
import { PITCH_CLASSES, enharmonicOf, keyDisplayName, pitchClassOf } from "@/lib/musicTheory";

export const ROLE_COLOR: Record<Role, DotColor> = { R: "accent", "3": "brass", "5": "ink", "2": "success", "4": "success", "9": "success", "7": "muted" };
const LEGEND: { label: string; color: string }[] = [
  { label: "Root", color: "bg-accent" },
  { label: "3rd", color: "bg-brass" },
  { label: "5th", color: "bg-text-primary" },
  { label: "2nd / 4th / 9th", color: "bg-success" },
  { label: "7th", color: "bg-text-muted" },
];

const POSITIONS: { value: Position; label: string }[] = [
  { value: "all", label: "ALL" },
  { value: "open", label: "OPEN" },
  { value: "low", label: "LOW" },
  { value: "mid", label: "MID" },
  { value: "high", label: "HIGH" },
];
type Scale = "off" | "major" | "pentatonic";
const SCALES: { value: Scale; label: string }[] = [
  { value: "off", label: "OFF" },
  { value: "major", label: "MAJOR" },
  { value: "pentatonic", label: "PENTATONIC" },
];

/** Every chord tone on the neck, labelled by role; the voicing's own notes filled in. */
export function chordDots(root: number, type: ChordTypeId, tuning: TuningId, shape: Voicing | null): NeckDot[] {
  const pcs = chordPitchClasses(root, type);
  const strings = getTuning(tuning).strings;
  return strings.flatMap((st, s) =>
    Array.from({ length: MAX_FRET + 1 }, (_, f) => f).flatMap((f) => {
      const interval = (st.midi + f - root + 120) % 12;
      if (!pcs.includes((st.midi + f) % 12)) return [];
      const role = roleOf(interval, type);
      return [{ string: s, fret: f, label: role, color: ROLE_COLOR[role], filled: shape?.frets[s] === f }];
    }),
  );
}

export function RoleLegend() {
  return (
    <ul aria-label="Dot colours" className="flex flex-wrap gap-x-[16px] gap-y-[6px] font-mono text-[12px] text-text-muted">
      {LEGEND.map((l) => (
        <li key={l.label} className="flex items-center gap-[6px]">
          <span className={`inline-block h-[10px] w-[10px] rounded-full ${l.color}`} aria-hidden="true" />
          {l.label}
        </li>
      ))}
    </ul>
  );
}

function NotesIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
      <circle cx="3" cy="12" r="2" />
      <circle cx="8" cy="8" r="2" />
      <circle cx="13" cy="4" r="2" />
    </svg>
  );
}

/** A voicing card's play button: its icon and what it does in words (STRUM all at once, PICK note by note). */
function VoicingPlay({ label, text, playing, onClick, icon }: { label: string; text: string; playing: boolean; onClick: () => void; icon?: "notes" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={playing}
      aria-label={`${playing ? "Stop" : "Play"} ${label}`}
      data-playing={playing}
      className={`flex min-h-[44px] min-w-[44px] flex-[1_1_52px] items-center justify-center gap-[4px] rounded-mid px-[4px] font-mono text-[12px] font-bold ${
        playing ? "bg-accent/10 text-accent" : "text-text-muted hover:text-text-primary"
      }`}
    >
      {playing ? <StopIcon size={11} /> : icon === "notes" ? <NotesIcon /> : <PlayIcon size={11} filled={false} />}
      {text}
    </button>
  );
}

function Difficulty({ value }: { value: number }) {
  return (
    <span role="img" aria-label={`Difficulty ${value} of 5`} className="inline-flex gap-[3px]">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={`h-[6px] w-[6px] rounded-full ${i <= value ? "bg-brass" : "bg-line-strong"}`} />
      ))}
    </span>
  );
}

/** Root picker: twelve note chips (sharps with their flat names). */
function RootChips({ value, onChange }: { value: number; onChange: (root: number) => void }) {
  return (
    <div role="radiogroup" aria-label="Root" onKeyDown={onRovingKeyDown} className="flex flex-wrap gap-[4px]">
      {PITCH_CLASSES.map((n, i) => {
        const flat = enharmonicOf(n);
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={i === value}
            tabIndex={rovingTabIndex(i === value, true, i)}
            aria-label={keyDisplayName(n)}
            onClick={() => onChange(i)}
            className={`flex min-h-[44px] min-w-[44px] items-center justify-center gap-[4px] rounded-mid border px-[10px] font-mono text-[12px] font-bold ${
              i === value ? "border-ink bg-ink text-accent-on-ink" : "border-line bg-paper text-text-secondary hover:border-text-faintest"
            }`}
          >
            {n}
            {flat && <span className={`font-normal ${i === value ? "text-chip-tab" : "text-text-faint"}`}>{flat}</span>}
          </button>
        );
      })}
    </div>
  );
}

function TypeChips({ value, onChange }: { value: ChordTypeId; onChange: (t: ChordTypeId) => void }) {
  return (
    <div role="radiogroup" aria-label="Chord type" onKeyDown={onRovingKeyDown} className="flex flex-wrap gap-[4px]">
      {CHORD_TYPES.map((t, i) => (
        <button
          key={t.id}
          type="button"
          role="radio"
          aria-checked={t.id === value}
          tabIndex={rovingTabIndex(t.id === value, true, i)}
          onClick={() => onChange(t.id)}
          className={`min-h-[44px] min-w-[44px] rounded-mid border px-[12px] font-mono text-[12px] font-bold ${
            t.id === value ? "border-ink bg-ink text-accent-on-ink" : "border-line bg-paper text-text-secondary hover:border-text-faintest"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`min-h-[44px] rounded-mid border px-[12px] font-mono text-[12px] font-bold ${
        pressed ? "border-ink bg-ink text-text-on-dark" : "border-line bg-paper text-text-muted hover:text-text-primary"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * 01 Dictionary (docs/chord-lab-prd.md §5.1, with the Fretboard explorer §5.3 inside it): pick a root and a
 * type, see the voicings players actually use (up to a dozen, from the nut up the neck) as a chord box with its notes, difficulty and two ways to hear it, then
 * the chord everywhere on the neck with the picked voicing filled in.
 */
export function Dictionary() {
  const { chord, setChord, shapeRequest, tuning, left, key, toggle, playing } = useLab();
  const { root, type } = chord;
  const [position, setPosition] = useState<Position>("all");
  const [easy, setEasy] = useState(false);
  const [noBarre, setNoBarre] = useState(false);
  const [scale, setScale] = useState<Scale>("off");
  const [picked, setPicked] = useState<string | null>(null);

  // "Look it up" from Name that chord: open on that shape, with every filter cleared so it's shown.
  const [handled, setHandled] = useState(0);
  useEffect(() => {
    if (!shapeRequest || shapeRequest.n === handled) return;
    setHandled(shapeRequest.n);
    setPosition("all");
    setEasy(false);
    setNoBarre(false);
    setPicked(shapeRequest.shape);
  }, [shapeRequest, handled]);

  const all = voicingsFor(root, type, tuning);
  const shown = useMemo(
    () => all.filter((v) => (position === "all" || positionOf(v) === position) && (!easy || v.difficulty <= 2) && (!noBarre || !v.barre)),
    [all, position, easy, noBarre],
  );
  // A new chord, tuning or filter: the first shape that's still shown.
  useEffect(() => {
    if (!picked || !shown.some((v) => shapeText(v.frets) === picked)) setPicked(shown[0] ? shapeText(shown[0].frets) : null);
  }, [shown, picked]);
  const index = Math.max(0, shown.findIndex((v) => shapeText(v.frets) === picked));
  const current = shown[index] ?? null;
  const name = chordName(root, type);
  const t = chordType(type);
  const strings = getTuning(tuning).strings;

  const notesOf = (v: Voicing) => shapeNotes(v.frets, tuning).filter((n): n is number => n !== null);
  const keyPc = pitchClassOf(key);
  const scaleSteps = scale === "major" ? MAJOR_SCALE : scale === "pentatonic" ? MAJOR_PENTATONIC : [];
  const chordPcs = chordPitchClasses(root, type);
  const faint = scaleSteps.length
    ? strings.flatMap((st, s) =>
        Array.from({ length: MAX_FRET + 1 }, (_, f) => f)
          .filter((f) => scaleSteps.includes((st.midi + f - keyPc + 120) % 12) && !chordPcs.includes((st.midi + f) % 12))
          .map((f) => ({ string: s, fret: f })),
      )
    : [];

  return (
    <>
      <div className="flex flex-col gap-[8px]">
        <GroupLabel>Root</GroupLabel>
        <RootChips value={root} onChange={(r) => setChord(r, type)} />
      </div>
      <div className="flex flex-col gap-[8px]">
        <GroupLabel>Type</GroupLabel>
        <TypeChips value={type} onChange={(ty) => setChord(root, ty)} />
      </div>
      <p className="max-w-[900px] font-mono text-[12px] leading-[1.6] text-text-muted" data-chord-info>
        <b className="text-text-primary">{name}</b> ({t.name}): {t.intervals.map((i) => noteName(root + i)).join(" · ")}. {t.sounds}
      </p>
      <div className="flex flex-col gap-[8px]">
        <GroupLabel>Show</GroupLabel>
        <div className="flex flex-wrap items-center gap-[8px]">
          <SegmentedControl<Position> label="Position" options={POSITIONS} value={position} onChange={setPosition} className="w-full tablet:w-auto" />
          <Toggle pressed={easy} onClick={() => setEasy((e) => !e)}>
            EASY ONLY
          </Toggle>
          <Toggle pressed={noBarre} onClick={() => setNoBarre((b) => !b)}>
            NO BARRES
          </Toggle>
        </div>
      </div>

      {shown.length ? (
        <ul aria-label={`${name} voicings`} className="grid grid-cols-[repeat(auto-fill,minmax(min(160px,calc(50%-5px)),1fr))] gap-[10px]" data-voicings>
          {shown.map((v) => {
            const id = shapeText(v.frets);
            const selected = id === picked;
            const notes = shapeNotes(v.frets, tuning);
            return (
              <li
                key={id}
                data-voicing={id}
                className={`flex min-w-0 flex-col rounded-outer border ${selected ? "border-[1.5px] border-accent bg-surface shadow-card-highlight" : "border-line bg-paper"}`}
              >
                <button
                  type="button"
                  aria-pressed={selected}
                  aria-label={`${name}, ${fretRange(v)}, ${v.shape}: show on the neck`}
                  onClick={() => setPicked(id)}
                  className="flex flex-col items-center gap-[6px] px-[8px] pb-[6px] pt-[12px] text-center"
                >
                  <ChordBox voicing={v} name={name} tuning={tuning} left={left} />
                  <span className="font-mono text-[12px] leading-[1.4] text-text-secondary" aria-hidden="true">
                    {notes.map((n, s) => (n === null ? null : <span key={s}>{noteName(n)}{s < 5 ? " " : ""}</span>))}
                  </span>
                  <span className="font-mono text-[12px] leading-[1.4] text-text-faint">
                    {fretRange(v)}
                    {v.shape !== "open" && ` · ${v.shape}`}
                  </span>
                  <Difficulty value={v.difficulty} />
                </button>
                <div className="mt-auto flex flex-wrap gap-[4px] border-t border-line p-[4px]">
                  <VoicingPlay label={`${name} ${id} strummed`} text="STRUM" playing={playing === `strum:${id}`} onClick={() => toggle(`strum:${id}`, strumBars(notesOf(v)))} />
                  <VoicingPlay label={`${name} ${id} note by note`} text="PICK" icon="notes" playing={playing === `arp:${id}`} onClick={() => toggle(`arp:${id}`, arpeggioBars(notesOf(v)))} />
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="flex flex-wrap items-center gap-[10px] rounded-outer border border-dashed border-line-strong p-[14px] font-mono text-[12px] text-text-muted">
          No {name} shapes match these filters{all.length ? "" : ` in ${getTuning(tuning).label}`}.
          {all.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setPosition("all");
                setEasy(false);
                setNoBarre(false);
              }}
              className="min-h-[44px] rounded-mid border border-line bg-paper px-[12px] font-bold text-text-primary"
            >
              SHOW ALL
            </button>
          )}
        </div>
      )}

      <div className="flex flex-col gap-[10px] border-t border-line pt-[16px]" data-fretboard>
        <GroupLabel>On the neck</GroupLabel>
        <div className="flex flex-wrap items-center gap-[8px]">
          <span className="font-mono text-[12px] text-text-muted">
            Every {name} note; {current ? `position ${index + 1} of ${shown.length} filled in` : "no shape picked"}.
          </span>
          <div className="flex gap-[6px]">
            <button
              type="button"
              disabled={shown.length < 2}
              onClick={() => setPicked(shapeText(shown[(index - 1 + shown.length) % shown.length].frets))}
              className="min-h-[44px] rounded-mid border border-line bg-paper px-[12px] font-mono text-[12px] font-bold disabled:text-text-disabled"
            >
              ‹ PREV
            </button>
            <button
              type="button"
              disabled={shown.length < 2}
              onClick={() => setPicked(shapeText(shown[(index + 1) % shown.length].frets))}
              className="min-h-[44px] rounded-mid border border-line bg-paper px-[12px] font-mono text-[12px] font-bold disabled:text-text-disabled"
            >
              NEXT ›
            </button>
          </div>
          {current && (
            <button
              type="button"
              aria-pressed={playing === `strum:${picked}`}
              onClick={() => toggle(`strum:${picked}`, strumBars(notesOf(current)))}
              className="inline-flex min-h-[44px] items-center gap-[8px] rounded-mid bg-accent px-[14px] font-display text-[12.5px] text-text-on-accent shadow-button"
            >
              {playing === `strum:${picked}` ? <StopIcon size={11} /> : <PlayIcon size={11} filled />}
              {playing === `strum:${picked}` ? "STOP" : "STRUM IT"}
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-[8px]">
          <span className="font-mono text-[12px] uppercase tracking-[0.08em] text-text-faint">Scale of {keyDisplayName(key)} (from the setup)</span>
          <SegmentedControl<Scale> label="Scale" options={SCALES} value={scale} onChange={setScale} stretch className="w-full tablet:w-[340px]" />
        </div>
        <Neck
          tuning={tuning}
          left={left}
          dots={chordDots(root, type, tuning, current)}
          faint={faint}
          label={`${name} on the neck${current ? `, ${fretRange(current)} filled in` : ""}`}
        />
        <RoleLegend />
      </div>
    </>
  );
}
