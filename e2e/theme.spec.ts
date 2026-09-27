import { expect, onlyAtWidths, openMenu, projectTheme, test } from "./fixtures";

test.describe("dark mode", () => {
  test("follows the OS colour scheme by default", async ({ page }, info) => {
    await page.goto("/");
    const html = page.locator("html");
    if (projectTheme(info) === "dark") await expect(html).toHaveClass(/\bdark\b/);
    else await expect(html).not.toHaveClass(/\bdark\b/);
  });

  test("the toggle switches theme and the choice persists", async ({ page }, info) => {
    onlyAtWidths(info, [390, 1440]);
    await page.goto("/generator/");
    const startDark = projectTheme(info) === "dark";
    await openMenu(page);
    const toggle = page.getByRole("switch", { name: "Dark mode" });
    await expect(toggle).toHaveAttribute("aria-checked", String(startDark));
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", String(!startDark));
    const html = page.locator("html");
    if (startDark) await expect(html).not.toHaveClass(/\bdark\b/);
    else await expect(html).toHaveClass(/\bdark\b/);
    expect(await page.evaluate(() => localStorage.getItem("palm-mute-theme"))).toBe(startDark ? "light" : "dark");

    await page.reload();
    if (startDark) await expect(html).not.toHaveClass(/\bdark\b/);
    else await expect(html).toHaveClass(/\bdark\b/);
    await page.goto("/chords/");
    if (startDark) await expect(html).not.toHaveClass(/\bdark\b/);
    else await expect(html).toHaveClass(/\bdark\b/);
  });
});
