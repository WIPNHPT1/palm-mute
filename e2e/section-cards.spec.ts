import { expect, gotoAndSettle, lightOnly, projectWidth, test } from "./fixtures";
import { lastPlayback, pageZoom, parseTab, playedCells, section, tabRows } from "./helpers";

// Full-width section cards (docs/song-builder-prd.md B5): the tab is a songbook (bar numbers, rhythm stems,
// repeat marks) at (nearly) its real 12px size, 2 bars to a line on phones and 4 from tablet up; long tabs show
// their first two lines until expanded; options start collapsed.
test.describe("section cards", () => {
  test("tabs: 2 bars a line on phones, 4 from tablet up, drawn at their own size", async ({ page }, info) => {
    lightOnly(info);
    await gotoAndSettle(page, "/generator/");
    const phone = projectWidth(info) < 834;
    // The Chorus plays 8-cell bars at seed 0: count the bars on its first line by its bar numbers.
    const lines = await section(page, "Chorus").locator("svg[data-tab]").evaluate((svg) => {
      const numbers = [...svg.querySelectorAll('text[data-row="number"]')].map((t) => Number(t.getAttribute("y")));
      return [...new Set(numbers)].map((y) => numbers.filter((n) => n === y).length);
    });
    expect(lines[0]).toBe(phone ? 2 : 4);
    // Bars are numbered from 1, in order.
    const numbers = await section(page, "Chorus").locator('svg[data-tab] text[data-row="number"]').allTextContents();
    expect(numbers.map(Number)).toEqual(numbers.map((_, i) => i + 1));
    // Every card's tab is drawn at 12px (1:1) unless it had to shrink to fit; none scrolls sideways.
    const scales = await page.locator("[data-sections] svg[data-tab]").evaluateAll((svgs) =>
      svgs.map((svg) => ({ scale: svg.getBoundingClientRect().width / (svg as SVGSVGElement).viewBox.baseVal.width, overflow: svg.parentElement!.scrollWidth - svg.parentElement!.clientWidth })),
    );
    // (On big screens the whole page is zoomed, the tabs with it: 12px is then 12px × the zoom.)
    const zoom = await pageZoom(page);
    for (const s of scales) {
      expect(s.scale).toBeLessThanOrEqual(1.001 * zoom);
      expect(s.overflow).toBeLessThanOrEqual(zoom > 1 ? 1 : 0); // zoomed boxes can round by a pixel
    }
    // From tablet up a 4-bar line fits at (nearly) full size: at 834px two-digit frets may shrink it a little.
    if (!phone) for (const s of scales) expect(s.scale).toBeGreaterThan(0.9 * zoom);
  });

  test("the tab shows rhythm stems under every strum, and repeat marks on the Verse", async ({ page }, info) => {
    lightOnly(info);
    await gotoAndSettle(page, "/generator/");
    const chorus = section(page, "Chorus");
    // Every sounding cell of the tab has a stem under it.
    const tab = parseTab(await tabRows(page, "Chorus"));
    const attacks = tab.flat().filter((c) => c !== null).length;
    // (Stems are the only vertical lines in the drawing's rhythm band: one per attack.)
    const stems = await chorus.locator("svg[data-tab] line[y1][y2]").evaluateAll((ls) => ls.filter((l) => l.getAttribute("x1") === l.getAttribute("x2")).length);
    expect(stems).toBe(attacks);
    // The Verse plays its bars twice: repeat dots and "×2".
    const verse = section(page, "Verse");
    const more = verse.getByRole("button", { name: /^Show all/ });
    if (await more.count()) await more.click();
    await expect(verse.locator('svg[data-tab] text[data-row="repeat"]')).toHaveText("×2");
    expect(await verse.locator("svg[data-tab] circle").count()).toBe(4);
  });

  test("long tabs show their first two lines until expanded", async ({ page }, info) => {
    lightOnly(info);
    await gotoAndSettle(page, "/generator/");
    const solo = section(page, "Solo");
    const strings = () => solo.locator('svg[data-tab] text[data-row="string"]').count();
    if (projectWidth(info) >= 834) {
      // 8 bars fit two lines of 4: nothing to expand.
      expect(await strings()).toBe(12);
      await expect(solo.getByRole("button", { name: /^Show all/ })).toHaveCount(0);
      return;
    }
    expect(await strings()).toBe(12); // 2 lines × 6 strings = 4 bars
    const toggle = solo.getByRole("button", { name: "Show all 8 bars" });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();
    expect(await strings()).toBe(24);
    await solo.getByRole("button", { name: "Show the first two lines" }).click();
    expect(await strings()).toBe(12);
    // Screen readers always hear the whole solo.
    await expect(solo.locator("p.sr-only")).toContainText("Bar 8");
  });

  test("each card says where it plays and when, and plays what it shows", async ({ page }, info) => {
    lightOnly(info);
    test.skip(![390, 1440].includes(projectWidth(info)), "behaviour, not layout");
    await gotoAndSettle(page, "/generator/");
    const verse = section(page, "Verse");
    await expect(verse.locator("[data-uses]")).toContainText("Verse 1 ×2 · 0:21");
    await expect(verse.locator("[data-uses]")).toContainText("Verse 2 ×2 · adds a push");
    await expect(verse.locator('[role="group"][aria-label="Verse chords"] [data-chip]')).toHaveCount(4);
    await verse.getByRole("button", { name: "Play Verse" }).click();
    const pb = (await lastPlayback(page))!;
    const tab = parseTab(await tabRows(page, "Verse"));
    playedCells(pb).forEach((bar, i) => expect(bar).toEqual(tab[i % tab.length]));
    await verse.getByRole("button", { name: "Stop Verse" }).click();
    // Options start collapsed.
    await expect(page.locator("[data-options-panel]")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /options$/ })).toHaveCount(7);
  });
});
