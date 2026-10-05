"use client";

import { type ReactNode, useEffect, useState } from "react";
import { FlapText } from "@/components/FlapText";

export type LabTool = { id: string; n: number; title: string; hint: string };

/** A Chord Lab tool: a full-width card in the Generator's section style, numbered, with a one-line hint. */
export function ToolCard({ tool, children }: { tool: LabTool; children: ReactNode }) {
  return (
    <section
      id={tool.id}
      aria-labelledby={`${tool.id}-title`}
      data-tool={tool.id}
      className="sig-card sig-rise min-w-0 scroll-mt-[96px] rounded-outer border-[1.5px] border-line bg-surface"
      style={{ "--i": tool.n - 1 } as React.CSSProperties}
    >
      <div className="sig-card-hd flex flex-wrap items-baseline gap-x-[10px] gap-y-[4px] px-[16px] pt-[14px] tablet:px-[20px]">
        <span className="sig-num font-mono text-[12px] font-bold">{String(tool.n).padStart(2, "0")}</span>
        <h2 id={`${tool.id}-title`} className="font-display text-[18px] leading-tight">
          <FlapText text={tool.title} />
        </h2>
        <span className="font-mono text-[12px] text-text-faint">{tool.hint}</span>
      </div>
      <div className="flex flex-col gap-[16px] px-[16px] pb-[18px] pt-[14px] tablet:px-[20px]">{children}</div>
    </section>
  );
}

/** The strip of tools under the setup: jump to any card; the one you're in is marked and follows the scroll. */
export function ToolStrip({ tools }: { tools: LabTool[] }) {
  const [current, setCurrent] = useState(tools[0]?.id ?? "");
  useEffect(() => {
    // The tool in view is the last one whose top has reached the upper part of the screen.
    let frame = 0;
    const update = () => {
      frame = 0;
      let on = tools[0]?.id ?? "";
      for (const t of tools) {
        const el = document.getElementById(t.id);
        if (el && el.getBoundingClientRect().top <= window.innerHeight * 0.35) on = t.id;
      }
      setCurrent(on);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [tools]);
  return (
    <nav aria-label="Lab tools" className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-[4px] relative rounded-outer glass-smoke bg-ink p-[6px]">
      {tools.map((t) => (
        <a
          key={t.id}
          href={`#${t.id}`}
          aria-current={current === t.id ? "true" : undefined}
          onClick={() => setCurrent(t.id)}
          className="sig-strip-link flex min-h-[44px] flex-col justify-center rounded-[5px] bg-ink-soft px-[10px] py-[5px] font-mono text-[12px] leading-[1.35] text-text-on-dark-muted hover:bg-ink-mid"
        >
          <b className="tabular-nums text-text-on-dark">
            {String(t.n).padStart(2, "0")} {t.title}
          </b>
          {t.hint}
          <svg className="w-[12px] h-[12px] sig-strip-arrow" viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 2v8M2.5 6.5 6 10l3.5-3.5" />
          </svg>
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
