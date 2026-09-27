import { type Page } from "@playwright/test";

/** What the page last asked the audio engine to play (lib/audio/engine.ts), or null when stopped. */
type Cell = { notes: number[]; cells: number; velocity: number; palmMuted: boolean } | null;
export type Playback = {
  bars: { feel: string; cells: Cell[]; lead?: Cell[]; drums?: boolean }[];
  bpm: number;
  loop: boolean;
} | null;

export async function lastPlayback(page: Page): Promise<Playback> {
  return page.evaluate(() => (window as unknown as { __palmMuteLastPlayback?: Playback }).__palmMuteLastPlayback ?? null);
}

export const section = (page: Page, label: string) => page.locator(`section[aria-label="${label}"]`);
export const key = (page: Page, name: string) => page.getByRole("radiogroup", { name: "Key" }).getByRole("radio", { name, exact: true });
export const feel = (page: Page, name: RegExp) => page.getByRole("radiogroup", { name: "Feel" }).getByRole("radio", { name });

/** The six string rows of each line of a section's rendered tab (SVG), as text. */
export async function tabRows(page: Page, label: string): Promise<string[][]> {
  return page.locator(`section[aria-label="${label}"] svg[data-tab]`).evaluate((svg) => {
    const rows = [...svg.querySelectorAll('text[data-row="string"]')].map((t) => t.textContent ?? "");
    const groups: string[][] = [];
    for (let i = 0; i < rows.length; i += 6) groups.push(rows.slice(i, i + 6));
    return groups;
  });
}

const OPEN: Record<string, number> = { e: 64, B: 59, G: 55, D: 50, A: 45, E: 40 };

/** Reads tab rows back into cells: the MIDI notes a guitarist would play, "x" for dead strums, null for silence. */
export function parseTab(groups: string[][]): ({ notes: number[] } | "x" | null)[][] {
  const bars: ({ notes: number[] } | "x" | null)[][] = [];
  for (const g of groups) {
    const names = g.map((r) => r[0]);
    const rows = g.map((r) => r.slice(2));
    let start = 0;
    for (const end of [...rows[0]].flatMap((c, i) => (c === "|" ? [i] : []))) {
      const cells: ({ notes: number[] } | "x" | null)[] = [];
      for (let p = start; p < end; ) {
        // Fret numbers, "x" for dead strums, and lead marks: 5b7 (sounds the 7), h5, p3, /7, \\5, 7~.
        const runs = rows.map((r) => /^[0-9xbhp/\\~]*/.exec(r.slice(p, end))![0]);
        const notes = runs.flatMap((x, k) => {
          const nums = x.match(/\d+/g);
          return nums ? [OPEN[names[k]] + Number(nums[nums.length - 1])] : [];
        });
        cells.push(notes.length ? { notes: notes.sort((a, b) => a - b) } : runs.includes("x") ? "x" : null);
        p += Math.max(1, ...runs.map((x) => x.length)) + 1;
      }
      bars.push(cells);
      start = end + 1;
    }
  }
  return bars;
}

/** Playback bars reduced to the same shape as parseTab: the lead line when there is one (the tab shows the lead, not its backing). */
export function playedCells(pb: NonNullable<Playback>) {
  return pb.bars.map((b) =>
    (b.lead ?? b.cells).map((c) => (!c ? null : (c as { dead?: boolean }).dead ? "x" : { notes: [...c.notes].sort((x, y) => x - y) })),
  );
}
