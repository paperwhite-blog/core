import type { ImageInfo } from '../types.ts';

export interface FeedItem {
  title: string;
  url: string;
  id: string;
  date?: Date;
  updated?: Date;
  summary: string;
  html?: string;
  tags: string[];
  authors: string[];
  image?: ImageInfo & { abs: string };
}

export interface FeedChannel {
  title: string;
  description: string;
  siteUrl: string;
  feedUrl: string;
  lang: string;
  updated: Date;
  items: FeedItem[];
}

export const xml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const cdata = (s: string) => `<![CDATA[${s.replace(/]]>/g, ']]]]><![CDATA[>')}]]>`;

export function rss(c: FeedChannel): string {
  const items = c.items
    .map(
      (i) => `    <item>
      <title>${xml(i.title)}</title>
      <link>${xml(i.url)}</link>
      <guid isPermaLink="true">${xml(i.url)}</guid>
${i.date ? `      <pubDate>${i.date.toUTCString()}</pubDate>\n` : ''}      <description>${xml(i.summary)}</description>
${i.html ? `      <content:encoded>${cdata(i.html)}</content:encoded>\n` : ''}${i.authors.map((a) => `      <dc:creator>${xml(a)}</dc:creator>\n`).join('')}${i.tags.map((t) => `      <category>${xml(t)}</category>\n`).join('')}${
        i.image ? `      <media:content url="${xml(i.image.abs)}" medium="image"${i.image.width ? ` width="${i.image.width}" height="${i.image.height}"` : ''}/>\n` : ''
      }    </item>`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>${xml(c.title)}</title>
    <link>${xml(c.siteUrl)}</link>
    <description>${xml(c.description)}</description>
    <language>${xml(c.lang)}</language>
    <lastBuildDate>${c.updated.toUTCString()}</lastBuildDate>
    <atom:link href="${xml(c.feedUrl)}" rel="self" type="application/rss+xml"/>
    <generator>PaperWhite</generator>
${items}
  </channel>
</rss>
`;
}

export function atom(c: FeedChannel): string {
  const entries = c.items
    .map(
      (i) => `  <entry>
    <title>${xml(i.title)}</title>
    <link href="${xml(i.url)}" rel="alternate" type="text/html"/>
    <id>${xml(i.url)}</id>
    <updated>${(i.updated ?? i.date ?? c.updated).toISOString()}</updated>
${i.date ? `    <published>${i.date.toISOString()}</published>\n` : ''}    <summary>${xml(i.summary)}</summary>
${i.html ? `    <content type="html">${xml(i.html)}</content>\n` : ''}${i.authors.map((a) => `    <author><name>${xml(a)}</name></author>\n`).join('')}${i.tags.map((t) => `    <category term="${xml(t)}"/>\n`).join('')}  </entry>`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="${xml(c.lang)}">
  <title>${xml(c.title)}</title>
  <subtitle>${xml(c.description)}</subtitle>
  <link href="${xml(c.siteUrl)}" rel="alternate" type="text/html"/>
  <link href="${xml(c.feedUrl)}" rel="self" type="application/atom+xml"/>
  <id>${xml(c.siteUrl)}</id>
  <updated>${c.updated.toISOString()}</updated>
  <generator>PaperWhite</generator>
${entries}
</feed>
`;
}

export function jsonFeed(c: FeedChannel): string {
  return JSON.stringify(
    {
      version: 'https://jsonfeed.org/version/1.1',
      title: c.title,
      home_page_url: c.siteUrl,
      feed_url: c.feedUrl,
      description: c.description,
      language: c.lang,
      items: c.items.map((i) => ({
        id: i.url,
        url: i.url,
        title: i.title,
        summary: i.summary,
        ...(i.html ? { content_html: i.html } : {}),
        ...(i.date ? { date_published: i.date.toISOString() } : {}),
        ...(i.updated ? { date_modified: i.updated.toISOString() } : {}),
        ...(i.image ? { image: i.image.abs } : {}),
        tags: i.tags,
        authors: i.authors.map((name) => ({ name })),
      })),
    },
    null,
    2,
  );
}

export interface SitemapUrl {
  loc: string;
  lastmod?: Date;
  images?: string[];
  alternates?: Record<string, string>;
}

export function sitemap(urls: SitemapUrl[]): string {
  const body = urls
    .map(
      (u) =>
        `  <url>\n    <loc>${xml(u.loc)}</loc>\n${u.lastmod ? `    <lastmod>${u.lastmod.toISOString()}</lastmod>\n` : ''}${Object.entries(u.alternates ?? {})
          .map(([l, href]) => `    <xhtml:link rel="alternate" hreflang="${xml(l)}" href="${xml(href)}"/>\n`)
          .join('')}${(u.images ?? []).map((i) => `    <image:image><image:loc>${xml(i)}</image:loc></image:image>\n`).join('')}  </url>`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${body}
</urlset>
`;
}

export function sitemapIndex(locs: { loc: string; lastmod?: Date }[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${locs.map((l) => `  <sitemap>\n    <loc>${xml(l.loc)}</loc>\n${l.lastmod ? `    <lastmod>${l.lastmod.toISOString()}</lastmod>\n` : ''}  </sitemap>`).join('\n')}
</sitemapindex>
`;
}
