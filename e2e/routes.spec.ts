import { ROUTES, expect, gotoAndSettle, horizontalOverflow, test } from "./fixtures";

test.describe("routes", () => {
  for (const route of ROUTES) {
    test(`${route.path} loads with its h1 and title, without horizontal overflow`, async ({ page }) => {
      await gotoAndSettle(page, route.path);
      await expect(page).toHaveTitle(route.title);
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.locator("h1")).toContainText(route.h1);
      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    });
  }

  test("/about/ falls back to the home page", async ({ page }) => {
    await page.goto("/about/");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator("h1")).toContainText(ROUTES[0].h1);
  });
});
