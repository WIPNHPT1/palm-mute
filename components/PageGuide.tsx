"use client";

import { useEffect, useState, type ReactNode } from "react";
import { type GuidePage, guideHiddenClass, guideStorageKey } from "@/lib/guide";

export type GuideStep = { title: string; body: ReactNode };

// Poster colours, in order (Count In's "How it works" posters): ink, red, outlined, brass.
const POSTERS = ["guide-ink", "guide-red", "guide-outline", "guide-brass"] as const;

/**
 * "How to use" as four tilted poster cards under a page title (Count In style, owner's pick). "Hide the
 * guide" is remembered per page and applied before first paint (lib/guide.ts GUIDE_SCRIPT); a small
 * "How to use" button brings it back. Visibility is driven by a class on <html>, so there's no flash.
 */
export function PageGuide({ page, label, steps, signature }: { page: GuidePage; label: string; steps: GuideStep[]; signature: string }) {
  const hiddenClass = guideHiddenClass(page);
  const [hidden, setHidden] = useState(false);
  useEffect(() => setHidden(document.documentElement.classList.contains(hiddenClass)), [hiddenClass]);

  const set = (hide: boolean) => {
    document.documentElement.classList.toggle(hiddenClass, hide);
    setHidden(hide);
    try {
      localStorage.setItem(guideStorageKey(page), hide ? "hidden" : "shown");
    } catch {
      // storage unavailable: the choice lasts for this visit
    }
  };

  return (
    <section aria-label={label} data-guide={page} className="guide">
      <ol className="guide-posters">
        {steps.map((s, i) => (
          <li key={s.title} className={`guide-poster ${POSTERS[i % POSTERS.length]}`}>
            <span className="guide-tag">STEP {String(i + 1).padStart(2, "0")}</span>
            <span className="guide-no" aria-hidden="true">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="relative z-[1]">
              <h2 className="guide-title">{s.title}</h2>
              <p className="guide-body">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="guide-foot">
        <span className="guide-sig">{signature}</span>
        <button type="button" className="guide-toggle guide-hide" onClick={() => set(true)} aria-expanded={!hidden}>
          HIDE THE GUIDE <span aria-hidden="true">✕</span>
        </button>
      </div>
      <button type="button" className="guide-toggle guide-show" onClick={() => set(false)} aria-expanded={!hidden}>
        <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <circle cx="8" cy="8" r="6.5" />
          <path d="M6.2 6.2a1.9 1.9 0 1 1 2.6 1.8c-.5.2-.8.6-.8 1.1v.4M8 11.6v.1" strokeLinecap="round" />
        </svg>
        HOW TO USE
      </button>
    </section>
  );
}
