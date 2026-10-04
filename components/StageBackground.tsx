"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { designUnit } from "@/lib/designUnit";
import { paintOscilloscope, readStageColors } from "@/lib/stagePaint";

const FPS = 30;

/**
 * A faint moving background behind a whole page (owner's pick: the oscilloscope, behind both the Song Generator and
 * the Chord Lab). One canvas, fixed under the top bar and behind everything (cards stay solid, so text never sits
 * on moving pixels). 30 frames a second, paused while the tab is hidden, one still frame for reduced motion, and
 * not drawn on phones. It follows the theme, and reacts while music is playing.
 *
 * `showsThrough` (the home page): a selector for the sections it shows through. The rest of the page covers it, so it
 * only animates while one of those sections is on screen (and keeps a still frame ready for when one arrives).
 */
export function StageBackground({ playing, showsThrough }: { playing: boolean; showsThrough?: string }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const live = useRef(playing);
  live.current = playing;
  useEffect(() => setHost(document.body), []);

  useEffect(() => {
    const cv = canvas.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    let colors = readStageColors();
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const wide = matchMedia("(min-width: 834px)");
    let raf = 0;
    let last = 0;
    const t0 = performance.now();
    const size = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.round(cv.clientWidth * dpr);
      const h = Math.round(cv.clientHeight * dpr);
      if (cv.width !== w || cv.height !== h) {
        cv.width = w;
        cv.height = h;
      }
      return dpr * designUnit(); // grid and line widths are design pixels
    };
    const draw = (t: number) => {
      const s = size();
      ctx.clearRect(0, 0, cv.width, cv.height);
      paintOscilloscope(ctx, cv.width, cv.height, t, live.current, colors, s);
    };
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (document.hidden || now - last < 1000 / FPS) return;
      last = now;
      draw((now - t0) / 1000);
    };
    // On the home page: is any section it shows through on screen?
    let seen = !showsThrough;
    const visible = new Map<Element, boolean>();
    const sections = showsThrough ? new IntersectionObserver((entries) => {
      for (const e of entries) visible.set(e.target, e.isIntersecting);
      const now = [...visible.values()].some(Boolean);
      if (now !== seen) { seen = now; start(); }
    }) : null;
    const start = () => {
      cancelAnimationFrame(raf);
      if (!wide.matches) return ctx.clearRect(0, 0, cv.width, cv.height);
      if (reduced.matches || !seen) return draw(reduced.matches ? 12 : (performance.now() - t0) / 1000); // a still frame
      raf = requestAnimationFrame(tick);
    };
    if (showsThrough) document.querySelectorAll(showsThrough).forEach((el) => sections!.observe(el));
    // The theme switch toggles a class on <html>: re-read the colours.
    const themes = new MutationObserver(() => {
      colors = readStageColors();
      if (reduced.matches && wide.matches) draw(12);
    });
    themes.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    const onResize = () => reduced.matches && wide.matches && draw(12);
    window.addEventListener("resize", onResize);
    reduced.addEventListener("change", start);
    wide.addEventListener("change", start);
    start();
    return () => {
      cancelAnimationFrame(raf);
      sections?.disconnect();
      themes.disconnect();
      window.removeEventListener("resize", onResize);
      reduced.removeEventListener("change", start);
      wide.removeEventListener("change", start);
    };
  }, [host, showsThrough]);

  if (!host) return null;
  return createPortal(<canvas ref={canvas} className="stage-bg" data-stage-bg="osc" aria-hidden="true" />, host);
}
