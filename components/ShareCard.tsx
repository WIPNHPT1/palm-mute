"use client";

import { useState } from "react";

/** Copies text, falling back to selecting it when the clipboard isn't allowed. Resolves true if copied. */
export async function copyText(text: string, select?: () => void): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    select?.();
    return false;
  }
}

/**
 * Share the song (docs/song-builder-prd.md premium P1): a link that holds the whole song, setup, takes,
 * options and locks, so whoever opens it gets exactly this song. No account, nothing stored anywhere.
 */
export function ShareCard({ link }: { link: string }) {
  const [status, setStatus] = useState("");
  const copy = async () => {
    const ok = await copyText(link, () => {
      const el = document.getElementById("share-link") as HTMLInputElement | null;
      el?.focus();
      el?.select();
    });
    setStatus(ok ? "Link copied." : "Couldn't copy: the link is selected, copy it from there.");
  };
  return (
    <div data-export="share" className="flex min-w-0 flex-col gap-[12px] rounded-outer border border-line bg-surface px-[16px] py-[14px] shadow-card tablet:col-span-2 tablet:px-[18px] tablet:py-[16px]">
      <h3 className="m-0 font-display text-[17px] leading-[1.3]">Share the song</h3>
      <p className="m-0 max-w-[62ch] font-mono text-[12px] leading-[1.6] text-text-muted">
        The link holds the whole song: key, feel, chords, length, every part&apos;s take and options, and what&apos;s locked. Whoever opens it hears exactly this. Nothing
        is stored anywhere.
      </p>
      <div className="flex flex-wrap items-center gap-[10px]">
        <label htmlFor="share-link" className="sr-only">
          Link to this song
        </label>
        <input
          id="share-link"
          readOnly
          value={link}
          onFocus={(e) => e.currentTarget.select()}
          className="min-h-[44px] min-w-0 flex-[1_1_260px] rounded-mid border border-line bg-paper px-[12px] font-mono text-[12px] text-text-secondary"
        />
        <button
          type="button"
          onClick={copy}
          className="flex min-h-[48px] items-center justify-center gap-[9px] rounded-outer border-[1.5px] border-ink bg-surface px-[20px] py-[12px] font-display text-[12.5px] text-text-primary transition-transform active:scale-[0.98] dark:border-line-strong"
        >
          COPY LINK
        </button>
      </div>
      <p className="m-0 min-h-[1.6em] font-mono text-[12px] text-text-faint" role="status">
        {status}
      </p>
    </div>
  );
}
