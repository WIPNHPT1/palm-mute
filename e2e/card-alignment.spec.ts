import { expect, gotoAndSettle, lightOnly, test } from "./fixtures";
import { feel, key } from "./helpers";

// The five section cards share one structure (header, tab, details, actions) and one tab scale, so
// their contents line up across each row of the grid, whatever the tabs contain.
test.describe("section card alignment", () => {
  for (const width of [1280, 1440, 1920, 834]) {
    test(`cards line up at ${width}px`, async ({ page }, info) => {
      lightOnly(info);
      test.skip(info.project.use.viewport?.width !== 1440, "sets its own widths");
      await page.setViewportSize({ width, height: 1000 });
      await gotoAndSettle(page, "/generator/");
      for (const k of ["A", "D# / Eb", "G"]) {
        await key(page, k).click();
        for (const f of [/FAST PUNK/, /HALF-TIME/]) {
          await feel(page, f).click();
          const cards = await page.locator("section[aria-label]").evaluateAll((sections) =>
            sections.map((s) => {
              const top = (sel: string) => Math.round(s.querySelector(sel)!.getBoundingClientRect().top);
              const svg = s.querySelector<SVGSVGElement>("svg[data-tab]")!;
              const play = s.querySelector("[data-details] button")!.getBoundingClientRect();
              return {
                label: s.getAttribute("aria-label")!,
                lead: /solo|melody/i.test(s.textContent ?? ""),
                row: Math.round(s.getBoundingClientRect().top),
                bottom: Math.round(s.getBoundingClientRect().bottom),
                tab: top("[data-tab-area]"),
                details: top("[data-details]"),
                play: Math.round(play.top),
                scale: svg.getBoundingClientRect().width / svg.viewBox.baseVal.width,
              };
            }),
          );
          // Cards in the same grid row: same tab top, same details top, same play button, same height.
          const rows = new Map<number, typeof cards>();
          for (const c of cards) rows.set(c.row, [...(rows.get(c.row) ?? []), c]);
          for (const row of rows.values()) {
            if (row.length < 2) continue;
            for (const field of ["tab", "details", "play", "bottom"] as const) {
              expect(new Set(row.map((c) => c[field])).size, `${k} ${f}: ${field} differs across ${row.map((c) => c.label).join(", ")}`).toBe(1);
            }
          }
          // Chord tabs share one scale; a lead tab never draws larger than them.
          // (Within 1.5%: a double-width tablet card's borders shift it by a fraction of a pixel.)
          const chord = cards.filter((c) => !c.lead).map((c) => c.scale);
          expect(Math.max(...chord) / Math.min(...chord), `${k} ${f}: chord tab scales ${chord.map((x) => x.toFixed(3)).join(", ")}`).toBeLessThanOrEqual(1.015);
          for (const c of cards.filter((x) => x.lead)) expect(c.scale).toBeLessThanOrEqual(Math.max(...chord) + 0.001);
        }
      }
    });
  }

  test("long tabs show 4 bars until expanded", async ({ page }, info) => {
    lightOnly(info);
    await page.goto("/generator/");
    const solo = page.locator('section[aria-label="Solo"]');
    const strings = () => solo.locator('svg[data-tab] text[data-row="string"]').count();
    expect(await strings()).toBe(12); // 2 lines × 6 strings = 4 bars
    const toggle = solo.getByRole("button", { name: "Show all 8 bars" });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();
    expect(await strings()).toBe(24);
    await solo.getByRole("button", { name: "Show the first 4 bars" }).click();
    expect(await strings()).toBe(12);
    // Screen readers always hear the whole solo.
    await expect(solo.locator("p.sr-only")).toContainText("Bar 8");
  });
});
