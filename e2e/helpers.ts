import { type Page } from "@playwright/test";

/** What the page last asked the audio engine to play (lib/audio/engine.ts), or null when stopped. */
type Cell = { notes: number[]; cells: number; velocity: number; palmMuted: boolean } | null;
export type Playback = {
  bars: { feel: string; cells: Cell[]; lead?: Cell[]; drums?: boolean }[];
  bpm: number;
  loop: boolean;
  /** A bar of count-in clicks first (the transport's COUNT-IN). */
  countIn?: boolean;
} | null;

export async function lastPlayback(page: Page): Promise<Playback> {
  return page.evaluate(() => (window as unknown as { __palmMuteLastPlayback?: Playback }).__palmMuteLastPlayback ?? null);
}

export const section = (page: Page, label: string) => page.locator(`section[aria-label="${label}"]`);
export const key = (page: Page, name: string) => page.getByRole("radiogroup", { name: "Key" }).getByRole("radio", { name, exact: true });
export const feel = (page: Page, name: RegExp) => page.getByRole("radiogroup", { name: "Feel" }).getByRole("radio", { name });

/** The six string rows of each line of a section's rendered tab (SVG), as text (long tabs expanded first). */
export async function tabRows(page: Page, label: string): Promise<string[][]> {
  const more = page.locator(`section[aria-label="${label}"]`).getByRole("button", { name: /^Show all \d+ bars$/ });
  if (await more.count()) await more.click();
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

/** Problems inside `root` (the responsive gates): controls under 44px, text under 12px, sideways scroll, clipped text. */
export async function layoutProblems(page: Page, root: string): Promise<string[]> {
  return page.locator(root).evaluateAll((roots) => {
    const out: string[] = [];
    const name = (el: Element) => `${el.tagName.toLowerCase()}${el.getAttribute("aria-label") ? `[${el.getAttribute("aria-label")}]` : ""} "${(el.textContent ?? "").trim().slice(0, 30)}"`;
    for (const root of roots) {
      for (const el of root.querySelectorAll<HTMLElement>("button, input, [role=radio], a[href]")) {
        const r = el.getBoundingClientRect();
        if (!r.width || getComputedStyle(el).visibility === "hidden") continue;
        // A stretched row button (the whole progression row) is as big as its row.
        if (r.width < 43.5 || r.height < 43.5) out.push(`small control ${Math.round(r.width)}×${Math.round(r.height)}: ${name(el)}`);
      }
      for (const el of root.querySelectorAll<HTMLElement>("*")) {
        // Tab art and screen-reader-only text are hidden on purpose.
        if (el.closest("svg, [aria-hidden='true'], .sr-only")) continue;
        const text = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim());
        const style = getComputedStyle(el);
        if (text && el.getBoundingClientRect().width && parseFloat(style.fontSize) < 12) out.push(`text ${style.fontSize}: ${name(el)}`);
        if ((style.overflowX === "auto" || style.overflowX === "scroll") && el.scrollWidth > el.clientWidth + 1) out.push(`scrolls sideways: ${name(el)}`);
        if (text && style.overflow === "hidden" && el.scrollWidth > el.clientWidth + 1) out.push(`clipped: ${name(el)}`);
      }
    }
    return out;
  });
}
