import { type Page } from "@playwright/test";
import { expect, lightOnly, onlyAtWidths, openMenu, test } from "./fixtures";

const section = (page: Page, label: string) => page.locator(`section[aria-label="${label}"]`);
const tab = (page: Page, label: string) => section(page, label).locator("svg[data-tab]");
/** A section's whole tab (rhythm and notes), as one string for before/after comparisons. */
const sectionText = async (page: Page, label: string) => `${await tab(page, label).textContent()}`;
const panel = (page: Page) => page.getByRole("heading", { name: "POWER CHORDS" }).locator("xpath=../..");
/** Chord names on the first (Chorus) row of the Power Chords panel (the default progression has 4 chords). */
async function panelChords(page: Page): Promise<string[]> {
  const labels = await panel(page).locator("[data-chip] > div:nth-child(2)").allTextContents();
  return labels.slice(0, 4);
}
const key = (page: Page, name: string) => page.getByRole("radiogroup", { name: "Key" }).getByRole("radio", { name, exact: true });
const feel = (page: Page, name: RegExp) => page.getByRole("radiogroup", { name: "Feel" }).getByRole("radio", { name });

test.describe("generator", () => {
  test.beforeEach(async ({ page }, info) => {
    onlyAtWidths(info, [390, 1440]);
    lightOnly(info);
    await page.goto("/generator/");
  });

  test("keys update the chords", async ({ page }) => {
    await expect(key(page, "A")).toHaveAttribute("aria-checked", "true");
    expect(await panelChords(page)).toEqual(["A5", "E5", "F#5", "D5"]);
    const introBefore = await tab(page, "Intro").textContent();
    for (const [k, chords] of [
      ["C", ["C5", "G5", "A5", "F5"]],
      ["F# / Gb", ["F#5", "C#5", "D#5", "B5"]],
      ["D# / Eb", ["D#5", "A#5", "C5", "G#5"]],
    ] as const) {
      await key(page, k).click();
      await expect(key(page, k)).toHaveAttribute("aria-checked", "true");
      expect(await panelChords(page)).toEqual(chords);
    }
    expect(await tab(page, "Intro").textContent()).not.toBe(introBefore);
  });

  test("regenerate changes an unlocked section; lock freezes it", async ({ page }) => {
    // Verse is locked by default and can't be regenerated.
    await expect(section(page, "Verse").getByRole("button", { name: "Verse is locked" })).toBeDisabled();
    await expect(section(page, "Verse").getByRole("button", { name: "Unlock Verse" })).toHaveAttribute("aria-pressed", "true");

    const intro0 = await sectionText(page, "Intro");
    await section(page, "Intro").getByRole("button", { name: "Regenerate Intro" }).click();
    const intro1 = await sectionText(page, "Intro");
    expect(intro1).not.toBe(intro0);

    await section(page, "Intro").getByRole("button", { name: "Lock Intro" }).click();
    await expect(section(page, "Intro").getByRole("button", { name: "Intro is locked" })).toBeDisabled();
    const verse = await tab(page, "Verse").textContent();
    const solo = await tab(page, "Solo").textContent();
    for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "GENERATE", exact: true }).click();
    expect(await sectionText(page, "Intro")).toBe(intro1);
    expect(await tab(page, "Verse").textContent()).toBe(verse);
    expect(await tab(page, "Solo").textContent()).not.toBe(solo);

    // Locked sections stay frozen across key changes, too.
    await key(page, "C").click();
    expect(await tab(page, "Verse").textContent()).toBe(verse);
    // Unlocking re-enables regenerate.
    await section(page, "Intro").getByRole("button", { name: "Unlock Intro" }).click();
    await expect(section(page, "Intro").getByRole("button", { name: "Regenerate Intro" })).toBeEnabled();
  });

  test("the feel changes the rhythm", async ({ page }) => {
    const fast = await sectionText(page, "Intro");
    await feel(page, /HALF-TIME/).click();
    const half = await sectionText(page, "Intro");
    expect(half).not.toBe(fast);
    await feel(page, /MID-TEMPO/).click();
    expect(await sectionText(page, "Intro")).not.toBe(half);
    // Breakdown is always half-time.
    const breakdown = await sectionText(page, "Breakdown");
    await feel(page, /FAST PUNK/).click();
    expect(await sectionText(page, "Breakdown")).toBe(breakdown);
  });

  test("the Mid-Tempo stepper runs 120 to 150", async ({ page }) => {
    await expect(page.getByLabel("Mid-tempo BPM")).toHaveCount(0);
    await feel(page, /MID-TEMPO/).click();
    const slider = page.getByLabel("Mid-tempo BPM");
    await expect(slider).toHaveValue("140");
    const down = page.getByRole("button", { name: "Decrease tempo" });
    const up = page.getByRole("button", { name: "Increase tempo" });
    for (let i = 0; i < 25; i++) if (await down.isEnabled()) await down.click();
    await expect(slider).toHaveValue("120");
    await expect(down).toBeDisabled();
    await slider.fill("150");
    await expect(slider).toHaveValue("150");
    await expect(up).toBeDisabled();
    await expect(feel(page, /MID-TEMPO/)).toContainText("150 BPM");
    // Fast Punk and Half-Time show fixed readouts.
    await expect(feel(page, /FAST PUNK/)).toContainText("180 BPM");
    await expect(feel(page, /HALF-TIME/)).toContainText("90 BPM");
  });

  test("the key is kept between the Generator and Chords", async ({ page }) => {
    await key(page, "F# / Gb").click();
    await openMenu(page);
    await page.locator("#site-menu").getByRole("link", { name: /Chords/ }).click();
    await expect(page).toHaveURL(/\/chords\/$/);
    await expect(key(page, "F# / Gb")).toHaveAttribute("aria-checked", "true");
    await key(page, "C").click();
    await openMenu(page);
    await page.locator("#site-menu").getByRole("link", { name: /Generator/ }).click();
    await expect(page).toHaveURL(/\/generator\/$/);
    await expect(key(page, "C")).toHaveAttribute("aria-checked", "true");
  });
});
