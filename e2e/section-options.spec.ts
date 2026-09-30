import { type Page } from "@playwright/test";
import { expect, gotoAndSettle, lightOnly, onlyAtWidths, test } from "./fixtures";
import { lastPlayback, parseTab, playedCells, section, tabRows } from "./helpers";

// A section card's Options (docs/song-builder-prd.md §6): collapsed by default; Rhythm, Playing style,
// Structure and Drums; each change applies at once, to that section only, and the audio follows.

const tabOf = (page: Page, label: string) => section(page, label).locator("svg[data-tab]").textContent();
const strip = (page: Page) => page.getByRole("navigation", { name: "Song running order" });
const open = async (page: Page, label: string, tab?: RegExp) => {
  await section(page, label).getByRole("button", { name: `${label} options` }).click();
  if (tab) await section(page, label).getByRole("tab", { name: tab }).click();
};
const others = async (page: Page, except: string) => {
  const out: Record<string, string | null> = {};
  for (const l of ["Intro", "Verse", "Pre-chorus", "Chorus", "Solo", "Breakdown", "Ending"]) if (l !== except) out[l] = await tabOf(page, l);
  return out;
};

test.describe("section options", () => {
  test.beforeEach(async ({ page }, info) => {
    onlyAtWidths(info, [390, 1440]);
    lightOnly(info);
    await gotoAndSettle(page, "/generator/");
  });

  test("Rhythm: pick a groove for one section; ▷ previews it without changing the song", async ({ page }) => {
    await open(page, "Verse");
    const verse = section(page, "Verse");
    const grooves = verse.getByRole("list", { name: "Verse grooves" }).getByRole("listitem");
    await expect(grooves).toHaveCount(6);
    await expect(verse.getByRole("button", { name: "Use Gallop" })).toHaveAttribute("aria-pressed", "true");
    // ▷ plays the groove on its own, looped; the card and the song stay as they are.
    const before = await tabOf(page, "Verse");
    await verse.getByRole("button", { name: "Play Stop-time groove" }).click();
    const pb = (await lastPlayback(page))!;
    expect(pb.loop).toBe(true);
    expect(await tabOf(page, "Verse")).toBe(before);
    await verse.getByRole("button", { name: "Stop Stop-time groove" }).click();
    // Using it changes the Verse, and nothing else.
    const rest = await others(page, "Verse");
    await verse.getByRole("button", { name: "Use Stop-time" }).click();
    await expect(verse.getByRole("button", { name: "Use Stop-time" })).toHaveAttribute("aria-pressed", "true");
    expect(await tabOf(page, "Verse")).not.toBe(before);
    expect(await others(page, "Verse")).toEqual(rest);
    await expect(verse.locator("[data-details]")).toContainText("Stop-time");
    // The card plays what it now shows (the groove the preview played).
    await verse.getByRole("button", { name: "Play Verse" }).click();
    const tab = parseTab(await tabRows(page, "Verse"));
    playedCells((await lastPlayback(page))!).forEach((bar, i) => expect(bar).toEqual(tab[i % tab.length]));
    await verse.getByRole("button", { name: "Stop Verse" }).click();
    // It sticks through BUILD AGAIN; RESET goes back to what the take chooses.
    await page.getByRole("button", { name: "BUILD AGAIN" }).click();
    await expect(verse.getByRole("button", { name: "Use Stop-time" })).toHaveAttribute("aria-pressed", "true");
    await verse.getByRole("button", { name: "RESET TO THE TAKE" }).click();
    await expect(verse.getByRole("button", { name: "RESET TO THE TAKE" })).toHaveCount(0);
  });

  test("an unplayable groove says why and can't be picked", async ({ page }) => {
    // The open-string pedal riff needs chords rooted on open strings: in C the Intro plays C5 and G5, and C isn't.
    await page.getByRole("radiogroup", { name: "Key" }).getByRole("radio", { name: "C", exact: true }).click();
    await open(page, "Intro");
    const intro = section(page, "Intro");
    const pedal = intro.getByRole("button", { name: "Use Open-string pedal riff" });
    await expect(pedal).toBeDisabled();
    await expect(intro.getByRole("list", { name: "Intro grooves" })).toContainText("Needs chords rooted on open strings");
  });

  test("Playing style: palm-muted or open throughout; 2- or 3-note shapes", async ({ page }) => {
    await open(page, "Chorus", /STYLE/);
    const chorus = section(page, "Chorus");
    await chorus.getByRole("radiogroup", { name: "Chorus sound" }).getByRole("radio", { name: "PALM-MUTED" }).click();
    await expect(chorus.locator('svg[data-tab] text[data-row="header"]').first()).toContainText("P.M.");
    await expect(chorus.locator("svg[data-tab]")).not.toContainText("let ring");
    await chorus.getByRole("radiogroup", { name: "Chorus shapes" }).getByRole("radio", { name: "2-NOTE" }).click();
    for (const bar of parseTab(await tabRows(page, "Chorus"))) for (const cell of bar) if (cell && cell !== "x") expect(cell.notes.length).toBe(2);
    await chorus.getByRole("radiogroup", { name: "Chorus shapes" }).getByRole("radio", { name: "3-NOTE" }).click();
    for (const bar of parseTab(await tabRows(page, "Chorus"))) for (const cell of bar) if (cell && cell !== "x") expect(cell.notes.length).toBe(3);
  });

  test("Structure: how long each place plays, Verse 2's push, the Last chorus up a tone", async ({ page }) => {
    await open(page, "Verse", /STRUCTURE/);
    const verse = section(page, "Verse");
    // Verse 1 plays 16 bars at the default length; fix it at 8 and the whole song gets shorter.
    await expect(strip(page).getByRole("button", { name: /^Play the song from Verse 1 \(\d+:\d\d, 16 bars/ })).toHaveCount(1);
    await verse.getByRole("radiogroup", { name: "Verse: each time it plays" }).getByRole("radio", { name: /8 BARS/ }).click();
    await expect(strip(page).getByRole("button", { name: /^Play the song from Verse 1 \(\d+:\d\d, 8 bars/ })).toHaveCount(1);
    await expect(strip(page).getByRole("button", { name: /^Play the song from Verse 2 \(.*, 8 bars/ })).toHaveCount(1);
    // Verse 2 without its push.
    await verse.getByRole("radiogroup", { name: "Verse 2" }).getByRole("radio", { name: "SAME AS VERSE 1" }).click();
    await expect(strip(page)).not.toContainText("adds a push");
    // The Last chorus up a whole tone: its bars play two semitones above the Chorus card's.
    await open(page, "Chorus", /STRUCTURE/);
    await section(page, "Chorus").getByRole("radiogroup", { name: "Last chorus" }).getByRole("radio", { name: "UP A TONE" }).click();
    const last = strip(page).getByRole("button", { name: /^Play the song from Last chorus/ });
    await expect(last).toHaveAttribute("aria-label", /up a tone/);
    await last.click();
    const chorus = parseTab(await tabRows(page, "Chorus"));
    const played = playedCells((await lastPlayback(page))!);
    played.slice(0, chorus.length).forEach((bar, b) =>
      bar.forEach((cell, c) => {
        const want = chorus[b][c];
        if (cell && cell !== "x" && want && want !== "x") expect(cell.notes[0] % 12).toBe((want.notes[0] + 2) % 12);
      }),
    );
    await page.getByRole("button", { name: "STOP SONG" }).click();
  });

  test("Drums: none under one section", async ({ page }) => {
    await open(page, "Breakdown", /DRUMS/);
    const breakdown = section(page, "Breakdown");
    await breakdown.getByRole("radiogroup", { name: "Breakdown drums" }).getByRole("radio", { name: "NO DRUMS" }).click();
    await breakdown.getByRole("button", { name: "Play Breakdown" }).click();
    expect((await lastPlayback(page))!.bars.every((b) => b.drums === false)).toBe(true);
    await breakdown.getByRole("button", { name: "Stop Breakdown" }).click();
    await section(page, "Chorus").getByRole("button", { name: "Play Chorus" }).click();
    expect((await lastPlayback(page))!.bars.some((b) => b.drums === false)).toBe(false);
  });

  test("the Solo's style and length; the Ending's chorus tag", async ({ page }) => {
    await open(page, "Solo");
    const solo = section(page, "Solo");
    await solo.getByRole("radiogroup", { name: "Solo style" }).getByRole("radio", { name: "SHRED" }).click();
    await expect(solo.locator("[data-details]")).toContainText("Shred solo");
    await solo.getByRole("tab", { name: /STRUCTURE/ }).click();
    await solo.getByRole("radiogroup", { name: "Solo length" }).getByRole("radio", { name: "16 BARS" }).click();
    await expect(solo.locator("[data-details]")).toContainText("16 bars");
    await open(page, "Ending");
    const ending = section(page, "Ending");
    await ending.getByRole("button", { name: "Use Chorus tag" }).click();
    await expect(ending.locator("[data-details]")).toContainText("3 bars · Chorus tag");
    // The tag: the progression's last two chords (vi, IV in I-V-vi-IV), then home.
    await expect(ending.locator("p.sr-only")).toContainText("F#5, D5, A5");
  });

  test("a locked section's options say why they can't change", async ({ page }) => {
    await section(page, "Verse").getByRole("button", { name: "Lock Verse" }).click();
    await open(page, "Verse");
    await expect(section(page, "Verse").locator("[data-options-panel]")).toContainText("The Verse is locked. Unlock it to change its options.");
  });
});
