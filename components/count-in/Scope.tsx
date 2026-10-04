"use client";

import { useEffect, useRef } from "react";
import { paintOscilloscope, readStageColors } from "@/lib/stagePaint";

const FPS = 30;

/**
 * The Song Generator's oscilloscope, faint, behind one of the home page's quiet sections (owner's pick,
 * docs/mockups/home-stage-options.html). Put it first in a section marked data-scope; it fills the section, under the
 * content. Each section's scope keeps the same clock, so neighbouring sections' traces move together. It only runs
 * while its section is on screen (30 frames a second, paused while the tab is hidden), draws one still frame for
 * reduced motion, isn't drawn on phones, and follows the theme.
 */
export function Scope() {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = canvas.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) return;
    let colors = readStageColors();
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const wide = matchMedia("(min-width: 834px)");
    let raf = 0;
    let last = 0;
    let seen = false;
    const draw = (t: number) => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.round(cv.clientWidth * dpr);
      const h = Math.round(cv.clientHeight * dpr);
      if (cv.width !== w || cv.height !== h) {
        cv.width = w;
        cv.height = h;
      }
      ctx.clearRect(0, 0, w, h);
      if (w && h) paintOscilloscope(ctx, w, h, t, false, colors, dpr);
    };
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (document.hidden || now - last < 1000 / FPS) return;
      last = now;
      draw(now / 1000);
    };
    const start = () => {
      cancelAnimationFrame(raf);
      if (!wide.matches || !seen) return;
      if (reduced.matches) return draw(12); // one still frame
      raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(([e]) => {
      seen = e.isIntersecting;
      start();
    });
    io.observe(cv);
    // The section changes height with the screen (and as fonts load): redraw a still frame at the new size.
    const resized = new ResizeObserver(() => reduced.matches && start());
    resized.observe(cv);
    // The theme switch toggles a class on <html>: re-read the colours.
    const themes = new MutationObserver(() => {
      colors = readStageColors();
      if (reduced.matches) start();
    });
    themes.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    reduced.addEventListener("change", start);
    wide.addEventListener("change", start);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      resized.disconnect();
      themes.disconnect();
      reduced.removeEventListener("change", start);
      wide.removeEventListener("change", start);
    };
  }, []);

  return <canvas ref={canvas} className="ci-scope" data-scope-canvas aria-hidden="true" />;
}
