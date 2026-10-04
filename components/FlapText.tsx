"use client";

import { Fragment, useEffect, useLayoutEffect, useRef } from "react";

// Layout effects only run in the browser; this keeps the server render quiet.
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * A card title that flips in letter by letter like the split-flap title board, the first time it scrolls into view
 * (owner's pick, docs/mockups/stage-options.html). Screen readers and the page's text get the title whole; only the
 * letters on screen animate. Anyone with reduced motion, or a browser without IntersectionObserver, just sees the title.
 *
 * `start` offsets the stagger (a title split over two lines carries on where the first line stopped). `go` takes
 * the cue from the caller instead of the scroll: the letters wait until it turns true (the home page's encore flips
 * its heading in on the count).
 */
export function FlapText({ text, start = 0, go }: { text: string; start?: number; go?: boolean }) {
  const el = useRef<HTMLSpanElement>(null);
  const cued = go !== undefined;
  useIsoLayoutEffect(() => {
    const node = el.current;
    if (!node || typeof IntersectionObserver === "undefined" || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (cued) {
      node.dataset.flap = go ? "go" : "wait";
      return;
    }
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
  }, [cued, go]);
  // Screen readers get the title as one piece of text: a box per letter would be read out letter by letter, so the
  // flipping letters are only for the eye, each drawn from data-l (the title's text is in the page once). Letters are
  // grouped into words, so a title only wraps where it has a space, never between two letters.
  let n = start;
  return (
    <span ref={el} className="flap">
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {text.split(" ").map((word, w) => (
          <Fragment key={w}>
            {w > 0 && " "}
            <span>
              {[...word].map((ch, i) => (
                <span key={i} data-l={ch} style={{ "--i": n++ } as React.CSSProperties} />
              ))}
            </span>
          </Fragment>
        ))}
      </span>
    </span>
  );
}
