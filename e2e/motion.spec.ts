import { expect, gotoAndSettle, lightOnly, onlyAtWidths, test } from "./fixtures";

// Guards for the Count In page's motion costs (see the "smoother motion" PR): the effects look the same,
// but nothing may bring back continuous repaints, full-screen blending or live blur.
test.describe("count in motion stays cheap", () => {
  test("no full-screen blend or live blur; the spotlight moves by transform", async ({ page }, info) => {
    onlyAtWidths(info, [390, 1440]);
    await gotoAndSettle(page, "/");
    const styles = await page.evaluate(() => {
      const cs = (sel: string) => getComputedStyle(document.querySelector(sel)!);
      return {
        grainBlend: cs(".ci-grain").mixBlendMode,
        beamsBlend: cs(".ci-beams").mixBlendMode,
        beamFilter: cs(".ci-beams i").filter,
        halftoneMask: cs(".ci-halftone").maskImage || cs(".ci-halftone").webkitMaskImage,
        spotTransform: cs(".ci-spot").transform,
      };
    });
    expect(styles.grainBlend).toBe("normal");
    expect(styles.beamsBlend).toBe("normal");
    expect(styles.beamFilter).toBe("none");
    expect(styles.halftoneMask).toBe("none");
    expect(styles.spotTransform).not.toBe("none");
  });

  test("sitting on the hero doesn't repaint continuously (Chromium trace)", async ({ page, browser, browserName }, info) => {
    test.skip(browserName !== "chromium", "tracing is Chromium-only");
    onlyAtWidths(info, [390, 1440]);
    lightOnly(info);
    await gotoAndSettle(page, "/");
    await page.waitForTimeout(1500); // let the reveal transitions finish
    await browser.startTracing(page, { categories: ["devtools.timeline"] });
    await page.waitForTimeout(3000);
    const trace = JSON.parse((await browser.stopTracing()).toString()) as { traceEvents: { name: string }[] };
    const paintsPerSecond = trace.traceEvents.filter((e) => e.name === "Paint").length / 3;
    // Before this work a phone repainted the hero ~240 times a second, forever.
    expect(paintsPerSecond).toBeLessThan(10);
  });

  test("the headline slide and setlist use the browser's scroll timeline where supported", async ({ page }, info) => {
    onlyAtWidths(info, [1440]);
    lightOnly(info);
    await page.goto("/");
    const supported = await page.evaluate(() => CSS.supports("animation-timeline: scroll()"));
    const classes = await page.evaluate(() => [".ci-stage", ".ci-setlist"].map((s) => document.querySelector(s)!.classList.contains("ci-sda")));
    expect(classes).toEqual([supported, supported]);
  });
});
