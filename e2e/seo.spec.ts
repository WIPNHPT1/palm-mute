import { ROUTES, expect, lightOnly, onlyAtWidths, test } from "./fixtures";

const SITE = "https://palmmute.ai";
/** Share and canonical URLs point at the live site; check the same path on the test server. */
const local = (url: string) => url.replace(SITE, "").replace(/\?.*$/, "");

test.describe("SEO, share cards and icons", () => {
  test.beforeEach(async ({}, info) => {
    onlyAtWidths(info, [1440]);
    lightOnly(info);
  });

  for (const route of ROUTES) {
    test(`${route.path} has a description, canonical URL and share cards`, async ({ page, request }) => {
      await page.goto(route.path);
      const meta = (sel: string) => page.locator(sel).getAttribute("content");
      const description = await meta('meta[name="description"]');
      expect(description!.length).toBeGreaterThan(80);
      expect(description!.length).toBeLessThanOrEqual(200);
      expect(await page.locator('link[rel="canonical"]').getAttribute("href")).toBe(`${SITE}${route.path}`);
      expect(await meta('meta[property="og:site_name"]')).toBe("Palm/Mute");
      expect(await meta('meta[property="og:type"]')).toBe("website");
      expect(await meta('meta[property="og:url"]')).toBe(`${SITE}${route.path}`);
      expect(await meta('meta[property="og:title"]')).toContain("Palm/Mute");
      expect(await meta('meta[property="og:description"]')).toBe(description);
      expect(await meta('meta[name="twitter:card"]')).toBe("summary_large_image");
      for (const sel of ['meta[property="og:image"]', 'meta[name="twitter:image"]']) {
        const url = (await meta(sel))!;
        expect(url.startsWith(`${SITE}/`)).toBe(true);
        const res = await request.get(local(url));
        expect(res.status(), url).toBe(200);
        expect(res.headers()["content-type"]).toContain("image/png");
      }
      expect(await meta('meta[property="og:image:width"]')).toBe("1200");
      expect(await meta('meta[property="og:image:height"]')).toBe("630");
      expect(await page.locator('meta[name="theme-color"]').count()).toBe(2);
      // Structured data: a web app.
      const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!);
      expect(ld["@type"]).toBe("WebApplication");
      expect(ld.url).toBe(SITE);
    });
  }

  test("favicons, the app icon and the manifest resolve", async ({ page, request }) => {
    await page.goto("/");
    const hrefs = await page.locator('link[rel="icon"], link[rel="apple-touch-icon"], link[rel="manifest"]').evaluateAll((ls) =>
      ls.map((l) => ({ rel: l.getAttribute("rel"), href: l.getAttribute("href")!, type: l.getAttribute("type") })),
    );
    expect(hrefs.map((h) => h.rel).sort()).toEqual(["apple-touch-icon", "icon", "icon", "manifest"]);
    for (const h of hrefs) expect((await request.get(local(h.href))).status(), h.href).toBe(200);
    expect(hrefs.find((h) => h.type === "image/svg+xml")).toBeTruthy();
    const manifest = await (await request.get("/manifest.webmanifest")).json();
    expect(manifest.short_name).toBe("Palm/Mute");
    expect(manifest.start_url).toBe("/");
    expect(manifest.icons.map((i: { purpose: string }) => i.purpose).sort()).toEqual(["any", "any", "maskable"]);
    for (const icon of manifest.icons) {
      const res = await request.get(icon.src);
      expect(res.status(), icon.src).toBe(200);
      const size = await page.evaluate(async (src) => {
        const img = new Image();
        img.src = src;
        await img.decode();
        return `${img.naturalWidth}x${img.naturalHeight}`;
      }, icon.src);
      expect(size).toBe(icon.sizes);
    }
  });

  test("robots.txt and the sitemap list the pages; /about/ stays out of search", async ({ page, request }) => {
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toContain(`Sitemap: ${SITE}/sitemap.xml`);
    expect(robots).not.toMatch(/Disallow: \/\s*$/m);
    const sitemap = await (await request.get("/sitemap.xml")).text();
    for (const r of ROUTES) expect(sitemap).toContain(`<loc>${SITE}${r.path}</loc>`);
    expect(sitemap).not.toContain("/about");
    await page.goto("/about/");
    // The fallback page redirects to / on the client; its HTML must still say noindex.
    const html = await (await request.get("/about/")).text();
    expect(html).toMatch(/<meta name="robots" content="noindex, follow"/);
  });
});
