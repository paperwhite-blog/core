import { describe, it, expect } from 'vitest';
import { fixtureVaultResult, noteHtml, tempVault } from './helpers.ts';

describe('wikilinks', () => {
  it('resolves filename, alias, heading, block, path and markdown links', async () => {
    const html = await noteHtml('posts/obsidian-syntax/wikilinks');
    expect(html).toContain('href="/hello-world/" class="internal"');
    expect(html).toContain('>the first post</a>');
    expect(html).toContain('href="/hello-world/#why-paperwhite"');
    expect(html).toContain('href="/hello-world/#%5Ewhy-block"');
    expect(html).toContain('href="#basic"');
    expect(html).toContain('href="/callouts/"');
    expect(html).toContain('>the callouts note</a>');
  });
  it('renders unresolved links as span.unresolved and reports them', async () => {
    const html = await noteHtml('posts/obsidian-syntax/wikilinks');
    expect(html).toMatch(/<span class="unresolved"[^>]*>This Note Does Not Exist<\/span>/);
    const r = await fixtureVaultResult();
    expect(r.unresolved).toEqual([{ source: 'posts/obsidian-syntax/wikilinks.md', target: 'This Note Does Not Exist' }]);
  });
  it('links to drafts render as plain text, not as errors', async () => {
    const html = await noteHtml('posts/obsidian-syntax/wikilinks');
    expect(html).toContain('<span class="unresolved unpublished">Draft post</span>');
  });
  it('uses shortest-path resolution for duplicate basenames', async () => {
    const { result } = await tempVault({
      'posts/a/note.md': '---\ndate: 2024-01-01\ntitle: A note\n---\nA',
      'posts/b/note.md': '---\ndate: 2024-01-01\ntitle: B note\nslug: b-note\n---\nB',
      'posts/b/source.md': '---\ndate: 2024-01-01\n---\nSee [[note]].',
    });
    const src = result.notes.find((n) => n.id === 'posts/b/source')!;
    expect(src.html).toContain('href="/b-note/"');
  });
  it('handles pipes escaped inside tables', async () => {
    expect(await noteHtml('posts/obsidian-syntax/wikilinks')).toContain('>aliased in a table</a></td>');
  });
});

describe('embeds', () => {
  it('optimizes images with width hints and inlined dimensions', async () => {
    const html = await noteHtml('posts/obsidian-syntax/embeds');
    expect(html).toMatch(/<picture><source type="image\/avif"/);
    expect(html).toMatch(/alt="Architecture diagram" width="400" height="233"/);
    expect(html).toContain('alt="A ginger cat on books"');
  });
  it('embeds pdf, audio and video natively', async () => {
    const html = await noteHtml('posts/obsidian-syntax/embeds');
    expect(html).toMatch(/<object data="\/_pw\/files\/[0-9a-f]+\/sample\.pdf" type="application\/pdf"/);
    expect(html).toMatch(/<audio class="pw-audio" controls preload="none"/);
    expect(html).toMatch(/<video class="pw-video" controls/);
  });
  it('transcludes full notes, sections and blocks', async () => {
    const html = await noteHtml('posts/obsidian-syntax/embeds');
    expect(html).toContain('<strong>transcluded</strong>');
    expect(html).toContain('Hello, World › What\'s next');
    expect(html).toContain('<p id="^why-block" dir="auto">Because a folder of Markdown should be enough.</p>');
  });
  it('guards recursion', async () => {
    const html = await noteHtml('posts/obsidian-syntax/recursion-a');
    expect(html).toContain('pw-embed-cycle');
    expect(html.match(/data-embed="posts\/obsidian-syntax\/recursion-b"/g)?.length).toBe(1);
  });
});

describe('formatting', () => {
  it('highlights, strips comments and block ids, handles footnotes', async () => {
    const html = await noteHtml('posts/obsidian-syntax/formatting');
    expect(html).toContain('<mark>highlighted text</mark>');
    expect(html).toContain('<mark><strong>bold highlighted</strong></mark>');
    expect(html).not.toContain('never reach');
    expect(html).not.toContain('Multi-line comments');
    expect(html).not.toContain('hidden');
    expect(html).toContain('<code dir="ltr">%% not a comment %%</code>');
    expect(html).toContain('id="^para-1"');
    expect(html).toContain('<li id="^item-1"');
    expect(html).toContain('<table id="^table-1">');
    expect(html).not.toMatch(/\^para-1</);
    expect(html).toContain('This one is written inline.');
    expect(html).toContain('The classic footnote text.');
  });
  it('turns inline #tags into tag links but not code or URL fragments', async () => {
    const html = await noteHtml('posts/obsidian-syntax/formatting');
    expect(html).toContain('<a href="/tags/syntax/" class="tag" rel="tag">#syntax</a>');
    expect(html).toContain('href="/tags/nested/tag-name/"');
    expect(html).toContain('<code dir="ltr">#code</code>');
    const r = await fixtureVaultResult();
    const n = r.notes.find((x) => x.id === 'posts/obsidian-syntax/formatting')!;
    expect(n.data.tags).toContain('nested/tag-name');
    expect(n.data.tags).not.toContain('anchor');
    expect(n.data.cssclasses).toEqual(['wide', 'formatting-demo']);
  });
  it('renders callouts, foldable as <details>, and collects FAQ', async () => {
    const html = await noteHtml('posts/obsidian-syntax/callouts');
    expect(html).toContain('data-callout="recipe"');
    expect(html).toMatch(/<details class="callout" data-callout="faq" data-collapsible="true">/);
    expect(html).toMatch(/<details class="callout" data-callout="faq" data-collapsible="true" open>/);
    const r = await fixtureVaultResult();
    expect(r.notes.find((x) => x.id === 'posts/obsidian-syntax/callouts')!.data.faq).toHaveLength(2);
  });
  it('renders math with KaTeX only when enabled', async () => {
    expect(await noteHtml('posts/obsidian-syntax/math')).toContain('class="katex"');
    const { result } = await tempVault({ 'posts/x.md': '---\ndate: 2024-01-01\n---\nPrice is $5 and $6.' });
    expect(result.notes[0]!.html).not.toContain('katex');
  });
  it('highlights code with Shiki, file labels and line highlights', async () => {
    const html = await noteHtml('posts/obsidian-syntax/code');
    expect(html).toContain('<figcaption class="pw-code-title" dir="ltr">paperwhite.config.ts</figcaption>');
    expect(html).toContain('class="line highlighted"');
    expect(html).toMatch(/<button type="button" class="pw-copy" hidden/);
  });
  it('resolves paperwhite:query fences statically', async () => {
    const html = await noteHtml('posts/obsidian-syntax/query');
    expect(html).toContain('<ul class="pw-query">');
    expect(html.match(/<li/g)?.length).toBe(5);
    expect(html).toContain('>Code blocks</a>');
  });
});

describe('vault', () => {
  it('excludes drafts, publish:false, future posts, templates and .obsidian', async () => {
    const r = await fixtureVaultResult();
    expect(r.excluded.map((e) => e.reason).sort()).toEqual(['draft', 'future', 'publish-false']);
    expect(r.notes.some((n) => n.id.startsWith('_templates'))).toBe(false);
    expect(r.notes).toHaveLength(47);
  });
  it('supports publishedOnly mode', async () => {
    const { result } = await tempVault(
      { 'a.md': '---\npublish: true\n---\nA', 'b.md': 'B' },
      { publishedOnly: true },
    );
    expect(result.notes.map((n) => n.id)).toEqual(['a']);
  });
  it('computes backlinks with excerpts and related posts', async () => {
    const r = await fixtureVaultResult();
    const hello = r.notes.find((n) => n.id === 'posts/hello-world')!;
    const sources = hello.data.backlinks.map((b) => b.id);
    expect(sources).toContain('posts/obsidian-syntax/wikilinks');
    expect(hello.data.backlinks.find((b) => b.id === 'posts/obsidian-syntax/wikilinks')!.excerpt).toBeTruthy();
    const part2 = r.notes.find((n) => n.id === 'posts/series/building-a-blog-part-2')!;
    expect(part2.data.related.map((x) => x.id)).toContain('posts/series/building-a-blog-part-1');
  });
  it('parses Jalali dates and makes translations symmetric', async () => {
    const r = await fixtureVaultResult();
    const fa = r.notes.find((n) => n.id === 'posts/fa/سلام دنیا')!;
    expect(fa.data.date!.toISOString()).toBe('2024-10-05T00:00:00.000Z');
    expect(fa.data.url).toBe('/fa/سلام-دنیا/');
    expect(fa.data.dir).toBe('rtl');
    const en = r.notes.find((n) => n.id === 'posts/hello-world')!;
    expect(en.data.alternates).toEqual({ en: '/hello-world/', fa: '/fa/سلام-دنیا/' });
    expect(fa.data.alternates).toEqual({ fa: '/fa/سلام-دنیا/', en: '/hello-world/' });
  });
  it('collects redirects from aliases and redirect_from, and comments', async () => {
    const r = await fixtureVaultResult();
    const wp = r.notes.find((n) => n.id === 'posts/wordpress-migrated')!;
    expect(wp.data.url).toBe('/old-wordpress-post/');
    expect(wp.data.redirectFrom).toEqual(['/?p=123', '/2019/05/old-slug/']);
    expect(wp.data.comments).toHaveLength(3);
    expect(wp.data.comments[0]!.html).toContain('rel="nofollow ugc noopener"');
    expect(wp.data.comments[1]!.html).not.toContain('<script');
    const hello = r.notes.find((n) => n.id === 'posts/hello-world')!;
    expect(hello.data.redirectFrom).toEqual(['/first-post/']);
  });
  it('reuses cached renders when nothing changed', async () => {
    const { config } = await tempVault({ 'posts/a.md': '---\ndate: 2024-01-01\n---\nHello [[b]]', 'posts/b.md': '---\ndate: 2024-01-02\n---\nB' });
    const { buildVault } = await import('../src/content/vault.ts');
    const first = await buildVault(config, { cacheDir: `${config.root}/.cache` });
    const prev = new Map(first.notes.map((n) => [n.id, { digest: n.data.digest, html: n.html, data: n.data }]));
    const second = await buildVault(config, { cacheDir: `${config.root}/.cache`, previous: (id) => prev.get(id) });
    expect(second.reused).toBe(2);
    expect(second.rendered).toBe(0);
    expect(second.notes.find((n) => n.id === 'posts/b')!.data.backlinks.map((b) => b.id)).toEqual(['posts/a']);
  });
  it('demotes headings so pages keep a single H1', async () => {
    const { result } = await tempVault({ 'posts/x.md': '---\ntitle: T\ndate: 2024-01-01\n---\n# T\n\nintro\n\n# Section\n\ntext' });
    const html = result.notes[0]!.html;
    expect(html).not.toContain('<h1');
    expect(html).toContain('<h2 id="section"');
  });
  it('falls back to first H1 then filename for titles', async () => {
    const { result } = await tempVault({ 'pages/my-file.md': '# Real Title\n\nBody', 'pages/other.md': 'Body only' });
    const titles = Object.fromEntries(result.notes.map((n) => [n.id, n.data.title]));
    expect(titles).toEqual({ 'pages/my-file': 'Real Title', 'pages/other': 'other' });
  });
});
