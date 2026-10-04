import type { ReactNode } from "react";

/**
 * White labelled card that holds a Key / Feel / Sort control. Contents sit at the top, so when one card
 * in a row grows (Mid-Tempo's tempo row) every card's label stays on the same line. The Generator's setup
 * numbers its cards (`step`) and says what's picked (`picked`) and how to use it (`hint`) on the label line.
 */
export function ControlCard({
  label,
  children,
  className = "",
  step,
  picked,
  hint,
  id,
}: {
  label: string;
  children: ReactNode;
  className?: string;
  step?: number;
  picked?: string;
  hint?: string;
  id?: string;
}) {
  return (
    <div id={id} data-control={label} className={`flex scroll-mt-[96px] flex-col justify-start gap-[9px] sig-surface rounded-outer border border-line bg-surface px-[16px] py-[14px] tablet:px-[18px] ${className}`}>
      <div className="flex flex-wrap items-baseline gap-x-[8px] gap-y-[2px] font-mono text-[12px] uppercase tracking-[0.08em] text-text-faint">
        {step !== undefined && <span className="font-bold text-accent">{step}</span>}
        <span>{label}</span>
        {picked && <span className="normal-case tracking-normal font-bold text-text-primary">{picked}</span>}
        {hint && <span className="normal-case tracking-normal tablet:ml-auto">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
