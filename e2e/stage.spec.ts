import { expect, gotoAndSettle, lightOnly, onlyAtWidths, openMenu, projectWidth, test } from "./fixtures";

// The stage pack (docs/mockups/stage-options.html, owner's picks 2026-10-05): the Generator and the Chord Lab zoom
// with the screen from 1600px and get fretboard rails in the gutters and a moving background; a strings menu button;
// split-flap card titles; a shutter wipe between pages.

test.describe("stage: zoom, rails and background", () => {
  for (const [path, kind] of [["/generator/", "osc"], ["/chords/", "strings"]] as const) {
    test(`${path}: zooms from 1600px, rails in the gutters, the ${kind} background behind the page`, async ({ page }, info) => {
      lightOnly(info);
      await gotoAndSettle(page, path);
      const w = projectWidth(info);
      const zoom = await page.evaluate(() => getComputedStyle(document.querySelector("[data-zoom]")!).zoom);
      const expected = w < 1600 ? 1 : Math.min(1.4, w / 1600);
      expect(Number(zoom), "page zoom").toBeCloseTo(expected, 2);
      // Rails only where the gutters are wide (1600px and up), each exactly the gutter, never clickable.
      const rails = await page.locator("[data-stage-rails] .stage-rail").evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { display: getComputedStyle(e).display, x: r.x, w: r.width, pe: getComputedStyle(e).pointerEvents }; }));
      expect(rails).toHaveLength(2);
      if (w >= 1600) {
        const header = (await page.locator("header .mx-auto").first().boundingBox())!;
        expect(rails[0].display).toBe("block");
        expect(rails[0].x).toBe(0);
        expect(rails[0].w).toBeGreaterThan(100);
        expect(rails[0].w).toBeLessThanOrEqual(header.x + 1); // never under the page
        expect(rails[1].x).toBeGreaterThanOrEqual(header.x + header.width - 1);
        expect(rails[0].pe).toBe("none");
      } else for (const r of rails) expect(r.display).toBe("none");
      // The background: drawn from tablet up, under the top bar, behind the page.
      const bg = page.locator(`canvas[data-stage-bg="${kind}"]`);
      await expect(bg).toHaveCount(1);
      const bgState = await bg.evaluate((c: HTMLCanvasElement) => ({ display: getComputedStyle(c).display, top: c.getBoundingClientRect().top, z: getComputedStyle(c).zIndex, pe: getComputedStyle(c).pointerEvents }));
      if (w < 834) expect(bgState.display).toBe("none");
      else {
        expect(bgState.display).toBe("block");
        expect(bgState.pe).toBe("none");
        const bar = (await page.locator("header").boundingBox())!;
        expect(Math.abs(bgState.top - (bar.y + bar.height))).toBeLessThan(2);
      }
    });
  }

  test("the home page never zooms and has no stage layer", async ({ page }, info) => {
    onlyAtWidths(info, [1920]);
    lightOnly(info);
    await gotoAndSettle(page, "/");
    expect(await page.locator("[data-zoom]").count()).toBe(0);
    await expect(page.locator("[data-stage-rails], canvas.stage-bg")).toHaveCount(0);
  });

  test("the rails' strings shimmer while a song plays", async ({ page }, info) => {
    onlyAtWidths(info, [1920]);
    lightOnly(info);
    await gotoAndSettle(page, "/generator/");
    await expect(page.locator("[data-stage-rails]")).toHaveAttribute("data-playing", "false");
    await page.getByRole("button", { name: "PLAY SONG" }).click();
    await expect(page.locator("[data-stage-rails]")).toHaveAttribute("data-playing", "true");
    await page.getByRole("button", { name: "STOP SONG" }).click();
    await expect(page.locator("[data-stage-rails]")).toHaveAttribute("data-playing", "false");
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
  test("the menu button is three strings that cross into a close mark", async ({ page }, info) => {
    onlyAtWidths(info, [390, 1440]);
    lightOnly(info);
    await gotoAndSettle(page, "/generator/");
    const icon = page.locator("header .string-icon");
    await expect(icon.locator("> span")).toHaveCount(3);
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
