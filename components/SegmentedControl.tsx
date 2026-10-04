"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { onRovingKeyDown, rovingTabIndex } from "@/lib/hooks/rovingRadio";

export type SegmentOption<T extends string> = { value: T; label: string; sub?: string };

/**
 * Shared by the Lab's and the Generator's single-choice controls (tuning, handed, scale, feel…). The chosen segment's
 * ink is one thumb that slides (and settles with a small overshoot) from choice to choice over a recessed track.
 * Before the page has measured, and wherever no thumb can be placed, the chosen segment carries its own ink.
 */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  className = "",
  stretch = false,
  threePerRowOnPhones = false,
}: {
  label: string;
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  /** Equal-width segments that fill the control at every width (Chords Sort); otherwise they shrink to content from tablet up. */
  stretch?: boolean;
  /** Phones: wrap into rows of three (Chords Sort's six options, 3 + 3). */
  threePerRowOnPhones?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  const place = useCallback(() => {
    const on = box.current?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]');
    const next = on && on.offsetWidth ? { x: on.offsetLeft, y: on.offsetTop, w: on.offsetWidth, h: on.offsetHeight } : null;
    // Only a real move changes state (this runs after every render).
    setThumb((prev) => (prev === next || (prev && next && prev.x === next.x && prev.y === next.y && prev.w === next.w && prev.h === next.h) ? prev : next));
  }, []);
  // After every render (the value, the options or the labels changed) and whenever the control is resized.
  useLayoutEffect(place);
  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(place);
    ro.observe(el);
    document.fonts?.ready.then(place);
    return () => ro.disconnect();
  }, [place]);

  const style = thumb ? ({ "--tx": `${thumb.x}px`, "--ty": `${thumb.y}px`, "--tw": `${thumb.w}px`, "--th": `${thumb.h}px` } as React.CSSProperties) : undefined;
  return (
    <div
      ref={box}
      role="radiogroup"
      aria-label={label}
      onKeyDown={onRovingKeyDown}
      style={style}
      className={`sig-seg flex gap-[2px] rounded-[7px] border border-line bg-paper p-[3px] ${threePerRowOnPhones ? "flex-wrap tablet:flex-nowrap" : ""} ${className}`}
    >
      {thumb && <span className="sig-thumb" aria-hidden="true" />}
      {options.map((o, i) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={rovingTabIndex(active, options.some((x) => x.value === value), i)}
            onClick={() => onChange(o.value)}
            className={`min-h-[44px] flex-1 rounded-[5px] px-[4px] py-[5px] text-center font-mono ${
              stretch ? "tablet:px-[8px]" : "tablet:flex-none tablet:px-[14px]"
            } ${threePerRowOnPhones ? "basis-[calc((100%-4px)/3)] tablet:basis-0" : ""} ${
              active ? `${thumb ? "" : "bg-ink "}text-text-on-dark` : "text-text-muted hover:text-text-primary"
            }`}
          >
            <div className={`text-[12px] leading-[1.2] ${stretch ? "tablet:whitespace-nowrap" : ""} ${active ? "font-bold" : ""}`}>{o.label}</div>
            {o.sub && <div className={`mt-[2px] text-[12px] leading-[1.2] ${active ? "text-chip-tab" : "text-text-faint"}`}>{o.sub}</div>}
          </button>
        );
      })}
    </div>
  );
}
