import type { ReactNode } from "react";

export type LabTool = { id: string; n: number; title: string; hint: string };

/** A Chord Lab tool: a full-width card in the Generator's section style, numbered, with a one-line hint. */
export function ToolCard({ tool, children }: { tool: LabTool; children: ReactNode }) {
  return (
    <section
      id={tool.id}
      aria-labelledby={`${tool.id}-title`}
      data-tool={tool.id}
      className="min-w-0 scroll-mt-[96px] rounded-outer border-[1.5px] border-line bg-surface shadow-card"
    >
      <div className="flex flex-wrap items-baseline gap-x-[10px] gap-y-[4px] px-[16px] pt-[14px] tablet:px-[20px]">
        <span className="font-mono text-[15px] font-bold text-text-faint">{String(tool.n).padStart(2, "0")}</span>
        <h2 id={`${tool.id}-title`} className="font-display text-[18px] leading-tight">
          {tool.title}
        </h2>
        <span className="font-mono text-[12px] text-text-faint">{tool.hint}</span>
      </div>
      <div className="flex flex-col gap-[16px] px-[16px] pb-[18px] pt-[14px] tablet:px-[20px]">{children}</div>
    </section>
  );
}

/** The strip of tools under the setup: jump to any card. */
export function ToolStrip({ tools }: { tools: LabTool[] }) {
  return (
    <nav aria-label="Lab tools" className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-[4px] rounded-outer bg-ink p-[6px]">
      {tools.map((t) => (
        <a
          key={t.id}
          href={`#${t.id}`}
          className="flex min-h-[44px] flex-col justify-center rounded-[5px] bg-ink-soft px-[10px] py-[5px] font-mono text-[12px] leading-[1.35] text-text-on-dark-muted hover:bg-ink-mid"
        >
          <b className="text-text-on-dark">
            {String(t.n).padStart(2, "0")} {t.title}
          </b>
          {t.hint}
        </a>
      ))}
    </nav>
  );
}

/** Small uppercase label over a group of controls inside a tool. */
export function GroupLabel({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <div id={id} className="font-mono text-[12px] uppercase tracking-[0.08em] text-text-faint">
      {children}
    </div>
  );
}
