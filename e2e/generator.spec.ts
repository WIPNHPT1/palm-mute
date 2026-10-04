import { type Page } from "@playwright/test";
import { expect, lightOnly, onlyAtWidths, test } from "./fixtures";
import { lastPlayback } from "./helpers";

const section = (page: Page, label: string) => page.locator(`section[aria-label="${label}"]`);
const tab = (page: Page, label: string) => section(page, label).locator("svg[data-tab]");
/** A section's whole tab (rhythm and notes), as one string for before/after comparisons. */
const sectionText = async (page: Page, label: string) => `${await tab(page, label).textContent()}`;
/** Chord names on the song's progression in the setup's Chords step (the default progression has 4 chords). */
async function panelChords(page: Page): Promise<string[]> {
  return page.locator('[data-control="Chords"] [data-progression="I-V-vi-IV"] [data-chip] > div:nth-child(2)').allTextContents();
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
    // Every section starts unlocked (DECISIONS.md).
    for (const label of ["Intro", "Verse", "Chorus", "Solo", "Breakdown"]) {
      await expect(section(page, label).getByRole("button", { name: `Lock ${label}` })).toHaveAttribute("aria-pressed", "false");
      await expect(section(page, label).getByRole("button", { name: `Regenerate ${label}` })).toBeEnabled();
    }
    // A locked section can't be regenerated.
    await section(page, "Verse").getByRole("button", { name: "Lock Verse" }).click();
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
    for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "BUILD AGAIN", exact: true }).click();
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
    // The Verse strums, so its rhythm follows the feel (an Intro riff keeps its notes in every feel).
    const fast = await sectionText(page, "Verse");
    await feel(page, /HALF-TIME/).click();
    const half = await sectionText(page, "Verse");
    expect(half).not.toBe(fast);
    await feel(page, /BALLAD/).click();
    expect(await sectionText(page, "Verse")).not.toBe(half);
    // Breakdown is always half-time.
    const breakdown = await sectionText(page, "Breakdown");
    await feel(page, /FAST PUNK/).click();
    expect(await sectionText(page, "Breakdown")).toBe(breakdown);
  });

  test("Mid-Tempo plays at a fixed 140 BPM, with no tempo control", async ({ page }) => {
    await feel(page, /MID-TEMPO/).click();
    await expect(feel(page, /MID-TEMPO/)).toContainText("140 BPM");
    await expect(page.getByLabel("Mid-tempo BPM")).toHaveCount(0);
    await page.getByRole("button", { name: "PLAY SONG" }).click();
    expect((await lastPlayback(page))!.bpm).toBe(140);
    await page.getByRole("button", { name: "STOP SONG" }).click();
    // Fast Punk and Half-Time show their fixed readouts too.
    await expect(feel(page, /FAST PUNK/)).toContainText("180 BPM");
    await expect(feel(page, /HALF-TIME/)).toContainText("90 BPM");
  });

  test("keyboard: the Key group is one Tab stop and the arrows change the key", async ({ page }, info) => {
    lightOnly(info);
    const keys = page.getByRole("radiogroup", { name: "Key" }).getByRole("radio");
    // Only the checked key is in the Tab order.
    expect(await keys.evaluateAll((els) => els.filter((e) => (e as HTMLElement).tabIndex === 0).length)).toBe(1);
    await page.getByRole("radiogroup", { name: "Key" }).getByRole("radio", { checked: true }).focus();
    const before = await page.getByRole("radiogroup", { name: "Key" }).getByRole("radio", { checked: true }).getAttribute("aria-label");
    await page.keyboard.press("ArrowRight");
    const after = page.getByRole("radiogroup", { name: "Key" }).getByRole("radio", { checked: true });
    await expect(after).toBeFocused();
    expect(await after.getAttribute("aria-label")).not.toBe(before);
    // Feel too: ArrowRight picks the next feel and the song's tempo follows.
    const feels = page.getByRole("radiogroup", { name: "Feel" }).getByRole("radio");
    await feels.nth(0).focus();
    await page.keyboard.press("ArrowRight");
    await expect(feels.nth(1)).toHaveAttribute("aria-checked", "true");
    // Shift+Tab leaves the Feel group in one press.
    await page.keyboard.press("Shift+Tab");
    expect(await page.evaluate(() => document.activeElement?.closest('[role="radiogroup"]')?.getAttribute("aria-label"))).not.toBe("Feel");
  });
});
