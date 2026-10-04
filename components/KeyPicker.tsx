"use client";

import { onRovingKeyDown, rovingTabIndex } from "@/lib/hooks/rovingRadio";
import { PITCH_CLASSES, type NoteName, enharmonicOf } from "@/lib/musicTheory";

// Display order starts at A, matching the mockups.
const KEY_ORDER: NoteName[] = [...PITCH_CLASSES.slice(9), ...PITCH_CLASSES.slice(0, 9)];

export function KeyPicker({ value, onChange }: { value: NoteName; onChange: (key: NoteName) => void }) {
  return (
    <div role="radiogroup" aria-label="Key" onKeyDown={onRovingKeyDown} className="flex flex-wrap items-center gap-[5px]">
      {KEY_ORDER.map((k, i) => {
        const selected = k === value;
        const flat = enharmonicOf(k);
        return (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={rovingTabIndex(selected, true, i)}
            aria-label={flat ? `${k} / ${flat}` : k}
            onClick={() => onChange(k)}
            className={`flex h-[44px] w-[44px] shrink-0 flex-col items-center justify-center rounded-mid border font-mono ${
              selected ? "border-ink bg-ink text-accent-on-ink" : "border-line bg-paper hover:border-text-faintest"
            } ${flat ? `text-[12px] leading-[1.1] ${selected ? "font-bold" : "text-text-muted"}` : `text-[14px] ${selected ? "font-bold" : "text-text-muted"}`}`}
          >
            {flat ? (
              <>
                <span>{k}</span>
                <span>{flat}</span>
              </>
            ) : (
              k
            )}
          </button>
        );
      })}
    </div>
  );
}
