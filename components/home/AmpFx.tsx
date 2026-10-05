"use client";

import { type RefObject, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * "Amp blowout" (owner's pick, docs/mockups/home-wow-scroll.html option 6): scroll is volume. One frame loop reads the
 * scroll speed and the page's beat clock and drives:
 * - fast scrolling shakes the sections a little, splits the big type into red and cyan, and throws sparks off the
 *   screen's right edge;
 * - the stats count up as they arrive;
 * - "How it works" pins and slides sideways, its posters skewing with the speed;
 * - the kit's tiles bump on every beat, one lit per bar;
 * - the statement fills in letter by letter as it's pinned, and thumps on the kick;
 * - the encore's "Count it in." slams in with shockwave rings and a burst of sparks;
 * - with a mouse: a soft spotlight follows the cursor and the main buttons pull toward it.
 * With reduced motion none of it runs (the stats and the statement simply show). Phones get a gentler shake and no
 * sparks, spotlight or magnets. It never touches the footer (only the home page's own sections move).
 */
export function AmpFx({ root, beat }: { root: RefObject<HTMLDivElement | null>; beat: number }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const sparksCv = useRef<HTMLCanvasElement>(null);
  const spot = useRef<HTMLDivElement>(null);
  const kick = useRef({ at: -1e9, strong: true });
  useEffect(() => setHost(document.body), []);

  // each beat: the kick for the bump and the thump, and the bar's lit tile
  useEffect(() => {
    if (beat <= 0) return;
    kick.current = { at: performance.now(), strong: beat % 2 === 0 };
    const tiles = root.current?.querySelectorAll<HTMLElement>(".hb-tile");
    if (!tiles?.length) return;
    const bar = Math.floor(beat / 4) % tiles.length;
    tiles.forEach((t, i) => t.classList.toggle("hb-hit", i === bar));
  }, [beat, root]);

  useEffect(() => {
    const el = root.current, cv = sparksCv.current, sp = spot.current;
    if (!el || !cv || !sp) return;
    const ctx = cv.getContext("2d")!;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const fine = matchMedia("(pointer: fine)");
    const wide = matchMedia("(min-width: 834px)");
    const q = <T extends Element = HTMLElement>(s: string) => el.querySelector<T & HTMLElement>(s);
    const qa = (s: string) => [...el.querySelectorAll<HTMLElement>(s)];
    const sections = qa(":scope > section, :scope > .hb-marquee");
    const how = q("[data-amp-how]"), track = q("[data-amp-track]"), posters = qa(".hb-poster");
    const st = q("[data-amp-statement]"), big = q(".hb-big"), letters = qa(".hb-big .ch");
    const enc = q(".hb-encore"), encH = q(".hb-encore .hb-h2"), rings = q(".hb-rings");
    const btns = qa(".hb-btn");
    const stats = qa(".hb-stats dd");
    const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    const through = (n: HTMLElement) => { const r = n.getBoundingClientRect(), top = parseFloat(getComputedStyle(n.firstElementChild!).top) || 0; return clamp(-(r.top - top) / Math.max(1, r.height - innerHeight + top)); };
    const enter = (n: HTMLElement, span = 0.85) => clamp((innerHeight - n.getBoundingClientRect().top) / (innerHeight * span));

    let raf = 0, lastY = scrollY, vel = 0, lastT = performance.now(), ringDone = false, mx = -999, my = -999, bx = -999, by = -999, cleanSparks = true;
    let sparks: { x: number; y: number; vx: number; vy: number; life: number }[] = [];

    // the stats count up the first time they arrive
    const counter = new IntersectionObserver((es) => {
      if (!es.some((e) => e.isIntersecting) || reduced.matches) return;
      counter.disconnect();
      stats.forEach((d, i) => {
        const end = d.textContent ?? "", n = parseInt(end, 10);
        if (Number.isNaN(n)) return;
        const t0 = performance.now(), dur = 1000 + i * 120;
        const step = (now: number) => { const k = clamp((now - t0) / dur); d.textContent = k < 1 ? String(Math.round(n * ease(k))) : end; if (k < 1) requestAnimationFrame(step); };
        requestAnimationFrame(step);
      });
    }, { threshold: 0.4 });
    const statsEl = q(".hb-stats");
    if (statsEl) counter.observe(statsEl);

    const burst = (x: number, y: number, n: number) => { for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = 300 + Math.random() * 900; sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 200, life: 0.5 + Math.random() * 0.5 }); } };
    const drawSparks = (dt: number) => {
      if (!sparks.length) { if (!cleanSparks) { ctx.clearRect(0, 0, cv.width, cv.height); cleanSparks = true; } return; }
      cleanSparks = false;
      const dpr = Math.min(1.5, devicePixelRatio || 1), W = innerWidth, H = innerHeight;
      if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      sparks = sparks.filter((s) => (s.life -= dt) > 0);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.lineWidth = 2;
      for (const s of sparks) {
        s.vy += 1400 * dt; s.x += s.vx * dt; s.y += s.vy * dt;
        ctx.globalAlpha = Math.min(1, s.life * 2);
        ctx.strokeStyle = s.life > 0.35 ? "#FFE1B0" : "#E5573F";
        ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - s.vx * 0.02, s.y - s.vy * 0.02); ctx.stroke();
      }
      ctx.restore();
    };
    const reset = () => {
      [...sections, ...btns].forEach((n) => (n.style.translate = ""));
      posters.forEach((p) => (p.style.transform = ""));
      if (track) track.style.transform = "";
      if (big) big.style.scale = "";
      if (encH) { encH.style.scale = ""; encH.style.opacity = ""; }
      letters.forEach((c) => c.classList.add("lit"));
      el.style.setProperty("--ab", "0");
      el.style.setProperty("--kick", "0");
      el.classList.remove("hb-split");
      sp.style.opacity = "0";
      sparks = [];
      drawSparks(0);
    };

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - lastT) / 1000);
      lastT = now;
      if (document.hidden) return;
      const y = scrollY;
      vel += (y - lastY - vel) * 0.2;
      lastY = y;
      const k = (now - kick.current.at) / 1000, pulse = (kick.current.strong ? 1 : 0.55) * Math.exp(-k * 6);
      const W = innerWidth, H = innerHeight, phone = !wide.matches, mouse = fine.matches && !phone;
      const pageBottom = el.getBoundingClientRect().bottom;
      const onPage = pageBottom > H * 0.35; // the footer's credits are on screen past this

      // shake and the red-cyan split (sections only: the footer and the top bar never move)
      const shake = onPage ? Math.min(phone ? 5 : 14, Math.abs(vel) * (phone ? 0.2 : 0.4)) : 0;
      sections.forEach((s) => (s.style.translate = shake > 0.6 ? `${(Math.random() - 0.5) * shake}px ${(Math.random() - 0.5) * shake}px` : ""));
      const ab = clamp(vel * 0.5, -14, 14) + pulse * 1.5;
      el.style.setProperty("--ab", ab.toFixed(2));
      el.classList.toggle("hb-split", Math.abs(ab) > 0.6);
      el.style.setProperty("--kick", pulse.toFixed(3));

      // "How it works": sideways while pinned, the posters leaning with the speed
      if (how && track && !phone) {
        const p = through(how), max = track.scrollWidth - W;
        track.style.transform = `translate3d(${-p * Math.max(0, max)}px,0,0)`;
        const skew = clamp(-vel * 0.15, -10, 10);
        posters.forEach((pp) => (pp.style.transform = Math.abs(skew) > 0.1 ? `skewX(${skew}deg)` : ""));
      }

      // the statement fills as it's pinned (as it arrives, on phones), and thumps on the kick
      if (st && big) {
        const p = phone ? enter(st, 1.1) : through(st), lit = Math.floor(p * letters.length * 1.15);
        letters.forEach((c, i) => c.classList.toggle("lit", i < lit));
        big.style.scale = String(1 + pulse * 0.04);
      }

      // the encore slams in, rings out once and throws sparks
      if (enc && encH) {
        const e = enter(enc, 0.9);
        encH.style.scale = String(e < 1 ? 1 + (1 - ease(e)) * 2.5 : 1);
        encH.style.opacity = String(e);
        if (e >= 1 && !ringDone) { ringDone = true; rings?.classList.add("go"); if (!phone) { const r = encH.getBoundingClientRect(); burst(W / 2, r.top + r.height / 2, 60); } }
        if (e < 0.5 && ringDone) { ringDone = false; rings?.classList.remove("go"); }
      }

      // sparks off the right edge on a fast scroll
      if (!onPage) sparks = []; // the footer's credits stay clean
      if (!phone && onPage && Math.abs(vel) > 16) for (let i = 0; i < 3; i++) sparks.push({ x: W - 4, y: Math.random() * H, vx: -300 - Math.random() * 600, vy: (Math.random() - 0.5) * 400 - (vel > 0 ? 200 : -200), life: 0.6 });
      drawSparks(dt);

      // with a mouse: the spotlight, and the buttons pull toward the cursor
      if (mouse) {
        bx += (mx - bx) * 0.18; by += (my - by) * 0.18;
        sp.style.setProperty("--mx", `${bx}px`); sp.style.setProperty("--my", `${by}px`);
        sp.style.opacity = mx > -999 && onPage ? "1" : "0";
        btns.forEach((b) => { const r = b.getBoundingClientRect(), dx = mx - (r.left + r.width / 2), dy = my - (r.top + r.height / 2); b.style.translate = Math.hypot(dx, dy) < 140 ? `${dx * 0.3}px ${dy * 0.3}px` : ""; });
      } else sp.style.opacity = "0";
    };
    const move = (e: PointerEvent) => { mx = e.clientX; my = e.clientY; if (bx < -900) { bx = mx; by = my; } };
    const start = () => {
      cancelAnimationFrame(raf);
      reset();
      if (reduced.matches) return;
      lastY = scrollY; lastT = performance.now();
      raf = requestAnimationFrame(tick);
    };
    addEventListener("pointermove", move, { passive: true });
    reduced.addEventListener("change", start);
    start();
    return () => {
      cancelAnimationFrame(raf);
      counter.disconnect();
      removeEventListener("pointermove", move);
      reduced.removeEventListener("change", start);
      reset();
    };
  }, [root, host]);

  if (!host) return null;
  return createPortal(
    <>
      <div ref={spot} className="hb-amp-spot" aria-hidden="true" />
      <canvas ref={sparksCv} className="hb-amp-sparks" aria-hidden="true" />
    </>,
    host,
  );
}
