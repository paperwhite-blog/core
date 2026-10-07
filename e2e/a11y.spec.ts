import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Runs under every project in playwright.config.ts, so light and dark palettes are both covered.
const PAGES: [name: string, path: string][] = [
  ['callouts-en', '/callouts/'], // every callout hue + footer tag pills
  // inline #tag + RTL tag pills (axe doesn't evaluate the short Persian callout title; callouts-en covers the shared CSS)
  ['post-fa', '/fa/%D8%B3%D9%84%D8%A7%D9%85-%D8%AF%D9%86%DB%8C%D8%A7/'],
];

for (const [name, path] of PAGES) {
  test(`color contrast ${name}`, async ({ page }) => {
    await page.goto(path);
    await page.evaluate(() => document.fonts.ready);
    const { violations, incomplete } = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
    const nodes = (rs: typeof violations) => rs.flatMap((r) => r.nodes.map((n) => `${n.target.join(' ')}: ${n.any[0]?.message}`));
    expect(nodes(violations.filter((v) => v.impact === 'serious' || v.impact === 'critical'))).toEqual([]);
    // "needs review" would let the check above pass vacuously for the elements this spec exists for
    const unresolved = nodes(incomplete).filter((n) => /callout-title|pw-tags|\.tag/.test(n));
    expect(unresolved).toEqual([]);
    await expect(page.locator('.callout-title').first()).toBeVisible();
  });
}
