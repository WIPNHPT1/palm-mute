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

// 02 Name that chord
const nameIt = (page: Page) => page.locator('[data-tool="name-it"]');
const named = (page: Page) => nameIt(page).locator("[data-chord-name]");
const typeShape = async (page: Page, shape: string) => nameIt(page).getByRole("textbox", { name: /Shape/ }).fill(shape);

test.describe("chord lab: name that chord", () => {
  test.beforeEach(async ({ page }) => {
    await gotoAndSettle(page, "/chords/");
  });

  test("tapping frets on the neck names the chord as you go", async ({ page }, info) => {
    onlyAtWidths(info, [390, 1440]);
    lightOnly(info);
    await expect(named(page)).toHaveText("—");
    const tap = (s: number, f: number) => nameIt(page).locator(`rect[data-tap="${s}:${f}"]`).filter({ visible: true }).first().click({ force: true });
    await tap(1, 3);
    await expect(nameIt(page)).toContainText("One note: C");
    await tap(2, 2);
    await tap(3, 0);
    await tap(4, 1);
    await tap(5, 0);
    await expect(named(page)).toHaveText("C");
    await expect(nameIt(page).getByRole("textbox", { name: /Shape/ })).toHaveValue("x32010");
    await expect(nameIt(page).getByRole("list", { name: "Keys C belongs to" })).toContainText("G major: IV");
    await expect(nameIt(page).getByRole("list", { name: "Keys C belongs to" })).toContainText("C major: I");
    await tap(2, 2); // tap again to take it off
    await expect(nameIt(page).getByRole("textbox", { name: /Shape/ })).toHaveValue("x3x010");
  });

  test("typing a shape names it: inversions, sus and add9, power chords, and non-chords", async ({ page }, info) => {
    onlyAtWidths(info, [390, 1440]);
    lightOnly(info);
    for (const [shape, name] of [["320003", "G"], ["x32033", "Cadd9"], ["x02210", "Am"], ["x30013", "Csus2"], ["355xxx", "G5"], ["032010", "C/E"]] as const) {
      await typeShape(page, shape);
      await expect(named(page), shape).toHaveText(name);
    }
    await typeShape(page, "x34xxx");
    await expect(nameIt(page)).toContainText("Not a chord in the Lab");
    await typeShape(page, "x3201");
    await expect(nameIt(page).getByRole("textbox", { name: /Shape/ })).toHaveAttribute("aria-invalid", "true");
    await expect(nameIt(page)).toContainText("Six strings");
    await typeShape(page, "x-12-14-14-14-12");
    await expect(named(page)).toHaveText("A");
  });

  test("a sounding shape plays exactly the notes the tab says", async ({ page }, info) => {
    onlyAtWidths(info, [390, 1440]);
    lightOnly(info);
    await typeShape(page, "x32010");
    await nameIt(page).getByRole("button", { name: "Play C strummed" }).click();
    const pb = (await lastPlayback(page))!;
    expect(pb.bpm).toBe(150);
    expect(pb.bars[0].cells[0]!.notes).toEqual([48, 52, 55, 60, 64]); // x32010 in E standard
  });

  test("a shape one fret off a chord suggests the fix; a dictionary shape links to it", async ({ page }, info) => {
    onlyAtWidths(info, [390, 1440]);
    lightOnly(info);
    await typeShape(page, "x32011");
    await expect(nameIt(page).locator("[data-near]")).toContainText("Did you mean");
    await nameIt(page).locator("[data-near]").getByRole("button", { name: /^USE / }).click();
    await expect(nameIt(page).getByRole("textbox", { name: /Shape/ })).not.toHaveValue("x32013");
    // A shape the Dictionary has: look it up there, opened on that very shape.
    await typeShape(page, "x02210");
    await nameIt(page).getByRole("button", { name: "LOOK UP AM IN THE DICTIONARY" }).click();
    await expect(dictionary(page).locator("[data-chord-info]")).toContainText("Am (minor)");
    await expect(dictionary(page).locator('[data-voicing="x02210"] button[aria-label$="show on the neck"]')).toHaveAttribute("aria-pressed", "true");
  });

  test("it follows the tuning, and the neck mirrors for left-handed players", async ({ page }, info) => {
    onlyAtWidths(info, [1440]);
    lightOnly(info);
    await radio(page, "Tuning", "DROP D").click();
    await typeShape(page, "000xxx");
    await expect(named(page)).toHaveText("D5");
    await radio(page, "Tuning", "E STD").click();
    await expect(named(page)).toHaveText("Asus4/E"); // the same frets are different notes in another tuning
  });
});

// 03 Progression builder
const builder = (page: Page) => page.locator('[data-tool="builder"]');
const loopNames = (page: Page) => builder(page).locator("[data-loop] li button").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")!.replace(/^Chord \d+: /, "")));

test.describe("chord lab: progression builder", () => {
  test.beforeEach(async ({ page }) => {
    await gotoAndSettle(page, "/chords/");
  });

  test("starts on I-V-vi-IV as power chords in the key; the palette adds chords, borrowed ones included", async ({ page }, info) => {
    onlyAtWidths(info, [390, 1440]);
    lightOnly(info);
    expect(await loopNames(page)).toEqual(["I, G5", "V, D5", "vi, E5", "IV, C5"]);
    await builder(page).getByRole("button", { name: "Add bVII, F5", exact: true }).click();
    await builder(page).getByRole("button", { name: "Add iv, C5", exact: true }).click();
    expect((await loopNames(page)).slice(4)).toEqual(["bVII, F5", "iv, C5"]);
    await radio(page, "Key", "D").click();
    await expect(builder(page).getByRole("button", { name: "Add vi, B5", exact: true })).toBeVisible();
    // Full chords: new chords come in as their natural quality.
    await radio(page, "Chord sound", "FULL CHORDS").click();
    await builder(page).getByRole("button", { name: "Add vi, Bm", exact: true }).click();
    expect((await loopNames(page)).at(-1)).toBe("vi, Bm");
  });

  test("a loop holds eight chords; edit a chord's type, move it, remove it", async ({ page }, info) => {
    onlyAtWidths(info, [390, 1440]);
    lightOnly(info);
    for (let i = 0; i < 4; i++) await builder(page).getByRole("button", { name: "Add I, G5", exact: true }).click();
    expect(await loopNames(page)).toHaveLength(8);
    await expect(builder(page).getByRole("button", { name: "Add I, G5", exact: true })).toBeDisabled();
    await builder(page).getByRole("button", { name: "Chord 2: V, D5" }).click();
    await builder(page).locator("[data-chord-editor]").getByRole("radio", { name: "SUS4" }).click();
    expect((await loopNames(page))[1]).toBe("V, Dsus4");
    await builder(page).getByRole("button", { name: /MOVE LEFT/ }).click();
    expect((await loopNames(page)).slice(0, 2)).toEqual(["V, Dsus4", "I, G5"]);
    await builder(page).getByRole("button", { name: "REMOVE" }).click();
    expect(await loopNames(page)).toHaveLength(7);
    await builder(page).getByRole("button", { name: "CLEAR" }).click();
    await expect(builder(page).locator("[data-loop]")).toContainText("Empty");
    await expect(builder(page).getByRole("button", { name: /PLAY THE LOOP/ })).toBeDisabled();
    await builder(page).getByRole("button", { name: "START OVER" }).click();
    expect(await loopNames(page)).toHaveLength(4);
  });

  test("what next? suggests the three likeliest chords after the last one, and adds them", async ({ page }, info) => {
    onlyAtWidths(info, [390, 1440]);
    lightOnly(info);
    // After IV in a pop-punk loop: back home, the V, or the vi.
    const next = builder(page).getByRole("list", { name: "Likely next chords" }).getByRole("button");
    await expect(next).toHaveCount(3);
    await expect(next.first()).toHaveAccessibleName("Add I next, G5");
    await next.first().click();
    expect((await loopNames(page)).at(-1)).toBe("I, G5");
    await expect(builder(page)).toContainText("What next? After I");
  });

  test("the loop plays what it shows: one bar per chord, in the Lab's tuning, looping", async ({ page }, info) => {
    onlyAtWidths(info, [390, 1440]);
    lightOnly(info);
    await builder(page).getByRole("button", { name: "PLAY THE LOOP" }).click();
    let pb = (await lastPlayback(page))!;
    expect(pb.bpm).toBe(150);
    expect(pb.loop).toBe(true);
    expect(pb.bars).toHaveLength(4);
    // G5, D5, E5, C5: the bass note of each bar's strum.
    expect(pb.bars.map((b) => b.cells[0]!.notes[0] % 12)).toEqual([7, 2, 4, 0]);
    // Editing stops the loop; a new tuning changes the sound.
    await builder(page).getByRole("button", { name: "Add I, G5", exact: true }).click();
    await expect.poll(() => lastPlayback(page)).toBeNull();
    await radio(page, "Tuning", "DROP D").click();
    await builder(page).getByRole("button", { name: "PLAY THE LOOP" }).click();
    pb = (await lastPlayback(page))!;
    expect(pb.bars[0].cells[0]!.notes[0]).toBe(43); // G5 in Drop D is still G
    expect(pb.bars).toHaveLength(5);
  });

  test("the vibe meters follow the loop", async ({ page }, info) => {
    onlyAtWidths(info, [390, 1440]);
    lightOnly(info);
    const meter = (name: string) => builder(page).getByRole("meter", { name });
    await expect(meter("How classic")).toHaveAttribute("aria-valuenow", "100");
    const bright = Number(await meter("Dark to bright").getAttribute("aria-valuenow"));
    await expect(builder(page)).toContainText("It ends part-way"); // ends on IV
    await builder(page).getByRole("button", { name: "Add V, D5", exact: true }).click();
    await expect(builder(page)).toContainText("It ends away from home");
    await builder(page).getByRole("button", { name: "CLEAR" }).click();
    for (const d of ["vi", "iv", "bVI", "vi"]) await builder(page).getByRole("list", { name: "Chords in the key" }).getByRole("button", { name: new RegExp(`^Add ${d},`) }).click();
    expect(Number(await meter("Dark to bright").getAttribute("aria-valuenow"))).toBeLessThan(bright);
    await expect(builder(page)).toContainText("Your own twist");
    await builder(page).getByRole("button", { name: "CLEAR" }).click();
    for (const d of ["IV", "V", "I"]) await builder(page).getByRole("button", { name: new RegExp(`^Add ${d},`) }).click();
    await expect(builder(page)).toContainText("It ends at home");
  });
});

// 04 Key finder & transposer
const finder = (page: Page) => page.locator('[data-tool="key-finder"]');
const fits = (page: Page) => finder(page).locator("[data-key-fits] li");
const typeChords = async (page: Page, chords: string) => finder(page).getByRole("textbox", { name: /Chords/ }).fill(chords);
const stepper = (page: Page, label: string, dir: "up" | "down") => finder(page).getByRole("button", { name: `${label} ${dir}`, exact: true });

test.describe("chord lab: key finder and transposer", () => {
  test.beforeEach(async ({ page }) => {
    await gotoAndSettle(page, "/chords/");
  });

  test("G D Em C is found in G major, best first, with a numeral for every chord", async ({ page }, info) => {
    onlyAtWidths(info, [390, 1440]);
    lightOnly(info);
    await expect(fits(page).first()).toContainText("Best fit · G major (relative E minor): I · V · vi · IV");
    await expect(fits(page)).toHaveCount(3);
    await typeChords(page, "Am F C G");
    await expect(fits(page).first()).toContainText("C major (relative A minor): vi · IV · I · V");
    // A chord outside the key is flagged; a borrowed one is named.
    await typeChords(page, "G F C G");
    await expect(fits(page).first()).toContainText("C major");
    await typeChords(page, "G D C F");
    await expect(finder(page)).toContainText("bVII (borrowed)");
    // Power chords, 7ths and sus chords are read.
    await typeChords(page, "A5 E5 F#5 D5");
    await expect(fits(page).first()).toContainText("A major");
    await typeChords(page, "F#m7, Bbadd9 Dsus4");
    await expect(fits(page)).not.toHaveCount(0);
  });

  test("unreadable chords are named; fewer than two chords asks for more", async ({ page }, info) => {
    onlyAtWidths(info, [390, 1440]);
    lightOnly(info);
    await typeChords(page, "G H Em");
    await expect(finder(page)).toContainText("Couldn't read: H");
    await expect(fits(page).first()).toContainText("G major"); // the two it could read
    await typeChords(page, "G");
    await expect(finder(page)).toContainText("Add at least two chords");
    await expect(fits(page)).toHaveCount(0);
  });

  test("transpose, go to a key, and a capo: the sound and the shapes agree", async ({ page }, info) => {
    onlyAtWidths(info, [390, 1440]);
    lightOnly(info);
    const sounds = finder(page).locator("[data-sounds]");
    const shapes = finder(page).locator("[data-shapes]");
    await expect(sounds).toHaveText("G · D · Em · C");
    await stepper(page, "Transpose", "up").click();
    await stepper(page, "Transpose", "up").click();
    await expect(sounds).toHaveText("A · E · F#m · D");
    await expect(finder(page).getByRole("status", { name: "Transpose now" })).toHaveText("+2 semitones");
    // Capo 2: play G shapes to sound A.
    await stepper(page, "Capo", "up").click();
    await stepper(page, "Capo", "up").click();
    await expect(shapes).toContainText("G · D · Em · C");
    await expect(shapes).toContainText("With the capo at fret 2");
    // Go straight to a key.
    await finder(page).getByRole("radio", { name: "Move to D major" }).click();
    await expect(sounds).toHaveText("D · A · Bm · G");
    await expect(finder(page).getByRole("radio", { name: "Move to D major" })).toHaveAttribute("aria-checked", "true");
    // Playing it: the loop sounds the shapes plus the capo's frets.
    await finder(page).getByRole("button", { name: "HEAR IT" }).click();
    const pb = (await lastPlayback(page))!;
    expect(pb.loop).toBe(true);
    expect(pb.bars).toHaveLength(4);
    // D major with the capo at 2: C shapes + 2 frets; the first bar's bass is a D (pitch class 2).
    expect(pb.bars[0].cells[0]!.notes[0] % 12).toBe(2);
    expect(pb.bars.map((b) => b.cells[0]!.notes[0] % 12)).toEqual([2, 9, 11, 7]);
  });

  test("the Builder sends its loop here", async ({ page }, info) => {
    onlyAtWidths(info, [390, 1440]);
    lightOnly(info);
    await builder(page).getByRole("button", { name: "Add bVII, F5", exact: true }).click();
    await builder(page).getByRole("button", { name: /FIND THIS LOOP/ }).click();
    await expect(finder(page).getByRole("textbox", { name: /Chords/ })).toHaveValue("G5 D5 E5 C5 F5");
    // Power chords fit several keys: all five are natural chords of C, and G reads F5 as a borrowed bVII.
    await expect(fits(page).first()).toContainText("C major");
    await expect(fits(page).filter({ hasText: "G major" })).toContainText("bVII (borrowed)");
  });
});
