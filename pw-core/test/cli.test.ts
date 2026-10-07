import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseWxr, importWxr, htmlToMarkdown, readWxr } from '../src/cli/import/wxr.ts';
import { scaffold } from '../src/cli/commands/init.ts';
import { noteTemplate } from '../src/cli/commands/new.ts';
import { rewriteEjected, copyTheme, setConfigTheme } from '../src/cli/commands/theme.ts';
import { resolveTheme, listThemes } from '../src/theme/resolve.ts';
import { extractExternalLinks, checkExternalLinks } from '../src/cli/external.ts';
import { resolveConfig } from '../src/config.ts';
import { buildVault } from '../src/content/vault.ts';

const testDir = fileURLToPath(new URL('.', import.meta.url));
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'pw-cli-'));

describe('wordpress import', () => {
  it('converts posts, pages, comments and redirects', async () => {
    const site = parseWxr(await readWxr(path.join(testDir, 'fixtures/wordpress/export.xml')));
    expect(site.items).toHaveLength(5);
    const out = tmp();
    const fakeFetch = (async () => new Response(new Uint8Array([0xff, 0xd8, 0xff]))) as unknown as typeof fetch;
    const r = await importWxr(site, { outDir: out, download: true, fetchImpl: fakeFetch });
    expect(r).toMatchObject({ posts: 2, pages: 1, comments: 2, attachments: 1, skipped: 1 });
    const md = fs.readFileSync(path.join(out, 'posts/hello-from-wordpress.md'), 'utf8');
    expect(md).toContain('title: "Hello from WordPress"');
    expect(md).toContain('date: 2019-05-20T10:00:00Z');
    expect(md).toContain('updated: 2020-01-02T09:00:00Z');
    expect(md).toContain('tags: [intro]');
    expect(md).toContain('categories: [News]');
    expect(md).toContain('cover: "[[photo.jpg]]"');
    expect(md).toContain('  - "/?p=123"');
    expect(md).toContain('  - "/2019/05/hello-from-wordpress/"');
    expect(md).toContain('This is **bold** and [a link](https://example.org).');
    expect(md).toContain('![[photo.jpg|A photo]]');
    expect(md).toContain('```js\nconsole.log(\'hi\');\n```');
    expect(md).not.toContain('wp:paragraph');
    const comments = JSON.parse(fs.readFileSync(path.join(out, 'comments/hello-from-wordpress.json'), 'utf8'));
    expect(comments).toHaveLength(2);
    expect(comments[1].parent).toBe(1);
    expect(fs.existsSync(path.join(out, 'posts/یادداشت.md'))).toBe(true);
  });
  it('imported vault builds with comments attached and redirects', async () => {
    const out = tmp();
    await importWxr(parseWxr(await readWxr(path.join(testDir, 'fixtures/wordpress/export.xml'))), { outDir: out });
    const config = resolveConfig({ site: { url: 'https://new.example', title: 'New' }, contentDir: out }, out);
    const r = await buildVault(config, { cacheDir: path.join(out, '.cache') });
    const post = r.notes.find((n) => n.data.slug === 'hello-from-wordpress')!;
    expect(post.data.comments).toHaveLength(2);
    expect(post.data.redirectFrom).toEqual(['/?p=123', '/2019/05/hello-from-wordpress/']);
    expect(r.notes.find((n) => n.data.slug === 'یادداشت')!.data.url).toBe('/یادداشت/');
  });
  it('turns WordPress autop text into paragraphs', () => {
    expect(htmlToMarkdown('line one\nline two\n\nsecond para')).toBe('line one  \nline two\n\nsecond para');
  });
});

describe('init / new / eject', () => {
  it('scaffolds a buildable site layout', () => {
    const dir = tmp();
    const files = scaffold({ dir, theme: 'paper', locales: ['en', 'fa'] });
    expect(files).toEqual(expect.arrayContaining(['package.json', 'paperwhite.config.ts', 'astro.config.ts', 'src/content.config.ts', 'content/posts/hello-world.md', 'content/posts/fa/سلام.md']));
    expect(fs.readFileSync(path.join(dir, 'paperwhite.config.ts'), 'utf8')).toContain("supported: { en: {}, fa: {} }");
    expect(fs.readFileSync(path.join(dir, 'paperwhite.config.ts'), 'utf8')).toContain("theme: 'paper'");
    expect(JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')).dependencies).not.toHaveProperty('paperwhite-theme-paper');
    expect(files).toContain('themes/README.md');
    expect(resolveTheme('paper', dir).source).toBe('core');
  });
  it('writes note frontmatter', () => {
    const t = noteTemplate({ title: 'سلام', lang: 'fa', date: new Date('2024-01-02'), defaultLang: 'en' });
    expect(t).toBe('---\ntitle: "سلام"\ndate: 2024-01-02\ndescription: ""\ntags: []\nlang: fa\ndraft: true\n---\n\n');
  });
  it('rewrites core-relative imports when ejecting', () => {
    const src = `import { useLocale } from '../src/runtime/index.ts';\nimport '../islands/toc.ts';\nimport Seo from '../components/Seo.astro';`;
    expect(rewriteEjected(src, 'core')).toBe(`import { useLocale } from '@paperwhite/core/runtime';\nimport '@paperwhite/core/islands/toc.ts';\nimport Seo from '@paperwhite/core/components/Seo.astro';`);
  });
});

describe('themes', () => {
  it('resolves site folders before built-ins and lists both', () => {
    const dir = tmp();
    expect(resolveTheme('paper', dir).source).toBe('core');
    fs.mkdirSync(path.join(dir, 'themes/paper/styles'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'themes/paper/theme.json'), JSON.stringify({ name: 'paper', themeApi: 1, rtl: 'full' }));
    const r = resolveTheme('paper', dir);
    expect(r.source).toBe('site');
    expect(r.dir).toBe(path.join(dir, 'themes/paper'));
    expect(listThemes(dir)).toEqual([{ name: 'paper', dir: path.join(dir, 'themes/paper'), source: 'site' }]);
    expect(resolveTheme('./themes/paper', dir).source).toBe('path');
    expect(() => resolveTheme('nope', dir)).toThrow(/themes\/nope\/.*paper \(site\)/);
    expect(() => resolveTheme('nope', tmp())).toThrow(/paper \(core\)/);
  });
  it('rejects themes with another themeApi', () => {
    const dir = tmp();
    fs.mkdirSync(path.join(dir, 'themes/old'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'themes/old/theme.json'), JSON.stringify({ name: 'old', themeApi: 2, rtl: 'full' }));
    expect(() => resolveTheme('old', dir)).toThrow(/themeApi 2/);
  });
  it('copies a built-in theme into themes/<name> and selects it', () => {
    const dir = tmp();
    scaffold({ dir, theme: 'paper', locales: ['en'] });
    const dest = copyTheme(dir, 'ink', 'paper');
    expect(dest).toBe(path.join(dir, 'themes/ink'));
    for (const f of ['theme.json', 'styles/theme.css', 'components/PostCard.astro']) expect(fs.existsSync(path.join(dest, f))).toBe(true);
    const manifest = JSON.parse(fs.readFileSync(path.join(dest, 'theme.json'), 'utf8'));
    expect(manifest).toMatchObject({ name: 'ink', themeApi: 1, version: '0.1.0' });
    expect(manifest.tokens).toEqual(resolveTheme('paper', tmp()).manifest.tokens);
    expect(resolveTheme('ink', dir).source).toBe('site');
    expect(() => copyTheme(dir, 'ink', 'paper')).toThrow(/exists/);
    expect(() => copyTheme(dir, 'Bad Name', 'paper')).toThrow(/lowercase/);
    setConfigTheme(dir, 'ink');
    expect(fs.readFileSync(path.join(dir, 'paperwhite.config.ts'), 'utf8')).toContain("theme: 'ink'");
    expect(fs.readFileSync(path.join(dir, 'paperwhite.config.ts'), 'utf8')).not.toContain("theme: 'paper'");
  });
  it('keeps the name when copying a theme under its own name', () => {
    const dir = tmp();
    copyTheme(dir, 'paper', 'paper');
    expect(JSON.parse(fs.readFileSync(path.join(dir, 'themes/paper/theme.json'), 'utf8')).name).toBe('paper');
    expect(resolveTheme('paper', dir).source).toBe('site');
  });
});

describe('external links', () => {
  it('extracts links and caches results', async () => {
    expect(extractExternalLinks('<a href="https://a.test/x?y=1&amp;z=2">a</a><a href="/local">b</a>')).toEqual(['https://a.test/x?y=1&z=2']);
    const dir = tmp();
    const realFetch = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = (async (url: string) => {
      calls++;
      return new Response(null, { status: String(url).includes('dead') ? 404 : 200 });
    }) as typeof fetch;
    try {
      const links = new Map([['https://ok.test/', ['a.md']], ['https://dead.test/', ['b.md']]]);
      const r1 = await checkExternalLinks(links, dir);
      expect(r1.map((r) => [r.url, r.ok])).toEqual([['https://dead.test/', false], ['https://ok.test/', true]]);
      await checkExternalLinks(links, dir);
      expect(calls).toBe(2);
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});
