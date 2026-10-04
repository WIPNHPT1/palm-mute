import { type Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { feel } from "./helpers";

// Generator and Chord Lab, with their extra states showing: Mid-Tempo picked and a locked section's update
// action; a drop tuning, left-handed diagrams and a 7th chord in the Lab.
const PAGES: { path: string; chips: boolean; setup: (page: Page) => Promise<void> }[] = [
  {
    path: "/generator/",
    chips: true,
    setup: async (page) => {
      await feel(page, /MID-TEMPO/).click();
      await page.getByRole("radiogroup", { name: "Key" }).getByRole("radio", { name: "C", exact: true }).click();
    },
  },
  {
    path: "/chords/",
    chips: false,
    setup: async (page) => {
      await page.getByRole("radiogroup", { name: "Tuning" }).getByRole("radio", { name: "DROP D" }).click();
      await page.getByRole("radiogroup", { name: "Handed" }).getByRole("radio", { name: "LEFT" }).click();
      await page.getByRole("radiogroup", { name: "Chord type" }).getByRole("radio", { name: "7", exact: true }).click();
    },
  },
];

for (const { path, chips: hasChips, setup } of PAGES) {
  test.describe(`accessibility ${path}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(path);
      await setup(page);
    });

    test("every tap target is at least 44×44px (design pixels: 90% of that from 1440px)", async ({ page }) => {
      const small = await page.evaluate(() => {
        const u = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--u")) || 1; // 0.9 from 1440px (design scale)
        return [...document.querySelectorAll<HTMLElement>("header a, header button, main a, main button, main input, footer a, footer button")]
          .filter((el) => el.getClientRects().length && getComputedStyle(el).visibility !== "hidden")
          .map((el) => ({ el, r: el.getBoundingClientRect() }))
          .filter(({ r }) => r.width < 43.5 * u || r.height < 43.5 * u)
          .map(({ el, r }) => `${el.tagName} "${el.getAttribute("aria-label") ?? el.textContent?.trim()}" ${Math.round(r.width)}×${Math.round(r.height)}`);
      });
      expect(small).toEqual([]);
    });

    test("no text below 12px (design pixels: 10.8px from 1440px), except tab art hidden behind a text alternative", async ({ page }) => {
      const tiny = await page.evaluate(() => {
        const out: string[] = [];
        const u = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--u")) || 1; // 0.9 from 1440px (design scale)
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          const el = n.parentElement!;
          if (!n.textContent!.trim() || !el.getClientRects().length) continue;
          if (el.closest('[aria-hidden="true"], .sr-only, #site-menu')) continue;
          const size = parseFloat(getComputedStyle(el).fontSize);
          if (size < 12 * u - 0.01) out.push(`${size}px "${n.textContent!.trim().slice(0, 30)}"`);
        }
        return out;
      });
      expect(tiny).toEqual([]);
      // Hidden tab art must have a spoken alternative right next to it.
      const orphans = await page.evaluate(() =>
        [...document.querySelectorAll('main [aria-hidden="true"]')]
          .filter((el) => /[-|]{3}/.test(el.textContent ?? ""))
          .filter((el) => !el.closest('[role="img"][aria-label]') && !el.parentElement!.querySelector(".sr-only")).length,
      );
      expect(orphans).toBe(0);
    });

    test("small text has at least 4.5:1 contrast (large text 3:1)", async ({ page }) => {
      const failures = await page.evaluate(() => {
        const parse = (c: string) => (c.match(/[\d.]+/g) ?? []).map(Number) as number[];
        const lum = ([r, g, b]: number[]) =>
          [r, g, b].map((v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)).reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
        const blend = (top: number[], bottom: number[]) => {
          const a = top[3] ?? 1;
          return [0, 1, 2].map((i) => top[i] * a + bottom[i] * (1 - a));
        };
        function background(el: Element): number[] {
          // A chosen segment's ink is the sliding thumb behind it (a sibling), not the button's own background.
          const thumb = el.closest('[role="radio"][aria-checked="true"]')?.parentElement?.querySelector(":scope > .sig-thumb");
          if (thumb) {
            const c = parse(getComputedStyle(thumb).backgroundColor);
            if (c.length) return c.slice(0, 3);
          }
          const layers: number[][] = [];
          for (let e: Element | null = el; e; e = e.parentElement) {
            const c = parse(getComputedStyle(e).backgroundColor);
            if (c.length && (c[3] ?? 1) > 0) {
              layers.push(c);
              if ((c[3] ?? 1) >= 1) break;
            }
          }
          let bg = [255, 255, 255];
          for (const l of layers.reverse()) bg = blend(l, bg);
          return bg;
        }
        const out: string[] = [];
        const seen = new Set<Element>();
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          const el = n.parentElement!;
          if (seen.has(el) || !n.textContent!.trim() || !el.getClientRects().length) continue;
          seen.add(el);
          if (el.closest('.sr-only, #site-menu, [disabled], [aria-hidden="true"]')) continue;
          const cs = getComputedStyle(el);
          // Gradient text (the page titles' ember fade) is painted by its background; every colour stop has to pass.
          const clipped = cs.backgroundClip === "text" || cs.getPropertyValue("-webkit-background-clip") === "text";
          const fgs = clipped ? [...cs.backgroundImage.matchAll(/rgba?\([^)]*\)/g)].map((m) => parse(m[0])) : [parse(cs.color)];
          const bg = background(el);
          const ratio = Math.min(
            ...fgs.map((fg) => {
              const [l1, l2] = [lum(blend(fg, bg)), lum(bg)].sort((a, b) => b - a);
              return (l1 + 0.05) / (l2 + 0.05);
            }),
          );
          const size = parseFloat(cs.fontSize);
          const large = size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700);
          if (ratio < (large ? 3 : 4.5)) out.push(`${ratio.toFixed(2)} "${n.textContent!.trim().slice(0, 30)}" ${cs.color} on rgb(${bg.map(Math.round).join(",")})`);
        }
        return out;
      });
      expect(failures).toEqual([]);
    });

    test("tabs and chips speak note and chord names, not dashes", async ({ page }) => {
      const tabs = page.locator("main svg[data-tab]");
      for (let i = 0; i < (await tabs.count()); i++) {
        await expect(tabs.nth(i)).toHaveAttribute("aria-hidden", "true");
        const spoken = (await tabs.nth(i).locator("xpath=following-sibling::p[contains(@class,'sr-only')]").textContent())!;
        expect(spoken).toMatch(/[A-G]#? on the (low E|A|D|G|B|high e) string, (open|\d+(st|nd|rd|th) fret)/);
        expect(spoken).not.toMatch(/--|\|/);
      }
      const chips = page.locator("main [data-chip]");
      if (!hasChips) return;
      expect(await chips.count()).toBeGreaterThan(0);
      for (const label of await chips.evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")!))) {
        expect(label).toMatch(/^(I|ii|iii|IV|V|vi|vii) chord, [A-G]#?5: [A-G]#? on the .+ string, .+, and [A-G]#? on the .+ string, .+$/);
      }
    });
  });
}
