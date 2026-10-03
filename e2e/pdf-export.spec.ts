import { readFileSync } from "node:fs";
import { type Page } from "@playwright/test";
import { expect, gotoAndSettle, lightOnly, onlyAtWidths, test } from "./fixtures";

// The PDF songbook (docs/song-builder-prd.md B8, §8): a real PDF, A4 or US Letter, with the brand fonts
// embedded and the song's title, made on demand (jsPDF and the fonts load only when you press the button).
async function downloadPdf(page: Page) {
  const [file] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "DOWNLOAD PDF" }).click()]);
  return { name: file.suggestedFilename(), pdf: readFileSync((await file.path())!).toString("latin1") };
}

test.describe("PDF songbook", () => {
  test.beforeEach(async ({}, info) => {
    onlyAtWidths(info, [390, 1440]);
    lightOnly(info);
  });

  test("A4 and Letter songbooks with the song's title and the brand fonts, loaded only when asked for", async ({ page }) => {
    const fonts: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("/fonts/")) fonts.push(r.url());
    });
    await gotoAndSettle(page, "/generator/");
    expect(fonts, "fonts load only for the PDF").toEqual([]);
    const title = (await page.locator("[data-song-header] h2").getAttribute("aria-label"))!;
    const first = await downloadPdf(page);
    const name = first.name;
    let pdf = first.pdf;
    expect(name).toMatch(/-palm-mute\.pdf$/);
    await expect(page.locator("[data-export='pdf'] [role='status']")).toHaveText(`Saved ${name}.`);
    expect(pdf.startsWith("%PDF-")).toBe(true);
    expect(fonts.length).toBeGreaterThanOrEqual(3);
    expect(pdf).toContain(`/Title (${title}`);
    expect((pdf.match(/\/FontFile2/g) ?? []).length).toBeGreaterThanOrEqual(3);
    const pages = (pdf.match(/\/Type \/Page[^s]/g) ?? []).length;
    expect(pages).toBeGreaterThanOrEqual(4); // cover, chart and the sections
    expect(pdf).toMatch(/\/MediaBox \[0 0 595\.2\d* 841\.8\d*\]/); // A4
    await page.getByRole("radiogroup", { name: "Paper size" }).getByRole("radio", { name: "LETTER" }).click();
    ({ pdf } = await downloadPdf(page));
    expect(pdf).toMatch(/\/MediaBox \[0 0 612\.?0* 792\.?0*\]/); // US Letter
  });
});
