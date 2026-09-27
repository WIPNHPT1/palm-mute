"use client";

import { useState } from "react";
import { ShuffleIcon } from "@/components/icons/ShuffleIcon";
import { INITIAL_TITLE, formatTitle, nextTitle } from "@/lib/titleGenerator";

/** "Stuck on a song title?" — shuffles from data/title-generator.json, never repeating back-to-back. */
export function SongTitleCard() {
  const [title, setTitle] = useState(INITIAL_TITLE);
  return (
    <div className="flex flex-1 flex-col justify-center gap-[8px] rounded-outer bg-ink px-[16px] py-[14px] text-text-on-dark tablet:gap-[10px] tablet:px-[20px] tablet:py-[16px]">
      <div className="flex items-center justify-between">
        <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-faint">Stuck on a song title?</div>
        <button type="button" onClick={() => setTitle((t) => nextTitle(t))} aria-label="Shuffle song title" title="Shuffle" className="text-accent transition-transform hover:rotate-45">
          <ShuffleIcon />
        </button>
      </div>
      <div aria-live="polite" className="font-display text-[15px] leading-[1.35] text-text-on-dark tablet:text-[17px]">
        {formatTitle(title)}
      </div>
      <div className="font-mono text-[10px] leading-[1.5] text-text-on-dark-faint tablet:text-[10.5px]">
        Every generated song gets a free, slightly dramatic title. Hit shuffle if it&apos;s not dramatic enough yet.
      </div>
    </div>
  );
}
