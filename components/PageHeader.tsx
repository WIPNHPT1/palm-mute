import type { ReactNode } from "react";

export function PageHeader({ kicker, title, aside }: { kicker: string; title: string; aside?: ReactNode }) {
  return (
    <div className="flex flex-col gap-[8px] tablet:flex-row tablet:flex-wrap tablet:items-end tablet:justify-between tablet:gap-[10px]">
      <div>
        {/* One line from tablet up, like the Generator's: Safari sizes this block without the ruler after the kicker, so a
            short title (CHORD LAB) left the kicker too little room and it wrapped */}
        <div className="sig-kicker mb-[7px] font-mono text-[12px] tracking-[0.13em] text-accent tablet:mb-[8px] tablet:whitespace-nowrap tablet:text-[12px] tablet:tracking-[0.14em]">{kicker}</div>
        <h1 className="sig-title font-display text-[25px] leading-[1.05] tablet:text-[30px] tablet:leading-none desktop:text-[34px]">{title}</h1>
      </div>
      {aside}
    </div>
  );
}
