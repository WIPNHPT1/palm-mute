"use client";

export type SegmentOption<T extends string> = { value: T; label: string; sub?: string };

/** Shared by the Feel toggle (Generator) and the Sort toggle (Chords). */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  className = "",
  stretchOnTablet = false,
}: {
  label: string;
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  /** Keep segments equal-width at tablet too (Chords Sort); Feel shrinks to content from tablet up. */
  stretchOnTablet?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={`flex gap-[2px] rounded-[7px] border border-line bg-paper p-[3px] ${className}`}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`flex-1 rounded-[5px] px-[4px] py-[6px] text-center font-mono tablet:px-[14px] ${stretchOnTablet ? "desktop:flex-none" : "tablet:flex-none"} ${
              active ? "bg-ink text-text-on-dark" : "text-text-muted hover:text-text-primary"
            }`}
          >
            <div className={`text-[10px] tablet:text-[11.5px] ${active ? "font-bold" : ""}`}>{o.label}</div>
            {o.sub && <div className={`mt-[2px] text-[8.5px] tablet:text-[9px] ${active ? "text-chip-tab" : "text-text-faintest"}`}>{o.sub}</div>}
          </button>
        );
      })}
    </div>
  );
}
