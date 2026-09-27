import { defineConfig, devices } from "@playwright/test";

// Browser tests for the static export (`out/`). Every spec runs in Chromium and WebKit, at five
// widths, in light and dark (the OS colour scheme, which the site follows by default).
// Specs that only make sense at some widths skip the others (see e2e/fixtures.ts).
const PORT = 4321;
const WIDTHS = [320, 390, 834, 1440, 1920] as const;
const BROWSERS = [
  { name: "chromium", device: devices["Desktop Chrome"] },
  { name: "webkit", device: devices["Desktop Safari"] },
] as const;
const THEMES = ["light", "dark"] as const;

// E2E_SKIP_BUILD=1 when `out/` is already fresh (CI builds in an earlier step).
const serve = `node scripts/serve-static.mjs out`;

export default defineConfig({
  testDir: "e2e",
  // macOS writes ._* metadata files next to everything on external drives; never load them as specs.
  testIgnore: /(^|[\\/])\._/,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  timeout: 60_000,
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: BROWSERS.flatMap(({ name, device }) =>
    WIDTHS.flatMap((width) =>
      THEMES.map((theme) => ({
        name: `${name}-${width}-${theme}`,
        use: {
          ...device,
          viewport: { width, height: width < 834 ? 800 : 900 },
          colorScheme: theme,
        },
      })),
    ),
  ),
  webServer: {
    command: process.env.E2E_SKIP_BUILD ? serve : `npm run build && ${serve}`,
    url: `http://localhost:${PORT}/`,
    env: { PORT: String(PORT) },
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
