import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { auditHtml, auditVault } from '../src/seo/audit.ts';
import { fixtureConfig, fixtureVaultResult } from './helpers.ts';

function site(files: Record<string, string>) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-dist-'));
  for (const [rel, html] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), html);
  }
  return dir;
}
const page = (title: string, body: string, desc = 'd') =>
  `<!doctype html><html><head><title>${title}</title><meta name="description" content="${desc}"></head><body><main>${body}</main></body></html>`;

describe('audit', () => {
  it('flags broken links, duplicate titles, missing alt, heading issues', async () => {
    const dir = site({
      'index.html': page('Home', '<h1>Home</h1><a href="/a/">a</a><a href="/missing/">x</a>'),
      'a/index.html': page('Same', '<h1>A</h1><h3>skip</h3><img src="/x.png">'),
      'b/index.html': page('Same', '<h1>B</h1><h1>B2</h1>'),
    });
    const { issues } = await auditHtml(dir, fixtureConfig());
    const rules = issues.map((i) => i.rule).sort();
    expect(rules).toEqual(['broken-link', 'duplicate-title', 'h1-count', 'heading-order', 'image-alt']);
  });
  it('reports vault-level issues from the fixture', async () => {
    const issues = auditVault(await fixtureVaultResult(), fixtureConfig());
    const errors = issues.filter((i) => i.level === 'error');
    expect(errors.map((e) => e.rule).sort()).toEqual(['broken-wikilink', 'image-alt']);
    expect(issues.some((i) => i.rule === 'title-length')).toBe(true);
  });
});
