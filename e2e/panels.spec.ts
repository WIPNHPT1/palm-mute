import { expect, gotoAndSettle, lightOnly, onlyAtWidths, test } from "./fixtures";
import { key } from "./helpers";

// Power Chords and Rhythm Lane sit side by side on desktop: same two-line header, so their first
// cards start level.
test("Power Chords and Rhythm Lane headers line up on desktop", async ({ page }, info) => {
  onlyAtWidths(info, [1440, 1920]);
  lightOnly(info);
  for (const width of [1280, info.project.use.viewport!.width]) {
    await page.setViewportSize({ width, height: 1000 });
    await gotoAndSettle(page, "/generator/");
    for (const k of ["A", "F# / Gb"]) {
      await key(page, k).click();
      for (const row of ["I-V-vi-IV", "vi-IV-I-V"]) {
        await page.getByRole("button", { name: `Use ${row} for the song` }).click();
        const tops = await page.evaluate(() => {
          const panel = (title: string) => [...document.querySelectorAll("h2")].find((h) => h.textContent === title)!.closest("div")!.parentElement!;
          const chords = panel("POWER CHORDS"), lane = panel("RHYTHM LANE");
          const firstCard = (p: Element) => Math.round(p.children[1].firstElementChild!.getBoundingClientRect().top);
          return { chords: firstCard(chords), lane: firstCard(lane), laneText: lane.children[0].textContent };
        });
        expect(tops.lane, `${k} ${row}: ${tops.laneText}`).toBe(tops.chords);
      }
    }
  }
});
