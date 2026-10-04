"use client";

import { useState } from "react";
import { PlayIcon } from "@/components/icons/PlayIcon";
import { StopIcon } from "@/components/icons/StopIcon";
import { SegmentedControl } from "@/components/SegmentedControl";
import { useLab } from "@/components/lab/LabContext";
import { GroupLabel } from "@/components/lab/ToolCard";
import { type ChordTypeId, chordName, chordType, easiestVoicing, shapeNotes } from "@/lib/lab/chords";
import { type DegreeId, DEGREES, degreeRoot, getDegree, nextMoves, typesFor } from "@/lib/lab/keys";
import { type LoopChord, brightnessWords, classicWords, restlessnessWords, vibeOf } from "@/lib/lab/mood";
import { loopBars } from "@/lib/lab/sound";
import { pitchClassOf } from "@/lib/musicTheory";

export const MAX_LOOP = 8;
const LOOP_ID = "builder:loop";
/** Where a new loop starts: the genre's most common one, as power chords. */
export const START_LOOP: LoopChord[] = (["I", "V", "vi", "IV"] as DegreeId[]).map((degree) => ({ degree, type: "5" }));

type Sound = "power" | "full";
const SOUNDS: { value: Sound; label: string }[] = [
  { value: "power", label: "POWER CHORDS" },
  { value: "full", label: "FULL CHORDS" },
];

function Meter({ label, value, words }: { label: string; value: number; words: string }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex min-w-0 flex-col gap-[4px] font-mono text-[12px] text-text-muted">
      <span>
        {label} · {pct}%
      </span>
      <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="h-[8px] overflow-hidden rounded-[4px] border border-line bg-paper">
        <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
      <span>{words}</span>
    </div>
  );
}

/**
 * 03 Progression builder (docs/chord-lab-prd.md §5.4): tap chords from the key (and the borrowed ones
 * pop-punk loves) into a loop of up to eight, hear it, change a chord's type, move or remove it, get the
 * likeliest next chords and three vibe meters. The loop plays as its easiest shapes in the Lab's tuning.
 */
export function Builder() {
  const { key, tuning, toggle, stop, playing, sendToFinder } = useLab();
  const keyPc = pitchClassOf(key);
  const [loop, setLoop] = useState<LoopChord[]>(START_LOOP);
  const [selected, setSelected] = useState<number | null>(null);
  const [sound, setSound] = useState<Sound>("power");

  /** A new chord's type: a power chord, or its degree's natural quality. */
  const fresh = (degree: DegreeId): ChordTypeId => (sound === "power" ? "5" : getDegree(degree).quality);
  const edit = (next: LoopChord[], sel: number | null = selected) => {
    if (playing === LOOP_ID) stop();
    setLoop(next);
    setSelected(sel === null ? null : Math.min(sel, next.length - 1));
  };
  const add = (degree: DegreeId) => {
    if (loop.length >= MAX_LOOP) return;
    edit([...loop, { degree, type: fresh(degree) }], loop.length);
  };
  const nameOf = (c: LoopChord) => chordName(degreeRoot(keyPc, c.degree), c.type);

  const bars = () =>
    loopBars(
      loop.flatMap((c) => {
        const v = easiestVoicing(degreeRoot(keyPc, c.degree), c.type, tuning);
        return v ? [shapeNotes(v.frets, tuning).filter((n): n is number => n !== null)] : [];
      }),
    );

  const vibe = vibeOf(loop);
  const last = loop[loop.length - 1];
  const sel = selected !== null ? loop[selected] : null;
  const full = loop.length >= MAX_LOOP;

  return (
    <>
      <div className="flex flex-col gap-[8px]">
        <GroupLabel>Your key: {key} major. Tap a chord to add it (borrowed chords have a brass underline)</GroupLabel>
        <ul aria-label="Chords in the key" className="flex flex-wrap gap-[4px]">
          {DEGREES.map((d) => (
            <li key={d.id}>
              <button
                type="button"
                disabled={full}
                onClick={() => add(d.id)}
                aria-label={`Add ${d.id}, ${chordName(degreeRoot(keyPc, d.id), fresh(d.id))}`}
                className={`flex min-h-[44px] min-w-[44px] items-center gap-[6px] rounded-mid border bg-paper px-[12px] font-mono text-[12px] font-bold text-text-secondary hover:border-accent disabled:text-text-disabled ${d.borrowed ? "border-brass border-b-[3px]" : "border-line"}`}
              >
                {d.id}
                <span className="font-normal text-text-faint">{chordName(degreeRoot(keyPc, d.id), fresh(d.id))}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-[8px]">
        <GroupLabel>
          Loop ({loop.length} of {MAX_LOOP}): tap a chord to change it
        </GroupLabel>
        <ol aria-label="Your loop" data-loop className="flex min-h-[64px] flex-wrap gap-[6px] rounded-outer border-[1.5px] border-dashed border-line-strong p-[8px]">
          {loop.map((c, i) => (
            <li key={`${i}-${c.degree}`}>
              <button
                type="button"
                aria-pressed={selected === i}
                aria-label={`Chord ${i + 1}: ${c.degree}, ${nameOf(c)}`}
                onClick={() => setSelected(selected === i ? null : i)}
                className={`flex min-h-[52px] min-w-[58px] flex-col items-center justify-center rounded-mid bg-chip-bg px-[8px] py-[4px] font-mono text-text-on-dark ${selected === i ? "ring-2 ring-accent ring-offset-2 ring-offset-surface" : ""}`}
              >
                <span className={`text-[12px] ${getDegree(c.degree).borrowed ? "text-brass" : "text-chip-tab"}`}>{c.degree}</span>
                <b className="text-[13px]">{nameOf(c)}</b>
              </button>
            </li>
          ))}
          {!loop.length && <li className="self-center px-[8px] font-mono text-[12px] text-text-faint">Empty: tap a chord above.</li>}
        </ol>
      </div>

      {sel && selected !== null && (
        <div className="flex flex-col gap-[10px] rounded-outer border border-line bg-paper p-[12px]" data-chord-editor>
          <GroupLabel>
            Chord {selected + 1}: {sel.degree} ({nameOf(sel)})
          </GroupLabel>
          <div role="radiogroup" aria-label="Chord type" className="flex flex-wrap gap-[4px]">
            {typesFor(sel.degree).map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={sel.type === t}
                onClick={() => edit(loop.map((c, i) => (i === selected ? { ...c, type: t } : c)))}
                className={`min-h-[44px] min-w-[44px] rounded-mid border px-[12px] font-mono text-[12px] font-bold ${
                  sel.type === t ? "border-ink bg-ink text-accent-on-ink" : "border-line bg-surface text-text-secondary hover:border-text-faintest"
                }`}
              >
                {chordType(t).label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-[6px]">
            <button
              type="button"
              disabled={selected === 0}
              onClick={() => {
                const next = [...loop];
                [next[selected - 1], next[selected]] = [next[selected], next[selected - 1]];
                edit(next, selected - 1);
              }}
              className="min-h-[44px] rounded-mid border border-line bg-surface px-[12px] font-mono text-[12px] font-bold disabled:text-text-disabled"
            >
              ‹ MOVE LEFT
            </button>
            <button
              type="button"
              disabled={selected === loop.length - 1}
              onClick={() => {
                const next = [...loop];
                [next[selected + 1], next[selected]] = [next[selected], next[selected + 1]];
                edit(next, selected + 1);
              }}
              className="min-h-[44px] rounded-mid border border-line bg-surface px-[12px] font-mono text-[12px] font-bold disabled:text-text-disabled"
            >
              MOVE RIGHT ›
            </button>
            <button
              type="button"
              onClick={() => edit(loop.filter((_, i) => i !== selected), null)}
              className="min-h-[44px] rounded-mid border border-line bg-surface px-[12px] font-mono text-[12px] font-bold text-accent"
            >
              REMOVE
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-[10px]">
        <button
          type="button"
          disabled={!loop.length}
          aria-pressed={playing === LOOP_ID}
          onClick={() => toggle(LOOP_ID, bars(), true)}
          className="inline-flex min-h-[44px] items-center gap-[8px] rounded-mid bg-accent px-[14px] font-display text-[12.5px] text-text-on-accent shadow-button disabled:opacity-50"
        >
          {playing === LOOP_ID ? <StopIcon size={11} /> : <PlayIcon size={11} filled />}
          {playing === LOOP_ID ? "STOP" : "PLAY THE LOOP"}
        </button>
        <SegmentedControl<Sound> label="Chord sound" options={SOUNDS} value={sound} onChange={setSound} />
        <button
          type="button"
          disabled={!loop.length}
          onClick={() => {
            sendToFinder(loop.map(nameOf).join(" "));
            document.getElementById("key-finder")?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
          className="min-h-[44px] rounded-mid border border-line bg-paper px-[14px] font-mono text-[12px] font-bold hover:border-accent disabled:text-text-disabled"
        >
          FIND THIS LOOP&apos;S KEY
        </button>
        <button type="button" onClick={() => edit([], null)} disabled={!loop.length} className="min-h-[44px] rounded-mid border border-line bg-paper px-[14px] font-mono text-[12px] font-bold disabled:text-text-disabled">
          CLEAR
        </button>
        <button type="button" onClick={() => edit(START_LOOP, null)} className="min-h-[44px] rounded-mid border border-line bg-paper px-[14px] font-mono text-[12px] font-bold">
          START OVER
        </button>
      </div>

      {last && (
        <div className="flex flex-col gap-[8px]">
          <GroupLabel>What next? After {last.degree}</GroupLabel>
          <ul aria-label="Likely next chords" className="flex flex-wrap gap-[4px]">
            {nextMoves(last.degree).map((d) => (
              <li key={d}>
                <button
                  type="button"
                  disabled={full}
                  onClick={() => add(d)}
                  aria-label={`Add ${d} next, ${chordName(degreeRoot(keyPc, d), fresh(d))}`}
                  className="flex min-h-[44px] min-w-[44px] items-center gap-[6px] rounded-mid border border-line bg-paper px-[12px] font-mono text-[12px] font-bold text-text-secondary hover:border-accent disabled:text-text-disabled"
                >
                  {d}
                  <span className="font-normal text-text-faint">{chordName(degreeRoot(keyPc, d), fresh(d))}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-[14px]" data-vibe>
        <Meter label="Dark to bright" value={vibe.brightness} words={brightnessWords(vibe.brightness)} />
        <Meter label="Settled to restless" value={vibe.restlessness} words={restlessnessWords(vibe.restlessness, loop)} />
        <Meter label="How classic" value={vibe.classic} words={classicWords(vibe.classic)} />
      </div>
    </>
  );
}
