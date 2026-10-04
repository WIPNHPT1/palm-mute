// Builds docs/mockups/expert-voicings.html: a standalone page (no build, no dependencies) with the
// engine's real tabs for every key, feel and Chorus progression, and Web Audio playback of exactly
// what each tab shows. For the owner and a guitarist to listen to and play along with.
// `npx tsx scripts/build-voicing-mockup.ts`
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tabText } from "@/lib/fretboard";
import { FEEL_IDS, type FeelId, type SectionId, playbackBpm, renderSection } from "@/lib/generator";
import { PITCH_CLASSES, keyDisplayName, progressions } from "@/lib/musicTheory";
import { sectionBars } from "@/lib/playback";

const FEELS: FeelId[] = FEEL_IDS;
const FEEL_LABELS: Record<FeelId, string> = { "fast-punk": "Fast Punk", "half-time": "Half-Time", "mid-tempo": "Mid-Tempo", "pop-strum": "Pop Strum", ballad: "Ballad" };
const SECTIONS: Exclude<SectionId, "solo">[] = ["intro", "verse", "chorus", "breakdown"];

/** Compact playback: per bar "feel|stop|cells", each cell "" or "notes.joined:len:vel:pm:dead". */
function encode(id: SectionId, key: (typeof PITCH_CLASSES)[number], feel: FeelId, progressionId: string, seed: number) {
  const s = renderSection(id, { key, feel, progressionId, seed });
  const bars = sectionBars(s).slice(0, s.bars.length); // one pass; the page repeats the Verse itself
  return {
    label: s.label,
    caption: s.caption,
    frets: s.frets[1] === 0 ? "Open strings" : `Frets ${s.frets[0] === 0 ? "open" : s.frets[0]}–${s.frets[1]}`,
    repeat: s.repeat,
    tab: tabText(s.tab),
    play: bars.map(
      (b) =>
        `${b.feel}|${b.drumsStopAt ?? ""}|` +
        b.cells.map((c) => (c ? `${c.notes.join(".")}:${c.cells}:${c.velocity}:${c.palmMuted ? 1 : 0}:${c.dead ? 1 : 0}` : "")).join(","),
    ),
  };
}

const data: Record<string, unknown> = {};
for (const key of PITCH_CLASSES)
  for (const feel of FEELS)
    for (const seed of [0, 1]) {
      const base: Record<string, unknown> = {};
      for (const id of SECTIONS) {
        if (id === "chorus") for (const p of progressions) base[`chorus:${p.id}`] = encode(id, key, feel, p.id, seed);
        else base[id] = encode(id, key, feel, "I-V-vi-IV", seed);
      }
      data[`${key}|${feel}|${seed}`] = base;
    }

const meta = {
  keys: PITCH_CLASSES.map((k) => ({ id: k, label: keyDisplayName(k) })),
  feels: FEELS.map((f) => ({ id: f, label: FEEL_LABELS[f], bpm: playbackBpm(f) })),
  progressions: progressions.map((p) => p.id),
};

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Expert voicings mock-up · Palm/Mute</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
<style>
  :root { --paper:#F6F1E4; --surface:#fff; --ink:#171310; --line:#E4DAC3; --muted:#6B6152; --faint:#72675A; --accent:#C23A26; --on-accent:#FFF9EF; }
  @media (prefers-color-scheme: dark) { :root { --paper:#15110E; --surface:#1F1A16; --ink:#F1EADB; --line:#352D25; --muted:#A89C86; --faint:#9A8E7B; --accent:#E85A42; --on-accent:#140F0C; } }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--paper); color:var(--ink); font:14px/1.5 "Space Mono", ui-monospace, monospace; }
  .wrap { max-width:1280px; margin:0 auto; padding:24px 16px 48px; }
  h1 { font:400 clamp(24px,5vw,40px)/1 "Archivo Black", sans-serif; margin:6px 0 10px; letter-spacing:-.01em; }
  .kicker { color:var(--accent); font-size:12px; letter-spacing:.14em; }
  p.lede { color:var(--muted); max-width:760px; margin:0 0 20px; }
  .controls { display:flex; flex-wrap:wrap; gap:12px; align-items:end; background:var(--surface); border:1px solid var(--line); border-radius:8px; padding:14px 16px; margin-bottom:18px; }
  label { display:flex; flex-direction:column; gap:4px; font-size:12px; color:var(--faint); text-transform:uppercase; letter-spacing:.08em; }
  select, button { font:inherit; font-size:14px; min-height:44px; border-radius:6px; border:1px solid var(--line); background:var(--paper); color:var(--ink); padding:0 12px; }
  button.primary { background:var(--accent); color:var(--on-accent); border:0; font-family:"Archivo Black", sans-serif; font-size:13px; padding:0 18px; cursor:pointer; }
  button { cursor:pointer; }
  .grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(min(100%, 520px), 1fr)); gap:14px; }
  .card { background:var(--surface); border:1px solid var(--line); border-radius:8px; padding:14px; min-width:0; }
  .card.chorus { border:1.5px solid var(--accent); }
  .card header { display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:8px; }
  .card h2 { font-size:13px; text-transform:uppercase; letter-spacing:.06em; margin:0; }
  .card .meta { color:var(--faint); font-size:12px; }
  pre { margin:0; background:var(--paper); border-radius:5px; padding:10px; overflow-x:auto; font:12px/1.4 "Space Mono", ui-monospace, monospace; }
  .playing { outline:2px solid var(--accent); outline-offset:2px; }
  footer { color:var(--faint); font-size:12px; margin-top:24px; }
</style>
</head>
<body>
<div class="wrap">
  <div class="kicker">MOCK-UP FOR REVIEW · EXPERT POWER-CHORD ENGINE</div>
  <h1>Expert voicings</h1>
  <p class="lede">Real output from the engine in this PR (<code>lib/voicings.ts</code> + <code>data/section-recipes.json</code>), E standard, frets 0–12. Pick a key, feel and Chorus progression, hit Play on a section (or the whole song) and play along. "Take" switches between seed 0 and the next regenerate. The sound is synthesized: it's for checking notes, positions and rhythm, not tone.</p>
  <div class="controls">
    <label>Key <select id="key"></select></label>
    <label>Feel <select id="feel"></select></label>
    <label>Chorus <select id="prog"></select></label>
    <label>Take <select id="seed"><option value="0">1 (seed 0)</option><option value="1">2 (regenerate)</option></select></label>
    <button class="primary" id="song">▶ PLAY SONG</button>
    <button id="stop">■ STOP</button>
  </div>
  <div class="grid" id="cards"></div>
  <footer>Generated by <code>scripts/build-voicing-mockup.ts</code>. Things to listen for: the verse chugs palm-muted low on the neck; the chorus lifts higher with 3-note shapes and pushes the chord into bars 2 and 4; the breakdown is heavy half-time with dead strums and a stop.</footer>
</div>
<script>
const META = ${JSON.stringify(meta)};
const DATA = ${JSON.stringify(data)};
const DRUMS = { "fast-punk": { kick:[0,5], snare:[2,6], hat:[0,1,2,3,4,5,6,7] }, "half-time": { kick:[0], snare:[4], hat:[0,1,2,3,4,5,6,7] }, "mid-tempo": { kick:[0,4], snare:[], hat:[1,3,5,7] }, "pop-strum": { kick:[0,4,5], snare:[2,6], hat:[0,1,2,3,4,5,6,7] }, "ballad": { kick:[0,5], snare:[4], hat:[0,2,4,6] } };
const $ = (id) => document.getElementById(id);
for (const k of META.keys) $("key").add(new Option(k.label, k.id, false, k.id === "G"));
for (const f of META.feels) $("feel").add(new Option(f.label + " · " + f.bpm + " BPM", f.id));
for (const p of META.progressions) $("prog").add(new Option(p, p));

function current() { return DATA[$("key").value + "|" + $("feel").value + "|" + $("seed").value]; }
function sections() {
  const d = current();
  return [["intro", d.intro], ["verse", d.verse], ["chorus", d["chorus:" + $("prog").value]], ["breakdown", d.breakdown]];
}
function render() {
  stop();
  $("cards").innerHTML = "";
  for (const [id, s] of sections()) {
    const card = document.createElement("section");
    card.className = "card" + (id === "chorus" ? " chorus" : "");
    card.id = "card-" + id;
    card.innerHTML = '<header><div><h2></h2><div class="meta"></div></div><button>▶ Play</button></header><pre></pre>';
    card.querySelector("h2").textContent = s.label;
    card.querySelector(".meta").textContent = s.caption + " · " + s.frets + (s.repeat > 1 ? " · ×" + s.repeat : "");
    card.querySelector("pre").textContent = s.tab;
    card.querySelector("button").onclick = () => play([[id, s]], true);
    $("cards").append(card);
  }
}

// --- Web Audio: saw into distortion into a low-pass for the guitar, simple synthesized drums.
let ctx, master, timer, playingCards = [];
function audio() {
  if (!ctx) { ctx = new AudioContext(); master = ctx.createGain(); master.gain.value = 0.7; master.connect(ctx.destination); }
  return ctx;
}
function curve() { const n = 512, c = new Float32Array(n); for (let i = 0; i < n; i++) { const x = (i / n) * 2 - 1; c[i] = Math.tanh(3 * x); } return c; }
function guitar(t, midi, len, vel, pm) {
  const out = ctx.createGain(), f = ctx.createBiquadFilter(), sh = ctx.createWaveShaper();
  sh.curve = curve(); f.type = "lowpass"; f.frequency.value = pm ? 900 : 2600;
  sh.connect(f); f.connect(out); out.connect(master);
  const dur = pm ? 0.07 : len;
  out.gain.setValueAtTime(0.0001, t); out.gain.exponentialRampToValueAtTime(0.12 * vel, t + 0.005);
  out.gain.setValueAtTime(0.12 * vel, t + dur * 0.7); out.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);
  for (const m of midi) { const o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = 440 * Math.pow(2, (m - 69) / 12); o.connect(sh); o.start(t); o.stop(t + dur + 0.1); }
}
function noise(t, dur, freq, type, gain) {
  const b = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = b; f.type = type; f.frequency.value = freq; s.connect(f); f.connect(g); g.connect(master);
  g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.start(t);
}
function kick(t) { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12); g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2); o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.25); }

function play(list, loop) {
  stop();
  audio().resume();
  const bpm = META.feels.find((f) => f.id === $("feel").value).bpm;
  const eighth = 60 / bpm / 2;
  const bars = [];
  for (const [id, s] of list) for (let r = 0; r < s.repeat; r++) for (const b of s.play) bars.push({ id, b });
  const steps = bars.flatMap(({ id, b }) => {
    const [feel, stop, cells] = b.split("|");
    return cells.split(",").map((c, i) => ({ id, feel, stop: stop === "" ? 99 : Number(stop), i, c }));
  });
  let n = 0, next = ctx.currentTime + 0.1;
  const tick = () => {
    while (next < ctx.currentTime + 0.2) {
      if (n >= steps.length) { if (!loop) { timer = setTimeout(stop, 400); return; } n = 0; }
      const s = steps[n];
      mark(s.id);
      if (s.c) {
        const [notes, len, vel, pm, dead] = s.c.split(":");
        if (dead === "1") noise(next, 0.04, 1800, "bandpass", 0.25);
        else guitar(next, notes.split(".").map(Number), Number(len) * eighth, Number(vel), pm === "1");
      }
      if (s.i < s.stop) {
        const d = DRUMS[s.feel];
        if (d.kick.includes(s.i)) kick(next);
        if (d.snare.includes(s.i)) noise(next, 0.14, 1500, "highpass", 0.35);
        if (d.hat.includes(s.i)) noise(next, 0.03, 8000, "highpass", 0.06);
      }
      next += eighth; n++;
    }
    timer = setTimeout(tick, 25);
  };
  tick();
}
function mark(id) { for (const c of playingCards) c.classList.remove("playing"); const el = $("card-" + id); if (el) { el.classList.add("playing"); playingCards = [el]; } }
function stop() { clearTimeout(timer); for (const c of playingCards) c.classList.remove("playing"); playingCards = []; if (master) { master.disconnect(); master = ctx.createGain(); master.gain.value = 0.7; master.connect(ctx.destination); } }
$("song").onclick = () => play(sections(), false);
$("stop").onclick = stop;
for (const id of ["key", "feel", "prog", "seed"]) $(id).onchange = render;
render();
</script>
</body>
</html>
`;

mkdirSync(join(process.cwd(), "docs/mockups"), { recursive: true });
writeFileSync(join(process.cwd(), "docs/mockups/expert-voicings.html"), html);
console.log(`Wrote docs/mockups/expert-voicings.html (${Math.round(html.length / 1024)} KB)`);
