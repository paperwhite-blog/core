import { defineConfig, devices } from '@playwright/test';

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
  use: { baseURL: 'http://localhost:4330', channel: process.env.CI ? undefined : 'chrome' },
  webServer: {
    command: 'node e2e/serve.mjs examples/site/dist 4330',
    url: 'http://localhost:4330',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  projects: [
    { name: 'light-desktop', use: { ...devices['Desktop Chrome'], colorScheme: 'light' } },
    { name: 'dark-desktop', use: { ...devices['Desktop Chrome'], colorScheme: 'dark' } },
    { name: 'light-mobile', use: { ...devices['Pixel 7'], colorScheme: 'light' } },
    { name: 'dark-mobile', use: { ...devices['Pixel 7'], colorScheme: 'dark' } },
  ],
});
