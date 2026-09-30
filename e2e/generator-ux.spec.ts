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
    await expect(verse).not.toContainText("Locked in"); // every section starts unlocked
    await verse.getByRole("button", { name: "Lock Verse" }).click();
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
    for (const label of ["Intro", "Verse", "Pre-chorus", "Chorus", "Solo", "Breakdown", "Ending"]) {
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
      // Every section follows the page's feel (and the Breakdown is always half-time).
      expect(pb.bars.every((b) => b.feel === "half-time")).toBe(true);
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

  test("Play song plays the Standard form once, top to bottom", async ({ page }) => {
    await feel(page, /MID-TEMPO/).click();
    await page.getByRole("button", { name: "PLAY SONG" }).click();
    await expect(page.getByRole("button", { name: "STOP SONG" })).toHaveAttribute("aria-pressed", "true");
    const pb = (await lastPlayback(page))!;
    expect(pb.loop).toBe(false);
    expect(pb.bpm).toBe(140);
    const tabs: Record<string, ReturnType<typeof parseTab>> = {};
    for (const label of ["Intro", "Verse", "Pre-chorus", "Chorus", "Solo", "Breakdown", "Ending"]) tabs[label] = parseTab(await tabRows(page, label));
    // data/song-forms.json, Standard: Intro, Verse 1 (4 bars × 2), Pre-chorus, Chorus, Verse 2, Pre-chorus,
    // Chorus, Solo (8), Breakdown, Last chorus (× 2), Ending (1): 57 bars.
    const verse = [...tabs.Verse, ...tabs.Verse];
    const pre = tabs["Pre-chorus"];
    const expected = [...tabs.Intro, ...verse, ...pre, ...tabs.Chorus, ...verse, ...pre, ...tabs.Chorus, ...tabs.Solo, ...tabs.Breakdown, ...tabs.Chorus, ...tabs.Chorus, ...tabs.Ending];
    const played = playedCells(pb);
    expect(played).toHaveLength(57);
    // Verse 2 is Verse 1 with one push (the only declared variation): bars 21–28 may differ only on a bar's last eighth.
    const diffs: string[] = [];
    played.forEach((bar, b) =>
      bar.forEach((cell, c) => {
        if (JSON.stringify(cell) !== JSON.stringify(expected[b][c])) diffs.push(`${b + 1}:${c + 1}`);
      }),
    );
    expect(diffs.length).toBeGreaterThan(0);
    for (const d of diffs) {
      const [b, c] = d.split(":").map(Number);
      expect(b >= 21 && b <= 28 && c === 8, `bar ${b} cell ${c} differs outside Verse 2's push`).toBe(true);
    }
    // Everything plays at the page's feel, except the Breakdown (always half-time); the Solo is a lead line.
    const feels = pb.bars.map((b) => b.feel);
    expect(feels.slice(0, 44).every((f) => f === "mid-tempo")).toBe(true);
    expect(feels.slice(44, 48).every((f) => f === "half-time")).toBe(true);
    expect(feels.slice(48).every((f) => f === "mid-tempo")).toBe(true);
    expect(pb.bars.slice(36, 44).every((b) => b.lead && b.cells.some(Boolean))).toBe(true); // the solo plays over its chords
    await page.getByRole("button", { name: "STOP SONG" }).click();
    await expect(page.getByRole("button", { name: "PLAY SONG" })).toHaveAttribute("aria-pressed", "false");
  });

  test("the running order plays the song from any part and lights it", async ({ page }) => {
    const strip = page.getByRole("navigation", { name: "Song running order" });
    await expect(strip.getByRole("button")).toHaveCount(11);
    await strip.getByRole("button", { name: /^Play the song from Last chorus/ }).click();
    await expect(page.getByRole("button", { name: "STOP SONG" })).toHaveAttribute("aria-pressed", "true");
    const pb = (await lastPlayback(page))!;
    // Last chorus (4 bars × 2) + Ending (1).
    expect(pb.bars).toHaveLength(9);
    expect(playedCells(pb).slice(0, 4)).toEqual(parseTab(await tabRows(page, "Chorus")));
    await expect(strip.getByRole("button", { name: /^Play the song from Last chorus/ })).toHaveAttribute("data-active", "true");
    await expect(section(page, "Chorus")).toHaveAttribute("data-active", "true");
    await expect(section(page, "Chorus").locator("[data-uses] li[data-active='true']")).toHaveText("Last chorus · played twice");
    // Locking a part shows on every place it plays.
    await section(page, "Verse").getByRole("button", { name: "Lock Verse" }).click();
    await expect(strip.locator("button", { hasText: "Verse" }).locator("svg")).toHaveCount(2);
    await page.getByRole("button", { name: "STOP SONG" }).click();
    await expect(strip.locator("[data-active='true']")).toHaveCount(0);
  });

  test("clicking a Power Chords row makes it the Chorus progression", async ({ page }) => {
    const chorus = section(page, "Chorus");
    const before = await chorus.locator("svg[data-tab]").textContent();
    await page.getByRole("button", { name: "Use vi-IV-I-V for the song" }).click();
    await expect(page.getByRole("button", { name: "Use vi-IV-I-V for the song" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "Use I-V-vi-IV for the song" })).toHaveAttribute("aria-pressed", "false");
    expect(await chorus.locator("svg[data-tab]").textContent()).not.toBe(before);
    await expect(chorus.locator("p.sr-only")).toContainText("Chorus, key of A: ");
    await expect(chorus.locator("p.sr-only")).toContainText("F#5, D5, A5, E5.");
    await expect(page.getByText("Strums for vi-IV-I-V · Key of A")).toBeVisible();
    // A locked Chorus keeps its progression and offers the update instead.
    await chorus.getByRole("button", { name: "Lock Chorus" }).click();
    await page.getByRole("button", { name: "Use I-IV-V for the song" }).click();
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
