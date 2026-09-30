import { expect, onlyAtWidths, openMenu, projectTheme, test } from "./fixtures";

test.describe("dark mode", () => {
  test("the site opens light, whatever the device's appearance setting", async ({ browser }, info) => {
    onlyAtWidths(info, [1440]);
    // A fresh visitor with a dark-mode device and no stored choice.
    for (const colorScheme of ["dark", "light"] as const) {
      const context = await browser.newContext({ colorScheme, baseURL: info.project.use.baseURL });
      const page = await context.newPage();
      for (const path of ["/", "/generator/", "/chords/"]) {
        await page.goto(path);
        await expect(page.locator("html"), `${colorScheme} device, ${path}`).not.toHaveClass(/\bdark\b/);
        expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(246, 241, 228)"); // paper
      }
      await context.close();
    }
  });

  test("the toggle switches theme and the choice persists", async ({ page }, info) => {
    onlyAtWidths(info, [390, 1440]);
    await page.goto("/generator/");
    // Light projects start light (the default); dark projects start from a stored dark choice.
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
