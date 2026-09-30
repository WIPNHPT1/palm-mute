import { type Page } from "@playwright/test";
import { expect, gotoAndSettle, lightOnly, onlyAtWidths, projectWidth, test } from "./fixtures";
import { feel, lastPlayback } from "./helpers";

// Five feels (DECISIONS.md): Fast Punk, Half-Time, Mid-Tempo, Pop Strum and Ballad, with five
// Power Chords rows and five Rhythm Lane cards to match.

const lane = (page: Page) => page.getByRole("heading", { name: "RHYTHM LANE" }).locator("xpath=../..");
const powerChords = (page: Page) => page.getByRole("heading", { name: "POWER CHORDS" }).locator("xpath=../..");

for (const path of ["/generator/", "/chords/"]) {
  test(`${path}: five feels; one row from tablet up, a list on phones with Mid-Tempo's tempo in its row`, async ({ page }, info) => {
    await gotoAndSettle(page, path);
    const radios = page.getByRole("radiogroup", { name: "Feel" }).getByRole("radio");
    await expect(radios).toHaveCount(5);
    const boxes = await radios.evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => ({ top: Math.round(r.top), height: r.height })));
    const phone = projectWidth(info) < 834;
    if (phone) {
      for (let i = 1; i < 5; i++) expect(boxes[i].top, `feel ${i + 1} sits under feel ${i}`).toBeGreaterThan(boxes[i - 1].top);
      // Each row shows its strum (the Rhythm Lane name).
      await expect(feel(page, /POP STRUM/)).toContainText("Anthem strum");
    } else {
      expect(new Set(boxes.map((b) => b.top)).size, "one row").toBe(1);
    }
    for (const b of boxes) expect(b.height).toBeGreaterThanOrEqual(44);

    await feel(page, /MID-TEMPO/).click();
    const slider = page.getByLabel("Mid-tempo BPM");
    await expect(slider).toHaveCount(1);
    // Phones: inside the Mid-Tempo row, right under its name. Tablet up: under the whole row.
    const inRow = await slider.evaluate((el) => !!el.closest('[role="radiogroup"]'));
    expect(inRow).toBe(phone);
  });
}

test("Pop Strum and Ballad play at their own fixed tempos, open and ringing", async ({ page }, info) => {
  onlyAtWidths(info, [390, 1440]);
  lightOnly(info);
  await gotoAndSettle(page, "/generator/");
  for (const [name, id, bpm] of [[/POP STRUM/, "pop-strum", 150], [/BALLAD/, "ballad", 80]] as const) {
    await feel(page, name).click();
    await expect(feel(page, name)).toContainText(`${bpm} BPM`);
    await page.getByRole("button", { name: "Play I-V-vi-IV" }).click();
    const pb = (await lastPlayback(page))!;
    expect(pb.bpm).toBe(bpm);
    expect(pb.bars.every((b) => b.feel === id)).toBe(true);
    expect(pb.bars.flatMap((b) => b.cells).every((c) => !c || !c.palmMuted)).toBe(true);
    // The whole song follows the feel too (the Breakdown stays half-time).
    await page.getByRole("button", { name: "Stop I-V-vi-IV" }).click();
    await page.getByRole("button", { name: "PLAY SONG" }).click();
    const song = (await lastPlayback(page))!;
    expect(song.bpm).toBe(bpm);
    expect(song.bars[0].feel).toBe(id);
    await page.getByRole("button", { name: "STOP SONG" }).click();
  }
  // Ballad: each downstroke rings for a half note.
  await page.getByRole("button", { name: "Play I-V-vi-IV" }).click();
  expect((await lastPlayback(page))!.bars[0].cells.map((c) => c?.cells ?? 0)).toEqual([4, 0, 0, 0, 4, 0, 0, 0]);
});

test("Power Chords shows five rows, the Chorus pick first", async ({ page }, info) => {
  onlyAtWidths(info, [390, 834, 1440]);
  await gotoAndSettle(page, "/generator/");
  const rows = powerChords(page).locator("[data-progression]");
  await expect(rows).toHaveCount(5);
  // Ten progressions, five rows: the rest stay off the list unless one is the Chorus pick.
  await expect(page.getByRole("button", { name: "Use IV-I-V-vi for the Chorus" })).toHaveCount(0);
  await page.getByRole("button", { name: "Use vi-V-IV for the Chorus" }).click();
  await expect(rows.first()).toHaveAttribute("data-progression", "vi-V-IV");
  await expect(rows).toHaveCount(5);
});

test("Rhythm Lane: five strums; tap one to use its feel, ▷ to hear it over the Chorus chords", async ({ page }, info) => {
  await gotoAndSettle(page, "/generator/");
  const cards = lane(page).locator("[data-strum]");
  await expect(cards).toHaveCount(5);
  // Tablet: all five in one row (owner's pick). Phones and desktop: a column.
  const tops = await cards.evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
  const width = projectWidth(info);
  expect(new Set(tops).size).toBe(width >= 834 && width < 1280 ? 1 : 5);

  await page.getByRole("button", { name: "Use Slow let-ring (BALLAD)" }).click();
  await expect(feel(page, /BALLAD/)).toHaveAttribute("aria-checked", "true");
  await expect(lane(page).locator('[data-strum="ballad"]')).toHaveAttribute("aria-current", "true");

  // ▷ on another card switches to that feel and plays its strum over the Chorus progression.
  await page.getByRole("button", { name: "Play Anthem strum strum" }).click();
  await expect(feel(page, /POP STRUM/)).toHaveAttribute("aria-checked", "true");
  const pb = (await lastPlayback(page))!;
  expect(pb.bpm).toBe(150);
  expect(pb.bars).toHaveLength(4); // I-V-vi-IV
  expect(pb.bars.every((b) => b.feel === "pop-strum")).toBe(true);
  expect(pb.bars[0].cells.map((c) => (c ? 1 : 0))).toEqual([1, 0, 1, 1, 0, 1, 1, 1]);
  await page.getByRole("button", { name: "Stop Anthem strum strum" }).click();
  expect(await lastPlayback(page)).toBeNull();
});
