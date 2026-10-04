"use client";

import { useEffect, useRef, useState } from "react";
import * as audio from "@/lib/audio/engine";
import { designUnit } from "@/lib/designUnit";
import { OPEN_STRING_MIDI, TAB_STRINGS } from "@/lib/musicTheory";

const THICKNESS = [1, 1.3, 1.7, 2.2, 2.8, 3.4]; // e → E
const SOUND_KEY = "palm-mute-strings-sound";

/**
 * Six guitar strings on a canvas: swipe across to pluck; scrolling fast makes them hum. Only animates
 * on screen. With SOUND on, each string you cross rings its open note (E A D G B E) on the app's
 * guitar voice, in the order you cross them, louder the faster you swipe. Sound is off until you turn
 * it on (browsers need a click first, and scrolling past shouldn't make noise); the choice is remembered.
 */
export function Strings({ reduced }: { reduced: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [sound, setSound] = useState(false);
  const soundRef = useRef(false);
  soundRef.current = sound;

  // Restore the choice; audio itself starts on the next click or tap (turning sound on is one).
  useEffect(() => {
    try {
      if (localStorage.getItem(SOUND_KEY) === "on") setSound(true);
    } catch {
      // storage unavailable: sound stays off
    }
  }, []);

  const toggleSound = async () => {
    const next = !sound;
    setSound(next);
    try {
      localStorage.setItem(SOUND_KEY, next ? "on" : "off");
    } catch {
      // storage unavailable: the choice lasts for this visit
    }
    if (next) await audio.enable();
  };

  useEffect(() => {
    const el = box.current!, cv = canvas.current!, ctx = cv.getContext("2d")!;
    const N = TAB_STRINGS.length, amp = new Array(N).fill(0), px = new Array(N).fill(0.5), hot = new Array(N).fill(0);
    // running = on screen; scheduled = a frame is queued. The loop sleeps once every string is still and
    // the page isn't scrolling (no work while idle), and a pluck, scroll or resize wakes it.
    let W = 0, H = 0, u = 1, t = 0, lastY: number | null = null, lastT = 0, running = false, scheduled = false, frame = 0, lastScroll = scrollY, vel = 0;
    let colors = { str: "", acc: "" };
    const readColors = () => {
      const cs = getComputedStyle(el);
      colors = { str: cs.getPropertyValue("--t-muted").trim(), acc: cs.getPropertyValue("--accent").trim() };
    };
    const size = () => {
      const dpr = Math.min(2, devicePixelRatio || 1);
      u = designUnit(); // string thickness is in design pixels
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
        ctx.lineWidth = THICKNESS[i] * u;
        ctx.strokeStyle = hot[i] > 0.05 ? colors.acc : colors.str;
        ctx.globalAlpha = 0.55 + Math.min(0.45, hot[i]);
        ctx.stroke();
        amp[i] *= 0.93; hot[i] *= 0.92;
      }
      ctx.globalAlpha = 1;
      scheduled = false;
      const still = Math.abs(vel) < 0.05 && amp.every((a) => a < 0.05) && hot.every((h) => h < 0.05);
      if (running && !still) wake();
    };
    const wake = () => {
      if (!running || scheduled) return;
      scheduled = true;
      frame = requestAnimationFrame(draw);
    };
    const onScroll = () => wake();
    const pluck = (x: number, y: number, now: number) => {
      if (lastY !== null && lastY !== y) {
        const crossed: number[] = [];
        for (let i = 0; i < N; i++) {
          const s = yOf(i);
          if ((lastY - s) * (y - s) <= 0) { amp[i] = 16 + Math.random() * 6; px[i] = Math.min(0.9, Math.max(0.1, x / W)); hot[i] = 1; crossed.push(i); }
        }
        if (crossed.length) wake();
        if (crossed.length && soundRef.current) {
          // Faster swipes play louder; strings sound in the order the swipe crosses them (a strum).
          const speed = Math.abs(y - lastY) / Math.max(8, now - lastT); // px per ms
          const velocity = Math.min(1, 0.35 + speed * 0.5);
          const order = y > lastY ? crossed : [...crossed].reverse();
          order.forEach((i, k) => audio.pluckString(OPEN_STRING_MIDI[TAB_STRINGS[i]], velocity, k * 0.012));
        }
      }
      lastY = y;
      lastT = now;
    };
    const local = (e: PointerEvent) => { const r = el.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top] as const; };
    const onMove = (e: PointerEvent) => pluck(...local(e), e.timeStamp);
    const onDown = (e: PointerEvent) => {
      if ((e.target as Element).closest("button")) return; // the SOUND switch isn't a string
      const [x, y] = local(e);
      // a tap is a gesture: if sound is on, make sure audio has started
      if (soundRef.current) void audio.enable();
      lastY = y - 20; lastT = e.timeStamp - 40; pluck(x, y, e.timeStamp);
    };
    const onLeave = () => { lastY = null; };
    el.addEventListener("pointermove", onMove, { passive: true });
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointerleave", onLeave);
    const onResize = () => { size(); draw(); };
    addEventListener("resize", onResize);
    addEventListener("scroll", onScroll, { passive: true });
    // re-read colours when the theme class on <html> changes
    const mo = new MutationObserver(() => { readColors(); draw(); });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    readColors(); size();
    let io: IntersectionObserver | null = null;
    if (reduced) draw();
    else {
      io = new IntersectionObserver(([en]) => {
        running = en.isIntersecting;
        if (running) wake();
        else { cancelAnimationFrame(frame); scheduled = false; }
      });
      io.observe(el);
    }
    return () => {
      running = false; cancelAnimationFrame(frame); io?.disconnect(); mo.disconnect();
      removeEventListener("scroll", onScroll);
      el.removeEventListener("pointermove", onMove); el.removeEventListener("pointerdown", onDown); el.removeEventListener("pointerleave", onLeave);
      removeEventListener("resize", onResize);
    };
  }, [reduced]);

  return (
    <div ref={box} className="ci-strings">
      <canvas ref={canvas} aria-hidden="true" />
      <div className="ci-strings-names" aria-hidden="true">{TAB_STRINGS.map((s) => <span key={s}>{s}</span>)}</div>
      <div className="ci-strings-foot">
        <span className="ci-strings-hint" aria-hidden="true">SWIPE ACROSS THE STRINGS</span>
        <button
          type="button"
          role="switch"
          aria-checked={sound}
          aria-label="String sound"
          onClick={toggleSound}
          className="ci-strings-sound"
          data-on={sound}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M11 5 6 9H2v6h4l5 4V5z" />
            {sound ? <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" /> : <path d="m22 9-6 6M16 9l6 6" />}
          </svg>
          SOUND {sound ? "ON" : "OFF"}
        </button>
      </div>
    </div>
  );
}
