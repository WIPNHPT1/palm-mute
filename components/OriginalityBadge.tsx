/**
 * What Palm/Mute stores, stated plainly (owner default, see DECISIONS.md): it writes from chord
 * patterns and never stores anyone's tabs. Replaces the old always-PASS "originality check".
 */
export function OriginalityBadge() {
  return (
    <div className="inline-flex items-center gap-[8px] self-start rounded-pill border border-line-strong py-[7px] pl-[10px] pr-[14px] font-mono text-[12px] text-text-muted tablet:self-auto">
      <span className="block h-[6px] w-[6px] shrink-0 rounded-full bg-success" aria-hidden="true" />
      CHORD PATTERNS ONLY · NO TABS STORED
    </div>
  );
}
