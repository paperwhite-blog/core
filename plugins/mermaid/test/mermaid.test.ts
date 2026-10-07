import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveConfig } from '@paperwhite/core/config';
import { buildVault } from '@paperwhite/core/vault';
import mermaid from '../src/index.ts';

// Needs a browser. Locally we use the installed Google Chrome; set PW_MERMAID_CHANNEL='' for bundled Chromium.
const chromeInstalled = fs.existsSync('/Applications/Google Chrome.app') || fs.existsSync('/usr/bin/google-chrome');
const channel = process.env.PW_MERMAID_CHANNEL ?? (chromeInstalled ? 'chrome' : undefined);
const run = chromeInstalled || process.env.PW_MERMAID === '1' ? it : it.skip;

describe('mermaid', () => {
  run('renders fences to cached static SVG', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-mm-'));
    fs.mkdirSync(path.join(dir, 'posts'));
    fs.writeFileSync(path.join(dir, 'posts/a.md'), '---\ndate: 2024-01-01\n---\n```mermaid\ngraph TD; A-->B;\n```\n');
    const cacheDir = path.join(dir, '.c/mermaid');
    const plugin = mermaid({ cacheDir, launchOptions: channel ? { channel } : {} });
    const config = resolveConfig({ site: { url: 'https://x.test', title: 'x' }, contentDir: dir, plugins: [plugin] }, dir);
    const r = await buildVault(config, { cacheDir: path.join(dir, '.c') });
    const html = r.notes[0]!.html;
    expect(html).toMatch(/<figure class="pw-mermaid" dir="ltr"><svg/);
    expect(html).not.toContain('shiki');
    expect(fs.readdirSync(cacheDir)).toHaveLength(1);
  }, 120_000);
});
