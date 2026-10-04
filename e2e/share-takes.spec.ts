import { type Page } from "@playwright/test";
import { expect, gotoAndSettle, lightOnly, onlyAtWidths, test } from "./fixtures";
import { key, section } from "./helpers";

// Share links and takes history (docs/song-builder-prd.md premium P1–P2).
const tab = (page: Page, label: string) => section(page, label).locator("svg[data-tab]").textContent();
/** Everything that makes the song: title, running order, and every card's tab. */
async function snapshot(page: Page) {
  return {
    title: await page.locator("[data-song-header] h2").getAttribute("aria-label"),
    order: await page.getByRole("navigation", { name: "Song running order" }).getByRole("button").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label"))),
    tabs: await page.locator("[data-sections] svg[data-tab]").allTextContents(),
    locked: await page.locator("section[data-locked='true']").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label"))),
  };
}

test.describe("share and takes", () => {
  test.beforeEach(async ({ page }, info) => {
    onlyAtWidths(info, [390, 1440]);
    lightOnly(info);
    await gotoAndSettle(page, "/generator/");
  });

  test("a section keeps its recent takes: step back and forward; a new build starts afresh", async ({ page }) => {
    const verse = section(page, "Verse");
    await expect(verse.getByRole("group", { name: "Verse takes" })).toHaveCount(0); // one take: nothing to step through
    const take1 = await tab(page, "Verse");
    await verse.getByRole("button", { name: "Regenerate Verse" }).click();
    const take2 = await tab(page, "Verse");
    await verse.getByRole("button", { name: "Regenerate Verse" }).click();
    const take3 = await tab(page, "Verse");
    await expect(verse.locator("[data-take]")).toContainText("3");
    await verse.getByRole("button", { name: "Previous take of Verse" }).click();
    expect(await tab(page, "Verse")).toBe(take2);
    await verse.getByRole("button", { name: "Previous take of Verse" }).click();
    expect(await tab(page, "Verse")).toBe(take1);
    await expect(verse.getByRole("button", { name: "Previous take of Verse" })).toBeDisabled();
    await verse.getByRole("button", { name: "Next take of Verse" }).click();
    await verse.getByRole("button", { name: "Next take of Verse" }).click();
    expect(await tab(page, "Verse")).toBe(take3);
    await page.getByRole("button", { name: "BUILD AGAIN" }).click();
    await expect(verse.getByRole("group", { name: "Verse takes" })).toHaveCount(0);
  });

  test("a link opens exactly the same song", async ({ page, context }) => {
    // A song with a bit of everything: key, feel, length, a groove, the key change, a new take, a lock.
    await key(page, "D").click();
    await page.getByRole("radiogroup", { name: "Feel" }).getByRole("radio", { name: /HALF-TIME/ }).click();
    await page.getByRole("slider", { name: "Song length" }).fill("240");
    await section(page, "Verse").getByRole("button", { name: "Verse options" }).click();
    await section(page, "Verse").getByRole("button", { name: "Use Stop-time" }).click();
    await section(page, "Chorus").getByRole("button", { name: "Chorus options" }).click();
    await section(page, "Chorus").getByRole("tab", { name: /STRUCTURE/ }).click();
    await section(page, "Chorus").getByRole("radiogroup", { name: "Last chorus" }).getByRole("radio", { name: "UP A TONE" }).click();
    await section(page, "Intro").getByRole("button", { name: "Regenerate Intro" }).click();
    await section(page, "Breakdown").getByRole("button", { name: "Regenerate Breakdown" }).click();
    await section(page, "Breakdown").getByRole("button", { name: "Lock Breakdown" }).click();
    await key(page, "E").click(); // the locked Breakdown stays in D
    const before = await snapshot(page);
    const link = await page.locator("#share-link").inputValue();
    expect(link).toMatch(/\/generator\/#song=[A-Za-z0-9_-]+$/);

    const other = await context.newPage();
    await other.goto(link);
    await other.waitForLoadState("networkidle");
    await expect(other.locator("[data-shared-notice]")).toContainText("shared song");
    expect(await snapshot(other)).toEqual(before);
    await expect(section(other, "Breakdown")).toContainText("Locked in D");
    // The address bar keeps following the song (so a reload brings it back), and reloading it opens the same song quietly.
    await expect.poll(() => other.url(), { timeout: 5000 }).toMatch(/\/generator\/#song=[A-Za-z0-9_-]+$/);
    await other.reload();
    await other.waitForLoadState("networkidle");
    await expect(other.locator("[data-shared-notice]")).toHaveCount(0);
    expect(await snapshot(other)).toEqual(before);
    await expect(other.getByRole("region", { name: "Song setup" })).toBeVisible(); // straight to the song
  });

  test("a broken or tampered link falls back safely", async ({ page }) => {
    // Each link opens fresh, as a link from elsewhere does.
    const open = async (url: string) => {
      await page.goto("about:blank");
      await page.goto(url);
    };
    await open("/generator/#song=not-a-real-song");
    await expect(page.locator("[data-shared-notice]")).toContainText("couldn't be read");
    // Tampered: an unknown key or groove, a title that isn't ours, a huge seed: checked, and the bad parts dropped.
    const evil = btoa(JSON.stringify({ v: 1, k: "H#", f: "fast-punk", p: "I-V-vi-IV", s: {} })).replace(/=+$/, "");
    await open(`/generator/#song=${evil}`);
    await expect(page.locator("[data-shared-notice]")).toContainText("couldn't be read");
    const odd = btoa(JSON.stringify({ v: 1, k: "G", f: "ballad", p: "I-IV-V", n: 9999, t: "<script>", g: 1e12, s: { verse: { s: 3, o: { groove: "Moonwalk", times: 99 } } } }))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    await open(`/generator/#song=${odd}`);
    await expect(page.locator("[data-shared-notice]")).toContainText("shared song");
    await expect(section(page, "Verse")).toContainText("key of G");
    await expect(page.locator("[data-song-header] h2")).not.toHaveAttribute("aria-label", /script/);
  });
});
