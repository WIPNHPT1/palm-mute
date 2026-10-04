import { type TuningId, MAX_FRET, getTuning } from "@/lib/lab/chords";

export type DotColor = "accent" | "brass" | "ink" | "success" | "muted";
export type NeckDot = { string: number; fret: number; label: string; color: DotColor; filled: boolean };

const FILL: Record<DotColor, string> = { accent: "fill-accent", brass: "fill-brass", ink: "fill-text-primary", success: "fill-success", muted: "fill-text-muted" };
const STROKE: Record<DotColor, string> = { accent: "stroke-accent", brass: "stroke-brass", ink: "stroke-text-primary", success: "stroke-success", muted: "stroke-text-muted" };
const ON: Record<DotColor, string> = { accent: "fill-text-on-accent", brass: "fill-ink", ink: "fill-surface", success: "fill-surface", muted: "fill-surface" };

type Geometry = { W: number; a0: number; al: number; c0: number; cs: number; r: number; rs: number; fs: number; H: number; vertical: boolean };

const across = (g: Geometry, s: number) => (g.vertical ? g.c0 + s * g.cs : g.c0 + (5 - s) * g.cs);
const along = (g: Geometry, f: number) => g.a0 + f * g.al;
/** Middle of a fret's space (the open "fret" sits just outside the nut). */
const mid = (g: Geometry, f: number) => (f === 0 ? g.a0 - (g.vertical ? 24 : 17) : g.a0 + (f - 0.5) * g.al);

/**
 * The neck (docs/chord-lab-prd.md L8, §6): open strings to the 15th fret with inlays, dots labelled by role or
 * note. Across the card from tablet up; standing upright on phones (low string on the left, like a chord box),
 * so labels stay readable and every fret is a full-size tap target. Mirrored for left-handed players.
 */
export function Neck({
  tuning,
  left,
  dots,
  faint = [],
  muted = [],
  onTap,
  label,
  frets = MAX_FRET,
}: {
  tuning: TuningId;
  left: boolean;
  dots: NeckDot[];
  /** Small dots behind (the scale). */
  faint?: { string: number; fret: number }[];
  /** Strings marked × at the nut. */
  muted?: number[];
  /** Makes every fret tappable (Name that chord). */
  onTap?: (string: number, fret: number) => void;
  label: string;
  frets?: number;
}) {
  const horizontal: Geometry = { W: 760, a0: 50, al: (760 - 50 - 12) / frets, c0: 20, cs: 32, r: 11, rs: 13, fs: 14, H: 222, vertical: false };
  const vertical: Geometry = { W: 300, a0: 72, al: 44, c0: 46, cs: 44, r: 13, rs: 15, fs: 15, H: 72 + frets * 44 + 16, vertical: true };
  return (
    <>
      <div className="hidden tablet:block">{draw(horizontal)}</div>
      <div className="mx-auto max-w-[360px] tablet:hidden">{draw(vertical)}</div>
    </>
  );

  function draw(g: Geometry) {
    const P = (a: number, c: number) => {
      let x = g.vertical ? c : a;
      const y = g.vertical ? a : c;
      if (left) x = g.W - x;
      return [x, y] as const;
    };
    const strings = getTuning(tuning).strings;
    const between = (k: number) => (across(g, k) + across(g, k + 1)) / 2;
    const inlay = (f: number, c: number) => {
      const [x, y] = P(mid(g, f), c);
      return <circle key={`i${f}-${c}`} cx={x} cy={y} r={5} className="fill-line-strong" />;
    };
    const fretLine = (f: number) => {
      const [x1, y1] = P(along(g, f), across(g, 0));
      const [x2, y2] = P(along(g, f), across(g, 5));
      return <line key={`f${f}`} x1={x1} y1={y1} x2={x2} y2={y2} className={f === 0 ? "stroke-text-primary" : "stroke-line-strong"} strokeWidth={f === 0 ? 4 : 1.5} />;
    };
    const stringLine = (s: number) => {
      const [x1, y1] = P(along(g, 0), across(g, s));
      const [x2, y2] = P(along(g, frets), across(g, s));
      return <line key={`s${s}`} x1={x1} y1={y1} x2={x2} y2={y2} className="stroke-text-muted" strokeWidth={1 + (5 - s) * 0.25} />;
    };
    const text = (a: number, c: number, t: string, cls: string, key: string) => {
      const [x, y] = P(a, c);
      return (
        <text key={key} x={x} y={y} fontSize={g.fs} textAnchor="middle" dominantBaseline="central" className={`font-mono ${cls}`}>
          {t}
        </text>
      );
    };
    // Fret numbers sit beside the low string (vertical) or under the neck (horizontal).
    const numberAt = g.vertical ? across(g, 0) - 28 : across(g, 0) + 22;
    return (
      <svg viewBox={`0 0 ${g.W} ${g.H}`} className="h-auto w-full" role="img" aria-label={label} data-neck={g.vertical ? "vertical" : "horizontal"}>
        {[3, 5, 7, 9, 15].filter((f) => f <= frets).map((f) => inlay(f, between(2)))}
        {frets >= 12 && [inlay(12, between(1)), inlay(12, between(3))]}
        {Array.from({ length: frets + 1 }, (_, f) => fretLine(f))}
        {[0, 1, 2, 3, 4, 5].map(stringLine)}
        {[3, 5, 7, 9, 12, 15].filter((f) => f <= frets).map((f) => text(mid(g, f), numberAt, String(f), "fill-text-faint", `n${f}`))}
        {strings.map((st, s) => text(g.vertical ? 16 : 12, across(g, s), st.name, "fill-text-faint", `l${s}`))}
        {faint.map(({ string: s, fret: f }) => {
          const [x, y] = P(mid(g, f), across(g, s));
          return <circle key={`p${s}-${f}`} cx={x} cy={y} r={g.vertical ? 4 : 3.5} className="fill-line-strong" />;
        })}
        {muted.map((s) => text(mid(g, 0), across(g, s), "×", "fill-text-faint", `x${s}`))}
        {onTap &&
          strings.flatMap((_, s) =>
            Array.from({ length: frets + 1 }, (_, f) => {
              const [cx, cy] = P(mid(g, f), across(g, s));
              const alongSize = f === 0 ? (g.vertical ? 44 : 32) : g.al;
              const w = g.vertical ? g.cs : alongSize;
              const h = g.vertical ? alongSize : g.cs;
              return (
                <rect
                  key={`t${s}-${f}`}
                  data-tap={`${s}:${f}`}
                  x={cx - w / 2}
                  y={cy - h / 2}
                  width={w}
                  height={h}
                  className="cursor-pointer fill-transparent hover:fill-accent/10"
                  onClick={() => onTap(s, f)}
                />
              );
            }),
          )}
        {dots.map((d) => {
          const [cx, cy] = P(mid(g, d.fret), across(g, d.string));
          return (
            <g key={`d${d.string}-${d.fret}`} pointerEvents="none" data-dot={`${d.string}:${d.fret}`}>
              <circle cx={cx} cy={cy} r={d.filled ? g.rs : g.r} className={d.filled ? FILL[d.color] : `fill-surface ${STROKE[d.color]}`} strokeWidth={2} />
              <text x={cx} y={cy} fontSize={g.fs} textAnchor="middle" dominantBaseline="central" className={`font-mono font-bold ${d.filled ? ON[d.color] : "fill-text-primary"}`}>
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
    );
  }
}
