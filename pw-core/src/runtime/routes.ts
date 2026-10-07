import { config } from 'virtual:paperwhite/config';
import type { ResolvedConfig } from '../config.ts';
import { localizePath, tagPath, taxonomyPath, paginatedPath, homePath } from '../content/urls.ts';
import { calendarYear } from '../i18n/dates.ts';
import { getNotes, getPosts, type Note } from './notes.ts';
import { localeOf } from './i18n.ts';

const cfg = config as unknown as ResolvedConfig;

export type ListKind = 'home' | 'tag' | 'category' | 'author' | 'series' | 'year';

export type HtmlRoute =
  | { kind: 'note'; path: string; lang: string; id: string }
  | {
      kind: ListKind;
      path: string;
      lang: string;
      /** tag / category / author key / series name / year */
      term?: string;
      page: number;
      totalPages: number;
      ids: string[];
      prev?: string;
      next?: string;
      base: string;
    }
  | { kind: 'archive'; path: string; lang: string; groups: { year: number; url: string; ids: string[] }[] }
  | { kind: 'tags'; path: string; lang: string; tags: { tag: string; url: string; count: number }[] }
  | { kind: 'search'; path: string; lang: string }
  | { kind: 'redirect'; path: string; lang: string; to: string };

export const urls = {
  home: (lang: string) => homePath(cfg, lang),
  tag: (tag: string, lang: string) => tagPath(cfg, tag, lang),
  category: (c: string, lang: string) => taxonomyPath(cfg, 'categories', c, lang),
  author: (a: string, lang: string) => taxonomyPath(cfg, 'authors', a, lang),
  series: (s: string, lang: string) => taxonomyPath(cfg, 'series', s, lang),
  year: (y: number, lang: string) => localizePath(cfg, `/archive/${y}/`, lang),
  archive: (lang: string) => localizePath(cfg, '/archive/', lang),
  tags: (lang: string) => localizePath(cfg, '/tags/', lang),
  search: (lang: string) => localizePath(cfg, '/search/', lang),
  feed: (lang: string, kind: 'rss.xml' | 'atom.xml' | 'feed.json' = 'rss.xml') =>
    `${localizePath(cfg, '/', lang).replace(/\/$/, '')}/${kind}`,
  tagFeed: (tag: string, lang: string) => `${tagPath(cfg, tag, lang).replace(/\/$/, '')}/rss.xml`,
  og: (id: string) => `/og/${id.split('/').map(encodeURIComponent).join('/')}.png`,
  page: (base: string, n: number) => paginatedPath(cfg, base, n),
};

function paginate(kind: ListKind, base: string, lang: string, notes: Note[], term?: string): HtmlRoute[] {
  const size = cfg.pagination.pageSize;
  const total = Math.max(1, Math.ceil(notes.length / size));
  const out: HtmlRoute[] = [];
  for (let p = 1; p <= total; p++) {
    out.push({
      kind,
      path: paginatedPath(cfg, base, p),
      lang,
      term,
      page: p,
      totalPages: total,
      ids: notes.slice((p - 1) * size, p * size).map((n) => n.id),
      prev: p > 1 ? paginatedPath(cfg, base, p - 1) : undefined,
      next: p < total ? paginatedPath(cfg, base, p + 1) : undefined,
      base,
    });
  }
  return out;
}

function group<K>(notes: Note[], keys: (n: Note) => K[]): Map<K, Note[]> {
  const m = new Map<K, Note[]>();
  for (const n of notes)
    for (const k of keys(n)) {
      const arr = m.get(k);
      if (arr) arr.push(n);
      else m.set(k, [n]);
    }
  return m;
}

/** Expand nested tags: `pm/strategy` also counts for `pm`. */
function tagAncestors(tags: string[]): string[] {
  const out = new Set<string>();
  for (const t of tags) {
    const parts = t.split('/');
    for (let i = 1; i <= parts.length; i++) out.add(parts.slice(0, i).join('/'));
  }
  return [...out];
}

let routesCache: Promise<HtmlRoute[]> | undefined;
let routesKey: unknown;

/** Every HTML page of the site, for the catch-all route's getStaticPaths. */
export async function getHtmlRoutes(): Promise<HtmlRoute[]> {
  const notes = await getNotes();
  if (routesCache && routesKey === notes) return routesCache;
  routesKey = notes;
  routesCache = computeRoutes(notes);
  return routesCache;
}

async function computeRoutes(notes: Note[]): Promise<HtmlRoute[]> {
  const routes: HtmlRoute[] = [];
  const taken = new Set<string>();
  const add = (r: HtmlRoute) => {
    if (taken.has(r.path)) return;
    taken.add(r.path);
    routes.push(r);
  };
  for (const n of notes) add({ kind: 'note', path: n.data.url, lang: n.data.lang, id: n.id });

  for (const lang of Object.keys(cfg.locales.supported)) {
    const posts = await getPosts(lang);
    const locale = localeOf(lang);
    for (const r of paginate('home', urls.home(lang), lang, posts)) add(r);

    // yearly archives in the locale's calendar
    const byYear = group(posts.filter((p) => p.data.date), (p) => [calendarYear(p.data.date!, locale)]);
    const years = [...byYear.keys()].sort((a, b) => b - a);
    add({
      kind: 'archive',
      path: urls.archive(lang),
      lang,
      groups: years.map((y) => ({ year: y, url: urls.year(y, lang), ids: byYear.get(y)!.map((n) => n.id) })),
    });
    for (const y of years) for (const r of paginate('year', urls.year(y, lang), lang, byYear.get(y)!, String(y))) add(r);

    const byTag = group(posts, (p) => tagAncestors(p.data.tags));
    const tagList = [...byTag.entries()]
      .map(([tag, list]) => ({ tag, url: urls.tag(tag, lang), count: list.length }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
    add({ kind: 'tags', path: urls.tags(lang), lang, tags: tagList });
    for (const [tag, list] of byTag) for (const r of paginate('tag', urls.tag(tag, lang), lang, list, tag)) add(r);

    for (const [c, list] of group(posts, (p) => p.data.categories))
      for (const r of paginate('category', urls.category(c, lang), lang, list, c)) add(r);
    for (const [a, list] of group(posts, (p) => p.data.authors))
      for (const r of paginate('author', urls.author(a, lang), lang, list, a)) add(r);
    for (const [s, list] of group(posts, (p) => (p.data.series ? [p.data.series] : []))) {
      const ordered = [...list].sort(
        (a, b) => (a.data.seriesOrder ?? 1e9) - (b.data.seriesOrder ?? 1e9) || (a.data.date?.getTime() ?? 0) - (b.data.date?.getTime() ?? 0),
      );
      add({ kind: 'series', path: urls.series(s, lang), lang, term: s, page: 1, totalPages: 1, ids: ordered.map((n) => n.id), base: urls.series(s, lang) });
    }
    if (cfg.search) add({ kind: 'search', path: urls.search(lang), lang });
  }

  // meta-refresh fallbacks for legacy paths (query-string URLs only work via host redirect files)
  for (const n of notes) {
    for (const from of n.data.redirectFrom) {
      if (from.includes('?') || /^[a-z]+:/i.test(from)) continue;
      const p = from.startsWith('/') ? from : `/${from}`;
      const normalized = cfg.trailingSlash && !/\.[a-z0-9]+$/i.test(p) && !p.endsWith('/') ? `${p}/` : p;
      add({ kind: 'redirect', path: normalized, lang: n.data.lang, to: n.data.url });
    }
  }
  return routes;
}

export type ListRoute = Extract<HtmlRoute, { kind: ListKind }>;

/** Convert a route path into the catch-all `[...path]` param. */
export function toParam(p: string): string | undefined {
  const s = p.replace(/^\/+|\/+$/g, '');
  if (!s) return undefined;
  try {
    return decodeURI(s);
  } catch {
    return s;
  }
}

/** Redirect map for host config files: from → to */
export async function getRedirects(): Promise<{ from: string; to: string }[]> {
  const out: { from: string; to: string }[] = [];
  for (const n of await getNotes()) for (const from of n.data.redirectFrom) out.push({ from, to: n.data.url });
  return out;
}
