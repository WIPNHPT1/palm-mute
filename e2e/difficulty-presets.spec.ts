import { expect, gotoAndSettle, lightOnly, onlyAtWidths, test } from "./fixtures";
import { feel, parseTab, section, tabRows } from "./helpers";

// The Difficulty control and style presets (docs/song-builder-prd.md B10–B11).
test.describe("difficulty and presets", () => {
  test.beforeEach(async ({ page }, info) => {
    onlyAtWidths(info, [390, 1440]);
    lightOnly(info);
    await gotoAndSettle(page, "/generator/");
  });

  test("Beginner: eighth notes and 2-note shapes everywhere, no riffs; harder grooves say why", async ({ page }) => {
    const difficulty = page.getByRole("radiogroup", { name: "Difficulty" });
    await expect(difficulty.getByRole("radio", { name: "INTERMEDIATE" })).toHaveAttribute("aria-checked", "true");
    await difficulty.getByRole("radio", { name: "BEGINNER" }).click();
    await expect(page.locator("[data-difficulty-note]")).toContainText("2-note shapes");
    for (const label of ["Intro", "Verse", "Pre-chorus", "Chorus", "Breakdown", "Ending"]) {
      const tab = parseTab(await tabRows(page, label));
      for (const bar of tab) {
        expect(bar.length, `${label}: an eighth-note bar`).toBe(8);
        for (const cell of bar) if (cell && cell !== "x") expect(cell.notes.length, `${label}: a 2-note shape`).toBeLessThanOrEqual(2);
      }
    }
    // The Verse's gallop needs sixteenths: it's greyed with the level it needs.
    await section(page, "Verse").getByRole("button", { name: "Verse options" }).click();
    await expect(section(page, "Verse").getByRole("button", { name: "Use Gallop" })).toBeDisabled();
    await expect(section(page, "Verse").getByRole("list", { name: "Verse grooves" })).toContainText("Intermediate and up");
    // The Solo can't shred at Beginner.
    await section(page, "Solo").getByRole("button", { name: "Solo options" }).click();
    await expect(section(page, "Solo").getByRole("radiogroup", { name: "Solo style" }).getByRole("radio")).toHaveText(["CHILL", "CLASSIC"]);
    // Folded summary says the level.
    await page.getByRole("button", { name: "BUILD SONG" }).click();
    await expect(page.getByRole("region", { name: "Song setup" })).toContainText("Beginner");
  });

  test("a style preset sets the feel, length, progression and grooves; Your own clears them", async ({ page }) => {
    const presets = page.getByRole("radiogroup", { name: "Style preset" });
    await presets.getByRole("radio", { name: "EMO" }).click();
    await expect(page.locator("[data-preset-description]")).toContainText("starts on the sad vi chord");
    await expect(feel(page, /MID-TEMPO/)).toHaveAttribute("aria-checked", "true");
    await expect(page.getByRole("button", { name: "Use vi-IV-I-V for the song" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("slider", { name: "Song length" })).toHaveValue("240");
    await expect(section(page, "Chorus").locator("[data-details]")).toContainText("Half-note anthem");
    await expect(section(page, "Ending").locator("[data-details]")).toContainText("Fade out");
    // 2000s pop-punk: the last chorus goes up a tone.
    await presets.getByRole("radio", { name: "2000S POP-PUNK" }).click();
    await expect(feel(page, /POP STRUM/)).toHaveAttribute("aria-checked", "true");
    await expect(page.getByRole("navigation", { name: "Song running order" }).getByRole("button", { name: /^Play the song from Last chorus .*up a tone/ })).toHaveCount(1);
    // A locked section keeps its own groove through a preset.
    await section(page, "Verse").getByRole("button", { name: "Lock Verse" }).click();
    const verse = await section(page, "Verse").locator("svg[data-tab]").textContent();
    await presets.getByRole("radio", { name: "SKATE PUNK" }).click();
    expect(await section(page, "Verse").locator("svg[data-tab]").textContent()).toBe(verse);
    await expect(section(page, "Chorus").locator("[data-details]")).toContainText("Driving eighths");
    // Your own: the preset's options go; the setup it chose stays editable.
    await presets.getByRole("radio", { name: "YOUR OWN" }).click();
    await expect(page.getByRole("navigation", { name: "Song running order" })).not.toContainText("up a tone");
  });
});
