/**
 * PaperWhite configuration. Pure module: no Astro or Node-only imports so it can be
 * loaded by the CLI, the content loader and the integration alike.
 */
import type { PaperwhitePlugin } from './types.ts';

export type Calendar = 'gregorian' | 'jalali';
/** `arabext` = Persian (Eastern Arabic) digits ۰-۹, `arab` = Arabic-Indic ٠-٩ */
export type Numerals = 'latn' | 'arab' | 'arabext';
export type Dir = 'ltr' | 'rtl';
export type Permalink = '/:slug/' | '/:year/:slug/' | '/:year/:month/:slug/' | 'folder';

export interface LocaleConfig {
  /** BCP-47 tag used for Intl formatting, e.g. `en-US`, `fa-IR` */
  intl?: string;
  label?: string;
  dir?: Dir;
  calendar?: Calendar;
  numerals?: Numerals;
  /** Words per minute for reading time */
  wpm?: number;
  /** Persian typography helpers (ZWNJ, digits, «», ی/ک) */
  typography?: boolean;
}

export interface AuthorConfig {
  name: string;
  url?: string;
  email?: string;
  bio?: string;
  avatar?: string;
  social?: Record<string, string>;
}

export interface PaperwhiteUserConfig {
  site: {
    /** Absolute production URL, e.g. https://example.com */
    url: string;
    title: string;
    description?: string;
    /** Default author key (from `authors`) or name */
    author?: string;
    logo?: string;
    /** Organization name for JSON-LD publisher; defaults to the site title */
    organization?: string;
    social?: { twitter?: string; github?: string; mastodon?: string; [k: string]: string | undefined };
    /** Per-locale title/description overrides */
    i18n?: Record<string, { title?: string; description?: string }>;
  };
  authors?: Record<string, AuthorConfig>;
  /** Vault root, relative to the site root. Default `./content` */
  contentDir?: string;
  dirs?: { posts?: string; pages?: string; attachments?: string; comments?: string };
  /** Only build notes with `publish: true` (Obsidian Publish parity) */
  publishedOnly?: boolean;
  /** Include future-dated posts (scheduled publishing). Default false */
  includeFuture?: boolean;
  /** Include drafts. Default false */
  includeDrafts?: boolean;
  permalink?: Permalink;
  trailingSlash?: boolean;
  locales?: {
    default?: string;
    routing?: 'prefix-other' | 'prefix-all';
    supported?: Record<string, LocaleConfig>;
  };
  /**
   * Theme name. Looked up in `<site>/themes/<name>/` first, then in the themes built into core
   * (`paper`). A relative or absolute directory path also works. Default `paper`.
   */
  theme?: string;
  markdown?: {
    inlineTags?: 'link' | 'strip' | 'keep';
    math?: 'frontmatter' | 'always' | 'never';
    transclusion?: 'full' | 'first-section';
    shikiThemes?: { light: string; dark: string };
    /** Demote headings when the body contains an H1, so the page has a single H1 */
    demoteHeadings?: boolean;
    remarkPlugins?: unknown[];
    rehypePlugins?: unknown[];
  };
  plugins?: PaperwhitePlugin[];
  seo?: {
    titleTemplate?: string;
    twitterHandle?: string;
    defaultImage?: string;
    ogImages?: boolean;
    audit?: { strict?: boolean; maxTitle?: number; maxDescription?: number };
    robots?: { disallow?: string[]; extra?: string };
    humans?: string | false;
    security?: { contact: string; expires?: string; policy?: string } | false;
    llms?: boolean;
    sitemapSplit?: number;
  };
  feeds?: { limit?: number; fullContent?: boolean; perTag?: boolean };
  pagination?: { pageSize?: number };
  search?: boolean;
  toc?: { default?: boolean; minHeadings?: number; maxDepth?: number };
  related?: { count?: number };
  comments?: {
    provider?: 'none' | 'giscus' | 'cusdis' | 'webmentions';
    giscus?: { repo: string; repoId: string; category: string; categoryId: string; mapping?: string };
    cusdis?: { appId: string; host?: string };
    webmentions?: { domain: string };
  };
  /** e.g. https://github.com/me/blog/edit/main/content/ */
  editUrl?: string;
  /** Export dist/graph.json */
  graph?: boolean;
  /** Export dist/api/posts.json and tags.json */
  api?: boolean;
  /** Enable `.mdx` notes via @astrojs/mdx (bypasses the Obsidian pipeline) */
  mdx?: boolean;
  /** Override UI strings, keyed by locale */
  i18n?: Record<string, Record<string, string>>;
}

export interface ResolvedLocale extends Required<Omit<LocaleConfig, 'label'>> {
  code: string;
  label: string;
}

export interface ResolvedConfig {
  site: PaperwhiteUserConfig['site'] & { url: string };
  authors: Record<string, AuthorConfig>;
  root: string;
  contentDir: string;
  dirs: { posts: string; pages: string; attachments: string; comments: string };
  publishedOnly: boolean;
  includeFuture: boolean;
  includeDrafts: boolean;
  permalink: Permalink;
  trailingSlash: boolean;
  locales: { default: string; routing: 'prefix-other' | 'prefix-all'; supported: Record<string, ResolvedLocale> };
  theme: string;
  markdown: Required<Omit<NonNullable<PaperwhiteUserConfig['markdown']>, 'remarkPlugins' | 'rehypePlugins'>> & {
    remarkPlugins: unknown[];
    rehypePlugins: unknown[];
  };
  plugins: PaperwhitePlugin[];
  seo: {
    titleTemplate: string;
    twitterHandle?: string;
    defaultImage?: string;
    ogImages: boolean;
    audit: { strict: boolean; maxTitle: number; maxDescription: number };
    robots: { disallow: string[]; extra?: string };
    humans: string | false;
    security: { contact: string; expires?: string; policy?: string } | false;
    llms: boolean;
    sitemapSplit: number;
  };
  feeds: { limit: number; fullContent: boolean; perTag: boolean };
  pagination: { pageSize: number };
  search: boolean;
  toc: { default: boolean; minHeadings: number; maxDepth: number };
  related: { count: number };
  comments: NonNullable<PaperwhiteUserConfig['comments']> & { provider: 'none' | 'giscus' | 'cusdis' | 'webmentions' };
  editUrl?: string;
  graph: boolean;
  api: boolean;
  mdx: boolean;
  i18n: Record<string, Record<string, string>>;
}

const LOCALE_DEFAULTS: Record<string, LocaleConfig> = {
  en: { intl: 'en-US', label: 'English', dir: 'ltr', calendar: 'gregorian', numerals: 'latn', wpm: 230, typography: false },
  fa: { intl: 'fa-IR', label: 'فارسی', dir: 'rtl', calendar: 'jalali', numerals: 'arabext', wpm: 180, typography: true },
  ar: { intl: 'ar', label: 'العربية', dir: 'rtl', calendar: 'gregorian', numerals: 'arab', wpm: 180, typography: false },
};

const RTL_LANGS = new Set(['fa', 'ar', 'he', 'ur', 'ps', 'ku', 'yi', 'dv']);

export function localeDefaults(code: string): LocaleConfig {
  return (
    LOCALE_DEFAULTS[code] ?? {
      intl: code,
      label: code,
      dir: RTL_LANGS.has(code.split('-')[0]!) ? 'rtl' : 'ltr',
      calendar: 'gregorian',
      numerals: 'latn',
      wpm: 220,
      typography: false,
    }
  );
}

export function defineConfig(config: PaperwhiteUserConfig): PaperwhiteUserConfig {
  return config;
}

/** Path join that works without node:path (config must stay environment-agnostic). */
function joinPath(a: string, b: string): string {
  if (b.startsWith('/')) return b.replace(/\/+$/, '');
  const parts = `${a}/${b}`.split('/');
  const out: string[] = [];
  for (const p of parts) {
    if (p === '' && out.length > 0) continue;
    if (p === '.') continue;
    if (p === '..') out.pop();
    else out.push(p);
  }
  return out.join('/') || '/';
}

export function resolveConfig(user: PaperwhiteUserConfig, root: string): ResolvedConfig {
  const rootDir = root.replace(/\/+$/, '');
  const localeEntries = Object.entries(user.locales?.supported ?? { en: {} });
  const supported: Record<string, ResolvedLocale> = {};
  for (const [code, cfg] of localeEntries) {
    const d = localeDefaults(code);
    supported[code] = {
      code,
      label: cfg.label ?? d.label ?? code,
      intl: cfg.intl ?? d.intl ?? code,
      dir: cfg.dir ?? d.dir ?? 'ltr',
      calendar: cfg.calendar ?? d.calendar ?? 'gregorian',
      numerals: cfg.numerals ?? d.numerals ?? 'latn',
      wpm: cfg.wpm ?? d.wpm ?? 220,
      typography: cfg.typography ?? d.typography ?? false,
    };
  }
  const defaultLocale = user.locales?.default ?? Object.keys(supported)[0] ?? 'en';
  if (!supported[defaultLocale]) {
    const d = localeDefaults(defaultLocale);
    supported[defaultLocale] = { code: defaultLocale, label: d.label!, intl: d.intl!, dir: d.dir!, calendar: d.calendar!, numerals: d.numerals!, wpm: d.wpm!, typography: d.typography! };
  }
  const contentDir = joinPath(rootDir, user.contentDir ?? './content');
  return {
    site: { ...user.site, url: user.site.url.replace(/\/+$/, '') },
    authors: user.authors ?? {},
    root: rootDir,
    contentDir,
    dirs: {
      posts: user.dirs?.posts ?? 'posts',
      pages: user.dirs?.pages ?? 'pages',
      attachments: user.dirs?.attachments ?? 'attachments',
      comments: user.dirs?.comments ?? 'comments',
    },
    publishedOnly: user.publishedOnly ?? false,
    includeFuture: user.includeFuture ?? false,
    includeDrafts: user.includeDrafts ?? false,
    permalink: user.permalink ?? '/:slug/',
    trailingSlash: user.trailingSlash ?? true,
    locales: { default: defaultLocale, routing: user.locales?.routing ?? 'prefix-other', supported },
    theme: user.theme ?? 'paper',
    markdown: {
      inlineTags: user.markdown?.inlineTags ?? 'link',
      math: user.markdown?.math ?? 'frontmatter',
      transclusion: user.markdown?.transclusion ?? 'full',
      shikiThemes: user.markdown?.shikiThemes ?? { light: 'github-light', dark: 'github-dark' },
      demoteHeadings: user.markdown?.demoteHeadings ?? true,
      remarkPlugins: user.markdown?.remarkPlugins ?? [],
      rehypePlugins: user.markdown?.rehypePlugins ?? [],
    },
    plugins: user.plugins ?? [],
    seo: {
      titleTemplate: user.seo?.titleTemplate ?? '%s · %site',
      twitterHandle: user.seo?.twitterHandle,
      defaultImage: user.seo?.defaultImage,
      ogImages: user.seo?.ogImages ?? true,
      audit: {
        strict: user.seo?.audit?.strict ?? false,
        maxTitle: user.seo?.audit?.maxTitle ?? 60,
        maxDescription: user.seo?.audit?.maxDescription ?? 160,
      },
      robots: { disallow: user.seo?.robots?.disallow ?? [], extra: user.seo?.robots?.extra },
      humans: user.seo?.humans ?? '',
      security: user.seo?.security ?? false,
      llms: user.seo?.llms ?? true,
      sitemapSplit: user.seo?.sitemapSplit ?? 10000,
    },
    feeds: {
      limit: user.feeds?.limit ?? 20,
      fullContent: user.feeds?.fullContent ?? true,
      perTag: user.feeds?.perTag ?? true,
    },
    pagination: { pageSize: user.pagination?.pageSize ?? 10 },
    search: user.search ?? true,
    toc: {
      default: user.toc?.default ?? true,
      minHeadings: user.toc?.minHeadings ?? 3,
      maxDepth: user.toc?.maxDepth ?? 3,
    },
    related: { count: user.related?.count ?? 3 },
    comments: { ...user.comments, provider: user.comments?.provider ?? 'none' },
    editUrl: user.editUrl,
    graph: user.graph ?? true,
    api: user.api ?? true,
    mdx: user.mdx ?? false,
    i18n: user.i18n ?? {},
  };
}

/** JSON-safe projection of the config, shipped to routes via a virtual module. */
export function serializableConfig(c: ResolvedConfig): Omit<ResolvedConfig, 'plugins' | 'markdown'> & {
  markdown: Omit<ResolvedConfig['markdown'], 'remarkPlugins' | 'rehypePlugins'>;
  plugins: string[];
} {
  const { remarkPlugins: _r, rehypePlugins: _h, ...markdown } = c.markdown;
  return { ...c, markdown, plugins: c.plugins.map((p) => p.name) };
}
