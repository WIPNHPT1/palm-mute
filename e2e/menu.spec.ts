import { expect, lightOnly, openMenu, test } from "./fixtures";

// Shutter menu (DECISIONS.md → Menu style).
test.describe("menu", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/generator/");
  });

  test("opens and closes with the button", async ({ page }) => {
    const menu = page.locator("#site-menu");
    await expect(menu).toBeHidden();
    await openMenu(page);
    await expect(menu).toBeVisible();
    await expect(page.getByRole("button", { name: "Close menu" })).toHaveAttribute("aria-expanded", "true");
    await page.getByRole("button", { name: "Close menu" }).click();
    await expect(menu).toHaveAttribute("data-open", "false");
    await expect(menu).toBeHidden();
  });

  test("Esc closes it and returns focus to the menu button", async ({ page }) => {
    await openMenu(page);
    await page.keyboard.press("Escape");
    await expect(page.locator("#site-menu")).toHaveAttribute("data-open", "false");
    await expect(page.getByRole("button", { name: "Open menu" })).toBeFocused();
  });

  test("closes when navigating", async ({ page }) => {
    await openMenu(page);
    await page.locator("#site-menu").getByRole("link", { name: /Chord Lab/ }).click();
    await expect(page).toHaveURL(/\/chords\/$/);
    await expect(page.locator("#site-menu")).toHaveAttribute("data-open", "false");
    // Picking the page you're already on closes it too.
    await openMenu(page);
    await page.locator("#site-menu").getByRole("link", { name: /Chord Lab/ }).click();
    await expect(page.locator("#site-menu")).toHaveAttribute("data-open", "false");
  });

  test("locks page scroll while open", async ({ page }) => {
    const html = page.locator("html");
    await openMenu(page);
    await expect(html).toHaveClass(/overflow-hidden/);
    await page.keyboard.press("Escape");
    await expect(html).not.toHaveClass(/overflow-hidden/);
  });

  test("lights no band when it opens", async ({ page }) => {
    await openMenu(page);
    const lit = await page.locator("#site-menu .shutter-band.is-link").evaluateAll((bands) =>
      bands.filter((b) => {
        const t = getComputedStyle(b, "::after").transform;
        return t === "none" || t === "matrix(1, 0, 0, 1, 0, 0)";
      }).length,
    );
    expect(lit).toBe(0);
  });

  test("never shows red text on a red band", async ({ page, browserName }, info) => {
    lightOnly(info);
    await openMenu(page);
    const accent = await page.evaluate(() => {
      const probe = document.createElement("span");
      probe.className = "text-accent";
      document.body.append(probe);
      const c = getComputedStyle(probe).color;
      probe.remove();
      return c;
    });
    const bands = page.locator("#site-menu .shutter-band.is-link");
    for (let i = 0; i < (await bands.count()); i++) {
      await bands.nth(i).hover();
      await page.waitForTimeout(500);
      const label = bands.nth(i).locator(".shutter-label");
      expect(await label.evaluate((el) => getComputedStyle(el).color)).not.toBe(accent);
    }
    // Keyboard focus lights a band the same way.
    await page.mouse.move(0, 0);
    // Safari (WebKit) only tabs to links with Option+Tab, like a real Safari user.
    await page.keyboard.press(browserName === "webkit" ? "Alt+Tab" : "Tab");
    await page.waitForTimeout(500);
    const focused = page.locator("#site-menu a:focus-visible .shutter-label");
    await expect(focused).toHaveCount(1);
    expect(await focused.evaluate((el) => getComputedStyle(el).color)).not.toBe(accent);
  });
});
