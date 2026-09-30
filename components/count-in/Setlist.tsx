"use client";

import { useEffect, useRef } from "react";
import { onScrollFrame, pinProgress, supportsScrollTimeline } from "@/components/count-in/scroll";

const STEPS = [
  { title: "Study the formula", body: "We break down the chord degrees, rhythm templates and section lengths behind pop-punk's biggest songs. We study the pattern underneath, never the tabs themselves.", poster: "ci-p1" },
  { title: "Generate your song", body: "Pick a key and a feel. Palm/Mute writes an intro, verse, chorus, solo and breakdown in E standard. A complete song structure, ready to play.", poster: "ci-p2" },
  { title: "Make it yours", body: "Everything is built fresh from chord degrees and rhythm patterns, so the song you get is yours to play, change and finish.", poster: "ci-p3" },
];

/** "How it works" as poster cards. From 834px up, vertical scrolling drives the cards sideways; phones stack them. */
export function Setlist({ reduced }: { reduced: boolean }) {
  const section = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const size = () => {
      const pinned = innerWidth >= 834 && !reduced;
      const shift = pinned ? Math.max(0, track.current!.scrollWidth - innerWidth) : 0;
      track.current!.style.setProperty("--shift", `${shift}px`);
      section.current!.style.height = pinned ? `${innerHeight + shift}px` : "";
    };
    size();
    addEventListener("resize", size);
    // --p: CSS scroll-driven (view timeline, contain range = the pinned stretch) where supported; JS elsewhere.
    const el = section.current!;
    const css = !reduced && supportsScrollTimeline();
    el.classList.toggle("ci-sda", css);
    const stop = css ? () => el.classList.remove("ci-sda") : onScrollFrame(() => el.style.setProperty("--p", pinProgress(el).toFixed(4)));
    return () => { removeEventListener("resize", size); stop(); };
  }, [reduced]);

  return (
    <section ref={section} className="ci-setlist" aria-labelledby="ci-setlist">
      <div className="ci-setlist-in">
        <div ref={track} className="ci-track">
          <div className="ci-panel ci-lead" data-reveal>
            <h2 id="ci-setlist">How it<br /><span>works.</span></h2>
            <div className="ci-go">
              <svg viewBox="0 0 40 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinejoin="round" aria-hidden="true"><path d="M0 12h34M23 2l12 10-12 10" /></svg>
              KEEP SCROLLING
            </div>
          </div>
          {STEPS.map((s, i) => (
            <article key={s.title} className={`ci-panel ci-poster ${s.poster}`} data-reveal>
              <span className="ci-tag">SONG {String(i + 1).padStart(2, "0")}</span>
              <div className="ci-big-no" aria-hidden="true">{String(i + 1).padStart(2, "0")}</div>
              <div><h3>{s.title}</h3><p>{s.body}</p></div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
