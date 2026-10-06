import { type Page, type TestInfo, expect, test as base } from "@playwright/test";

/**
 * Shared test setup. Every test fails if the page logs a console error or throws, so "no console
 * errors" is checked everywhere, not just in one spec.
 */
export const test = base.extend<{ consoleErrors: string[]; darkChoice: void }>({
  /**
   * The site opens dark for everyone; light is the reader's choice (DECISIONS.md). Each project makes its theme's
   * choice up front, as if the reader had flipped the DARK switch, unless a test already stored one.
   */
  darkChoice: [
    async ({ page }, use, info) => {
      await page.addInitScript((theme) => {
        // about:blank has no storage (a test opening a link "fresh" passes through it): skip it there
        try {
          if (!localStorage.getItem("palm-mute-theme")) localStorage.setItem("palm-mute-theme", theme);
        } catch {}
      }, info.project.use.colorScheme === "dark" ? "dark" : "light");
      await use();
    },
    { auto: true },
  ],
  consoleErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") errors.push(msg.text());
      });
      page.on("pageerror", (err) => errors.push(String(err)));
      await use(errors);
      expect(errors, "console errors").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

export const ROUTES = [
  { path: "/", h1: "Songwriting formulas from the bands that built pop-punk.", title: "Home · Palm/Mute" },
  { path: "/generator/", h1: "SONG GENERATOR", title: "Generator · Palm/Mute" },
  { path: "/chords/", h1: "CHORD LAB", title: "Chord Lab · Palm/Mute" },
] as const;

export function projectWidth(info: TestInfo): number {
  return info.project.use.viewport?.width ?? 1280;
}

export function projectTheme(info: TestInfo): "light" | "dark" {
  return info.project.use.colorScheme === "dark" ? "dark" : "light";
}

/** Behaviour that doesn't depend on screen size only needs one phone and one desktop width. */
export function onlyAtWidths(info: TestInfo, widths: number[]) {
  test.skip(!widths.includes(projectWidth(info)), `runs at ${widths.join(", ")}px only`);
}

/** Behaviour that doesn't depend on the colour scheme only needs to run in one theme. */
export function lightOnly(info: TestInfo) {
  test.skip(projectTheme(info) !== "light", "theme-independent; runs in light only");
}

export async function openMenu(page: Page) {
  const button = page.getByRole("button", { name: "Open menu" });
  await button.click();
  await expect(page.locator("#site-menu")).toHaveAttribute("data-open", "true");
  // Let the bands finish wiping in (0.55s + 0.21s stagger, contents fade in by ~0.75s).
  await page.waitForTimeout(900);
}

/** Horizontal page overflow in px (0 = none). */
export async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

export async function gotoAndSettle(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}
