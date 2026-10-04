import { expect, gotoAndSettle, lightOnly, onlyAtWidths, projectWidth, test } from "./fixtures";
import { feel, lastPlayback } from "./helpers";

// Five feels (DECISIONS.md): Fast Punk, Half-Time, Mid-Tempo, Pop Strum and Ballad.

for (const path of ["/generator/", "/chords/"]) {
  test(`${path}: five feels, each at its own fixed tempo; one row from tablet up, a list on phones`, async ({ page }, info) => {
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

    // Every feel says its one tempo; Mid-Tempo has no slider (owner, 2026-10-04).
    for (const [f, bpm] of [[/FAST PUNK/, 180], [/HALF-TIME/, 90], [/MID-TEMPO/, 140], [/POP STRUM/, 150], [/BALLAD/, 80]] as const) await expect(feel(page, f)).toContainText(`${bpm} BPM`);
    await feel(page, /MID-TEMPO/).click();
    await expect(page.getByLabel("Mid-tempo BPM")).toHaveCount(0);
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
