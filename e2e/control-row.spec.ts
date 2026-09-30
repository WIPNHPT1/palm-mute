import { type Page } from "@playwright/test";
import { expect, gotoAndSettle, test } from "./fixtures";
import { feel } from "./helpers";

// Picking Mid-Tempo adds a tempo row to the Feel card. It must not move or resize the other control
// cards, their labels stay on one line, and nothing spills out of its card.
type Box = { label: string; x: number; y: number; w: number; h: number; labelY: number; overflow: string[] };

async function controls(page: Page): Promise<Box[]> {
  return page.locator("[data-control]").evaluateAll((cards) =>
    cards.map((c) => {
      // Page coordinates: clicking a control can scroll the page on phones.
      const r = c.getBoundingClientRect();
      const label = c.firstElementChild!.getBoundingClientRect();
      const overflow = [...c.querySelectorAll("button, input")]
        .map((el) => ({ el, b: el.getBoundingClientRect() }))
        .filter(({ b }) => b.width && (b.left < r.left - 0.5 || b.right > r.right + 0.5 || b.bottom > r.bottom + 0.5))
        .map(({ el }) => el.getAttribute("aria-label") ?? el.textContent?.trim() ?? "?");
      return { label: c.getAttribute("data-control")!, x: Math.round(r.left), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height), labelY: Math.round(label.top + scrollY), overflow };
    }),
  );
}

for (const path of ["/chords/", "/generator/"]) {
  test(`${path}: Mid-Tempo doesn't push the other controls around`, async ({ page }) => {
    await gotoAndSettle(page, path);
    const before = await controls(page);
    await feel(page, /MID-TEMPO/).click();
    await expect(page.getByLabel("Mid-tempo BPM")).toBeVisible();
    const after = await controls(page);

    for (const card of after) expect(card.overflow, `${card.label} card: controls spill out`).toEqual([]);
    for (const b of before) {
      const a = after.find((c) => c.label === b.label)!;
      // The Feel card may only grow taller (its new row); nothing else changes place or width.
      expect({ x: a.x, w: a.w }, `${b.label} card moved or resized`).toEqual({ x: b.x, w: b.w });
      // (Cards stacked below the Feel card, on phones, naturally move down as it grows.)
      const feelTop = before.find((c) => c.label === "Feel")!.y;
      if (b.label !== "Feel" && b.y <= feelTop) expect(a.y, `${b.label} card moved down`).toBe(b.y);
    }
    // Cards on the same line keep their labels on one line.
    const rows = new Map<number, Box[]>();
    for (const c of after) rows.set(c.y, [...(rows.get(c.y) ?? []), c]);
    for (const row of rows.values()) expect(new Set(row.map((c) => c.labelY)).size, row.map((c) => c.label).join(", ")).toBe(1);
    // The live tempo is on the Mid-Tempo button (no duplicate readout) and still announced by the slider.
    await page.getByRole("button", { name: "Increase tempo" }).click();
    await expect(feel(page, /MID-TEMPO/)).toContainText("141 BPM");
    await expect(page.getByLabel("Mid-tempo BPM")).toHaveAttribute("aria-valuetext", "141 BPM");
  });
}
