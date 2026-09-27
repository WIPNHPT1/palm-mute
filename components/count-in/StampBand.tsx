"use client";

import { useEffect, useRef } from "react";

/** Originality promise; the stamp slams down on reveal and shakes the band. */
export function StampBand() {
  const band = useRef<HTMLElement>(null);
  const stamp = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = stamp.current!;
    let timer = 0;
    const onReveal = () => {
      timer = window.setTimeout(() => {
        band.current?.classList.add("ci-shake");
        band.current?.addEventListener("animationend", () => band.current?.classList.remove("ci-shake"), { once: true });
      }, 420);
    };
    el.addEventListener("reveal", onReveal);
    return () => { el.removeEventListener("reveal", onReveal); clearTimeout(timer); };
  }, []);

  return (
    <section ref={band} className="ci-stamp-band" aria-labelledby="ci-promise">
      <div className="ci-wrap ci-stamp-grid">
        <div data-reveal>
          <h2 id="ci-promise">Our originality promise</h2>
          <p>Palm/Mute never stores or reproduces an artist&apos;s tab. Songs are generated from chord degrees and rhythm patterns only, so what you play is written for you.</p>
        </div>
        <div ref={stamp} className="ci-stamp" data-reveal aria-hidden="true">
          <svg className="ci-stamp-ring" viewBox="0 0 300 300">
            <defs><path id="ci-sring" d="M150 150m-122 0a122 122 0 1 1 244 0a122 122 0 1 1-244 0" /></defs>
            <circle cx="150" cy="150" r="146" fill="none" stroke="currentColor" strokeWidth="4" />
            <circle cx="150" cy="150" r="100" fill="none" stroke="currentColor" strokeWidth="2" />
            <text><textPath href="#ci-sring" textLength="752" lengthAdjust="spacing">NO TABS STORED ✦ CHORD PATTERNS ONLY ✦</textPath></text>
          </svg>
          <div className="ci-stamp-core"><div>100%<br />ORIGINAL<small>PALM/MUTE</small></div></div>
        </div>
      </div>
    </section>
  );
}
