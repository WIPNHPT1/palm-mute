"use client";

import { LockIcon } from "@/components/icons/LockIcon";
import { RegenerateIcon } from "@/components/icons/RegenerateIcon";
import { TabBlock } from "@/components/TabBlock";
import type { RenderedSection } from "@/lib/generator";

export function SectionCard({
  section,
  index,
  locked,
  highlighted,
  onRegenerate,
  onToggleLock,
  className = "",
}: {
  section: RenderedSection;
  index: number;
  locked: boolean;
  /** Chorus is always the highlighted card (open decision → recommended default). */
  highlighted: boolean;
  onRegenerate: () => void;
  onToggleLock: () => void;
  className?: string;
}) {
  // Numeral coloring is cosmetic (component-spec §2): accent on the first card and the highlighted one.
  const accentNumeral = index === 0 || highlighted;
  return (
    <section
      aria-label={section.label}
      className={`flex min-w-0 flex-col gap-[9px] rounded-outer bg-surface p-[14px] tablet:p-[12px] ${
        highlighted ? "border-[1.5px] border-accent shadow-card-highlight" : "border border-line shadow-card"
      } ${className}`}
    >
      <div className="flex items-baseline justify-between">
        <div className="flex items-baseline gap-[7px]">
          <div className={`font-mono text-[15px] font-bold ${accentNumeral ? "text-accent" : "text-text-disabled"}`}>
            {String(index + 1).padStart(2, "0")}
          </div>
          <h2 className="font-mono text-[10px] uppercase tracking-[0.06em] text-text-muted">{section.label}</h2>
        </div>
        <div className="flex items-center gap-[6px]">
          <button
            type="button"
            onClick={onRegenerate}
            disabled={locked}
            aria-label={locked ? `${section.label} is locked` : `Regenerate ${section.label}`}
            title={locked ? "Unlock to regenerate" : "Regenerate this section"}
            className="text-text-disabled enabled:hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RegenerateIcon />
          </button>
          <button
            type="button"
            onClick={onToggleLock}
            aria-pressed={locked}
            aria-label={locked ? `Unlock ${section.label}` : `Lock ${section.label}`}
            title={locked ? "Unlock" : "Lock"}
            className={locked ? "text-ink" : "text-text-disabled hover:text-text-muted"}
          >
            <LockIcon />
          </button>
        </div>
      </div>
      <TabBlock lines={section.tabLines} />
      {section.strum && (
        <div className="font-mono text-[10px] tracking-[3px] text-accent" aria-label="Strum pattern">
          {section.strum.join("")}
        </div>
      )}
      <div className="font-mono text-[9.5px] text-text-faint">
        {locked ? "Locked · " : ""}
        {section.caption}
      </div>
    </section>
  );
}
