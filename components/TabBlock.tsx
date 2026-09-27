/**
 * 6-line ASCII tab, pre-rendered by lib/generator.ts. The tab art is hidden from screen readers,
 * which read `spoken` (note and chord names) instead of rows of dashes.
 */
export function TabBlock({ lines, spoken }: { lines: string[]; spoken: string }) {
  return (
    <div>
      <pre aria-hidden="true" className="overflow-x-auto whitespace-pre rounded-[5px] bg-paper p-[9px] font-mono text-[9px] leading-[1.6] text-text-primary">
        {lines.join("\n")}
      </pre>
      <p className="sr-only">{spoken}</p>
    </div>
  );
}
