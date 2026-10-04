"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { FlapText } from "@/components/FlapText";
import { PUNK_MASTER_BPM } from "@/lib/generator";

/** One beat at the punk master tempo (180 BPM: a third of a second). */
const BEAT_MS = Math.round(60000 / PUNK_MASTER_BPM);

/**
 * Closing call to action; the buttons lean toward the pointer on desktop. As it arrives, the drummer counts it in
 * (owner's pick, docs/mockups/home-stage-options.html): 1 · 2 · 3 · 4 flash in red on the beat, then "Count it in."
 * flips in. Once per visit; with reduced motion (or no IntersectionObserver) the heading is simply there.
 */
export function Encore({ fine }: { fine: boolean }) {
  const section = useRef<HTMLElement>(null);
  // 0 before the count, 1–4 on the beats, 5 once the heading has its cue
  const [beat, setBeat] = useState(0);
  useEffect(() => {
    const el = section.current;
    if (!el || typeof IntersectionObserver === "undefined" || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timers: number[] = [];
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        for (let n = 1; n <= 5; n++) timers.push(window.setTimeout(() => setBeat(n), (n - 1) * BEAT_MS));
      },
      { rootMargin: "0px 0px -40% 0px" },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      timers.forEach((t) => clearTimeout(t));
    };
  }, []);

  const lean = (e: React.PointerEvent<HTMLElement>) => {
    if (!fine) return;
    const b = e.currentTarget, r = b.getBoundingClientRect();
    b.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.25}px, ${(e.clientY - r.top - r.height / 2) * 0.35}px)`;
  };
  const settle = (e: React.PointerEvent<HTMLElement>) => { e.currentTarget.style.transform = ""; };
  const row = (text: string) => <><span>{text}&nbsp;</span><span>{text}&nbsp;</span></>;

  return (
    <section ref={section} className="ci-encore" aria-labelledby="ci-encore" data-count={beat} data-quiet>
      <div className="ci-encore-bg" aria-hidden="true">
        <div>{row("START WRITING ✦ START WRITING ✦ START WRITING ✦")}</div>
        <div>{row(`E STANDARD ✦ ${PUNK_MASTER_BPM} BPM ✦ E STANDARD ✦ ${PUNK_MASTER_BPM} BPM ✦`)}</div>
      </div>
      <div className="ci-count" aria-hidden="true">
        {beat >= 1 && beat <= 4 && <span key={beat}>{beat}</span>}
      </div>
      <div className="ci-wrap" data-reveal>
        <h2 id="ci-encore"><FlapText text="Count it in." go={beat >= 5} /></h2>
        <div className="ci-encore-btns">
          <Link className="ci-mag solid" href="/generator/" onPointerMove={lean} onPointerLeave={settle}>
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M5 3l14 9-14 9z" /></svg>START WRITING
          </Link>
          <Link className="ci-mag line" href="/chords/" onPointerMove={lean} onPointerLeave={settle}>OPEN THE CHORD LAB</Link>
        </div>
      </div>
    </section>
  );
}
