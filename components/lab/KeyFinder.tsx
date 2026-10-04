"use client";

import { useEffect, useState } from "react";
import { PlayIcon } from "@/components/icons/PlayIcon";
import { StopIcon } from "@/components/icons/StopIcon";
import { useLab } from "@/components/lab/LabContext";
import { GroupLabel } from "@/components/lab/ToolCard";
import { chordName, easiestVoicing, getTuning, noteName, shapeNotes } from "@/lib/lab/chords";
import { type ParsedChord, findKeys, keyName, parseChord, relativeMinor, shapeFor, splitChords, transpose } from "@/lib/lab/keys";
import { loopBars } from "@/lib/lab/sound";

const PLAY_ID = "finder:loop";
const MAX_CAPO = 7;

function Stepper({ label, value, text, onChange, min, max }: { label: string; value: number; text: string; onChange: (v: number) => void; min: number; max: number }) {
  return (
    <div role="group" aria-label={label} className="flex items-center gap-[6px]">
      <button type="button" aria-label={`${label} down`} disabled={value <= min} onClick={() => onChange(value - 1)} className="min-h-[44px] min-w-[44px] rounded-mid border border-line bg-paper font-mono text-[14px] font-bold disabled:text-text-disabled">
        −
      </button>
      <output aria-label={`${label} now`} className="min-w-[96px] text-center font-mono text-[12px] text-text-primary">
        {text}
      </output>
      <button type="button" aria-label={`${label} up`} disabled={value >= max} onClick={() => onChange(value + 1)} className="min-h-[44px] min-w-[44px] rounded-mid border border-line bg-paper font-mono text-[14px] font-bold disabled:text-text-disabled">
        +
      </button>
    </div>
  );
}

/**
 * 04 Key finder & transposer (docs/chord-lab-prd.md §5.5): type 2 to 8 chord names and get the keys they fit,
 * best first, with a numeral for each chord (borrowed ones flagged); then move them up or down, and for a capo
 * and the Lab's tuning see which shapes to play so it still sounds as written. The sound matches the shapes.
 */
export function KeyFinder() {
  const { tuning, finderRequest, toggle, playing } = useLab();
  const [text, setText] = useState("G D Em C");
  const [shift, setShift] = useState(0);
  const [capo, setCapo] = useState(0);
  const [handled, setHandled] = useState(0);
  useEffect(() => {
    if (!finderRequest || finderRequest.n === handled) return;
    setHandled(finderRequest.n);
    setText(finderRequest.text);
    setShift(0);
  }, [finderRequest, handled]);

  const tokens = splitChords(text);
  const parsed = tokens.map((t) => ({ token: t, chord: parseChord(t) }));
  const chords = parsed.flatMap((p) => (p.chord ? [p.chord] : []));
  const unread = parsed.filter((p) => !p.chord).map((p) => p.token);
  // Names the Lab has no type for are read as the nearest one, and the page says so.
  const mapped = chords.flatMap((c) => (c.note ? [c.note] : []));
  const help = [
    mapped.length ? `${mapped.join(". ")}.` : "",
    unread.length ? `Couldn't read: ${unread.join(", ")}. Try G, G/B, Em, A5, Dsus4, Cadd9, F#m7, Bbmaj7.` : "",
  ].filter(Boolean);
  const fits = findKeys(chords, 3);

  // What it sounds like after moving, and the shapes that make that sound with this capo in this tuning.
  const sounding: ParsedChord[] = chords.map((c) => transpose(c, shift));
  const shapes: ParsedChord[] = sounding.map((c) => shapeFor(c, capo));
  const best = fits[0];
  const targetKey = best ? (best.key + shift + 120) % 12 : null;

  const bars = () =>
    loopBars(
      shapes.flatMap((c) => {
        const v = easiestVoicing(c.root, c.type, tuning);
        // The capo raises every string, so the sound is the shape's notes plus the capo's frets.
        return v ? [shapeNotes(v.frets, tuning).filter((n): n is number => n !== null).map((n) => n + capo)] : [];
      }),
    );

  return (
    <>
      <div className="flex flex-col gap-[6px]">
        <label htmlFor="key-finder-input">
          <GroupLabel>Chords (2 to 8): G D Em C, G/B, F#m7 Bbadd9, A5 E5</GroupLabel>
        </label>
        <input
          id="key-finder-input"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setShift(0);
          }}
          autoComplete="off"
          spellCheck={false}
          aria-describedby="key-finder-help"
          className="min-h-[44px] w-full max-w-[640px] rounded-mid border border-line bg-paper px-[12px] font-mono text-[14px] text-text-primary"
        />
        <p id="key-finder-help" className="font-mono text-[12px] text-text-faint">
          {help.length ? help.join(" ") : chords.length < 2 ? "Add at least two chords." : tokens.length > 8 ? "Only the first eight are used." : "Names are read as typed: # or b for sharps and flats, / for a bass note."}
        </p>
      </div>

      {chords.length >= 2 ? (
        <>
          <ul aria-label="Keys these chords fit" data-key-fits className="grid gap-[8px]">
            {fits.map((f, i) => (
              <li key={f.key} className={`grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-[14px] gap-y-[4px] rounded-outer border px-[12px] py-[10px] ${i === 0 ? "border-[1.5px] border-accent bg-surface" : "border-line bg-paper"}`}>
                <span className="font-display text-[18px]">{noteName(f.key)}</span>
                <span className="font-mono text-[12px] leading-[1.6] text-text-secondary">
                  {i === 0 && <b className="text-text-primary">Best fit · </b>}
                  {keyName(f.key)} (relative {relativeMinor(f.key)}):{" "}
                  {f.numerals.map((n, j) => (
                    <span key={j}>
                      {j > 0 && " · "}
                      {n.numeral ? (
                        <span className={n.borrowed ? "font-bold underline decoration-brass decoration-2 underline-offset-2" : ""}>
                          {n.numeral}
                          {n.text.includes("/") ? ` (${n.text})` : ""}
                          {n.borrowed ? " (borrowed)" : ""}
                        </span>
                      ) : (
                        <span className="text-accent">{n.text} is outside the key</span>
                      )}
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>

          <div className="flex flex-col gap-[10px] border-t border-line pt-[16px]">
            <GroupLabel>Move them</GroupLabel>
            <div className="flex flex-wrap items-center gap-x-[20px] gap-y-[10px]">
              <Stepper label="Transpose" value={shift} min={-11} max={11} onChange={setShift} text={`${shift > 0 ? "+" : ""}${shift} semitone${Math.abs(shift) === 1 ? "" : "s"}`} />
              <Stepper label="Capo" value={capo} min={0} max={MAX_CAPO} onChange={setCapo} text={capo ? `fret ${capo}` : "no capo"} />
            </div>
            {targetKey !== null && (
              <div className="flex flex-col gap-[6px]">
                <span className="font-mono text-[12px] text-text-faint" id="to-key-label">
                  Or go to a key: {noteName(best.key)} major →
                </span>
                <div role="radiogroup" aria-labelledby="to-key-label" className="flex flex-wrap gap-[4px]">
                  {Array.from({ length: 12 }, (_, k) => {
                    const delta = (((k - best.key + 6) % 12) + 12) % 12 - 6; // the shortest way round
                    return (
                      <button
                        key={k}
                        type="button"
                        role="radio"
                        aria-checked={k === targetKey}
                        aria-label={`Move to ${noteName(k)} major`}
                        onClick={() => setShift(delta)}
                        className={`min-h-[44px] min-w-[44px] rounded-mid border px-[8px] font-mono text-[12px] font-bold ${k === targetKey ? "border-ink bg-ink text-accent-on-ink" : "border-line bg-paper text-text-secondary hover:border-text-faintest"}`}
                      >
                        {noteName(k)}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <dl className="grid gap-[8px]" data-moved>
              <div className="grid grid-cols-[72px_minmax(0,1fr)] items-baseline gap-x-[12px] rounded-outer border border-line bg-paper px-[12px] py-[10px]">
                <dt className="font-mono text-[12px] font-bold text-text-faint">SOUNDS</dt>
                <dd className="font-mono text-[13px] text-text-primary" data-sounds>
                  {sounding.map((c) => chordName(c.root, c.type)).join(" · ")}
                </dd>
              </div>
              <div className="grid grid-cols-[72px_minmax(0,1fr)] items-baseline gap-x-[12px] rounded-outer border border-line bg-paper px-[12px] py-[10px]">
                <dt className="font-mono text-[12px] font-bold text-text-faint">PLAY</dt>
                <dd className="font-mono text-[13px] text-text-primary" data-shapes>
                  {shapes.map((c) => chordName(c.root, c.type)).join(" · ")}
                  <span className="mt-[4px] block text-[12px] text-text-muted">
                    {capo
                      ? `With the capo at fret ${capo}: play these shapes to sound as written, in ${getTuning(tuning).label}.`
                      : `No capo: the shapes are the chords, in ${getTuning(tuning).label}.`}
                  </span>
                </dd>
              </div>
            </dl>
            <div>
              <button
                type="button"
                aria-pressed={playing === PLAY_ID}
                onClick={() => toggle(PLAY_ID, bars(), true)}
                className="inline-flex min-h-[44px] items-center gap-[8px] rounded-mid bg-accent px-[14px] font-display text-[12.5px] text-text-on-accent shadow-button"
              >
                {playing === PLAY_ID ? <StopIcon size={11} /> : <PlayIcon size={11} filled />}
                {playing === PLAY_ID ? "STOP" : "HEAR IT"}
              </button>
            </div>
          </div>
        </>
      ) : (
        <p className="font-mono text-[12px] text-text-muted">Type two or more chords to find their key.</p>
      )}
    </>
  );
}
