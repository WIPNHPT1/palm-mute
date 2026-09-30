// Builds docs/mockups/grooves-and-riffs.html (Song Engine v2 Phase 4, PRD R11–R14): how 16th-note bars
// should look in a card, candidate grooves per section role with their drums locked to the guitar, and
// moving intro riffs, all playable (Web Audio) in A over I-V-vi-IV. Chord voicings come from the real
// engine (seed 0 Verse and Chorus); riff notes are computed from pitches, and every fret is checked here.
// `npx tsx scripts/build-grooves-mockup.ts`
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type Fretted, type TabBar, type TabString, midiOf, pitchClass, renderTab } from "@/lib/fretboard";
import { renderSection } from "@/lib/generator";
import { mutePlan } from "@/lib/playability";
import { type Voicing, candidates } from "@/lib/voicings";

const KEY_PC = 9; // A
const inputs = { key: "A" as const, feel: "fast-punk" as const, progressionId: "I-V-vi-IV", seed: 0 };
const verse = renderSection("verse", inputs);
const chorus = renderSection("chorus", inputs);
const byName = (s: typeof verse) => Object.fromEntries(s.voicings.map((v) => [v.chord.name, v.voicing])) as Record<string, Voicing>;
const V = byName(verse), C = byName(chorus);
const CHORDS = ["A5", "E5", "F#5", "D5"];

// ---------------------------------------------------------------------------
// Grooves: 16 cells per bar (sixteenth notes). D = down, U = up, x = dead, - = ring on, . = rest.
type Drums = { kick?: number[]; snare?: number[]; hat?: number[]; crash?: number[]; tom?: number[] };
type Groove = {
  id: string; role: string; name: string; isNew: boolean; note: string;
  voicings: Record<string, Voicing>; bars: string[]; art: ("pm" | "ring")[]; accents?: number[];
  drums: Drums[]; // per bar (cycled)
};
const hat8 = [0, 2, 4, 6, 8, 10, 12, 14];
const punk: Drums = { kick: [0, 10], snare: [4, 12], hat: hat8 };
const GROOVES: Groove[] = [
  { id: "verse-sparse", role: "Verse · sparse", name: "Sparse chugs (today)", isNew: false, note: "Today's Verse: eighths with gaps, palm-muted.",
    voicings: V, bars: ["D...D.D.D...D.D."], art: ["pm"], accents: [0, 8], drums: [punk] },
  { id: "verse-gallop", role: "Verse · drive", name: "Gallop", isNew: true, note: "Eighth + two sixteenths on every beat (needs the 16th grid). Kick doubles the gallop on 1 and 3.",
    voicings: V, bars: ["D.DDD.DDD.DDD.DD"], art: ["pm"], accents: [0, 8], drums: [{ kick: [0, 2, 3, 8, 10, 11], snare: [4, 12], hat: hat8 }] },
  { id: "verse-stop", role: "Verse · stop-time", name: "Stop-time", isNew: true, note: "Band hits on 1 and the and of 2, then silence under the vocal; the hi-hat keeps time. Last bar chugs back in.",
    voicings: V, bars: ["D-----D-........", "D-----D-........", "D-----D-........", "D.D.D.D.D.D.D.D."], art: ["ring", "ring", "ring", "pm"], accents: [0, 6],
    drums: [{ kick: [0, 6], crash: [0], hat: [8, 12] }, { kick: [0, 6], hat: [8, 12] }, { kick: [0, 6], crash: [0], hat: [8, 12] }, punk] },
  { id: "pre-fill", role: "Pre-chorus · build + fill", name: "Build with a fill", isNew: true, note: "Eighth chugs, then sixteenths for the last two beats with a snare fill: the drop into the Chorus.",
    voicings: V, bars: ["D.D.D.D.D.D.D.D.", "D.D.D.D.D.D.D.D.", "D.D.D.D.D.D.D.D.", "D.D.D.D.DDDDDDDD"], art: ["pm", "pm", "pm", "ring"], accents: [0, 8],
    drums: [punk, punk, punk, { kick: [0, 4], snare: [8, 9, 10, 11, 12, 13, 14, 15], hat: [0, 2, 4, 6] }] },
  { id: "chorus-open", role: "Chorus · open", name: "Let-ring eighths with pushes (today)", isNew: false, note: "Today's Chorus: ringing eighths, the next chord an eighth early in bars 1 and 3.",
    voicings: C, bars: ["D-D-D-D-D-D-D-D-"], art: ["ring"], accents: [0], drums: [{ kick: [0, 8, 10], snare: [4, 12], hat: hat8, crash: [0] }] },
  { id: "chorus-hits", role: "Chorus · big", name: "Accent hits", isNew: true, note: "Big ringing hits on 1, the and of 2 and 4, kick and crash with every one (guitar and drums from one groove id).",
    voicings: C, bars: ["D-----D-----D-D-"], art: ["ring"], accents: [0, 6, 12], drums: [{ kick: [0, 6, 12], crash: [0, 6], snare: [4, 12], hat: [2, 8, 10, 14] }] },
  { id: "chorus-gallop", role: "Chorus · drive", name: "Open gallop", isNew: true, note: "The gallop, let ring and lifted: a skate-punk Chorus (needs the 16th grid).",
    voicings: C, bars: ["D-DDD-DDD-DDD-DD"], art: ["ring"], accents: [0, 4, 8, 12], drums: [{ kick: [0, 2, 3, 8, 10, 11], snare: [4, 12], hat: hat8, crash: [0] }] },
];

// ---------------------------------------------------------------------------
// Intro riffs over the Chorus's first two chords (I, V, I, V), 16 cells per bar.
type RiffNote = { cell: number; notes: Fretted[]; len: number };
type Riff = { id: string; name: string; isNew: boolean; note: string; chords: string[]; bars: RiffNote[][]; art: ("pm" | "ring")[] };
const at = (string: TabString, fret: number): Fretted => ({ string, fret });
const oct = (s: TabString, f: number): Fretted[] => (s === "E" ? [at("E", f), at("D", f + 2)] : [at("A", f), at("G", f + 2)]);
const seq = (items: Fretted[][], step: number, len = step): RiffNote[] => items.map((notes, i) => ({ cell: i * step, notes, len }));
const RIFFS: Riff[] = [
  { id: "riff-today", name: "Octave riff (today)", isNew: false, note: "One octave per chord, repeated: it doesn't move.", chords: ["A oct", "E oct", "A oct", "E oct"], art: ["ring"],
    bars: [seq(Array(8).fill(oct("A", 0)), 2), seq(Array(8).fill(oct("E", 0)), 2)] },
  { id: "riff-climb", name: "Octave climb", isNew: true, note: "Root, 3rd, 5th, octave of each chord in octaves: A C# E A, then E G# B E. Quarter notes, let ring.", chords: ["A", "E", "A", "E"], art: ["ring"],
    bars: [seq([oct("A", 0), oct("A", 4), oct("A", 7), oct("E", 5)], 4), seq([oct("E", 0), oct("E", 4), oct("E", 7), oct("A", 7)], 4)] },
  { id: "riff-low", name: "Low-string P.M. riff", isNew: true, note: "Single notes on the low strings, palm-muted gallops walking up the scale: the classic punk intro.", chords: ["A", "E", "A", "E"], art: ["pm"],
    bars: [
      [0, 2, 3, 4, 6, 7].map((c) => ({ cell: c, notes: [at("A", 0)], len: 1 })).concat([8, 10, 11].map((c) => ({ cell: c, notes: [at("A", 2)], len: 1 })), [12, 14, 15].map((c) => ({ cell: c, notes: [at("A", 4)], len: 1 }))),
      [0, 2, 3, 4, 6, 7].map((c) => ({ cell: c, notes: [at("E", 0)], len: 1 })).concat([8, 10, 11].map((c) => ({ cell: c, notes: [at("E", 2)], len: 1 })), [12, 14, 15].map((c) => ({ cell: c, notes: [at("E", 4)], len: 1 }))),
    ] },
  { id: "riff-pedal", name: "Open-string pedal riff", isNew: true, note: "Open A (then open E) under a line climbing the D (then A) string: E, F#, G#, A over the A pedal; B, C#, D, E over the E.", chords: ["A", "E", "A", "E"], art: ["ring"],
    bars: [
      [[at("A", 0)], [at("D", 2)], [at("A", 0)], [at("D", 4)], [at("A", 0)], [at("D", 6)], [at("A", 0)], [at("D", 7)]].map((n, i) => ({ cell: i * 2, notes: n, len: 2 })),
      [[at("E", 0)], [at("A", 2)], [at("E", 0)], [at("A", 4)], [at("E", 0)], [at("A", 5)], [at("E", 0)], [at("A", 7)]].map((n, i) => ({ cell: i * 2, notes: n, len: 2 })),
    ] },
  { id: "riff-hook", name: "Hook line in octaves", isNew: true, note: "A stepwise tune in octaves (A B C# B, then G# E). In Phase 4 it would come from the Chorus's lead motif, so the intro previews the hook.", chords: ["A", "E", "A", "E"], art: ["ring"],
    bars: [seq([oct("A", 0), oct("A", 2), oct("A", 4), oct("A", 2)], 4), [{ cell: 0, notes: oct("E", 4), len: 8 }, { cell: 8, notes: oct("E", 0), len: 8 }]] },
];

// Every riff note is in A major (pitch-checked), within frets 0–12.
const A_MAJOR = [0, 2, 4, 5, 7, 9, 11].map((d) => (KEY_PC + d) % 12);
for (const r of RIFFS)
  for (const bar of r.bars)
    for (const n of bar)
      for (const f of n.notes) {
        if (f.fret < 0 || f.fret > 12) throw new Error(`${r.id}: fret ${f.fret}`);
        if (!A_MAJOR.includes(pitchClass(midiOf(f)))) throw new Error(`${r.id}: ${f.string}${f.fret} isn't in A major`);
      }

// ---------------------------------------------------------------------------
// Playable data + tabs in three layouts.
type Ev = { cell: number; midi: number[]; len: number; pm: boolean; dead?: boolean; accent: boolean; frets: Partial<Record<TabString, string>> };
type PlayBar = { label: string; events: Ev[]; drums: Drums };

function grooveBars(g: Groove): PlayBar[] {
  return CHORDS.map((name, b) => {
    const pat = g.bars[b % g.bars.length], pm = g.art[b % g.art.length] === "pm";
    // A ringing bar needs a mute plan (R1): a borrowed palm-muted open D5 becomes the fretted A-string D5.
    let v = g.voicings[name];
    if (!mutePlan(v.notes, pm ? "pm" : "ring").ok)
      v = candidates(v.rootPc, ["A2", "E2"]).filter((c) => mutePlan(c.notes, "ring").ok).sort((a, b) => Math.abs(a.position - v.position) - Math.abs(b.position - v.position))[0];
    const events: Ev[] = [];
    [...pat].forEach((ch, c) => {
      if (ch !== "D" && ch !== "U" && ch !== "x") return;
      let len = 1;
      while (!pm && c + len < 16 && pat[c + len] === "-") len++;
      const dead = ch === "x";
      events.push({ cell: c, midi: dead ? [] : v.notes.map(midiOf), len, pm, dead, accent: (g.accents ?? []).includes(c), frets: Object.fromEntries(v.notes.map((n) => [n.string, dead ? "x" : String(n.fret)])) });
    });
    return { label: name, events, drums: g.drums[b % g.drums.length] };
  });
}
function riffBars(r: Riff): PlayBar[] {
  return r.chords.map((label, b) => {
    const bar = r.bars[b % r.bars.length], pm = r.art[b % r.art.length] === "pm";
    return { label, events: bar.map((n) => ({ cell: n.cell, midi: n.notes.map(midiOf), len: pm ? 1 : n.len, pm, accent: n.cell === 0, frets: Object.fromEntries(n.notes.map((f) => [f.string, String(f.fret)])) })), drums: b % 2 ? { kick: [0, 8], snare: [4, 12], hat: hat8 } : { kick: [0, 8], snare: [4, 12], hat: hat8, crash: b === 0 ? [0] : [] } };
  });
}

/** Tab bars at 16 cells, or at 8 when a bar has nothing off the eighth-note grid (layout C). */
function tabBars(bars: PlayBar[], art: ("pm" | "ring")[], mixed: boolean): TabBar[] {
  return bars.map((bar, b) => {
    const eighths = mixed && bar.events.every((e) => e.cell % 2 === 0);
    const n = eighths ? 8 : 16;
    const cells = Array.from({ length: n }, (_, i) => {
      const e = bar.events.find((x) => x.cell === (eighths ? i * 2 : i));
      return { frets: e ? e.frets : {}, accent: e?.accent };
    });
    return { label: bar.label, articulation: art[b % art.length], cells };
  });
}
/** Layout D: eighth-note bars 2 to a line as today; a bar that needs 16ths gets a line to itself. */
function ownLines(bars: TabBar[]) {
  const lines: TabBar[][] = [];
  for (let i = 0; i < bars.length; i++) {
    if (bars[i].cells.length === 16 || i + 1 >= bars.length || bars[i + 1].cells.length === 16) lines.push([bars[i]]);
    else lines.push([bars[i], bars[++i]]);
  }
  return lines.flatMap((line) => renderTab(line, 2));
}
const layouts = (bars: PlayBar[], art: ("pm" | "ring")[]) => ({
  a: renderTab(tabBars(bars, art, false), 2),
  b: renderTab(tabBars(bars, art, false), 1),
  c: renderTab(tabBars(bars, art, true), 2),
  d: ownLines(tabBars(bars, art, true)),
});

const ITEMS = [
  ...GROOVES.map((g) => ({ kind: "groove", id: g.id, role: g.role, name: g.name, isNew: g.isNew, note: g.note, bars: grooveBars(g), tabs: layouts(grooveBars(g), g.art) })),
  ...RIFFS.map((r) => ({ kind: "riff", id: r.id, role: "Intro riff", name: r.name, isNew: r.isNew, note: r.note, bars: riffBars(r), tabs: layouts(riffBars(r), r.art) })),
];

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Grooves and riffs · Palm/Mute mock-up</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Space+Grotesk:wght@500;600;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
<style>
  :root, [data-theme="light"] { --ink:#171310; --paper:#F6F1E4; --surface:#FFFFFF; --accent:#C23A26; --brass:#B8862E; --line:#E4DAC3; --line-strong:#DCD3BE; --t-primary:#171310; --t-muted:#6B6152; --t-faint:#72675A; --on-accent:#FFF9EF; --tab:#362B1F; color-scheme: light; }
  [data-theme="dark"] { --ink:#0B0908; --paper:#15110E; --surface:#1F1A16; --accent:#E85A42; --brass:#C9973C; --line:#352D25; --line-strong:#463B30; --t-primary:#F1EADB; --t-muted:#A89C86; --t-faint:#9A8E7B; --on-accent:#140F0C; --tab:#CFC5B0; color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--paper); color: var(--t-primary); font-family: "Space Grotesk", sans-serif; }
  button { font: inherit; color: inherit; }
  .chrome { position: sticky; top: 0; z-index: 5; display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: center; padding: 10px 16px; background: #171310; color: #F6F1E4; font-family: "Space Mono", monospace; font-size: 12px; }
  .chrome b { font-family: "Archivo Black", sans-serif; font-weight: 400; font-size: 14px; margin-right: auto; }
  .seg2 { display: inline-flex; gap: 2px; padding: 3px; border: 1px solid #463B30; border-radius: 7px; }
  .seg2 button { min-height: 36px; padding: 0 10px; border: 0; border-radius: 5px; background: transparent; color: #D9CFB9; letter-spacing: .06em; cursor: pointer; }
  .seg2 button[aria-pressed="true"] { background: #E5573F; color: #140F0C; font-weight: 700; }
  main { max-width: 1440px; margin: 0 auto; padding: 20px 16px 48px; display: flex; flex-direction: column; gap: 14px; }
  @media (min-width: 834px) { main { padding: 28px 32px 48px; } }
  h1 { font-family: "Archivo Black", sans-serif; font-weight: 400; font-size: clamp(22px, 4vw, 34px); margin: 0; }
  h2 { font-family: "Archivo Black", sans-serif; font-weight: 400; font-size: 20px; margin: 18px 0 0; }
  .note { font-family: "Space Mono", monospace; font-size: 12px; line-height: 1.6; color: var(--t-muted); max-width: 900px; margin: 0; }
  .note b { color: var(--accent); }
  .label { font-family: "Space Mono", monospace; font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: var(--t-faint); }
  .grid { display: grid; gap: 12px; grid-template-columns: 1fr; }
  @media (min-width: 834px) { .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (min-width: 1280px) { .grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
  .card { background: var(--surface); border: 1.5px solid var(--line); border-radius: 8px; padding: 12px; display: flex; flex-direction: column; gap: 9px; min-width: 0; }
  .card[data-playing="true"] { border-color: var(--accent); }
  .hd { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
  .hd .t { font-family: "Space Mono", monospace; font-size: 12px; text-transform: uppercase; letter-spacing: .06em; color: var(--t-muted); }
  .hd .n { font-weight: 700; }
  .new { font-family: "Space Mono", monospace; font-size: 12px; background: var(--accent); color: var(--on-accent); border-radius: 3px; padding: 0 5px; margin-left: 6px; }
  .play { width: 44px; height: 44px; flex: none; border: 1.5px solid var(--line-strong); border-radius: 6px; background: var(--paper); cursor: pointer; }
  .play[aria-pressed="true"] { background: var(--accent); border-color: var(--accent); color: var(--on-accent); }
  .desc { font-family: "Space Mono", monospace; font-size: 12px; line-height: 1.4; color: var(--t-faint); }
  svg.tab { width: 100%; height: auto; display: block; }
  svg.tab text { font-family: "Space Mono", monospace; font-size: 12px; fill: var(--tab); white-space: pre; }
  svg.tab text.h { fill: var(--t-faint); }
  .drums { font-family: "Space Mono", monospace; font-size: 12px; color: var(--t-faint); line-height: 1.3; white-space: pre; overflow: hidden; }
  .size { font-family: "Space Mono", monospace; font-size: 12px; color: var(--brass); }
  .frames { display: grid; gap: 16px; grid-template-columns: 1fr; }
  @media (min-width: 834px) { .frames { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (min-width: 1280px) { .frames { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
  .frame { display: flex; flex-direction: column; gap: 8px; }
  .phone { width: 288px; max-width: 100%; }
</style>
</head>
<body>
<div class="chrome">
  <b>Palm/Mute · grooves &amp; riffs</b>
  <span class="seg2" role="group" aria-label="16th-note tab layout"><button data-lay="a" aria-pressed="false">A · 16 WIDE</button><button data-lay="b" aria-pressed="false">B · 1 BAR/LINE</button><button data-lay="c" aria-pressed="false">C · MIXED</button><button data-lay="d" aria-pressed="true">D · MIXED, OWN LINE</button></span>
  <span class="seg2" role="group" aria-label="Theme"><button data-theme-btn="light" aria-pressed="true">LIGHT</button><button data-theme-btn="dark" aria-pressed="false">DARK</button></span>
</div>
<main>
  <div>
    <div class="label">Song Engine v2 · Phase 4 mock-up · listen, then pick</div>
    <h1>GROOVES, RIFFS AND THE 16TH-NOTE GRID</h1>
  </div>
  <p class="note">Key of A, I-V-vi-IV, Fast Punk <b>180 BPM</b>. Chord voicings are the real engine's (seed 0 Verse and Chorus); every riff note is pitch-checked in A major. <b>▷</b> plays the guitar with its drums: in Phase 4 each groove carries its own drum pattern, so kicks land with the accents and stops are full-band. Audio is a rough Web Audio sketch (saw chords, noise drums), not the site's synth.</p>

  <h2>1 · How should a 16th-note bar look in a card?</h2>
  <p class="note">A gallop needs 16 cells a bar; today every bar has 8. Switch the layout at the top; every tab on the page follows. <b>A</b>: every bar 16 cells, 2 per line (the text shrinks). <b>B</b>: 16 cells, 1 bar per line (text stays big, tabs get twice as tall). <b>C</b>: a bar only gets 16 cells when it needs them; eighth-note bars stay 8. <b>D</b> (recommended): like C, but a 16th-note bar gets a line to itself, so it stays readable on a phone; today's tabs don't change at all. The brass number is the tab's text size in a 288px phone card (the site's floor for tab art is about 7px).</p>
  <div class="frames" id="frames"></div>

  <h2>2 · Grooves (guitar + drums)</h2>
  <p class="note">Two of today's grooves for reference, and five new ones. Phase 4 would write six or more per section role per feel from ideas like these; tell me which to keep, drop or change.</p>
  <div class="grid" id="grooves"></div>

  <h2>3 · Intro riffs that move</h2>
  <p class="note">Today's intro repeats one octave per chord. Four candidates over the Chorus's first two chords (A, E): which should the engine write? (It would generate them from scale-degree patterns in data, proven like the leads: scale, frets, audio = tab.)</p>
  <div class="grid" id="riffs"></div>
</main>
<script>
const ITEMS = ${JSON.stringify(ITEMS)};
let lay = "d", playing = null;
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
function tabSvg(groups) {
  const lines = []; groups.forEach((g, gi) => { if (gi) lines.push(null); g.header.forEach((h) => lines.push({ t: h, h: true })); g.strings.forEach((s) => lines.push({ t: s })); });
  const chars = Math.max(...lines.filter(Boolean).map((l) => l.t.length));
  let y = 0; const out = [];
  for (const l of lines) { if (!l) { y += 9.6; continue; } y += 16.8; if (l.t.trim()) out.push('<text x="0" y="' + (y - 4) + '" textLength="' + (l.t.length * 7.2) + '" lengthAdjust="spacingAndGlyphs"' + (l.h ? ' class="h"' : "") + ">" + esc(l.t) + "</text>"); }
  return { svg: '<svg class="tab" viewBox="0 0 ' + (chars * 7.2) + " " + (y + 2) + '" aria-hidden="true">' + out.join("") + "</svg>", chars };
}
const pxAt = (chars, width) => (width / (chars * 7.2)) * 12;
function drumRows(bars) {
  const rows = { K: "kick", S: "snare", H: "hat", C: "crash" };
  const d = bars[0].drums;
  return Object.entries(rows).filter(([, k]) => (d[k] || []).length).map(([l, k]) => l + "|" + Array.from({ length: 16 }, (_, i) => ((d[k] || []).includes(i) ? "o" : "-")).join("") + "|").join("\\n");
}
function card(item) {
  const { svg, chars } = tabSvg(item.tabs[lay]);
  return '<article class="card" data-playing="' + (playing === item.id) + '"><div class="hd"><div><div class="t">' + item.role + '</div><div class="n">' + item.name + (item.isNew ? '<span class="new">NEW</span>' : "") + '</div></div>' +
    '<button class="play" data-play="' + item.id + '" aria-pressed="' + (playing === item.id) + '" aria-label="' + (playing === item.id ? "Stop " : "Play ") + item.name + '">' + (playing === item.id ? "■" : "▷") + "</button></div>" +
    svg + '<div class="size">' + pxAt(chars, 264).toFixed(1) + "px in a phone card</div>" + (item.kind === "groove" ? '<div class="drums" aria-label="Drums, bar 1">' + drumRows(item.bars) + "</div>" : "") + '<div class="desc">' + item.note + "</div></article>";
}
function render() {
  const g = ITEMS.find((i) => i.id === "verse-gallop"), s = ITEMS.find((i) => i.id === "verse-sparse");
  document.getElementById("frames").innerHTML = ["a", "b", "c", "d"].map((l) => {
    const t1 = tabSvg(g.tabs[l]), t2 = tabSvg(s.tabs[l]);
    return '<div class="frame"><div class="label">' + { a: "A · 16 cells, 2 bars a line", b: "B · 16 cells, 1 bar a line", c: "C · mixed (16 only where needed)", d: "D · mixed, 16th bars on their own line" }[l] + '</div>' +
      '<div class="card phone"><div class="t desc">Gallop verse</div>' + t1.svg + '<div class="size">' + pxAt(t1.chars, 264).toFixed(1) + 'px</div></div>' +
      '<div class="card phone"><div class="t desc">Today\\'s sparse verse</div>' + t2.svg + '<div class="size">' + pxAt(t2.chars, 264).toFixed(1) + "px</div></div></div>";
  }).join("");
  document.getElementById("grooves").innerHTML = ITEMS.filter((i) => i.kind === "groove").map(card).join("");
  document.getElementById("riffs").innerHTML = ITEMS.filter((i) => i.kind === "riff").map(card).join("");
}

// ---- Web Audio sketch: a 16th-note scheduler
let ctx, master, timer;
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
function audio() { if (!ctx) ctx = new AudioContext(); if (!master) { master = ctx.createGain(); master.gain.value = 0.7; master.connect(ctx.destination); } return ctx; }
function curve() { const n = 512, c = new Float32Array(n); for (let i = 0; i < n; i++) { const x = (i / n) * 2 - 1; c[i] = Math.tanh(2.6 * x); } return c; }
function strum(t, notes, dur, vel, pm) {
  const out = ctx.createGain(), f = ctx.createBiquadFilter(), sh = ctx.createWaveShaper(); sh.curve = curve(); f.type = "lowpass"; f.frequency.value = pm ? 900 : 2400;
  sh.connect(f); f.connect(out); out.connect(master); const d = pm ? 0.07 : dur;
  out.gain.setValueAtTime(0.0001, t); out.gain.exponentialRampToValueAtTime(0.1 * vel, t + 0.005); out.gain.setValueAtTime(0.1 * vel, t + d * 0.6); out.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.08);
  notes.forEach((m, k) => { const o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = hz(m); o.connect(sh); o.start(t + k * 0.008); o.stop(t + d + 0.12); });
}
function noise(t, dur, freq, type, gain) { const b = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = b; f.type = type; f.frequency.value = freq; s.connect(f); f.connect(g); g.connect(master); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.start(t); }
function kick(t) { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12); g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22); o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.25); }
function start(id) {
  stopAudio(); audio().resume(); playing = id;
  const item = ITEMS.find((i) => i.id === id), sixteenth = 60 / 180 / 4;
  let n = 0, next = ctx.currentTime + 0.08;
  const tick = () => {
    while (next < ctx.currentTime + 0.2) {
      const bar = item.bars[Math.floor(n / 16) % item.bars.length], cell = n % 16, d = bar.drums;
      for (const e of bar.events) if (e.cell === cell && e.midi.length) strum(next, e.midi, sixteenth * e.len, e.accent ? 1 : 0.8, e.pm);
      for (const e of bar.events) if (e.cell === cell && e.dead) noise(next, 0.03, 1200, "bandpass", 0.25);
      if ((d.kick || []).includes(cell)) kick(next);
      if ((d.snare || []).includes(cell)) noise(next, 0.14, 1500, "highpass", 0.32);
      if ((d.hat || []).includes(cell)) noise(next, 0.03, 8000, "highpass", 0.06);
      if ((d.crash || []).includes(cell)) noise(next, 0.9, 5000, "highpass", 0.14);
      next += sixteenth; n++;
    }
    timer = setTimeout(tick, 25);
  };
  tick(); render();
}
function stopAudio() { clearTimeout(timer); if (master) { master.disconnect(); master = null; } playing = null; }
document.addEventListener("click", (e) => {
  const t = e.target.closest("button"); if (!t) return;
  if (t.dataset.play) { if (playing === t.dataset.play) { stopAudio(); render(); } else start(t.dataset.play); }
  else if (t.dataset.lay) { lay = t.dataset.lay; document.querySelectorAll("[data-lay]").forEach((b) => b.setAttribute("aria-pressed", String(b === t))); render(); }
  else if (t.dataset.themeBtn) { document.documentElement.dataset.theme = t.dataset.themeBtn; document.querySelectorAll("[data-theme-btn]").forEach((b) => b.setAttribute("aria-pressed", String(b === t))); }
});
document.documentElement.dataset.theme = "light";
render();
</script>
</body>
</html>
`;

mkdirSync(join(process.cwd(), "docs/mockups"), { recursive: true });
writeFileSync(join(process.cwd(), "docs/mockups/grooves-and-riffs.html"), html);
console.log(`Wrote docs/mockups/grooves-and-riffs.html (${Math.round(html.length / 1024)} KB, ${GROOVES.length} grooves, ${RIFFS.length} riffs)`);
