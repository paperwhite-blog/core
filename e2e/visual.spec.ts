import { test, expect } from '@playwright/test';

const PAGES: [name: string, path: string][] = [
  ['home-en', '/'],
  ['post-en', '/callouts/'],
  ['embeds-en', '/embeds/'],
  ['home-fa', '/fa/'],
  ['post-fa', '/fa/%D8%B3%D9%84%D8%A7%D9%85-%D8%AF%D9%86%DB%8C%D8%A7/'],
  ['mixed-fa', '/fa/%DB%8C%D8%A7%D8%AF%D8%AF%D8%A7%D8%B4%D8%AA-%D8%AA%D8%B1%DA%A9%DB%8C%D8%A8%DB%8C/'],
];

for (const [name, path] of PAGES) {
  test(`snapshot ${name}`, async ({ page }) => {
    await page.goto(path);
    await page.evaluate(() => document.fonts.ready);
    // footer year changes yearly; mask it
    await expect(page).toHaveScreenshot(`${name}.png`, { fullPage: true, mask: [page.locator('.pw-footer')] });
  });
}
