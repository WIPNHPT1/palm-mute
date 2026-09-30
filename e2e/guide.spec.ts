import { expect, gotoAndSettle, horizontalOverflow, test } from "./fixtures";

// "How to use" posters under the Generator and Chords titles (owner's pick: Count In poster style).
const GUIDES = [
  { path: "/generator/", label: "How to use the Generator", titles: ["Set up", "Build", "Shape each part", "Take it away"] },
  { path: "/chords/", label: "How to use the Chords page", titles: ["Pick a key", "Listen", "Write a lead", "Use it"] },
];

for (const g of GUIDES) {
  test(`${g.path}: four how-to-use posters under the title, fitting the page`, async ({ page }) => {
    await gotoAndSettle(page, g.path);
    const guide = page.getByRole("region", { name: g.label });
    await expect(guide).toBeVisible();
    await expect(guide.locator("h2")).toHaveText(g.titles);
    // Directly under the page title, above the controls.
    const [h1, top, controls] = await Promise.all([
      page.locator("h1").boundingBox(),
      guide.boundingBox(),
      page.locator("[data-control]").first().boundingBox(),
    ]);
    expect(top!.y).toBeGreaterThan(h1!.y);
    expect(top!.y + top!.height).toBeLessThanOrEqual(controls!.y);
    // Every poster stays inside the page, and the page doesn't scroll sideways.
    const inside = await guide.locator("li").evaluateAll((lis) =>
      lis.every((li) => { const r = li.getBoundingClientRect(); return r.left >= -4 && r.right <= innerWidth + 4; }),
    );
    expect(inside).toBe(true);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });
}

test("hiding a guide is remembered per page, applies before paint, and can be undone", async ({ page }, info) => {
  test.skip(info.project.use.viewport?.width !== 1440 || info.project.use.colorScheme === "dark", "runs once per browser");
  await page.goto("/generator/");
  const guide = page.getByRole("region", { name: "How to use the Generator" });
  await guide.getByRole("button", { name: /HIDE THE GUIDE/ }).click();
  await expect(guide.locator("ol")).toBeHidden();
  const show = guide.getByRole("button", { name: /HOW TO USE/ });
  await expect(show).toBeVisible();
  expect((await show.boundingBox())!.height).toBeGreaterThanOrEqual(44);

  // Reload: the class is on <html> before React runs, so the posters never render visibly.
  await page.reload();
  expect(await page.evaluate(() => document.documentElement.classList.contains("guide-hidden-generator"))).toBe(true);
  await expect(page.getByRole("region", { name: "How to use the Generator" }).locator("ol")).toBeHidden();

  // The Chords page keeps its own guide.
  await page.goto("/chords/");
  await expect(page.getByRole("region", { name: "How to use the Chords page" }).locator("ol")).toBeVisible();

  // And back again.
  await page.goto("/generator/");
  await page.getByRole("region", { name: "How to use the Generator" }).getByRole("button", { name: /HOW TO USE/ }).click();
  await expect(page.getByRole("region", { name: "How to use the Generator" }).locator("ol")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("region", { name: "How to use the Generator" }).locator("ol")).toBeVisible();
});
