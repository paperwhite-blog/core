import type { ResolvedConfig } from '../config.ts';
import type { NoteData } from '../types.ts';
import { encodePath } from '../i18n/slug.ts';

type Json = Record<string, unknown>;

export function absUrl(cfg: Pick<ResolvedConfig, 'site'>, p: string): string {
  if (/^https?:\/\//i.test(p)) return p;
  return `${cfg.site.url}${encodePath(p.startsWith('/') ? p : `/${p}`)}`;
}

export function personOrOrg(cfg: ResolvedConfig, authorKey?: string): Json {
  const a = authorKey ? cfg.authors[authorKey] : undefined;
  if (a || authorKey) {
    return {
      '@type': 'Person',
      name: a?.name ?? authorKey,
      ...(a?.url ? { url: a.url } : {}),
      ...(a?.social ? { sameAs: Object.values(a.social) } : {}),
    };
  }
  return publisher(cfg);
}

export function publisher(cfg: ResolvedConfig): Json {
  return {
    '@type': 'Organization',
    name: cfg.site.organization ?? cfg.site.title,
    url: cfg.site.url,
    ...(cfg.site.logo ? { logo: { '@type': 'ImageObject', url: absUrl(cfg, cfg.site.logo) } } : {}),
    ...(cfg.site.social ? { sameAs: Object.values(cfg.site.social).filter(Boolean).map(socialUrl) } : {}),
  };
}

function socialUrl(v: string | undefined): string {
  if (!v) return '';
  if (/^https?:/.test(v)) return v;
  if (v.startsWith('@')) return `https://x.com/${v.slice(1)}`;
  return v;
}

export function websiteLd(cfg: ResolvedConfig, lang: string, searchPath?: string): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: cfg.site.i18n?.[lang]?.title ?? cfg.site.title,
    url: absUrl(cfg, '/'),
    inLanguage: lang,
    publisher: publisher(cfg),
    ...(searchPath
      ? {
          potentialAction: {
            '@type': 'SearchAction',
            target: { '@type': 'EntryPoint', urlTemplate: `${absUrl(cfg, searchPath)}?q={search_term_string}` },
            'query-input': 'required name=search_term_string',
          },
        }
      : {}),
  };
}

export function articleLd(cfg: ResolvedConfig, n: NoteData, image?: string): Json {
  const url = absUrl(cfg, n.url);
  return {
    '@context': 'https://schema.org',
    '@type': n.type === 'post' ? 'BlogPosting' : 'WebPage',
    '@id': `${url}#article`,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    headline: n.title.slice(0, 110),
    name: n.title,
    description: n.description,
    url,
    inLanguage: n.lang,
    ...(n.date ? { datePublished: n.date.toISOString() } : {}),
    ...(n.updated || n.date ? { dateModified: (n.updated ?? n.date)!.toISOString() } : {}),
    ...(image ? { image: [absUrl(cfg, image)] } : {}),
    ...(n.type === 'post'
      ? {
          author: (n.authors.length ? n.authors : [undefined]).map((a) => personOrOrg(cfg, a)),
          publisher: publisher(cfg),
          wordCount: n.wordCount,
          ...(n.tags.length ? { keywords: n.tags.join(', ') } : {}),
          ...(n.categories[0] ? { articleSection: n.categories[0] } : {}),
          ...(n.series ? { isPartOf: { '@type': 'CreativeWorkSeries', name: n.series } } : {}),
        }
      : {}),
  };
}

export function breadcrumbLd(cfg: ResolvedConfig, items: { name: string; url: string }[]): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: absUrl(cfg, it.url) })),
  };
}

export function faqLd(n: NoteData): Json | undefined {
  if (!n.faq.length) return undefined;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: n.faq.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answerText },
    })),
  };
}

export function itemListLd(cfg: ResolvedConfig, name: string, items: { title: string; url: string }[]): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
    numberOfItems: items.length,
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, url: absUrl(cfg, it.url), name: it.title })),
  };
}

export function collectionLd(cfg: ResolvedConfig, name: string, url: string, lang: string): Json {
  return { '@context': 'https://schema.org', '@type': 'CollectionPage', name, url: absUrl(cfg, url), inLanguage: lang };
}

/** Safe serialization for <script type="application/ld+json">. */
export function ldScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

export function formatTitle(cfg: ResolvedConfig, title: string | undefined, siteTitle: string): string {
  if (!title || title === siteTitle) return siteTitle;
  return cfg.seo.titleTemplate.replace('%s', title).replace('%site', siteTitle);
}
