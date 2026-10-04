"use client";

import { useMemo, useState } from "react";
import { PlayIcon } from "@/components/icons/PlayIcon";
import { StopIcon } from "@/components/icons/StopIcon";
import { useLab } from "@/components/lab/LabContext";
import { GroupLabel } from "@/components/lab/ToolCard";
import { chordName, easiestVoicing, shapeNotes } from "@/lib/lab/chords";
import { degreeRoot } from "@/lib/lab/keys";
import { type MoodPoint, labelSide, naturalLoop, moodPoints, nearestPoint, placeScores, quadrantOf, vibeOf } from "@/lib/lab/mood";
import { loopBars } from "@/lib/lab/sound";
import { pitchClassOf } from "@/lib/musicTheory";

const START = "I-V-vi-IV";
const words = (v: number, lo: string, hi: string) => (v < 0.35 ? `${lo} than most` : v > 0.65 ? `${hi} than most` : "in the middle");

function Meter({ label, value, text }: { label: string; value: number; text: string }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex flex-col gap-[4px] font-mono text-[12px] text-text-muted">
      <span>
        {label} · {text}
      </span>
      <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="h-[8px] overflow-hidden rounded-[4px] border border-line bg-paper">
        <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Star() {
  return (
    <svg viewBox="-12 -12 24 24" className="h-[20px] w-[20px] text-brass" aria-hidden="true">
      <path fill="currentColor" d="M0-11 3-3 11-3 4 2 7 10 0 5-7 10-4 2-11-3-3-3z" />
    </svg>
  );
}

/**
 * 05 Mood map (docs/chord-lab-prd.md §5.6): the app's ten progressions and more, plotted dark to bright across
 * and settled to restless up. Tap a dot, the chips or empty space (the nearest loop) to pick and hear a loop
 * in your key; your Builder loop shows as a star. The page lays the plot out as HTML so its text stays 12px at
 * every width. On phones the dots are closer together than a finger, so a tap anywhere on the plot picks the
 * nearest loop (the chips pick exactly), and only the picked loop is labelled.
 */
export function MoodMap() {
  const { key, tuning, loop, toggle, playing, bar } = useLab();
  const keyPc = pitchClassOf(key);
  const points = useMemo(() => moodPoints(), []);
  const [picked, setPicked] = useState(START);
  const current = points.find((p) => p.id === picked) ?? points[0];
  const playId = (id: string) => `mood:${id}`;

  const bars = (p: MoodPoint) =>
    loopBars(
      naturalLoop(p.degrees).flatMap((c) => {
        const v = easiestVoicing(degreeRoot(keyPc, c.degree), c.type, tuning);
        return v ? [shapeNotes(v.frets, tuning).filter((n): n is number => n !== null)] : [];
      }),
    );
  /** Picking a loop plays it (tap the playing one again to stop). */
  const pick = (p: MoodPoint) => {
    setPicked(p.id);
    if (playing !== playId(p.id)) toggle(playId(p.id), bars(p), true);
  };

  const star = loop.length ? placeScores(vibeOf(loop).brightness, vibeOf(loop).restlessness) : null;
  const quadrant = quadrantOf(current.bright, current.restless);

  return (
    <div className="grid grid-cols-1 gap-[16px] desktop:grid-cols-[minmax(0,1fr)_320px] desktop:items-start" data-mood>
      <div className="grid grid-cols-[18px_minmax(0,1fr)] gap-[6px]">
        <div aria-hidden="true" className="flex rotate-180 justify-between font-mono text-[12px] text-text-faint [writing-mode:vertical-rl]">
          <span>settled</span>
          <span>restless ↑</span>
        </div>
        <div
          data-plot
          role="group"
          aria-label="Mood map: tap a dot to hear that loop"
          className="relative aspect-square overflow-hidden rounded-outer border border-line bg-paper tablet:aspect-[4/3]"
          onClick={(e) => {
            if ((e.target as HTMLElement).closest("button")) return;
            const r = e.currentTarget.getBoundingClientRect();
            pick(nearestPoint(points, ((e.clientX - r.left) / r.width) * 100, ((e.clientY - r.top) / r.height) * 100));
          }}
        >
          {[
            ["Tense", "left-0 top-0"],
            ["Anthem", "right-0 top-0 text-right"],
            ["Brooding", "bottom-0 left-0 items-end"],
            ["Feel-good", "bottom-0 right-0 items-end justify-end text-right"],
          ].map(([name, place]) => (
            <span
              key={name}
              aria-hidden="true"
              className={`pointer-events-none absolute flex h-1/2 w-1/2 p-[10px] font-mono text-[12px] uppercase tracking-[0.08em] text-text-faint ${place} ${name === "Tense" || name === "Feel-good" ? "bg-line/20" : ""}`}
            >
              {name}
            </span>
          ))}
          <span aria-hidden="true" className="absolute inset-x-0 top-1/2 h-px bg-line-strong" />
          <span aria-hidden="true" className="absolute inset-y-0 left-1/2 w-px bg-line-strong" />
          {points.map((p) => {
            const on = p.id === picked;
            return (
              <button
                key={p.id}
                type="button"
                data-loop-id={p.id}
                aria-pressed={on}
                aria-label={`${p.id}, ${quadrantOf(p.bright, p.restless)}: hear it`}
                onClick={() => pick(p)}
                style={{ left: `${p.x}%`, top: `${p.y}%` }}
                className={`group absolute grid h-[44px] w-[44px] -translate-x-1/2 -translate-y-1/2 place-items-center max-tablet:pointer-events-none ${on ? "z-[2]" : "z-[1]"}`}
              >
                <i className={`block rounded-full border-2 border-paper ${on ? "h-[18px] w-[18px] bg-accent ring-4 ring-accent/20" : "h-[14px] w-[14px] bg-text-muted ring-1 ring-text-muted group-hover:bg-accent"}`} />
                <span
                  className={`pointer-events-none absolute top-1/2 -translate-y-1/2 whitespace-nowrap font-mono text-[12px] ${labelSide(p.x) === "left" ? "right-[36px]" : "left-[36px]"} ${
                    on ? "rounded-small border border-accent bg-surface px-[6px] py-[2px] font-bold text-text-primary" : "max-tablet:hidden text-text-secondary"
                  }`}
                >
                  {p.id}
                </span>
              </button>
            );
          })}
          {star && (
            <span data-star role="img" aria-label="Your loop from the Builder" className="pointer-events-none absolute z-[1] -translate-x-1/2 -translate-y-1/2" style={{ left: `${star.x}%`, top: `${star.y}%` }}>
              <Star />
            </span>
          )}
        </div>
        <div aria-hidden="true" className="col-start-2 flex justify-between font-mono text-[12px] text-text-faint">
          <span>← darker</span>
          <span>brighter →</span>
        </div>
        <p className="col-start-2 font-mono text-[12px] text-text-muted">Tap a dot to hear it. Tap empty space to hear the nearest.</p>
      </div>

      <div className="flex flex-col gap-[12px] rounded-outer border-[1.5px] border-ink bg-surface p-[14px] dark:border-line-strong" data-mood-panel>
        <GroupLabel>Picked loop</GroupLabel>
        <span className="font-display text-[26px] leading-none" data-picked>
          {current.id}
        </span>
        <span className="font-mono text-[12px] text-text-muted">{quadrant}{current.own ? " · one of the genre's ten" : ""}</span>
        <ul aria-label={`${current.id} in ${key}`} className="flex flex-wrap gap-[6px]">
          {current.degrees.map((d, i) => {
            const c = naturalLoop([d])[0];
            return (
              <li
                key={i}
                aria-current={playing === playId(current.id) && bar === i ? "true" : undefined}
                className={`flex min-w-[58px] flex-col items-center rounded-mid bg-chip-bg px-[8px] py-[4px] font-mono text-text-on-dark ${playing === playId(current.id) && bar === i ? "shadow-[inset_0_-4px_0_0_rgb(var(--color-accent-on-ink))]" : ""}`}
              >
                <span className="text-[12px] text-chip-tab">{d}</span>
                <b className="text-[13px]">{chordName(degreeRoot(keyPc, d), c.type)}</b>
              </li>
            );
          })}
        </ul>
        <Meter label="Dark to bright" value={current.bright} text={words(current.bright, "darker", "brighter")} />
        <Meter label="Settled to restless" value={current.restless} text={words(current.restless, "more settled", "more restless")} />
        <button
          type="button"
          aria-pressed={playing === playId(current.id)}
          onClick={() => toggle(playId(current.id), bars(current), true)}
          className="inline-flex min-h-[44px] items-center justify-center gap-[8px] rounded-mid bg-accent px-[14px] font-display text-[12.5px] text-text-on-accent shadow-button"
        >
          {playing === playId(current.id) ? <StopIcon size={11} /> : <PlayIcon size={11} filled />}
          {playing === playId(current.id) ? "STOP" : `HEAR IT IN ${key}`}
        </button>
        <span className="flex items-center gap-[6px] font-mono text-[12px] text-text-muted">
          <Star /> is your loop from the Builder{star ? "" : " (it's empty)"}.
        </span>
        <GroupLabel>All loops</GroupLabel>
        <ul aria-label="All loops" className="flex flex-wrap gap-[4px]">
          {points.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                data-chip={p.id}
                aria-pressed={p.id === picked}
                onClick={() => pick(p)}
                className={`min-h-[44px] rounded-mid border px-[10px] font-mono text-[12px] ${p.id === picked ? "border-ink bg-ink font-bold text-accent-on-ink" : "border-line bg-paper text-text-secondary hover:border-text-faintest"}`}
              >
                {p.id}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
