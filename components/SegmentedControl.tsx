"use client";

import { onRovingKeyDown, rovingTabIndex } from "@/lib/hooks/rovingRadio";

export type SegmentOption<T extends string> = { value: T; label: string; sub?: string };

/** Shared by the Lab's and the Generator's single-choice controls (tuning, handed, scale, feel…). */
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
  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={onRovingKeyDown}
      className={`flex gap-[2px] rounded-[7px] border border-line bg-paper p-[3px] ${threePerRowOnPhones ? "flex-wrap tablet:flex-nowrap" : ""} ${className}`}
    >
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
              active ? "bg-ink text-text-on-dark" : "text-text-muted hover:text-text-primary"
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
