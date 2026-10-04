import { expect, gotoAndSettle, lightOnly, onlyAtWidths, test } from "./fixtures";

// Guards for the Count In page's motion costs (see the "smoother motion" PR): the effects look the same,
// but nothing may bring back continuous repaints, full-screen blending or live blur.
test.describe("count in motion stays cheap", () => {
  test("no full-screen blend or live blur; the light leak moves by transform and opacity only", async ({ page }, info) => {
    onlyAtWidths(info, [390, 1440]);
    await gotoAndSettle(page, "/");
    const styles = await page.evaluate(() => {
      const cs = (sel: string) => getComputedStyle(document.querySelector(sel)!);
      return {
        grainBlend: cs(".ci-grain").mixBlendMode,
        leakBlend: cs(".ci-leak i").mixBlendMode,
        leakFilter: cs(".ci-leak i").filter,
        halftoneMask: cs(".ci-halftone").maskImage || cs(".ci-halftone").webkitMaskImage,
        leakAnimations: [...document.querySelectorAll(".ci-leak i")].map((el) => getComputedStyle(el).animationName),
        leakWillChange: cs(".ci-leak i").willChange,
      };
    });
    expect(styles.grainBlend).toBe("normal");
    expect(styles.leakBlend).toBe("normal");
    expect(styles.leakFilter).toBe("none");
    expect(styles.halftoneMask).toBe("none");
    expect(styles.leakAnimations).toEqual(["ci-leak-a", "ci-leak-b", "ci-leak-c"]);
    expect(styles.leakWillChange).toBe("transform, opacity");
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
