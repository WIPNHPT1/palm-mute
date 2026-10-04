import { expect, gotoAndSettle, lightOnly, onlyAtWidths, test } from "./fixtures";

// When sound can't start (no Web Audio, or it stays suspended), pressing play used to do nothing at all. One
// notice for the whole site now says so and how to fix the usual phone cause; it clears the next time sound starts.
const notice = (page: import("@playwright/test").Page) => page.locator("[data-audio-notice]");
const TEXT = "Couldn't start sound. On iPhone, turn off Silent mode and tap play again.";

test.describe("sound that can't start says so", () => {
  test.beforeEach(async ({ page }, info) => {
    onlyAtWidths(info, [390, 1440]);
    lightOnly(info);
    // A browser with no Web Audio.
    await page.addInitScript(() => {
      for (const k of ["AudioContext", "webkitAudioContext", "OfflineAudioContext", "webkitOfflineAudioContext"]) {
        try {
          Object.defineProperty(window, k, { value: undefined, configurable: true, writable: true });
        } catch {
          // already unusable
        }
      }
    });
  });

  test("the Chord Lab: a play button shows the notice, the button doesn't get stuck, and the notice can be dismissed", async ({ page }) => {
    await gotoAndSettle(page, "/chords/");
    await expect(notice(page)).toHaveCount(0);
    const strum = page.getByRole("button", { name: "Play G 320003 strummed" });
    await strum.click();
    await expect(notice(page)).toBeVisible();
    await expect(notice(page)).toHaveText(new RegExp(TEXT.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    await expect(notice(page)).toHaveAttribute("role", "status");
    // The button went back to Play (it isn't left showing Stop), and the notice sits below the top bar.
    await expect(strum).toBeVisible();
    await expect(page.getByRole("button", { name: "Stop G 320003 strummed" })).toHaveCount(0);
    expect((await notice(page).boundingBox())!.y).toBeGreaterThanOrEqual(64);
    expect((await notice(page).getByRole("button", { name: "DISMISS" }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await notice(page).getByRole("button", { name: "DISMISS" }).click();
    await expect(notice(page)).toHaveCount(0);
    // Another try that fails shows it again.
    await page.getByRole("button", { name: "Play G 320003 note by note" }).click();
    await expect(notice(page)).toBeVisible();
  });

  test("the Generator: PLAY SONG and a section's play button show the same notice", async ({ page }) => {
    await gotoAndSettle(page, "/generator/");
    await expect(notice(page)).toHaveCount(0);
    await page.getByRole("button", { name: "PLAY SONG" }).click();
    await expect(notice(page)).toBeVisible();
    await expect(notice(page)).toContainText(TEXT);
    await expect(page.getByRole("button", { name: "PLAY SONG" })).toBeVisible(); // not stuck on STOP
    await notice(page).getByRole("button", { name: "DISMISS" }).click();
    await page.getByRole("button", { name: "Play I-V-vi-IV" }).click();
    await expect(notice(page)).toBeVisible();
  });
});

test.describe("with sound available, no notice ever shows", () => {
  test("playing in the Lab and the Generator leaves the page quiet", async ({ page }, info) => {
    onlyAtWidths(info, [390, 1440]);
    lightOnly(info);
    await gotoAndSettle(page, "/chords/");
    await page.getByRole("button", { name: "Play G 320003 strummed" }).click();
    await expect(page.getByRole("button", { name: "Stop G 320003 strummed" })).toBeVisible();
    await page.waitForTimeout(400);
    await expect(notice(page)).toHaveCount(0);
    await page.goto("/generator/");
    await page.getByRole("button", { name: "PLAY SONG" }).click();
    await expect(page.getByRole("button", { name: "STOP SONG" })).toBeVisible();
    await page.waitForTimeout(400);
    await expect(notice(page)).toHaveCount(0);
  });
});
