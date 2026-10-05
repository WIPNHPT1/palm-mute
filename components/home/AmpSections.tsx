import { Fragment } from "react";

// Two sections of "Amp blowout" (owner's pick, docs/mockups/home-wow-scroll.html option 6). Their movement lives in
// AmpFx.tsx; here is only the markup.

const STEPS: [string, string, string][] = [
  ["ink", "Study the formula", "We break down the chord degrees, rhythm templates and section lengths behind pop-punk's biggest songs: the pattern underneath, never the tabs."],
  ["red", "Pick a key and a feel", "Twelve keys, five feels from fast punk to ballad, and a length from 2:30 to 5:30."],
  ["clear", "Build the song", "Intro, verses, choruses, solo and breakdown, written as real power-chord tab in E standard."],
  ["brass", "Make it yours", "Change a part's rhythm or drums, lock what you love, then take it away as a PDF songbook or MIDI."],
];

/** "How it works": four posters that pin and slide sideways as you scroll (stacked on phones and with reduced motion). */
export function HowItWorks() {
  return (
    <section className="hb-how" aria-labelledby="hb-how" data-amp-how>
      <div className="hb-how-pin">
        <div className="hb-wrap">
          <div className="hb-kick">HOW IT WORKS</div>
          <h2 id="hb-how" className="hb-h2">Four steps.<br /><em>One song.</em></h2>
        </div>
        <ol className="hb-how-track" data-amp-track>
          {STEPS.map(([kind, title, body], i) => (
            <li key={title} className={`hb-poster ${kind}`}>
              <span className="hb-poster-tag">STEP {String(i + 1).padStart(2, "0")}</span>
              <span className="hb-poster-no" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
              <div><h3>{title}</h3><p>{body}</p></div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

const LINES: [string, boolean][] = [["Every riff", false], ["is new.", false], ["Nothing is", true], ["copied.", true]];

/** The promise in giant type, pinned while it fills in letter by letter (over the scope, like the sections below it). */
export function Statement() {
  let n = 0;
  return (
    <section className="hb-statement" data-amp-statement data-quiet>
      <div className="hb-statement-pin">
        <p className="sr-only">Every riff is new. Nothing is copied.</p>
        <p className="hb-big" aria-hidden="true">
          {LINES.map(([line, red], li) => (
            <span key={line} className={red ? "red" : undefined}>
              {li > 0 && " "}
              {line.split(" ").map((word, wi) => (
                <Fragment key={wi}>
                  {wi > 0 && " "}
                  <span className="w">{[...word].map((ch, ci) => <span key={ci} className="ch" style={{ "--i": n++ } as React.CSSProperties}>{ch}</span>)}</span>
                </Fragment>
              ))}
            </span>
          ))}
        </p>
      </div>
    </section>
  );
}
