import { expect, gotoAndSettle, horizontalOverflow, projectWidth, test } from "./fixtures";
import { layoutProblems as problems, designUnit } from "./helpers";

// The responsive gate for the song builder (docs/song-builder-prd.md B12). Runs in every project: Chromium
// and WebKit, 320–1920px, light and dark. Each phase that adds builder UI extends it. Hard rules, measured:
// no sideways scroll on the page or inside the builder; every control at least 44×44px; no text under 12px
// (tab art excepted: it's hidden behind a spoken alternative); nothing clipped.

test.describe("song builder: every screen", () => {
  test("the setup fits and every control is usable", async ({ page }) => {
    await gotoAndSettle(page, "/generator/");
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    expect(await problems(page, "[data-setup]")).toEqual([]);
    // Every setup card stays inside the page.
    const cards = await page.locator("[data-setup] [data-control]").evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => ({ left: r.left, right: r.right })));
    expect(cards).toHaveLength(5); // the style preset, then the four steps
    for (const c of cards) expect(c.left >= 0 && c.right <= (await page.evaluate(() => innerWidth)) + 0.5).toBe(true);
    // Key and Feel side by side from 1440px; stacked below.
    const [keyBox, feelBox] = await Promise.all(["Key", "Feel"].map((l) => page.locator(`[data-setup] [data-control="${l}"]`).boundingBox()));
    if (projectWidth(test.info()) >= 1440) expect(Math.abs(keyBox!.y - feelBox!.y)).toBeLessThan(2);
    else expect(feelBox!.y).toBeGreaterThan(keyBox!.y + keyBox!.height - 1);
    // The Chords step: one column of progressions on phones, two from tablet up.
    const rows = await page.locator("[data-setup] [data-progression]").evaluateAll((els) => new Set(els.map((e) => Math.round(e.getBoundingClientRect().left))).size);
    expect(rows).toBe(projectWidth(test.info()) < 834 ? 1 : 2);
  });

  test("the built song and the folded setup fit", async ({ page }) => {
    await gotoAndSettle(page, "/generator/");
    await page.getByRole("button", { name: "BUILD SONG" }).click();
    await expect(page.locator("[data-setup-summary]")).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    expect(await problems(page, "[data-setup-summary]")).toEqual([]);
    expect(await problems(page, "[data-song-header]")).toEqual([]);
    expect(await problems(page, "[data-form-strip]")).toEqual([]);
  });

  test("the longest song (5:30, Extended) still fits: the running order wraps", async ({ page }) => {
    await gotoAndSettle(page, "/generator/");
    await page.getByRole("slider", { name: "Song length" }).fill("330");
    await expect(page.locator("[data-song-header]")).toContainText("Extended");
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    expect(await problems(page, "[data-form-strip]")).toEqual([]);
    expect(await problems(page, "[data-length]")).toEqual([]);
    // Every part of the running order stays inside the strip.
    const inside = await page.locator("[data-form-strip] ol").evaluate((ol) => {
      const box = ol.getBoundingClientRect();
      return [...ol.querySelectorAll("li")].every((li) => { const r = li.getBoundingClientRect(); return r.left >= box.left - 0.5 && r.right <= box.right + 0.5; });
    });
    expect(inside).toBe(true);
  });

  test("full-width section cards and every options tab fit", async ({ page }) => {
    test.slow(); // every tab of seven panels, measured each time
    await gotoAndSettle(page, "/generator/");
    expect(await problems(page, "[data-sections]")).toEqual([]);
    for (const button of await page.locator("[data-options-button]").all()) await button.click();
    await expect(page.locator("[data-options-panel]")).toHaveCount(7);
    // Every tab of every panel, one at a time across the cards.
    for (const tab of ["STRUCTURE", "DRUMS", "STYLE", "RHYTHM"]) {
      for (const t of await page.locator("[data-options-panel] [role=tab]").filter({ hasText: tab }).all()) await t.click();
      expect(await horizontalOverflow(page), tab).toBeLessThanOrEqual(0);
      expect(await problems(page, "[data-sections]"), tab).toEqual([]);
    }
  });

  test("the export cards fit", async ({ page }) => {
    await gotoAndSettle(page, "/generator/");
    await page.locator("[data-export-section]").scrollIntoViewIfNeeded();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    expect(await problems(page, "[data-export-section]")).toEqual([]);
    // One column on phones, two from tablet up (they share one row when both fit).
    const cards = await page.locator("[data-export-section] [data-export]").evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => ({ left: r.left, right: r.right })));
    for (const c of cards) expect(c.right).toBeLessThanOrEqual((await page.evaluate(() => innerWidth)) + 0.5);
  });

  test("the transport is one row and fits", async ({ page }) => {
    await gotoAndSettle(page, "/generator/");
    expect(await problems(page, "[data-transport]")).toEqual([]);
    // One row: every control's middle on one line, and the bar no taller than its controls need.
    const box = (await page.locator("[data-transport]").boundingBox())!;
    expect(box.height).toBeLessThanOrEqual(72 * (await designUnit(page)));
    expect(box.x).toBe(0);
    expect(Math.round(box.width)).toBe(await page.evaluate(() => document.documentElement.clientWidth));
  });

  test("from the final sweep: the length marks never collide, and each export button sits with its controls", async ({ page }) => {
    await gotoAndSettle(page, "/generator/");
    for (const len of ["150", "240", "330"]) {
      await page.getByRole("slider", { name: "Song length" }).fill(len);
      const boxes = await page.locator("[data-length] .text-brass").evaluateAll((els) =>
        els.filter((e) => e.getClientRects().length).map((e) => e.getBoundingClientRect()).map((r) => [r.left, r.right] as const),
      );
      for (let i = 1; i < boxes.length; i++) expect(boxes[i][0], `${len}s: marks ${i} and ${i + 1} overlap`).toBeGreaterThanOrEqual(boxes[i - 1][1] - 0.5);
    }
    // From tablet up, DOWNLOAD PDF shares its row with the paper switch, as DOWNLOAD MIDI does with its switch.
    if (projectWidth(test.info()) >= 834) {
      const [btn, sw] = await Promise.all([page.getByRole("button", { name: "DOWNLOAD PDF" }).boundingBox(), page.getByRole("radiogroup", { name: "Paper size" }).boundingBox()]);
      expect(Math.abs(btn!.y + btn!.height / 2 - (sw!.y + sw!.height / 2))).toBeLessThan(4);
    }
  });
});
