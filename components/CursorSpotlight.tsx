"use client";

import { useEffect, useRef } from "react";

/**
 * The home page's cursor flashlight on the Song Generator and the Chord Lab (owner's call): a soft spotlight follows the
 * mouse and the page outside it dims a little. It sits over the page's cards but under the transport bar, the menu and
 * the top bar, so those never dim, and it never takes a click. Mouse only, from tablet width; never with reduced motion.
 * It eases toward the pointer and only runs while the pointer moves, fading out when it leaves the window.
 */
export function CursorSpotlight() {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const spot = el.current;
    if (!spot) return;
    const ok = matchMedia("(pointer: fine) and (min-width: 834px) and (prefers-reduced-motion: no-preference)");
    let raf = 0, x = -999, y = -999, tx = -999, ty = -999;
    const step = () => {
      x += (tx - x) * 0.18;
      y += (ty - y) * 0.18;
      spot.style.setProperty("--mx", `${x}px`);
      spot.style.setProperty("--my", `${y}px`);
      raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.5 ? requestAnimationFrame(step) : 0;
    };
    const move = (e: PointerEvent) => {
      if (!ok.matches || e.pointerType !== "mouse") return;
      tx = e.clientX;
      ty = e.clientY;
      if (x < -900) { x = tx; y = ty; }
      spot.dataset.on = "true";
      if (!raf) raf = requestAnimationFrame(step);
    };
    const leave = () => { spot.dataset.on = "false"; };
    const media = () => { if (!ok.matches) leave(); };
    addEventListener("pointermove", move, { passive: true });
    document.documentElement.addEventListener("pointerleave", leave);
    ok.addEventListener("change", media);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener("pointermove", move);
      document.documentElement.removeEventListener("pointerleave", leave);
      ok.removeEventListener("change", media);
    };
  }, []);
  return <div ref={el} className="cursor-spot" data-cursor-spot data-on="false" aria-hidden="true" />;
}
