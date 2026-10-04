"use client";

import { type FeelId, feels, patternForFeel } from "@/lib/generator";
import { onRovingKeyDown, rovingTabIndex } from "@/lib/hooks/rovingRadio";

/**
 * The five feels, each with its own fixed tempo (feels.json; Mid-Tempo's slider was removed, DECISIONS.md).
 * Tablet and desktop: one row of segments. Phones: a list, one row per feel (name and BPM, then its strum).
 */
export function FeelToggle({ feel, onFeelChange }: { feel: FeelId; onFeelChange: (feel: FeelId) => void }) {
  return (
    <div className="flex flex-col gap-[10px]">
      <div role="radiogroup" aria-label="Feel" onKeyDown={onRovingKeyDown} className="flex flex-col gap-[2px] rounded-[7px] border border-line bg-paper p-[3px] tablet:flex-row">
        {feels.map((f, i) => {
          const active = f.id === feel;
          const pattern = patternForFeel(f.id);
          const bpm = f.displayBpm;
          return (
            <div key={f.id} className={`rounded-[5px] tablet:flex-auto ${active ? "bg-ink text-text-on-dark dark:shadow-[inset_0_0_0_1px_theme(colors.line-strong)]" : ""}`}>
              <button
                type="button"
                role="radio"
                aria-checked={active}
                tabIndex={rovingTabIndex(active, true, i)}
                onClick={() => onFeelChange(f.id)}
                className={`grid min-h-[48px] w-full grid-cols-[1fr_auto] items-center gap-x-[10px] gap-y-[2px] rounded-[5px] px-[12px] py-[7px] text-left font-mono text-[12px] leading-[1.3] tablet:flex tablet:min-h-[44px] tablet:flex-col tablet:justify-center tablet:gap-[2px] tablet:px-[14px] tablet:py-[5px] tablet:text-center tablet:leading-[1.2] tablet:whitespace-nowrap ${
                  active ? "" : "text-text-muted hover:text-text-primary"
                }`}
              >
                <span className={active ? "font-bold" : ""}>{f.label}</span>
                <span className={active ? "text-chip-tab" : "text-text-faint"}>{bpm} BPM</span>
                <span className={`col-span-2 flex gap-[10px] tablet:hidden ${active ? "text-chip-tab" : "text-text-faint"}`}>
                  <span>{pattern.name}</span>
                  <span aria-hidden="true" className={`tracking-[2px] ${active ? "text-accent-on-ink" : "text-accent"}`}>
                    {pattern.glyphs.join("")}
                  </span>
                </span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
