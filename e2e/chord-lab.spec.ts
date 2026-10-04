import { type Page } from "@playwright/test";
import { expect, gotoAndSettle, lightOnly, onlyAtWidths, test } from "./fixtures";
import { lastPlayback } from "./helpers";

// The Chord Lab (docs/chord-lab-prd.md): its setup and the Dictionary with its neck.
const dictionary = (page: Page) => page.locator('[data-tool="dictionary"]');
const radio = (page: Page, group: string, name: string) => page.getByRole("radiogroup", { name: group }).getByRole("radio", { name, exact: true });
const voicingIds = (page: Page) => dictionary(page).locator("[data-voicing]").evaluateAll((els) => els.map((e) => e.getAttribute("data-voicing")));

test.describe("chord lab: setup and dictionary", () => {
  test.beforeEach(async ({ page }) => {
    await gotoAndSettle(page, "/chords/");
  });

  test("the page: title, setup, the tool strip and the Dictionary", async ({ page }, info) => {
    onlyAtWidths(info, [390, 1440]);
    lightOnly(info);
    await expect(page.locator("h1")).toHaveText("CHORD LAB");
    await expect(radio(page, "Key", "G")).toHaveAttribute("aria-checked", "true");
    await expect(radio(page, "Tuning", "E STD")).toHaveAttribute("aria-checked", "true");
    await expect(radio(page, "Handed", "RIGHT")).toHaveAttribute("aria-checked", "true");
    await page.getByRole("navigation", { name: "Lab tools" }).getByRole("link", { name: /Dictionary/ }).click();
    await expect(page).toHaveURL(/#dictionary$/);
    await expect(dictionary(page).locator("h2")).toHaveText("Dictionary");
    // Nothing from the Generator: no feel control, no send-to-song.
    await expect(page.getByRole("radiogroup", { name: "Feel" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /USE IN MY SONG/ })).toHaveCount(0);
  });

  test("G major opens on the open G, and every shape is a G chord up the neck", async ({ page }, info) => {
    onlyAtWidths(info, [390, 1440]);
    lightOnly(info);
    await expect(dictionary(page).locator("[data-chord-info]")).toContainText("G (major): G · B · D");
    const ids = await voicingIds(page);
    expect(ids[0]).toBe("320003");
    expect(ids).toContain("355433"); // the E-shape barre at the 3rd fret
    await expect(dictionary(page).locator('[data-voicing="320003"] button[aria-label$="show on the neck"]')).toHaveAttribute("aria-pressed", "true");
    // The box speaks every string.
    await expect(dictionary(page).locator('[data-voicing="320003"] svg[role="img"]')).toHaveAttribute("aria-label", /^G: E string \(6th\) 3rd fret, A string \(5th\) 2nd fret, D string \(4th\) open/);
  });

  test("root and type pick the chord; the shapes follow", async ({ page }, info) => {
    onlyAtWidths(info, [390, 1440]);
    lightOnly(info);
    await radio(page, "Root", "A").click();
    await radio(page, "Chord type", "MINOR").click();
    await expect(dictionary(page).locator("[data-chord-info]")).toContainText("Am (minor): A · C · E");
    expect((await voicingIds(page))[0]).toBe("x02210");
    await radio(page, "Root", "C").click();
    await radio(page, "Chord type", "ADD9").click();
    expect(await voicingIds(page)).toContain("x32033");
  });

  test("a strum plays exactly the shape at the Lab's fixed 150 BPM; the dots play it note by note", async ({ page }, info) => {
    onlyAtWidths(info, [390, 1440]);
    lightOnly(info);
    await page.getByRole("button", { name: "Play G 320003 strummed" }).click();
    let pb = (await lastPlayback(page))!;
    expect(pb.bpm).toBe(150);
    expect(pb.loop).toBe(false);
    expect(pb.bars).toHaveLength(1);
    expect(pb.bars[0].cells[0]!.notes).toEqual([43, 47, 50, 55, 59, 67]);
    await expect(page.getByRole("button", { name: "Stop G 320003 strummed" })).toBeVisible();
    await page.getByRole("button", { name: "Play G 320003 note by note" }).click();
    pb = (await lastPlayback(page))!;
    expect(pb.bars[0].cells.map((c) => c?.notes[0] ?? null)).toEqual([43, 47, 50, 55, 59, 67, null, null]);
    // One thing at a time: the strum button is back to Play.
    await expect(page.getByRole("button", { name: "Play G 320003 strummed" })).toBeVisible();
  });

  test("a tuning changes the shapes and the sound; it stops what was playing", async ({ page }, info) => {
    onlyAtWidths(info, [390, 1440]);
    lightOnly(info);
    await page.getByRole("button", { name: "Play G 320003 strummed" }).click();
    await radio(page, "Tuning", "Eb STD").click();
    await expect.poll(() => lastPlayback(page)).toBeNull();
    const ids = await voicingIds(page);
    expect(ids).not.toContain("320003"); // that shape is an F# now
    await dictionary(page).getByRole("button", { name: /^Play G .* strummed$/ }).first().click();
    const notes = (await lastPlayback(page))!.bars[0].cells[0]!.notes;
    expect(notes[0] % 12).toBe(7); // G in the bass
    expect(new Set(notes.map((n) => n % 12))).toEqual(new Set([7, 11, 2]));
    // Drop D: the one-finger power chord shows up.
    await radio(page, "Tuning", "DROP D").click();
    await radio(page, "Root", "D").click();
    await radio(page, "Chord type", "5").click();
    expect(await voicingIds(page)).toContain("000xxx");
  });

  test("filters: position, easy only, no barres", async ({ page }, info) => {
    onlyAtWidths(info, [390, 1440]);
    lightOnly(info);
    await dictionary(page).getByRole("button", { name: "NO BARRES" }).click();
    for (const text of await dictionary(page).locator("[data-voicing]").allInnerTexts()) expect(text).not.toMatch(/barre/);
    await dictionary(page).getByRole("button", { name: "NO BARRES" }).click();
    await dictionary(page).getByRole("button", { name: "EASY ONLY" }).click();
    for (const label of await dictionary(page).locator('[data-voicing] [role="img"][aria-label^="Difficulty"]').evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")!)))
      expect(Number(/Difficulty (\d)/.exec(label)![1])).toBeLessThanOrEqual(2);
    await dictionary(page).getByRole("button", { name: "EASY ONLY" }).click();
    await radio(page, "Position", "HIGH").click();
    for (const text of await dictionary(page).locator("[data-voicing]").allInnerTexts()) expect(text).toMatch(/frets? 1\d/);
    // Nothing left: say so, with a way back.
    await radio(page, "Position", "OPEN").click();
    await radio(page, "Root", "A#/Bb").click();
    await radio(page, "Chord type", "MAJ7").click();
    await expect(dictionary(page)).toContainText("No A#maj7 shapes match these filters");
    await dictionary(page).getByRole("button", { name: "SHOW ALL" }).click();
    expect((await voicingIds(page)).length).toBeGreaterThan(0);
  });

  test("the neck shows every chord tone and fills in the picked shape; NEXT steps through them", async ({ page }, info) => {
    onlyAtWidths(info, [390, 1440]);
    lightOnly(info);
    const neck = dictionary(page).locator(`svg[data-neck="${info.project.use.viewport!.width < 834 ? "vertical" : "horizontal"}"]`);
    await expect(neck).toBeVisible();
    // Open G: low E 3rd fret is a filled root.
    await expect(neck.locator('[data-dot="0:3"] text')).toHaveText("R");
    await expect(neck.locator('[data-dot="0:3"] circle')).toHaveClass(/fill-accent/);
    // Every G, B and D from the open strings to the 15th fret: 25 places on the neck.
    expect(await neck.locator("[data-dot]").count()).toBe(25);
    await dictionary(page).getByRole("button", { name: "NEXT ›" }).click();
    const second = (await voicingIds(page))[1]!;
    await expect(dictionary(page).locator(`[data-voicing="${second}"] button[aria-label$="show on the neck"]`)).toHaveAttribute("aria-pressed", "true");
    await expect(dictionary(page)).toContainText("position 2 of");
    // The scale of the key fills in behind.
    const before = await neck.locator("circle.fill-line-strong").count();
    await radio(page, "Scale", "MAJOR").click();
    expect(await neck.locator("circle.fill-line-strong").count()).toBeGreaterThan(before);
  });

  test("left-handed mirrors the boxes and the neck", async ({ page }, info) => {
    onlyAtWidths(info, [1440]);
    lightOnly(info);
    const neck = dictionary(page).locator('svg[data-neck="horizontal"]');
    const x = async (dot: string) => (await neck.locator(`[data-dot="${dot}"] circle`).boundingBox())!.x;
    expect(await x("2:0")).toBeLessThan(await x("0:3")); // the nut on the left
    await radio(page, "Handed", "LEFT").click();
    expect(await x("2:0")).toBeGreaterThan(await x("0:3")); // on the right
  });
});
