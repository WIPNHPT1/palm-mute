import { expect, lightOnly, onlyAtWidths, openMenu, test } from "./fixtures";
import { feel, key, lastPlayback, parseTab, playedCells, section, tabRows } from "./helpers";

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
    const before = await verse.locator("svg[data-tab]").textContent();
    await key(page, "C").click();
    expect(await verse.locator("svg[data-tab]").textContent()).toBe(before); // still frozen
    await verse.getByRole("button", { name: "Update to C" }).click();
    await expect(verse).toContainText("Locked in C");
    await expect(verse.getByRole("button", { name: /^Update to/ })).toHaveCount(0);
    expect(await verse.locator("svg[data-tab]").textContent()).not.toBe(before);
    await expect(verse.getByRole("button", { name: "Unlock Verse" })).toHaveAttribute("aria-pressed", "true");
    await expect(verse).toContainText("C5"); // screen-reader text follows the new key
  });

  test("each section plays exactly what its tab shows, at the selected feel", async ({ page }) => {
    await feel(page, /HALF-TIME/).click();
    for (const label of ["Intro", "Verse", "Chorus", "Solo", "Breakdown"]) {
      const card = section(page, label);
      await card.getByRole("button", { name: `Play ${label}` }).click();
      await expect(card.getByRole("button", { name: `Stop ${label}` })).toHaveAttribute("aria-pressed", "true");
      const pb = (await lastPlayback(page))!;
      expect(pb.loop).toBe(true);
      expect(pb.bpm).toBe(180);
      const tab = parseTab(await tabRows(page, label));
      const played = playedCells(pb);
      // The Verse's tab is played twice (×2); everything else once per loop.
      expect(played.length % tab.length).toBe(0);
      played.forEach((bar, i) => expect(bar, `${label} bar ${i + 1}`).toEqual(tab[i % tab.length]));
      // Locked Verse keeps the feel it was locked in; the rest follow the page (Breakdown is always half-time).
      expect(pb.bars.every((b) => b.feel === (label === "Verse" ? "fast-punk" : "half-time"))).toBe(true);
    }
    // Regenerating while playing restarts with the new take.
    const intro = section(page, "Intro");
    await intro.getByRole("button", { name: "Play Intro" }).click();
    const before = playedCells((await lastPlayback(page))!);
    await intro.getByRole("button", { name: "Regenerate Intro" }).click();
    const after = playedCells((await lastPlayback(page))!);
    expect(after).not.toEqual(before);
    expect(after).toEqual(parseTab(await tabRows(page, "Intro")));
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
    const tabs: Record<string, ReturnType<typeof parseTab>> = {};
    for (const label of ["Intro", "Verse", "Chorus", "Solo", "Breakdown"]) tabs[label] = parseTab(await tabRows(page, label));
    // Intro 4 + Verse 4 × 2 + Chorus 4 + Solo 8 (the lead engine; its line is compared) + Breakdown 4.
    const expected = [...tabs.Intro, ...tabs.Verse, ...tabs.Verse, ...tabs.Chorus, ...tabs.Solo, ...tabs.Breakdown];
    expect(playedCells(pb)).toEqual(expected);
    expect(pb.bars.slice(0, 4).every((b) => b.feel === "mid-tempo")).toBe(true);
    // The Verse is locked (by default), so it keeps the feel it was locked in, exactly as its card shows.
    expect(pb.bars.slice(4, 12).every((b) => b.feel === "fast-punk")).toBe(true);
    expect(pb.bars.slice(12, 16).every((b) => b.feel === "mid-tempo")).toBe(true);
    expect(pb.bars.slice(24).every((b) => b.feel === "half-time")).toBe(true); // Breakdown is always half-time
    expect(pb.bars.slice(16, 24).every((b) => b.lead && b.cells.some(Boolean))).toBe(true); // the solo plays over its chords
    await page.getByRole("button", { name: "STOP SONG" }).click();
    await expect(page.getByRole("button", { name: "PLAY SONG" })).toHaveAttribute("aria-pressed", "false");
  });

  test("clicking a Power Chords row makes it the Chorus progression", async ({ page }) => {
    const chorus = section(page, "Chorus");
    const before = await chorus.locator("svg[data-tab]").textContent();
    await page.getByRole("button", { name: "Use vi-IV-I-V for the Chorus" }).click();
    await expect(page.getByRole("button", { name: "Use vi-IV-I-V for the Chorus" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "Use I-V-vi-IV for the Chorus" })).toHaveAttribute("aria-pressed", "false");
    expect(await chorus.locator("svg[data-tab]").textContent()).not.toBe(before);
    await expect(chorus.locator("p.sr-only")).toContainText("Chorus, key of A: ");
    await expect(chorus.locator("p.sr-only")).toContainText("F#5, D5, A5, E5.");
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
