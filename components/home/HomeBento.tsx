"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BentoGrid } from "@/components/home/BentoGrid";
import { Speaker } from "@/components/Speaker";
import { StageBackground } from "@/components/StageBackground";
import { type HomeState, FEELS, KEYS, SPEEDS, STATS, bpmOf, chordsFor, loopTab } from "@/components/home/homeData";
import { progressions } from "@/lib/musicTheory";

/**
 * The home page (owner's pick, docs/mockups/home-bento-eye-candy.html: "Live session · Bento"; the hero is "Studio
 * glass", docs/mockups/home-hero-premium.html). A live Song Generator card in the hero, then the stats, the Bento grid of working tiles and the
 * questions. One beat clock drives every tile at the tempo of the feel picked (and the practice speed), so the page
 * plays as one song. The clock stops while the tab is hidden and never runs with reduced motion.
 */
export function HomeBento() {
  const root = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<HomeState>({ key: 0, feel: 0, length: 1, speed: 0 });
  const [beat, setBeat] = useState(0);
  const [auto, setAuto] = useState(true);
  const [moving, setMoving] = useState(false);
  const bpm = bpmOf(state);

  // A user's pick stops the page's own slow demo (it changes key and feel by itself until then).
  const set = useCallback((patch: Partial<HomeState>) => {
    setAuto(false);
    setState((s) => ({ ...s, ...patch }));
  }, []);

  // the beat clock
  useEffect(() => {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let timer = 0;
    const start = () => {
      clearInterval(timer);
      const run = !reduced.matches && !document.hidden;
      setMoving(run);
      if (run) timer = window.setInterval(() => setBeat((b) => b + 1), 60000 / bpm);
    };
    start();
    document.addEventListener("visibilitychange", start);
    reduced.addEventListener("change", start);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", start);
      reduced.removeEventListener("change", start);
    };
  }, [bpm]);

  // the demo: a new key every 8 bars, a new feel every 16
  useEffect(() => {
    if (!auto || !beat) return;
    if (beat % 32 === 16) setState((s) => ({ ...s, key: (s.key + 5) % KEYS.length }));
    if (beat % 64 === 0) setState((s) => ({ ...s, feel: (s.feel + 1) % FEELS.length }));
  }, [beat, auto]);

  // reveal on scroll, and looping CSS animations pause while their section is off screen
  useEffect(() => {
    const el = root.current!;
    const reveal = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && e.target.classList.add("in")), { rootMargin: "0px 0px -8% 0px" });
    el.querySelectorAll("[data-reveal]").forEach((n) => reveal.observe(n));
    const pause = new IntersectionObserver((es) => es.forEach((e) => (e.target as HTMLElement).toggleAttribute("data-offscreen", !e.isIntersecting)), { rootMargin: "100px" });
    el.querySelectorAll(":scope > section, :scope > div").forEach((n) => pause.observe(n));
    return () => { reveal.disconnect(); pause.disconnect(); };
  }, []);

  return (
    <div ref={root} className="hb" style={{ "--beat": `${Math.round(60000 / bpm)}ms` } as React.CSSProperties}>
      {/* the Generator and Chord Lab's fixed scope, showing through the lower sections; the kit cross-fades from the
          speaker cab into it (app/home.css, "Speaker cone") */}
      <StageBackground playing={false} showsThrough=".hb [data-quiet]" />
      <div className="hb-grain" aria-hidden="true" />
      <Hero state={state} beat={beat} bpm={bpm} onKey={(key) => set({ key })} />
      <Marquee />
      <section className="hb-stats-sec" aria-label="Palm/Mute in numbers">
        <dl className="hb-stats hb-wrap" data-reveal>
          {STATS.map(([n, l]) => (
            <div key={l}><dt>{l}</dt><dd>{n}</dd></div>
          ))}
        </dl>
      </section>
      <section className="hb-sec hb-kit-sec" aria-labelledby="hb-kit" data-quiet>
        <Speaker kind="cab" beat={beat} />
        <div className="hb-wrap">
          <div data-reveal>
            <div className="hb-kick">EVERYTHING IN ONE PLACE</div>
            <h2 id="hb-kit" className="hb-h2" style={{ marginBottom: 40 }}>The whole kit,<br /><em>at a glance.</em></h2>
          </div>
          <BentoGrid state={state} beat={beat} bpm={bpm} moving={moving} set={set} />
        </div>
      </section>
      <Questions />
      <Encore bpm={bpm} />
    </div>
  );
}

/** The opening screen: the headline, and a live Song Generator card writing verse 1 on the beat. */
function Hero({ state, beat, bpm, onKey }: { state: HomeState; beat: number; bpm: number; onKey: (k: number) => void }) {
  const col = useRef<HTMLDivElement>(null);
  const kin = useRef<HTMLHeadingElement>(null);
  // fit the headline to its column, as the Generator's page titles never run past theirs
  useEffect(() => {
    const fit = () => {
      if (!kin.current || !col.current) return;
      const cw = col.current.clientWidth - 6;
      const ind = [0, cw * 0.05, 0, cw * 0.09];
      kin.current.style.setProperty("--in2", `${ind[1]}px`);
      kin.current.style.setProperty("--in4", `${ind[3]}px`);
      kin.current.style.setProperty("--kin", "100px");
      const ws = [...kin.current.children].slice(0, 4).map((s) => (s as HTMLElement).offsetWidth);
      kin.current.style.setProperty("--kin", `${Math.max(26, Math.min(110, ...ws.map((w, i) => ((cw - ind[i]) / w) * 100))).toFixed(1)}px`);
    };
    fit();
    document.fonts.ready.then(fit);
    const ro = new ResizeObserver(fit);
    ro.observe(col.current!);
    return () => ro.disconnect();
  }, []);

  return (
    <section className="hb-hero" aria-labelledby="hb-title">
      <div className="hb-fx" aria-hidden="true">
        <div className="hb-studio" />
        <Speaker kind="one" beat={beat} />
        <i className="hb-aura a" /><i className="hb-aura b" /><i className="hb-aura c" />
      </div>
      <div className="hb-wrap hb-hgrid">
        <div ref={col}>
          <div className="hb-htop">
            <span className="hb-mono">COUNT IN · ABOUT PALM/MUTE</span>
            <span className="hb-live" data-live-bpm={bpm}><i />LIVE · {bpm} BPM</span>
          </div>
          <h1 ref={kin} id="hb-title" className="hb-kin">
            <span aria-hidden="true">Songwriting</span><span aria-hidden="true">formulas from</span><span aria-hidden="true">the bands that</span><span aria-hidden="true">built pop-punk.</span>
            {/* the drawn lines are four separate lines; screen readers and search get the sentence */}
            <span className="sr-only">Songwriting formulas from the bands that built pop-punk.</span>
          </h1>
          <p className="hb-hsub">A songwriting engine for pop-punk. Pick a key and a feel, and Palm/Mute writes the song, right there, as you watch.</p>
          <div className="hb-cta">
            <Link className="hb-btn" href="/generator/"><PlayGlyph />START WRITING</Link>
            <Link className="hb-lnk" href="/chords/">Open the Chord Lab →</Link>
          </div>
        </div>
        <div data-reveal>
          <div className="hb-glass" data-live-card>
            <div className="hb-cardhd"><span className="hb-num">01</span><span>Verse 1</span><span className="hb-cap">KEY OF <b>{KEYS[state.key]}</b> · {FEELS[state.feel].label}</span></div>
            <KeyPills value={state.key} onChange={onKey} label="Key, in the live card" />
            <Chips keyIndex={state.key} beat={beat} />
            <Tab keyIndex={state.key} beat={beat} />
            <Transport beat={beat} speed={state.speed} />
            <div className="hb-glass-foot"><span><i />NO TABS STORED</span><span>×2 · E STANDARD</span></div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function PlayGlyph() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3l14 9-14 9z" /></svg>;
}

export function KeyPills({ value, onChange, label }: { value: number; onChange: (k: number) => void; label: string }) {
  return (
    <div className="hb-pills" role="group" aria-label={label}>
      {KEYS.map((k, i) => (
        <button key={k} type="button" className="hb-pill" aria-pressed={i === value} onClick={() => onChange(i)}>{k}</button>
      ))}
    </div>
  );
}

/** I–V–vi–IV in the key, as the Generator's chord chips (the chord library's two-note tabs); the one sounding fills its bar. */
export function Chips({ keyIndex, beat }: { keyIndex: number; beat: number }) {
  const chords = useMemo(() => chordsFor(keyIndex), [keyIndex]);
  const bar = Math.floor(beat / 4);
  return (
    <div className="hb-chips" aria-label={`I–V–vi–IV in ${KEYS[keyIndex]}: ${chords.map((c) => c.name).join(", ")}`} role="img">
      {chords.map((c, i) => {
        const now = beat > 0 && bar % 4 === i;
        return (
          // keyed by the key, so the chips flip in when it changes; only the bar fill restarts each bar
          <span key={`${keyIndex}-${i}`} className={`hb-chip${now ? " now" : ""}`} style={{ "--i": i } as React.CSSProperties} aria-hidden="true">
            <small>{c.degree}</small><b>{c.name}</b><pre>{c.tab}</pre>
            {now && <i key={bar} className="hb-fill" />}
          </span>
        );
      })}
    </div>
  );
}

/**
 * The loop's tab in the key: one bar per chord, as the chips show it. One beat is a quarter note: the bar sounding is
 * the chip that's lit (a chord a bar), and the playhead moves two eighth-note strums a beat. Before the first beat (and
 * with reduced motion) the playhead waits at the start and no bar is lit.
 */
export function Tab({ keyIndex, beat }: { keyIndex: number; beat: number }) {
  const tab = useMemo(() => loopTab(keyIndex), [keyIndex]);
  const bar = Math.floor(beat / 4) % 4;
  return (
    <div className="hb-tabw">
      <pre className="hb-tab" aria-hidden="true" data-bar={beat > 0 ? bar : undefined} style={{ "--bar": bar, "--cell": (beat % 4) * 2 } as React.CSSProperties}>
        <span className="hb-tab-in">
          {beat > 0 && <span className="cur" />}
          <span className="head" />
          {"  "}
          {tab.names.map((n, i) => <b key={i}>{n.padEnd(17)}</b>)}
          {"\n"}
          {tab.rows.join("\n")}
          {"\n"}
          <span className="pm">{tab.pm}</span>
        </span>
      </pre>
    </div>
  );
}

export function Transport({ beat, speed, children }: { beat: number; speed: number; children?: React.ReactNode }) {
  return (
    <div className="hb-transport">
      <span className="hb-play" aria-hidden="true">
        <svg className="hb-ringsvg" viewBox="0 0 54 54"><circle className="tr" cx="27" cy="27" r="24" /><circle className="pr" cx="27" cy="27" r="24" /></svg>
        <svg className="p" viewBox="0 0 24 24"><path d="M5 3l14 9-14 9z" /></svg>
      </span>
      {children ?? (
        <>
          <span className="hb-mono" style={{ color: "var(--on-dark-2)" }}>0:{String(8 + (Math.floor(beat / 3) % 50)).padStart(2, "0")} / 3:00</span>
          <span className="hb-prog"><i /></span>
          <span className="hb-mono" style={{ color: "var(--on-dark-3)" }}>{Math.round(SPEEDS[speed] * 100)}%</span>
        </>
      )}
    </div>
  );
}

function Marquee() {
  const ids = progressions.slice(0, 8).map((p) => p.degrees.join("–"));
  return (
    <div className="hb-marquee" aria-hidden="true">
      <div>{[...ids, ...ids].map((p, i) => <span key={i}>{p}</span>)}</div>
    </div>
  );
}

const FAQ: [string, string][] = [
  ["Is it free?", "Yes. Palm/Mute runs in your browser: no download, no sign-up."],
  ["Do I need an account?", "No. There are no accounts. Your song lives in the page's address, so copying the link keeps it, and the Chord Lab remembers your setup on your device."],
  ["Is it copying real songs?", "No. Palm/Mute studies chord degrees, rhythm templates and section lengths, the patterns underneath. It never stores or reproduces an artist's tab, so every riff is written fresh."],
  ["Can I use it in my DAW?", "Yes. Export a MIDI file with every part on its own track (sub, bass, piano, rhythm and lead guitar, a guide vocal, pads, synth and drums), with a marker where each section starts."],
  ["Which tunings?", "The Song Generator writes in E standard. The Chord Lab covers E standard, Eb standard, Drop D and Drop C#, with a capo up to the 7th fret."],
];

function Questions() {
  return (
    <section className="hb-sec" style={{ paddingTop: 0 }} aria-labelledby="hb-faq" data-quiet>
      <div className="hb-wrap">
        <div data-reveal>
          <div className="hb-kick">QUESTIONS</div>
          <h2 id="hb-faq" className="hb-h2" style={{ marginBottom: 36 }}>Before you <em>count in.</em></h2>
        </div>
        <div className="hb-faq">
          {FAQ.map(([q, a], i) => (
            <details key={q} data-reveal style={{ "--d": i } as React.CSSProperties} open={i === 0}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function Encore({ bpm }: { bpm: number }) {
  const row = (t: string) => <><span>{t}&nbsp;</span><span>{t}&nbsp;</span></>;
  return (
    <section className="hb-encore" aria-labelledby="hb-encore" data-quiet>
      <div className="tape" aria-hidden="true">
        <div>{row("START WRITING ✦ START WRITING ✦ START WRITING ✦")}</div>
        <div>{row(`E STANDARD ✦ ${bpm} BPM ✦ E STANDARD ✦ ${bpm} BPM ✦`)}</div>
      </div>
      <div className="hb-wrap">
        <h2 id="hb-encore" className="hb-h2">Count it in.</h2>
        <div className="row">
          <Link className="hb-btn" href="/generator/"><PlayGlyph />START WRITING</Link>
          <Link className="hb-btn ghost" href="/chords/">OPEN THE CHORD LAB</Link>
        </div>
      </div>
    </section>
  );
}
