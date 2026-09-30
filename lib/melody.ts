// Intro melodies and lead solos (docs/melody-and-solo-brief.md): rhythm first, then a hand position
// per phrase, then pitches by a second-order Viterbi over the scale notes under the hand, then
// techniques. Shares lib/fretboard.ts with the power-chord engine. Pure functions, no React.
import rulesJson from "@/data/lead-rules.json";
import rhythmsJson from "@/data/lead-rhythms.json";
import { type TabBar, type TabLineGroup, type TabString, OPEN_STRING_MIDI, describeFretted, pitchClass, renderTab, tabText } from "@/lib/fretboard";
import { type Degree, type NoteName, type ResolvedChord, getProgression, noteNameFor, pitchClassOf, resolveDegrees } from "@/lib/musicTheory";

export type LeadPart = "intro" | "solo";
export type IntroStyle = "hook" | "octaves" | "harmony";
export type SoloStyle = "chill" | "classic" | "shred";
export type LeadStyle = IntroStyle | SoloStyle;

/**
 * Song Engine v2 Phase 5 (R15): a motif the solo restates. One bar: its rhythm ("n" = a note starts, "-" = it
 * holds, "." = rest; 8 eighths) and the semitone step between each note and the one before.
 */
export type Quote = { rhythm: string; intervals: number[]; from: string };

export type LeadInputs = {
  key: NoteName;
  progressionId: string;
  part: LeadPart;
  style: LeadStyle;
  bars: number;
  seed: number;
  /** R15 (solos): the song's motif, restated in the solo's first answer bar with its rhythm and contour. */
  quote?: Quote;
  /** R16 (solos): the chords to play over, bar by bar (cycled), instead of the progression looped. */
  degrees?: Degree[];
  /** R16 (solos): the song's strongest chord; the solo's peak lands on a bar that plays it, when one can. */
  peakDegree?: Degree;
};

export type LeadTechnique =
  | { kind: "bend"; fromFret: number; fromMidi: number }
  | { kind: "hammer" }
  | { kind: "pull" }
  | { kind: "slideUp" }
  | { kind: "slideDown" };

export type LeadNote = {
  bar: number;
  cell: number;
  /** Eighth notes it sounds for. */
  cells: number;
  /** The pitch heard (for a bend, where it bends to). */
  midi: number;
  string: TabString;
  /** The fret played (for a bend, where it bends to: the finger starts at technique.fromFret). */
  fret: number;
  technique?: LeadTechnique;
  vibrato?: boolean;
  /** Why this note (for tests and debugging). */
  role: "chord" | "passing";
  /** Octave or harmony note played with it. */
  double?: { midi: number; string: TabString; fret: number; kind: "octave" | "third" | "sixth" };
};

export type Lead = {
  inputs: LeadInputs;
  chords: ResolvedChord[];
  degrees: Degree[];
  notes: LeadNote[];
  /** Hand position (index-finger fret) of each 2-bar phrase. */
  positions: number[];
  fretLimit: number;
  tab: TabLineGroup[];
  /** Note names per bar, e.g. "G: D E G · G A B ·" (copyable text version). */
  text: string[];
  /** A sentence for screen readers. */
  spoken: string;
};

export const RULES = rulesJson;
const W = rulesJson.weights;
const RHYTHMS = rhythmsJson as unknown as {
  intro: Record<IntroStyle, Record<"call1" | "call2" | "end", string[]>>;
  solo: Record<SoloStyle, Record<"low" | "answer" | "busy" | "peak" | "resolve", string[]>>;
};

export const INTRO_STYLES: IntroStyle[] = ["hook", "octaves", "harmony"];
export const SOLO_STYLES: SoloStyle[] = ["chill", "classic", "shred"];
export const PENTATONIC = rulesJson.scales.majorPentatonic;
export const MAJOR = rulesJson.scales.major;
const STRONG = rulesJson.strongCells;
const SPAN = 4; // a hand position: index finger on fret p, pinky stretching to p + 4

export function styleLabel(part: LeadPart, style: LeadStyle): string {
  return (rulesJson.styles[part] as Record<string, { label: string }>)[style].label;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Interval of a pitch above the key root, 0-11. */
const degreeOf = (midi: number, keyPc: number) => pitchClass(midi - keyPc);
export const inScale = (midi: number, keyPc: number, scale = PENTATONIC) => scale.includes(degreeOf(midi, keyPc));

export function chordTones(degree: Degree): number[] {
  return (rulesJson.chordTones as Record<Degree, number[]>)[degree];
}

/** The chord's third (major on I/IV/V, minor on ii/iii/vi), as an interval above the key root. */
export function chordThird(degree: Degree): number {
  return chordTones(degree)[1];
}

// ---------------------------------------------------------------------------
// 1. Rhythm

type Slot = { bar: number; cell: number; cells: number };

type BarRole = { rhythm: string; stage: string };

function barRoles(inputs: LeadInputs, rng: () => number): BarRole[] {
  const pick = (options: string[], occurrence: number) =>
    inputs.seed === 0 ? options[occurrence % options.length] : options[Math.floor(rng() * options.length)];
  if (inputs.part === "intro") {
    const r = RHYTHMS.intro[inputs.style as IntroStyle];
    // The call keeps one rhythm wherever it recurs, so the motif is recognisable.
    const call1 = pick(r.call1, 0), call2 = pick(r.call2, 0), end = pick(r.end, 0);
    const roles: [string, string][] =
      inputs.bars === 4
        ? [["call1", call1], ["call2", call2], ["call1", call1], ["end", end]]
        : [["call1", call1], ["call2", call2], ["call1", call1], ["call2", call2], ["call1", call1], ["call2", call2], ["call1", call1], ["end", end]];
    return roles.map(([stage, rhythm]) => ({ stage, rhythm }));
  }
  const r = RHYTHMS.solo[inputs.style as SoloStyle];
  // The arc (brief §3): sparse and low, an answer, busier, a peak, then home. 16 bars take it slower.
  const stages: (keyof typeof r)[] =
    inputs.bars === 8
      ? ["low", "low", "answer", "answer", "busy", "busy", "peak", "resolve"]
      : ["low", "low", "answer", "answer", "low", "answer", "busy", "busy", "answer", "answer", "busy", "busy", "busy", "peak", "peak", "resolve"];
  // R16: the peak moves to the song's strongest chord when a second-half bar plays it.
  const peak = peakBar(inputs);
  if (peak !== stages.indexOf("peak")) {
    stages[stages.indexOf("peak")] = "busy";
    stages[peak] = "peak";
  }
  const seen: Record<string, number> = {};
  return stages.map((stage, bar) => {
    const occurrence = (seen[stage] = (seen[stage] ?? -1) + 1);
    // R15: the quote bar takes the motif's rhythm.
    if (inputs.quote && bar === QUOTE_BAR) return { stage, rhythm: inputs.quote.rhythm };
    return { stage, rhythm: pick(r[stage], occurrence) };
  });
}

/** The solo bar that restates the song's motif (R15): the first answer bar. */
export const QUOTE_BAR = 2;

/**
 * The bar a solo peaks in: normally its "peak" stage (bar 7 of 8); with a `peakDegree`, the second-half bar
 * playing that chord that's nearest to it (never the last bar, which resolves).
 */
export function peakBar(inputs: LeadInputs): number {
  const normal = inputs.bars === 8 ? 6 : 13;
  if (!inputs.peakDegree || inputs.part !== "solo") return normal;
  const { degrees } = leadChords(inputs.key, inputs.progressionId, inputs.bars, inputs.degrees);
  const options = degrees.flatMap((d, b) => (d === inputs.peakDegree && b >= inputs.bars / 2 && b < inputs.bars - 1 && b !== QUOTE_BAR ? [b] : []));
  return options.length ? options.reduce((a, b) => (Math.abs(b - normal) < Math.abs(a - normal) ? b : a)) : normal;
}

function slotsFor(roles: BarRole[]): Slot[] {
  const slots: Slot[] = [];
  roles.forEach(({ rhythm }, bar) => {
    for (let c = 0; c < 8; c++) {
      if (rhythm[c] !== "n") continue;
      let len = 1;
      while (c + len < 8 && rhythm[c + len] === "-") len++;
      slots.push({ bar, cell: c, cells: len });
    }
  });
  return slots;
}

// ---------------------------------------------------------------------------
// 2. Hand positions

type Placed = { midi: number; string: TabString; fret: number };

function mainStrings(inputs: LeadInputs): TabString[] {
  if (inputs.style === "octaves") return rulesJson.octaveStrings as TabString[];
  if (inputs.style === "harmony") return ["D", "G", "B"];
  return rulesJson.leadStrings as TabString[];
}

const STRING_ORDER: TabString[] = ["E", "A", "D", "G", "B", "e"];
const OCTAVE_PARTNER: Partial<Record<TabString, [TabString, number]>> = { E: ["D", 2], A: ["G", 2], D: ["B", 3], G: ["e", 3] };

function octaveOf(n: Placed, limit: number): LeadNote["double"] | undefined {
  const partner = OCTAVE_PARTNER[n.string];
  if (!partner) return undefined;
  const fret = n.fret + partner[1];
  return fret <= limit ? { midi: n.midi + 12, string: partner[0], fret, kind: "octave" } : undefined;
}

/** A diatonic third above on the next string up, else a sixth below on the next string down. */
function harmonyOf(n: Placed, keyPc: number, limit: number): LeadNote["double"] | undefined {
  const up = STRING_ORDER[STRING_ORDER.indexOf(n.string) + 1];
  const down = STRING_ORDER[STRING_ORDER.indexOf(n.string) - 1];
  const scaleAbove = (from: number, steps: number) => {
    let m = from;
    for (let k = 0; k < steps; ) if (inScale(++m, keyPc, MAJOR)) k++;
    return m;
  };
  const third = scaleAbove(n.midi, 2);
  if (up) {
    const fret = third - OPEN_STRING_MIDI[up];
    if (fret >= 0 && fret <= limit && Math.abs(fret - n.fret) <= 3) return { midi: third, string: up, fret, kind: "third" };
  }
  const sixth = third - 12;
  if (down) {
    const fret = sixth - OPEN_STRING_MIDI[down];
    if (fret >= 0 && fret <= limit && Math.abs(fret - n.fret) <= 3) return { midi: sixth, string: down, fret, kind: "sixth" };
  }
  return undefined;
}

/** Every scale note under the hand at position p, one fingering per pitch (the higher string on a tie). */
function boxNotes(p: number, inputs: LeadInputs, limit: number): Placed[] {
  const keyPc = pitchClassOf(inputs.key);
  const byPitch = new Map<number, Placed>();
  for (const s of mainStrings(inputs)) {
    for (let f = p; f <= Math.min(p + SPAN, limit); f++) {
      const n = { midi: OPEN_STRING_MIDI[s] + f, string: s, fret: f };
      if (!inScale(n.midi, keyPc)) continue;
      // Range (brief §3): the intro stays within about an octave, the solo within two.
      const home = 60 + keyPc + (inputs.style === "octaves" ? -12 : 0);
      const [lo, hi] = inputs.part === "intro" ? [home - 7, home + 7] : [home - 12, home + 14];
      if (n.midi < lo || n.midi > hi) continue;
      if (inputs.style === "octaves" && !octaveOf(n, limit)) continue;
      byPitch.set(n.midi, n);
    }
  }
  return [...byPitch.values()].sort((a, b) => a.midi - b.midi);
}

function arcTarget(inputs: LeadInputs, bar: number): number {
  const arc = inputs.style === "octaves" ? rulesJson.arcs.octaves : rulesJson.arcs[inputs.part];
  // A moved peak (R16) takes the arc's high point with it: swap the two bars' targets.
  let at = bar;
  if (inputs.part === "solo" && inputs.peakDegree) {
    const peak = peakBar(inputs), normal = inputs.bars === 8 ? 6 : 13;
    if (bar === peak) at = normal;
    else if (bar === normal) at = peak;
  }
  return 60 + pitchClassOf(inputs.key) + arc[Math.min(arc.length - 1, Math.floor((at * arc.length) / inputs.bars))];
}

function choosePositions(inputs: LeadInputs, limit: number, rng: () => number): number[] {
  const phrases = inputs.bars / 2;
  const strings = mainStrings(inputs);
  const low = OPEN_STRING_MIDI[strings[0]], high = OPEN_STRING_MIDI[strings[strings.length - 1]];
  const positions: number[] = [];
  for (let ph = 0; ph < phrases; ph++) {
    const target = (arcTarget(inputs, 2 * ph) + arcTarget(inputs, 2 * ph + 1)) / 2;
    let best = 0, bestCost = Infinity;
    for (let p = 0; p + SPAN <= limit; p++) {
      const centre = (low + p + high + p + SPAN) / 2;
      const move = ph === 0 ? 0 : Math.abs(p - positions[ph - 1]);
      const cost = Math.abs(centre - target) + W.boxMove * move + (inputs.seed ? rng() * 3 : 0);
      if (cost < bestCost) [best, bestCost] = [p, cost];
    }
    positions.push(best);
  }
  return positions;
}

// ---------------------------------------------------------------------------
// 3. Pitches

const scaleSteps = (a: number, b: number, keyPc: number) => {
  let n = 0;
  for (let m = Math.min(a, b) + 1; m < Math.max(a, b); m++) if (inScale(m, keyPc)) n++;
  return n; // scale notes strictly between: 0 = a step
};

type State = { prev: number | null; cur: number; cost: number; back: State | null; idx: number };

function pitchPath(
  slots: Slot[],
  cands: Placed[],
  degrees: Degree[],
  inputs: LeadInputs,
  roles: BarRole[],
  startPrev: number | null,
  startPrevPrev: number | null,
  motif: (number | null)[],
  isLastPhrase: boolean,
  noise: () => number,
  strictMotif = false,
): number[] | null {
  const keyPc = pitchClassOf(inputs.key);
  const { maxSemitones, recoverFrom, stepMaxSemitones } = rulesJson.leap;
  const motifWeight = inputs.part === "intro" ? W.motifIntro : W.motifSolo;
  const pitches = cands.map((c) => c.midi);

  const unary = (i: number, x: number) => {
    const slot = slots[i];
    let c = W.arc * Math.abs(x - arcTarget(inputs, slot.bar));
    if (STRONG.includes(slot.cell)) {
      const tones = chordTones(degrees[slot.bar]);
      const d = degreeOf(x, keyPc);
      // Octaves and harmony have fewer notes under the hand, so chord notes need a firmer pull there.
      if (!tones.includes(d)) c += inputs.style === "octaves" || inputs.style === "harmony" ? W.nonChordOnStrongDoubled : W.nonChordOnStrong;
      else if (d === chordThird(degrees[slot.bar])) c += W.thirdOnStrong;
    }
    if (inputs.seed) c += noise() * W.noise;
    return c;
  };
  // Hard rules on a move z → y → x; null = forbidden.
  const move = (i: number, z: number | null, y: number | null, x: number): number | null => {
    if (y === null) return 0;
    const d = x - y;
    if (Math.abs(d) > maxSemitones) return null;
    if (z !== null && Math.abs(y - z) >= recoverFrom) {
      // A leap of a fourth or more is followed by a step back the other way.
      if (Math.sign(d) !== -Math.sign(y - z) || Math.abs(d) === 0 || Math.abs(d) > stepMaxSemitones) return null;
    }
    if (isLastPhrase && i === slots.length - 1 && Math.abs(d) >= recoverFrom) return null; // no unresolved leap at the end
    let c: number;
    const tremolo = inputs.style === "shred" && roles[slots[i].bar].stage === "busy";
    if (d === 0) c = tremolo ? W.tremoloRepeat : W.repeat + (z === y ? W.threeInARow : 0);
    else {
      const between = scaleSteps(x, y, keyPc);
      c = between === 0 ? W.step : between === 1 ? W.skip : W.leap * (between - 1);
    }
    if (z !== null && x === z && d !== 0) c += W.returnToPrevious; // no shuttling back and forth
    const ref = motif[i];
    if (ref !== null && ref !== undefined) {
      const quoting = inputs.part === "solo" && inputs.quote !== undefined && slots[i].bar === QUOTE_BAR;
      c += (quoting ? W.motifIntro : motifWeight) * Math.abs(d - ref) * 0.5;
      // The intro's echo, and the solo's quote of the song's motif (R15), keep its shape: up where it went up,
      // down where it went down.
      if ((inputs.part === "intro" || quoting) && Math.sign(d) !== Math.sign(ref)) {
        if (strictMotif && slots[i].bar === (quoting ? QUOTE_BAR : 2)) return null; // strict: the exact shape
        c += W.motifDirection;
      }
    }
    return c;
  };

  let layer: State[] = [];
  if (!slots.length) return [];
  pitches.forEach((x, k) => {
    const m = move(0, startPrevPrev, startPrev, x);
    if (m !== null) layer.push({ prev: startPrev, cur: x, cost: unary(0, x) + m, back: null, idx: k });
  });
  for (let i = 1; i < slots.length; i++) {
    const next = new Map<string, State>();
    for (const s of layer) {
      pitches.forEach((x, k) => {
        const m = move(i, s.prev, s.cur, x);
        if (m === null) return;
        const cost = s.cost + m + unary(i, x);
        const key = `${s.cur}|${x}`;
        const old = next.get(key);
        if (!old || cost < old.cost) next.set(key, { prev: s.cur, cur: x, cost, back: s, idx: k });
      });
    }
    layer = [...next.values()];
    if (isLastPhrase && i === slots.length - 1) {
      // End on the root or the key's third.
      layer = layer.filter((s) => [0, 4].includes(degreeOf(s.cur, keyPc)));
    }
    if (!layer.length) return null;
  }
  const best = layer.reduce((a, b) => (b.cost < a.cost ? b : a));
  const out: number[] = [];
  for (let s: State | null = best; s; s = s.back) out.unshift(s.cur);
  return out;
}

// ---------------------------------------------------------------------------
// 4. Techniques

function addTechniques(notes: LeadNote[], inputs: LeadInputs, roles: BarRole[], positions: number[], limit: number) {
  const keyPc = pitchClassOf(inputs.key);
  const t = rulesJson.techniques;
  if (inputs.part !== "solo") return;
  const style = (rulesJson.styles.solo as Record<string, { legato: boolean; bends: string[]; slides: boolean }>)[inputs.style];
  const bentBars = new Set<number>();

  notes.forEach((n, i) => {
    const prev = notes[i - 1];
    const stage = roles[n.bar].stage;
    // The quote of the song's motif (R15) is stated plainly: no bends or legato, so it's heard as the tune.
    if (inputs.quote && n.bar === QUOTE_BAR) {
      if (n.cells >= t.vibratoMinCells && n.fret <= limit) n.vibrato = true;
      return;
    }
    // Bend: a held strong-beat note, reached by bending up from a scale note (whole step, else half).
    if (style.bends.includes(stage) && !bentBars.has(n.bar) && n.cells >= 2 && STRONG.includes(n.cell) && t.bendStrings.includes(n.string)) {
      for (const step of t.bendSteps) {
        const fromFret = n.fret - step;
        const fromMidi = n.midi - step;
        if (fromFret < Math.max(0, positions[Math.floor(n.bar / 2)]) || !inScale(fromMidi, keyPc)) continue;
        n.technique = { kind: "bend", fromFret, fromMidi };
        bentBars.add(n.bar);
        break;
      }
    }
    // Hammer-on / pull-off: the next eighth on the same string, a weak beat, 1-3 frets away.
    if (!n.technique && style.legato && prev && !prev.technique && prev.string === n.string && prev.bar === n.bar && n.cell === prev.cell + 1 && !STRONG.includes(n.cell)) {
      const gap = n.fret - prev.fret;
      if (gap !== 0 && Math.abs(gap) <= t.legatoMaxFrets && prev.fret > 0 && n.fret > 0) n.technique = { kind: gap > 0 ? "hammer" : "pull" };
    }
    // Slide into a new phrase along one string when the hand moves.
    const newPhrase = prev && Math.floor(prev.bar / 2) !== Math.floor(n.bar / 2);
    if (!n.technique && style.slides && newPhrase && prev.string === n.string && positions[Math.floor(n.bar / 2)] !== positions[Math.floor(prev.bar / 2)]) {
      const gap = n.fret - prev.fret;
      if (Math.abs(gap) >= 2 && Math.abs(gap) <= t.slideMaxFrets && prev.fret > 0 && n.fret > 0) n.technique = { kind: gap > 0 ? "slideUp" : "slideDown" };
    }
    if (n.cells >= t.vibratoMinCells && n.fret <= limit) n.vibrato = true;
  });
}

// ---------------------------------------------------------------------------
// 5. Rendering

export function noteToken(n: LeadNote): string {
  const tq = n.technique;
  const body =
    tq?.kind === "bend" ? `${tq.fromFret}b${n.fret}` : tq?.kind === "hammer" ? `h${n.fret}` : tq?.kind === "pull" ? `p${n.fret}` : tq?.kind === "slideUp" ? `/${n.fret}` : tq?.kind === "slideDown" ? `\\${n.fret}` : `${n.fret}`;
  return body + (n.vibrato ? "~" : "");
}

/** Chord symbol for the text version: G, D, Em, C … (the melody decides major or minor). */
export function chordSymbol(chord: ResolvedChord, degree: Degree): string {
  return chord.root + (["ii", "iii", "vi", "vii"].includes(degree) ? "m" : "");
}

/** A lead as tab bars (chord names over each bar, technique marks in the cells). */
export function leadTabBars(chords: ResolvedChord[], notes: LeadNote[]): TabBar[] {
  const bars: TabBar[] = chords.map((chord) => ({ label: chord.name, cells: Array.from({ length: 8 }, () => ({ frets: {} })) }));
  for (const n of notes) {
    const cell = bars[n.bar].cells[n.cell];
    cell.frets[n.string] = noteToken(n);
    if (n.double) cell.frets[n.double.string] = String(n.double.fret);
  }
  return bars;
}

function renderLead(inputs: LeadInputs, chords: ResolvedChord[], degrees: Degree[], notes: LeadNote[]) {
  const bars = leadTabBars(chords, notes);
  const text: string[][] = chords.map(() => Array(8).fill("·"));
  for (const n of notes) {
    const name = (m: number) => noteNameFor(m);
    const word = n.technique?.kind === "bend" ? `${name(n.technique.fromMidi)}^${name(n.midi)}` : name(n.midi);
    text[n.bar][n.cell] = n.double ? `${word}/${name(n.double.midi)}` : word;
  }
  const textLines = text.map((cells, b) => `${chordSymbol(chords[b], degrees[b])}: ${cells.join(" ")}`);
  return { tab: renderTab(bars), text: textLines };
}

function describeLead(lead: Omit<Lead, "spoken">): string {
  const { inputs } = lead;
  const kind = inputs.part === "intro" ? "Intro melody" : "Lead solo";
  const parts = lead.chords.map((c, b) => {
    const inBar = lead.notes.filter((n) => n.bar === b);
    const words = inBar.map((n) => {
      const base = describeFretted({ string: n.string, fret: n.technique?.kind === "bend" ? n.technique.fromFret : n.fret });
      const tech =
        n.technique?.kind === "bend" ? `, bent up to ${noteNameFor(n.midi)}` : n.technique?.kind === "hammer" ? ", hammer-on" : n.technique?.kind === "pull" ? ", pull-off" : n.technique ? ", slide" : "";
      const dbl = n.double ? ` with ${describeFretted(n.double)}` : "";
      return `${base}${tech}${dbl}${n.cells > 1 ? ", held" : ""}${n.vibrato ? " with vibrato" : ""}`;
    });
    return `Bar ${b + 1}, ${chordSymbol(c, lead.degrees[b])}: ${words.join("; ")}`;
  });
  return `${kind} in ${inputs.key}, ${styleLabel(inputs.part, inputs.style)}, ${inputs.bars} bars over ${inputs.progressionId}. ${parts.join(". ")}.`;
}

// ---------------------------------------------------------------------------

export function defaultLeadStyle(part: LeadPart): { style: LeadStyle; bars: number } {
  return rulesJson.defaults[part] as { style: LeadStyle; bars: number };
}

/** Chords under the lead, one per bar: the progression looped, or (R16) the song's own chords, cycled. */
export function leadChords(key: NoteName, progressionId: string, bars: number, own?: Degree[]): { chords: ResolvedChord[]; degrees: Degree[] } {
  const deg = own ?? getProgression(progressionId).degrees;
  const degrees = Array.from({ length: bars }, (_, b) => deg[b % deg.length]);
  return { chords: resolveDegrees(key, degrees), degrees };
}

/**
 * R15: the solo restates the song's motif: its quote bar has the motif's rhythm and at least 60% of its
 * contour (up, down or repeat, note to note).
 */
export function quoteReturns(lead: Pick<Lead, "notes" | "inputs">): boolean {
  const q = lead.inputs.quote;
  if (!q) return true;
  const ns = lead.notes.filter((n) => n.bar === QUOTE_BAR);
  const rhythm = [...q.rhythm].flatMap((c, i) => (c === "n" ? [i] : []));
  if (ns.map((n) => n.cell).join(",") !== rhythm.join(",")) return false;
  const dirs = ns.slice(1).map((n, i) => Math.sign(n.midi - ns[i].midi));
  if (!dirs.length) return true;
  return dirs.filter((d, i) => d === Math.sign(q.intervals[i] ?? 0)).length / dirs.length >= 0.6;
}

/**
 * 6. The intro's motif returns (brief §12): two bars share one rhythm and at least 60% of their
 * melodic contour (up, down or repeat, note to note).
 */
export function motifReturns(lead: Pick<Lead, "notes" | "inputs">): boolean {
  const contour = (bar: number) => {
    const ns = lead.notes.filter((n) => n.bar === bar);
    return { rhythm: ns.map((n) => `${n.cell}:${n.cells}`).join(","), dirs: ns.slice(1).map((n, i) => Math.sign(n.midi - ns[i].midi)) };
  };
  for (let a = 0; a < lead.inputs.bars; a++)
    for (let b = a + 1; b < lead.inputs.bars; b++) {
      const x = contour(a), y = contour(b);
      if (x.rhythm !== y.rhythm || !x.dirs.length) continue;
      if (x.dirs.filter((d, i) => d === y.dirs[i]).length / x.dirs.length >= 0.6) return true;
    }
  return false;
}

/** Share of strong-beat notes that are notes of the chord playing (brief §12.2). */
export function strongChordRatio(lead: Pick<Lead, "notes" | "degrees" | "inputs">): number {
  const keyPc = pitchClassOf(lead.inputs.key);
  const strong = lead.notes.filter((n) => STRONG.includes(n.cell));
  return strong.filter((n) => chordTones(lead.degrees[n.bar]).includes(degreeOf(n.midi, keyPc))).length / strong.length;
}

/** The solo climbs to its highest note in its second half (brief §12.6). */
export function peaksLate(lead: Pick<Lead, "notes" | "inputs">): boolean {
  const top = Math.max(...lead.notes.map((n) => n.midi));
  return lead.notes.find((n) => n.midi === top)!.bar >= lead.inputs.bars / 2;
}

function meetsGoals(lead: Lead): boolean {
  if (strongChordRatio(lead) < rulesJson.minStrongChordRatio) return false;
  return lead.inputs.part === "intro" ? motifReturns(lead) : peaksLate(lead) && quoteReturns(lead);
}

/**
 * Writes a lead. The hard rules (scale, leaps, endings, positions, fret limits) are built into the
 * search; the shape goals (motif returns, strong beats on chord notes, the solo peaking late) are
 * generated and tested: if a take misses one, it tries again from a derived seed. Deterministic, so
 * the same seed always gives the same lead.
 */
export function generateLead(inputs: LeadInputs): Lead {
  let lead = generateOnce(inputs, inputs.seed, true);
  for (let attempt = 1; attempt <= 60 && !meetsGoals(lead); attempt++) {
    // Later attempts let the echo bend its shape a little (still checked: the motif must return).
    lead = generateOnce(inputs, (inputs.seed + 1) * 7919 + attempt * 104729, attempt < 30);
  }
  return lead;
}

function generateOnce(inputs: LeadInputs, internalSeed: number, strictEcho: boolean): Lead {
  const limit = rulesJson.fretLimits[inputs.part];
  const rng = mulberry32(internalSeed * 2654435761 + inputs.bars * 97 + inputs.style.length);
  const { chords, degrees } = leadChords(inputs.key, inputs.progressionId, inputs.bars, inputs.degrees);
  // Everything random below follows the internal seed; the lead still reports the seed it was asked for.
  const seeded = { ...inputs, seed: internalSeed };
  const roles = barRoles(seeded, rng);
  const slots = slotsFor(roles);
  const positions = choosePositions(seeded, limit, rng);
  const keyPc = pitchClassOf(inputs.key);

  const notes: LeadNote[] = [];
  const pitches: number[] = [];
  for (let ph = 0; ph < positions.length; ph++) {
    const phraseSlots = slots.filter((s) => Math.floor(s.bar / 2) === ph);
    // Motif: the intervals the same bar role used the first time it appeared.
    const motif = phraseSlots.map((s) => {
      // R15: the quote bar follows the song's motif, note to note.
      if (inputs.part === "solo" && inputs.quote && s.bar === QUOTE_BAR) {
        const k = phraseSlots.filter((x) => x.bar === QUOTE_BAR).indexOf(s);
        return k > 0 ? (inputs.quote.intervals[k - 1] ?? null) : null;
      }
      const stage = roles[s.bar].stage;
      const firstBar = roles.findIndex((r) => r.stage === stage && r.rhythm === roles[s.bar].rhythm);
      if (firstBar === s.bar || firstBar < 0) return null;
      // Intros echo the motif once (bar 3); later repeats keep its rhythm but may vary the notes.
      if (inputs.part === "intro" && s.bar !== 2) return null;
      const i = slots.findIndex((x) => x.bar === firstBar && x.cell === s.cell);
      return i > 0 && pitches[i] !== undefined ? pitches[i] - pitches[i - 1] : null;
    });
    const prev = pitches.length ? pitches[pitches.length - 1] : null;
    const prevPrev = pitches.length > 1 ? pitches[pitches.length - 2] : null;
    // If no line fits the rules under this hand position, try the nearest ones (the rules never bend).
    let path: number[] | null = null;
    let cands: Placed[] = [];
    const tries = Array.from({ length: limit - SPAN + 1 }, (_, p) => p).sort((a, b) => Math.abs(a - positions[ph]) - Math.abs(b - positions[ph]) || a - b);
    // The intro's echo keeps the motif's exact shape if any hand position allows it.
    const hasMotif = strictEcho && (inputs.part === "intro" || inputs.quote !== undefined) && motif.some((m) => m !== null);
    for (const strict of hasMotif ? [true, false] : [false]) {
      for (const p of tries) {
        cands = boxNotes(p, inputs, limit);
        path = pitchPath(phraseSlots, cands, degrees, seeded, roles, prev, prevPrev, motif, ph === positions.length - 1, rng, strict);
        if (path) {
          positions[ph] = p;
          break;
        }
      }
      if (path) break;
    }
    if (!path) throw new Error(`No melody satisfies the rules (${inputs.key} ${inputs.progressionId} ${inputs.style} seed ${inputs.seed})`);
    path.forEach((midi, i) => {
      const s = phraseSlots[i];
      const placed = cands.find((c) => c.midi === midi)!;
      const double = inputs.style === "octaves" ? octaveOf(placed, limit) : inputs.style === "harmony" ? harmonyOf(placed, keyPc, limit) : undefined;
      notes.push({
        bar: s.bar,
        cell: s.cell,
        cells: s.cells,
        midi,
        string: placed.string,
        fret: placed.fret,
        role: chordTones(degrees[s.bar]).includes(degreeOf(midi, keyPc)) ? "chord" : "passing",
        ...(double ? { double } : {}),
      });
      pitches.push(midi);
    });
  }
  addTechniques(notes, inputs, roles, positions, limit);
  const { tab, text } = renderLead(inputs, chords, degrees, notes);
  const lead = { inputs, chords, degrees, notes, positions, fretLimit: limit, tab, text };
  return { ...lead, spoken: describeLead(lead) };
}

/** The next seed that gives a different take, so "Generate" is never a no-op. */
export function nextLeadSeed(inputs: LeadInputs): number {
  const current = tabText(generateLead(inputs).tab);
  for (let seed = inputs.seed + 1; seed < inputs.seed + 50; seed++) if (tabText(generateLead({ ...inputs, seed }).tab) !== current) return seed;
  return inputs.seed + 1;
}

/** Tab plus note names, for "Copy tab". */
export function leadCopyText(lead: Lead): string {
  const { inputs } = lead;
  const title = `${inputs.part === "intro" ? "Intro melody" : "Lead solo"} · ${styleLabel(inputs.part, inputs.style)} · key of ${inputs.key} · ${inputs.progressionId} · Palm/Mute`;
  return `${title}\n\n${tabText(lead.tab)}\n\n${lead.text.join("\n")}\n`;
}

/** Rebuilds a lead from explicit notes (used for the brief's hand-written reference example). */
export function leadFromNotes(inputs: LeadInputs, notes: LeadNote[]): Lead {
  const { chords, degrees } = leadChords(inputs.key, inputs.progressionId, inputs.bars, inputs.degrees);
  const { tab, text } = renderLead(inputs, chords, degrees, notes);
  const lead = { inputs, chords, degrees, notes, positions: [], fretLimit: rulesJson.fretLimits[inputs.part], tab, text };
  return { ...lead, spoken: describeLead(lead) };
}
