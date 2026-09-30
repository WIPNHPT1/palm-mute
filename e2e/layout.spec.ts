import { ROUTES, expect, gotoAndSettle, horizontalOverflow, lightOnly, onlyAtWidths, test } from "./fixtures";

test.describe("layout", () => {
  test("section grid: 4 columns at 1280px, 2 at 1279px", async ({ page }, info) => {
    onlyAtWidths(info, [1440]);
    lightOnly(info);
    await page.goto("/generator/");
    const columns = () =>
      page.locator('section[aria-label="Intro"]').evaluate((el) => getComputedStyle(el.parentElement!).gridTemplateColumns.split(" ").length);
    await page.setViewportSize({ width: 1280, height: 900 });
    expect(await columns()).toBe(4); // seven parts: 4 + 3 (option A, DECISIONS.md)
    await page.setViewportSize({ width: 1279, height: 900 });
    expect(await columns()).toBe(2);
    await page.setViewportSize({ width: 833, height: 900 });
    expect(await columns()).toBe(1);
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
