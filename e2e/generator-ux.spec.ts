import { expect, lightOnly, onlyAtWidths, openMenu, test } from "./fixtures";
import { feel, key, lastPlayback, section } from "./helpers";

test.describe("generator UX", () => {
  test.beforeEach(async ({ page }, info) => {
    onlyAtWidths(info, [390, 1440]);
    lightOnly(info);
    await page.goto("/generator/");
  });

  test("a locked section shows its key and can be updated to the new one", async ({ page }) => {
    const verse = section(page, "Verse");
    await expect(verse).toContainText("Locked in A");
    await expect(verse.getByRole("button", { name: /^Update to/ })).toHaveCount(0);
    const before = await verse.locator("pre").textContent();
    await key(page, "C").click();
    expect(await verse.locator("pre").textContent()).toBe(before); // still frozen
    await verse.getByRole("button", { name: "Update to C" }).click();
    await expect(verse).toContainText("Locked in C");
    await expect(verse.getByRole("button", { name: /^Update to/ })).toHaveCount(0);
    expect(await verse.locator("pre").textContent()).not.toBe(before);
    await expect(verse.getByRole("button", { name: "Unlock Verse" })).toHaveAttribute("aria-pressed", "true");
    await expect(verse).toContainText("C5"); // screen-reader text follows the new key
  });

  test("each section plays what its card shows, at the selected feel", async ({ page }) => {
    await feel(page, /HALF-TIME/).click();
    const intro = section(page, "Intro");
    await intro.getByRole("button", { name: "Play Intro" }).click();
    await expect(intro.getByRole("button", { name: "Stop Intro" })).toHaveAttribute("aria-pressed", "true");
    const pb = (await lastPlayback(page))!;
    expect(pb.loop).toBe(true);
    expect(pb.bpm).toBe(180);
    // Intro in A: I I IV IV, root notes only → A2 (45), A2, D3 (50), D3; one bar per tab column.
    expect(pb.bars.map((b) => b.cells.find(Boolean)!.notes)).toEqual([[45], [45], [50], [50]]);
    const strum = (await intro.locator("[data-strum]").textContent())!;
    for (const bar of pb.bars) {
      expect(bar.feel).toBe("half-time");
      expect(bar.cells.map((c) => (c ? "x" : "·")).join("")).toBe([...strum].map((g) => (g === "·" ? "·" : "x")).join(""));
    }
    // Regenerating while playing restarts with the new take.
    await intro.getByRole("button", { name: "Regenerate Intro" }).click();
    const strum2 = (await intro.locator("[data-strum]").textContent())!;
    const pb2 = (await lastPlayback(page))!;
    expect(pb2.bars[0].cells.map((c) => (c ? "x" : "·")).join("")).toBe([...strum2].map((g) => (g === "·" ? "·" : "x")).join(""));
    // Stop.
    await intro.getByRole("button", { name: "Stop Intro" }).click();
    expect(await lastPlayback(page)).toBeNull();
  });

  test("Play song plays every section once, top to bottom", async ({ page }) => {
    await feel(page, /MID-TEMPO/).click();
    await page.getByRole("button", { name: "PLAY SONG" }).click();
    await expect(page.getByRole("button", { name: "STOP SONG" })).toHaveAttribute("aria-pressed", "true");
    const pb = (await lastPlayback(page))!;
    expect(pb.loop).toBe(false);
    expect(pb.bpm).toBe(140);
    // Intro 4 + Verse 4 + Chorus 4 + Solo 1 (the 4-note template lick) + Breakdown 4.
    expect(pb.bars).toHaveLength(17);
    expect(pb.bars.slice(0, 4).every((b) => b.feel === "mid-tempo")).toBe(true);
    // The Verse is locked (by default), so it keeps the feel it was locked in, exactly as its card shows.
    expect(pb.bars.slice(4, 8).every((b) => b.feel === "fast-punk")).toBe(true);
    expect(pb.bars.slice(8, 12).every((b) => b.feel === "mid-tempo")).toBe(true);
    expect(pb.bars.slice(13).every((b) => b.feel === "half-time")).toBe(true); // Breakdown is always half-time
    // Chorus = I-V-vi-IV in A, both notes of each power chord.
    expect(pb.bars.slice(8, 12).map((b) => b.cells.find(Boolean)!.notes)).toEqual([[45, 52], [40, 47], [42, 49], [50, 57]]);
    await page.getByRole("button", { name: "STOP SONG" }).click();
    await expect(page.getByRole("button", { name: "PLAY SONG" })).toHaveAttribute("aria-pressed", "false");
  });

  test("clicking a Power Chords row makes it the Chorus progression", async ({ page }) => {
    const chorus = section(page, "Chorus");
    const before = await chorus.locator("pre").textContent();
    await page.getByRole("button", { name: "Use vi-IV-I-V for the Chorus" }).click();
    await expect(page.getByRole("button", { name: "Use vi-IV-I-V for the Chorus" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "Use I-V-vi-IV for the Chorus" })).toHaveAttribute("aria-pressed", "false");
    expect(await chorus.locator("pre").textContent()).not.toBe(before);
    await expect(chorus.locator("p.sr-only")).toContainText("F#5: F# on the low E string, 2nd fret");
    await expect(page.getByText("Strums for vi-IV-I-V in A")).toBeVisible();
    // A locked Chorus keeps its progression and offers the update instead.
    await chorus.getByRole("button", { name: "Lock Chorus" }).click();
    await page.getByRole("button", { name: "Use I-IV-V for the Chorus" }).click();
    await expect(chorus).toContainText("Locked in A · vi-IV-I-V");
    await chorus.getByRole("button", { name: "Update to I-IV-V" }).click();
    await expect(chorus).toContainText("Locked in A · I-IV-V");
  });

  test("playback stops when leaving the page", async ({ page }) => {
    await page.getByRole("button", { name: "Play I-V-vi-IV" }).click();
    expect(await lastPlayback(page)).not.toBeNull();
    await openMenu(page);
    await page.locator("#site-menu").getByRole("link", { name: /Chords/ }).click();
    await expect(page).toHaveURL(/\/chords\/$/);
    await expect.poll(() => lastPlayback(page)).toBeNull();
    await expect(page.locator('[data-playing="true"]')).toHaveCount(0);
    // And from Chords to the home page.
    await page.getByRole("button", { name: "Play vi-IV-I-V" }).click();
    expect(await lastPlayback(page)).not.toBeNull();
    await openMenu(page);
    await page.locator("#site-menu").getByRole("link", { name: /Count In/ }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect.poll(() => lastPlayback(page)).toBeNull();
  });

  test("the badge says what's stored", async ({ page }) => {
    await expect(page.getByText("CHORD PATTERNS ONLY · NO TABS STORED")).toBeVisible();
    await expect(page.getByText(/ORIGINALITY CHECK/)).toHaveCount(0);
  });
});
