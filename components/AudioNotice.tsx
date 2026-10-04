"use client";

import { useEffect, useState } from "react";
import { onSoundBlocked } from "@/lib/audio/engine";

/**
 * One notice for the whole site: when a play button can't start sound (the browser has no Web Audio, or it
 * stays suspended after the tap), play used to do nothing at all. Now it says so, and how to fix the usual
 * cause on a phone. It clears itself the next time sound starts, and can be dismissed.
 */
export function AudioNotice() {
  const [blocked, setBlocked] = useState(false);
  useEffect(() => onSoundBlocked(setBlocked), []);
  if (!blocked) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[84px] z-40 flex justify-center px-[16px]">
      <div
        role="status"
        data-audio-notice
        className="sig-notice pointer-events-auto flex max-w-[560px] flex-wrap items-center gap-x-[12px] gap-y-[4px] rounded-outer border-[1.5px] border-accent bg-surface px-[14px] py-[8px] font-mono text-[12px] leading-[1.5] text-text-primary shadow-card"
      >
        <svg className="sig-notice-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 9v6h4l5 4V5L8 9H4Z" />
          <path d="m17 9 4 6m0-6-4 6" />
        </svg>
        <span>Couldn&apos;t start sound. On iPhone, turn off Silent mode and tap play again.</span>
        <button type="button" onClick={() => setBlocked(false)} className="ml-auto min-h-[44px] min-w-[44px] sig-btn-2 px-[12px] font-bold">
          DISMISS
        </button>
      </div>
    </div>
  );
}
