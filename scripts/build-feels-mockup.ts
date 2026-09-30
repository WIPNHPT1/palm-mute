// Builds docs/mockups/five-feels.html: the Feel control, Power Chords (5 rows) and Rhythm Lane (5 feels,
// including the proposed Pop Strum and Ballad) as they'd look on the Generator, in light and dark, with
// Web Audio playback of each feel over I-V-vi-IV in A. Chip voicings come from the real engine.
// `npx tsx scripts/build-feels-mockup.ts`
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { TAB_STRINGS, midiOf } from "@/lib/fretboard";
import { feels as currentFeels, libraryVoicings, rhythmPatterns } from "@/lib/generator";
import { progressions } from "@/lib/musicTheory";

type MockFeel = {
  id: string; label: string; bpm: number; adjustable?: boolean; isNew?: boolean;
  name: string; glyphs: string[]; beatLabel: string; description: string; tag: "ink" | "muted" | "brass" | "red" | "outline";
  palmMuted: boolean; ring: number;
  drums: { kick: number[]; snare: number[]; hat: number[]; crash?: number[]; rim?: number[] };
};

const DRUMS: Record<string, MockFeel["drums"]> = {
  "fast-punk": { kick: [0, 5], snare: [2, 6], hat: [0, 1, 2, 3, 4, 5, 6, 7] },
  "half-time": { kick: [0], snare: [4], hat: [0, 1, 2, 3, 4, 5, 6, 7] },
  "mid-tempo": { kick: [0, 4], snare: [], hat: [1, 3, 5, 7] },
};
const FEELS: MockFeel[] = [
  ...currentFeels.map((f) => {
    const p = rhythmPatterns.find((r) => r.id === f.rhythmPatternId)!;
    return {
      id: f.id, label: f.label, bpm: typeof f.displayBpm === "number" ? f.displayBpm : 140, adjustable: f.id === "mid-tempo",
      name: p.name, glyphs: p.glyphs, beatLabel: p.beatLabel, description: p.description, tag: p.tagColor,
      palmMuted: f.id !== "mid-tempo", ring: 1, drums: DRUMS[f.id],
    };
  }),
  {
    id: "pop-strum", label: "POP STRUM", bpm: 150, isNew: true, name: "Anthem strum", glyphs: ["▼", "·", "▼", "▲", "·", "▲", "▼", "▲"],
    beatLabel: "1 & 2 & 3 & 4 &", description: "Down, down-up, up-down-up. Open and ringing.", tag: "red",
    palmMuted: false, ring: 1, drums: { kick: [0, 4, 5], snare: [2, 6], hat: [0, 1, 2, 3, 4, 5, 6, 7], crash: [0] },
  },
  {
    id: "ballad", label: "BALLAD", bpm: 80, isNew: true, name: "Slow let-ring", glyphs: ["▼", "·", "·", "·", "▼", "·", "·", "·"],
    beatLabel: "1 2 3 4", description: "Slow downstrokes on 1 and 3, left to ring.", tag: "outline",
    palmMuted: false, ring: 4, drums: { kick: [0, 5], snare: [], rim: [4], hat: [0, 2, 4, 6] },
  },
];

// Power Chords: the Chorus pick (I-V-vi-IV) first, then the next four most common.
const rows = progressions.slice(0, 5).map((p) => ({
  id: p.id,
  degrees: p.degrees,
  chords: libraryVoicings("A", p.id).map(({ chord, voicing }) => ({
    name: chord.name,
    midi: voicing.notes.map(midiOf),
    tab: TAB_STRINGS.map((s) => `${s}|${String(voicing.notes.find((n) => n.string === s)?.fret ?? "-").padEnd(2, " ")}`).join("\n"),
  })),
}));

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Five feels · Palm/Mute mock-up</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Space+Grotesk:wght@500;600;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
<style>
  :root, [data-theme="light"] {
    --ink:#171310; --paper:#F6F1E4; --surface:#FFFFFF; --accent:#C23A26; --accent-on-ink:#E5573F; --brass:#B8862E; --line:#E4DAC3; --line-strong:#DCD3BE;
    --t-primary:#171310; --t-secondary:#4E4738; --t-muted:#6B6152; --t-faint:#72675A; --on-dark:#F6F1E4; --on-dark-faint:#A89C86; --on-accent:#FFF9EF;
    --chip-bg:#171310; --chip-label:#F6F1E4; --chip-tab:#C9BFA9; --ink-mid:#362B1F; color-scheme: light;
  }
  [data-theme="dark"] {
    --ink:#0B0908; --paper:#15110E; --surface:#1F1A16; --accent:#E85A42; --accent-on-ink:#E85A42; --brass:#C9973C; --line:#352D25; --line-strong:#463B30;
    --t-primary:#F1EADB; --t-secondary:#CFC5B0; --t-muted:#A89C86; --t-faint:#9A8E7B; --on-dark:#F6F1E4; --on-dark-faint:#A89C86; --on-accent:#140F0C;
    --chip-bg:#0B0908; --chip-label:#F6F1E4; --chip-tab:#C9BFA9; --ink-mid:#6B5A45; color-scheme: dark;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--paper); color: var(--t-primary); font-family: "Space Grotesk", sans-serif; }
  .mono { font-family: "Space Mono", monospace; }
  .display { font-family: "Archivo Black", sans-serif; font-weight: 400; }
  .chrome { position: sticky; top: 0; z-index: 5; display: flex; flex-wrap: wrap; gap: 10px 20px; align-items: center; justify-content: space-between; padding: 12px 20px; background: #171310; color: #F6F1E4; font-family: "Space Mono", monospace; font-size: 12px; }
  .chrome b { font-family: "Archivo Black", sans-serif; font-weight: 400; font-size: 14px; }
  .chrome .seg2 { display: inline-flex; gap: 2px; padding: 3px; border: 1px solid #463B30; border-radius: 7px; }
  .chrome .seg2 button { min-height: 36px; padding: 0 12px; border: 0; border-radius: 5px; background: transparent; color: #D9CFB9; font: inherit; letter-spacing: .08em; cursor: pointer; }
  .chrome .seg2 button[aria-pressed="true"] { background: #E5573F; color: #140F0C; font-weight: 700; }
  main { max-width: 1440px; margin: 0 auto; padding: 24px 20px 48px; display: flex; flex-direction: column; gap: 16px; }
  @media (min-width: 834px) { main { padding: 28px 32px 48px; } }
  @media (min-width: 1280px) { main { padding: 32px 56px 48px; } }
  .note { font-family: "Space Mono", monospace; font-size: 12px; line-height: 1.6; color: var(--t-muted); max-width: 900px; margin: 0; }
  .note b { color: var(--accent); }
  .card { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 14px 16px; }
  .label { font-family: "Space Mono", monospace; font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: var(--t-faint); margin-bottom: 9px; }
  /* Feel control: five segments; one row from tablet up, 3 + 2 on phones */
  .feel { display: flex; flex-wrap: wrap; gap: 2px; padding: 3px; border: 1px solid var(--line); border-radius: 7px; background: var(--paper); max-width: 720px; }
  .feel button { flex: 1 1 calc(33.333% - 2px); min-height: 44px; padding: 5px 4px; border: 0; border-radius: 5px; background: transparent; color: var(--t-muted); font-family: "Space Mono", monospace; cursor: pointer; position: relative; }
  @media (min-width: 834px) { .feel button { flex: 1 1 0; padding: 5px 12px; } }
  .feel button div:first-child { font-size: 12px; line-height: 1.2; }
  .feel button div:last-child { font-size: 12px; line-height: 1.2; margin-top: 2px; color: var(--t-faint); }
  .feel button[aria-checked="true"] { background: var(--ink); color: var(--on-dark); }
  .feel button[aria-checked="true"] div:first-child { font-weight: 700; }
  .feel button[aria-checked="true"] div:last-child { color: var(--chip-tab); }
  .new { position: absolute; top: -7px; right: 4px; font-size: 10px; letter-spacing: .08em; background: var(--accent); color: var(--on-accent); border-radius: 3px; padding: 0 4px; line-height: 14px; }
  [data-theme="dark"] .feel button[aria-checked="true"] { border: 1px solid var(--line-strong); }
  .panels { display: flex; flex-direction: column; gap: 14px; }
  @media (min-width: 1280px) { .panels { flex-direction: row; } }
  .panel { flex: 1; min-width: 0; background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 16px 20px; display: flex; flex-direction: column; gap: 12px; }
  .panel h2 { font-family: "Archivo Black", sans-serif; font-weight: 400; font-size: 12.5px; margin: 0 0 4px; }
  .sub { font-family: "Space Mono", monospace; font-size: 12px; color: var(--t-muted); }
  .sub2 { font-family: "Space Mono", monospace; font-size: 12px; color: var(--t-faint); margin-top: 2px; }
  .rows { display: flex; flex-direction: column; gap: 10px; flex-grow: 1; }
  .row { display: flex; align-items: center; gap: 12px; border: 1px solid var(--line); background: var(--paper); border-radius: 6px; padding: 8px 14px; min-height: 112px; }
  .row.sel { border-color: var(--accent); }
  .row .pid { width: 88px; flex: none; font-family: "Space Mono", monospace; font-size: 13px; font-weight: 700; color: var(--t-muted); }
  .row.sel .pid { color: var(--accent); }
  .row .pid small { display: block; font-size: 12px; font-weight: 400; margin-top: 2px; color: var(--accent); }
  .chips { display: flex; gap: 5px; flex-wrap: wrap; flex: 1; }
  .chip { display: flex; flex-direction: column; align-items: center; gap: 3px; background: var(--chip-bg); border-radius: 4px; padding: 6px 8px; }
  .chip .deg { font-family: "Space Mono", monospace; font-size: 12px; color: var(--on-dark-faint); line-height: 1; }
  .chip .nm { width: 3ch; text-align: center; font-family: "Space Mono", monospace; font-size: 12px; font-weight: 700; color: var(--chip-label); }
  .chip pre { margin: 0; font: 7px/1.4 "Space Mono", monospace; color: var(--chip-tab); }
  .play { width: 44px; height: 44px; flex: none; display: grid; place-items: center; border: 0; background: none; color: var(--t-muted); border-radius: 6px; cursor: pointer; }
  .play:hover { color: var(--t-primary); }
  .play[aria-pressed="true"] { color: var(--accent); }
  .play svg { width: 13px; height: 13px; }
  @media (max-width: 833px) { .row { flex-wrap: wrap; } .row .pid { width: auto; flex: 1; } .chips { flex-basis: 100%; order: 3; } }
  .lanes { display: grid; gap: 8px; flex-grow: 1; grid-template-columns: 1fr; }
  @media (min-width: 834px) and (max-width: 1279px) { .lanes { grid-template-columns: repeat(3, 1fr); } }
  .lane { display: flex; flex-direction: column; justify-content: center; gap: 5px; border: 1px solid var(--line); background: var(--paper); border-radius: 6px; padding: 10px 12px; min-height: 112px; }
  .lane.sel { border-color: var(--accent); }
  .lane-top { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
  .lane-top b { font-family: "Space Mono", monospace; font-size: 12px; }
  .tag { font-family: "Space Mono", monospace; font-size: 12px; padding: 2px 6px; border-radius: 4px; white-space: nowrap; }
  .tag-ink { background: var(--ink); color: var(--on-dark); }
  .tag-muted { background: var(--t-muted); color: var(--on-dark); }
  [data-theme="dark"] .tag-muted { background: var(--ink-mid); }
  .tag-brass { background: var(--brass); color: #171310; }
  .tag-red { background: var(--accent); color: var(--on-accent); }
  .tag-outline { border: 1.5px solid var(--t-primary); color: var(--t-primary); padding: 1px 5px; }
  .glyphs { font-family: "Space Mono", monospace; font-size: 13px; letter-spacing: 3px; color: var(--accent); }
  .beats { font-family: "Space Mono", monospace; font-size: 12px; letter-spacing: 1px; color: var(--t-faint); }
  .desc { font-family: "Space Mono", monospace; font-size: 12px; color: var(--t-muted); }
  .lane-bottom { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .lane .play { margin: -10px -12px -10px 0; }
</style>
</head>
<body>
<div class="chrome"><b>PALM⚡MUTE · Five feels · mock-up</b>
  <div class="seg2" role="group" aria-label="Theme"><button data-theme-btn="light">LIGHT</button><button data-theme-btn="dark">DARK</button></div>
</div>
<main>
  <p class="note">The Generator's Feel control, Power Chords and Rhythm Lane with <b>five feels</b> (Pop Strum and Ballad are new) and <b>five progression rows</b>. Pick a feel, then ▷ any Rhythm Lane card or progression to hear it over the chords (key of A; chip voicings are the engine's). Resize the window: the Feel control wraps 3 + 2 on phones.</p>
  <div class="card"><div class="label">Feel</div><div class="feel" role="radiogroup" aria-label="Feel" id="feel"></div></div>
  <div class="panels">
    <section class="panel"><div><h2>POWER CHORDS</h2><div class="sub">Best progressions · Key of A · E standard</div><div class="sub2">Tap a row to use it for the Chorus.</div></div><div class="rows" id="rows"></div></section>
    <section class="panel"><div><h2>RHYTHM LANE</h2><div class="sub">Strums for I-V-vi-IV · Key of A · E standard</div><div class="sub2">Pick a feel above to switch strums.</div></div><div class="lanes" id="lanes"></div></section>
  </div>
</main>
<script>
const FEELS = ${JSON.stringify(FEELS)};
const ROWS = ${JSON.stringify(rows)};
const PLAY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
const STOP = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="1.5"/></svg>';
let feel = "fast-punk", playing = null;
const $ = (id) => document.getElementById(id);

function render() {
  $("feel").innerHTML = FEELS.map((f) => '<button role="radio" aria-checked="' + (f.id === feel) + '" data-feel="' + f.id + '">' + (f.isNew ? '<span class="new">NEW</span>' : "") + "<div>" + f.label + "</div><div>" + f.bpm + " BPM</div></button>").join("");
  $("rows").innerHTML = ROWS.map((r, i) => '<div class="row' + (i === 0 ? " sel" : "") + '"><div class="pid">' + r.id + (i === 0 ? "<small>CHORUS</small>" : "") + '</div><div class="chips">' +
    r.chords.map((c, k) => '<div class="chip"><div class="deg">' + r.degrees[k] + '</div><div class="nm">' + c.name + "</div><pre>" + c.tab + "</pre></div>").join("") +
    '</div><button class="play" aria-pressed="' + (playing === "row:" + i) + '" aria-label="Play ' + r.id + '" data-row="' + i + '">' + (playing === "row:" + i ? STOP : PLAY) + "</button></div>").join("");
  $("lanes").innerHTML = FEELS.map((f) => '<div class="lane' + (f.id === feel ? " sel" : "") + '"><div class="lane-top"><b>' + f.name + '</b><span class="tag tag-' + f.tag + '">' + f.label + '</span></div><div class="glyphs">' + f.glyphs.join("") +
    '</div><div class="beats">' + f.beatLabel + '</div><div class="lane-bottom"><span class="desc">' + f.description + '</span><button class="play" aria-pressed="' + (playing === "lane:" + f.id) + '" aria-label="Hear ' + f.label + '" data-lane="' + f.id + '">' + (playing === "lane:" + f.id ? STOP : PLAY) + "</button></div></div>").join("");
  document.querySelectorAll("[data-feel]").forEach((b) => (b.onclick = () => { feel = b.dataset.feel; if (playing) start(playing); render(); }));
  document.querySelectorAll("[data-row]").forEach((b) => (b.onclick = () => toggle("row:" + b.dataset.row)));
  document.querySelectorAll("[data-lane]").forEach((b) => (b.onclick = () => { feel = b.dataset.lane; toggle("lane:" + b.dataset.lane); }));
}

// ---- Web Audio: saw power chords through a little drive, synthesized drums
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
function start(what) {
  stopAudio(); audio().resume(); playing = what;
  const f = FEELS.find((x) => x.id === feel), eighth = 60 / f.bpm / 2;
  const prog = what.startsWith("row:") ? ROWS[Number(what.slice(4))] : ROWS[0];
  let n = 0, next = ctx.currentTime + 0.08;
  const tick = () => {
    while (next < ctx.currentTime + 0.2) {
      const bar = Math.floor(n / 8) % prog.chords.length, cell = n % 8, g = f.glyphs[cell], d = f.drums;
      if (g !== "·") strum(next, prog.chords[bar].midi, eighth * f.ring, g === "▲" ? 0.6 : 0.9, f.palmMuted);
      if (d.kick.includes(cell)) kick(next);
      if (d.snare.includes(cell)) noise(next, 0.14, 1500, "highpass", 0.32);
      if ((d.rim || []).includes(cell)) noise(next, 0.04, 2500, "bandpass", 0.5);
      if (d.hat.includes(cell)) noise(next, 0.03, 8000, "highpass", 0.06);
      if ((d.crash || []).includes(cell) && bar === 0) noise(next, 0.9, 5000, "highpass", 0.14);
      next += eighth; n++;
    }
    timer = setTimeout(tick, 25);
  };
  tick(); render();
}
function stopAudio() { clearTimeout(timer); if (master) { master.disconnect(); master = null; } playing = null; }
function toggle(what) { if (playing === what) { stopAudio(); render(); } else start(what); }
function setTheme(t) { document.documentElement.dataset.theme = t; document.querySelectorAll("[data-theme-btn]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.themeBtn === t))); }
document.querySelectorAll("[data-theme-btn]").forEach((b) => (b.onclick = () => setTheme(b.dataset.themeBtn)));
setTheme("light");
render();
</script>
</body>
</html>
`;

mkdirSync(join(process.cwd(), "docs/mockups"), { recursive: true });
writeFileSync(join(process.cwd(), "docs/mockups/five-feels.html"), html);
console.log(`Wrote docs/mockups/five-feels.html (${Math.round(html.length / 1024)} KB)`);
