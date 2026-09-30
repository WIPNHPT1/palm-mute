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

  test("six sorts re-order the ten cards without changing them", async ({ page }) => {
    await page.goto("/chords/");
    const ids = () => page.locator("[data-progression]").evaluateAll((cards) => cards.map((c) => c.getAttribute("data-progression")!));
    const common = await ids();
    expect(common).toHaveLength(10);
    const firsts: Record<string, string[]> = {
      DARKEST: ["vi-V-IV"],
      BRIGHTEST: ["I-V-vi-IV", "I-IV-V", "I-V-IV"],
      SIMPLEST: ["I-IV-V", "vi-V-IV", "I-V-IV"],
      "HOME START": ["I-V-vi-IV", "I-IV-V"],
      "MINOR START": ["vi-IV-I-V", "vi-V-IV"],
    };
    for (const [name, first] of Object.entries(firsts)) {
      await page.getByRole("radiogroup", { name: "Sort" }).getByRole("radio", { name, exact: true }).click();
      const sorted = await ids();
      expect(sorted.slice(0, first.length), name).toEqual(first);
      expect([...sorted].sort(), name).toEqual([...common].sort());
    }
  });

  test("the six sorts fill the Sort card: one row from tablet up, 3 + 3 on phones", async ({ page }, info) => {
    await gotoAndSettle(page, "/chords/");
    const radios = page.getByRole("radiogroup", { name: "Sort" }).getByRole("radio");
    await expect(radios).toHaveCount(6);
    const boxes = await radios.evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => ({ top: Math.round(r.top), width: r.width })));
    const phone = (info.project.use.viewport?.width ?? 1280) < 834;
    expect(new Set(boxes.map((b) => b.top)).size).toBe(phone ? 2 : 1);
    // Equal widths, so the control fills its card instead of bunching up on the left.
    const widths = boxes.map((b) => b.width);
    expect(Math.max(...widths) - Math.min(...widths)).toBeLessThan(1);
    const group = await page.getByRole("radiogroup", { name: "Sort" }).boundingBox();
    const card = await page.locator('[data-control="Sort"]').boundingBox();
    expect(group!.width).toBeGreaterThan(card!.width - 40);
  });
});
