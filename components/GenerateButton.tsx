"use client";

import { PlayIcon } from "@/components/icons/PlayIcon";

/** Rounded-rect pill (not a circle — that was tried and reverted). Full-width on mobile. */
export function GenerateButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-center gap-[9px] rounded-outer bg-accent px-[24px] py-[14px] font-display text-[12.5px] text-text-on-accent shadow-button transition-transform active:scale-[0.98] tablet:ml-auto tablet:w-auto tablet:py-[12px]"
    >
      <PlayIcon size={11} className="text-text-on-accent" />
      GENERATE
    </button>
  );
}
