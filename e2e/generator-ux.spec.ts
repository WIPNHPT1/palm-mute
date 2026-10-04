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

  test("Play song plays the running order once, top to bottom, at the planned length", async ({ page }) => {
    await feel(page, /MID-TEMPO/).click();
    const strip = page.getByRole("navigation", { name: "Song running order" });
    // The strip's parts: "Play the song from Verse 2 (1:06, 16 bars, adds a push)".
    const parts = (await strip.getByRole("button").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")!))).map((label) => {
      const [, name, bars, variation] = /^Play the song from (.+) \(\d+:\d\d, (\d+) bars?(?:, (.+))?\)$/.exec(label)!;
      return { name, bars: Number(bars), variation };
    });
    await page.getByRole("button", { name: "PLAY SONG" }).click();
    await expect(page.getByRole("button", { name: "STOP SONG" })).toHaveAttribute("aria-pressed", "true");
    const pb = (await lastPlayback(page))!;
    expect(pb.loop).toBe(false);
    expect(pb.bpm).toBe(140);
    // The song is as long as the plan says (the Length readout) and the strip adds up to it.
    const total = parts.reduce((a, p) => a + p.bars, 0);
    expect(pb.bars).toHaveLength(total);
    await expect(page.locator("[data-song-header]")).toContainText(`${total} bars`);
    // Each part plays its card's tab, repeated to fill its bars; Verse 2's push is the only allowed difference.
    const cardFor = (name: string) =>
      ({ Intro: "Intro", Verse: "Verse", "Pre-chorus": "Pre-chorus", Chorus: "Chorus", Last: "Chorus", Solo: "Solo", Breakdown: "Breakdown", Ending: "Ending" })[name.split(" ")[0]]!;
    const tabs: Record<string, ReturnType<typeof parseTab>> = {};
    for (const label of ["Intro", "Verse", "Pre-chorus", "Chorus", "Solo", "Breakdown", "Ending"]) tabs[label] = parseTab(await tabRows(page, label));
    const played = playedCells(pb);
    let at = 0;
    for (const part of parts) {
      const tab = tabs[cardFor(part.name)];
      for (let b = 0; b < part.bars; b++, at++) {
        const expected = tab[b % tab.length];
        played[at].forEach((cell, c) => {
          if (JSON.stringify(cell) === JSON.stringify(expected[c])) return;
          expect(part.variation === "adds a push" && c === expected.length - 1, `${part.name} bar ${b + 1} cell ${c + 1} differs outside a push`).toBe(true);
        });
      }
    }
    // Everything plays at the page's feel, except the Breakdown (always half-time).
    at = 0;
    for (const part of parts) {
      const feels = pb.bars.slice(at, at + part.bars).map((b) => b.feel);
      expect(feels.every((f) => f === (part.name === "Breakdown" ? "half-time" : "mid-tempo")), part.name).toBe(true);
      if (part.name === "Solo") expect(pb.bars.slice(at, at + part.bars).every((b) => b.lead && b.cells.some(Boolean))).toBe(true); // over its chords
      at += part.bars;
    }
    await page.getByRole("button", { name: "STOP SONG" }).click();
    await expect(page.getByRole("button", { name: "PLAY SONG" })).toHaveAttribute("aria-pressed", "false");
  });

  test("the Length slider reshapes the song at the feel's tempo", async ({ page }) => {
    const readout = page.locator("[data-length-readout]");
    const strip = page.getByRole("navigation", { name: "Song running order" });
    const barsOf = async () => (await strip.getByRole("button").evaluateAll((els) => els.map((e) => Number(/, (\d+) bars?/.exec(e.getAttribute("aria-label")!)![1])))).reduce((a, b) => a + b, 0);
    // Default 3:15 at Fast Punk (180 BPM): a Standard song.
    await expect(page.getByRole("slider", { name: "Song length" })).toHaveValue("195");
    await expect(page.locator("[data-song-header]")).toContainText("Standard");
    await expect(strip.getByRole("button")).toHaveCount(11);
    const lengthAt = async () => {
      const [m, s] = (await readout.textContent())!.split(":").map(Number);
      return m * 60 + s;
    };
    // Each length lands within 4 bars (5.3 s at 180 BPM) of the target, and the strip adds up to it.
    for (const target of [150, 240, 330]) {
      await page.getByRole("slider", { name: "Song length" }).fill(String(target));
      expect(Math.abs((await lengthAt()) - target), `target ${target}s`).toBeLessThanOrEqual(6);
      expect(Math.round(((await barsOf()) * 240) / 180)).toBe(await lengthAt());
    }
    // 5:30 at 180 BPM needs the Extended form: a third verse and chorus.
    await expect(page.locator("[data-song-header]")).toContainText("Extended");
    await expect(strip.getByRole("button", { name: /^Play the song from Verse 3 / })).toHaveCount(1);
    // The same length at Ballad (80 BPM) is far fewer bars.
    const fast = await barsOf();
    await feel(page, /BALLAD/).click();
    expect(await barsOf()).toBeLessThan(fast / 2);
    expect(Math.abs((await lengthAt()) - 330)).toBeLessThanOrEqual(12);
  });

  test("BUILD SONG folds the setup into a summary; EDIT SETUP opens it again", async ({ page }) => {
    const setup = page.getByRole("region", { name: "Set up your song" });
    await expect(setup).toBeVisible();
    const title = await page.locator("[data-song-header] h2").getAttribute("aria-label");
    const chorus = await section(page, "Chorus").locator("svg[data-tab]").textContent();
    await page.getByRole("button", { name: "Use vi-IV-I-V for the song" }).click();
    await page.getByRole("button", { name: "BUILD SONG" }).click();
    await expect(setup).toHaveCount(0);
    const summary = page.getByRole("region", { name: "Song setup" });
    await expect(summary).toContainText("vi-IV-I-V"); // BUILD SONG keeps the chosen progression
    await expect(summary).toContainText("3:15");
    expect(await page.locator("[data-song-header] h2").getAttribute("aria-label")).not.toBe(title); // a new title
    expect(await section(page, "Chorus").locator("svg[data-tab]").textContent()).not.toBe(chorus);
    // BUILD AGAIN: another take, the setup stays folded.
    const before = await section(page, "Verse").locator("svg[data-tab]").textContent();
    await page.getByRole("button", { name: "BUILD AGAIN" }).click();
    await expect(section(page, "Verse").locator("svg[data-tab]")).not.toHaveText(before!);
    await expect(summary).toBeVisible();
    // Tapping a summary item opens the setup at that step.
    await summary.getByRole("button", { name: /^Length: 3:15/ }).click();
    await expect(page.getByRole("region", { name: "Set up your song" })).toBeVisible();
    await expect(page.getByRole("slider", { name: "Song length" })).toBeFocused();
  });

  test("the running order plays the song from any part and lights it", async ({ page }) => {
    const strip = page.getByRole("navigation", { name: "Song running order" });
    await expect(strip.getByRole("button")).toHaveCount(11);
    const last = strip.getByRole("button", { name: /^Play the song from Last chorus/ });
    const lastBars = Number(/, (\d+) bars/.exec((await last.getAttribute("aria-label"))!)![1]);
    await last.click();
    await expect(page.getByRole("button", { name: "STOP SONG" })).toHaveAttribute("aria-pressed", "true");
    const pb = (await lastPlayback(page))!;
    // The Last chorus (its 4 bars, repeated) + the Ending (1).
    expect(pb.bars).toHaveLength(lastBars + 1);
    expect(playedCells(pb).slice(0, 4)).toEqual(parseTab(await tabRows(page, "Chorus")));
    await expect(last).toHaveAttribute("data-active", "true");
    await expect(section(page, "Chorus")).toHaveAttribute("data-active", "true");
    await expect(section(page, "Chorus").locator("[data-uses] li[data-active='true']")).toHaveText(`Last chorus ×${lastBars / 4} · 2:51`);
    // Locking a part shows on every place it plays.
    await section(page, "Verse").getByRole("button", { name: "Lock Verse" }).click();
    await expect(strip.locator("button", { hasText: "Verse" }).locator("svg")).toHaveCount(2);
    await page.getByRole("button", { name: "STOP SONG" }).click();
    await expect(strip.locator("[data-active='true']")).toHaveCount(0);
  });

  test("tapping a progression in the Chords step makes it the song's progression", async ({ page }) => {
    const chorus = section(page, "Chorus");
    const before = await chorus.locator("svg[data-tab]").textContent();
    await page.getByRole("button", { name: "Use vi-IV-I-V for the song" }).click();
    await expect(page.getByRole("button", { name: "Use vi-IV-I-V for the song" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "Use I-V-vi-IV for the song" })).toHaveAttribute("aria-pressed", "false");
    expect(await chorus.locator("svg[data-tab]").textContent()).not.toBe(before);
    await expect(chorus.locator("p.sr-only")).toContainText("Chorus, key of A: ");
    await expect(chorus.locator("p.sr-only")).toContainText("F#5, D5, A5, E5.");
    await expect(page.locator('[data-control="Chords"]')).toContainText("vi-IV-I-V");
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
    await page.locator("#site-menu").getByRole("link", { name: /Chord Lab/ }).click();
    await expect(page).toHaveURL(/\/chords\/$/);
    await expect.poll(() => lastPlayback(page)).toBeNull();
    await expect(page.locator('[data-playing="true"]')).toHaveCount(0);
    // And from the Chord Lab to the home page.
    await page.getByRole("button", { name: /^Play G .* strummed$/ }).first().click();
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
