"use client";

/**
 * The song setup folded to one line after BUILD SONG (docs/song-builder-prd.md, mock-up
 * docs/mockups/song-builder.html). Each item reopens the setup at its step.
 */
export function SetupSummary({ items, onEdit }: { items: { step: number; label: string; value: string }[]; onEdit: (step: number) => void }) {
  return (
    <section aria-label="Song setup" data-setup-summary className="flex flex-wrap items-center gap-[6px] rounded-outer border border-line bg-surface p-[8px]">
      {items.map((it) => (
        <button
          key={it.label}
          type="button"
          onClick={() => onEdit(it.step)}
          aria-label={`${it.label}: ${it.value}. Edit`}
          className="flex min-h-[44px] flex-col justify-center sig-btn-2 px-[12px] py-[4px] text-left leading-[1.25] hover:border-text-faintest"
        >
          <span className="font-mono text-[12px] tracking-[0.08em] text-text-faint">{it.label.toUpperCase()}</span>
          <span className="font-mono text-[12px] font-bold">{it.value}</span>
        </button>
      ))}
      <button
        type="button"
        onClick={() => onEdit(0)}
        className="ml-auto flex min-h-[44px] items-center gap-[6px] sig-btn-2 px-[12px] font-mono text-[12px] font-bold hover:border-accent"
      >
        EDIT SETUP
      </button>
    </section>
  );
}
