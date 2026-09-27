"use client";

import { PITCH_CLASSES, type NoteName, enharmonicOf } from "@/lib/musicTheory";

// Display order starts at A, matching the mockups.
const KEY_ORDER: NoteName[] = [...PITCH_CLASSES.slice(9), ...PITCH_CLASSES.slice(0, 9)];

export function KeyPicker({ value, onChange }: { value: NoteName; onChange: (key: NoteName) => void }) {
  return (
    <div role="radiogroup" aria-label="Key" className="flex flex-wrap items-center gap-[5px]">
      {KEY_ORDER.map((k) => {
        const selected = k === value;
        const flat = enharmonicOf(k);
        return (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={flat ? `${k} / ${flat}` : k}
            onClick={() => onChange(k)}
            className={`flex h-[27px] w-[33px] shrink-0 flex-col items-center justify-center rounded-mid border font-mono tablet:w-[34px] ${
              selected ? "border-ink bg-ink text-accent" : "border-line bg-paper hover:border-text-faintest"
            } ${flat ? `text-[7px] leading-[1.25] ${selected ? "font-bold" : "text-text-faint"}` : `text-[11.5px] ${selected ? "font-bold" : "text-text-muted"}`}`}
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
