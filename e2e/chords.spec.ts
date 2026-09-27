import { expect, gotoAndSettle, test } from "./fixtures";

test.describe("chords page", () => {
  test("all chord chips are the same width", async ({ page }) => {
    await gotoAndSettle(page, "/chords/");
    for (const key of ["A", "F# / Gb", "C"]) {
      await page.getByRole("radiogroup", { name: "Key" }).getByRole("radio", { name: key, exact: true }).click();
      const widths = await page.locator("[data-chip]").evaluateAll((chips) =>
        chips.map((c) => Math.round(c.getBoundingClientRect().width * 10) / 10),
      );
      expect(widths.length).toBeGreaterThanOrEqual(20);
      expect(new Set(widths).size, `chip widths in ${key}: ${[...new Set(widths)].join(", ")}`).toBe(1);
    }
  });

  test("sort re-orders the six cards without changing them", async ({ page }) => {
    await page.goto("/chords/");
    const ids = () => page.locator("[data-progression]").evaluateAll((cards) => cards.map((c) => c.getAttribute("data-progression")!));
    const common = await ids();
    expect(common).toHaveLength(6);
    await page.getByRole("radio", { name: "DARKEST" }).click();
    const darkest = await ids();
    expect(darkest[0]).toBe("vi-V-IV");
    expect([...darkest].sort()).toEqual([...common].sort());
  });
});
