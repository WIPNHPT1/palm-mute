"use client";

import { useEffect, useRef, useState } from "react";
import { INITIAL_TITLE, formatTitle, nextTitle } from "@/lib/titleGenerator";

const SCRAMBLE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/** Song titles on a split-flap board: each letter flips through random characters before landing. */
export function TitleBoard({ reduced }: { reduced: boolean }) {
  const [pick, setPick] = useState(INITIAL_TITLE);
  const [flipping, setFlipping] = useState(false);
  const board = useRef<HTMLDivElement>(null);
  const animate = useRef(false);
  const title = formatTitle(pick);

  useEffect(() => {
    if (!animate.current || reduced) return;
    animate.current = false;
    // Scramble the letters React just rendered, then settle each back on its real character.
    const cells = [...board.current!.querySelectorAll<HTMLElement>(".ci-fc")];
    const settle = cells.map((_, i) => 4 + i * 0.6 + Math.random() * 6);
    let tick = 0;
    setFlipping(true);
    const id = window.setInterval(() => {
      tick++;
      let busy = false;
      cells.forEach((c, i) => {
        const real = c.dataset.c!;
        if (tick < settle[i]) { busy = true; c.textContent = /[A-Z0-9]/.test(real) ? SCRAMBLE[Math.floor(Math.random() * SCRAMBLE.length)] : real; }
        else c.textContent = real;
        c.classList.remove("flip"); void c.offsetWidth; c.classList.add("flip");
      });
      if (!busy) { clearInterval(id); setFlipping(false); }
    }, 55);
    return () => { clearInterval(id); cells.forEach((c) => { c.textContent = c.dataset.c!; }); };
  }, [pick, reduced]);

  const shuffle = () => {
    if (flipping) return;
    // mark busy right away: the scramble starts on the next tick, and a second click in between must wait
    if (!reduced) setFlipping(true);
    animate.current = true;
    setPick((p) => nextTitle(p));
  };

  return (
    <section className="ci-board-sec" aria-labelledby="ci-titles">
      <div className="ci-wrap">
        <div className="ci-board" data-reveal>
          <div className="ci-board-top"><span id="ci-titles">STUCK ON A SONG TITLE?</span><span>NOW PLAYING <b>· TRACK 04</b></span></div>
          <div ref={board} className="ci-flaps" role="status" aria-label={title} aria-busy={flipping} data-flap>
            {title.toUpperCase().split(" ").map((word, w) => (
              <span key={`${w}-${word}`} className="ci-fw" aria-hidden="true">
                {[...word].map((ch, i) => <span key={i} className="ci-fc" data-c={ch}>{ch}</span>)}
              </span>
            ))}
          </div>
          <div className="ci-board-foot">
            <p>Every song deserves a slightly dramatic title. Hit shuffle until it&apos;s dramatic enough.</p>
            <button className="ci-flip-btn" type="button" onClick={shuffle} disabled={flipping} data-shuffle>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
              SHUFFLE
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
