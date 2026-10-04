import { type Page } from "@playwright/test";
import { expect, gotoAndSettle, horizontalOverflow, lightOnly, onlyAtWidths, projectWidth, test } from "./fixtures";

// The home page's share of the stage pack (docs/mockups/home-stage-options.html, owner's picks): the same big-screen
// zoom as the other pages, the oscilloscope behind the quiet sections, the two big headings flip in, and the encore
// counts itself in. No rails.

const QUIET = [".ci-intro", ".ci-two", ".ci-board-sec", ".ci-encore"];

async function scrollToCentre(page: Page, selector: string) {
  // Twice: sections further down skip layout until they're near the screen, so the first jump can land short.
  for (let i = 0; i < 2; i++) {
    await page.evaluate((s) => document.querySelector(s)!.scrollIntoView({ block: "center" }), selector);
    await page.waitForTimeout(150);
  }
}

test("big screens: the top bar, the columns and the setlist cards grow with the other pages' zoom", async ({ page }, info) => {
  lightOnly(info);
  await gotoAndSettle(page, "/");
  const w = projectWidth(info);
  const expected = w < 1600 ? 1 : Math.min(1.4, w / 1600);
  const zooms = await page.evaluate(() => {
    const z = (s: string) => Number(getComputedStyle(document.querySelector(s)!).zoom);
    return { header: z("header"), menu: z("#site-menu"), footer: z("footer"), main: z("main"), stage: z(".ci-stage"), column: z(".ci-intro .ci-wrap"), card: z(".ci-panel") };
  });
  for (const k of ["header", "menu", "footer", "column", "card"] as const) expect(zooms[k], k).toBeCloseTo(expected, 2);
  // The page itself and the full-width sections never zoom (the hero's height and the pinned setlist are measured from the window).
  expect(zooms.main).toBe(1);
  expect(zooms.stage).toBe(1);
  // The home page's column lines up with the top bar's, as on the other pages: 1280px zoomed from 1600px, 1440px below.
  const header = (await page.locator("header .mx-auto").first().boundingBox())!;
  const column = (await page.locator(".ci-intro .ci-wrap").boundingBox())!;
  expect(Math.abs(column.x - header.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(column.width - header.width)).toBeLessThanOrEqual(1);
  if (w >= 1600) expect(column.width).toBeCloseTo(Math.min(w, 1280 * expected), 0);
  // The hero starts right under the (zoomed) top bar, and nothing is wider than the screen.
  const bar = (await page.locator("header").boundingBox())!;
  const stage = (await page.locator(".ci-stage").boundingBox())!;
  expect(Math.abs(stage.y - (bar.y + bar.height))).toBeLessThanOrEqual(1);
  expect(await horizontalOverflow(page)).toBe(0);
});

test("the oscilloscope sits behind the quiet sections only, from tablet up, and draws", async ({ page }, info) => {
  lightOnly(info);
  await gotoAndSettle(page, "/");
  const w = projectWidth(info);
  await expect(page.locator("canvas.ci-scope")).toHaveCount(QUIET.length);
  for (const s of QUIET) await expect(page.locator(`${s} > canvas.ci-scope`)).toHaveCount(1);
  await expect(page.locator(".ci-stage canvas.ci-scope, .ci-setlist canvas.ci-scope, .ci-stamp-band canvas.ci-scope")).toHaveCount(0);
  // Not the Generator's whole-page layer: the home page has no fixed stage canvas.
  await expect(page.locator("canvas.stage-bg")).toHaveCount(0);

  await scrollToCentre(page, ".ci-intro");
  await page.waitForTimeout(250);
  const scope = await page.locator(".ci-intro > canvas.ci-scope").evaluate((c: HTMLCanvasElement) => {
    const cs = getComputedStyle(c), r = c.getBoundingClientRect(), sec = c.parentElement!.getBoundingClientRect();
    let ink = 0;
    if (c.width && c.height) {
      const px = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
      for (let i = 3; i < px.length; i += 4 * 97) if (px[i] > 0) ink++;
    }
    return { display: cs.display, pe: cs.pointerEvents, z: cs.zIndex, fits: Math.abs(r.top - sec.top) < 1 && Math.abs(r.height - sec.height) < 1 && Math.abs(r.width - sec.width) < 1, ink };
  });
  if (w < 834) {
    expect(scope.display).toBe("none");
    return;
  }
  expect(scope.display).toBe("block");
  expect(scope.pe).toBe("none");
  expect(scope.z).toBe("-1"); // under the section's own text
  expect(scope.fits, "fills its section").toBe(true);
  expect(scope.ink, "drew a frame").toBeGreaterThan(0);
});

test("\"How it works.\" flips in letter by letter and only ever wraps between words", async ({ page }, info) => {
  lightOnly(info);
  await gotoAndSettle(page, "/");
  const heading = page.locator("#ci-setlist");
  await expect(heading.locator(".flap")).toHaveCount(2);
  await expect(heading.locator(".flap").first()).toHaveAttribute("data-flap", "wait");
  // The setlist pins and slides sideways: its lead card is on screen at the start of it.
  await page.evaluate(() => document.querySelector(".ci-setlist")!.scrollIntoView({ block: "start" }));
  for (const flap of await heading.locator(".flap").all()) await expect(flap).toHaveAttribute("data-flap", "go");
  // Read as words, not letters; the letters' stagger carries on across the line break; "works." stays red, "How it" doesn't.
  await expect(page.getByRole("heading", { name: "How it works." })).toHaveCount(1);
  const state = await heading.evaluate((h) => {
    const letters = [...h.querySelectorAll<HTMLElement>("[data-l]")];
    const words = [...h.querySelectorAll<HTMLElement>(".flap > [aria-hidden] > span")].map((word) => new Set([...word.children].map((l) => (l as HTMLElement).offsetTop)).size);
    const color = (el: Element) => getComputedStyle(el).color;
    return { shown: letters.map((l) => l.dataset.l).join(""), order: letters.map((l) => l.style.getPropertyValue("--i")), words, how: color(letters[0]), works: color(letters[letters.length - 1]), accent: color(h.querySelector(":scope > span:not(.flap)")!) };
  });
  expect(state.shown).toBe("Howitworks.");
  expect(state.order).toEqual(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]);
  expect(state.words, "every word on one line").toEqual([1, 1, 1]);
  expect(state.works).toBe(state.accent);
  expect(state.how).not.toBe(state.accent);
});

test("flipped titles read as words to screen readers, here and on the Chord Lab's cards", async ({ page }, info) => {
  onlyAtWidths(info, [390, 1440]);
  lightOnly(info);
  await gotoAndSettle(page, "/");
  await expect(page.getByRole("heading", { name: "Count it in." })).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "How it works." })).toHaveCount(1);
  await gotoAndSettle(page, "/chords/");
  await expect(page.getByRole("heading", { name: "Mood map" })).toHaveCount(1);
  // The letters on screen are hidden from assistive tech; the title's text is in the page once.
  await expect(page.locator('[data-tool="mood-map"] h2')).toHaveText("Mood map");
  await expect(page.locator('[data-tool="mood-map"] h2 .flap > [aria-hidden="true"] [data-l]')).toHaveCount(7);
});

test("the encore counts itself in: 1 · 2 · 3 · 4 on the beat, then the heading flips in", async ({ page }, info) => {
  onlyAtWidths(info, [390, 1440, 1920]);
  lightOnly(info);
  await gotoAndSettle(page, "/");
  const encore = page.locator(".ci-encore");
  await expect(encore).toHaveAttribute("data-count", "0");
  await expect(page.locator("#ci-encore .flap")).toHaveAttribute("data-flap", "wait");
  // Note each beat's time as it happens.
  await page.evaluate(() => {
    const el = document.querySelector<HTMLElement>(".ci-encore")!;
    const w = window as unknown as { beats: { n: string; t: number; digit: string }[] };
    w.beats = [];
    new MutationObserver(() => w.beats.push({ n: el.dataset.count!, t: performance.now(), digit: el.querySelector(".ci-count")!.textContent! })).observe(el, { attributes: true, attributeFilter: ["data-count"] });
  });
  await scrollToCentre(page, ".ci-encore");
  await expect(encore).toHaveAttribute("data-count", "5", { timeout: 4000 });
  await expect(page.locator("#ci-encore .flap")).toHaveAttribute("data-flap", "go");
  const beats = await page.evaluate(() => (window as unknown as { beats: { n: string; t: number; digit: string }[] }).beats);
  expect(beats.map((b) => b.n)).toEqual(["1", "2", "3", "4", "5"]);
  expect(beats.slice(0, 4).map((b) => b.digit)).toEqual(["1", "2", "3", "4"]);
  // 180 BPM: a third of a second a beat (timers in a busy test browser can run a little late, never early).
  for (let i = 1; i < beats.length; i++) {
    const gap = beats[i].t - beats[i - 1].t;
    expect(gap, `beat ${i} to ${i + 1}`).toBeGreaterThan(290);
    expect(gap, `beat ${i} to ${i + 1}`).toBeLessThan(600);
  }
  // The numbers are decoration: hidden from screen readers, and gone once the heading has landed.
  await expect(page.locator(".ci-count")).toHaveAttribute("aria-hidden", "true");
  await expect(page.locator(".ci-count")).toHaveText("");
  await expect(page.getByRole("heading", { name: "Count it in." })).toBeVisible();
  // Once a visit: scrolling away and back doesn't count again.
  await scrollToCentre(page, ".ci-intro");
  await scrollToCentre(page, ".ci-encore");
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => (window as unknown as { beats: unknown[] }).beats.length)).toBe(5);
});

test("reduced motion: no count, no flips, no moving scope", async ({ page }, info) => {
  onlyAtWidths(info, [390, 1440]);
  lightOnly(info);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await gotoAndSettle(page, "/");
  expect(await page.locator("#ci-setlist .flap[data-flap], #ci-encore .flap[data-flap]").count()).toBe(0);
  await scrollToCentre(page, ".ci-encore");
  await page.waitForTimeout(1600);
  await expect(page.locator(".ci-encore")).toHaveAttribute("data-count", "0");
  await expect(page.locator(".ci-count")).toHaveText("");
  // The scope draws one still frame: two looks a beat apart are the same picture.
  if (projectWidth(info) >= 834) {
    const frame = () => page.locator(".ci-encore > canvas.ci-scope").evaluate((c: HTMLCanvasElement) => c.toDataURL());
    const a = await frame();
    await page.waitForTimeout(400);
    expect(await frame()).toBe(a);
  }
});
