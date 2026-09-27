// Voicing search (docs/power-chord-engine-brief.md §5): every playable shape for each chord, scored
// with guitarist rules, and the cheapest path through a section's chords. Pure functions, no React.
import settingsJson from "@/data/engine-settings.json";
import shapesJson from "@/data/voicing-shapes.json";
import { type Fretted, type TabString, midiOf, pitchClass, span } from "@/lib/fretboard";

export type Role = "R" | "5" | "8";
export type ShapeTag = "twoNote" | "threeNote" | "inverted" | "octaveRiff";

export type Shape = {
  id: string;
  label: string;
  rootString: TabString;
  tags: ShapeTag[];
  notes: { string: TabString; offset: number; role: Role }[];
  muted?: TabString[];
};

export type Voicing = {
  shapeId: string;
  rootPc: number;
  /** Low to high, as the shape lists them. */
  notes: (Fretted & { role: Role })[];
  rootString: TabString;
  /** Hand position: the lowest fretted note (index finger), or 0 for an open voicing. */
  position: number;
  open: boolean;
  tags: ShapeTag[];
};

export const SHAPES = shapesJson.shapes as Shape[];
export const SETTINGS = settingsJson;
const W = settingsJson.weights;

export function shapeById(id: string): Shape {
  const shape = SHAPES.find((s) => s.id === id);
  if (!shape) throw new Error(`Unknown shape ${id}`);
  return shape;
}

/** Every placement of the given shapes that plays root `rootPc` inside the fret limit. */
export function candidates(rootPc: number, shapeIds: string[], fretLimit = SETTINGS.fretLimit): Voicing[] {
  const out: Voicing[] = [];
  for (const id of shapeIds) {
    const shape = shapeById(id);
    const rootNote = shape.notes.find((n) => n.role === "R")!;
    for (let f = 0; f <= fretLimit; f++) {
      const notes = shape.notes.map((n) => ({ string: n.string, fret: f + n.offset, role: n.role }));
      if (notes.some((n) => n.fret < 0 || n.fret > fretLimit)) continue;
      if (pitchClass(midiOf({ string: rootNote.string, fret: f + rootNote.offset })) !== rootPc) continue;
      const fretted = notes.filter((n) => n.fret > 0).map((n) => n.fret);
      const open = notes.some((n) => n.fret === 0);
      out.push({
        shapeId: id,
        rootPc,
        notes,
        rootString: shape.rootString,
        // An open chord is played in open position, whatever fret its other finger is on.
        position: open ? 0 : Math.min(...fretted),
        open,
        tags: shape.tags,
      });
    }
  }
  return out;
}

/**
 * Proves a voicing is a correct power chord: exactly the root and fifth (plus the octave root for
 * 3-note and octave shapes), each role on the right pitch, inside the limits. Returns problems, or [].
 */
export function checkVoicing(v: Voicing, fretLimit = SETTINGS.fretLimit): string[] {
  const problems: string[] = [];
  const fifth = (v.rootPc + 7) % 12;
  for (const n of v.notes) {
    const pc = pitchClass(midiOf(n));
    const want = n.role === "5" ? fifth : v.rootPc;
    if (pc !== want) problems.push(`${n.string}${n.fret} is pitch class ${pc}, not the ${n.role === "5" ? "fifth" : "root"} (${want})`);
    if (n.fret < 0 || n.fret > fretLimit) problems.push(`${n.string}${n.fret} is outside frets 0-${fretLimit}`);
  }
  const pcs = new Set(v.notes.map((n) => pitchClass(midiOf(n))));
  if (pcs.size !== 2 && !(v.tags.includes("octaveRiff") && pcs.size === 1)) problems.push(`pitch classes ${[...pcs].join(",")} aren't {root, fifth}`);
  if (v.tags.includes("octaveRiff")) {
    const [lo, hi] = v.notes.map(midiOf);
    if (hi - lo !== 12) problems.push("octave riff isn't an octave");
  }
  if (v.tags.includes("threeNote")) {
    const roots = v.notes.filter((n) => n.role !== "5").map(midiOf);
    if (roots.length !== 2 || Math.abs(roots[1] - roots[0]) !== 12) problems.push("3-note shape's octave isn't an octave above the root");
  }
  if (span(v.notes) > SETTINGS.maxSpan) problems.push(`span ${span(v.notes)} > ${SETTINGS.maxSpan}`);
  const rhythmRoots = SETTINGS.rhythmRootStrings as TabString[];
  if (!v.tags.includes("octaveRiff") && !rhythmRoots.includes(v.rootString)) problems.push(`root on the ${v.rootString} string`);
  return problems;
}

// ---------------------------------------------------------------------------
// Scoring

export type SectionStyle = {
  /** Where the section's hand sits: its target index-finger position. */
  target: number;
  shapes: string[];
  openStrings: boolean;
  /** Fast palm-muted parts keep to tight 2-note shapes. */
  fastMuted: boolean;
  /** Shape tags this section prefers (e.g. 3-note for big choruses); other shapes cost a little more. */
  prefer?: ShapeTag[];
  /** Position the previous section's hand was around (a soft pull on the first chord), if any. */
  carryFrom?: number;
};

export function zoneOf(target: number): [number, number] {
  return [Math.max(0, target - SETTINGS.zone.below), target + SETTINGS.zone.above];
}

export type CostBreakdown = Record<string, number>;

/** The cost of playing voicing v in this section, on its own. */
export function unaryCost(v: Voicing, style: SectionStyle): CostBreakdown {
  const [lo, hi] = zoneOf(style.target);
  const out: CostBreakdown = {};
  const outside = v.position < lo ? lo - v.position : v.position > hi ? v.position - hi : 0;
  if (outside) out.zone = W.zone * outside;
  if (v.position !== style.target) out.register = W.register * Math.abs(v.position - style.target);
  if (v.open && style.openStrings) out.open = W.openBonus;
  if (v.rootString === "D" && !v.tags.includes("inverted")) out.dRoot = W.dRoot;
  if (v.tags.includes("threeNote") && style.fastMuted) out.threeNote = W.threeNoteInFastMuted;
  if (v.tags.includes("inverted")) out.inverted = W.inverted;
  if (style.prefer?.length && !v.tags.some((t) => style.prefer!.includes(t))) out.notPreferred = W.notPreferredShape;
  return out;
}

/** The cost of moving the hand from voicing a to voicing b. */
export function moveCost(a: Voicing, b: Voicing): CostBreakdown {
  const out: CostBreakdown = {};
  const move = Math.abs(a.position - b.position);
  if (move) out.move = W.positionMove * move;
  if (a.rootString !== b.rootString) out.stringSet = W.stringSetChange;
  const held = b.notes.filter((n) => n.fret > 0 && a.notes.some((m) => m.string === n.string && m.fret === n.fret)).length;
  if (held) out.commonTone = W.commonTone * held;
  return out;
}

const total = (c: CostBreakdown) => Object.values(c).reduce((a, b) => a + b, 0);

// ---------------------------------------------------------------------------
// Path search

export type VoicedPath = {
  /** One voicing per chord in the input sequence (repeated chords share a voicing). */
  voicings: Voicing[];
  cost: number;
  /** Per chord: why it cost what it did (for tests and debugging). */
  why: CostBreakdown[];
  /** Chord indices where the hand moves more than maxMove frets (an explicit position shift). */
  shifts: number[];
};

/**
 * Finds the best voicing path for a chord sequence (root pitch classes, one per bar) and up to
 * `max` alternatives within `margin` of it. Repeated chords always keep one voicing ("repeated
 * chords stay put"), so the search runs over the distinct chords in order of appearance, with a
 * move cost between every pair of consecutive bars.
 */
export function voicePaths(roots: number[], style: SectionStyle, opts = SETTINGS.alternatives): VoicedPath[] {
  const distinct = [...new Set(roots)];
  const cands = distinct.map((pc) => candidates(pc, style.shapes));
  if (cands.some((c) => c.length === 0)) throw new Error(`No voicing for pitch class in ${distinct.join(",")}`);
  const unary = cands.map((cs) => cs.map((v) => total(unaryCost(v, style))));
  // Transitions between distinct-chord slots, from the bar sequence.
  const steps: [number, number][] = [];
  for (let i = 1; i < roots.length; i++) {
    const a = distinct.indexOf(roots[i - 1]), b = distinct.indexOf(roots[i]);
    if (a !== b) steps.push([a, b]);
  }

  // Exhaustive branch-and-bound over slot assignments, ordered by first appearance. The number of
  // distinct chords is at most 4 and each has ~10-30 candidates, so a lower bound per remaining slot
  // (its cheapest unary cost) keeps this fast while guaranteeing every path within the margin is found.
  const minUnary = unary.map((u) => Math.min(...u));
  // Moves can be negative (held common tones, at most 3 per chord), so the bound allows for that.
  const bestMove = Math.min(0, W.commonTone * 3);
  const restBound = minUnary.map(
    (_, i) => minUnary.slice(i + 1).reduce((a, b) => a + b, 0) + steps.filter(([x, y]) => Math.max(x, y) > i).length * bestMove,
  );
  const maxMove = SETTINGS.maxMove;
  const found: { choice: number[]; cost: number }[] = [];
  let best = Infinity;
  const choice: number[] = [];

  function partialCost(slot: number): number {
    // cost added by assigning `slot`, counting only transitions whose both ends are assigned
    let c = unary[slot][choice[slot]];
    if (slot === 0 && style.carryFrom !== undefined) c += W.carryIn * Math.abs(cands[0][choice[0]].position - style.carryFrom);
    for (const [a, b] of steps) {
      if (Math.max(a, b) !== slot) continue;
      const va = cands[a][choice[a]], vb = cands[b][choice[b]];
      const m = total(moveCost(va, vb));
      // Big jumps inside a section only when nothing else works (recorded as a shift).
      c += m + (Math.abs(va.position - vb.position) > maxMove ? 100 : 0);
    }
    return c;
  }

  function search(slot: number, acc: number) {
    if (slot === distinct.length) {
      found.push({ choice: [...choice], cost: acc });
      if (acc < best) best = acc;
      return;
    }
    for (let k = 0; k < cands[slot].length; k++) {
      choice[slot] = k;
      const next = acc + partialCost(slot);
      if (next + restBound[slot] > best + opts.margin + 1e-9) continue;
      search(slot + 1, next);
    }
  }
  search(0, 0);

  const kept = found
    .filter((f) => f.cost <= best + opts.margin + 1e-9)
    .sort((a, b) => a.cost - b.cost || a.choice.join().localeCompare(b.choice.join()))
    .slice(0, opts.max);

  return kept.map(({ choice: ch, cost }) => {
    const bySlot = ch.map((k, slot) => cands[slot][k]);
    const voicings = roots.map((pc) => bySlot[distinct.indexOf(pc)]);
    const why = roots.map((pc, i) => {
      const v = bySlot[distinct.indexOf(pc)];
      const c = { ...unaryCost(v, style) };
      if (i > 0 && roots[i - 1] !== pc) for (const [k, x] of Object.entries(moveCost(voicings[i - 1], v))) c[k] = (c[k] ?? 0) + x;
      return c;
    });
    const shifts = voicings.flatMap((v, i) => (i > 0 && Math.abs(v.position - voicings[i - 1].position) > maxMove ? [i] : []));
    return { voicings, cost: Math.round(cost * 1000) / 1000, why, shifts };
  });
}

// ---------------------------------------------------------------------------
// Registers

/**
 * The key's lowest comfortable position for its tonic: the lowest E- or A-root power chord, or an
 * open D-string root (keys of E, A and D sit at 0 and use open strings).
 */
export function lowAnchor(keyPc: number): number {
  const positions = candidates(keyPc, ["E2", "A2"]).map((v) => v.position);
  const openD = candidates(keyPc, ["D2"]).filter((v) => v.open).map((v) => v.position);
  return Math.min(...positions, ...openD);
}

/** Target position for a register: low, or lifted by chorusLift (never so high a shape can't fit). */
export function registerTarget(keyPc: number, register: "low" | "lift"): number {
  const low = lowAnchor(keyPc);
  if (register === "low") return low;
  return Math.min(low + SETTINGS.chorusLift, SETTINGS.fretLimit - 3);
}
