import { type Page } from "@playwright/test";
import { expect, lightOnly, onlyAtWidths, openMenu, projectWidth, test } from "./fixtures";
import { key, lastPlayback, parseTab, playedCells } from "./helpers";

const panel = (page: Page) => page.getByRole("region", { name: /in [A-G]/ });

async function panelTab(page: Page): Promise<string[][]> {
  return panel(page).locator("svg[data-tab]").evaluate((svg) => {
    const rows = [...svg.querySelectorAll('text[data-row="string"]')].map((t) => t.textContent ?? "");
    const groups: string[][] = [];
    for (let i = 0; i < rows.length; i += 6) groups.push(rows.slice(i, i + 6));
    return groups;
  });
}

test.describe("intro melody and lead solo", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/chords/");
    await key(page, "G").click();
  });

  test("the panel opens by mouse and keyboard, and its parts switch by tab", async ({ page }, info) => {
    onlyAtWidths(info, [390, 1440]);
    lightOnly(info);
    const card = page.getByRole("button", { name: "I-V-vi-IV: show options" });
    await card.focus();
    await page.keyboard.press("Enter");
    await expect(panel(page)).toBeVisible();
    const intro = page.getByRole("tab", { name: "Intro melody" });
    const solo = page.getByRole("tab", { name: "Lead solo" });
    await expect(intro).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("radiogroup", { name: "Style" }).getByRole("radio", { name: "HOOK" })).toHaveAttribute("aria-checked", "true");
    await expect(page.getByRole("radiogroup", { name: "Length" }).getByRole("radio", { name: "4 BARS" })).toHaveAttribute("aria-checked", "true");
    expect(parseTab(await panelTab(page))).toHaveLength(4);
    await solo.click();
    await expect(solo).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("radiogroup", { name: "Style" }).getByRole("radio", { name: "CLASSIC" })).toHaveAttribute("aria-checked", "true");
    expect(parseTab(await panelTab(page))).toHaveLength(8);
    await page.getByRole("radiogroup", { name: "Length" }).getByRole("radio", { name: "16 BARS" }).click();
    expect(parseTab(await panelTab(page))).toHaveLength(16);
    await page.keyboard.press("Escape");
    await expect(panel(page)).toHaveCount(0);
    await expect(card).toBeFocused();
  });

  test("the lead tab never overflows the panel, from 320 to 1920px", async ({ page }) => {
    await page.getByRole("button", { name: "I-V-vi-IV: show options" }).click();
    for (const part of ["Intro melody", "Lead solo"]) {
      await page.getByRole("tab", { name: part }).click();
      for (const style of part === "Intro melody" ? ["HOOK", "OCTAVES", "HARMONY"] : ["CHILL", "SHRED"]) {
        await page.getByRole("radiogroup", { name: "Style" }).getByRole("radio", { name: style }).click();
        const fit = await panel(page).evaluate((p) => {
          const svg = p.querySelector("svg[data-tab]")!;
          const a = p.getBoundingClientRect(), b = svg.getBoundingClientRect();
          return { inside: b.left >= a.left - 0.5 && b.right <= a.right + 0.5, page: document.documentElement.scrollWidth - document.documentElement.clientWidth };
        });
        expect(fit.inside, `${part} ${style} at ${projectWidth(test.info())}px`).toBe(true);
        expect(fit.page).toBeLessThanOrEqual(0);
      }
    }
  });

  test("Generate gives a new take; playback plays exactly the tab, with or without backing", async ({ page }, info) => {
    onlyAtWidths(info, [390, 1440]);
    lightOnly(info);
    await page.getByRole("button", { name: "I-V-vi-IV: show options" }).click();
    await page.getByRole("tab", { name: "Lead solo" }).click();
    const first = await panelTab(page);
    await page.getByRole("button", { name: "GENERATE", exact: true }).click();
    const second = await panelTab(page);
    expect(second).not.toEqual(first);

    await page.getByRole("button", { name: "PLAY WITH BACKING" }).click();
    await expect(page.getByRole("button", { name: "PLAY WITH BACKING" })).toHaveAttribute("aria-pressed", "true");
    let pb = (await lastPlayback(page))!;
    expect(playedCells(pb)).toEqual(parseTab(second));
    expect(pb.bars.every((b) => b.drums !== false && b.cells.some(Boolean))).toBe(true);

    await page.getByRole("button", { name: "PLAY LEAD ONLY" }).click();
    pb = (await lastPlayback(page))!;
    expect(playedCells(pb)).toEqual(parseTab(second));
    expect(pb.bars.every((b) => b.drums === false && !b.cells.some(Boolean))).toBe(true);

    // A new take stops the preview (it no longer matches).
    await page.getByRole("button", { name: "GENERATE", exact: true }).click();
    await expect.poll(() => lastPlayback(page)).toBeNull();
  });

  test("Copy tab copies the tab and the note names", async ({ page, browserName, context }, info) => {
    onlyAtWidths(info, [1440]);
    lightOnly(info);
    test.skip(browserName !== "chromium", "clipboard permissions can only be granted in Chromium");
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.getByRole("button", { name: "I-V-vi-IV: show options" }).click();
    await page.getByRole("button", { name: "COPY TAB" }).click();
    await expect(page.getByText("Tab copied.")).toBeVisible();
    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text).toContain("Intro melody · Hook · key of G · I-V-vi-IV");
    expect(text).toMatch(/^e\|/m);
    expect(text).toMatch(/^G: /m);
  });

  test("Use in my song puts the solo in the Generator, and it stays lockable", async ({ page }, info) => {
    onlyAtWidths(info, [390, 1440]);
    lightOnly(info);
    await page.getByRole("button", { name: "vi-IV-I-V: show options" }).click();
    await page.getByRole("tab", { name: "Lead solo" }).click();
    await page.getByRole("radiogroup", { name: "Style" }).getByRole("radio", { name: "SHRED" }).click();
    await page.getByRole("button", { name: "GENERATE", exact: true }).click();
    const sent = await panelTab(page);
    await page.getByRole("button", { name: "USE IN MY SONG" }).click();
    await page.getByRole("link", { name: "Open the Generator" }).click();
    await expect(page).toHaveURL(/\/generator\/$/);
    const solo = page.locator('section[aria-label="Solo"]');
    await expect(solo).toContainText("8 bars · Shred solo");
    const shown = await solo.locator("svg[data-tab]").evaluate((svg) => {
      const rows = [...svg.querySelectorAll('text[data-row="string"]')].map((t) => t.textContent ?? "");
      const groups: string[][] = [];
      for (let i = 0; i < rows.length; i += 6) groups.push(rows.slice(i, i + 6));
      return groups;
    });
    expect(shown).toEqual(sent);
    // Lock it: Generate and a key change leave it alone.
    await solo.getByRole("button", { name: "Lock Solo" }).click();
    const locked = await solo.locator("svg[data-tab]").textContent();
    await page.getByRole("button", { name: "GENERATE", exact: true }).click();
    await key(page, "C").click();
    expect(await solo.locator("svg[data-tab]").textContent()).toBe(locked);
    await expect(solo).toContainText("Locked in G");
    // Play it: the solo's line equals its tab.
    await solo.getByRole("button", { name: "Play Solo" }).click();
    expect(playedCells((await lastPlayback(page))!)).toEqual(parseTab(shown));
  });

  test("an intro melody can go back to power chords", async ({ page }, info) => {
    onlyAtWidths(info, [1440]);
    lightOnly(info);
    await page.getByRole("button", { name: "I-V-vi-IV: show options" }).click();
    await page.getByRole("button", { name: "USE IN MY SONG" }).click();
    await page.getByRole("link", { name: "Open the Generator" }).click();
    const intro = page.locator('section[aria-label="Intro"]');
    await expect(intro).toContainText("Hook melody");
    await intro.getByRole("button", { name: "Back to power chords" }).click();
    await expect(intro).toContainText("Octave riff");
  });

  test("playback stops when leaving the page", async ({ page }, info) => {
    onlyAtWidths(info, [390]);
    lightOnly(info);
    await page.getByRole("button", { name: "I-V-vi-IV: show options" }).click();
    await page.getByRole("button", { name: "PLAY WITH BACKING" }).click();
    expect(await lastPlayback(page)).not.toBeNull();
    await openMenu(page);
    await page.locator("#site-menu").getByRole("link", { name: /Count In/ }).click();
    await expect.poll(() => lastPlayback(page)).toBeNull();
  });
});
