import { test, expect } from '@playwright/test';

test.describe('i18n and RTL', () => {
  test('Persian pages are rtl with Jalali dates', async ({ page }) => {
    await page.goto('/fa/%D8%B3%D9%84%D8%A7%D9%85-%D8%AF%D9%86%DB%8C%D8%A7/');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'fa');
    await expect(page.locator('.pw-meta time')).toHaveText('۱۴ مهر ۱۴۰۳');
    await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute('href', 'https://paperwhite.example/hello-world/');
  });
  test('code stays LTR inside RTL pages', async ({ page }) => {
    await page.goto('/fa/%DB%8C%D8%A7%D8%AF%D8%AF%D8%A7%D8%B4%D8%AA-%D8%AA%D8%B1%DA%A9%DB%8C%D8%A8%DB%8C/');
    expect(await page.locator('pre').first().evaluate((el) => getComputedStyle(el).direction)).toBe('ltr');
  });
});

test.describe('islands', () => {
  test('theme toggle persists', async ({ page }) => {
    await page.goto('/');
    const before = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    await page.getByRole('button', { name: 'Toggle dark mode' }).click();
    const after = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(after).not.toBe(before);
    await page.reload();
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(after);
  });
  test('search finds posts in both locales', async ({ page }) => {
    await page.goto('/search/?q=callout');
    await expect(page.locator('.pw-search-results li').first()).toBeVisible();
    await page.goto('/fa/search/?q=%D9%8A%D8%A7%D8%AF%D8%AF%D8%A7%D8%B4%D8%AA'); // Arabic ي must match Persian ی
    await expect(page.locator('.pw-search-results li').first()).toBeVisible();
  });
  test('lightbox opens images in a dialog', async ({ page }) => {
    await page.goto('/embeds/');
    await page.locator('a[data-pw-lightbox]').first().click();
    await expect(page.locator('dialog.pw-lightbox')).toHaveAttribute('open', '');
    await page.keyboard.press('Escape');
    await expect(page.locator('dialog.pw-lightbox')).not.toHaveAttribute('open', '');
  });
  test('foldable callouts work without JavaScript', async ({ browser }) => {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto('/callouts/');
    const closed = page.locator('details.callout').first();
    await expect(closed).not.toHaveAttribute('open', '');
    await closed.locator('summary').click();
    await expect(closed).toHaveAttribute('open', '');
    await ctx.close();
  });
});

test.describe('seo', () => {
  test('post pages carry structured data and social cards', async ({ page }) => {
    await page.goto('/callouts/');
    const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
    const types = ld.map((s) => JSON.parse(s)['@type']);
    expect(types).toEqual(expect.arrayContaining(['BlogPosting', 'BreadcrumbList', 'FAQPage']));
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /\/og\/posts\/obsidian-syntax\/callouts\.png$/);
  });
  test('legacy URLs redirect', async ({ page }) => {
    await page.goto('/2019/05/old-slug/');
    await page.waitForURL('**/old-wordpress-post/');
    await expect(page.locator('h1')).toHaveText('Migrated from WordPress');
  });
});
