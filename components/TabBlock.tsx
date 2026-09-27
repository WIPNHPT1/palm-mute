/** 6-line ASCII tab, pre-rendered by lib/generator.ts. */
export function TabBlock({ lines }: { lines: string[] }) {
  return (
    <pre className="overflow-x-auto whitespace-pre rounded-[5px] bg-paper p-[9px] font-mono text-[9px] leading-[1.6] text-text-primary">
      {lines.join("\n")}
    </pre>
  );
}
