import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { inlineStylesheet } from '../src/integration.ts';
import { resolveTheme, listThemes, cascade, coreDir } from '../src/theme/resolve.ts';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'pw-theme-'));

describe('theme resolution', () => {
  it('ships paper as a built-in theme', () => {
    const site = tmp();
    const t = resolveTheme('paper', site);
    expect(t.source).toBe('core');
    expect(t.dir).toBe(path.join(coreDir, 'themes/paper'));
    expect(t.manifest).toMatchObject({ name: 'paper', themeApi: 1, rtl: 'full' });
    expect(fs.existsSync(path.join(t.dir, 'styles/theme.css'))).toBe(true);
    expect(listThemes(site)).toEqual([{ name: 'paper', dir: t.dir, source: 'core' }]);
  });
  it('lets a site folder shadow a built-in and cascades slots through it', () => {
    const site = tmp();
    fs.mkdirSync(path.join(site, 'themes/paper/components'), { recursive: true });
    fs.writeFileSync(path.join(site, 'themes/paper/theme.json'), JSON.stringify({ name: 'paper', themeApi: 1, rtl: 'tokens-only' }));
    fs.writeFileSync(path.join(site, 'themes/paper/components/Footer.astro'), '');
    const t = resolveTheme('paper', site);
    expect(t.source).toBe('site');
    const dirs = { site, theme: t.dir, core: coreDir };
    expect(cascade('@pw/components/Footer', dirs)).toBe(path.join(t.dir, 'components/Footer.astro'));
    expect(cascade('@pw/core/components/Footer', dirs)).toBe(path.join(coreDir, 'components/Footer.astro'));
    expect(cascade('@pw/components/Header', dirs)).toBe(path.join(coreDir, 'components/Header.astro'));
    fs.mkdirSync(path.join(site, 'src/overrides/components'), { recursive: true });
    fs.writeFileSync(path.join(site, 'src/overrides/components/Footer.astro'), '');
    expect(cascade('@pw/components/Footer', dirs)).toBe(path.join(site, 'src/overrides/components/Footer.astro'));
    expect(cascade('@pw/theme/components/Footer', dirs)).toBe(path.join(t.dir, 'components/Footer.astro'));
  });
});

describe('inlineStylesheet', () => {
  it('rewrites bare imports via the resolver and relative references against the file', () => {
    const dir = tmp();
    const file = path.join(dir, 'styles/theme.css');
    fs.mkdirSync(path.dirname(file));
    fs.writeFileSync(
      file,
      [
        "@import '@fontsource-variable/inter/wght.css';",
        '@import url("./local.css");',
        '@import "https://example.com/x.css";',
        "@font-face { src: url(../fonts/a.woff2) format('woff2'), url('data:font/woff2;base64,AAAA'); }",
        '.x { background: url("/public.png"); mask: url(#frag); }',
        '@import "unknown-package/x.css";',
      ].join('\n'),
    );
    const out = inlineStylesheet(file, (id) => (id.startsWith('@fontsource-variable/') ? `/pkgs/${id}` : undefined));
    expect(out).toBe(
      [
        "@import '/pkgs/@fontsource-variable/inter/wght.css';",
        `@import "${path.join(dir, 'styles/local.css')}";`,
        '@import "https://example.com/x.css";',
        `@font-face { src: url(${path.join(dir, 'fonts/a.woff2')}) format('woff2'), url('data:font/woff2;base64,AAAA'); }`,
        '.x { background: url("/public.png"); mask: url(#frag); }',
        '@import "unknown-package/x.css";',
      ].join('\n'),
    );
  });
  it("resolves the built-in theme's font imports from core", () => {
    const out = inlineStylesheet(path.join(coreDir, 'themes/paper/styles/theme.css'));
    expect(out).not.toContain("@import '@fontsource-variable");
    expect(out).toMatch(/@import '.*@fontsource-variable\/inter.*\/wght\.css'/);
  });
});
