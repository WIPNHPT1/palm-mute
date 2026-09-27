"use client";

import Link from "next/link";
import { PUNK_MASTER_BPM } from "@/lib/generator";

/** Closing call to action; the buttons lean toward the pointer on desktop. */
export function Encore({ fine }: { fine: boolean }) {
  const lean = (e: React.PointerEvent<HTMLElement>) => {
    if (!fine) return;
    const b = e.currentTarget, r = b.getBoundingClientRect();
    b.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.25}px, ${(e.clientY - r.top - r.height / 2) * 0.35}px)`;
  };
  const settle = (e: React.PointerEvent<HTMLElement>) => { e.currentTarget.style.transform = ""; };
  const row = (text: string) => <><span>{text}&nbsp;</span><span>{text}&nbsp;</span></>;

  return (
    <section className="ci-encore" aria-labelledby="ci-encore">
      <div className="ci-encore-bg" aria-hidden="true">
        <div>{row("START WRITING ✦ START WRITING ✦ START WRITING ✦")}</div>
        <div>{row(`E STANDARD ✦ ${PUNK_MASTER_BPM} BPM ✦ E STANDARD ✦ ${PUNK_MASTER_BPM} BPM ✦`)}</div>
      </div>
      <div className="ci-wrap" data-reveal>
        <h2 id="ci-encore">Count it in.</h2>
        <div className="ci-encore-btns">
          <Link className="ci-mag solid" href="/generator/" onPointerMove={lean} onPointerLeave={settle}>
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M5 3l14 9-14 9z" /></svg>START WRITING
          </Link>
          <Link className="ci-mag line" href="/chords/" onPointerMove={lean} onPointerLeave={settle}>BROWSE THE CHORD LIBRARY</Link>
        </div>
      </div>
    </section>
  );
}
