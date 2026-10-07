import { defineConfig, devices } from '@playwright/test';

// Override with E2E_PORT if 4330 is taken by something else.
const port = Number(process.env.E2E_PORT ?? 4330);

/**
 * Visual regression for the default theme: en/LTR and fa/RTL, light and dark.
 * Build first: `pnpm site:build`. Update baselines: `pnpm e2e --update-snapshots`.
 */
export default defineConfig({
  testDir: './e2e',
  // baselines are per platform (font rasterization differs between macOS and Linux CI)
  snapshotPathTemplate: '{testDir}/__screenshots__/{platform}/{projectName}/{arg}{ext}',
  fullyParallel: true,
  reporter: process.env.CI ? 'github' : 'list',
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: 'disabled' } },
  // Locally use the installed Google Chrome; CI installs Playwright's Chromium.
  use: { baseURL: `http://localhost:${port}`, channel: process.env.CI ? undefined : 'chrome' },
  webServer: {
    command: `node e2e/serve.mjs examples/site/dist ${port}`,
    url: `http://localhost:${port}`,
    // Never reuse: an unrelated server on the port would silently be tested instead.
    reuseExistingServer: false,
    timeout: 60_000,
  },
  projects: [
    { name: 'light-desktop', use: { ...devices['Desktop Chrome'], colorScheme: 'light' } },
    { name: 'dark-desktop', use: { ...devices['Desktop Chrome'], colorScheme: 'dark' } },
    { name: 'light-mobile', use: { ...devices['Pixel 7'], colorScheme: 'light' } },
    { name: 'dark-mobile', use: { ...devices['Pixel 7'], colorScheme: 'dark' } },
  ],
});
