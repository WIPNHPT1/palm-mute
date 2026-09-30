import { expect, gotoAndSettle, lightOnly, onlyAtWidths, test } from "./fixtures";
import { section } from "./helpers";

// Song critic (data/critic.json): GENERATE writes N takes and keeps the best. The PRD's budget is ~100 ms
// on a mid-range phone; a 4× CPU slowdown in Chromium stands in for one.
test("GENERATE picks the best of N takes within the phone budget", async ({ page, browserName }, info) => {
  test.skip(browserName !== "chromium", "CPU throttling is a Chromium DevTools feature");
  onlyAtWidths(info, [390]);
  lightOnly(info);
  await gotoAndSettle(page, "/generator/");
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const times: number[] = [];
  for (let i = 0; i < 7; i++) {
    const before = await section(page, "Verse").locator("svg[data-tab]").textContent();
    await page.getByRole("button", { name: "GENERATE", exact: true }).click();
    await expect(section(page, "Verse").locator("svg[data-tab]")).not.toHaveText(before!);
    times.push(await page.evaluate(() => (window as Window & { __palmMuteGenerateMs?: number }).__palmMuteGenerateMs ?? Infinity));
  }
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  const median = [...times].sort((a, b) => a - b)[3];
  console.log(`GENERATE at 4× CPU slowdown: median ${median.toFixed(1)} ms (${times.map((t) => t.toFixed(0)).join(", ")})`);
  expect(median).toBeLessThan(100);
});

test("a section's ↻ changes only that section", async ({ page }, info) => {
  onlyAtWidths(info, [1440]);
  lightOnly(info);
  await gotoAndSettle(page, "/generator/");
  const tab = (label: string) => section(page, label).locator("svg[data-tab]").textContent();
  // The Solo too: it quotes the Intro (R15), but keeps the thread it was written with, so ↻ on the Intro or
  // the Chorus doesn't rewrite it (DECISIONS.md: regenerating one section never changes another).
  const labels = ["Intro", "Verse", "Pre-chorus", "Chorus", "Solo", "Breakdown", "Ending"];
  for (const target of ["Pre-chorus", "Intro", "Chorus"]) {
    const before = Object.fromEntries(await Promise.all(labels.map(async (l) => [l, await tab(l)])));
    await section(page, target).getByRole("button", { name: `Regenerate ${target}` }).click();
    await expect(section(page, target).locator("svg[data-tab]")).not.toHaveText(before[target]!);
    for (const l of labels.filter((l) => l !== target)) expect(await tab(l), `↻ ${target} changed ${l}`).toBe(before[l]);
  }
});
