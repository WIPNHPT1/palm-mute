"use client";

import { useEffect, useRef } from "react";
import { TAB_STRINGS } from "@/lib/musicTheory";

const THICKNESS = [1, 1.3, 1.7, 2.2, 2.8, 3.4]; // e → E

/** Six guitar strings on a canvas: swipe across to pluck; scrolling fast makes them hum. Only animates on screen. */
export function Strings({ reduced }: { reduced: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = box.current!, cv = canvas.current!, ctx = cv.getContext("2d")!;
    const N = TAB_STRINGS.length, amp = new Array(N).fill(0), px = new Array(N).fill(0.5), hot = new Array(N).fill(0);
    let W = 0, H = 0, t = 0, lastY: number | null = null, running = false, frame = 0, lastScroll = scrollY, vel = 0;
    let colors = { str: "", acc: "" };
    const readColors = () => {
      const cs = getComputedStyle(el);
      colors = { str: cs.getPropertyValue("--t-muted").trim(), acc: cs.getPropertyValue("--accent").trim() };
    };
    const size = () => {
      const dpr = Math.min(2, devicePixelRatio || 1);
      W = el.clientWidth; H = el.clientHeight; cv.width = W * dpr; cv.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const yOf = (i: number) => (H / N) * (i + 0.5);
    const draw = () => {
      ctx.clearRect(0, 0, W, H); t += 1;
      const d = scrollY - lastScroll; lastScroll = scrollY;
      vel += (Math.max(-60, Math.min(60, d)) - vel) * 0.12;
      for (let i = 0; i < N; i++) {
        amp[i] = Math.min(22, amp[i] + Math.abs(vel) * 0.06);
        const y0 = yOf(i), a = amp[i] * Math.sin(t * (0.55 + i * 0.07)), x0 = W * px[i];
        ctx.beginPath(); ctx.moveTo(0, y0);
        // the string is pulled into a triangle at the pluck point
        for (let x = 0; x <= W; x += 6) ctx.lineTo(x, y0 + a * (x < x0 ? x / x0 : (W - x) / (W - x0)));
        ctx.lineWidth = THICKNESS[i];
        ctx.strokeStyle = hot[i] > 0.05 ? colors.acc : colors.str;
        ctx.globalAlpha = 0.55 + Math.min(0.45, hot[i]);
        ctx.stroke();
        amp[i] *= 0.93; hot[i] *= 0.92;
      }
      ctx.globalAlpha = 1;
      if (running) frame = requestAnimationFrame(draw);
    };
    const pluck = (x: number, y: number) => {
      if (lastY !== null)
        for (let i = 0; i < N; i++) {
          const s = yOf(i);
          if ((lastY - s) * (y - s) <= 0 && lastY !== y) { amp[i] = 16 + Math.random() * 6; px[i] = Math.min(0.9, Math.max(0.1, x / W)); hot[i] = 1; }
        }
      lastY = y;
    };
    const local = (e: PointerEvent) => { const r = el.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top] as const; };
    const onMove = (e: PointerEvent) => pluck(...local(e));
    const onDown = (e: PointerEvent) => { const [x, y] = local(e); lastY = y - 20; pluck(x, y); };
    const onLeave = () => { lastY = null; };
    el.addEventListener("pointermove", onMove, { passive: true });
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointerleave", onLeave);
    const onResize = () => { size(); if (!running) draw(); };
    addEventListener("resize", onResize);
    // re-read colours when the theme class on <html> changes
    const mo = new MutationObserver(() => { readColors(); if (!running) draw(); });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    readColors(); size();
    let io: IntersectionObserver | null = null;
    if (reduced) draw();
    else {
      io = new IntersectionObserver(([en]) => { running = en.isIntersecting; if (running) frame = requestAnimationFrame(draw); });
      io.observe(el);
    }
    return () => {
      running = false; cancelAnimationFrame(frame); io?.disconnect(); mo.disconnect();
      el.removeEventListener("pointermove", onMove); el.removeEventListener("pointerdown", onDown); el.removeEventListener("pointerleave", onLeave);
      removeEventListener("resize", onResize);
    };
  }, [reduced]);

  return (
    <div ref={box} className="ci-strings" aria-hidden="true">
      <canvas ref={canvas} />
      <div className="ci-strings-names">{TAB_STRINGS.map((s) => <span key={s}>{s}</span>)}</div>
      <div className="ci-strings-hint">SWIPE ACROSS THE STRINGS</div>
    </div>
  );
}
