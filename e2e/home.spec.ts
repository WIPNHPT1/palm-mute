import { expect, gotoAndSettle, horizontalOverflow, lightOnly, onlyAtWidths, projectWidth, test } from "./fixtures";

// The home page (docs/mockups/home-bento-eye-candy.html, owner's pick: "Live session · Bento"; the hero is "Studio
// glass", docs/mockups/home-hero-premium.html): a live Song Generator card in the hero, the stats, a Bento grid of working tiles, questions, encore.

test.describe("home", () => {
  test("the hero: headline, CTAs, and a live card in A", async ({ page }) => {
    await gotoAndSettle(page, "/");
    await expect(page.getByRole("heading", { level: 1, name: "Songwriting formulas from the bands that built pop-punk." })).toBeVisible();
    await expect(page.getByRole("link", { name: "START WRITING" }).first()).toHaveAttribute("href", /\/generator\/$/);
    await expect(page.getByRole("link", { name: /Open the Chord Lab/ })).toHaveAttribute("href", /\/chords\/$/);
    await expect(page.locator("[data-live-card] .hb-chip b")).toHaveText(["A5", "E5", "F#5", "D5"]);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });

  test("the live card's tab plays the loop in the key, one bar per chord, with the lit chip", async ({ page }, info) => {
    onlyAtWidths(info, [390, 1440]);
    lightOnly(info);
    await gotoAndSettle(page, "/");
    const tab = page.locator("[data-live-card] .hb-tab");
    const rows = async () => (await tab.textContent())!.split("\n").map((r) => r.trimEnd());
    // A: A5 (A open, D 2nd), E5 (E open, A 2nd), F#5 (E 2nd, A 4th), D5 (D open, G 2nd), eight strums a bar
    expect(await rows()).toEqual([
      "  A5               E5               F#5              D5",
      "e|----------------|----------------|----------------|----------------|",
      "B|----------------|----------------|----------------|----------------|",
      "G|----------------|----------------|----------------|2-2-2-2-2-2-2-2-|",
      "D|2-2-2-2-2-2-2-2-|----------------|----------------|0-0-0-0-0-0-0-0-|",
      "A|0-0-0-0-0-0-0-0-|2-2-2-2-2-2-2-2-|4-4-4-4-4-4-4-4-|----------------|",
      "E|----------------|0-0-0-0-0-0-0-0-|2-2-2-2-2-2-2-2-|----------------|",
      "  P.M.------------ P.M.------------ P.M.------------ P.M.------------",
    ]);
    // the bar lit in the tab is the chip lit above it
    await expect(tab).toHaveAttribute("data-bar", /[0-3]/, { timeout: 5000 });
    for (let i = 0; i < 3; i++) {
      const [bar, chip] = await page.evaluate(() => {
        const card = document.querySelector("[data-live-card]")!;
        return [card.querySelector(".hb-tab")!.getAttribute("data-bar"), String([...card.querySelectorAll(".hb-chip")].findIndex((c) => c.classList.contains("now")))];
      });
      expect(bar).toBe(chip);
      await page.waitForTimeout(450);
    }
    // in F: F5 on the low E string, C5 on the A string, D5 on the open D string, A#5 on the A string
    await page.getByRole("group", { name: "Key, in the live card" }).getByRole("button", { name: "F", exact: true }).click();
    expect((await rows())[0]).toBe("  F5               C5               D5               A#5");
    expect((await rows())[6]).toBe("E|1-1-1-1-1-1-1-1-|----------------|----------------|----------------|");
  });

  test("the key, feel and speed drive the whole page", async ({ page }, info) => {
    onlyAtWidths(info, [390, 1440]);
    lightOnly(info);
    await gotoAndSettle(page, "/");
    const live = page.locator("[data-live-bpm]");
    await expect(live).toHaveAttribute("data-live-bpm", "180");
    await page.getByRole("group", { name: "Feel" }).getByRole("button", { name: /POP STRUM/ }).click();
    await expect(live).toHaveAttribute("data-live-bpm", "150");
    await page.getByRole("group", { name: "Practice speed" }).getByRole("button", { name: "50%" }).click();
    await expect(live).toHaveAttribute("data-live-bpm", "75");
    await page.getByRole("group", { name: "Key", exact: true }).getByRole("button", { name: "D", exact: true }).click();
    // both chip rows, the live card's and the key tile's, re-voice in D
    await expect(page.locator("[data-live-card] .hb-chip b")).toHaveText(["D5", "A5", "B5", "G5"]);
    await expect(page.getByRole("group", { name: "Key, in the live card" }).getByRole("button", { name: "D", exact: true })).toHaveAttribute("aria-pressed", "true");
  });

  test("the length slider plans the song with the Generator's own planner", async ({ page }, info) => {
    onlyAtWidths(info, [1440]);
    lightOnly(info);
    await gotoAndSettle(page, "/");
    const slider = page.getByRole("slider", { name: "Song length" });
    await slider.fill("0");
    await expect(slider).toHaveAttribute("aria-valuetext", "2:30");
    await slider.fill("12");
    await expect(slider).toHaveAttribute("aria-valuetext", "5:30");
  });

  test("every tile is there, controls are tappable, and nothing spills sideways", async ({ page }, info) => {
    await gotoAndSettle(page, "/");
    await expect(page.locator(".hb-tile")).toHaveCount(20);
    const u = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--u")) || 1);
    const small = await page.locator(".hb button, .hb a, .hb input").evaluateAll((els, min) =>
      // layout size, not the on-screen box: the hero's live card is tilted in 3D, which shrinks its pills' boxes on screen
      els.filter((e) => e.getClientRects().length).map((e) => ({ t: (e.textContent || e.getAttribute("aria-label") || "").trim().slice(0, 20), w: (e as HTMLElement).offsetWidth, h: (e as HTMLElement).offsetHeight })).filter(({ w, h }) => w < min || h < min).map(({ t }) => t), 43.5 * u);
    expect(small).toEqual([]);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    if (projectWidth(info) >= 834) await expect(page.locator('canvas.stage-bg[data-stage-bg="osc"]')).toHaveCount(1);
  });

  test("the studio light moves by transform and opacity only, and the glass has no live blur", async ({ page }, info) => {
    onlyAtWidths(info, [390, 1440]);
    lightOnly(info);
    await gotoAndSettle(page, "/");
    const lights = await page.locator(".hb-aura").evaluateAll((els) => els.map((e) => { const cs = getComputedStyle(e); return { blend: cs.mixBlendMode, filter: cs.filter, anim: cs.animationName }; }));
    expect(lights).toEqual([
      { blend: "normal", filter: "none", anim: "hb-aura-a" },
      { blend: "normal", filter: "none", anim: "hb-aura-b" },
      { blend: "normal", filter: "none", anim: "hb-aura-a" },
    ]);
    const glass = page.locator("[data-live-card]");
    expect(await glass.evaluate((e) => getComputedStyle(e).backdropFilter)).toMatch(/^(none|)$/);
    expect(await page.locator(".hb-grain").evaluate((e) => getComputedStyle(e).mixBlendMode)).toBe("normal");
  });

  test("reduced motion: no beat, no animation", async ({ page }, info) => {
    onlyAtWidths(info, [1440]);
    lightOnly(info);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await gotoAndSettle(page, "/");
    const chips = () => page.locator("[data-live-card] .hb-chip.now").count();
    await page.waitForTimeout(1000);
    expect(await chips()).toBe(0);
    expect(await page.locator(".hb-aura").first().evaluate((e) => getComputedStyle(e).animationName)).toBe("none");
    // the tab waits at the start: no bar lit
    await expect(page.locator("[data-live-card] .hb-tab")).not.toHaveAttribute("data-bar", /./);
  });

  test("song titles flip and shuffle", async ({ page }, info) => {
    onlyAtWidths(info, [1440]);
    lightOnly(info);
    await gotoAndSettle(page, "/");
    const board = page.locator(".hb-flaps");
    const first = await board.getAttribute("aria-label");
    await page.getByRole("button", { name: "SHUFFLE" }).click();
    await expect(board).not.toHaveAttribute("aria-label", first!);
  });
});
