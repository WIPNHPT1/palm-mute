import { type Page } from "@playwright/test";
import { expect, gotoAndSettle, lightOnly, onlyAtWidths, test } from "./fixtures";

// What the site remembers: the Chord Lab's key, tuning and handedness (in the browser), and the Generator's song
// (in the address bar: its link follows the song, so a reload or Back returns to it).
const radio = (page: Page, group: string, name: string | RegExp) => page.getByRole("radiogroup", { name: group, exact: true }).getByRole("radio", typeof name === "string" ? { name, exact: true } : { name });
const checked = (page: Page, group: string) => page.getByRole("radiogroup", { name: group, exact: true }).getByRole("radio", { checked: true });

test.describe("the Chord Lab remembers its setup", () => {
  test.beforeEach(async ({}, info) => {
    onlyAtWidths(info, [390, 1440]);
    lightOnly(info);
  });

  test("key, tuning and handedness survive a reload; the chord and the loop don't", async ({ page }) => {
    await gotoAndSettle(page, "/chords/");
    await radio(page, "Key", "D").click();
    await radio(page, "Tuning", "DROP D").click();
    await radio(page, "Handed", "LEFT").click();
    await radio(page, "Root", "A").click();
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(radio(page, "Key", "D")).toHaveAttribute("aria-checked", "true");
    await expect(radio(page, "Tuning", "DROP D")).toHaveAttribute("aria-checked", "true");
    await expect(radio(page, "Handed", "LEFT")).toHaveAttribute("aria-checked", "true");
    // Not remembered: the Dictionary's chord is back to G, and the Builder's loop to I-V-vi-IV.
    await expect(radio(page, "Root", "G")).toHaveAttribute("aria-checked", "true");
    await expect(page.locator('[data-tool="builder"] [data-loop] li')).toHaveCount(4);
    // The diagrams follow what was remembered.
    await expect(page.locator('[data-tool="dictionary"] [data-chord-info]')).toContainText("G (major)");
    await expect(page.locator('[data-tool="dictionary"] svg[role="img"]').first()).toHaveAttribute("aria-label", /^G: D string \(6th\)/); // Drop D's low string is a D
    // A change after the reload is remembered too.
    await radio(page, "Tuning", "E STD").click();
    await page.reload();
    await expect(radio(page, "Tuning", "E STD")).toHaveAttribute("aria-checked", "true");
  });

  for (const [name, stored] of [
    ["not JSON", "{{{ nope"],
    ["unknown values", JSON.stringify({ key: "Z", tuning: "banjo", left: "yes" })],
    ["a list", "[1,2,3]"],
    ["null", "null"],
  ] as const) {
    test(`a corrupted stored value (${name}) falls back to the defaults, quietly`, async ({ page }) => {
      await page.addInitScript((value) => localStorage.setItem("palm-mute-lab-v1", value), stored);
      await gotoAndSettle(page, "/chords/");
      await expect(checked(page, "Key")).toHaveAccessibleName("G");
      await expect(checked(page, "Tuning")).toHaveText("E STD");
      await expect(checked(page, "Handed")).toHaveText("RIGHT");
    });
  }

  test("part of it can be good: valid fields are used, invalid ones ignored", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("palm-mute-lab-v1", JSON.stringify({ key: "F", tuning: "drop-c-sharp", left: 5 })));
    await gotoAndSettle(page, "/chords/");
    await expect(checked(page, "Key")).toHaveAccessibleName("F");
    await expect(checked(page, "Tuning")).toHaveText("DROP C#");
    await expect(checked(page, "Handed")).toHaveText("RIGHT");
  });

  test("storage that throws never breaks the page", async ({ page }) => {
    await page.addInitScript(() => {
      Storage.prototype.getItem = () => {
        throw new Error("blocked");
      };
      Storage.prototype.setItem = () => {
        throw new Error("full");
      };
    });
    await gotoAndSettle(page, "/chords/");
    await radio(page, "Tuning", "DROP D").click();
    await expect(radio(page, "Tuning", "DROP D")).toHaveAttribute("aria-checked", "true");
    await expect(page.locator('[data-tool="dictionary"] [data-voicing]').first()).toBeVisible();
  });
});

test.describe("the Generator's song follows it in the address bar", () => {
  test.beforeEach(async ({}, info) => {
    onlyAtWidths(info, [390, 1440]);
    lightOnly(info);
  });

  test("a fresh visit has no link; build a song and its link appears; a reload returns the same song, quietly", async ({ page }) => {
    await gotoAndSettle(page, "/generator/");
    expect(new URL(page.url()).hash).toBe("");
    await radio(page, "Key", "G").click();
    await radio(page, "Feel", /POP STRUM/).click();
    // Choosing alone doesn't write a link (the song isn't built yet).
    await page.waitForTimeout(600);
    expect(new URL(page.url()).hash).toBe("");
    await page.getByRole("button", { name: "BUILD SONG" }).click();
    await expect.poll(() => new URL(page.url()).hash, { timeout: 5000 }).toMatch(/^#song=[A-Za-z0-9_-]+$/);
    const hash = new URL(page.url()).hash;
    const header = await page.locator("[data-song-header]").innerText();
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.locator("[data-setup-summary]")).toContainText("G");
    await expect(page.locator("[data-setup-summary]")).toContainText("Pop Strum");
    await expect(page.locator("[data-shared-notice]")).toHaveCount(0); // it's their own song, not a shared one
    expect(new URL(page.url()).hash).toBe(hash);
    expect(await page.locator("[data-song-header]").innerText()).toBe(header); // the very same song
  });

  test("the link follows later changes: BUILD AGAIN and a section's new take change it", async ({ page }) => {
    await gotoAndSettle(page, "/generator/");
    await page.getByRole("button", { name: "BUILD SONG" }).click();
    await expect.poll(() => new URL(page.url()).hash, { timeout: 5000 }).toMatch(/^#song=/);
    const first = new URL(page.url()).hash;
    await page.getByRole("button", { name: "BUILD AGAIN" }).first().click();
    await expect.poll(() => new URL(page.url()).hash, { timeout: 5000 }).not.toBe(first);
    // Back to the setup and out again keeps working.
    await page.getByRole("button", { name: /EDIT SETUP/ }).click();
    await radio(page, "Key", "C").click();
    await page.getByRole("button", { name: "BUILD SONG" }).click();
    await expect.poll(() => new URL(page.url()).hash, { timeout: 5000 }).toMatch(/^#song=/);
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.locator("[data-setup-summary]")).toContainText("C");
  });

  test("a link from elsewhere still wins, and says it's a shared song; a bad one still says so", async ({ page, context }) => {
    await gotoAndSettle(page, "/generator/");
    await radio(page, "Key", "D").click();
    await page.getByRole("button", { name: "BUILD SONG" }).click();
    await expect.poll(() => new URL(page.url()).hash, { timeout: 5000 }).toMatch(/^#song=/);
    const linkD = page.url();
    // A different song in another tab, then the first link opened fresh.
    const other = await context.newPage();
    await other.goto("/generator/");
    await radio(other, "Key", "F").click();
    await other.getByRole("button", { name: "BUILD SONG" }).click();
    await expect.poll(() => new URL(other.url()).hash, { timeout: 5000 }).toMatch(/^#song=/);
    // Pasted into the tab that's already open (only the hash changes), then opened fresh in a new tab.
    await other.goto(linkD);
    await expect(other.locator("[data-shared-notice]")).toContainText("shared song");
    await expect(other.locator("[data-setup-summary]")).toContainText(/KEYD(?!#)/);
    const fresh = await context.newPage();
    await fresh.goto(linkD);
    await fresh.waitForLoadState("networkidle");
    await expect(fresh.locator("[data-shared-notice]")).toContainText("shared song");
    await expect(fresh.locator("[data-setup-summary]")).toContainText(/KEYD(?!#)/);
    // A bad link: the notice, and the address bar is tidied.
    await other.goto("/generator/#song=not-a-song");
    await other.waitForLoadState("networkidle");
    await expect(other.locator("[data-shared-notice]")).toContainText("couldn't be read");
    expect(new URL(other.url()).hash).toBe("");
  });
});
