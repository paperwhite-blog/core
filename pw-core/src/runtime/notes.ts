import { getCollection, render } from 'astro:content';
import { config } from 'virtual:paperwhite/config';
import type { NoteData } from '../types.ts';
import type { ResolvedConfig } from '../config.ts';
import { noteUrl } from '../content/urls.ts';
import { parseDate } from '../i18n/dates.ts';
import { slugify } from '../i18n/slug.ts';

export interface Note {
  id: string;
  data: NoteData;
}

let cache: Promise<Note[]> | undefined;
let cacheKey: unknown;

type MdxEntry = { id: string; data: Record<string, unknown>; filePath?: string };

async function mdxEntries(): Promise<MdxEntry[]> {
  if (!config.mdx) return [];
  return (await getCollection('mdx' as never)) as unknown as MdxEntry[];
}

/** Minimal NoteData for `.mdx` entries (they bypass the Obsidian pipeline). */
function mdxNote(e: MdxEntry): Note {
  const cfg = config as unknown as ResolvedConfig;
  const fm = e.data;
  const relPath = e.id;
  const type: 'post' | 'page' = fm.type === 'page' || relPath.startsWith(`${cfg.dirs.pages}/`) ? 'page' : 'post';
  const lang = (typeof fm.lang === 'string' && fm.lang) || cfg.locales.default;
  const locale = cfg.locales.supported[lang] ?? cfg.locales.supported[cfg.locales.default]!;
  const date = parseDate(fm.date, locale.calendar);
  const basename = relPath.split('/').pop()!.replace(/\.mdx$/, '');
  const slug = typeof fm.slug === 'string' ? slugify(fm.slug) : slugify(basename);
  const list = (v: unknown) => (Array.isArray(v) ? v.map(String) : typeof v === 'string' ? [v] : []);
  const title = String(fm.title ?? basename);
  const data: NoteData = {
    type, title, description: String(fm.description ?? ''), autoDescription: !fm.description, date, updated: parseDate(fm.updated, locale.calendar),
    slug, url: noteUrl(cfg, { type, slug, lang, date, relPath }), path: relPath, aliases: [], tags: list(fm.tags), categories: list(fm.categories),
    series: typeof fm.series === 'string' ? fm.series : undefined, lang, dir: locale.dir, authors: list(fm.author ?? cfg.site.author),
    draft: fm.draft === true, noindex: fm.noindex === true, toc: false, math: false, cssclasses: [], redirectFrom: list(fm.redirect_from),
    comments: [], commentsEnabled: false, translations: {}, alternates: {}, headings: [], wordCount: 0, readingTime: 1, excerpt: String(fm.description ?? ''),
    outgoing: [], backlinks: [], related: [], faq: [], imagesMissingAlt: [], unresolved: [], images: [], text: String(fm.description ?? title), assets: {},
    digest: '', extra: { mdx: true, entryId: e.id },
  };
  return { id: `mdx:${e.id}`, data };
}

/** All published notes (posts and pages), memoized per build. */
export async function getNotes(): Promise<Note[]> {
  const entries = await getCollection('notes' as never);
  // invalidate when the collection instance changes (dev reloads)
  if (cacheKey !== entries || !cache) {
    cacheKey = entries;
    cache = (async () => [
      ...(entries as unknown as { id: string; data: NoteData }[]).map((e) => ({ id: e.id, data: e.data })),
      ...(await mdxEntries()).filter((e) => e.data.draft !== true && e.data.publish !== false).map(mdxNote),
    ])();
  }
  return cache;
}

export async function getNoteMap(): Promise<Map<string, Note>> {
  return new Map((await getNotes()).map((n) => [n.id, n]));
}

const byDateDesc = (a: Note, b: Note) => (b.data.date?.getTime() ?? 0) - (a.data.date?.getTime() ?? 0);

export async function getPosts(lang?: string): Promise<Note[]> {
  return (await getNotes()).filter((n) => n.data.type === 'post' && (!lang || n.data.lang === lang)).sort(byDateDesc);
}

export async function getPages(lang?: string): Promise<Note[]> {
  return (await getNotes()).filter((n) => n.data.type === 'page' && (!lang || n.data.lang === lang));
}

/** Rendered content component for a note. */
export async function renderNote(id: string) {
  const entries = (await getCollection((id.startsWith('mdx:') ? 'mdx' : 'notes') as never)) as unknown as { id: string }[];
  id = id.replace(/^mdx:/, '');
  const entry = entries.find((e) => e.id === id);
  if (!entry) throw new Error(`PaperWhite: note not found: ${id}`);
  return render(entry as never);
}

/** Notes in a series, ordered by `series_order` then date. */
export async function getSeries(name: string, lang: string): Promise<Note[]> {
  return (await getPosts(lang))
    .filter((n) => n.data.series === name)
    .sort(
      (a, b) =>
        (a.data.seriesOrder ?? Number.MAX_SAFE_INTEGER) - (b.data.seriesOrder ?? Number.MAX_SAFE_INTEGER) ||
        (a.data.date?.getTime() ?? 0) - (b.data.date?.getTime() ?? 0),
    );
}

export function siteTitle(lang: string): string {
  return config.site.i18n?.[lang]?.title ?? config.site.title;
}

export function siteDescription(lang: string): string {
  return config.site.i18n?.[lang]?.description ?? config.site.description ?? '';
}

export function authorInfo(key: string) {
  return config.authors[key] ?? { name: key };
}

/** Rendered HTML of a note (from the content layer entry). */
export async function getNoteHtml(id: string): Promise<string> {
  const entries = (await getCollection('notes' as never)) as unknown as { id: string; rendered?: { html: string } }[];
  return entries.find((e) => e.id === id)?.rendered?.html ?? '';
}

/** Make root-relative URLs in HTML absolute (feeds, llms-full.txt). */
export function absolutizeHtml(html: string, site: string): string {
  return html
    .replace(/(\s(?:href|src|data))="\/(?!\/)/g, `$1="${site}/`)
    .replace(/(\ssrcset)="([^"]+)"/g, (_m, attr: string, set: string) => `${attr}="${set.replace(/(^|,\s*)\/(?!\/)/g, `$1${site}/`)}"`);
}
