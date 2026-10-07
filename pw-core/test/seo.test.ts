import { describe, it, expect } from 'vitest';
import { rss, atom, jsonFeed, sitemap, sitemapIndex } from '../src/seo/feeds.ts';
import { articleLd, faqLd, websiteLd, ldScript, formatTitle, absUrl } from '../src/seo/jsonld.ts';
import { fixtureConfig, fixtureVaultResult } from './helpers.ts';

const channel = {
  title: 'Blog & Co',
  description: 'd',
  siteUrl: 'https://x.test/',
  feedUrl: 'https://x.test/rss.xml',
  lang: 'en',
  updated: new Date('2024-01-02T00:00:00Z'),
  items: [
    {
      id: 'a',
      title: 'A <b>',
      url: 'https://x.test/a/',
      date: new Date('2024-01-01T00:00:00Z'),
      summary: 's',
      html: '<p>hi ]]> there</p>',
      tags: ['t'],
      authors: ['Ada'],
      image: { src: '/i.jpg', abs: 'https://x.test/i.jpg', width: 10, height: 5, sources: [], srcset: '' },
    },
  ],
};

describe('feeds', () => {
  it('RSS 2.0 with content:encoded and media:content', () => {
    const x = rss(channel);
    expect(x).toContain('<title>Blog &amp; Co</title>');
    expect(x).toContain('<title>A &lt;b&gt;</title>');
    expect(x).toContain('<media:content url="https://x.test/i.jpg" medium="image" width="10" height="5"/>');
    expect(x).toContain('<![CDATA[<p>hi ]]]]><![CDATA[> there</p>]]>');
    expect(x).toContain('<atom:link href="https://x.test/rss.xml" rel="self"');
  });
  it('Atom and JSON Feed', () => {
    expect(atom(channel)).toContain('<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="en">');
    const j = JSON.parse(jsonFeed(channel));
    expect(j.version).toBe('https://jsonfeed.org/version/1.1');
    expect(j.items[0].content_html).toContain('hi');
  });
  it('sitemaps with images and hreflang', () => {
    const x = sitemap([{ loc: 'https://x.test/a/', lastmod: new Date(0), images: ['https://x.test/i.jpg'], alternates: { fa: 'https://x.test/fa/a/' } }]);
    expect(x).toContain('<image:image><image:loc>https://x.test/i.jpg</image:loc></image:image>');
    expect(x).toContain('hreflang="fa"');
    expect(sitemapIndex([{ loc: 'https://x.test/s-1.xml' }])).toContain('<sitemapindex');
  });
});

describe('json-ld', () => {
  it('BlogPosting, FAQPage, WebSite+SearchAction', async () => {
    const cfg = fixtureConfig();
    const r = await fixtureVaultResult();
    const callouts = r.notes.find((n) => n.id === 'posts/obsidian-syntax/callouts')!.data;
    const a = articleLd(cfg, callouts) as Record<string, unknown>;
    expect(a['@type']).toBe('BlogPosting');
    expect(a.datePublished).toBe('2024-03-10T00:00:00.000Z');
    const faq = faqLd(callouts) as { mainEntity: unknown[] };
    expect(faq.mainEntity).toHaveLength(2);
    const w = websiteLd(cfg, 'en', '/search/') as { potentialAction: { target: { urlTemplate: string } } };
    expect(w.potentialAction.target.urlTemplate).toBe('https://paperwhite.example/search/?q={search_term_string}');
    expect(ldScript({ a: '</script>' })).not.toContain('</script>');
    expect(formatTitle(cfg, 'Post', 'Site')).toBe('Post · Site');
    expect(absUrl(cfg, '/fa/سلام/')).toBe('https://paperwhite.example/fa/%D8%B3%D9%84%D8%A7%D9%85/');
  });
});
