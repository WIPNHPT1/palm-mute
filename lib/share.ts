// Share links (docs/song-builder-prd.md premium P1): the whole song in a link's hash, "#song=…". No backend:
// the engine is deterministic, so the setup, each section's take, options, lead and lock (with what it was
// locked in) rebuild exactly the same song. A link is untrusted input: everything is checked and anything that
// doesn't fit falls back to a safe default, so a bad link can never break the page or put strange text on it.
// Pure, no React.
import {
  type FeelId,
  type SectionInputs,
  type SectionOptions,
  type SongThread,
  DIFFICULTIES,
  FEEL_IDS,
  SECTION_IDS,
  type SectionId,
  recipes,
} from "@/lib/generator";
import { type LeadStyle, INTRO_STYLES, RULES, SOLO_STYLES } from "@/lib/melody";
import { type Degree, type NoteName, PITCH_CLASSES, progressions } from "@/lib/musicTheory";
import type { Difficulty } from "@/lib/playability";
import { type PresetId, PRESET_IDS } from "@/lib/presets";
import { LENGTH } from "@/lib/songLength";
import { TITLES } from "@/lib/titleGenerator";

type Lead = { style: LeadStyle; bars: number; sent?: boolean };

/** What a link carries for one section. */
export type SharedSection = {
  seed: number;
  lead: Lead | null;
  options: SectionOptions;
  thread?: SongThread;
  locked: boolean;
  frozen: SectionInputs | null;
};

/** What a link carries. */
export type SharedSong = {
  key: NoteName;
  feel: FeelId;
  progressionId: string;
  lengthSec: number;
  difficulty: Difficulty;
  preset: PresetId | null;
  songSeed: number;
  title: string;
  sections: Record<SectionId, SharedSection>;
};

const VERSION = 1;

// ---------------------------------------------------------------------------
// Encoding: JSON, UTF-8, base64url.

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

/** The "#song=…" fragment for a song. */
export function encodeSong(song: SharedSong): string {
  const sections: Record<string, unknown> = {};
  for (const id of SECTION_IDS) {
    const s = song.sections[id];
    sections[id] = {
      s: s.seed,
      ...(s.lead ? { l: s.lead } : {}),
      ...(Object.keys(s.options).length ? { o: s.options } : {}),
      ...(s.thread ? { t: s.thread } : {}),
      ...(s.locked && s.frozen ? { f: s.frozen } : {}),
    };
  }
  const data = {
    v: VERSION,
    k: song.key,
    f: song.feel,
    p: song.progressionId,
    n: song.lengthSec,
    d: song.difficulty,
    r: song.preset,
    g: song.songSeed,
    t: TITLES.indexOf(song.title),
    s: sections,
  };
  return `song=${toBase64Url(JSON.stringify(data))}`;
}

// ---------------------------------------------------------------------------
// Decoding: every field checked.

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const int = (x: unknown, lo: number, hi: number): number | undefined => (Number.isInteger(x) && (x as number) >= lo && (x as number) <= hi ? (x as number) : undefined);
const oneOf = <T extends string>(x: unknown, values: readonly T[]): T | undefined => (values.includes(x as T) ? (x as T) : undefined);
const DEGREES: Degree[] = ["I", "ii", "iii", "IV", "V", "vi", "vii"];
const SEED_MAX = 1_000_000;

function lead(x: unknown, id: SectionId): Lead | null {
  if (!isObj(x)) return null;
  const part = id === "solo" ? "solo" : "intro";
  if (id !== "solo" && id !== "intro") return null;
  const style = oneOf(x.style, (part === "solo" ? SOLO_STYLES : INTRO_STYLES) as readonly string[]) as LeadStyle | undefined;
  const bars = oneOf(String(x.bars), RULES.lengths[part].map(String));
  if (!style || !bars) return null;
  return { style, bars: Number(bars), ...(x.sent === true ? { sent: true } : {}) };
}

function options(x: unknown, id: SectionId): SectionOptions {
  if (!isObj(x)) return {};
  const out: SectionOptions = {};
  if (id !== "solo" && typeof x.groove === "string" && recipes[id].variants.some((v) => v.name === x.groove)) out.groove = x.groove;
  const sound = oneOf(x.sound, ["pm", "ring"] as const);
  if (sound) out.sound = sound;
  const shape = oneOf(x.shape, ["two", "three"] as const);
  if (shape) out.shape = shape;
  const times = int(x.times, 1, 12);
  if (times) out.times = times;
  const drums = oneOf(x.drums, ["half", "none"] as const);
  if (drums) out.drums = drums;
  if (x.noPush === true && id === "verse") out.noPush = true;
  if (x.keyUp === true && id === "chorus") out.keyUp = true;
  return out;
}

function thread(x: unknown): SongThread | undefined {
  if (!isObj(x) || !isObj(x.quote)) return undefined;
  const q = x.quote;
  if (typeof q.rhythm !== "string" || !/^[n.-]{8}$/.test(q.rhythm)) return undefined;
  if (!Array.isArray(q.intervals) || q.intervals.length > 8 || !q.intervals.every((i) => int(i, -24, 24) !== undefined)) return undefined;
  if (typeof q.from !== "string" || q.from.length > 40) return undefined;
  if (!Array.isArray(x.degrees) || x.degrees.length > 8 || !x.degrees.every((d) => DEGREES.includes(d as Degree))) return undefined;
  const peak = oneOf(x.peakDegree, DEGREES);
  if (!peak) return undefined;
  return { quote: { rhythm: q.rhythm, intervals: q.intervals as number[], from: q.from }, degrees: x.degrees as Degree[], peakDegree: peak };
}

/** Inputs a locked section was frozen with (or undefined if they don't check out). */
function frozen(x: unknown, id: SectionId): SectionInputs | undefined {
  if (!isObj(x)) return undefined;
  const key = oneOf(x.key, PITCH_CLASSES);
  const feel = oneOf(x.feel, FEEL_IDS);
  const progressionId = typeof x.progressionId === "string" && progressions.some((p) => p.id === x.progressionId) ? x.progressionId : undefined;
  const seed = int(x.seed, 0, SEED_MAX);
  if (!key || !feel || !progressionId || seed === undefined) return undefined;
  const t = thread(x.thread);
  const difficulty = oneOf(x.difficulty, DIFFICULTIES);
  return { key, feel, progressionId, seed, lead: lead(x.lead, id), options: options(x.options, id), ...(t ? { thread: t } : {}), ...(difficulty ? { difficulty } : {}) };
}

/** The song in a "#song=…" fragment (or a whole URL), or null if it isn't one we can read. */
export function decodeSong(hash: string): SharedSong | null {
  // Base64url, though plain base64 ("+", "/") is read too, in case something re-encoded the link.
  const m = /(?:^|[#&])song=([A-Za-z0-9_+/-]+)/.exec(hash);
  if (!m || m[1].length > 20_000) return null;
  let data: unknown;
  try {
    data = JSON.parse(fromBase64Url(m[1]));
  } catch {
    return null;
  }
  if (!isObj(data) || data.v !== VERSION || !isObj(data.s)) return null;
  const key = oneOf(data.k, PITCH_CLASSES);
  const feel = oneOf(data.f, FEEL_IDS);
  const progressionId = typeof data.p === "string" && progressions.some((p) => p.id === data.p) ? data.p : undefined;
  if (!key || !feel || !progressionId) return null;
  const len = int(data.n, LENGTH.min, LENGTH.max);
  const sections = {} as Record<SectionId, SharedSection>;
  for (const id of SECTION_IDS) {
    const raw = isObj(data.s[id]) ? (data.s[id] as Record<string, unknown>) : {};
    const f = frozen(raw.f, id);
    sections[id] = {
      seed: int(raw.s, 0, SEED_MAX) ?? 0,
      lead: id === "solo" ? lead(raw.l, id) ?? { style: RULES.defaults.solo.style as LeadStyle, bars: RULES.defaults.solo.bars } : lead(raw.l, id),
      options: options(raw.o, id),
      ...(thread(raw.t) ? { thread: thread(raw.t) } : {}),
      locked: !!f,
      frozen: f ?? null,
    };
  }
  const title = int(data.t, 0, TITLES.length - 1);
  return {
    key,
    feel,
    progressionId,
    lengthSec: len !== undefined && (len - LENGTH.min) % LENGTH.step === 0 ? len : LENGTH.default,
    difficulty: oneOf(data.d, DIFFICULTIES) ?? "intermediate",
    preset: oneOf(data.r, PRESET_IDS) ?? null,
    songSeed: int(data.g, 0, SEED_MAX) ?? 0,
    title: title !== undefined ? TITLES[title] : TITLES[0],
    sections,
  };
}
