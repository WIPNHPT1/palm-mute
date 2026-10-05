import { expect, gotoAndSettle, horizontalOverflow, lightOnly, onlyAtWidths, test } from "./fixtures";

// The footer: end credits (docs/mockups/footer-options.html option 1), on every page.
test.describe("footer: end credits", () => {
  for (const [path, current] of [["/", "Home"], ["/generator/", "Song Generator"], ["/chords/", "Chord Lab"]] as const) {
    test(`${path}: the credits, the pages (this one marked) and GitHub`, async ({ page }, info) => {
      onlyAtWidths(info, [390, 1440]);
      await gotoAndSettle(page, path);
      const footer = page.locator("footer.credits");
      await expect(footer.locator("dt")).toContainText(["Written by", "In the key of", "Feel", "Chords", "Tuning", "Tabs stored"]);
      await expect(footer.locator(".as-written dd")).toHaveText("I – V – vi – IV");
      const nav = footer.getByRole("navigation", { name: "Footer" });
      await expect(nav.getByRole("link")).toHaveText(["Home", "Song Generator", "Chord Lab"]);
      await expect(nav.locator('[aria-current="page"]')).toHaveText(current);
      await expect(footer.getByRole("link", { name: /GitHub/ })).toHaveAttribute("href", "https://github.com/WIPNHPT1/palm-mute");
      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    });
  }

  test("the roll runs only on screen, and stands still with every credit showing for reduced motion", async ({ page }, info) => {
    onlyAtWidths(info, [1440]);
    lightOnly(info);
    await gotoAndSettle(page, "/chords/");
    const roll = page.locator(".credits-roll");
    await expect(roll).not.toHaveAttribute("data-rolling");
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    await expect(roll).toHaveAttribute("data-rolling", "");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await gotoAndSettle(page, "/chords/");
    expect(await page.locator(".credits-reel").evaluate((e) => getComputedStyle(e).animationName)).toBe("none");
    await page.locator("footer.credits").scrollIntoViewIfNeeded();
    await expect(page.locator(".credits-reel dd").last()).toBeInViewport();
  });
});
