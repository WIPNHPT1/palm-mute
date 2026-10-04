"use client";

import { useEffect, useState } from "react";
import { PlayButton } from "@/components/PlayButton";
import { useLab } from "@/components/lab/LabContext";
import { Neck } from "@/components/lab/Neck";
import { GroupLabel } from "@/components/lab/ToolCard";
import {
  type Frets,
  chordName,
  getTuning,
  keysFor,
  nameShape,
  nearestVoicing,
  noteName,
  parseShape,
  shapeNotes,
  shapeText,
  voicingsFor,
} from "@/lib/lab/chords";
import { arpeggioBars, strumBars } from "@/lib/lab/sound";

const EMPTY: Frets = [null, null, null, null, null, null];
const SAMPLES = ["320003", "x32033", "xx0232", "022000"];

/**
 * 02 Name that chord (docs/chord-lab-prd.md §5.2): tap frets on the neck (or type the shape); the chord is
 * named as you go, best name first with the alternatives and slash chords for inversions, with the keys it
 * belongs to. A shape in the Dictionary links to it; a shape one fret from a chord suggests the fix.
 */
export function NameIt() {
  const { tuning, left, toggle, playing, setChord } = useLab();
  const [frets, setFrets] = useState<Frets>(EMPTY);
  const [text, setText] = useState("");
  const [bad, setBad] = useState(false);
  // The text box follows the neck (and is left alone while it holds something that isn't a shape yet).
  useEffect(() => {
    if (!bad) setText(frets.every((f) => f === null) ? "" : shapeText(frets));
  }, [frets, bad]);

  const tap = (s: number, f: number) => {
    setBad(false);
    setFrets((cur) => cur.map((x, i) => (i === s ? (x === f ? null : f) : x)));
  };
  const typed = (value: string) => {
    setText(value);
    const parsed = parseShape(value);
    setBad(!!value.trim() && !parsed);
    if (parsed) setFrets(parsed);
    if (!value.trim()) setFrets(EMPTY);
  };

  const names = nameShape(frets, tuning);
  const best = names[0];
  const notes = shapeNotes(frets, tuning).filter((n): n is number => n !== null);
  const strings = getTuning(tuning).strings;
  const inDictionary = best && voicingsFor(best.root, best.type, tuning).some((v) => shapeText(v.frets) === shapeText(frets));
  const near = !inDictionary && notes.length >= 2 ? nearestVoicing(frets, tuning) : null;
  const keys = best && best.type !== "oct" ? keysFor(best.root, best.type) : [];
  const id = shapeText(frets);

  const message = notes.length === 0 ? "Tap a fret on each string you play." : notes.length === 1 ? `One note: ${noteName(notes[0])}. Add another string.` : best ? null : `Not a chord in the Lab: ${[...new Set(notes.map((n) => noteName(n)))].join(" · ")}.`;

  return (
    <>
      <p className="max-w-[900px] font-mono text-[12px] leading-[1.6] text-text-muted max-tablet:order-1">
        Tap a fret on each string you play (tap it again to take it off), or type the shape low string first, like x32010.
      </p>
      <div className="max-tablet:order-3">
        <Neck
          tuning={tuning}
          left={left}
          onTap={tap}
          muted={frets.flatMap((f, s) => (f === null ? [s] : []))}
          dots={frets.flatMap((f, s) => (f === null ? [] : [{ string: s, fret: f, label: noteName(strings[s].midi + f), color: "accent" as const, filled: true }]))}
          label={`Neck to tap a shape on${notes.length ? `: ${id}` : ""}`}
        />
      </div>
      <div className="flex flex-wrap items-end gap-[10px] max-tablet:order-4">
        <label className="flex min-w-0 flex-[1_1_220px] flex-col gap-[6px]">
          <GroupLabel>Shape, low string first</GroupLabel>
          <input
            value={text}
            onChange={(e) => typed(e.target.value)}
            placeholder="x32010"
            autoComplete="off"
            spellCheck={false}
            aria-invalid={bad}
            aria-describedby="name-it-help"
            className="min-h-[44px] w-full rounded-mid border border-line bg-paper px-[12px] font-mono text-[14px] text-text-primary placeholder:text-text-faint aria-[invalid=true]:border-accent"
          />
        </label>
        <button
          type="button"
          onClick={() => {
            setBad(false);
            setFrets(EMPTY);
          }}
          className="min-h-[44px] rounded-mid border border-line bg-paper px-[14px] font-mono text-[12px] font-bold"
        >
          CLEAR
        </button>
      </div>
      <p id="name-it-help" className="font-mono text-[12px] text-text-faint max-tablet:order-5">
        {bad ? "Six strings, x for a string you don't play, frets 0–15 (dashes between them for frets over 9)." : (
          <>
            Try:{" "}
            {SAMPLES.map((s, i) => (
              <span key={s}>
                <button type="button" onClick={() => typed(s)} className="min-h-[44px] min-w-[44px] px-[4px] font-bold text-text-secondary underline underline-offset-2 hover:text-accent">
                  {s}
                </button>
                {i < SAMPLES.length - 1 ? " " : ""}
              </span>
            ))}
          </>
        )}
      </p>

      {/* The answer. On phones the neck is two screens tall, so the name, its play buttons and any hint stay pinned
          under the top bar, above the neck, while you tap (the rest of the answer follows the neck's controls). */}
      <div
        className="flex flex-col gap-[10px] max-tablet:sticky max-tablet:top-[64px] max-tablet:z-20 max-tablet:order-2 max-tablet:-mx-[16px] max-tablet:border-b max-tablet:border-line max-tablet:bg-surface max-tablet:px-[16px] max-tablet:py-[8px] max-tablet:shadow-card"
        aria-live="polite"
        data-named
      >
        <div className="flex flex-wrap items-center gap-x-[16px] gap-y-[6px]">
          <span className="font-display text-[34px] leading-none" data-chord-name>
            {best ? best.name : "—"}
          </span>
          {notes.length >= 2 && (
            <span className="flex">
              <PlayButton playing={playing === `name:strum:${id}`} onClick={() => toggle(`name:strum:${id}`, strumBars(notes))} label={`${best?.name ?? "this shape"} strummed`} />
              <PlayButton playing={playing === `name:arp:${id}`} onClick={() => toggle(`name:arp:${id}`, arpeggioBars(notes))} label={`${best?.name ?? "this shape"} note by note`} />
            </span>
          )}
          {names.length > 1 && <span className="font-mono text-[12px] text-text-muted">also: {names.slice(1, 4).map((n) => n.name).join(", ")}</span>}
        </div>
        {message && <p className="font-mono text-[12px] text-text-muted">{message}</p>}
        {near && (
          <div className="flex flex-wrap items-center gap-[10px] rounded-outer border border-dashed border-line-strong p-[8px] font-mono text-[12px] text-text-secondary tablet:p-[12px]" data-near>
            <span>
              Did you mean <b className="text-text-primary">{chordName(near.voicing.root, near.voicing.type)}</b>? Move the {strings[near.string].name} string from fret {near.from} to {near.to}.
            </span>
            <button
              type="button"
              onClick={() => {
                setBad(false);
                setFrets(near.voicing.frets);
              }}
              className="min-h-[44px] rounded-mid border border-line bg-paper px-[12px] font-bold text-text-primary hover:border-accent"
            >
              USE {shapeText(near.voicing.frets)}
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-[10px] max-tablet:order-6 tablet:-mt-[6px]" data-named-details>
        {notes.length >= 2 && (
          <p className="font-mono text-[12px] text-text-muted">
            Notes, low to high: {notes.map((n) => noteName(n)).join(" · ")}
          </p>
        )}
        {keys.length > 0 && best && (
          <div className="flex flex-col gap-[6px]">
            <GroupLabel>In these keys</GroupLabel>
            <ul className="flex flex-wrap gap-[4px]" aria-label={`Keys ${best.name} belongs to`}>
              {keys.map((k) => (
                <li key={k.key} className="rounded-small border border-line px-[8px] py-[3px] font-mono text-[12px] text-text-secondary">
                  {noteName(k.key)} major: <b className="text-accent">{k.numeral}</b>
                </li>
              ))}
            </ul>
          </div>
        )}
        {best && inDictionary && (
          <div>
            <button
              type="button"
              onClick={() => {
                setChord(best.root, best.type, id);
                document.getElementById("dictionary")?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="min-h-[44px] rounded-mid border border-line bg-paper px-[14px] font-mono text-[12px] font-bold hover:border-accent"
            >
              LOOK UP {best.name.toUpperCase()} IN THE DICTIONARY
            </button>
          </div>
        )}
      </div>
    </>
  );
}

