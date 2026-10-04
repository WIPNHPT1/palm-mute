"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Fretboard rails in the side gutters on big screens (owner's pick, docs/mockups/stage-options.html): a strip of
 * fretboard either side of the page, scrolling at under half the page's speed (parallax), its strings shimmering
 * while music plays. Only where the gutters are at least about 160px wide (1600px windows and up, see lib/stage.ts),
 * always behind the page and never clickable.
 */
export function SideRails({ playing }: { playing: boolean }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const rails = useRef<HTMLDivElement>(null);
  useEffect(() => setHost(document.body), []);
  useEffect(() => {
    const el = rails.current;
    if (!el) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      el.style.setProperty("--sy", `${window.scrollY}px`);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [host]);
  if (!host) return null;
  const side = (s: "left" | "right") => (
    <div className={`stage-rail ${s}`}>
      <div className="stage-board">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <i key={i} style={{ left: `${10 + i * 16}%` }} />
        ))}
      </div>
    </div>
  );
  return createPortal(
    <div ref={rails} data-stage-rails data-playing={playing} aria-hidden="true">
      {side("left")}
      {side("right")}
    </div>,
    host,
  );
}
