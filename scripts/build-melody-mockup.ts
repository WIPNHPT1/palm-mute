// Builds docs/mockups/melody-and-solo.html: a standalone page (no build, no dependencies) with the
// lead engine's real intro melodies and solos for every key, three progressions, every style and
// two takes, and Web Audio playback (with the backing, or the lead alone) of exactly what each tab shows.
// `npx tsx scripts/build-melody-mockup.ts`
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tabText } from "@/lib/fretboard";
import { type LeadPart, type LeadStyle, INTRO_STYLES, SOLO_STYLES, defaultLeadStyle, generateLead, nextLeadSeed, styleLabel } from "@/lib/melody";
import { PITCH_CLASSES, keyDisplayName } from "@/lib/musicTheory";
import { leadBars } from "@/lib/playback";

const PROGRESSIONS = ["I-V-vi-IV", "vi-IV-I-V", "I-IV-V"];

function encode(key: (typeof PITCH_CLASSES)[number], progressionId: string, part: LeadPart, style: LeadStyle, seed: number) {
  const bars = defaultLeadStyle(part).bars;
  const lead = generateLead({ key, progressionId, part, style, bars, seed });
  const pb = leadBars(lead, "fast-punk", true);
  return {
    tab: tabText(lead.tab),
    text: lead.text.join("\n"),
    positions: lead.positions,
    // per bar: "backing notes" | lead cells ("" or "notes:len:vel:bendFrom:slideFrom:legato:vibrato")
    play: pb.map((b) => {
      const chord = b.cells.find(Boolean)!.notes.join(".");
      const lane = b.lead!.map((h) => {
        if (!h) return "";
        const e = h.expression ?? {};
        return [h.notes.join("."), h.cells, h.velocity, e.bendFrom ?? "", e.slideFrom ?? "", e.legato ? 1 : 0, e.vibrato ? 1 : 0].join(":");
      });
      return `${chord}|${lane.join(",")}`;
    }),
  };
}

const data: Record<string, unknown> = {};
for (const key of PITCH_CLASSES)
  for (const prog of PROGRESSIONS)
    for (const [part, styles] of [["intro", INTRO_STYLES], ["solo", SOLO_STYLES]] as const)
      for (const style of styles) {
        const base = { key, progressionId: prog, part, style, bars: defaultLeadStyle(part).bars, seed: 0 };
        data[`${key}|${prog}|${part}|${style}|0`] = encode(key, prog, part, style, 0);
        data[`${key}|${prog}|${part}|${style}|1`] = encode(key, prog, part, style, nextLeadSeed(base));
      }

const meta = {
  keys: PITCH_CLASSES.map((k) => ({ id: k, label: keyDisplayName(k) })),
  progressions: PROGRESSIONS,
  styles: [...INTRO_STYLES.map((s) => ({ part: "intro", id: s, label: `Intro · ${styleLabel("intro", s)}` })), ...SOLO_STYLES.map((s) => ({ part: "solo", id: s, label: `Solo · ${styleLabel("solo", s)}` }))],
};

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Melody and solo mock-up · Palm/Mute</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
<style>
  :root { --paper:#F6F1E4; --surface:#fff; --ink:#171310; --line:#E4DAC3; --muted:#6B6152; --faint:#72675A; --accent:#C23A26; --on-accent:#FFF9EF; }
  @media (prefers-color-scheme: dark) { :root { --paper:#15110E; --surface:#1F1A16; --ink:#F1EADB; --line:#352D25; --muted:#A89C86; --faint:#9A8E7B; --accent:#E85A42; --on-accent:#140F0C; } }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--paper); color:var(--ink); font:14px/1.5 "Space Mono", ui-monospace, monospace; }
  .wrap { max-width:1100px; margin:0 auto; padding:24px 16px 48px; }
  h1 { font:400 clamp(24px,5vw,40px)/1 "Archivo Black", sans-serif; margin:6px 0 10px; letter-spacing:-.01em; }
  .kicker { color:var(--accent); font-size:12px; letter-spacing:.14em; }
  p.lede { color:var(--muted); max-width:760px; margin:0 0 20px; }
  .controls { display:flex; flex-wrap:wrap; gap:12px; align-items:end; background:var(--surface); border:1px solid var(--line); border-radius:8px; padding:14px 16px; margin-bottom:18px; }
  label { display:flex; flex-direction:column; gap:4px; font-size:12px; color:var(--faint); text-transform:uppercase; letter-spacing:.08em; }
  select, button { font:inherit; font-size:14px; min-height:44px; border-radius:6px; border:1px solid var(--line); background:var(--paper); color:var(--ink); padding:0 12px; cursor:pointer; }
  button.primary { background:var(--accent); color:var(--on-accent); border:0; font-family:"Archivo Black", sans-serif; font-size:13px; padding:0 18px; }
  .card { background:var(--surface); border:1.5px solid var(--accent); border-radius:8px; padding:14px; }
  .meta { color:var(--faint); font-size:12px; margin-bottom:8px; }
  pre { margin:0 0 12px; background:var(--paper); border-radius:5px; padding:10px; overflow-x:auto; font:12px/1.4 "Space Mono", ui-monospace, monospace; }
  .legend { color:var(--muted); font-size:12px; }
  footer { color:var(--faint); font-size:12px; margin-top:24px; }
</style>
</head>
<body>
<div class="wrap">
  <div class="kicker">MOCK-UP FOR REVIEW · INTRO MELODY AND LEAD SOLO</div>
  <h1>Melodies and solos</h1>
  <p class="lede">Real output from the lead engine in this PR (<code>lib/melody.ts</code> + <code>data/lead-rules.json</code>): major pentatonic, strong beats on chord notes, bends only from a scale note to a scale note. Intros stay within fret 12, solos within 15. Play it over the chords and drums, or the lead alone, and play along. "Take" switches between seed 0 and the next Generate. Synthesized sound: for checking notes, positions and phrasing, not tone.</p>
  <div class="controls">
    <label>Key <select id="key"></select></label>
    <label>Progression <select id="prog"></select></label>
    <label>Part · style <select id="style"></select></label>
    <label>Take <select id="seed"><option value="0">1 (seed 0)</option><option value="1">2 (Generate)</option></select></label>
    <button class="primary" id="backing">▶ WITH BACKING</button>
    <button id="lead">▶ LEAD ONLY</button>
    <button id="stop">■ STOP</button>
  </div>
  <section class="card"><div class="meta" id="meta"></div><pre id="tab"></pre><pre id="text"></pre>
  <div class="legend">Marks: <b>5b7</b> bend (fret 5 up to the pitch of fret 7) · <b>h5</b> hammer-on · <b>p3</b> pull-off · <b>/7</b> <b>\\5</b> slides · <b>~</b> vibrato. In the note names, <b>A^B</b> is a bend and <b>D/F</b> a double-stop.</div></section>
  <footer>Generated by <code>scripts/build-melody-mockup.ts</code>. Things to listen for: the intro's motif comes back in bar 3; the solo starts low and sparse, climbs, bends at its peak and lands on the root.</footer>
</div>
<script>
const META = ${JSON.stringify(meta)};
const DATA = ${JSON.stringify(data)};
const DRUMS = { kick:[0,5], snare:[2,6], hat:[0,1,2,3,4,5,6,7] };
const $ = (id) => document.getElementById(id);
for (const k of META.keys) $("key").add(new Option(k.label, k.id, false, k.id === "G"));
for (const p of META.progressions) $("prog").add(new Option(p, p));
for (const s of META.styles) $("style").add(new Option(s.label, s.part + "|" + s.id));
function current() { const [part, style] = $("style").value.split("|"); return { part, style, d: DATA[[$("key").value, $("prog").value, part, style, $("seed").value].join("|")] }; }
function render() { stop(); const { part, style, d } = current(); $("tab").textContent = d.tab; $("text").textContent = d.text; $("meta").textContent = (part === "intro" ? "Intro melody" : "Lead solo") + " · " + d.play.length + " bars · hand positions (index finger) per 2-bar phrase: frets " + d.positions.join(", "); }

let ctx, master, timer;
function audio() { if (!ctx) { ctx = new AudioContext(); } if (!master) { master = ctx.createGain(); master.gain.value = 0.7; master.connect(ctx.destination); } return ctx; }
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
function curve() { const n = 512, c = new Float32Array(n); for (let i = 0; i < n; i++) { const x = (i / n) * 2 - 1; c[i] = Math.tanh(3 * x); } return c; }
function voice(t, dur, gain, cutoff) { const out = ctx.createGain(), f = ctx.createBiquadFilter(), sh = ctx.createWaveShaper(); sh.curve = curve(); f.type = "lowpass"; f.frequency.value = cutoff; sh.connect(f); f.connect(out); out.connect(master); out.gain.setValueAtTime(0.0001, t); out.gain.exponentialRampToValueAtTime(gain, t + 0.006); out.gain.setValueAtTime(gain, t + dur * 0.8); out.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.06); return sh; }
function chug(t, notes) { const sh = voice(t, 0.07, 0.05, 900); for (const m of notes) { const o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = hz(m); o.connect(sh); o.start(t); o.stop(t + 0.2); } }
function leadNote(t, notes, dur, vel, bendFrom, slideFrom, legato, vibrato, eighth) {
  const sh = voice(t, dur, (legato ? 0.07 : 0.11) * vel, 3200);
  notes.forEach((m, k) => {
    const o = ctx.createOscillator(); o.type = "sawtooth";
    const from = k === 0 && bendFrom !== "" ? Number(bendFrom) : k === 0 && slideFrom !== "" ? Number(slideFrom) : m;
    o.frequency.setValueAtTime(hz(from), t);
    if (from !== m) o.frequency.linearRampToValueAtTime(hz(m), t + (bendFrom !== "" ? eighth : eighth * 0.35));
    if (vibrato) { const lfo = ctx.createOscillator(), g = ctx.createGain(); lfo.frequency.value = 5.5; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(hz(m) * 0.012, t + Math.min(dur * 0.4, eighth)); lfo.connect(g); g.connect(o.frequency); lfo.start(t); lfo.stop(t + dur + 0.1); }
    o.connect(sh); o.start(t); o.stop(t + dur + 0.1);
  });
}
function noise(t, dur, freq, type, gain) { const b = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = b; f.type = type; f.frequency.value = freq; s.connect(f); f.connect(g); g.connect(master); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.start(t); }
function kick(t) { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12); g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2); o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.25); }
function play(backing) {
  stop(); audio().resume();
  const eighth = 60 / 180 / 2, { d } = current();
  const steps = d.play.flatMap((bar) => { const [chord, lane] = bar.split("|"); return lane.split(",").map((c, i) => ({ chord: chord.split(".").map(Number), c, i })); });
  let n = 0, next = ctx.currentTime + 0.1;
  const tick = () => {
    while (next < ctx.currentTime + 0.2) {
      if (n >= steps.length) n = 0;
      const s = steps[n];
      if (backing) { chug(next, s.chord); if (DRUMS.kick.includes(s.i)) kick(next); if (DRUMS.snare.includes(s.i)) noise(next, 0.14, 1500, "highpass", 0.3); noise(next, 0.03, 8000, "highpass", 0.05); }
      if (s.c) { const [notes, len, vel, bend, slide, legato, vib] = s.c.split(":"); leadNote(next, notes.split(".").map(Number), Number(len) * eighth, Number(vel), bend, slide, legato === "1", vib === "1", eighth); }
      next += eighth; n++;
    }
    timer = setTimeout(tick, 25);
  };
  tick();
}
function stop() { clearTimeout(timer); if (master) { master.disconnect(); master = null; } }
$("backing").onclick = () => play(true); $("lead").onclick = () => play(false); $("stop").onclick = stop;
for (const id of ["key", "prog", "style", "seed"]) $(id).onchange = render;
render();
</script>
</body>
</html>
`;

mkdirSync(join(process.cwd(), "docs/mockups"), { recursive: true });
writeFileSync(join(process.cwd(), "docs/mockups/melody-and-solo.html"), html);
console.log(`Wrote docs/mockups/melody-and-solo.html (${Math.round(html.length / 1024)} KB)`);
