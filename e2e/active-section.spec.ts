import { type Page } from "@playwright/test";
import { expect, onlyAtWidths, test } from "./fixtures";

// Red on a section card means "sounding now" (DECISIONS.md), like the red Power Chords row and Rhythm
// Lane card mean "in use". It follows Play song card by card, and nothing is red when nothing plays.
const card = (page: Page, label: string) => page.locator(`section[aria-label="${label}"]`);
const active = (page: Page) =>
  page.locator("section[aria-label][data-active='true']").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
const borderColor = (page: Page, label: string) => card(page, label).evaluate((el) => getComputedStyle(el).borderTopColor);
const accent = (page: Page) =>
  page.evaluate(() => {
    const probe = document.createElement("span");
    probe.className = "border-accent border";
    document.body.append(probe);
    const c = getComputedStyle(probe).borderTopColor;
    probe.remove();
    return c;
  });

test.describe("active section", () => {
  test.beforeEach(async ({ page }, info) => {
    onlyAtWidths(info, [390, 1440]);
    await page.goto("/generator/");
  });

  test("no card is red until something plays; locked cards look locked", async ({ page }) => {
    expect(await active(page)).toEqual([]);
    const red = await accent(page);
    for (const label of ["Intro", "Verse", "Chorus", "Solo", "Breakdown"]) expect(await borderColor(page, label), label).not.toBe(red);
    // The Verse is locked by default: ink border, not the plain one.
    await expect(card(page, "Verse")).toHaveAttribute("data-locked", "true");
    expect(await borderColor(page, "Verse")).not.toBe(await borderColor(page, "Intro"));
    // The Chorus says which progression it plays (the red row in Power Chords).
    await expect(card(page, "Chorus")).toContainText("Chords: I-V-vi-IV");
    await page.getByRole("button", { name: "Use vi-IV-I-V for the Chorus" }).click();
    await expect(card(page, "Chorus")).toContainText("Chords: vi-IV-I-V");
  });

  test("a section's play button lights its card", async ({ page }) => {
    await card(page, "Solo").getByRole("button", { name: "Play Solo" }).click();
    await expect.poll(() => active(page)).toEqual(["Solo"]);
    const red = await accent(page);
    await expect.poll(() => borderColor(page, "Solo")).toBe(red); // after the 0.2s colour transition
    await card(page, "Chorus").getByRole("button", { name: "Play Chorus" }).click();
    await expect.poll(() => active(page)).toEqual(["Chorus"]);
    await card(page, "Chorus").getByRole("button", { name: "Stop Chorus" }).click();
    await expect.poll(() => active(page)).toEqual([]);
    // Playing a Power Chords row isn't a section: no card lights up.
    await page.getByRole("button", { name: "Play I-V-vi-IV" }).click();
    await page.waitForTimeout(300);
    expect(await active(page)).toEqual([]);
  });

  test("Play song moves the light card by card", async ({ page }) => {
    test.slow();
    await page.getByRole("button", { name: "PLAY SONG" }).click();
    await expect.poll(() => active(page)).toEqual(["Intro"]);
    // The Intro is 4 bars at 180 BPM (about 5.3 seconds); then the Verse lights up.
    await expect.poll(() => active(page), { timeout: 15_000 }).toEqual(["Verse"]);
    await page.getByRole("button", { name: "STOP SONG" }).click();
    await expect.poll(() => active(page)).toEqual([]);
  });
});
