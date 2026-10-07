import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fromHtml } from 'hast-util-from-html';
import { sanitize, defaultSchema } from 'hast-util-sanitize';
import { toHtml } from 'hast-util-to-html';
import { visit } from 'unist-util-visit';
import type { Element } from 'hast';
import type { ResolvedConfig } from '../config.ts';
import type { Comment, ImageInfo, LinkRef, NoteData, UnresolvedLink } from '../types.ts';
import { buildIndex, type IndexedNote, type VaultIndex, localizePath } from './vault-index.ts';
import { processImage, type ImageOptions } from './images.ts';
import { registerAsset } from './assets.ts';
import { gitLastUpdated } from './git.ts';
import { countWords, truncate, roughPlain } from './text.ts';
import { previewUrl } from './preview-url.ts';
import { normalizePersian } from '../i18n/persian.ts';
import { createProcessor, renderWithContext, type RenderContext } from '../pipeline/index.ts';

export interface BuiltNote {
  id: string;
  html: string;
  data: NoteData;
}

export interface CachedRender {
  digest: string;
  html: string;
  data: NoteData;
}

export interface VaultBuildOptions {
  /** Directory for image/render caches. Default `<root>/.paperwhite` */
  cacheDir?: string;
  now?: Date;
  /** Previously rendered notes (incremental builds) */
  previous?: (id: string) => CachedRender | undefined;
  /** Concurrency for rendering */
  concurrency?: number;
  images?: Omit<ImageOptions, 'cacheDir'>;
  /** Persist slug changes into `paperwhite.slugs.json` (build only) */
  updateSlugHistory?: boolean;
  logger?: { info(m: string): void; warn(m: string): void };
}

export interface VaultResult {
  index: VaultIndex;
  notes: BuiltNote[];
  warnings: string[];
  unresolved: UnresolvedLink[];
  excluded: { id: string; reason: string }[];
  rendered: number;
  reused: number;
  graph: { nodes: { id: string; title: string; url: string; type: string; tags: string[]; lang: string }[]; links: { source: string; target: string }[] };
}

const KNOWN_FM = new Set([
  'title', 'description', 'date', 'updated', 'slug', 'aliases', 'alias', 'tags', 'categories', 'category', 'series',
  'series_order', 'lang', 'dir', 'cover', 'cover_alt', 'author', 'authors', 'draft', 'publish', 'canonical', 'noindex',
  'toc', 'math', 'cssclasses', 'cssclass', 'redirect_from', 'comments', 'translations', 'type',
]);

export { previewUrl };

function limit(n: number) {
  let active = 0;
  const queue: (() => void)[] = [];
  return async <T>(fn: () => Promise<T>): Promise<T> => {
    if (active >= n) await new Promise<void>((r) => queue.push(r));
    active++;
    try {
      return await fn();
    } finally {
      active--;
      queue.shift()?.();
    }
  };
}

function stripLinkSyntax(v: string): string {
  return v.trim().replace(/^!?\[\[|\]\]$/g, '').split('|')[0]!.trim();
}

let pipelineFingerprint: string | undefined;

/**
 * Fingerprint of the rendering code itself plus render-affecting config, so cached HTML is
 * invalidated when PaperWhite is upgraded (or edited) or Markdown/locale settings change.
 */
function pipelineDigest(config: ResolvedConfig): string {
  if (!pipelineFingerprint) {
    const h = createHash('sha1');
    const src = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const e of fsSync.readdirSync(dir, { withFileTypes: true })) {
        const f = path.join(dir, e.name);
        if (e.isDirectory()) walk(f);
        else if (/\.(ts|json)$/.test(e.name)) files.push(f);
      }
    };
    for (const d of ['pipeline', 'content', 'i18n']) walk(path.join(src, d));
    for (const f of files.sort()) h.update(fsSync.readFileSync(f));
    for (const f of ['en.json', 'fa.json']) h.update(fsSync.readFileSync(path.join(src, '..', 'i18n', f)));
    // plugin folders in the site render too: an edit there must invalidate cached HTML
    for (const dir of config.pluginSources) if (fsSync.existsSync(dir)) walk(dir), files.push(dir);
    for (const f of files.filter((f) => config.pluginSources.some((d) => f.startsWith(d))).sort()) h.update(fsSync.statSync(f).isFile() ? fsSync.readFileSync(f) : f);
    pipelineFingerprint = h.digest('hex');
  }
  const { remarkPlugins, rehypePlugins, ...markdown } = config.markdown;
  return createHash('sha1')
    .update(pipelineFingerprint)
    .update(JSON.stringify([markdown, config.locales, config.permalink, config.trailingSlash, config.site.url, config.i18n, config.toc, config.plugins.map((p) => p.name), remarkPlugins.length, rehypePlugins.length]))
    .digest('hex');
}

/** Everything about the vault that can change how *other* notes render (titles, URLs, anchors…). */
function surfaceDigest(index: VaultIndex): string {
  const h = createHash('sha1');
  for (const id of [...index.notes.keys()].sort()) {
    const n = index.notes.get(id)!;
    h.update(
      JSON.stringify([id, n.url, n.title, n.published, n.aliases, n.tags, n.date?.getTime(), n.lang, n.headings.map((x) => x.slug), [...n.blockIds]]),
    );
  }
  h.update(JSON.stringify([...index.files.keys()].sort()));
  return h.digest('hex');
}

const sanitizeSchema = {
  ...defaultSchema,
  clobberPrefix: '',
  tagNames: ['p', 'a', 'br', 'strong', 'b', 'em', 'i', 'code', 'pre', 'blockquote', 'ul', 'ol', 'li', 'del', 's', 'img'],
  attributes: { a: ['href', 'title'], img: ['src', 'alt', 'width', 'height'], code: [], '*': [] },
};

export function sanitizeCommentHtml(html: string): string {
  const tree = sanitize(fromHtml(html, { fragment: true }), sanitizeSchema);
  visit(tree, 'element', (el: Element) => {
    if (el.tagName === 'a') el.properties = { ...el.properties, rel: ['nofollow', 'ugc', 'noopener'] };
    if (el.tagName === 'img') el.properties = { ...el.properties, loading: 'lazy', decoding: 'async' };
  });
  return toHtml(tree);
}

async function loadComments(config: ResolvedConfig, n: IndexedNote): Promise<Comment[]> {
  if (n.fm.comments === false) return [];
  const dir = path.join(config.contentDir, config.dirs.comments);
  const candidates =
    typeof n.fm.comments === 'string'
      ? [path.resolve(path.dirname(n.absPath), n.fm.comments), path.join(config.contentDir, n.fm.comments)]
      : [path.join(dir, `${n.slug}.json`), path.join(dir, `${n.basename}.json`)];
  for (const file of candidates) {
    try {
      const raw = JSON.parse(await fs.readFile(file, 'utf8')) as unknown;
      const list = (Array.isArray(raw) ? raw : (raw as { comments?: unknown[] }).comments ?? []) as Record<string, unknown>[];
      return list.map((c, i) => ({
        id: String(c.id ?? i + 1),
        parent: c.parent != null && c.parent !== 0 && c.parent !== '0' ? String(c.parent) : null,
        author: String(c.author ?? c.author_name ?? 'Anonymous'),
        url: typeof (c.url ?? c.author_url) === 'string' && String(c.url ?? c.author_url) ? String(c.url ?? c.author_url) : undefined,
        date: String(c.date ?? c.date_gmt ?? ''),
        html: sanitizeCommentHtml(String(c.html ?? c.content ?? '')),
      }));
    } catch {
      /* try next */
    }
  }
  return [];
}

async function resolveCover(
  index: VaultIndex,
  n: IndexedNote,
  imageOptions: ImageOptions,
  assets: Record<string, string>,
): Promise<ImageInfo | undefined> {
  const raw = n.fm.cover;
  if (!raw) return undefined;
  const target = stripLinkSyntax(raw).replace(/^<|>$/g, '');
  if (/^https?:\/\//i.test(target)) return { src: target, width: 0, height: 0, sources: [], srcset: '' };
  const abs = index.resolveFile(target, n.id);
  if (!abs) return undefined;
  const info = await processImage(abs, { ...imageOptions, widths: [640, 1200, 1600] });
  Object.assign(assets, info.assets);
  return info;
}

export async function buildVault(config: ResolvedConfig, opts: VaultBuildOptions = {}): Promise<VaultResult> {
  const cacheDir = opts.cacheDir ?? path.join(config.root, '.paperwhite');
  const imageOptions: ImageOptions = { cacheDir, ...opts.images };
  const [index, gitDates] = await Promise.all([buildIndex(config, { now: opts.now }), gitLastUpdated(config.contentDir)]);
  const warnings = [...index.warnings];
  const surface = surfaceDigest(index) + pipelineDigest(config);
  // Callout types used anywhere in the vault; unknown ones are registered as custom types.
  const calloutTypes = [...new Set([...index.notes.values()].flatMap((n) => [...n.body.matchAll(/^\s*(?:>\s*)+\[!([\w-]+)\]/gm)].map((m) => m[1]!.toLowerCase())))];
  const codeLangs = [...new Set([...index.notes.values()].flatMap((n) => [...n.body.matchAll(/^\s{0,3}(?:`{3,}|~{3,})\s*([\w+#.-]+)/gm)].map((m) => m[1]!.toLowerCase())))];
  const processors = new Map<boolean, ReturnType<typeof createProcessor>>();
  const processorFor = (math: boolean) => {
    let p = processors.get(math);
    if (!p) {
      p = createProcessor(config, { math, calloutTypes, codeLangs });
      processors.set(math, p);
    }
    return p;
  };
  const wantsMath = (n: IndexedNote) => config.markdown.math === 'always' || (config.markdown.math === 'frontmatter' && n.fm.math === true);

  const published = [...index.notes.values()].filter((n) => n.published);
  const excluded = [...index.notes.values()].filter((n) => !n.published).map((n) => ({ id: n.id, reason: n.excludedReason! }));

  // Slug history → automatic redirects for changed URLs
  const slugFile = path.join(config.root, 'paperwhite.slugs.json');
  let slugHistory: { current: Record<string, string>; previous: Record<string, string[]> } = { current: {}, previous: {} };
  try {
    const raw = JSON.parse(await fs.readFile(slugFile, 'utf8')) as Partial<typeof slugHistory>;
    slugHistory = { current: raw.current ?? {}, previous: raw.previous ?? {} };
  } catch {}

  const newCtx = (n: IndexedNote, extra: Partial<RenderContext> = {}): RenderContext => ({
    index,
    note: n,
    config,
    plugins: config.plugins,
    imageOptions,
    stack: [],
    embedded: false,
    renderEmbed: async () => '',
    previewUrl: (t) => previewUrl(t.id),
    unresolved: [],
    outgoing: new Set(),
    faq: [],
    imagesMissingAlt: [],
    images: [],
    assets: {},
    headings: [],
    text: '',
    firstParagraph: '',
    ...extra,
  });

  const renderEmbed =
    (parent: RenderContext) =>
    async (target: IndexedNote, section: string | undefined, stack: string[]): Promise<string> => {
      const sub = newCtx(target, { stack, section, embedded: true });
      sub.renderEmbed = renderEmbed(sub);
      const { html } = await renderWithContext(processorFor(wantsMath(target) || wantsMath(parent.note)), target.body, sub);
      parent.unresolved.push(...sub.unresolved);
      for (const o of sub.outgoing) parent.outgoing.add(o);
      Object.assign(parent.assets, sub.assets);
      parent.images.push(...sub.images);
      parent.imagesMissingAlt.push(...sub.imagesMissingAlt);
      return html;
    };

  // Notes whose content embeds others must re-render when the embedded source changes.
  const embedSources = (n: IndexedNote): string => {
    const parts: string[] = [];
    for (const l of n.links) {
      if (!l.link.embed) continue;
      const t = index.resolveNote(l.link.target, n.id);
      if (t) parts.push(t.source);
    }
    return parts.join('\u0000');
  };

  const run = limit(opts.concurrency ?? 8);
  let rendered = 0;
  let reused = 0;
  const built = await Promise.all(
    published.map((n) =>
      run(async (): Promise<BuiltNote> => {
        const digest = createHash('sha1')
          .update(n.source)
          .update(surface)
          .update(embedSources(n))
          .update(String(gitDates.get(n.absPath)?.getTime() ?? ''))
          .digest('hex');
        const prev = opts.previous?.(n.id);
        if (prev && prev.digest === digest) {
          reused++;
          for (const [url, file] of Object.entries(prev.data.assets ?? {})) registerAsset(url, file);
          return { id: n.id, html: prev.html, data: { ...prev.data, backlinks: [], related: [], alternates: {} } };
        }
        const ctx = newCtx(n);
        ctx.renderEmbed = renderEmbed(ctx);
        const { html } = await renderWithContext(processorFor(wantsMath(n)), n.body, ctx);
        rendered++;
        const locale = config.locales.supported[n.lang] ?? config.locales.supported[config.locales.default]!;
        const words = countWords(ctx.text, locale.intl);
        const cover = await resolveCover(index, n, imageOptions, ctx.assets);
        if (n.fm.cover && !cover) warnings.push(`${n.relPath}: cover image not found (${n.fm.cover})`);
        const gitDate = gitDates.get(n.absPath);
        const updated = n.updated ?? (gitDate && n.date && gitDate.getTime() - n.date.getTime() > 86_400_000 ? gitDate : undefined);
        const authors = [...new Set([...(n.fm.authors ?? []), ...(n.fm.author ?? [])])];
        if (!authors.length && config.site.author) authors.push(config.site.author);
        const aliasRedirects = n.aliases.map((a) => localizePath(config, `/${a.replace(/^\/+|\/+$/g, '')}/`, n.lang));
        const redirectFrom = [...new Set([...(n.fm.redirect_from ?? []), ...(slugHistory.previous[n.id] ?? []), ...aliasRedirects])].filter(
          (u) => u !== n.url,
        );
        const extra: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(n.fm)) if (!KNOWN_FM.has(k)) extra[k] = v;
        const translations: Record<string, string> = {};
        for (const [lang, t] of Object.entries(n.fm.translations ?? {})) {
          const target = index.resolveNote(stripLinkSyntax(t), n.id);
          if (target?.published) translations[lang] = target.id;
          else warnings.push(`${n.relPath}: translation "${lang}: ${t}" not found`);
        }
        const normalize = (v: string) => (locale.typography ? normalizePersian(v) : v);
        const description = normalize((n.fm.description ?? '').trim());
        const data: NoteData = {
          type: n.type,
          title: normalize(n.title),
          description: description || truncate(ctx.firstParagraph || ctx.text, 155),
          autoDescription: !description,
          date: n.date,
          updated,
          slug: n.slug,
          url: n.url,
          path: n.relPath,
          aliases: n.aliases,
          tags: n.tags,
          categories: n.categories,
          series: n.fm.series,
          seriesOrder: n.fm.series_order,
          lang: n.lang,
          dir: n.dir,
          cover,
          coverAlt: n.fm.cover_alt,
          authors,
          draft: n.fm.draft === true,
          canonical: n.fm.canonical,
          noindex: n.fm.noindex === true,
          toc: n.fm.toc ?? (config.toc.default && ctx.headings.filter((h) => h.depth <= config.toc.maxDepth).length >= config.toc.minHeadings),
          math: wantsMath(n),
          cssclasses: [...new Set([...(n.fm.cssclasses ?? []), ...(n.fm.cssclass ?? [])])],
          redirectFrom,
          comments: await loadComments(config, n),
          commentsEnabled: n.fm.comments !== false,
          translations,
          alternates: {},
          headings: ctx.headings,
          wordCount: words,
          readingTime: Math.max(1, Math.round(words / locale.wpm)),
          excerpt: truncate(ctx.firstParagraph || ctx.text, 280),
          outgoing: [...ctx.outgoing],
          backlinks: [],
          related: [],
          faq: ctx.faq,
          imagesMissingAlt: ctx.imagesMissingAlt,
          unresolved: dedupeUnresolved(ctx.unresolved),
          images: [...new Set(ctx.images)],
          text: ctx.text,
          assets: ctx.assets,
          digest,
          extra,
        };
        return { id: n.id, html, data };
      }),
    ),
  );

  const byId = new Map(built.map((b) => [b.id, b]));
  const ref = (b: BuiltNote, excerpt?: string): LinkRef => ({ id: b.id, title: b.data.title, url: b.data.url, excerpt });

  // Backlinks (with context excerpt around the link)
  for (const n of published) {
    const src = byId.get(n.id)!;
    const seen = new Set<string>();
    for (const l of n.links) {
      const t = l.link.target ? index.resolveNote(l.link.target, n.id) : undefined;
      if (!t || t.id === n.id || !t.published || seen.has(t.id)) continue;
      seen.add(t.id);
      const ctxText = truncate(l.context || roughPlain(n.body).slice(0, 200), 200);
      byId.get(t.id)!.data.backlinks.push(ref(src, ctxText));
    }
    for (const o of src.data.outgoing) {
      if (!seen.has(o) && byId.has(o) && o !== n.id) {
        seen.add(o);
        byId.get(o)!.data.backlinks.push(ref(src));
      }
    }
  }

  // Translations are symmetric; alternates are URLs keyed by locale.
  for (const b of built) {
    for (const id of Object.values(b.data.translations)) {
      const other = byId.get(id);
      if (other && !other.data.translations[b.data.lang]) other.data.translations[b.data.lang] = b.id;
    }
  }
  for (const b of built) {
    if (Object.keys(b.data.translations).length) {
      b.data.alternates = { [b.data.lang]: b.data.url };
      for (const [lang, id] of Object.entries(b.data.translations)) {
        const other = byId.get(id);
        if (other) b.data.alternates[lang] = other.data.url;
      }
    }
  }

  // Related posts: shared tags (2), link in either direction (3), same series/category (1)
  const posts = built.filter((b) => b.data.type === 'post');
  for (const a of posts) {
    const scores: [BuiltNote, number][] = [];
    for (const b of posts) {
      if (a === b || b.data.lang !== a.data.lang) continue;
      let s = 0;
      for (const t of a.data.tags) if (b.data.tags.includes(t)) s += 2;
      if (a.data.outgoing.includes(b.id) || b.data.outgoing.includes(a.id)) s += 3;
      if (a.data.series && a.data.series === b.data.series) s += 1;
      for (const c of a.data.categories) if (b.data.categories.includes(c)) s += 1;
      if (s > 0) scores.push([b, s]);
    }
    scores.sort((x, y) => y[1] - x[1] || (y[0].data.date?.getTime() ?? 0) - (x[0].data.date?.getTime() ?? 0));
    a.data.related = scores.slice(0, config.related.count).map(([b]) => ref(b, b.data.excerpt));
  }

  if (opts.updateSlugHistory) {
    let changed = false;
    for (const b of built) {
      const was = slugHistory.current[b.id];
      if (was === b.data.url) continue;
      changed = true;
      if (was) {
        const list = (slugHistory.previous[b.id] ??= []);
        if (!list.includes(was)) list.push(was);
        if (!b.data.redirectFrom.includes(was)) b.data.redirectFrom.push(was);
      }
      slugHistory.current[b.id] = b.data.url;
    }
    if (changed) await fs.writeFile(slugFile, `${JSON.stringify(slugHistory, null, 2)}\n`);
  }

  const unresolved = built.flatMap((b) => b.data.unresolved);
  const graph: VaultResult['graph'] = {
    nodes: built.map((b) => ({ id: b.id, title: b.data.title, url: b.data.url, type: b.data.type, tags: b.data.tags, lang: b.data.lang })),
    links: built.flatMap((b) => b.data.outgoing.filter((o) => byId.has(o)).map((o) => ({ source: b.id, target: o }))),
  };
  return { index, notes: built, warnings, unresolved, excluded, rendered, reused, graph };
}

function dedupeUnresolved(list: UnresolvedLink[]): UnresolvedLink[] {
  const seen = new Set<string>();
  return list.filter((u) => {
    const k = `${u.source}|${u.target}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
