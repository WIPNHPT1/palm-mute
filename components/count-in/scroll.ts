"use client";

// Small scroll/preference helpers for the Count In page's effects.
import { type RefObject, useEffect, useState } from "react";

export const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Runs fn at most once per animation frame while scrolling or resizing (and once immediately). Returns cleanup. */
export function onScrollFrame(fn: () => void): () => void {
  let queued = false;
  const run = () => {
    queued = false;
    fn();
  };
  const queue = () => {
    if (!queued) {
      queued = true;
      requestAnimationFrame(run);
    }
  };
  addEventListener("scroll", queue, { passive: true });
  addEventListener("resize", queue);
  fn();
  return () => {
    removeEventListener("scroll", queue);
    removeEventListener("resize", queue);
  };
}

/**
 * CSS scroll-driven animations (animation-timeline) run scroll effects off the main thread. Where they're
 * supported, components add .ci-sda and let CSS drive --k / --p; elsewhere they keep the JS fallback.
 */
export function supportsScrollTimeline(): boolean {
  return typeof CSS !== "undefined" && CSS.supports("animation-timeline: scroll()");
}

/** Progress through a sticky scene: 0 when its top reaches the viewport top, 1 when its bottom reaches the viewport bottom. */
export function pinProgress(el: HTMLElement): number {
  const r = el.getBoundingClientRect();
  return clamp01(-r.top / Math.max(1, r.height - innerHeight));
}

function useMedia(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mq = matchMedia(query);
    const update = () => setMatches(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [query]);
  return matches;
}

export const useReducedMotion = () => useMedia("(prefers-reduced-motion: reduce)");
export const useFinePointer = () => useMedia("(hover: hover) and (pointer: fine)");

/**
 * Pauses the looping animations of every section of root that's off screen (data-offscreen on it; the CSS
 * sets animation-play-state: paused), so a phone only animates what you can see.
 */
export function usePauseOffscreen(root: RefObject<HTMLElement | null>, selector: string) {
  useEffect(() => {
    const els = root.current?.querySelectorAll<HTMLElement>(selector);
    if (!els) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.target.toggleAttribute("data-offscreen", !e.isIntersecting)),
      { rootMargin: "100px 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [root, selector]);
}

/**
 * Adds .in to every [data-reveal] / [data-reveal-group] inside root as it scrolls into view, and
 * dispatches a "reveal" event on it so components can chain effects (e.g. the stamp's shake).
 */
export function useReveal(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const els = root.current?.querySelectorAll<HTMLElement>("[data-reveal], [data-reveal-group]");
    if (!els) return;
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          e.target.classList.add("in");
          e.target.dispatchEvent(new CustomEvent("reveal"));
          io.unobserve(e.target);
        }),
      { rootMargin: "0px 0px -12% 0px", threshold: 0.12 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [root]);
}
