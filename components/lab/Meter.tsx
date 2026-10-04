/**
 * A vibe meter (Builder and Mood map): the label, a segmented track like a tape deck's level meter with a glossy
 * fill that eases to its value, and a small tag riding the end of the fill. `value` is 0 to 1; `head` (default the
 * label) is the line above, `words` the line below. Read by screen readers as a meter.
 */
export function Meter({ label, value, head, words, showValue = true }: { label: string; value: number; head?: string; words?: string; showValue?: boolean }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex min-w-0 flex-col gap-[4px] font-mono text-[12px] text-text-muted" style={{ "--v": `${pct}%` } as React.CSSProperties}>
      <span>{head ?? label}</span>
      <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="sig-meter">
        {showValue && (
          <span className="sig-meter-val" aria-hidden="true">
            {pct}%
          </span>
        )}
        <i />
      </div>
      {words && <span>{words}</span>}
    </div>
  );
}
