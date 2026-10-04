import { type Page } from "@playwright/test";
import { expect, lightOnly, onlyAtWidths, test } from "./fixtures";
import { designUnit } from "./helpers";

// Count In's guitar strings: with SOUND on, each string you swipe across rings its open note, in the
// order you cross them, louder the faster you go. Sound is off until you turn it on.
const OPEN = { e: 64, B: 59, G: 55, D: 50, A: 45, E: 40 };
const DOWN = [OPEN.e, OPEN.B, OPEN.G, OPEN.D, OPEN.A, OPEN.E];

const plucks = (page: Page) => page.evaluate(() => (window.__palmMutePlucks ?? []).map((p) => ({ ...p })));
const clear = (page: Page) => page.evaluate(() => (window.__palmMutePlucks = []));

async function swipe(page: Page, direction: "down" | "up", steps: number) {
  const box = (await page.locator(".ci-strings").boundingBox())!;
  const x = box.x + box.width * 0.45;
  // Start just outside the strings (so the pointer enters fresh) and sweep right across them.
  const [outside, from, to] = direction === "down" ? [box.y - 40, box.y + 2, box.y + box.height - 2] : [box.y + box.height + 40, box.y + box.height - 2, box.y + 2];
  await page.mouse.move(x, outside);
  await page.mouse.move(x, from);
  await page.mouse.move(x, to, { steps });
  await page.mouse.move(x, direction === "down" ? box.y + box.height + 40 : box.y - 40); // and leave
}

test.describe("count in strings", () => {
  test.beforeEach(async ({ page }, info) => {
    onlyAtWidths(info, [390, 1440]);
    lightOnly(info);
    await page.goto("/");
    await page.locator(".ci-strings").scrollIntoViewIfNeeded();
  });

  test("silent until SOUND is on; then a swipe strums the open strings in order", async ({ page }) => {
    const toggle = page.getByRole("switch", { name: "String sound" });
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await expect(toggle).toContainText("SOUND OFF");
    const box = (await toggle.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(43.5 * (await designUnit(page))); // 44px in design pixels (90% from 1440px)

    await swipe(page, "down", 12);
    expect(await plucks(page)).toEqual([]);

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    await expect(toggle).toContainText("SOUND ON");
    expect(await plucks(page), "pressing the switch plucks nothing").toEqual([]);

    await swipe(page, "down", 12);
    expect((await plucks(page)).map((p) => p.midi)).toEqual(DOWN);
    await clear(page);
    await swipe(page, "up", 12);
    expect((await plucks(page)).map((p) => p.midi)).toEqual([...DOWN].reverse());
  });

  test("a fast swipe is louder than a slow one", async ({ page }) => {
    await page.getByRole("switch", { name: "String sound" }).click();
    await swipe(page, "down", 60);
    const slow = await plucks(page);
    await clear(page);
    await swipe(page, "down", 2);
    const fast = await plucks(page);
    expect(slow).toHaveLength(6);
    expect(fast).toHaveLength(6);
    const avg = (ps: { velocity: number }[]) => ps.reduce((a, p) => a + p.velocity, 0) / ps.length;
    expect(avg(fast)).toBeGreaterThan(avg(slow));
    for (const p of [...slow, ...fast]) expect(p.velocity).toBeGreaterThan(0);
  });

  test("the SOUND choice is remembered", async ({ page }) => {
    await page.getByRole("switch", { name: "String sound" }).click();
    await page.reload();
    await expect(page.getByRole("switch", { name: "String sound" })).toHaveAttribute("aria-checked", "true");
    await page.getByRole("switch", { name: "String sound" }).click();
    await page.reload();
    await expect(page.getByRole("switch", { name: "String sound" })).toHaveAttribute("aria-checked", "false");
  });
});
