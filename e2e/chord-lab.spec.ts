import { type Page } from "@playwright/test";
import { expect, gotoAndSettle, lightOnly, onlyAtWidths, projectWidth, test } from "./fixtures";
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
    await radio(page, "Root", "C#/Db").click();
    await radio(page, "Chord type", "MAJ7").click();
    await expect(dictionary(page)).toContainText("No C#maj7 shapes match these filters"); // no open C#maj7 grip
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

  test("on a phone the answer stays on screen while you tap the tall neck", async ({ page }, info) => {
    onlyAtWidths(info, [320, 390]);
    lightOnly(info);
    // A short phone as well as a tall one.
    for (const height of [568, 844]) {
      await page.setViewportSize({ width: projectWidth(info), height });
      await page.goto("/chords/#name-it");
      await page.waitForLoadState("networkidle");
      await nameIt(page).getByRole("button", { name: "CLEAR" }).click();
      const neck = nameIt(page).locator('svg[data-neck="vertical"]');
      await neck.scrollIntoViewIfNeeded();
      // Shapes the tool names as you add strings: a C chord, string by string (the fret 15 tap is the furthest down).
      for (const [s, f] of [[1, 3], [2, 2], [3, 0], [4, 1], [5, 0], [2, 15]] as const) {
        const rect = nameIt(page).locator(`rect[data-tap="${s}:${f}"]`).filter({ visible: true }).first();
        await rect.click(); // a real tap: it fails if anything covers the target
        const box = (await named(page).boundingBox())!;
        const view = page.viewportSize()!;
        expect(box.y, `chord name below the top bar after tapping ${s}:${f} at ${height}px`).toBeGreaterThanOrEqual(60);
        expect(box.y + box.height, `chord name inside the screen after tapping ${s}:${f} at ${height}px`).toBeLessThanOrEqual(view.height);
        if (s === 5) await expect(named(page)).toHaveText("C");
      }
      await expect(page.locator("[data-chord-name]")).toHaveCount(1);
    }
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

  test("slash chords and names the Lab has no type for are read (and the page says how)", async ({ page }, info) => {
    onlyAtWidths(info, [390, 1440]);
    lightOnly(info);
    await typeChords(page, "G/B D Em C");
    await expect(fits(page).first()).toContainText("G major (relative E minor): I (G/B) · V · vi · IV");
    await expect(finder(page)).not.toContainText("Couldn't read");
    await typeChords(page, "Gdim C");
    await expect(finder(page)).toContainText("Read Gdim as Gm.");
    await expect(finder(page)).not.toContainText("Couldn't read");
    await typeChords(page, "C G9 Am6 F");
    await expect(finder(page)).toContainText("Read G9 as G7. Read Am6 as Am.");
    await expect(fits(page).first()).toContainText("C major");
    // What Name that chord writes goes straight in.
    await typeChords(page, "C/E G octave");
    await expect(finder(page)).not.toContainText("Couldn't read");
    await typeChords(page, "G H");
    await expect(finder(page)).toContainText("Couldn't read: H");
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

// 05 Mood map
const mood = (page: Page) => page.locator('[data-tool="mood-map"]');
const dot = (page: Page, id: string) => mood(page).locator(`[data-loop-id="${id}"]`);
/** A tap on a dot's centre (on phones the plot picks the nearest loop; elsewhere the dot is a button). */
const tapDot = async (page: Page, id: string) => {
  await dot(page, id).scrollIntoViewIfNeeded();
  const box = (await dot(page, id).boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
};

test.describe("chord lab: mood map", () => {
  test.beforeEach(async ({ page }) => {
    await gotoAndSettle(page, "/chords/");
  });

  test("26 loops on the map, the app's ten among them, every one a tappable dot and a chip", async ({ page }, info) => {
    onlyAtWidths(info, [390, 1440]);
    lightOnly(info);
    await expect(mood(page).locator("[data-loop-id]")).toHaveCount(26);
    await expect(mood(page).locator("[data-chip]")).toHaveCount(26);
    for (const id of ["I-V-vi-IV", "vi-IV-I-V", "I-IV-V", "vi-V-IV", "V-vi-IV-I"]) await expect(dot(page, id)).toBeVisible();
    await expect(mood(page).locator("[data-picked]")).toHaveText("I-V-vi-IV");
    for (const q of ["Tense", "Anthem", "Brooding", "Feel-good"]) await expect(mood(page).locator("[data-plot]")).toContainText(q);
  });

  test("tapping a dot, a chip or empty space picks the loop and plays it in your key", async ({ page }, info) => {
    onlyAtWidths(info, [390, 1440]);
    lightOnly(info);
    await tapDot(page, "vi-IV-I-V");
    await expect(mood(page).locator("[data-picked]")).toHaveText("vi-IV-I-V");
    await expect(mood(page).locator("[data-mood-panel]")).toContainText("Em"); // vi of G, as a minor chord
    let pb = (await lastPlayback(page))!;
    expect(pb.bpm).toBe(150);
    expect(pb.loop).toBe(true);
    // Em C G D: the bass of each bar.
    expect(pb.bars.map((b) => b.cells[0]!.notes[0] % 12)).toEqual([4, 0, 7, 2]);
    await mood(page).locator('[data-chip="I-IV-V"]').click();
    await expect(mood(page).locator("[data-picked]")).toHaveText("I-IV-V");
    pb = (await lastPlayback(page))!;
    expect(pb.bars.map((b) => b.cells[0]!.notes[0] % 12)).toEqual([7, 0, 2]);
    // Space beside a dot picks the nearest loop (on phones this is how every tap works).
    await dot(page, "V-vi-IV-I").scrollIntoViewIfNeeded();
    const box = (await dot(page, "V-vi-IV-I").boundingBox())!;
    const plot = (await mood(page).locator("[data-plot]").boundingBox())!;
    await page.mouse.click(Math.min(box.x + box.width / 2 + 5, plot.x + plot.width - 3), box.y + box.height / 2 + 4);
    await expect(mood(page).locator("[data-picked]")).toHaveText("V-vi-IV-I");
    // Tapping the playing loop's button stops it.
    await mood(page).getByRole("button", { name: /^STOP$/ }).click();
    await expect.poll(() => lastPlayback(page)).toBeNull();
  });

  test("the key changes the chords; the star follows the Builder's loop", async ({ page }, info) => {
    onlyAtWidths(info, [390, 1440]);
    lightOnly(info);
    await radio(page, "Key", "D").click();
    await expect(mood(page).locator("[data-mood-panel]")).toContainText("Bm"); // vi of D
    await expect(mood(page).getByRole("button", { name: "HEAR IT IN D" })).toBeVisible();
    const star = mood(page).locator("[data-star]");
    const at = async () => (await star.boundingBox())!;
    const before = await at();
    // Make the loop dark and unsettled: the star moves.
    await builder(page).getByRole("button", { name: "CLEAR" }).click();
    for (const d of ["vi", "iii", "ii"]) await builder(page).getByRole("list", { name: "Chords in the key" }).getByRole("button", { name: new RegExp(`^Add ${d},`) }).click();
    const after = await at();
    expect(Math.abs(after.x - before.x) + Math.abs(after.y - before.y)).toBeGreaterThan(20);
    expect(after.x).toBeLessThan(before.x); // darker, so further left
    // An empty loop has no star.
    await builder(page).getByRole("button", { name: "CLEAR" }).click();
    await expect(star).toHaveCount(0);
    await expect(mood(page)).toContainText("it's empty");
  });

  test("it plays the shapes in the Lab's tuning", async ({ page }, info) => {
    onlyAtWidths(info, [1440]);
    lightOnly(info);
    await radio(page, "Tuning", "DROP D").click();
    await tapDot(page, "I-V-vi-IV");
    const pb = (await lastPlayback(page))!;
    expect(pb.bars.map((b) => b.cells[0]!.notes[0] % 12)).toEqual([7, 2, 4, 0]); // G D Em C: roots in the bass
  });
});

// Keyboard: one Tab stop per radio group, arrow keys inside it
test.describe("chord lab: keyboard", () => {
  test.beforeEach(async ({ page }) => {
    await gotoAndSettle(page, "/chords/");
  });

  test("Tab reaches the first Dictionary shape in at most 20 stops (each group is one stop)", async ({ page }, info) => {
    onlyAtWidths(info, [1440]);
    lightOnly(info);
    // Counting Tab presses needs a browser that Tabs to buttons: Safari doesn't unless its setting is on, and
    // WebKit on macOS follows it. The per-group check below (one radio in the Tab order) runs in both.
    if (info.project.name.startsWith("chromium")) {
      let stops = 0;
      for (; stops < 60; stops++) {
        await page.keyboard.press("Tab");
        if (await page.evaluate(() => !!document.activeElement?.closest("[data-voicing]"))) break;
      }
      expect(stops + 1).toBeLessThanOrEqual(20);
    }
    // Every radio group on the page has exactly one radio in the Tab order.
    const groups = await page.locator('[role="radiogroup"]').evaluateAll((els) => els.filter((e) => e.getClientRects().length).map((e) => ({ label: e.getAttribute("aria-label") ?? e.getAttribute("aria-labelledby"), tabbable: [...e.querySelectorAll('[role="radio"]')].filter((r) => (r as HTMLElement).tabIndex === 0).length })));
    expect(groups.length).toBeGreaterThan(5);
    for (const g of groups) expect(g.tabbable, `${g.label}`).toBe(1);
  });

  test("arrow keys move inside a radio group and select; Home and End go to the ends; Shift+Tab leaves it", async ({ page }, info) => {
    onlyAtWidths(info, [1440]);
    lightOnly(info);
    const roots = page.getByRole("radiogroup", { name: "Root" }).getByRole("radio");
    await roots.nth(7).focus(); // G
    await expect(roots.nth(7)).toHaveAttribute("aria-checked", "true");
    await page.keyboard.press("ArrowRight");
    await expect(roots.nth(8)).toBeFocused();
    await expect(roots.nth(8)).toHaveAttribute("aria-checked", "true"); // selection follows focus
    await expect(dictionary(page).locator("[data-chord-info]")).toContainText("G#");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    await expect(roots.nth(6)).toBeFocused();
    await page.keyboard.press("End");
    await expect(roots.nth(11)).toBeFocused();
    await page.keyboard.press("ArrowDown"); // wraps
    await expect(roots.nth(0)).toBeFocused();
    await page.keyboard.press("Home");
    await expect(roots.nth(0)).toBeFocused();
    await page.keyboard.press("ArrowUp"); // wraps backwards
    await expect(roots.nth(11)).toBeFocused();
    // One Shift+Tab leaves the group (the previous group's single stop, not another root).
    await page.keyboard.press("Shift+Tab");
    expect(await page.evaluate(() => document.activeElement?.closest('[role="radiogroup"]')?.getAttribute("aria-label"))).not.toBe("Root");
    // The Lab's other groups too: a tuning change by keyboard stops what was playing and re-names the shapes.
    const tunings = page.getByRole("radiogroup", { name: "Tuning" }).getByRole("radio");
    await tunings.nth(0).focus();
    await page.keyboard.press("ArrowRight");
    await expect(tunings.nth(1)).toHaveAttribute("aria-checked", "true");
    await expect(tunings.nth(0)).toHaveAttribute("aria-checked", "false");
  });
});
