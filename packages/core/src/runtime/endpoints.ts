import { config } from 'virtual:paperwhite/config';
import type { ResolvedConfig } from '../config.ts';
import { absUrl } from '../seo/jsonld.ts';
import { rss, atom, jsonFeed, sitemap, sitemapIndex, type FeedChannel, type SitemapUrl } from '../seo/feeds.ts';
import { getNotes, getPosts, getNoteHtml, absolutizeHtml, siteTitle, siteDescription, authorInfo, type Note } from './notes.ts';
import { getHtmlRoutes, getRedirects, urls } from './routes.ts';
import { encodePath } from '../i18n/slug.ts';

const cfg = config as unknown as ResolvedConfig;
export type FeedFormat = 'rss' | 'atom' | 'json';

function tagMatch(n: Note, tag: string) {
  return n.data.tags.some((t) => t === tag || t.startsWith(`${tag}/`));
}

/** Feed variants: one per locale, plus per-tag RSS. `base` is the path before the feed file. */
export async function feedVariants(format: FeedFormat): Promise<{ base: string | undefined; lang: string; tag?: string }[]> {
  const out: { base: string | undefined; lang: string; tag?: string }[] = [];
  for (const lang of Object.keys(cfg.locales.supported)) {
    const home = urls.home(lang).replace(/^\/|\/$/g, '');
    out.push({ base: home || undefined, lang });
    if (format === 'rss' && cfg.feeds.perTag) {
      const tags = new Set((await getPosts(lang)).flatMap((p) => p.data.tags.flatMap((t) => t.split('/').map((_, i, a) => a.slice(0, i + 1).join('/')))));
      for (const tag of tags) out.push({ base: decodeURI(urls.tag(tag, lang).replace(/^\/|\/$/g, '')), lang, tag });
    }
  }
  return out;
}

export async function feedChannel(lang: string, format: FeedFormat, tag?: string): Promise<FeedChannel> {
  let posts = (await getPosts(lang)).filter((p) => !p.data.noindex);
  if (tag) posts = posts.filter((p) => tagMatch(p, tag));
  posts = posts.slice(0, cfg.feeds.limit);
  const file = format === 'rss' ? 'rss.xml' : format === 'atom' ? 'atom.xml' : 'feed.json';
  const feedPath = tag ? urls.tagFeed(tag, lang) : urls.feed(lang, file);
  const items = await Promise.all(
    posts.map(async (p) => ({
      id: p.id,
      title: p.data.title,
      url: absUrl(cfg, p.data.url),
      date: p.data.date,
      updated: p.data.updated,
      summary: p.data.description,
      html: cfg.feeds.fullContent ? absolutizeHtml(await getNoteHtml(p.id), cfg.site.url) : undefined,
      tags: p.data.tags,
      authors: p.data.authors.map((a) => authorInfo(a).name),
      image: p.data.cover ? { ...p.data.cover, abs: absUrl(cfg, p.data.cover.src) } : undefined,
    })),
  );
  const title = tag ? `${siteTitle(lang)} · #${tag}` : siteTitle(lang);
  return {
    title,
    description: siteDescription(lang) || title,
    siteUrl: absUrl(cfg, tag ? urls.tag(tag, lang) : urls.home(lang)),
    feedUrl: absUrl(cfg, feedPath),
    lang,
    updated: posts[0]?.data.updated ?? posts[0]?.data.date ?? new Date(0),
    items,
  };
}

export function renderFeed(c: FeedChannel, format: FeedFormat): Response {
  const body = format === 'rss' ? rss(c) : format === 'atom' ? atom(c) : jsonFeed(c);
  const type = format === 'rss' ? 'application/rss+xml' : format === 'atom' ? 'application/atom+xml' : 'application/feed+json';
  return new Response(body, { headers: { 'Content-Type': `${type}; charset=utf-8` } });
}

/** All indexable URLs grouped per locale, with lastmod, images and hreflang alternates. */
export async function sitemapGroups(): Promise<Map<string, SitemapUrl[]>> {
  const notes = await getNotes();
  const byUrl = new Map(notes.map((n) => [n.data.url, n]));
  const groups = new Map<string, SitemapUrl[]>();
  for (const r of await getHtmlRoutes()) {
    if (r.kind === 'redirect' || r.kind === 'search') continue;
    const n = r.kind === 'note' ? byUrl.get(r.path) : undefined;
    if (n && (n.data.noindex || n.data.canonical)) continue;
    const list = groups.get(r.lang) ?? [];
    const images = n ? [...(n.data.cover ? [n.data.cover.src] : []), ...n.data.images].map((i) => absUrl(cfg, i)) : undefined;
    list.push({
      loc: absUrl(cfg, r.path),
      lastmod: n ? (n.data.updated ?? n.data.date) : undefined,
      images: images?.length ? [...new Set(images)] : undefined,
      alternates: n && Object.keys(n.data.alternates).length ? Object.fromEntries(Object.entries(n.data.alternates).map(([l, u]) => [l, absUrl(cfg, u)])) : undefined,
    });
    groups.set(r.lang, list);
  }
  return groups;
}

export async function sitemapChunks(): Promise<{ name: string; urls: SitemapUrl[] }[]> {
  const out: { name: string; urls: SitemapUrl[] }[] = [];
  for (const [lang, list] of await sitemapGroups()) {
    const size = cfg.seo.sitemapSplit;
    for (let i = 0; i * size < list.length; i++) out.push({ name: `${lang}-${i + 1}`, urls: list.slice(i * size, (i + 1) * size) });
  }
  return out;
}

export async function sitemapIndexXml(): Promise<string> {
  const chunks = await sitemapChunks();
  return sitemapIndex(
    chunks.map((c) => ({
      loc: absUrl(cfg, `/sitemap-${c.name}.xml`),
      lastmod: c.urls.reduce<Date | undefined>((m, u) => (u.lastmod && (!m || u.lastmod > m) ? u.lastmod : m), undefined),
    })),
  );
}

export { sitemap };

export function robotsTxt(): string {
  const lines = ['User-agent: *', 'Allow: /', ...cfg.seo.robots.disallow.map((d) => `Disallow: ${d}`), '', `Sitemap: ${cfg.site.url}/sitemap-index.xml`];
  if (cfg.seo.robots.extra) lines.push('', cfg.seo.robots.extra);
  return `${lines.join('\n')}\n`;
}

export function humansTxt(): string {
  if (typeof cfg.seo.humans === 'string' && cfg.seo.humans) return cfg.seo.humans;
  const authors = Object.values(cfg.authors);
  return `/* TEAM */\n${(authors.length ? authors : [{ name: cfg.site.author ?? cfg.site.title }])
    .map((a) => `  Author: ${a.name}${'url' in a && a.url ? `\n  Site: ${a.url}` : ''}`)
    .join('\n\n')}\n\n/* SITE */\n  Standards: HTML5, CSS3\n  Software: PaperWhite, Astro\n`;
}

export function securityTxt(): string {
  const s = cfg.seo.security;
  if (!s) return '';
  const expires = s.expires ?? new Date(Date.now() + 365 * 86_400_000).toISOString();
  return [`Contact: ${s.contact}`, `Expires: ${expires}`, s.policy ? `Policy: ${s.policy}` : '', `Canonical: ${cfg.site.url}/.well-known/security.txt`]
    .filter(Boolean)
    .join('\n')
    .concat('\n');
}

/** llms.txt (https://llmstxt.org): a Markdown index of the site for language models. */
export async function llmsTxt(full: boolean): Promise<string> {
  const lang = cfg.locales.default;
  const out: string[] = [`# ${siteTitle(lang)}`, ''];
  if (siteDescription(lang)) out.push(`> ${siteDescription(lang)}`, '');
  out.push(`Feeds: ${cfg.site.url}/rss.xml · Sitemap: ${cfg.site.url}/sitemap-index.xml${cfg.api ? ` · API: ${cfg.site.url}/api/posts.json` : ''}`, '');
  for (const l of Object.keys(cfg.locales.supported)) {
    const posts = (await getPosts(l)).filter((p) => !p.data.noindex);
    const pages = (await getNotes()).filter((n) => n.data.type === 'page' && n.data.lang === l && !n.data.noindex);
    const suffix = Object.keys(cfg.locales.supported).length > 1 ? ` (${l})` : '';
    if (pages.length) {
      out.push(`## Pages${suffix}`, '');
      for (const p of pages) out.push(full ? section(p) : `- [${p.data.title}](${absUrl(cfg, p.data.url)}): ${p.data.description}`);
      out.push('');
    }
    if (posts.length) {
      out.push(`## Posts${suffix}`, '');
      for (const p of posts) out.push(full ? section(p) : `- [${p.data.title}](${absUrl(cfg, p.data.url)}): ${p.data.description}`);
      out.push('');
    }
  }
  return out.join('\n');
  function section(n: Note): string {
    return `### [${n.data.title}](${absUrl(cfg, n.data.url)})\n\n${n.data.date ? `Published ${n.data.date.toISOString().slice(0, 10)}. ` : ''}${n.data.tags.length ? `Tags: ${n.data.tags.join(', ')}.` : ''}\n\n${n.data.text}\n`;
  }
}

export async function graphJson(): Promise<string> {
  const notes = await getNotes();
  const ids = new Set(notes.map((n) => n.id));
  return JSON.stringify({
    nodes: notes.map((n) => ({ id: n.id, title: n.data.title, url: n.data.url, type: n.data.type, tags: n.data.tags, lang: n.data.lang })),
    links: notes.flatMap((n) => n.data.outgoing.filter((o) => ids.has(o)).map((o) => ({ source: n.id, target: o }))),
  });
}

export async function apiPosts(): Promise<string> {
  return JSON.stringify(
    (await getPosts()).map((p) => ({
      id: p.id,
      title: p.data.title,
      url: absUrl(cfg, p.data.url),
      date: p.data.date?.toISOString(),
      updated: p.data.updated?.toISOString(),
      description: p.data.description,
      lang: p.data.lang,
      tags: p.data.tags,
      categories: p.data.categories,
      series: p.data.series,
      readingTime: p.data.readingTime,
      wordCount: p.data.wordCount,
      cover: p.data.cover ? absUrl(cfg, p.data.cover.src) : undefined,
    })),
    null,
    2,
  );
}

export async function apiTags(): Promise<string> {
  const counts: Record<string, Record<string, number>> = {};
  for (const p of await getPosts()) for (const t of p.data.tags) ((counts[p.data.lang] ??= {})[t] = (counts[p.data.lang]![t] ?? 0) + 1);
  return JSON.stringify(
    Object.fromEntries(
      Object.entries(counts).map(([lang, tags]) => [
        lang,
        Object.entries(tags)
          .sort((a, b) => b[1] - a[1])
          .map(([tag, count]) => ({ tag, count, url: absUrl(cfg, urls.tag(tag, lang)) })),
      ]),
    ),
    null,
    2,
  );
}

const enc = (p: string) => (p.includes('?') ? p : encodePath(p));

export async function netlifyRedirects(): Promise<string> {
  const lines = ['# Generated by PaperWhite. Netlify / Cloudflare Pages format.'];
  for (const { from, to } of await getRedirects()) {
    const q = /^([^?]*)\?(.+)$/.exec(from);
    if (q) lines.push(`${enc(q[1] || '/')} ${q[2]!.replace(/&/g, ' ')} ${enc(to)} 301`);
    else lines.push(`${enc(from)} ${enc(to)} 301`);
  }
  return `${lines.join('\n')}\n`;
}

export async function vercelJson(): Promise<string> {
  const redirects = (await getRedirects()).map(({ from, to }) => {
    const q = /^([^?]*)\?(.+)$/.exec(from);
    if (!q) return { source: enc(from), destination: enc(to), permanent: true };
    const has = q[2]!.split('&').map((kv) => {
      const [key, value] = kv.split('=');
      return { type: 'query', key, ...(value ? { value } : {}) };
    });
    return { source: enc(q[1] || '/'), has, destination: enc(to), permanent: true };
  });
  return JSON.stringify({ trailingSlash: cfg.trailingSlash, cleanUrls: true, redirects }, null, 2);
}

export async function nginxRedirects(): Promise<string> {
  const rows = (await getRedirects()).map(({ from, to }) => `    "${enc(from)}" "${enc(to)}";`);
  return `# Generated by PaperWhite. Include in the http {} block, then in server {}:\n#   if ($paperwhite_redirect) { return 301 $paperwhite_redirect; }\nmap $request_uri $paperwhite_redirect {\n    default "";\n${rows.join('\n')}\n}\n`;
}
