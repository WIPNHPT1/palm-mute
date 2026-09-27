import type { ReactNode } from "react";

/** White labelled card that holds a Key / Feel / Sort control. */
export function ControlCard({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col justify-center gap-[9px] rounded-outer border border-line bg-surface px-[16px] py-[14px] tablet:px-[18px] ${className}`}>
      <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-faint">{label}</div>
      {children}
    </div>
  );
}
