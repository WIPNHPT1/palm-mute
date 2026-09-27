import { TAB_STRINGS, chordFor, type NoteName } from "@/lib/musicTheory";

// Layout (SVG units): string names | mute column | nut at x=80 | 104 units per fret, 5 frets shown.
const NUT_X = 80, FRET_W = 104, FRETS = 5, TOP = 54, GAP = 26;
const fretCentre = (f: number) => NUT_X + (f - 0.5) * FRET_W;
const stringY = (i: number) => TOP + i * GAP;
const THICKNESS = [1, 1.3, 1.7, 2.2, 2.8, 3.4];
const ordinal = (n: number) => `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}`;

/**
 * A two-note power chord shape, read from data/chord-library.json: root and fifth as fretted dots joined
 * by a bar, ✕ on the strings you don't play, and a legend in real text so it stays readable on phones.
 * Needs a voicing whose notes sit in frets 1–5 (G5: E string 3rd fret + A string 5th fret).
 */
export function PowerChordDiagram({ root }: { root: NoteName }) {
  const { name, chord } = chordFor(root);
  const rootIdx = TAB_STRINGS.indexOf(chord.rootString), fifthIdx = TAB_STRINGS.indexOf(chord.fifthString);
  const r = { x: fretCentre(chord.rootFret), y: stringY(rootIdx) }, fifth = { x: fretCentre(chord.fifthFret), y: stringY(fifthIdx) };
  const muted = TAB_STRINGS.filter((s) => s !== chord.rootString && s !== chord.fifthString);
  const endY = stringY(TAB_STRINGS.length - 1);

  return (
    <>
      <svg className="ci-neck" viewBox="0 0 620 232" aria-hidden="true">
        <text className="chord" x="612" y="30">{name}</text>
        <text className="chord-sub" x="552" y="30">POWER CHORD</text>
        <g className="names">{TAB_STRINGS.map((s, i) => <text key={s} x="6" y={stringY(i) + 5}>{s}</text>)}</g>
        {Array.from({ length: FRETS }, (_, i) => (
          <line key={i} className="fret" x1={NUT_X + FRET_W * (i + 1)} y1={TOP - 2} x2={NUT_X + FRET_W * (i + 1)} y2={endY + 2} />
        ))}
        <g className="strings">
          {TAB_STRINGS.map((s, i) => <line key={s} className="str" x1={NUT_X} y1={stringY(i)} x2="620" y2={stringY(i)} strokeWidth={THICKNESS[i]} />)}
        </g>
        <line className="nut" x1={NUT_X} y1={TOP - 3} x2={NUT_X} y2={endY + 3} />
        <g className="fretno">{Array.from({ length: FRETS }, (_, i) => <text key={i} x={fretCentre(i + 1)} y="226">{i + 1}</text>)}</g>
        {muted.map((s) => {
          const y = stringY(TAB_STRINGS.indexOf(s));
          return (
            <g key={s} className="mute" data-string={s}>
              <line x1="44" y1={y - 7} x2="58" y2={y + 7} /><line x1="58" y1={y - 7} x2="44" y2={y + 7} />
            </g>
          );
        })}
        <line className="bar" x1={r.x} y1={r.y} x2={fifth.x} y2={fifth.y} />
        {[{ key: "root", p: r, label: "R", b: "" }, { key: "fifth", p: fifth, label: "5", b: " b" }].map((m) => (
          <g key={m.key} className="mark" data-mark={m.key}>
            <circle className={`pulse${m.b}`} cx={m.p.x} cy={m.p.y} r="15" />
            <circle className="dot" cx={m.p.x} cy={m.p.y} r="15" />
            <text className="in-dot" x={m.p.x} y={m.p.y}>{m.label}</text>
          </g>
        ))}
      </svg>
      <ul className="ci-legend">
        <li><i className="ci-lg-dot" aria-hidden="true">R</i><b>Root</b> {chord.rootString} string, {ordinal(chord.rootFret)} fret</li>
        <li><i className="ci-lg-dot" aria-hidden="true">5</i><b>Fifth</b> {chord.fifthString} string, {ordinal(chord.fifthFret)} fret</li>
        <li><i className="ci-lg-x" aria-hidden="true" /><b>Muted</b> the other {muted.length === 4 ? "four" : muted.length} strings</li>
      </ul>
    </>
  );
}
