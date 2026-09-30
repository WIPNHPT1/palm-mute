import { expect, lightOnly, onlyAtWidths, test } from "./fixtures";
import { feel, key, lastPlayback } from "./helpers";

test.describe("chords UX", () => {
  test.beforeEach(async ({ page }, info) => {
    onlyAtWidths(info, [390, 1440]);
    lightOnly(info);
    await page.goto("/chords/");
  });

  test("selecting a card opens its panel; Esc closes it and returns focus", async ({ page }) => {
    const card = page.getByRole("button", { name: "vi-IV-I-V: show options" });
    await expect(card).toHaveAttribute("aria-expanded", "false");
    await card.click();
    await expect(card).toHaveAttribute("aria-expanded", "true");
    const panel = page.getByRole("region", { name: "vi-IV-I-V in A" });
    await expect(panel).toBeVisible();
    await expect(panel).toContainText("vi = F#5 · IV = D5 · I = A5 · V = E5");
    // The panel sits right under its card (phones) or its row (desktop): nothing overlaps.
    const [c, p] = [await card.boundingBox(), await panel.boundingBox()];
    expect(p!.y).toBeGreaterThanOrEqual(c!.y + c!.height);
    await panel.getByRole("button", { name: "USE IN MY SONG" }).focus();
    await page.keyboard.press("Escape");
    await expect(panel).toHaveCount(0);
    await expect(card).toBeFocused();
    // Keyboard opens it too, and only one is open at a time.
    await page.keyboard.press("Enter");
    await expect(page.getByRole("region", { name: "vi-IV-I-V in A" })).toBeVisible();
    await page.getByRole("button", { name: "I-IV-V: show options" }).click();
    await expect(page.getByRole("region", { name: /in [A-G]/ })).toHaveCount(1);
    await expect(page.getByRole("region", { name: "I-IV-V in A" })).toBeVisible();
  });

  test("Use in my song sends the key, the Chorus progression and the melody to the Generator", async ({ page }) => {
    await key(page, "C").click();
    await page.getByRole("button", { name: "IV-I-V-vi: show options" }).click();
    await page.getByRole("button", { name: "USE IN MY SONG" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Sent:" })).toContainText("Sent: key of C, IV-I-V-vi as the Chorus, and this Hook intro melody as the Intro.");
    await page.getByRole("link", { name: "Open the Generator" }).click();
    await expect(page).toHaveURL(/\/generator\/$/);
    await expect(key(page, "C")).toHaveAttribute("aria-checked", "true");
    await expect(page.getByRole("button", { name: "Use IV-I-V-vi for the Chorus" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator('section[aria-label="Chorus"] p.sr-only')).toContainText("Chorus, key of C: ");
    await expect(page.locator('section[aria-label="Chorus"] p.sr-only')).toContainText("F5, C5, G5, A5.");
    await expect(page.locator('section[aria-label="Intro"]')).toContainText("4 bars · Hook melody");
  });

  test("the Feel control is shared with the Generator and drives playback", async ({ page }) => {
    await feel(page, /HALF-TIME/).click();
    await page.getByRole("button", { name: "Play I-V-vi-IV" }).click();
    const pb = (await lastPlayback(page))!;
    expect(pb.bars.every((b) => b.feel === "half-time")).toBe(true);
    await page.getByRole("button", { name: "Stop I-V-vi-IV" }).click();
    await feel(page, /MID-TEMPO/).click();
    await expect(page.getByLabel("Mid-tempo BPM")).toHaveValue("140");
    await page.getByRole("link", { name: "Palm/Mute", exact: true }).click();
    await page.getByRole("link", { name: "START WRITING" }).first().click();
    await expect(page).toHaveURL(/\/generator\/$/);
    await expect(feel(page, /MID-TEMPO/)).toHaveAttribute("aria-checked", "true");
  });

  test("the highlighted card is labelled Most common", async ({ page }) => {
    const card = page.locator('[data-progression="I-V-vi-IV"]');
    await expect(card).toContainText("Most common", { ignoreCase: true });
    await page.getByRole("radio", { name: "DARKEST" }).click();
    await expect(card).toContainText("Most common", { ignoreCase: true });
    await expect(page.getByText("Most common", { exact: true })).toHaveCount(1);
  });

  test("play icons only fill while playing", async ({ page }) => {
    const filled = () =>
      page.locator("button[data-playing]").evaluateAll((btns) =>
        btns.filter((b) => {
          const shape = b.querySelector("svg polygon, svg rect")!;
          return getComputedStyle(shape).fill !== "none";
        }).length,
      );
    expect(await filled()).toBe(0);
    await page.getByRole("button", { name: "Play I-V-vi-IV" }).click();
    expect(await filled()).toBe(1);
    await expect(page.getByRole("button", { name: "Stop I-V-vi-IV" })).toHaveAttribute("data-playing", "true");
    await page.getByRole("button", { name: "Stop I-V-vi-IV" }).click();
    expect(await filled()).toBe(0);
  });

  test("chips show their degree", async ({ page }) => {
    const chips = page.locator('[data-progression="I-V-vi-IV"] [data-chip]');
    await expect(chips).toHaveCount(4);
    expect(await chips.locator("> div:first-child").allTextContents()).toEqual(["I", "V", "vi", "IV"]);
    await expect(chips.first()).toHaveAttribute("aria-label", "I chord, A5: A on the A string, open, and E on the D string, 2nd fret");
  });
});
