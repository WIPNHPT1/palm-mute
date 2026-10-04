import { expect, gotoAndSettle, horizontalOverflow, projectWidth, test } from "./fixtures";
import { layoutProblems } from "./helpers";

// The Chord Lab's responsive gate (docs/chord-lab-prd.md §8, the song builder's B12 rules). Runs in every
// project: Chromium and WebKit, 320–1920px, light and dark. Each phase that adds a tool extends it.
test.describe("chord lab: every screen", () => {
  test("the setup and the tool strip fit", async ({ page }) => {
    await gotoAndSettle(page, "/chords/");
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    expect(await layoutProblems(page, "[data-lab-setup]")).toEqual([]);
    expect(await layoutProblems(page, 'nav[aria-label="Lab tools"]')).toEqual([]);
  });

  test("the Dictionary fits in every state, and the neck stays readable", async ({ page }) => {
    await gotoAndSettle(page, "/chords/");
    const tool = '[data-tool="dictionary"]';
    for (const [tuning, type, handed] of [["E STD", "MAJOR", "RIGHT"], ["DROP C#", "M7", "LEFT"], ["Eb STD", "ADD9", "RIGHT"]]) {
      await page.getByRole("radiogroup", { name: "Tuning" }).getByRole("radio", { name: tuning, exact: true }).click();
      await page.getByRole("radiogroup", { name: "Chord type" }).getByRole("radio", { name: type, exact: true }).click();
      await page.getByRole("radiogroup", { name: "Handed" }).getByRole("radio", { name: handed, exact: true }).click();
      expect(await horizontalOverflow(page), `${tuning} ${type}`).toBeLessThanOrEqual(0);
      expect(await layoutProblems(page, tool), `${tuning} ${type}`).toEqual([]);
    }
    // The neck: across the card from tablet up, upright on phones; its labels never shrink below ~12px.
    const shown = projectWidth(test.info()) < 834 ? "vertical" : "horizontal";
    const neck = page.locator(`${tool} svg[data-neck="${shown}"]`);
    await expect(neck).toBeVisible();
    const smallest = await neck.evaluate((svg: SVGSVGElement) => {
      const k = svg.getBoundingClientRect().width / svg.viewBox.baseVal.width;
      return Math.min(...[...svg.querySelectorAll("text")].map((t) => parseFloat(t.getAttribute("font-size") ?? getComputedStyle(t).fontSize) * k));
    });
    expect(smallest).toBeGreaterThanOrEqual(11.5);
    // Voicing cards: two or more side by side, never spilling out of the card.
    const cards = await page.locator(`${tool} [data-voicing]`).evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => ({ left: r.left, right: r.right, top: r.top })));
    expect(cards.filter((c) => c.top === cards[0].top).length).toBeGreaterThanOrEqual(2);
    const box = (await page.locator(tool).boundingBox())!;
    for (const c of cards) expect(c.right).toBeLessThanOrEqual(box.x + box.width + 0.5);
  });

  test("Name that chord fits with a shape named, the near-miss hint showing, and a bad shape", async ({ page }) => {
    await gotoAndSettle(page, "/chords/");
    const tool = '[data-tool="name-it"]';
    const input = page.locator(`${tool} input`);
    for (const shape of ["x32010", "x32013", "x3201", "x-10-12-12-10-x"]) {
      await input.fill(shape);
      expect(await horizontalOverflow(page), shape).toBeLessThanOrEqual(0);
      expect(await layoutProblems(page, tool), shape).toEqual([]);
    }
    // The neck's tap areas are real tap targets on phones.
    if (projectWidth(test.info()) < 834) {
      const small = await page.locator(`${tool} rect[data-tap]`).evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).filter((r) => r.width && (r.width < 30 || r.height < 30)).length);
      expect(small).toBe(0);
    }
  });

  test("the Builder fits with a full loop, an open chord editor and the meters", async ({ page }) => {
    await gotoAndSettle(page, "/chords/");
    const tool = '[data-tool="builder"]';
    for (let i = 0; i < 4; i++) await page.locator(tool).getByRole("button", { name: /^Add I, / }).click();
    await page.locator(`${tool} [data-loop] li button`).nth(3).click();
    await page.getByRole("radiogroup", { name: "Chord sound" }).getByRole("radio", { name: "FULL CHORDS" }).click();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    expect(await layoutProblems(page, tool)).toEqual([]);
    // Eight chords in the loop wrap inside the card.
    const box = (await page.locator(tool).boundingBox())!;
    for (const r of await page.locator(`${tool} [data-loop] li`).evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => ({ left: r.left, right: r.right })))) {
      expect(r.left).toBeGreaterThanOrEqual(box.x - 0.5);
      expect(r.right).toBeLessThanOrEqual(box.x + box.width + 0.5);
    }
  });

  test("the Key finder fits with results, a transposed capo'd loop, and an unreadable chord", async ({ page }) => {
    await gotoAndSettle(page, "/chords/");
    const tool = '[data-tool="key-finder"]';
    for (const chords of ["G D Em C", "G D C F Bb Eb Ab Db", "G H Em"]) {
      await page.locator(`${tool} input`).fill(chords);
      await page.locator(`${tool} button[aria-label="Transpose up"]`).click({ trial: true }).catch(() => undefined);
      expect(await horizontalOverflow(page), chords).toBeLessThanOrEqual(0);
      expect(await layoutProblems(page, tool), chords).toEqual([]);
    }
    await page.locator(`${tool} input`).fill("G D Em C");
    for (let i = 0; i < 3; i++) await page.locator(`${tool} button[aria-label="Capo up"]`).click();
    await page.locator(`${tool} button[aria-label="Transpose down"]`).click();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    expect(await layoutProblems(page, tool)).toEqual([]);
  });

  test("the Mood map fits: dots are tap targets, no names overlap or spill, the picked loop is always labelled", async ({ page }) => {
    await gotoAndSettle(page, "/chords/");
    const tool = '[data-tool="mood-map"]';
    for (const id of ["I-V-vi-IV", "I-bVII-IV-I", "vi-iii-IV-V"]) {
      await page.locator(`${tool} [data-chip="${id}"]`).click();
      expect(await horizontalOverflow(page), id).toBeLessThanOrEqual(0);
      expect(await layoutProblems(page, tool), id).toEqual([]);
      const plot = (await page.locator(`${tool} [data-plot]`).boundingBox())!;
      // Every visible dot name stays inside the plot and clear of the others.
      const names = await page.locator(`${tool} [data-loop-id] span`).evaluateAll((els) =>
        els.filter((e) => e.getClientRects().length).map((e) => { const r = e.getBoundingClientRect(); return { text: e.textContent, left: r.left, right: r.right, top: r.top, bottom: r.bottom }; }),
      );
      expect(names.some((n) => n.text === id), `${id} is labelled`).toBe(true);
      for (const n of names) {
        expect(n.left, `${n.text} spills left`).toBeGreaterThanOrEqual(plot.x - 1);
        expect(n.right, `${n.text} spills right`).toBeLessThanOrEqual(plot.x + plot.width + 1);
      }
      for (let i = 0; i < names.length; i++)
        for (let j = i + 1; j < names.length; j++) {
          const a = names[i], b = names[j];
          const overlap = a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
          expect(overlap, `${a.text} and ${b.text} overlap`).toBe(false);
        }
    }
    // No dot sits on a corner label (the labels are Tense, Anthem, Brooding and Feel-good).
    const onLabel = await page.locator(`${tool} [data-plot]`).evaluate((plot) => {
      const labels = [...plot.querySelectorAll(":scope > span[aria-hidden]")].filter((s) => (s.textContent ?? "").trim()).map((s) => {
        const r = document.createRange();
        r.selectNodeContents(s);
        const b = r.getBoundingClientRect();
        return { text: s.textContent, b };
      });
      const hits: string[] = [];
      for (const d of plot.querySelectorAll("[data-loop-id] i")) {
        const a = d.getBoundingClientRect();
        for (const l of labels) if (a.left < l.b.right && l.b.left < a.right && a.top < l.b.bottom && l.b.top < a.bottom) hits.push(`${d.parentElement!.getAttribute("data-loop-id")} on ${l.text}`);
      }
      return { labels: labels.length, hits };
    });
    expect(onLabel.labels).toBe(4);
    expect(onLabel.hits).toEqual([]);
    // The plot is square on phones and 4:3 from tablet up; the panel sits beside it from 1280px, under it below.
    const plot = (await page.locator(`${tool} [data-plot]`).boundingBox())!;
    const panel = (await page.locator(`${tool} [data-mood-panel]`).boundingBox())!;
    const w = projectWidth(test.info());
    expect(Math.abs(plot.width / plot.height - (w < 834 ? 1 : 4 / 3))).toBeLessThan(0.02);
    if (w >= 1280) expect(panel.x).toBeGreaterThan(plot.x + plot.width - 1);
    else expect(panel.y).toBeGreaterThan(plot.y + plot.height - 1);
  });

  test("the whole page at once: every tool in an unusual state, every strip link lands on its card", async ({ page }) => {
    await gotoAndSettle(page, "/chords/");
    await page.getByRole("radiogroup", { name: "Tuning" }).getByRole("radio", { name: "DROP C#", exact: true }).click();
    await page.getByRole("radiogroup", { name: "Handed" }).getByRole("radio", { name: "LEFT", exact: true }).click();
    await page.getByRole("radiogroup", { name: "Key" }).getByRole("radio", { name: "A# / Bb" }).click();
    await page.getByRole("radiogroup", { name: "Chord type" }).getByRole("radio", { name: "MAJ7", exact: true }).click();
    await page.locator('[data-tool="name-it"] input').fill("x-12-14-14-14-12");
    await page.locator('[data-tool="builder"]').getByRole("button", { name: "Add bVII, G#5", exact: true }).click();
    await page.locator('[data-tool="key-finder"] input').fill("A#m F# G# C#m7 Eb");
    await page.locator('[data-tool="mood-map"] [data-chip="I-bVII-IV-I"]').click();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    expect(await layoutProblems(page, "main")).toEqual([]);
    // Each strip link scrolls its card into view (below the sticky bar).
    for (const [id, name] of [["dictionary", /Dictionary/], ["name-it", /Name that chord/], ["builder", /Progression builder/], ["key-finder", /Key finder/], ["mood-map", /Mood map/]] as const) {
      await page.getByRole("navigation", { name: "Lab tools" }).getByRole("link", { name }).click();
      await expect(page).toHaveURL(new RegExp(`#${id}$`));
      await expect.poll(async () => Math.round((await page.locator(`#${id}`).boundingBox())!.y)).toBeLessThan(200);
      expect((await page.locator(`#${id}`).boundingBox())!.y).toBeGreaterThanOrEqual(60);
    }
  });
});
