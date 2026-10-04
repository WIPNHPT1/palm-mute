import { type TuningId, type Voicing, describeShape, getTuning, roleOf } from "@/lib/lab/chords";

const GAP = 18; // between strings
const FRET = 20; // fret height
const X0 = 24; // first string (room for the start-fret number)
const TOP = 24; // nut (room for × and ○)
const W = X0 + 5 * GAP + 12;

/**
 * A chord box (docs/chord-lab-prd.md §6): six strings, four frets (five for a stretch), the start fret, × and
 * ○ over the nut, finger numbers in the dots (the root's dot in red) and the barre drawn across. Mirrored for
 * left-handed players. Spoken as the chord and each string's fret.
 */
export function ChordBox({ voicing, name, tuning, left, className = "" }: { voicing: Voicing; name: string; tuning: TuningId; left: boolean; className?: string }) {
  const { frets, fingers, barre, low, high } = voicing;
  const base = high <= 4 ? 1 : low;
  const rows = Math.max(4, high - base + 1);
  const H = TOP + rows * FRET + 8;
  const x = (s: number) => X0 + (left ? 5 - s : s) * GAP;
  const y = (f: number) => TOP + (f - base + 0.5) * FRET;
  const strings = getTuning(tuning).strings;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={`h-auto w-[126px] max-w-full ${className}`} role="img" aria-label={`${name}: ${describeShape(frets, tuning)}`}>
      {Array.from({ length: rows + 1 }, (_, j) => (
        <line key={`f${j}`} x1={X0} x2={X0 + 5 * GAP} y1={TOP + j * FRET} y2={TOP + j * FRET} className="stroke-text-faintest" strokeWidth={j === 0 && base === 1 ? 4 : 1} />
      ))}
      {frets.map((_, s) => (
        <line key={`s${s}`} x1={x(s)} x2={x(s)} y1={TOP} y2={TOP + rows * FRET} className="stroke-text-faintest" strokeWidth={1} />
      ))}
      {base > 1 && (
        <text x={left ? W - 4 : 4} y={TOP + FRET / 2} dominantBaseline="central" textAnchor={left ? "end" : "start"} className="fill-text-muted font-mono text-[12px]">
          {base}
        </text>
      )}
      {barre && (
        <rect
          x={Math.min(x(barre.from), x(barre.to)) - 7}
          y={y(barre.fret) - 7}
          width={Math.abs(x(barre.to) - x(barre.from)) + 14}
          height={14}
          rx={7}
          opacity={0.85}
          className="fill-text-primary"
        />
      )}
      {frets.map((f, s) => {
        if (f === null)
          return (
            <text key={s} x={x(s)} y={TOP - 11} textAnchor="middle" dominantBaseline="central" className="fill-text-muted font-mono text-[12px]">
              ×
            </text>
          );
        if (f === 0) return <circle key={s} cx={x(s)} cy={TOP - 11} r={4.5} fill="none" className="stroke-text-muted" strokeWidth={1.5} />;
        const root = roleOf(strings[s].midi + f - voicing.root, voicing.type) === "R";
        return (
          <g key={s}>
            <circle cx={x(s)} cy={y(f)} r={7.5} className={root ? "fill-accent" : "fill-text-primary"} />
            {fingers[s] ? (
              <text x={x(s)} y={y(f)} textAnchor="middle" dominantBaseline="central" className={`font-mono text-[12px] font-bold ${root ? "fill-text-on-accent" : "fill-surface"}`}>
                {fingers[s]}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
