"use client";

import { LockIcon } from "@/components/icons/LockIcon";
import { type FormSlot, VARIATIONS } from "@/lib/songPlan";

/**
 * The song's running order (Song Engine v2, option A from docs/mockups/song-form.html): one part per
 * slot of the form, sized by its length (one row from desktop up; it wraps on narrower screens). Red = sounding now, as everywhere on the page;
 * tapping a part plays the song from there.
 */
export function FormStrip({
  parts,
  activePart,
  locked,
  onPlayFrom,
}: {
  parts: { slot: FormSlot; bars: number }[];
  activePart: number | null;
  locked: (slot: FormSlot) => boolean;
  onPlayFrom: (part: number) => void;
}) {
  return (
    <nav aria-label="Song running order" data-form-strip>
      <ol className="flex flex-wrap gap-[4px] rounded-outer bg-ink p-[6px] desktop:flex-nowrap dark:shadow-[inset_0_0_0_1px] dark:shadow-line-strong">
        {parts.map(({ slot, bars }, i) => {
          const active = activePart === i;
          const variation = slot.variation ? VARIATIONS[slot.variation].label : null;
          return (
            // Each part is at least as wide as its name; the space left over is shared by length (bars).
            <li key={i} className="flex" style={{ flex: `${bars} 1 auto` }}>
              <button
                type="button"
                onClick={() => onPlayFrom(i)}
                data-active={active}
                aria-current={active ? "step" : undefined}
                aria-label={`Play the song from ${slot.name} (${bars} ${bars === 1 ? "bar" : "bars"}${variation ? `, ${variation}` : ""})`}
                className={`flex min-h-[44px] w-full min-w-0 flex-col justify-center rounded-[5px] px-[8px] py-[5px] text-left font-mono text-[12px] leading-[1.25] transition-colors ${
                  active ? "bg-accent text-text-on-accent" : "bg-ink-soft text-text-on-dark-muted hover:bg-ink-mid"
                }`}
              >
                <span className="whitespace-nowrap font-bold">{slot.name}</span>
                <span className={`flex items-center gap-[4px] whitespace-nowrap ${active ? "" : "text-text-on-dark-faint"}`}>
                  {locked(slot) && <LockIcon size={10} />}
                  {bars} {bars === 1 ? "bar" : "bars"}
                </span>
                {variation && <span className={`whitespace-nowrap ${active ? "" : "text-brass"}`}>+ {variation}</span>}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
