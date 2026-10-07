import { type Page } from "@playwright/test";
import { expect, gotoAndSettle, lightOnly, onlyAtWidths, projectWidth, test } from "./fixtures";
import { lastPlayback, section } from "./helpers";

// The transport (docs/song-builder-prd.md premium P3): play the song, see where it is, loop a part, count in,
// slow it down, follow a cursor through the tab, and Space / R on the keyboard.
const transport = (page: Page) => page.getByRole("region", { name: "Playback" });
const strip = (page: Page) => page.getByRole("navigation", { name: "Song running order" });

async function setSpeed(page: Page, pct: string) {
  const t = transport(page);
  if (projectWidth(test.info()) < 834) {
    // Phones: one button cycles 100 → 90 → 75 → 50.
    for (let i = 0; i < 4 && !(await t.getByRole("button", { name: `Practice speed ${pct}, tap to change` }).count()); i++)
      await t.getByRole("button", { name: /^Practice speed/ }).click();
  } else await t.getByRole("radiogroup", { name: "Practice speed" }).getByRole("radio", { name: pct }).click();
}

test.describe("transport", () => {
  test.beforeEach(async ({ page }, info) => {
    onlyAtWidths(info, [390, 1440]);
    lightOnly(info);
    await gotoAndSettle(page, "/generator/");
    // The bar waits for a song: not there on a fresh visit, there once BUILD SONG makes one.
    await expect(transport(page)).toHaveCount(0);
    await page.getByRole("button", { name: "BUILD SONG" }).click();
    await expect(transport(page)).toBeVisible();
  });

  test("plays the song at a practice speed, and says where it is", async ({ page }) => {
    await setSpeed(page, "50%");
    await transport(page).getByRole("button", { name: "Play the song" }).click();
    const pb = (await lastPlayback(page))!;
    expect(pb.bpm).toBe(90); // Fast Punk's 180 at half speed
    expect(pb.loop).toBe(false);
    await expect(transport(page).locator("[data-transport-part]")).toHaveText("Intro");
    await expect(transport(page).locator("[data-transport-time]")).toContainText("bar 1");
    await expect(transport(page).locator("[data-transport-time]")).toContainText("50%");
    await transport(page).getByRole("button", { name: "Stop the song" }).click();
    expect(await lastPlayback(page)).toBeNull();
  });

  test("loops one part; count-in before the music", async ({ page }) => {
    await transport(page).getByRole("button", { name: "Loop the part" }).click();
    await transport(page).getByRole("button", { name: "Count-in" }).click();
    const pre = strip(page).getByRole("button", { name: /^Play the song from Pre-chorus 1 / });
    const bars = Number(/, (\d+) bars/.exec((await pre.getAttribute("aria-label"))!)![1]);
    await pre.click();
    const pb = (await lastPlayback(page))!;
    expect(pb.loop).toBe(true);
    expect(pb.bars).toHaveLength(bars); // just Pre-chorus 1, round and round
    expect(pb.countIn).toBe(true);
    await expect(transport(page).locator("[data-transport-part]")).toHaveText("Pre-chorus 1 · looping");
  });

  test("the cursor follows the music through the card's tab", async ({ page }) => {
    const chorus = section(page, "Chorus");
    await chorus.getByRole("button", { name: "Play Chorus" }).click();
    await expect(chorus.locator("svg[data-tab] rect[data-now]")).toHaveCount(1);
    const first = await chorus.locator("svg[data-tab] rect[data-now]").getAttribute("data-now");
    // A bar at 180 BPM is 1.33 s: the cursor moves on.
    await expect.poll(() => chorus.locator("svg[data-tab] rect[data-now]").getAttribute("data-now"), { timeout: 5000 }).not.toBe(first);
    await chorus.getByRole("button", { name: "Stop Chorus" }).click();
    await expect(page.locator("svg[data-tab] rect[data-now]")).toHaveCount(0);
  });

  test("Space plays and stops the song; R builds it again", async ({ page }) => {
    await page.locator("h1").click(); // focus on the page, not a control
    await page.keyboard.press("Space");
    await expect(page.getByRole("button", { name: "STOP SONG" })).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("Space");
    await expect(page.getByRole("button", { name: "PLAY SONG" })).toHaveAttribute("aria-pressed", "false");
    const song = () => page.locator("section[aria-label] svg[data-tab]").allTextContents().then((t) => t.join("\n"));
    const before = await song();
    await page.keyboard.press("r");
    await expect.poll(song).not.toBe(before);
  });

  test("phones: the count-in and speed buttons say what they are", async ({ page }) => {
    const t = transport(page);
    await expect(t.getByRole("button", { name: "Count-in" })).toHaveText("COUNT-IN");
    if (projectWidth(test.info()) < 834) await expect(t.getByRole("button", { name: /^Practice speed/ })).toHaveText("SPEED100%");
  });

  test("never covers the end of the page", async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const [bar, footer] = await Promise.all([transport(page).boundingBox(), page.locator("footer").last().boundingBox()]);
    expect(footer!.y + footer!.height).toBeLessThanOrEqual(bar!.y + 1);
  });
});
