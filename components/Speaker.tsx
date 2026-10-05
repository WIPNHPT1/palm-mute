"use client";

import { useEffect, useRef } from "react";
import { onKick } from "@/lib/audio/engine";

/**
 * Speaker cone (owner's pick, docs/mockups/home-scroll-options.html option 5): a canvas that fills its section and draws
 * speaker cloth with one big cone ("one", the home hero; "band", the top of the Song Generator and the Chord Lab) or a
 * 2×2 cab ("cab", the home kit) on it. The cones pump on a beat (harder on 1 and 3): the home page's beat clock
 * (`beat`), or with `engine`, whatever is playing, and harder still while the page scrolls fast. They drift a little
 * slower than the page (parallax). Faint and behind everything; hidden from screen readers. It only draws while its section is on screen, 30
 * frames a second, and draws one still frame (no pumping, no drift) with reduced motion.
 */
export function Speaker({ kind, beat = 0, engine = false }: { kind: "one" | "cab" | "band"; beat?: number; engine?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const kick = useRef({ at: -1e9, strong: true });
  // each beat of the page's clock is a kick: note when, and whether it's a strong beat (1 or 3)
  useEffect(() => {
    if (beat > 0) kick.current = { at: performance.now(), strong: beat % 2 === 0 };
  }, [beat]);
  // or each beat of the music playing
  useEffect(() => (engine ? onKick((strong) => (kick.current = { at: performance.now(), strong })) : undefined), [engine]);

  useEffect(() => {
    const cv = canvas.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let raf = 0, last = 0, seen = false, vel = 0, lastY = scrollY;
    let cloth: CanvasPattern | null = null, clothFor = "";

    const colours = () => {
      const cs = getComputedStyle(document.documentElement), dark = document.documentElement.classList.contains("dark");
      const fg = cs.getPropertyValue(dark ? "--color-text-on-dark" : "--color-ink").trim();
      return { dark, fg: (a: number) => `rgb(${fg} / ${a})`, k: dark ? 1 : 0.75 };
    };
    const pattern = (fg: string) => {
      if (cloth && clothFor === fg) return cloth;
      const tile = document.createElement("canvas");
      tile.width = tile.height = 6;
      const t = tile.getContext("2d")!;
      t.fillStyle = fg;
      t.fillRect(0, 0, 3, 3);
      t.fillRect(3, 3, 3, 3);
      clothFor = fg;
      return (cloth = ctx.createPattern(tile, "repeat"));
    };
    // one cone: the surround, the cone with its ribs, the dust cap; ex = how far it's pushed out (0 to ~2.5)
    const cone = (c: ReturnType<typeof colours>, x: number, y: number, R: number, ex: number) => {
      ctx.save();
      ctx.translate(x, y);
      const sur = ctx.createRadialGradient(0, 0, R * 0.8, 0, 0, R);
      sur.addColorStop(0, c.fg(0.06 * c.k)); sur.addColorStop(0.6, c.fg(0.16 * c.k)); sur.addColorStop(1, c.fg(0.03));
      ctx.fillStyle = sur;
      ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
      const s = 1 + ex * 0.035;
      const body = ctx.createRadialGradient(-R * 0.15 * s, -R * 0.2 * s, R * 0.05, 0, 0, R * 0.82);
      body.addColorStop(0, c.fg(c.dark ? 0.16 : 0.08)); body.addColorStop(1, c.fg(c.dark ? 0.04 : 0.02));
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.arc(0, 0, R * 0.82, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = c.fg(0.07 * c.k);
      ctx.lineWidth = 1;
      for (let k = 0.3; k < 0.82; k += 0.08) { ctx.beginPath(); ctx.arc(0, 0, R * k * (1 + ex * 0.05 * (1 - k)), 0, Math.PI * 2); ctx.stroke(); }
      const cap = ctx.createRadialGradient(-R * 0.06, -R * 0.08, 2, 0, 0, R * 0.26 * s);
      cap.addColorStop(0, c.fg(c.dark ? 0.3 : 0.14)); cap.addColorStop(1, c.fg(0.05));
      ctx.fillStyle = cap;
      ctx.beginPath(); ctx.arc(0, 0, R * 0.24 * s, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    };

    const draw = (now: number, still: boolean) => {
      const dpr = Math.min(2, devicePixelRatio || 1), W = cv.clientWidth, H = cv.clientHeight;
      if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const c = colours(), top = cv.getBoundingClientRect().top;
      // parallax: the speakers drift up a little slower than the page as their section scrolls past
      const drift = still ? 0 : Math.max(-H, Math.min(H, -top)) * 0.25;
      // the cloth
      ctx.save();
      ctx.globalAlpha = c.dark ? 0.05 : 0.06;
      ctx.fillStyle = pattern(c.fg(1))!;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
      // the push: the last kick decaying, plus the scroll speed
      const since = (now - kick.current.at) / 1000;
      const ex = still ? 0 : (kick.current.strong ? 1 : 0.55) * Math.exp(-since * 9) + Math.min(1.5, Math.abs(vel) / 40);
      if (kind === "band") {
        cone(c, W * 0.8, H * 0.44 + drift, Math.min(W * 0.3, H * 0.46), ex);
      } else if (kind === "one") {
        const wide = W >= 1000;
        cone(c, W * (wide ? 0.72 : 0.5), (wide ? H * 0.5 : H * 0.72) + drift, Math.min(W, H) * (wide ? 0.46 : 0.42), ex);
      } else {
        const R = Math.min(W * 0.2, 240), cx = W / 2, cy = Math.min(H, 1100) * 0.5 + drift;
        for (const [gx, gy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) cone(c, cx + gx * R * 1.08, cy + gy * R * 1.08, R, ex * 0.8);
      }
    };

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      vel += (scrollY - lastY - vel) * 0.25;
      lastY = scrollY;
      // full rate while scrolling (the drift follows the page), 30 frames a second otherwise
      if (document.hidden || (now - last < 1000 / 30 && Math.abs(vel) < 0.5)) return;
      last = now;
      draw(now, false);
    };
    const start = () => {
      cancelAnimationFrame(raf);
      if (!seen) return;
      if (reduced.matches) return draw(performance.now(), true);
      lastY = scrollY;
      raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(([e]) => { seen = e.isIntersecting; start(); });
    io.observe(cv);
    const redraw = () => reduced.matches && seen && draw(performance.now(), true);
    const resized = new ResizeObserver(redraw);
    resized.observe(cv);
    const themes = new MutationObserver(redraw); // the theme switch toggles a class on <html>
    themes.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    reduced.addEventListener("change", start);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      resized.disconnect();
      themes.disconnect();
      reduced.removeEventListener("change", start);
    };
  }, [kind]);

  return <canvas ref={canvas} className="hb-speaker" data-speaker={kind} aria-hidden="true" />;
}
