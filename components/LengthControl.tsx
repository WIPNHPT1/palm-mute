"use client";

import { useMemo } from "react";
import { type SongPlan, LENGTH, formatLength, planSong } from "@/lib/songLength";
import { type SectionId, formLabel } from "@/lib/songPlan";

/** "3 minutes 15 seconds", for the slider's screen-reader value. */
function spokenLength(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m} ${m === 1 ? "minute" : "minutes"}${s ? ` ${s} seconds` : ""}`;
}

/** What the song holds at this length, e.g. ["2 verses", "3 choruses", "Solo", "Breakdown"]. */
function contents(plan: SongPlan): string[] {
  const count = (id: SectionId) => plan.slots.filter((s) => s.section === id).length;
  const n = (k: number, one: string, many: string) => (k === 1 ? one : `${k} ${many}`);
  const out = [n(count("verse"), "1 verse", "verses"), n(count("chorus"), "1 chorus", "choruses")];
  if (count("prechorus")) out.push(n(count("prechorus"), "Pre-chorus", "pre-choruses"));
  if (count("intro") > 1) out.push("Intro reprise");
  out.push(count("solo") > 1 ? `${count("solo")} solos` : "Solo", "Breakdown", "Ending");
  return out;
}

/**
 * Step 4: how long the song runs, 2:30 to 5:30 (docs/song-builder-prd.md B2). The readout says what the
 * plan actually lands on at this tempo; the marks under the slider show where the form changes.
 */
export function LengthControl({
  seconds,
  plan,
  bpm,
  materialBars,
  onChange,
}: {
  seconds: number;
  plan: SongPlan;
  bpm: number;
  materialBars: (id: SectionId) => number;
  onChange: (seconds: number) => void;
}) {
  // Where along the slider the form changes, at this tempo (the first step of each new form).
  const marks = useMemo(() => {
    const out: { at: number; label: string }[] = [];
    let last = "";
    for (let t = LENGTH.min; t <= LENGTH.max; t += LENGTH.step) {
      const form = planSong(t, bpm, materialBars).form;
      if (form !== last) out.push({ at: (t - LENGTH.min) / (LENGTH.max - LENGTH.min), label: formLabel(form) });
      last = form;
    }
    return out;
  }, [bpm, materialBars]);

  return (
    <div className="flex min-w-0 flex-col gap-[6px]" data-length>
      <div className="flex flex-wrap items-baseline gap-x-[14px] gap-y-[4px]">
        <output htmlFor="song-length" className="font-display text-[34px] leading-none tracking-[-0.01em] tabular-nums" data-length-readout>
          {formatLength(plan.seconds)}
        </output>
        <span className="font-mono text-[12px] text-text-muted">
          {plan.bars} bars at {bpm} BPM · {formLabel(plan.form)}
          {Math.abs(plan.seconds - seconds) >= 5 ? ` · closest to ${formatLength(seconds)}` : ""}
        </span>
      </div>
      <input
        id="song-length"
        type="range"
        min={LENGTH.min}
        max={LENGTH.max}
        step={LENGTH.step}
        value={seconds}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="Song length"
        aria-valuetext={spokenLength(seconds)}
        className="h-[44px] w-full cursor-pointer accent-accent"
      />
      <div className="relative h-[16px] font-mono text-[12px] text-text-faint tablet:h-[34px]" aria-hidden="true">
        <span className="absolute left-0 top-0">{formatLength(LENGTH.min)}</span>
        <span className="absolute right-0 top-0">{formatLength(LENGTH.max)}</span>
        {/* Where the form changes: from tablet up (on a phone the labels would collide; the readout names the form). */}
        {marks.map((m, i) => (
          <span
            key={m.label + m.at}
            className="absolute top-[17px] hidden whitespace-nowrap text-brass tablet:inline"
            style={i === 0 ? { left: 0 } : m.at > 0.8 ? { right: `${(1 - m.at) * 100}%` } : { left: `${m.at * 100}%`, transform: "translateX(-50%)" }}
          >
            {m.label}
          </span>
        ))}
      </div>
      <ul className="flex flex-wrap gap-[4px]" aria-label="What the song holds">
        {contents(plan).map((c) => (
          <li key={c} className="rounded-small border border-line px-[6px] py-[1px] font-mono text-[12px] text-text-muted">
            {c}
          </li>
        ))}
      </ul>
    </div>
  );
}
