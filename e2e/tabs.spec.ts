import { expect, gotoAndSettle, horizontalOverflow, projectWidth, test } from "./fixtures";
import { feel, key } from "./helpers";

// Owner decision: tabs wrap 2 bars per line inside the card, never scroll sideways, readable at 320px.
test.describe("tabs", () => {
  for (const k of ["A", "D# / Eb"]) {
    test(`wrap 2 bars per line and fit their cards (key ${k})`, async ({ page }, info) => {
      await gotoAndSettle(page, "/generator/");
      await key(page, k).click();
      for (const f of [/FAST PUNK/, /MID-TEMPO/]) {
        await feel(page, f).click();
        const tabs = await page.locator("section[aria-label] svg[data-tab]").evaluateAll((svgs) =>
          svgs.map((svg) => {
            const card = svg.closest("section")!.getBoundingClientRect();
            const box = svg.getBoundingClientRect();
            const rows = [...svg.querySelectorAll('text[data-row="string"]')].map((t) => t.textContent ?? "");
            const vbWidth = (svg as SVGSVGElement).viewBox.baseVal.width;
            return {
              section: svg.closest("section")!.getAttribute("aria-label"),
              barsPerLine: rows.map((r) => (r.match(/\|/g) ?? []).length - 1),
              inside: box.left >= card.left - 0.5 && box.right <= card.right + 0.5,
              scroll: svg.parentElement!.scrollWidth - svg.parentElement!.clientWidth,
              // the tab is drawn at 12px and scaled to fit: this is the size it actually shows at
              fontPx: (box.width / vbWidth) * 12,
              twoDigit: rows.some((r) => /\d\d/.test(r)),
            };
          }),
        );
        expect(tabs).toHaveLength(5);
        for (const t of tabs) {
          expect(t.barsPerLine.every((n) => n >= 1 && n <= 2), `${t.section}: bars per line ${t.barsPerLine}`).toBe(true);
          expect(t.inside, `${t.section} tab spills out of its card`).toBe(true);
          expect(t.scroll, `${t.section} tab scrolls sideways`).toBeLessThanOrEqual(0);
          // Readable on phones and tablets (single-column or 2-column cards).
          if (projectWidth(info) < 1280) expect(t.fontPx, `${t.section} tab text at ${t.fontPx.toFixed(1)}px`).toBeGreaterThanOrEqual(t.twoDigit ? 7 : 9);
        }
        expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
      }
    });
  }
});

// Rhythm parts use standard power-chord shapes on the E, A, D and G strings only: never the rare
// D-root 3-note shape with its octave on the B string (DECISIONS.md), so B and high e stay empty.
test("chord sections never put notes on the B or high e strings", async ({ page }, info) => {
  test.skip(info.project.use.viewport?.width !== 1440 || info.project.use.colorScheme === "dark", "runs once per browser");
  test.slow();
  await page.goto("/generator/");
  for (const k of ["A", "A# / Bb", "B", "C", "C# / Db", "D", "D# / Eb", "E", "F", "F# / Gb", "G", "G# / Ab"]) {
    await key(page, k).click();
    // The rows the Power Chords panel shows (npm run verify covers all ten progressions in every key).
    for (const progression of ["I-V-vi-IV", "vi-IV-I-V", "I-IV-V"]) {
      await page.getByRole("button", { name: `Use ${progression} for the Chorus` }).click();
      for (const label of ["Intro", "Verse", "Chorus", "Breakdown"]) {
        const highStrings = await page
          .locator(`section[aria-label="${label}"] svg[data-tab] text[data-row="string"]`)
          .evaluateAll((rows) => rows.map((r) => r.textContent ?? "").filter((t) => /^[Be]\|/.test(t) && /\d/.test(t)));
        expect(highStrings, `${k} ${progression} ${label}`).toEqual([]);
      }
    }
  }
});
