"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { Strings } from "@/components/count-in/Strings";
import { clamp01, onScrollFrame, supportsScrollTimeline } from "@/components/count-in/scroll";
import { designUnit } from "@/lib/designUnit";
import { PUNK_MASTER_BPM } from "@/lib/generator";

/**
 * Opening screen. The headline has two drawn layouts with designed line breaks (4 lines from 834px up,
 * 6 on phones); its font size is fitted to the widest line so nothing ever runs past the column.
 * Every line is no-wrap, so "POP-PUNK." can't split.
 */
export function Stage({ reduced, fine }: { reduced: boolean; fine: boolean }) {
  const stage = useRef<HTMLElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const kin = useRef<HTMLHeadingElement>(null);
  const spot = useRef<HTMLDivElement>(null);

  // fit the headline to its column
  useEffect(() => {
    const fit = () => {
      // fonts.ready can resolve after you've already left the page
      if (!kin.current || !wrap.current) return;
      const w = innerWidth, set = kin.current!.querySelector<HTMLElement>(w < 834 ? ".ci-kin-narrow" : ".ci-kin-wide")!;
      const cw = wrap.current!.clientWidth - 6; // allowance for the outline stroke
      // indents are a share of the content column, so wide screens keep the same proportions
      const indents = w >= 834 ? [0, cw * (w >= 1280 ? 0.05 : 0.03), 0, cw * (w >= 1280 ? 0.09 : 0.06)] : [];
      set.style.setProperty("--in2", `${indents[1] ?? 0}px`);
      set.style.setProperty("--in4", `${indents[3] ?? 0}px`);
      kin.current!.style.setProperty("--kin-size", "100px");
      const lines = [...set.querySelectorAll<HTMLElement>(".ci-kl")];
      const widths = lines.map((l) => (l.firstElementChild as HTMLElement).offsetWidth);
      const u = designUnit(); // the size caps are design pixels
      const max = (w >= 1280 ? 150 : w >= 834 ? 120 : 80) * u;
      let size = Math.max(24 * u, Math.min(max, ...widths.map((lw, i) => ((cw - (indents[i] ?? 0)) / lw) * 100)));
      kin.current!.style.setProperty("--kin-size", `${size.toFixed(2)}px`);
      // Text doesn't scale exactly linearly (font hinting on Linux/Windows can add several px), so
      // re-measure at the fitted size and shrink until the widest line really fits.
      let actual = lines.map((l) => (l.firstElementChild as HTMLElement).offsetWidth);
      for (let pass = 0; pass < 3; pass++) {
        const worst = Math.min(...actual.map((a, i) => (cw - (indents[i] ?? 0)) / a));
        if (worst >= 1 || size <= 24 * u) break;
        size = Math.max(24 * u, size * worst * 0.998);
        kin.current!.style.setProperty("--kin-size", `${size.toFixed(2)}px`);
        actual = lines.map((l) => (l.firstElementChild as HTMLElement).offsetWidth);
      }
      lines.forEach((l, i) => l.style.setProperty("--slack", `${Math.max(0, cw - (indents[i] ?? 0) - actual[i]).toFixed(1)}px`));
    };
    fit();
    document.fonts.ready.then(fit);
    const ro = new ResizeObserver(fit);
    ro.observe(wrap.current!);
    return () => ro.disconnect();
  }, []);

  // --k: 0 at the top of the page, 1 once the stage has scrolled away; lines slide right by k × their free
  // space. CSS scroll-driven animation where supported (off the main thread); JS on every scroll frame elsewhere.
  useEffect(() => {
    const el = stage.current!;
    if (!reduced && supportsScrollTimeline()) {
      const setHeight = () => el.style.setProperty("--stage-h", `${el.offsetHeight}px`);
      setHeight();
      el.classList.add("ci-sda");
      addEventListener("resize", setHeight);
      return () => {
        el.classList.remove("ci-sda");
        removeEventListener("resize", setHeight);
      };
    }
    return onScrollFrame(() => el.style.setProperty("--k", reduced ? "0" : clamp01(scrollY / el.offsetHeight).toFixed(3)));
  }, [reduced]);

  // spotlight follows the pointer over the halftone (touch screens get a slow drift instead). Moving the
  // cover with transform keeps it on the GPU: no repaint per pointer move.
  const onPointerMove = (e: React.PointerEvent) => {
    if (!fine || !spot.current) return;
    const r = stage.current!.getBoundingClientRect();
    spot.current.style.transform = `translate(${e.clientX - r.left - r.width / 2}px, ${e.clientY - r.top - r.height / 2}px)`;
  };

  return (
    <section ref={stage} className="ci-stage" aria-labelledby="ci-title" onPointerMove={onPointerMove}>
      <div className="ci-halftone" aria-hidden="true" />
      <div ref={spot} className="ci-spot" aria-hidden="true" />
      <div className="ci-beams" aria-hidden="true"><i /><i /></div>
      <div className="ci-wrap" data-reveal-group>
        <div className="ci-stage-top">
          <span>COUNT IN · ABOUT PALM/MUTE</span>
          <span className="ci-live"><i />LIVE · {PUNK_MASTER_BPM} BPM</span>
        </div>
        <div ref={wrap} className="ci-kin-wrap">
          <h1 ref={kin} className="ci-kin" id="ci-title">
            <span className="sr-only">Songwriting formulas from the bands that built pop-punk.</span>
            <span className="ci-kin-set ci-kin-wide" aria-hidden="true">
              <span className="ci-kl [--f:0]"><span className="[--d:0]">Songwriting</span></span>
              <span className="ci-kl ci-in2 [--f:0.55]"><span className="[--d:1]">formulas from</span></span>
              <span className="ci-kl [--f:0.3]"><span className="[--d:2]">the bands that</span></span>
              <span className="ci-kl ci-in4 [--f:1]"><span className="[--d:3]">built pop-punk.</span></span>
            </span>
            <span className="ci-kin-set ci-kin-narrow" aria-hidden="true">
              <span className="ci-kl [--f:0]"><span className="[--d:0]">Songwriting</span></span>
              <span className="ci-kl [--f:0.5]"><span className="[--d:1]">formulas</span></span>
              <span className="ci-kl [--f:1]"><span className="[--d:2]">from the</span></span>
              <span className="ci-kl [--f:0.3]"><span className="[--d:3]">bands that</span></span>
              <span className="ci-kl [--f:0.8]"><span className="[--d:4]">built</span></span>
              <span className="ci-kl [--f:0.45]"><span className="[--d:5]">pop-punk.</span></span>
            </span>
          </h1>
        </div>
        <div className="ci-stage-foot [--d:4]" data-reveal>
          <p>A songwriting engine for pop-punk. Pick a key and a feel, and Palm/Mute writes the song.</p>
          <div className="ci-cta">
            <Link className="ci-btn" href="/generator/">
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M5 3l14 9-14 9z" /></svg>START WRITING
            </Link>
            <Link className="ci-link" href="/chords/">Open the Chord Lab <span aria-hidden="true">→</span></Link>
          </div>
        </div>
      </div>
      <Strings reduced={reduced} />
    </section>
  );
}
