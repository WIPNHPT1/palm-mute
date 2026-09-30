import { ROUTES, expect, gotoAndSettle, horizontalOverflow, lightOnly, onlyAtWidths, test } from "./fixtures";

test.describe("layout", () => {
  test("section cards: one per row, full width, at every size", async ({ page }, info) => {
    onlyAtWidths(info, [1440]);
    lightOnly(info);
    await page.goto("/generator/");
    for (const width of [1920, 1280, 1279, 834, 833, 390]) {
      await page.setViewportSize({ width, height: 900 });
      const boxes = await page.locator("[data-sections] > section").evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => ({ left: r.left, width: r.width, top: r.top })));
      expect(boxes).toHaveLength(7);
      // Same left edge and width for all seven, stacked (docs/song-builder-prd.md B5).
      expect(new Set(boxes.map((b) => Math.round(b.left))).size, `${width}px`).toBe(1);
      expect(new Set(boxes.map((b) => Math.round(b.width))).size, `${width}px`).toBe(1);
      for (let i = 1; i < boxes.length; i++) expect(boxes[i].top).toBeGreaterThan(boxes[i - 1].top);
    }
  });

  for (const route of ROUTES) {
    test(`no horizontal overflow on ${route.path} at any scroll position`, async ({ page }) => {
      await gotoAndSettle(page, route.path);
      // Scroll through the page: sticky scenes and reveal effects mustn't push anything sideways.
      const height = await page.evaluate(() => document.documentElement.scrollHeight);
      for (const y of [0, height / 3, (2 * height) / 3, height]) {
        await page.evaluate((top) => window.scrollTo(0, top), y);
        await page.waitForTimeout(150);
        expect(await horizontalOverflow(page), `overflow at scrollY=${Math.round(y)}`).toBeLessThanOrEqual(0);
      }
    });
  }
});
