import { type Page } from "@playwright/test";
import { expect, gotoAndSettle, lightOnly, test } from "./fixtures";

/** Right edge of each visible headline line vs the column it sits in (px; > 0 means it overflows). */
async function headlineOverflow(page: Page): Promise<number[]> {
  return page.locator(".ci-kin-wrap").evaluate((wrap) => {
    const col = wrap.getBoundingClientRect();
    return [...wrap.querySelectorAll<HTMLElement>(".ci-kl")]
      .filter((l) => l.offsetParent !== null)
      .map((l) => {
        const r = l.getBoundingClientRect();
        return Math.max(r.right - col.right, col.left - r.left);
      });
  });
}

test.describe("count in", () => {
  test("every headline line fits its column at every scroll position", async ({ page }, info) => {
    lightOnly(info);
    await gotoAndSettle(page, "/");
    const stageHeight = await page.locator(".ci-stage").evaluate((el) => (el as HTMLElement).offsetHeight);
    const lines = await headlineOverflow(page);
    expect(lines.length).toBe((info.project.use.viewport?.width ?? 0) < 834 ? 6 : 4);
    for (const k of [0, 0.25, 0.5, 0.75, 1]) {
      await page.evaluate((y) => window.scrollTo(0, y), k * stageHeight);
      await page.waitForTimeout(120);
      for (const [i, over] of (await headlineOverflow(page)).entries()) {
        expect(over, `line ${i + 1} at ${k * 100}% scroll`).toBeLessThanOrEqual(1);
      }
    }
  });

  test("the G5 diagram shows E string 3rd fret + A string 5th fret, other strings muted", async ({ page }, info) => {
    lightOnly(info);
    await page.goto("/");
    const neck = page.locator("svg.ci-neck");
    // Layout constants from PowerChordDiagram: nut x=80, 104 per fret, strings from y=54 every 26 (e first).
    const dot = (mark: string) =>
      neck.locator(`[data-mark="${mark}"] circle.dot`).evaluate((c) => [Number(c.getAttribute("cx")), Number(c.getAttribute("cy"))]);
    expect(await dot("root")).toEqual([80 + 2.5 * 104, 54 + 5 * 26]); // E string, fret 3
    expect(await dot("fifth")).toEqual([80 + 4.5 * 104, 54 + 4 * 26]); // A string, fret 5
    const muted = await neck.locator("g.mute").evaluateAll((gs) => gs.map((g) => g.getAttribute("data-string")));
    expect(muted.sort()).toEqual(["B", "D", "G", "e"].sort());
    await expect(neck.locator("text.chord")).toHaveText("G5");
    const legend = page.locator(".ci-legend");
    await expect(legend).toContainText("Root E string, 3rd fret");
    await expect(legend).toContainText("Fifth A string, 5th fret");
    await expect(legend).toContainText("Muted the other four strings");
  });

  test("all 90 titles fit on one line, with no repeats until all have been shown", async ({ page }, info) => {
    lightOnly(info);
    test.slow(); // 90 shuffles; CI's WebKit needs more than the default minute
    await page.emulateMedia({ reducedMotion: "reduce" }); // skip the flap animation so 90 shuffles are quick
    await gotoAndSettle(page, "/");
    const board = page.locator(".ci-flaps");
    await board.scrollIntoViewIfNeeded();
    const shuffle = page.getByRole("button", { name: "SHUFFLE" });
    const seen: string[] = [];
    for (let i = 0; i < 90; i++) {
      if (i > 0) {
        const prev = seen[seen.length - 1];
        await shuffle.click();
        await expect(board).not.toHaveAttribute("aria-label", prev);
      }
      const fit = await board.evaluate((el) => {
        const cells = [...el.querySelectorAll<HTMLElement>(".ci-fc")];
        const tops = new Set(cells.map((c) => Math.round(c.getBoundingClientRect().top)));
        const box = el.getBoundingClientRect();
        const right = Math.max(...cells.map((c) => c.getBoundingClientRect().right));
        return { title: el.getAttribute("aria-label")!, lines: tops.size, overflow: right - box.right, scroll: el.scrollWidth - el.clientWidth };
      });
      expect(fit.lines, `"${fit.title}" wraps`).toBe(1);
      expect(fit.overflow, `"${fit.title}" overflows`).toBeLessThanOrEqual(1);
      expect(fit.scroll, `"${fit.title}" scrolls`).toBeLessThanOrEqual(1);
      seen.push(fit.title);
    }
    expect(new Set(seen).size).toBe(90);
  });
});
