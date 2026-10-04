"use client";

import { useEffect, useLayoutEffect, useRef } from "react";

// Layout effects only run in the browser; this keeps the server render quiet.
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * A card title that flips in letter by letter like the split-flap title board, the first time it scrolls into view
 * (owner's pick, docs/mockups/stage-options.html). The text stays one word to read and to search; only the letters'
 * boxes animate. Anyone with reduced motion, or a browser without IntersectionObserver, just sees the title.
 */
export function FlapText({ text }: { text: string }) {
  const el = useRef<HTMLSpanElement>(null);
  useIsoLayoutEffect(() => {
    const node = el.current;
    if (!node || typeof IntersectionObserver === "undefined" || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    node.dataset.flap = "wait";
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        node.dataset.flap = "go";
        io.disconnect();
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);
  let n = 0;
  return (
    <span ref={el} className="flap">
      {[...text].map((ch, i) =>
        ch === " " ? (
          " "
        ) : (
          <span key={i} style={{ "--i": n++ } as React.CSSProperties}>
            {ch}
          </span>
        ),
      )}
    </span>
  );
}
