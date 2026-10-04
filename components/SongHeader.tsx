"use client";

import type { ReactNode } from "react";

/**
 * The built song's name and facts: its title on a split-flap board (the Count In title board's colours),
 * then key, feel, tempo, progression, length and form. `actions` holds PLAY SONG.
 */
export function SongHeader({ title, facts, detail, actions }: { title: string; facts: string; detail: string; actions: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-[18px] gap-y-[12px]" data-song-header>
      <h2 className="m-0 flex max-w-full flex-wrap gap-x-[14px] gap-y-[3px] rounded-mid bg-board p-[6px]" aria-label={title}>
        {title.split(" ").map((word, w) => (
          <span key={w} className="flex gap-[3px]" aria-hidden="true">
            {[...word.toUpperCase()].map((ch, i) => (
              <span
                key={i}
                className="relative min-w-[1.1em] rounded-[3px] bg-board-cell px-[3px] py-[5px] text-center font-display text-[15px] leading-[1.1] text-text-on-dark after:absolute after:inset-x-0 after:top-1/2 after:h-px after:bg-board tablet:text-[20px] desktop:text-[24px]"
              >
                {ch}
              </span>
            ))}
          </span>
        ))}
      </h2>
      <p className="m-0 font-mono text-[12px] leading-[1.6] text-text-muted">
        <b className="text-text-primary">{facts}</b>
        <br />
        {detail}
      </p>
      <div className="flex flex-wrap gap-[10px] tablet:ml-auto">{actions}</div>
    </div>
  );
}
