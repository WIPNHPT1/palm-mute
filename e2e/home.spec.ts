import { expect, gotoAndSettle, horizontalOverflow, lightOnly, onlyAtWidths, test } from "./fixtures";
import { feel, key } from "./helpers";

// The home page (docs/mockups/home-bento-eye-candy.html, owner's pick: "Live session · Bento"; the hero is "Studio
// glass", docs/mockups/home-hero-premium.html): a live Song Generator card in the hero, the stats, a Bento grid of working tiles, questions, encore.

test.describe("home", () => {
  test("the hero: headline, CTAs, and a live card in A", async ({ page }) => {
    await gotoAndSettle(page, "/");
    await expect(page.getByRole("heading", { level: 1, name: "Songwriting formulas from the bands that built pop-punk." })).toBeVisible();
    // START WRITING opens the Generator in the key and feel picked here (A, Fast Punk until you pick).
    await expect(page.getByRole("link", { name: "START WRITING" }).first()).toHaveAttribute("href", /\/generator\/\?key=A&feel=fast-punk$/);
    await expect(page.getByRole("link", { name: /Open the Chord Lab/ })).toHaveAttribute("href", /\/chords\/$/);
    await expect(page.locator("[data-live-card] .hb-chip b")).toHaveText(["A5", "E5", "F#5", "D5"]);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });

  test("the live card's tab is the Generator's verse, drawn the Generator's way, one bar per chord with the lit chip", async ({ page }, info) => {
    onlyAtWidths(info, [390, 1440]);
    lightOnly(info);
    await gotoAndSettle(page, "/");
    const wrap = page.locator("[data-live-card] .hb-tabw");
    const tab = wrap.locator("svg[data-tab]");
    const rows = (kind: string) => tab.locator(`text[data-row="${kind}"]`).evaluateAll((els) => els.map((e) => (e.textContent ?? "").trimEnd()));
    // the songbook marks the Generator's tab has: bar numbers, red chord names, P.M. and accents, stems, the ×2
    await expect(tab.locator('text[data-row="number"]')).toHaveText(["1", "2", "3", "4"]);
    await expect(tab.locator('text[data-row="repeat"]')).toHaveText("×2");
    expect((await rows("chords"))[0].trim().split(/\s+/)).toEqual(["A5", "E5", "F#5", "D5"]);
    // the Verse the Generator writes in A, Fast Punk (I–V–vi–IV): chugs with a dead-strum turnaround
    expect(await rows("string")).toEqual([
      "e|----------------|----------------|----------------|----------------|",
      "B|----------------|----------------|----------------|----------------|",
      "G|----------------|----------------|----------------|2---2-2-2---x-x-|",
      "D|2---2-2-2---2-2-|----------------|----------------|0---0-0-0---x-x-|",
      "A|0---0-0-0---0-0-|2---2-2-2---x-x-|4---4-4-4---4-4-|----------------|",
      "E|----------------|0---0-0-0---x-x-|2---2-2-2---2-2-|----------------|",
    ]);
    // the bar lit in the tab is the chip lit above it
    await expect(wrap).toHaveAttribute("data-bar", /[0-3]/, { timeout: 5000 });
    for (let i = 0; i < 3; i++) {
      const [bar, chip] = await page.evaluate(() => {
        const card = document.querySelector("[data-live-card]")!;
        return [card.querySelector(".hb-tabw")!.getAttribute("data-bar"), String([...card.querySelectorAll(".hb-chip")].findIndex((c) => c.classList.contains("now")))];
      });
      expect(bar).toBe(chip);
      await page.waitForTimeout(450);
    }
    // in F the chords follow: F5 C5 D5 A#5
    await page.getByRole("group", { name: "Key, in the live card" }).getByRole("button", { name: "F", exact: true }).click();
    expect((await rows("chords"))[0].trim().split(/\s+/)).toEqual(["F5", "C5", "D5", "A#5"]);
  });

  test("home cards agree with the Generator and the Lab: shown tempos, flats on keys, the Lab's chord boxes and neck colours", async ({ page }, info) => {
    onlyAtWidths(info, [1440]);
    lightOnly(info);
    await gotoAndSettle(page, "/");
    // Half-time shows 90 BPM, as on the Generator (the click stays 180)
    const feel = page.getByRole("group", { name: "Feel" });
    await expect(feel.getByRole("button", { name: /HALF-TIME/ })).toContainText("90 BPM");
    await expect(page.locator(".hb-sheet li").nth(1)).toContainText("90 BPM");
    // only the song playing is red on the setlist
    await expect(page.locator(".hb-sheet li.now")).toHaveCount(1);
    // a sharp key carries its flat, as the Generator's key picker
    await expect(page.getByRole("group", { name: "Key", exact: true }).getByRole("button", { name: "A# / Bb" })).toHaveCount(1);
    // the Lab's chord boxes (finger numbers), and the G5 diagram with string names and fret numbers
    expect(await page.locator(".hb-box svg").count()).toBe(3);
    await expect(page.locator(".hb-g5 .lbl")).toHaveText(["e", "B", "G", "D", "A", "E", "3", "5"]);
    // lock buttons are plain icons, as on the Generator
    expect(await page.locator(".hb-lock").first().evaluate((b) => getComputedStyle(b).borderTopWidth)).toBe("0px");
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

  test("START WRITING carries the key and feel to the Generator, and the rest of its setup stays", async ({ page }, info) => {
    onlyAtWidths(info, [390, 1440]);
    lightOnly(info);
    // Something already set on the Generator (the song's length) survives the trip.
    await gotoAndSettle(page, "/generator/");
    await page.getByRole("slider", { name: "Song length" }).fill("240");
    await page.locator("header a[href=\"/\"]").first().click(); // in the page, so the Generator keeps its setup
    await expect(page).toHaveURL(/\/$/);
    await page.getByRole("group", { name: "Key, in the live card" }).getByRole("button", { name: "F", exact: true }).click();
    await page.getByRole("group", { name: "Feel" }).getByRole("button", { name: /HALF-TIME/ }).click();
    await page.getByRole("link", { name: "START WRITING" }).first().click();
    await expect(page).toHaveURL(/\/generator\/$/); // the query is used once, then leaves the address
    await expect(key(page, "F")).toHaveAttribute("aria-checked", "true");
    await expect(feel(page, /HALF-TIME/)).toHaveAttribute("aria-checked", "true");
    await expect(page.getByRole("slider", { name: "Song length" })).toHaveValue("240");
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

  test("every tile is there, controls are tappable, and nothing spills sideways", async ({ page }) => {
    await gotoAndSettle(page, "/");
    await expect(page.locator(".hb-tile")).toHaveCount(20);
    const u = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--u")) || 1);
    const small = await page.locator(".hb button, .hb a, .hb input").evaluateAll((els, min) =>
      // layout size, not the on-screen box: the hero's live card is tilted in 3D, which shrinks its pills' boxes on screen
      els.filter((e) => e.getClientRects().length).map((e) => ({ t: (e.textContent || e.getAttribute("aria-label") || "").trim().slice(0, 20), w: (e as HTMLElement).offsetWidth, h: (e as HTMLElement).offsetHeight })).filter(({ w, h }) => w < min || h < min).map(({ t }) => t), 43.5 * u);
    expect(small).toEqual([]);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    // the speakers up top, the Generator and Chord Lab's scope behind the lower sections
    await expect(page.locator('canvas.hb-speaker[aria-hidden="true"]')).toHaveCount(2);
    await expect(page.locator('canvas.stage-bg[data-stage-bg="osc"]')).toHaveCount(1);
  });

  test("speaker cone: a big cone behind the hero, a 2×2 cab behind the kit, drawn and pumping on the beat", async ({ page }, info) => {
    onlyAtWidths(info, [390, 1440]);
    lightOnly(info);
    await gotoAndSettle(page, "/");
    const one = page.locator('.hb-hero canvas[data-speaker="one"]');
    await expect(one).toHaveCount(1);
    await expect(page.locator('.hb-kit-sec > canvas[data-speaker="cab"]')).toHaveCount(1);
    // it fills the hero, under the headline and the card, and never takes a click
    const box = await one.evaluate((c) => { const r = c.getBoundingClientRect(), h = c.closest(".hb-hero")!.getBoundingClientRect(); return { fits: Math.abs(r.width - h.width) < 2 && Math.abs(r.height - h.height) < 2, pe: getComputedStyle(c).pointerEvents }; });
    expect(box).toEqual({ fits: true, pe: "none" });
    // it draws, and the picture changes from moment to moment (the cone pumps)
    const frame = () => one.evaluate((c: HTMLCanvasElement) => c.toDataURL());
    await expect.poll(async () => (await one.evaluate((c: HTMLCanvasElement) => { const d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 64) if (d[i] > 0) n++; return n; }))).toBeGreaterThan(100);
    const a = await frame();
    await expect.poll(frame, { timeout: 3000 }).not.toBe(a);
  });

  test("the kit cross-fades from the speaker cab into the scope: no hard edges", async ({ page }, info) => {
    onlyAtWidths(info, [1440]);
    lightOnly(info);
    await gotoAndSettle(page, "/");
    const fades = await page.evaluate(() => {
      const kit = document.querySelector(".hb-kit-sec")!, cab = kit.querySelector(".hb-speaker")!, hero = document.querySelector(".hb-hero .hb-speaker")!;
      const mask = (e: Element) => { const cs = getComputedStyle(e); return cs.maskImage || cs.getPropertyValue("-webkit-mask-image"); };
      return { kitBg: getComputedStyle(kit).backgroundImage, cab: mask(cab), hero: mask(hero) };
    });
    // the paper over the scope fades away down the kit while the cab fades out over the same stretch
    expect(fades.kitBg).toMatch(/linear-gradient/);
    expect(fades.cab).toMatch(/linear-gradient/);
    expect(fades.hero).toMatch(/linear-gradient/);
    // and the scope is there underneath, for the questions and the encore
    await expect(page.locator('canvas.stage-bg[data-stage-bg="osc"]')).toHaveCount(1);
  });

  test("amp blowout: how it works and the statement are there, read as text, and the footer never moves", async ({ page }, info) => {
    onlyAtWidths(info, [390, 1440]);
    lightOnly(info);
    await gotoAndSettle(page, "/");
    await expect(page.getByRole("heading", { level: 2, name: "Four steps. One song." })).toHaveCount(1);
    await expect(page.locator(".hb-poster")).toHaveCount(4);
    // the giant letters are for the eye; the sentence is read as one piece of text
    await expect(page.locator(".hb-big")).toHaveAttribute("aria-hidden", "true");
    await expect(page.locator(".hb-statement .sr-only")).toHaveText("Every riff is new. Nothing is copied.");
    // scroll through the page fast, then check the stats counted to their real values and the footer stayed put
    for (let i = 1; i <= 10; i++) { await page.evaluate((k) => window.scrollTo(0, (document.documentElement.scrollHeight * k) / 10), i); await page.waitForTimeout(40); }
    await page.waitForTimeout(600);
    await expect(page.locator(".hb-stats dd")).toHaveText(["12", "5", "13", "4", "10", "0"]);
    expect(await page.locator("footer").evaluate((f) => getComputedStyle(f).translate)).toBe("none");
    expect(await page.locator(".hb-amp-sparks").evaluate((c) => getComputedStyle(c).pointerEvents)).toBe("none");
  });

  test("amp blowout with reduced motion: nothing pins, the statement is filled in, no spotlight or sparks", async ({ page }, info) => {
    onlyAtWidths(info, [1440]);
    lightOnly(info);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await gotoAndSettle(page, "/");
    expect(await page.locator(".hb-how-pin").evaluate((e) => getComputedStyle(e).position)).toBe("static");
    expect(await page.locator(".hb-statement-pin").evaluate((e) => getComputedStyle(e).position)).toBe("static");
    expect(await page.locator(".hb-big .ch:not(.lit)").count()).toBe(0);
    expect(await page.locator(".hb-amp-spot").evaluate((e) => getComputedStyle(e).display)).toBe("none");
  });

  test("speaker cone stands still with reduced motion", async ({ page }, info) => {
    onlyAtWidths(info, [1440]);
    lightOnly(info);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await gotoAndSettle(page, "/");
    const frame = () => page.locator('canvas[data-speaker="one"]').evaluate((c: HTMLCanvasElement) => c.toDataURL());
    const a = await frame();
    await page.waitForTimeout(800);
    expect(await frame()).toBe(a);
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
    await expect(page.locator("[data-live-card] .hb-tabw")).not.toHaveAttribute("data-bar", /./);
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
