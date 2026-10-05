"use client";

import { onRovingKeyDown, rovingTabIndex } from "@/lib/hooks/rovingRadio";
import { useEffect, useRef } from "react";
import { PlayIcon } from "@/components/icons/PlayIcon";
import { StopIcon } from "@/components/icons/StopIcon";
import type { Practice } from "@/context/GeneratorContext";
import { formatLength } from "@/lib/songLength";

const SPEEDS = [1, 0.9, 0.75, 0.5];

/**
 * The tape-deck transport (docs/song-builder-prd.md premium P3): fixed to the bottom of the Generator. Play or
 * stop the song, where it is (part, time, bar), loop the part playing, a bar of clicks first, and practice
 * speed. One row at every width: below 1280px the progress is a hairline on its top edge; phones get icon
 * buttons and one speed button that cycles. The page's bottom padding follows its height, so it never covers
 * the last of the page. It sits under the menu (z-index 40) and the header (50).
 */
export function Transport({
  playing,
  onPlay,
  partName,
  songBar,
  totalBars,
  barSeconds,
  practice,
  onSpeed,
  onCountIn,
  onLoopPart,
}: {
  playing: boolean;
  onPlay: () => void;
  partName: string | null;
  songBar: number | null;
  totalBars: number;
  barSeconds: number;
  practice: Practice;
  onSpeed: (speed: number) => void;
  onCountIn: (on: boolean) => void;
  onLoopPart: (on: boolean) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => (document.body.style.paddingBottom = `${Math.ceil(el.getBoundingClientRect().height)}px`);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => {
      ro.disconnect();
      document.body.style.paddingBottom = "";
    };
  }, []);

  const elapsed = songBar === null ? 0 : songBar * barSeconds;
  const total = totalBars * barSeconds;
  const share = songBar === null ? 0 : Math.min(1, songBar / totalBars);
  const pct = `${Math.round(practice.speed * 100)}%`;
  const toggle = "inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-[6px] rounded-mid border px-[10px] font-mono text-[12px] tracking-[0.06em] tablet:px-[12px]";
  const on = "border-text-on-dark-faint bg-ink-soft text-text-on-dark";
  const off = "border-ink-soft text-text-on-dark-muted hover:text-text-on-dark";

  return (
    <div
      ref={ref}
      role="region"
      aria-label="Playback"
      data-transport
      className="sig-stage-light glass-smoke fixed inset-x-0 bottom-0 z-30 bg-ink px-[12px] pb-[calc(8px+env(safe-area-inset-bottom,0px))] pt-[8px] text-text-on-dark shadow-[0_-10px_24px_-12px_rgba(23,19,16,0.45)] min-[400px]:px-[20px] tablet:px-[32px] desktop:px-[56px] dark:border-t dark:border-line-strong"
    >
      {/* Progress: a hairline on the top edge below 1280px. */}
      <div className="absolute inset-x-0 top-0 h-[3px] bg-ink-soft desktop:hidden" aria-hidden="true">
        <div className="h-full bg-accent" style={{ width: `${share * 100}%` }} />
      </div>
      <div className="mx-auto flex max-w-[1328px] items-center gap-[8px] tablet:gap-[12px]">
        <button
          type="button"
          onClick={onPlay}
          aria-pressed={playing}
          aria-label={playing ? "Stop the song" : "Play the song"}
          className="sig-play flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-mid text-accent-on-ink"
        >
          {playing ? <StopIcon size={18} /> : <PlayIcon size={20} />}
        </button>
        <div className="flex min-w-0 flex-auto flex-col leading-[1.3] desktop:flex-none desktop:basis-[200px]" aria-live="off">
          <b className="truncate font-mono text-[12px]" data-transport-part>
            {partName ?? "Ready"}
            {practice.loopPart && partName ? " · looping" : ""}
          </b>
          {/* The narrowest phones show the time alone; the total, bar and speed join from 400px up. */}
          <span className="truncate font-mono text-[12px] tabular-nums text-text-on-dark-faint" data-transport-time>
            {formatLength(elapsed)}
            <span className="hidden min-[400px]:inline">
              {` / ${formatLength(total)}`}
              {songBar !== null ? ` · bar ${songBar + 1}` : ""}
              {practice.speed < 1 ? ` · ${pct}` : ""}
            </span>
          </span>
        </div>
        <div className="relative hidden h-[6px] min-w-0 flex-1 overflow-hidden rounded-[3px] bg-ink-soft desktop:block" aria-hidden="true">
          <div className="h-full bg-accent" style={{ width: `${share * 100}%` }} />
        </div>
        <div className="flex shrink-0 items-center gap-[6px]">
          <button type="button" onClick={() => onLoopPart(!practice.loopPart)} aria-pressed={practice.loopPart} aria-label="Loop the part" className={`${toggle} ${practice.loopPart ? on : off}`}>
            <svg className="w-[14px] h-[14px]" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M17 2l3 3-3 3M4 11V9a4 4 0 0 1 4-4h12M7 22l-3-3 3-3M20 13v2a4 4 0 0 1-4 4H4" />
            </svg>
            <span className="hidden tablet:inline">LOOP PART</span>
          </button>
          <button type="button" onClick={() => onCountIn(!practice.countIn)} aria-pressed={practice.countIn} aria-label="Count-in" className={`${toggle} ${practice.countIn ? on : off}`}>
            <span className="tablet:hidden" aria-hidden="true">1234</span>
            <span className="hidden tablet:inline">COUNT-IN</span>
          </button>
          {/* Phones: one button that cycles the speeds. */}
          <button
            type="button"
            onClick={() => onSpeed(SPEEDS[(SPEEDS.indexOf(practice.speed) + 1) % SPEEDS.length])}
            aria-label={`Practice speed ${pct}, tap to change`}
            className={`${toggle} ${practice.speed < 1 ? on : off} tabular-nums tablet:hidden`}
          >
            {pct}
          </button>
          <span className="hidden font-mono text-[12px] tracking-[0.08em] text-text-on-dark-faint desktop:inline">SPEED</span>
          <div role="radiogroup" aria-label="Practice speed" onKeyDown={onRovingKeyDown} className="hidden gap-[2px] rounded-[7px] border border-ink-soft p-[3px] tablet:flex">
            {SPEEDS.map((sp, i) => (
              <button
                key={sp}
                type="button"
                role="radio"
                aria-checked={practice.speed === sp}
                tabIndex={rovingTabIndex(practice.speed === sp, SPEEDS.includes(practice.speed), i)}
                onClick={() => onSpeed(sp)}
                className={`min-h-[44px] min-w-[44px] rounded-[5px] px-[6px] font-mono text-[12px] tabular-nums ${practice.speed === sp ? "sig-on bg-text-on-dark font-bold text-ink" : "text-text-on-dark-muted hover:text-text-on-dark"}`}
              >
                {Math.round(sp * 100)}%
              </button>
            ))}
          </div>
          <span className="hidden font-mono text-[12px] text-text-on-dark-faint [@media(hover:hover)_and_(min-width:1280px)]:inline" data-shortcuts>
            <kbd className="rounded-[3px] border border-ink-soft px-[4px] font-mono">Space</kbd> play · <kbd className="rounded-[3px] border border-ink-soft px-[4px] font-mono">R</kbd> build again
          </span>
        </div>
      </div>
    </div>
  );
}
