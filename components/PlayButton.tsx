"use client";

import { PlayIcon } from "@/components/icons/PlayIcon";
import { StopIcon } from "@/components/icons/StopIcon";

/**
 * 44×44 play/stop toggle around a small icon. The triangle is outlined until something is actually
 * playing; then it becomes a filled stop square (audit: a filled icon read as "playing" when nothing was).
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
      className={`sig-play flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full ${
        playing ? "text-accent" : "text-text-muted hover:text-text-primary"
      } ${className}`}
    >
      <svg className="sig-ring" viewBox="0 0 44 44" aria-hidden="true">
        <circle className="sig-ring-track" cx="22" cy="22" r="19" />
        <circle className="sig-ring-prog" cx="22" cy="22" r="19" />
      </svg>
      {playing ? <StopIcon size={iconSize} /> : <PlayIcon size={iconSize} filled={false} />}
    </button>
  );
}
