"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Chips, KeyPills, PlayGlyph, Tab, Transport } from "@/components/home/HomeBento";
import { type HomeState, FEELS, G_SHAPES, KEYS, LANES, LENGTHS, MOOD, SPEEDS, TAB_ROWS, chordsFor, formFor, level } from "@/components/home/homeData";
import { designUnit } from "@/lib/designUnit";
import { RHYTHM_NAMES } from "@/components/home/rhythms";
import { paintOscilloscope, readStageColors } from "@/lib/stagePaint";
import { TITLES, titleBag } from "@/lib/titleGenerator";

type Props = { state: HomeState; beat: number; bpm: number; moving: boolean; set: (p: Partial<HomeState>) => void };

/** Every piece of the home page's eye candy as a working tile (docs/mockups/home-bento-eye-candy.html). */
export function BentoGrid({ state, beat, bpm, moving, set }: Props) {
  const bar = Math.floor(beat / 4);
  const chorus = Math.floor(beat / 32) % 2 === 1;
  const form = useMemo(() => formFor(state.length, FEELS[state.feel].bpm), [state.length, state.feel]);
  const playing = Math.floor(beat / 16);

  return (
    <div className="hb-bento">
      <Tile className="s5" label="01 · KEY">
        <h3>Twelve keys. One tap.</h3>
        <KeyPills value={state.key} onChange={(key) => set({ key })} label="Key" />
        <Chips keyIndex={state.key} beat={beat} />
      </Tile>

      <Tile className="ink s3" label="02 · FEEL" d={1}>
        <div className="hb-huge" aria-live="polite">{FEELS[state.feel].bpm}<span className="sr-only"> BPM</span></div>
        <div className="hb-metro" aria-hidden="true">{[0, 1, 2, 3].map((i) => <i key={i} className={moving && beat % 4 === i ? "on" : ""} />)}</div>
        <div className="hb-opts" role="group" aria-label="Feel">
          {FEELS.map((f, i) => (
            <button key={f.id} type="button" aria-pressed={i === state.feel} onClick={() => set({ feel: i })}>{f.label}<span>{f.bpm}</span></button>
          ))}
        </div>
      </Tile>

      <Tile className="s4" label="03 · LENGTH" d={2}>
        <h3>{form.time} · {form.parts.length} parts</h3>
        <input className="hb-range" type="range" min={0} max={LENGTHS.length - 1} value={state.length} aria-label="Song length" aria-valuetext={form.time} onChange={(e) => set({ length: +e.target.value })} />
        <Form parts={form.parts} />
        <p className="hb-p">2:30 to 5:30, and every part is sized to fit.</p>
      </Tile>

      <Tile className="ink s5" label="THE COUNT-IN">
        <CountIn beat={beat} moving={moving} />
      </Tile>

      <Tile className="s7 r2" label="04 · EVERY PART, TABBED" d={1}>
        <h3>A whole song. Every bar.</h3>
        <Tab beat={beat} />
        <Form parts={form.parts} now={moving ? playing % form.parts.length : -1} />
        <Parts keyIndex={state.key} now={moving ? playing % 4 : -1} />
      </Tile>

      <Tile className="red s5" label="05 · PRACTISE" d={2}>
        <div className="hb-huge" aria-live="polite">{bpm}<span className="sr-only"> BPM</span></div>
        <Transport beat={beat} speed={state.speed}>
          <span className="hb-speed" role="group" aria-label="Practice speed">
            {SPEEDS.map((s, i) => (
              <button key={s} type="button" aria-pressed={i === state.speed} onClick={() => set({ speed: i })}>{Math.round(s * 100)}%</button>
            ))}
          </span>
        </Transport>
        <p className="hb-p">Loop any part, add a count-in, slow it down until your hands know it.</p>
      </Tile>

      <Tile className="s6" label="SIDE A · NOW PLAYING">
        <TapeDeck beat={beat} chorus={chorus} />
      </Tile>

      <Tile className="ink s6" label="ROOT AND FIFTH, ON THE BEAT" d={1}>
        <Neck keyIndex={state.key} bar={bar} />
      </Tile>

      <Tile className="s8" label={`TEN PARTS · ${chorus ? "CHORUS" : "VERSE"}`}>
        <Desk beat={beat} chorus={chorus} />
      </Tile>

      <Tile className="s4" label="THE PROMISE" d={1}>
        <Stamp slam={Math.floor((beat + 24) / 48)} />
        <p className="hb-p">Written from chord degrees and rhythm patterns. Never an artist&apos;s tab, so every riff is new.</p>
      </Tile>

      <Tile className="ink s7" label="STUCK ON A SONG TITLE?">
        <Flaps beat={beat} moving={moving} />
      </Tile>

      <Tile className="s5" label="TONIGHT'S SETLIST" d={1}>
        <div className="hb-sheet">
          <ol>
            {TITLES.slice(0, 6).map((t, i) => (
              <li key={t}>{t}<span>{KEYS[(i * 5) % 12]} · {FEELS[i % FEELS.length].bpm}</span></li>
            ))}
          </ol>
        </div>
      </Tile>

      <Tile className="s6" label="06 · MAKE IT YOURS">
        <Shape keyIndex={state.key} onAgain={() => set({ key: state.key })} />
      </Tile>

      <Tile className="s6" label={`MOOD MAP · ${MOOD[Math.floor(beat / 8) % MOOD.length]?.id ?? ""}`} d={1}>
        <Mood on={Math.floor(beat / 8) % MOOD.length} />
        <p className="hb-p">The Chord Lab maps every loop from dark to bright, settled to restless.</p>
      </Tile>

      <Tile className="s5" label="MIDI · TEN PARTS">
        <Roll />
        <p className="hb-p">Every part on its own track, with a marker where each section starts.</p>
      </Tile>

      <Tile className="s3" label="PDF SONGBOOK" d={1}>
        <div className="hb-pdf" aria-hidden="true">
          <b>{TITLES[0]}</b>
          {`KEY A · ${FEELS[0].label} · ${FEELS[0].bpm}\n\nVERSE 1 ×2\n${TAB_ROWS.slice(0, 6).join("\n")}`}
        </div>
        <p className="hb-p">Every part&apos;s tab, ready to print.</p>
      </Tile>

      <Tile className="brass s4" label="SHARE" d={2}>
        <div className="hb-huge" style={{ fontSize: "clamp(40px, 4vw, 64px)" }}>One link.</div>
        <p className="hb-p">Your song lives in the page&apos;s address: send it and the band opens the exact same song.</p>
        <div><Link className="hb-btn sm inked" href="/generator/"><PlayGlyph />WRITE ONE TO SEND</Link></div>
      </Tile>

      <Tile className="s4" label="THE SCOPE">
        <Scope moving={moving} bpm={bpm} />
        <p className="hb-p">The same moving scope that sits behind the Generator and the Chord Lab.</p>
      </Tile>

      <Tile className="s4" label="CHORD LAB · G MAJOR" d={1}>
        <div className="hb-boxes" role="img" aria-label={`Three G major shapes: ${G_SHAPES.map((g) => g.position).join(", ")}`}>
          {G_SHAPES.map((g, i) => <ChordBox key={i} frets={g.frets} />)}
        </div>
        <p className="hb-p">The shapes players actually use, up the neck.</p>
      </Tile>

      <Tile className="s4" label="DID YOU KNOW" d={2}>
        <h3>A power chord is only two notes.</h3>
        <G5 />
        <p className="hb-p">Root and fifth, no third: that&apos;s pure attitude.</p>
      </Tile>
    </div>
  );
}

/** A tile: the Generator's card, with a slight tilt and a glare that follow a mouse. */
function Tile({ className = "", label, d = 0, children }: { className?: string; label: string; d?: number; children: ReactNode }) {
  const el = useRef<HTMLDivElement>(null);
  const [fine, setFine] = useState(false);
  useEffect(() => setFine(matchMedia("(pointer: fine)").matches && !matchMedia("(prefers-reduced-motion: reduce)").matches), []);
  const move = (e: React.PointerEvent) => {
    const t = el.current;
    if (!fine || !t) return;
    const r = t.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    t.style.transform = `perspective(900px) rotateX(${(0.5 - y) * 4}deg) rotateY(${(x - 0.5) * 5}deg) translateY(-3px)`;
    t.style.setProperty("--gx", `${x * 100}%`);
    t.style.setProperty("--gy", `${y * 100}%`);
  };
  return (
    <div ref={el} className={`hb-card hb-tile ${className}`} data-reveal style={{ "--d": d } as React.CSSProperties} onPointerMove={move} onPointerLeave={() => el.current && (el.current.style.transform = "")}>
      <span className="hb-lab">{label}</span>
      {children}
      {fine && <span className="hb-glare" aria-hidden="true" />}
    </div>
  );
}

function Form({ parts, now = -1 }: { parts: { name: string; section: string; weight: number }[]; now?: number }) {
  return (
    <div className="hb-form" role="img" aria-label={`The song's form: ${parts.map((p) => p.name).join(", ")}`}>
      {parts.map((p, i) => (
        <i key={i} title={p.name} className={`${p.section === "chorus" ? "ch" : p.section === "solo" ? "so" : ""}${i === now ? " now" : ""}`} style={{ "--f": p.weight } as React.CSSProperties} />
      ))}
    </div>
  );
}

const LOCK = <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>;

function Parts({ keyIndex, now }: { keyIndex: number; now: number }) {
  const chords = chordsFor(keyIndex).map((c) => c.name);
  const [locked, setLocked] = useState<number[]>([1]);
  const rows: [string, string, number[]][] = [["Intro", `${RHYTHM_NAMES.intro}`, [0, 1]], ["Verse 1", `${RHYTHM_NAMES.verse} · palm-muted · ×2`, [0, 1, 2, 3]], ["Chorus", `${RHYTHM_NAMES.chorus} · open`, [3, 0, 1, 2]], ["Solo", "Lead over the chorus", [2, 3, 0, 1]]];
  return (
    <ul className="hb-parts">
      {rows.map(([n, d, order], i) => (
        <li key={n} className={`hb-part${n === "Chorus" ? " ch" : ""}${i === now ? " now" : ""}`}>
          <span className="hb-num">0{i + 1}</span>
          <div className="nm">{n}<small>{d} · {order.map((o) => chords[o]).join(" ")}</small></div>
          <button className="hb-ib" type="button" aria-label={`Lock ${n}`} aria-pressed={locked.includes(i)} onClick={() => setLocked((l) => (l.includes(i) ? l.filter((x) => x !== i) : [...l, i]))}>{LOCK}</button>
        </li>
      ))}
    </ul>
  );
}

function Shape({ keyIndex, onAgain }: { keyIndex: number; onAgain: () => void }) {
  const [pick, setPick] = useState(1);
  const [locked, setLocked] = useState(true);
  const [take, setTake] = useState(0);
  const options = Object.entries(RHYTHM_NAMES);
  return (
    <>
      <h3>Shape a part. Lock what you love.</h3>
      <div className="hb-opts" role="group" aria-label="Verse 1 rhythm">
        {options.map(([where, name], i) => (
          <button key={where} type="button" aria-pressed={i === pick} onClick={() => setPick(i)}>{name}<span>{where.toUpperCase()}</span></button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button className="hb-btn sm" type="button" onClick={() => { setTake((t) => t + 1); onAgain(); }}>BUILD AGAIN</button>
        <button className="hb-ib" type="button" aria-label="Lock Verse 1" aria-pressed={locked} onClick={() => setLocked((l) => !l)}>{LOCK}</button>
        <span className="hb-mono" aria-live="polite">{take ? `TAKE ${take + 1} · ${KEYS[keyIndex]}` : ""}</span>
      </div>
    </>
  );
}

function CountIn({ beat, moving }: { beat: number; moving: boolean }) {
  // 1 2 3 4, GO, then a rest; once every three bars
  const cb = beat % 12;
  return (
    <>
      <div className="hb-count" aria-hidden="true">
        {!moving || cb >= 8 ? <b className="rest">Count it in.</b> : cb < 4 ? <span key={beat}>{cb + 1}</span> : cb === 4 ? <span key={beat} className="word">Go!</span> : null}
      </div>
      <div className="hb-beats" aria-hidden="true">{[0, 1, 2, 3].map((i) => <i key={i} className={moving && cb < 4 && i <= cb ? "on" : ""} />)}</div>
      <p className="hb-p">A bar of clicks before the music, so you come in on the one.</p>
    </>
  );
}

function TapeDeck({ beat, chorus }: { beat: number; chorus: boolean }) {
  const meter = (side: number) => {
    const lvl = beat ? 10 + Math.round(level(beat, side) * (chorus ? 13 : 8)) - side : 12;
    return Array.from({ length: 24 }, (_, k) => <i key={k} className={k < lvl ? (k >= 21 ? "hb-r" : k >= 17 ? "hb-y" : "hb-g") : ""} />);
  };
  return (
    <>
      <div className="hb-deck" aria-hidden="true">
        <div className="hb-shell">
          <div className="hb-label"><div className="side">A</div><div className="ttl">{TITLES[0]}</div><div className="t">PALM/MUTE · C-90<br />E STANDARD</div></div>
          <div className="hb-window"><div className="hb-reel" /><div className="hb-reel r" /></div>
          <div className="bottom"><i /><i /><i /><i /></div>
        </div>
      </div>
      <div className="hb-vu" aria-hidden="true">L<div className="m">{meter(0)}</div>R<div className="m">{meter(1)}</div></div>
    </>
  );
}

const FRETS = 13;
const fx = (f: number) => (f === 0 ? 0.6 : (100 * (1 - Math.pow(2, -f / 12))) / (1 - Math.pow(2, -FRETS / 12)));
const mid = (f: number) => (f === 0 ? 2.2 : (fx(f) + fx(f - 1)) / 2); // an open string: just behind the nut
const SY = (s: number) => 8 + s * 16.8; // string 0 = low E, at the bottom
const STRING_INDEX: Record<string, number> = { E: 0, A: 1, D: 2, G: 3, B: 4, e: 5 };

function Neck({ keyIndex, bar }: { keyIndex: number; bar: number }) {
  const c = chordsFor(keyIndex)[bar % 4];
  const rs = STRING_INDEX[c.chord.rootString], fs = STRING_INDEX[c.chord.fifthString];
  return (
    <div className="hb-neckwrap" role="img" aria-label={`${c.name}: root on the ${c.chord.rootString} string, fret ${c.chord.rootFret}; fifth on the ${c.chord.fifthString} string, fret ${c.chord.fifthFret}`}>
      <div className="hb-neck" aria-hidden="true">
        <span className="nut" />
        {Array.from({ length: FRETS }, (_, i) => <span key={i} className="fret" style={{ left: `${fx(i + 1)}%` }} />)}
        {[3, 5, 7, 9].map((f) => <span key={f} className="inlay" style={{ left: `${mid(f)}%` }} />)}
        {[0, 1, 2, 3, 4, 5].map((s) => <span key={`${s}-${s === rs || s === fs ? bar : 0}`} className={`str${s === rs || s === fs ? " hit" : ""}`} style={{ top: `${100 - SY(s)}%`, "--h": `${4 - s * 0.5}px` } as React.CSSProperties} />)}
        <span className="dot" style={{ left: `${mid(c.chord.rootFret)}%`, top: `${100 - SY(rs)}%` }}>R</span>
        <span className="dot" style={{ left: `${mid(c.chord.fifthFret)}%`, top: `${100 - SY(fs)}%` }}>5</span>
      </div>
      <div className="hb-cname" aria-hidden="true">{c.name}<small>{c.degree} · {c.chord.rootFret === 0 ? "OPEN" : `${c.chord.rootString} STRING · FRET ${c.chord.rootFret}`}</small></div>
    </div>
  );
}

// which beats each part plays on, a bar of four (sub, bass, piano L, rhythm, vocal, piano R, pads, lead, synth, drums)
const PAT = [[1, 0, 0, 0], [1, 0, 1, 0], [1, 0, 1, 1], [1, 1, 1, 1], [0, 1, 0, 1], [0, 1, 1, 0], [1, 0, 0, 1], [1, 1, 0, 1], [1, 0, 1, 0], [1, 1, 1, 1]];
const SHORT = ["Sub", "Bass", "Piano L", "Rhythm", "Vox", "Piano R", "Pads", "Lead", "Synth", "Drums", "Master"];

function Desk({ beat, chorus }: { beat: number; chorus: boolean }) {
  const col = (i: number, c: number) => {
    const hit = i === 10 || PAT[i][beat % 4], base = chorus ? 8 : 5;
    const lvl = !beat ? 4 : hit ? base + Math.round(level(beat, i * 2 + c) * 5) : Math.max(2, base - 3);
    return <span key={c} className="col">{Array.from({ length: 14 }, (_, k) => <i key={k} className={k < lvl ? (k >= 12 ? "hb-r" : k >= 9 ? "hb-y" : "hb-g") : ""} />)}</span>;
  };
  return (
    <div className="hb-desk" role="img" aria-label={`A mixing desk with a channel for each of the MIDI export's ten parts (${LANES.join(", ")}) and a master`}>
      <div className="hb-strips" aria-hidden="true">
        {SHORT.map((l, i) => (
          <div key={l} className={`chn${i === 10 ? " master" : ""}`}>
            <span className="knob" style={{ rotate: `${((i * 47) % 180) - 90}deg` }} />
            <div className="mv">{i === 10 ? [col(i, 0), col(i, 1)] : col(i, 0)}</div>
            <div className="fader"><b style={{ transform: `translateY(-${((chorus ? 58 : 34) + ((i * 17) % 28)) * 0.67}px)` }} /></div>
            <span className="nm">{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stamp({ slam }: { slam: number }) {
  return (
    <div className="hb-stamp" aria-hidden="true">
      <div className="s" key={slam}>
        <svg viewBox="0 0 300 300">
          <defs><path id="hb-ring" d="M150 150m-122 0a122 122 0 1 1 244 0a122 122 0 1 1-244 0" /></defs>
          <circle cx="150" cy="150" r="146" fill="none" stroke="currentColor" strokeWidth="4" />
          <circle cx="150" cy="150" r="100" fill="none" stroke="currentColor" strokeWidth="2" />
          <text><textPath href="#hb-ring" textLength="752" lengthAdjust="spacing">NO TABS STORED ✦ CHORD PATTERNS ONLY ✦</textPath></text>
        </svg>
        <div className="core"><div>100%<br />ORIGINAL<small>PALM/MUTE</small></div></div>
      </div>
    </div>
  );
}

const SCRAMBLE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function Flaps({ beat, moving }: { beat: number; moving: boolean }) {
  const [title, setTitle] = useState(() => titleBag.current());
  const board = useRef<HTMLDivElement>(null);
  const next = () => setTitle(titleBag.next());
  useEffect(() => { if (moving && beat && beat % 40 === 20) next(); }, [beat, moving]);
  // each letter flips through a few characters before landing
  useEffect(() => {
    if (!moving) return;
    const cells = [...board.current!.querySelectorAll<HTMLElement>(".c")];
    const settle = cells.map((_, i) => 4 + i * 0.6 + Math.random() * 6);
    let tick = 0;
    const id = window.setInterval(() => {
      tick++;
      let busy = false;
      cells.forEach((c, i) => {
        const real = c.dataset.c!;
        if (tick < settle[i]) { busy = true; c.textContent = /[A-Z0-9]/.test(real) ? SCRAMBLE[Math.floor(Math.random() * SCRAMBLE.length)] : real; } else c.textContent = real;
        c.classList.remove("flip"); void c.offsetWidth; c.classList.add("flip");
      });
      if (!busy) clearInterval(id);
    }, 55);
    return () => { clearInterval(id); cells.forEach((c) => (c.textContent = c.dataset.c!)); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per new title
  }, [title]);
  return (
    <>
      <div ref={board} className="hb-flaps" role="status" aria-label={title}>
        {`"${title}"`.toUpperCase().split(" ").map((w, wi) => (
          <span key={`${wi}-${w}`} className="w" aria-hidden="true">{[...w].map((ch, i) => <span key={i} className="c" data-c={ch}>{ch}</span>)}</span>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span className="hb-p">Every song gets a slightly dramatic title.</span>
        <button className="hb-btn sm" type="button" onClick={next}>SHUFFLE</button>
      </div>
    </>
  );
}

function Mood({ on }: { on: number }) {
  return (
    <div className="hb-mood" role="img" aria-label={`The mood map, ${MOOD[on]?.id} picked`}>
      <span className="ax" style={{ left: 8, bottom: 6 }}>← DARK</span><span className="ax" style={{ right: 8, bottom: 6 }}>BRIGHT →</span>
      <span className="ax" style={{ left: 8, top: 6 }}>↑ RESTLESS · ↓ SETTLED</span>
      {MOOD.map((m, i) => (
        <span key={m.id} className={`md${i === on ? " on" : ""}`} style={{ left: `${m.x}%`, top: `${m.y}%` }} aria-hidden="true">
          <span className={m.x > 60 ? "l" : "r"}>{m.id}</span>
        </span>
      ))}
    </div>
  );
}

function Roll() {
  return (
    <div className="hb-roll" role="img" aria-label={`A piano roll of the MIDI export's ten tracks: ${LANES.join(", ")}`}>
      {LANES.map((l, i) => (
        <div key={l} aria-hidden="true">
          <span>{SHORT[i].toUpperCase()}</span>
          <span className="lane">
            {Array.from({ length: 10 }, (_, k) => k).filter((k) => (k * (i + 3)) % 5 < 3).map((k) => (
              <i key={k} style={{ left: `${k * 10}%`, width: `${5 + ((k + i) % 3) * 2}%`, "--c": i === 9 ? "var(--on-dark-3)" : i % 3 === 0 ? "var(--accent)" : i % 3 === 1 ? "var(--brass)" : "var(--on-dark-2)" } as React.CSSProperties} />
            ))}
          </span>
        </div>
      ))}
      <span className="ph" aria-hidden="true" />
    </div>
  );
}

/** The site's oscilloscope (lib/stagePaint.ts), in a tile; it runs only while on screen. */
function Scope({ moving, bpm }: { moving: boolean; bpm: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const live = useRef(bpm);
  live.current = bpm;
  useEffect(() => {
    const cv = canvas.current!, ctx = cv.getContext("2d")!;
    let colors = readStageColors(), raf = 0, seen = false, last = 0;
    const draw = (t: number) => {
      const dpr = Math.min(2, devicePixelRatio || 1), w = Math.round(cv.clientWidth * dpr), h = Math.round(cv.clientHeight * dpr);
      if (!w || !h) return;
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
      ctx.clearRect(0, 0, w, h);
      paintOscilloscope(ctx, w, h, t, live.current >= 150, colors, dpr * designUnit());
    };
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (now - last < 1000 / 30) return;
      last = now;
      draw(now / 1000);
    };
    const start = () => { cancelAnimationFrame(raf); if (seen && moving) raf = requestAnimationFrame(tick); else draw(12); };
    const io = new IntersectionObserver(([e]) => { seen = e.isIntersecting; start(); });
    io.observe(cv);
    const themes = new MutationObserver(() => { colors = readStageColors(); draw(12); });
    themes.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => { cancelAnimationFrame(raf); io.disconnect(); themes.disconnect(); };
  }, [moving]);
  return <canvas ref={canvas} className="hb-scope" aria-hidden="true" />;
}

function ChordBox({ frets }: { frets: (number | null)[] }) {
  const played = frets.filter((f): f is number => f !== null && f > 0);
  const base = Math.max(...played, 0) > 5 ? Math.min(...played) : 1;
  return (
    <svg viewBox="-6 0 76 100" aria-hidden="true">
      {[0, 1, 2, 3, 4, 5].map((x) => <line key={`s${x}`} x1={10 + x * 10} y1="14" x2={10 + x * 10} y2="94" stroke="var(--t3)" />)}
      {[0, 1, 2, 3, 4, 5].map((f) => <line key={`f${f}`} x1="10" y1={14 + f * 16} x2="60" y2={14 + f * 16} stroke="var(--t3)" strokeWidth={f === 0 && base === 1 ? 4 : 1} />)}
      {frets.map((f, x) =>
        f === null ? <text key={x} x={10 + x * 10} y="10" fontSize="8" textAnchor="middle" fill="var(--t3)">×</text>
        : f === 0 ? <circle key={x} cx={10 + x * 10} cy="7" r="3" fill="none" stroke="var(--t3)" />
        : <circle key={x} cx={10 + x * 10} cy={14 + (f - base + 0.5) * 16} r="5" fill="var(--accent)" />,
      )}
      {base > 1 && <text x="5" y="25" fontSize="8" textAnchor="end" fill="var(--t3)">{base}</text>}
    </svg>
  );
}

function G5() {
  return (
    <svg className="hb-g5" viewBox="0 0 400 150" role="img" aria-label="G5: root on the E string at the 3rd fret, fifth on the A string at the 5th fret">
      {[0, 1, 2, 3, 4, 5].map((s) => <line key={s} x1="30" x2="390" y1={20 + s * 22} y2={20 + s * 22} stroke="currentColor" strokeWidth={1 + (5 - s) * 0.3} opacity=".7" />)}
      <line x1="30" x2="30" y1="20" y2="130" stroke="currentColor" strokeWidth="5" />
      {[1, 2, 3, 4, 5].map((f) => <line key={f} x1={30 + f * 72} x2={30 + f * 72} y1="20" y2="130" stroke="var(--line-strong)" strokeWidth="3" />)}
      <line x1="210" y1="130" x2="354" y2="108" stroke="var(--accent)" strokeWidth="8" strokeLinecap="round" opacity=".3" />
      <circle className="pulse" cx="210" cy="130" r="12" /><circle className="pulse b" cx="354" cy="108" r="12" />
      <circle cx="210" cy="130" r="12" fill="var(--accent)" /><circle cx="354" cy="108" r="12" fill="var(--accent)" />
      <text x="210" y="134" textAnchor="middle" fontFamily="var(--mono)" fontWeight="700" fontSize="11" fill="var(--on-accent)">R</text>
      <text x="354" y="112" textAnchor="middle" fontFamily="var(--mono)" fontWeight="700" fontSize="11" fill="var(--on-accent)">5</text>
    </svg>
  );
}
