import { expect, gotoAndSettle, horizontalOverflow, projectWidth, test } from "./fixtures";
import { layoutProblems } from "./helpers";

// The Chord Lab's responsive gate (docs/chord-lab-prd.md §8, the song builder's B12 rules). Runs in every
// project: Chromium and WebKit, 320–1920px, light and dark. Each phase that adds a tool extends it.
test.describe("chord lab: every screen", () => {
  test("the setup and the tool strip fit", async ({ page }) => {
    await gotoAndSettle(page, "/chords/");
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    expect(await layoutProblems(page, "[data-lab-setup]")).toEqual([]);
    expect(await layoutProblems(page, 'nav[aria-label="Lab tools"]')).toEqual([]);
  });

  test("the Dictionary fits in every state, and the neck stays readable", async ({ page }) => {
    await gotoAndSettle(page, "/chords/");
    const tool = '[data-tool="dictionary"]';
    for (const [tuning, type, handed] of [["E STD", "MAJOR", "RIGHT"], ["DROP C#", "M7", "LEFT"], ["Eb STD", "ADD9", "RIGHT"]]) {
      await page.getByRole("radiogroup", { name: "Tuning" }).getByRole("radio", { name: tuning, exact: true }).click();
      await page.getByRole("radiogroup", { name: "Chord type" }).getByRole("radio", { name: type, exact: true }).click();
      await page.getByRole("radiogroup", { name: "Handed" }).getByRole("radio", { name: handed, exact: true }).click();
      expect(await horizontalOverflow(page), `${tuning} ${type}`).toBeLessThanOrEqual(0);
      expect(await layoutProblems(page, tool), `${tuning} ${type}`).toEqual([]);
    }
    // The neck: across the card from tablet up, upright on phones; its labels never shrink below ~12px.
    const shown = projectWidth(test.info()) < 834 ? "vertical" : "horizontal";
    const neck = page.locator(`${tool} svg[data-neck="${shown}"]`);
    await expect(neck).toBeVisible();
    const smallest = await neck.evaluate((svg: SVGSVGElement) => {
      const k = svg.getBoundingClientRect().width / svg.viewBox.baseVal.width;
      return Math.min(...[...svg.querySelectorAll("text")].map((t) => parseFloat(t.getAttribute("font-size") ?? getComputedStyle(t).fontSize) * k));
    });
    expect(smallest).toBeGreaterThanOrEqual(11.5);
    // Voicing cards: two or more side by side, never spilling out of the card.
    const cards = await page.locator(`${tool} [data-voicing]`).evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => ({ left: r.left, right: r.right, top: r.top })));
    expect(cards.filter((c) => c.top === cards[0].top).length).toBeGreaterThanOrEqual(2);
    const box = (await page.locator(tool).boundingBox())!;
    for (const c of cards) expect(c.right).toBeLessThanOrEqual(box.x + box.width + 0.5);
  });

  test("Name that chord fits with a shape named, the near-miss hint showing, and a bad shape", async ({ page }) => {
    await gotoAndSettle(page, "/chords/");
    const tool = '[data-tool="name-it"]';
    const input = page.locator(`${tool} input`);
    for (const shape of ["x32010", "x32013", "x3201", "x-10-12-12-10-x"]) {
      await input.fill(shape);
      expect(await horizontalOverflow(page), shape).toBeLessThanOrEqual(0);
      expect(await layoutProblems(page, tool), shape).toEqual([]);
    }
    // The neck's tap areas are real tap targets on phones.
    if (projectWidth(test.info()) < 834) {
      const small = await page.locator(`${tool} rect[data-tap]`).evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).filter((r) => r.width && (r.width < 30 || r.height < 30)).length);
      expect(small).toBe(0);
    }
  });

  test("the Builder fits with a full loop, an open chord editor and the meters", async ({ page }) => {
    await gotoAndSettle(page, "/chords/");
    const tool = '[data-tool="builder"]';
    for (let i = 0; i < 4; i++) await page.locator(tool).getByRole("button", { name: /^Add I, / }).click();
    await page.locator(`${tool} [data-loop] li button`).nth(3).click();
    await page.getByRole("radiogroup", { name: "Chord sound" }).getByRole("radio", { name: "FULL CHORDS" }).click();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    expect(await layoutProblems(page, tool)).toEqual([]);
    // Eight chords in the loop wrap inside the card.
    const box = (await page.locator(tool).boundingBox())!;
    for (const r of await page.locator(`${tool} [data-loop] li`).evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => ({ left: r.left, right: r.right })))) {
      expect(r.left).toBeGreaterThanOrEqual(box.x - 0.5);
      expect(r.right).toBeLessThanOrEqual(box.x + box.width + 0.5);
    }
  });
});
