import { expect, gotoAndSettle, lightOnly, onlyAtWidths, openMenu, projectWidth, test } from "./fixtures";

// The stage pack (docs/mockups/stage-options.html, owner's picks 2026-10-05): the Generator and the Chord Lab share
// one moving background (the oscilloscope, gutters included; the fretboard rails and the fluid zoom were dropped);
// a strings menu button; split-flap card titles; a shutter wipe between pages. Plus the design scale (2026-10-06):
// every page draws 10% smaller from a 1440px window.

test.describe("stage: design scale and background", () => {
  for (const path of ["/generator/", "/chords/"]) {
    test(`${path}: 90% from 1440px, never zoomed, the scope background behind the page and its gutters, no fretboard rails`, async ({ page }, info) => {
      lightOnly(info);
      await gotoAndSettle(page, path);
      const w = projectWidth(info);
      // The design scale: the top bar is 76px from tablet up, 90% of that from 1440px; no CSS zoom anywhere.
      const u = w >= 1440 ? 0.9 : 1;
      expect(await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--u")))).toBeCloseTo(u, 3);
      if (w >= 834) expect((await page.locator("header > div").first().boundingBox())!.height).toBeCloseTo(76 * u, 0);
      expect(await page.evaluate(() => [...document.querySelectorAll("*")].some((e) => getComputedStyle(e).zoom !== "1"))).toBe(false);
      // No fretboard rails in the gutters, at any width.
      await expect(page.locator("[data-stage-rails], .stage-rail, .stage-board")).toHaveCount(0);
      // The background: drawn from tablet up, under the top bar, behind the page.
      const bg = page.locator(`canvas[data-stage-bg="osc"]`);
      await expect(bg).toHaveCount(1);
      const bgState = await bg.evaluate((c: HTMLCanvasElement) => ({ display: getComputedStyle(c).display, top: c.getBoundingClientRect().top, z: getComputedStyle(c).zIndex, pe: getComputedStyle(c).pointerEvents }));
      if (w < 834) expect(bgState.display).toBe("none");
      else {
        expect(bgState.display).toBe("block");
        expect(bgState.pe).toBe("none");
        const bar = (await page.locator("header").boundingBox())!;
        expect(Math.abs(bgState.top - (bar.y + bar.height))).toBeLessThan(2);
        // Full width, so the gutters show the scope too.
        const bgBox = (await bg.boundingBox())!;
        expect(bgBox.x).toBe(0);
        expect(Math.abs(bgBox.width - (await page.evaluate(() => document.documentElement.clientWidth)))).toBeLessThan(2);
      }
    });
  }

  test("the home page draws at 90% from 1440px too, with the speakers up top and the same fixed scope lower down", async ({ page }, info) => {
    onlyAtWidths(info, [1920]);
    lightOnly(info);
    await gotoAndSettle(page, "/");
    expect((await page.locator("header > div").first().boundingBox())!.height).toBeCloseTo(76 * 0.9, 0);
    await expect(page.locator('canvas.stage-bg[data-stage-bg="osc"]')).toHaveCount(1);
    await expect(page.locator("canvas.hb-speaker")).toHaveCount(2);
  });

  test("the background actually draws (and draws a still frame with reduced motion)", async ({ page }, info) => {
    onlyAtWidths(info, [1440]);
    lightOnly(info);
    const inked = () => page.locator("canvas.stage-bg").evaluate((c: HTMLCanvasElement) => { const d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 16) if (d[i] > 0) n++; return n; });
    await gotoAndSettle(page, "/chords/");
    await expect.poll(inked).toBeGreaterThan(100);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await gotoAndSettle(page, "/generator/");
    await expect.poll(inked).toBeGreaterThan(100);
  });
});

test.describe("stage: menu button, titles and page change", () => {
  test("the menu button is rock horns that turn into a close mark", async ({ page }, info) => {
    onlyAtWidths(info, [390, 1440]);
    lightOnly(info);
    await gotoAndSettle(page, "/generator/");
    const icon = page.locator("header .horns-icon");
    await expect(icon.locator(".horns-hand path")).toHaveCount(5);
    await expect(icon.locator(".horns-x line")).toHaveCount(2);
    await openMenu(page);
    await expect(icon).toHaveAttribute("data-open", "true");
    await expect(page.getByRole("button", { name: "Close menu" })).toBeVisible();
  });

  test("card titles flip in the first time they're seen, and read as one word", async ({ page }, info) => {
    onlyAtWidths(info, [1440]);
    lightOnly(info);
    await gotoAndSettle(page, "/chords/");
    const title = page.locator('[data-tool="mood-map"] h2');
    await expect(title).toHaveText("Mood map");
    await expect(title.locator(".flap")).toHaveAttribute("data-flap", "wait");
    await title.scrollIntoViewIfNeeded();
    await expect(title.locator(".flap")).toHaveAttribute("data-flap", "go");
    await expect(page.locator('[data-tool="dictionary"] h2')).toHaveText("Dictionary");
    // Reduced motion: titles are just there.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await gotoAndSettle(page, "/chords/");
    expect(await page.locator(".flap[data-flap]").count()).toBe(0);
  });

  test("going to another page closes and opens the shutter; links within a page and reduced motion don't", async ({ page }, info) => {
    onlyAtWidths(info, [390, 1440]);
    lightOnly(info);
    await gotoAndSettle(page, "/generator/");
    const wipe = page.locator(".page-wipe");
    await expect(wipe).toHaveAttribute("data-phase", "idle");
    await expect(wipe).toHaveCSS("pointer-events", "none");
    await openMenu(page);
    await page.locator("#site-menu").getByRole("link", { name: /Chord Lab/ }).click();
    await expect(wipe).toHaveAttribute("data-phase", "cover");
    await expect(page).toHaveURL(/\/chords\/$/);
    await expect(wipe).toHaveAttribute("data-phase", "idle", { timeout: 4000 });
    // A link to a place on the same page: no shutter.
    await page.getByRole("navigation", { name: "Lab tools" }).getByRole("link", { name: /Mood map/ }).click();
    await expect(page).toHaveURL(/#mood-map$/);
    await expect(wipe).toHaveAttribute("data-phase", "idle");
    // Reduced motion: a plain page change.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openMenu(page);
    await page.locator("#site-menu").getByRole("link", { name: /Generator/ }).click();
    await expect(page).toHaveURL(/\/generator\/$/);
    await expect(wipe).toHaveAttribute("data-phase", "idle");
  });
});
