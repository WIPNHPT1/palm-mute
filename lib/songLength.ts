// The song-length plan (docs/song-builder-prd.md B2–B3): given a target length and the feel's tempo, which
// form the song takes and how many times each slot plays its section's material. Pure and deterministic, no
// React; the rules and their costs are data (data/song-forms.json).
import formsJson from "@/data/song-forms.json";
import { type FormId, type FormSlot, type SectionId, FORM_IDS, formSpec } from "@/lib/songPlan";

export const LENGTH = formsJson.length as { min: number; max: number; step: number; default: number };
const GROWTH = formsJson.growth as string[];
const TOLERANCE_BARS = formsJson.toleranceBars;
const STEP_COST = formsJson.stepCost;
const FORM_COST = formsJson.formCost as Record<FormId, number>;
const FINE = new Set(formsJson.fine as string[]);

export type SongPlan = {
  form: FormId;
  slots: FormSlot[];
  /** The song's length as planned, in bars and seconds. */
  bars: number;
  seconds: number;
  /** What was asked for, in seconds. */
  target: number;
  /** How many growth steps the form took from its minimum (more steps = more repeats). */
  steps: number;
};

/** A 4/4 bar's length in seconds. */
export const barSeconds = (bpm: number) => 240 / bpm;

/** "3:15" */
export function formatLength(seconds: number): string {
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

type Take = { times: number[]; bars: number; steps: number };

/**
 * One form grown from its minimum toward `targetBars`, step by step in the data's growth order. `fixed`
 * sections (a section card's Bars option) play exactly that many times wherever they appear and never grow.
 */
function growForm(form: FormId, targetBars: number, materialBars: (id: SectionId) => number, fixed: Partial<Record<SectionId, number>>): Take {
  const spec = formSpec(form);
  const times = spec.map((s) => fixed[s.section] ?? s.min);
  const total = () => times.reduce((a, t, i) => a + t * materialBars(spec[i].section), 0);
  let best: Take = { times: [...times], bars: total(), steps: 0 };
  let steps = 0;
  for (let grew = true; grew; ) {
    grew = false;
    for (const tag of GROWTH) {
      let changed = false;
      spec.forEach((s, i) => {
        if (s.grow === tag && fixed[s.section] === undefined && times[i] < s.max) {
          times[i]++;
          changed = true;
        }
      });
      if (!changed) continue;
      grew = true;
      steps++;
      const bars = total();
      if (Math.abs(bars - targetBars) < Math.abs(best.bars - targetBars)) best = { times: [...times], bars, steps };
      // Past the target by more than any later step could fix: stop growing this form.
      if (bars - targetBars > TOLERANCE_BARS && bars > best.bars) return refine(best);
    }
  }
  return refine(best);

  // Nudge single `fine` slots one time up or down while that brings the song closer to the target.
  function refine(take: Take): Take {
    const t = [...take.times];
    const sum = () => t.reduce((a, n, i) => a + n * materialBars(spec[i].section), 0);
    for (let improved = true; improved; ) {
      improved = false;
      let bestMove: { i: number; d: number; miss: number } | null = null;
      const now = Math.abs(sum() - targetBars);
      spec.forEach((s, i) => {
        if (!s.grow || !FINE.has(s.grow) || fixed[s.section] !== undefined) return;
        for (const d of [1, -1]) {
          if (t[i] + d < s.min || t[i] + d > s.max) continue;
          t[i] += d;
          const miss = Math.abs(sum() - targetBars);
          t[i] -= d;
          if (miss < now - 1e-9 && (!bestMove || miss < bestMove.miss)) bestMove = { i, d, miss };
        }
      });
      if (bestMove) {
        const m: { i: number; d: number } = bestMove;
        t[m.i] += m.d;
        improved = true;
      }
    }
    return { times: t, bars: sum(), steps: take.steps };
  }
}

/**
 * The plan for a song of `targetSeconds` at `bpm`. `materialBars(section)` is how many bars one pass of a
 * section's material plays (its card's bars × its own repeat, e.g. the Verse's 4 bars × 2). Among forms that
 * land within the tolerance, the cheapest by form cost + step cost + miss; otherwise the closest.
 */
export function planSong(
  targetSeconds: number,
  bpm: number,
  materialBars: (id: SectionId) => number,
  fixed: Partial<Record<SectionId, number>> = {},
): SongPlan {
  const targetBars = targetSeconds / barSeconds(bpm);
  const takes = FORM_IDS.map((form) => ({ form, ...growForm(form, targetBars, materialBars, fixed) }));
  const miss = (t: Take) => Math.abs(t.bars - targetBars);
  const close = takes.filter((t) => miss(t) <= TOLERANCE_BARS);
  const cost = (t: (typeof takes)[number]) => FORM_COST[t.form] + STEP_COST * t.steps + miss(t);
  const pick = close.length ? close.reduce((a, b) => (cost(b) < cost(a) ? b : a)) : takes.reduce((a, b) => (miss(b) < miss(a) ? b : a));
  const slots = formSpec(pick.form).map(({ section, name, variation }, i) => ({ section, name, ...(variation ? { variation } : {}), times: pick.times[i] }));
  return { form: pick.form, slots, bars: pick.bars, seconds: pick.bars * barSeconds(bpm), target: targetSeconds, steps: pick.steps };
}
