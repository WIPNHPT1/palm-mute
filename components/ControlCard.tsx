import type { ReactNode } from "react";

/**
 * White labelled card that holds a Key / Feel / Sort control. Contents sit at the top, so when one card
 * in a row grows (Mid-Tempo's tempo row) every card's label stays on the same line.
 */
export function ControlCard({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div data-control={label} className={`flex flex-col justify-start gap-[9px] rounded-outer border border-line bg-surface px-[16px] py-[14px] tablet:px-[18px] ${className}`}>
      <div className="font-mono text-[12px] uppercase tracking-[0.08em] text-text-faint">{label}</div>
      {children}
    </div>
  );
}
