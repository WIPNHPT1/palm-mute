"use client";

import { PlayIcon } from "@/components/icons/PlayIcon";
import { StopIcon } from "@/components/icons/StopIcon";
import { RegenerateIcon } from "@/components/icons/RegenerateIcon";

/** Rounded-rect pill (not a circle — that was tried and reverted). Full-width on mobile. */
export function GenerateButton({ onClick, label = "GENERATE" }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[48px] w-full items-center justify-center gap-[9px] rounded-outer sig-btn bg-accent px-[24px] py-[14px] font-display text-[12.5px] text-text-on-accent tablet:ml-auto tablet:w-auto tablet:shrink-0 tablet:py-[12px]"
    >
      <PlayIcon size={11} className="text-text-on-accent" />
      {label}
    </button>
  );
}

/** Plays the whole song once, top to bottom, at the selected feel: the song header's main button (solid red, as BUILD SONG). */
export function PlaySongButton({ playing, onClick }: { playing: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={playing}
      className="flex min-h-[48px] w-full items-center justify-center gap-[9px] order-first rounded-outer sig-btn bg-accent px-[24px] py-[12px] font-display text-[12.5px] text-text-on-accent tablet:order-none tablet:w-auto"
    >
      {playing ? <StopIcon size={11} className="text-text-on-accent" /> : <PlayIcon size={11} className="text-text-on-accent" />}
      {playing ? "STOP SONG" : "PLAY SONG"}
    </button>
  );
}

/** BUILD AGAIN: another take of the whole song on the same setup (the song header's sibling of PLAY SONG). */
export function RebuildButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[48px] w-full items-center justify-center gap-[9px] rounded-outer sig-btn-2 border-[1.5px] border-ink bg-surface px-[20px] py-[12px] font-display text-[12.5px] text-text-primary dark:border-line-strong tablet:w-auto"
    >
      <RegenerateIcon size={13} className="text-accent" />
      BUILD AGAIN
    </button>
  );
}
