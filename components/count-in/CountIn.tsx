"use client";

import { useRef } from "react";
import { Encore } from "@/components/count-in/Encore";
import { PowerChordDiagram } from "@/components/count-in/PowerChordDiagram";
import { Setlist } from "@/components/count-in/Setlist";
import { Stage } from "@/components/count-in/Stage";
import { StampBand } from "@/components/count-in/StampBand";
import { TitleBoard } from "@/components/count-in/TitleBoard";
import { VuMeter } from "@/components/count-in/VuMeter";
import { useFinePointer, useReducedMotion, useReveal } from "@/components/count-in/scroll";

/** Count In: the home page (Soundcheck design, see DECISIONS.md). Styles live in app/count-in.css. */
export function CountIn() {
  const root = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const fine = useFinePointer() && !reduced;
  useReveal(root);

  return (
    <div ref={root} className={`ci ${fine ? "is-fine" : ""}`}>
      {/* roughens the stamp's inner ring */}
      <svg width="0" height="0" className="absolute" aria-hidden="true">
        <filter id="ci-rough"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves={2} result="n" /><feDisplacementMap in="SourceGraphic" in2="n" scale="3" /></filter>
      </svg>
      <div className="ci-grain" aria-hidden="true" />
      <VuMeter />

      <Stage reduced={reduced} fine={fine} />

      <section className="ci-intro" aria-label="What Palm/Mute does">
        <div className="ci-wrap" data-reveal>
          <p>
            Palm/Mute studies the chord progressions, palm-muted rhythms and song structures behind <mark className="[--d:0]">pop-punk hits.</mark> Then it writes
            you a <mark className="[--d:1]">brand-new song in your key,</mark> built on the same formula. Every riff is new. <mark className="[--d:2]">Nothing is copied.</mark>
          </p>
          <div className="ci-sig">E STANDARD · POWER CHORDS · 12 KEYS</div>
        </div>
      </section>

      <Setlist reduced={reduced} />
      <StampBand />

      <section className="ci-two" aria-labelledby="ci-two">
        <div className="ci-wrap ci-tn-grid">
          <div className="ci-huge2" data-reveal aria-hidden="true">2<span>NOTES</span></div>
          <div data-reveal className="[--d:1]">
            <div className="ci-tn-label">DID YOU KNOW</div>
            <h2 id="ci-two">A power chord is only two notes.</h2>
            <p>
              Root and fifth, no third. The third is the note that decides happy or sad, so without it you&apos;re left with pure attitude. That&apos;s why
              it&apos;s the only chord shape pop-punk ever needed.
            </p>
            <PowerChordDiagram root="G" />
          </div>
        </div>
      </section>

      <TitleBoard reduced={reduced} />
      <Encore fine={fine} />
    </div>
  );
}
