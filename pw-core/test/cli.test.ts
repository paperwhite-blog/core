import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseWxr, importWxr, htmlToMarkdown, readWxr } from '../src/cli/import/wxr.ts';
import { scaffold } from './helpers.ts';
import { initSite, writeConfig, stripDevFiles, DEV_PATHS } from '../src/cli/commands/init.ts';
import { noteTemplate } from '../src/cli/commands/new.ts';
import { rewriteEjected, copyTheme, setConfigTheme } from '../src/cli/commands/theme.ts';
import { resolveTheme, listThemes } from '../src/theme/resolve.ts';
import { readUserConfig } from '../src/config/load.ts';
import { installFromDir, addPluginToConfig, detectKind } from '../src/cli/commands/add.ts';
import { parseGitHubSource, compareSemver, extractTarGz } from '../src/cli/github.ts';
import { applyUpdate, readLocalVersion } from '../src/cli/commands/update.ts';
import { gzipSync } from 'node:zlib';
import { spawnSync } from 'node:child_process';
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
  it('turns a core clone into a blog: config, no dev files, deploy workflow, samples replaced', () => {
    const dir = tmp();
    scaffold({ dir, theme: 'paper', locales: ['en'] });
    for (const p of ['dev/e2e', 'pw-core/test', '.github/workflows', '.lighthouseci']) fs.mkdirSync(path.join(dir, p), { recursive: true });
    fs.writeFileSync(path.join(dir, 'pw-core/package.json'), '{"name":"@paperwhite/core","version":"0.1.0"}');
    fs.writeFileSync(path.join(dir, 'pw-core/test/x.test.ts'), '');
    fs.writeFileSync(path.join(dir, '.github/workflows/ci.yml'), 'name: CI');
    fs.writeFileSync(path.join(dir, 'CONTRIBUTING.md'), '');
    fs.writeFileSync(path.join(dir, 'paperwhite.slugs.json'), '{}');
    fs.writeFileSync(path.join(dir, 'pnpm-workspace.yaml'), 'packages:\n  - pw-core\n  - dev/*\n');
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'paperwhite', scripts: { dev: 'paperwhite dev', build: 'paperwhite build', test: 'x', e2e: 'y', lhci: 'z' }, dependencies: { astro: '1' }, devDependencies: { vitest: '1' } }));
    const r = initSite(dir, { title: 'Ink & Paper', description: 'Notes.', url: 'https://ink.example/', author: 'Ada', locales: ['en', 'fa'], deploy: 'github-pages', removeSamples: true, freshHistory: true }, { git: false, install: false });
    const user = readUserConfig(dir);
    expect(user.site).toMatchObject({ title: 'Ink & Paper', url: 'https://ink.example', description: 'Notes.', author: 'Ada' });
    expect(user.locales).toEqual({ default: 'en', supported: { en: {}, fa: {} } });
    expect(user.theme).toBe('paper');
    expect(fs.readFileSync(path.join(dir, 'paperwhite.config.yaml'), 'utf8')).toContain('# A folder under themes/'); // comments kept
    for (const p of DEV_PATHS) expect(fs.existsSync(path.join(dir, p))).toBe(false);
    expect(fs.existsSync(path.join(dir, 'pw-core/package.json'))).toBe(true);
    const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
    expect(Object.keys(pkg.scripts)).toEqual(['dev', 'build']);
    expect(pkg.devDependencies).toBeUndefined();
    expect(pkg.dependencies).toEqual({ astro: '1' });
    expect(fs.readFileSync(path.join(dir, 'pnpm-workspace.yaml'), 'utf8')).not.toContain('dev/*');
    expect(r.samples).toEqual(['content/posts/hello-world.md', 'content/pages/about.md', 'content/posts/fa/سلام.md']);
    expect(fs.existsSync(path.join(dir, 'paperwhite.slugs.json'))).toBe(false);
    expect(fs.readFileSync(path.join(dir, '.github/workflows/deploy.yml'), 'utf8')).toContain('actions/deploy-pages');
    expect(fs.readFileSync(path.join(dir, 'README.md'), 'utf8')).toContain('# Ink & Paper');
  });
  it('keeps samples and writes a rebuild-hook workflow for hosts that build themselves', () => {
    const dir = tmp();
    scaffold({ dir });
    fs.mkdirSync(path.join(dir, 'pw-core'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'pw-core/package.json'), '{"name":"@paperwhite/core","version":"0.1.0"}');
    const r = initSite(dir, { title: 'T', description: 'D', url: 'https://t.example', locales: ['en'], deploy: 'netlify', removeSamples: false, freshHistory: false }, { git: false, install: false });
    expect(r.samples).toEqual([]);
    expect(fs.existsSync(path.join(dir, 'content/posts/hello-world.md'))).toBe(true);
    expect(fs.readFileSync(path.join(dir, '.github/workflows/deploy.yml'), 'utf8')).toContain('DEPLOY_HOOK_URL');
    expect(stripDevFiles(dir)).toEqual([]);
    expect(writeConfig(dir, { title: 'T2', description: 'D', url: 'https://t.example', locales: ['fa'], deploy: 'none', removeSamples: false, freshHistory: false })).toMatch(/paperwhite\.config\.yaml$/);
    expect(readUserConfig(dir).locales!.default).toBe('fa');
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
    const yaml = fs.readFileSync(path.join(dir, 'paperwhite.config.yaml'), 'utf8');
    expect(yaml).toMatch(/^theme: ink$/m);
    expect(yaml).toContain('# A folder under themes/'); // comments survive the edit
    expect(readUserConfig(dir).theme).toBe('ink');
  });
  it('keeps the name when copying a theme under its own name', () => {
    const dir = tmp();
    copyTheme(dir, 'paper', 'paper');
    expect(JSON.parse(fs.readFileSync(path.join(dir, 'themes/paper/theme.json'), 'utf8')).name).toBe('paper');
    expect(resolveTheme('paper', dir).source).toBe('site');
  });
});

describe('add', () => {
  const sitedir = () => {
    const dir = tmp();
    scaffold({ dir, theme: 'paper', locales: ['en'] });
    return dir;
  };
  it('parses GitHub sources', () => {
    expect(parseGitHubSource('acme/theme-ink')).toEqual({ owner: 'acme', repo: 'theme-ink', ref: undefined });
    expect(parseGitHubSource('acme/theme-ink#v1.2.0')).toEqual({ owner: 'acme', repo: 'theme-ink', ref: 'v1.2.0' });
    expect(parseGitHubSource('https://github.com/acme/theme-ink')).toEqual({ owner: 'acme', repo: 'theme-ink', ref: undefined });
    expect(parseGitHubSource('https://github.com/acme/theme-ink/tree/main')).toEqual({ owner: 'acme', repo: 'theme-ink', ref: 'main' });
    expect(parseGitHubSource('./themes/x')).toBeUndefined();
    expect(parseGitHubSource('/abs/path')).toBeUndefined();
  });
  it('orders versions', () => {
    expect(['v0.2.0', 'v0.10.0', 'v0.2.1', 'v1.0.0-beta.1', 'v1.0.0'].sort(compareSemver)).toEqual(['v0.2.0', 'v0.2.1', 'v0.10.0', 'v1.0.0-beta.1', 'v1.0.0']);
  });
  it('installs a theme folder and selects it', () => {
    const dir = sitedir();
    const src = path.join(tmp(), 'theme-ink');
    fs.mkdirSync(path.join(src, 'styles'), { recursive: true });
    fs.writeFileSync(path.join(src, 'theme.json'), JSON.stringify({ name: 'ink', themeApi: 1, rtl: 'tokens-only' }));
    fs.writeFileSync(path.join(src, 'styles/theme.css'), ':root{--pw-accent:#000}');
    fs.mkdirSync(path.join(src, '.git')); // must not be copied
    const r = installFromDir(dir, src);
    expect(r.manifest).toMatchObject({ name: 'ink', kind: 'theme' });
    expect(fs.existsSync(path.join(dir, 'themes/ink/styles/theme.css'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'themes/ink/.git'))).toBe(false);
    expect(readUserConfig(dir).theme).toBe('ink');
    expect(resolveTheme('ink', dir).source).toBe('site');
    expect(() => installFromDir(dir, src)).toThrow(/already exists/);
    const renamed = installFromDir(dir, src, { name: 'ink2' });
    expect(JSON.parse(fs.readFileSync(path.join(renamed.dest, 'theme.json'), 'utf8')).name).toBe('ink2');
  });
  it('installs a plugin folder, enables it, and the config loads it', () => {
    const dir = sitedir();
    const src = path.join(tmp(), 'plugin-shout');
    fs.mkdirSync(src, { recursive: true });
    fs.writeFileSync(path.join(src, 'plugin.json'), JSON.stringify({ name: 'shout', pluginApi: 1 }));
    fs.writeFileSync(path.join(src, 'index.ts'), "export default () => ({ name: 'shout' });");
    const r = installFromDir(dir, src);
    expect(r.manifest.kind).toBe('plugin');
    const yaml = fs.readFileSync(path.join(dir, 'paperwhite.config.yaml'), 'utf8');
    expect(yaml).toMatch(/plugins:\n\s+- shout/);
    expect(readUserConfig(dir).plugins!.map((p) => p.name)).toEqual(['shout']);
    addPluginToConfig(dir, 'shout'); // idempotent
    expect((fs.readFileSync(path.join(dir, 'paperwhite.config.yaml'), 'utf8').match(/- shout/g) ?? []).length).toBe(1);
    fs.writeFileSync(path.join(src, 'plugin.json'), JSON.stringify({ name: 'shout', pluginApi: 7 }));
    expect(() => detectKind(src)).toThrow(/pluginApi must be 1/);
    expect(() => detectKind(tmp())).toThrow(/not a PaperWhite theme or plugin/);
  });
  it('extracts a GitHub-style tarball (top-level folder stripped)', () => {
    if (spawnSync('tar', ['--version']).status !== 0) return;
    const work = tmp();
    fs.mkdirSync(path.join(work, 'repo-abc123/styles'), { recursive: true });
    fs.writeFileSync(path.join(work, 'repo-abc123/theme.json'), '{"name":"x","themeApi":1,"rtl":"full"}');
    fs.writeFileSync(path.join(work, 'repo-abc123/styles/theme.css'), '');
    const tar = spawnSync('tar', ['-cf', '-', '-C', work, 'repo-abc123']).stdout;
    const dest = tmp();
    extractTarGz(gzipSync(tar), dest);
    expect(fs.existsSync(path.join(dest, 'theme.json'))).toBe(true);
    expect(detectKind(dest).kind).toBe('theme');
  });
});

describe('update', () => {
  const core = (dir: string, version: string, withTests: boolean) => {
    fs.mkdirSync(path.join(dir, 'pw-core/src'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'pw-core/package.json'), JSON.stringify({ name: '@paperwhite/core', version }));
    fs.writeFileSync(path.join(dir, 'pw-core/src/index.ts'), `export const v = '${version}';`);
    if (withTests) {
      fs.mkdirSync(path.join(dir, 'pw-core/test'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'pw-core/test/x.test.ts'), '');
    }
    fs.mkdirSync(path.join(dir, 'pw-docs'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'pw-docs/changelog.md'), `# ${version}`);
  };
  it('replaces pw-core and pw-docs, keeps node_modules and the user\'s files, respects a slimmed site', () => {
    const site = tmp();
    core(site, '0.1.0', false);
    fs.mkdirSync(path.join(site, 'pw-core/node_modules/dep'), { recursive: true });
    fs.writeFileSync(path.join(site, 'pw-core/src/old.ts'), '');
    fs.mkdirSync(path.join(site, 'content/posts'), { recursive: true });
    fs.writeFileSync(path.join(site, 'content/posts/a.md'), 'mine');
    fs.writeFileSync(path.join(site, 'paperwhite.config.yaml'), 'site: {url: https://x.y, title: X}');
    const src = tmp();
    core(src, '0.2.0', true);
    const r = applyUpdate(site, src);
    expect(r).toMatchObject({ from: '0.1.0', to: '0.2.0', replaced: ['pw-core', 'pw-docs'], skippedTests: true });
    expect(readLocalVersion(site)).toBe('0.2.0');
    expect(fs.readFileSync(path.join(site, 'pw-core/src/index.ts'), 'utf8')).toContain('0.2.0');
    expect(fs.existsSync(path.join(site, 'pw-core/src/old.ts'))).toBe(false);
    expect(fs.existsSync(path.join(site, 'pw-core/node_modules/dep'))).toBe(true);
    expect(fs.existsSync(path.join(site, 'pw-core/test'))).toBe(false);
    expect(fs.readFileSync(path.join(site, 'pw-docs/changelog.md'), 'utf8')).toBe('# 0.2.0');
    expect(fs.readFileSync(path.join(site, 'content/posts/a.md'), 'utf8')).toBe('mine');
    expect(fs.readFileSync(path.join(site, 'paperwhite.config.yaml'), 'utf8')).toContain('title: X');
  });
  it('copies tests when the site still has them, and rejects a non-core source', () => {
    const site = tmp();
    core(site, '0.1.0', true);
    const src = tmp();
    core(src, '0.3.0', true);
    expect(applyUpdate(site, src).skippedTests).toBe(false);
    expect(fs.existsSync(path.join(site, 'pw-core/test/x.test.ts'))).toBe(true);
    expect(() => applyUpdate(site, tmp())).toThrow(/not a PaperWhite core checkout/);
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
