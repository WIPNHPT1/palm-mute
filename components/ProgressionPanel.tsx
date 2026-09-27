"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { PlayButton } from "@/components/PlayButton";
import { type NoteName, type Progression, keyDisplayName, resolveProgression } from "@/lib/musicTheory";

/**
 * Opens under a Chords page card: what the progression is, a play toggle, and "Use in my song", which
 * sends the key and the progression (as the Chorus) to the Generator. Esc closes it.
 */
export function ProgressionPanel({
  id,
  progression,
  keyName,
  playing,
  onTogglePlay,
  onUseInSong,
  onClose,
  className = "",
}: {
  id: string;
  progression: Progression;
  keyName: NoteName;
  playing: boolean;
  onTogglePlay: () => void;
  onUseInSong: () => void;
  onClose: () => void;
  className?: string;
}) {
  const [sent, setSent] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const chords = resolveProgression(keyName, progression.id);
  const key = keyDisplayName(keyName);

  // A different card or key is a fresh hand-off.
  useEffect(() => setSent(false), [progression.id, keyName]);

  return (
    <div
      id={id}
      ref={panel}
      role="region"
      aria-label={`${progression.id} in ${key}`}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onClose();
        }
      }}
      className={`col-span-full flex flex-col gap-[12px] rounded-outer border-[1.5px] border-accent bg-surface p-[16px] shadow-card-highlight tablet:p-[20px] ${className}`}
    >
      <div className="flex items-start justify-between gap-[12px]">
        <div>
          <h2 className="font-display text-[14px] tablet:text-[16px]">
            {progression.id} <span className="text-text-muted">in {key}</span>
          </h2>
          <p className="mt-[4px] font-mono text-[12px] leading-[1.5] text-text-muted">
            {chords.map((c, i) => `${progression.degrees[i]} = ${c.name}`).join(" · ")}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="-mr-[10px] -mt-[10px] flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-mid text-text-muted hover:text-text-primary"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M2 2l10 10M12 2 2 12" />
          </svg>
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-[10px]">
        <div className="flex items-center rounded-mid border border-line bg-paper pr-[12px]">
          <PlayButton playing={playing} onClick={onTogglePlay} label={progression.id} />
          <span className="font-mono text-[12px] text-text-muted" aria-hidden="true">
            {playing ? "Playing" : "Listen"}
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            onUseInSong();
            setSent(true);
          }}
          className="min-h-[44px] rounded-outer bg-accent px-[18px] font-display text-[12.5px] text-text-on-accent shadow-button"
        >
          USE IN MY SONG
        </button>
        <p role="status" className="font-mono text-[12px] text-text-muted">
          {sent && (
            <>
              Chorus set to {progression.id} in {key}.{" "}
              <Link href="/generator/" className="inline-flex min-h-[44px] items-center text-accent underline underline-offset-4">
                Open the Generator
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
