"use client";

import { PlayIcon } from "@/components/icons/PlayIcon";
import { StopIcon } from "@/components/icons/StopIcon";

/**
 * 44×44 play/stop toggle: just the icon, no circle round it (owner's call), with the full 44px to tap. The triangle
 * is outlined until something is actually playing; then it becomes a filled red stop square (audit: a filled icon
 * read as "playing" when nothing was).
 */
export function PlayButton({
  playing,
  onClick,
  label,
  iconSize = 13,
  className = "",
}: {
  playing: boolean;
  onClick: () => void;
  /** What's played, e.g. "I-V-vi-IV" → "Play I-V-vi-IV" / "Stop I-V-vi-IV". */
  label: string;
  iconSize?: number;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={playing}
      aria-label={`${playing ? "Stop" : "Play"} ${label}`}
      data-playing={playing}
      className={`sig-play flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-mid ${
        playing ? "text-accent" : "text-text-muted hover:text-text-primary"
      } ${className}`}
    >
      {playing ? <StopIcon size={iconSize} /> : <PlayIcon size={iconSize} filled={false} />}
    </button>
  );
}
