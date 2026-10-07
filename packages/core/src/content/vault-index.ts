import fs from 'node:fs/promises';
import path from 'node:path';
import fg from 'fast-glob';
import matter from 'gray-matter';
import { slug as githubSlug } from 'github-slugger';
import type { ResolvedConfig } from '../config.ts';
import { parseDate } from '../i18n/dates.ts';
import { slugify } from '../i18n/slug.ts';
import { normalizePersian } from '../i18n/persian.ts';
import { validateFrontmatter, type Frontmatter } from './schema.ts';
import {
  maskCode,
  stripObsidianComments,
  WIKILINK_RE,
  parseWikilink,
  roughPlain,
  extOf,
  type ParsedWikilink,
} from './text.ts';

export interface PrepassLink {
  link: ParsedWikilink;
  line: number;
  context: string;
}

export interface IndexedNote {
  /** posix path relative to vault, without `.md` */
  id: string;
  relPath: string;
  absPath: string;
  basename: string;
  type: 'post' | 'page';
  fm: Frontmatter;
  fmError?: string;
  body: string;
  source: string;
  title: string;
  /** true when the title came from the first H1 */
  titleFromH1: boolean;
  slug: string;
  url: string;
  lang: string;
  dir: 'ltr' | 'rtl';
  date?: Date;
  updated?: Date;
  aliases: string[];
  tags: string[];
  inlineTags: string[];
  categories: string[];
  headings: { depth: number; text: string; slug: string }[];
  blockIds: Set<string>;
  links: PrepassLink[];
  published: boolean;
  /** why a note is unpublished */
  excludedReason?: 'draft' | 'publish-false' | 'not-published' | 'future';
  mtime: Date;
}

export interface VaultIndex {
  config: ResolvedConfig;
  notes: Map<string, IndexedNote>;
  /** All non-note files: relative path → absolute path */
  files: Map<string, string>;
  /** lowercase basename (without .md) → note ids */
  byBasename: Map<string, string[]>;
  /** lowercase alias → note ids */
  byAlias: Map<string, string[]>;
  /** lowercase file basename (with ext) → relative paths */
  filesByName: Map<string, string[]>;
  resolveNote(target: string, fromId?: string): IndexedNote | undefined;
  resolveFile(target: string, fromId?: string): string | undefined;
  warnings: string[];
}

const IGNORE = ['**/node_modules/**', '**/_*/**', '**/.*/**', '**/_*', '**/.*'];

/** Is a vault-relative path ignored (any segment starting with `_` or `.`)? */
export function isIgnored(rel: string): boolean {
  return rel.split('/').some((s) => s.startsWith('_') || s.startsWith('.'));
}

export { noteUrl, localizePath, tagPath, href } from './urls.ts';
import { noteUrl } from './urls.ts';

function asList(...vals: (string[] | undefined)[]): string[] {
  const out: string[] = [];
  for (const v of vals) if (v) out.push(...v);
  return [...new Set(out.map((s) => s.trim()).filter(Boolean))];
}

function normalizeTag(t: string): string {
  return normalizePersian(t.replace(/^#/, '').trim());
}

const INLINE_TAG_RE = /(^|[\s(,;،])#([\p{L}\p{N}_\-/‌]*[\p{L}_\-/‌][\p{L}\p{N}_\-/‌]*)/gu;

export function extractInlineTags(maskedInput: string): string[] {
  const tags = new Set<string>();
  const masked = maskedInput.replace(WIKILINK_RE, ' ').replace(/\]\([^)]*\)/g, ' ').replace(/<[^>]+>/g, ' ');
  for (const line of masked.split('\n')) {
    if (/^\s{0,3}#{1,6}\s/.test(line)) {
      // tags inside heading text are still tags, but skip the heading marker
      for (const m of line.replace(/^\s{0,3}#{1,6}\s/, ' ').matchAll(INLINE_TAG_RE)) tags.add(normalizeTag(m[2]!));
      continue;
    }
    for (const m of line.matchAll(INLINE_TAG_RE)) tags.add(normalizeTag(m[2]!.replace(/[-/]+$/, '')));
  }
  return [...tags];
}

export { INLINE_TAG_RE };

interface ScanResult {
  firstH1?: string;
  headings: { depth: number; text: string; slug: string }[];
  blockIds: Set<string>;
  links: PrepassLink[];
  inlineTags: string[];
}

function scanBody(body: string): ScanResult {
  const masked = maskCode(body);
  const lines = masked.split('\n');
  const headings: ScanResult['headings'] = [];
  const blockIds = new Set<string>();
  let firstH1: string | undefined;
  let sawContent = false;
  for (const line of lines) {
    const h = /^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (h) {
      const text = roughPlain(h[2]!);
      if (h[1]!.length === 1 && !sawContent && firstH1 === undefined) firstH1 = text;
      headings.push({ depth: h[1]!.length, text, slug: githubSlug(text) });
    }
    if (line.trim()) sawContent = true;
    const b = /(?:^|\s)\^([A-Za-z0-9-]+)\s*$/.exec(line);
    if (b) blockIds.add(b[1]!);
  }
  const links: PrepassLink[] = [];
  lines.forEach((line, i) => {
    for (const m of line.matchAll(WIKILINK_RE)) {
      links.push({ link: parseWikilink(m[2]!, m[1] === '!'), line: i + 1, context: roughPlain(line) });
    }
    for (const m of line.matchAll(/(?<!!)\[[^\]]*\]\(([^)\s]+?\.md)(#[^)\s]*)?\)/g)) {
      let target = m[1]!;
      try {
        target = decodeURIComponent(target);
      } catch {}
      links.push({
        link: { embed: false, target: target.replace(/\.md$/, ''), anchor: m[2]?.slice(1), params: [], raw: m[0] },
        line: i + 1,
        context: roughPlain(line),
      });
    }
  });
  return { firstH1, headings, blockIds, links, inlineTags: extractInlineTags(masked) };
}

export async function buildIndex(config: ResolvedConfig, opts: { now?: Date } = {}): Promise<VaultIndex> {
  const now = opts.now ?? new Date();
  const root = config.contentDir;
  const warnings: string[] = [];
  const all = await fg('**/*', { cwd: root, ignore: IGNORE, dot: false, onlyFiles: true, followSymbolicLinks: true });
  const notes = new Map<string, IndexedNote>();
  const files = new Map<string, string>();
  const commentsPrefix = `${config.dirs.comments}/`;

  const mdFiles: string[] = [];
  for (const rel of all.sort()) {
    if (isIgnored(rel)) continue;
    if (rel.endsWith('.md') && !rel.endsWith('.excalidraw.md') && !rel.startsWith(commentsPrefix)) mdFiles.push(rel);
    else files.set(rel, path.join(root, rel));
  }

  await Promise.all(
    mdFiles.map(async (rel) => {
      const absPath = path.join(root, rel);
      const [source, stat] = await Promise.all([fs.readFile(absPath, 'utf8'), fs.stat(absPath)]);
      let parsed: matter.GrayMatterFile<string>;
      try {
        parsed = matter(source);
      } catch (e) {
        warnings.push(`${rel}: invalid frontmatter YAML (${(e as Error).message.split('\n')[0]})`);
        parsed = { data: {}, content: source.replace(/^---[\s\S]*?---\n?/, '') } as matter.GrayMatterFile<string>;
      }
      const v = validateFrontmatter(parsed.data);
      const fm: Frontmatter = v.ok ? v.data : (parsed.data as Frontmatter);
      const body = stripObsidianComments(parsed.content);
      const scan = scanBody(body);
      const id = rel.replace(/\.md$/, '');
      const basename = path.posix.basename(id);
      const lang = (typeof fm.lang === 'string' && fm.lang) || config.locales.default;
      const localeCfg = config.locales.supported[lang] ?? config.locales.supported[config.locales.default]!;
      if (!config.locales.supported[lang]) warnings.push(`${rel}: lang "${lang}" is not in locales.supported`);
      const type: 'post' | 'page' =
        fm.type ??
        (rel.startsWith(`${config.dirs.pages}/`) ? 'page' : rel.startsWith(`${config.dirs.posts}/`) ? 'post' : fm.date ? 'post' : 'page');
      const date = parseDate(fm.date, localeCfg.calendar);
      const updated = parseDate(fm.updated, localeCfg.calendar);
      if (fm.date != null && !date) warnings.push(`${rel}: unparseable date "${String(fm.date)}"`);
      const title = fm.title ?? scan.firstH1 ?? basename;
      const slug = fm.slug ? slugify(fm.slug) || fm.slug : slugify(basename) || slugify(title) || id;
      let excludedReason: IndexedNote['excludedReason'];
      if (fm.draft === true && !config.includeDrafts) excludedReason = 'draft';
      else if (fm.publish === false) excludedReason = 'publish-false';
      else if (config.publishedOnly && fm.publish !== true) excludedReason = 'not-published';
      else if (date && date.getTime() > now.getTime() && !config.includeFuture) excludedReason = 'future';
      const fmTags = asList(fm.tags).map(normalizeTag);
      const inlineTags = scan.inlineTags;
      const n: IndexedNote = {
        id,
        relPath: rel,
        absPath,
        basename,
        type,
        fm,
        fmError: v.ok ? undefined : v.error,
        body,
        source,
        title: String(title),
        titleFromH1: !fm.title && !!scan.firstH1,
        slug,
        url: '',
        lang,
        dir: (fm.dir as 'ltr' | 'rtl' | undefined) ?? localeCfg.dir,
        date,
        updated,
        aliases: asList(fm.aliases, fm.alias),
        tags: [...new Set([...fmTags, ...inlineTags])],
        inlineTags,
        categories: asList(fm.categories, fm.category),
        headings: scan.headings,
        blockIds: scan.blockIds,
        links: scan.links,
        published: !excludedReason,
        excludedReason,
        mtime: stat.mtime,
      };
      if (n.fmError) warnings.push(`${rel}: frontmatter ${n.fmError}`);
      notes.set(id, n);
    }),
  );

  // URLs + duplicate detection (deterministic order)
  const seenUrl = new Map<string, string>();
  for (const id of [...notes.keys()].sort()) {
    const n = notes.get(id)!;
    let url = noteUrl(config, n);
    if (n.published) {
      let i = 2;
      while (seenUrl.has(url)) {
        const other = seenUrl.get(url)!;
        warnings.push(`${n.relPath}: URL ${url} collides with ${other}; using -${i}`);
        url = noteUrl(config, { ...n, slug: `${n.slug}-${i++}` });
      }
      seenUrl.set(url, n.relPath);
    }
    n.url = url;
  }

  const byBasename = new Map<string, string[]>();
  const byAlias = new Map<string, string[]>();
  const byTitle = new Map<string, string[]>();
  const bySlug = new Map<string, string[]>();
  const push = (m: Map<string, string[]>, k: string, v: string) => {
    const key = normalizePersian(k.toLowerCase());
    const arr = m.get(key);
    if (arr) arr.push(v);
    else m.set(key, [v]);
  };
  for (const n of notes.values()) {
    push(byBasename, n.basename, n.id);
    for (const a of n.aliases) push(byAlias, a, n.id);
    push(byTitle, n.title, n.id);
    push(bySlug, n.slug, n.id);
  }
  const filesByName = new Map<string, string[]>();
  for (const rel of files.keys()) push(filesByName, path.posix.basename(rel), rel);

  /** Prefer the candidate closest to `fromId` (shortest relative path), like Obsidian. */
  const closest = (cands: string[], fromId?: string): string | undefined => {
    if (cands.length <= 1 || !fromId) return cands[0];
    const fromDir = path.posix.dirname(fromId);
    return [...cands].sort((a, b) => {
      const da = path.posix.relative(fromDir, a).split('/').length;
      const db = path.posix.relative(fromDir, b).split('/').length;
      return da - db || a.localeCompare(b);
    })[0];
  };

  const resolveNote = (rawTarget: string, fromId?: string): IndexedNote | undefined => {
    let target = rawTarget.trim().replace(/\\/g, '/').replace(/\.md$/i, '');
    try {
      target = decodeURIComponent(target);
    } catch {}
    if (!target) return fromId ? notes.get(fromId) : undefined;
    // 1. relative path from the source note
    if (fromId && (target.startsWith('./') || target.startsWith('../'))) {
      const rel = path.posix.normalize(path.posix.join(path.posix.dirname(fromId), target));
      if (notes.has(rel)) return notes.get(rel);
    }
    // 2. exact vault path
    const exact = target.replace(/^\//, '');
    if (notes.has(exact)) return notes.get(exact);
    // 3. path suffix match (e.g. "folder/note")
    if (exact.includes('/')) {
      const lower = exact.toLowerCase();
      const cands = [...notes.keys()].filter((k) => k.toLowerCase() === lower || k.toLowerCase().endsWith(`/${lower}`));
      const c = closest(cands, fromId);
      if (c) return notes.get(c);
    }
    // 4. basename (case-insensitive) with shortest-path tie-break
    const key = normalizePersian(path.posix.basename(exact).toLowerCase());
    const b = closest(byBasename.get(key) ?? [], fromId);
    if (b) return notes.get(b);
    // 5. alias
    const a = closest(byAlias.get(normalizePersian(exact.toLowerCase())) ?? [], fromId);
    if (a) return notes.get(a);
    // 6. PaperWhite extensions: note title, then slug (helps imported vaults with slugged filenames)
    const t = closest(byTitle.get(normalizePersian(exact.toLowerCase())) ?? [], fromId);
    if (t) return notes.get(t);
    const s = closest(bySlug.get(slugify(exact)) ?? [], fromId);
    if (s) return notes.get(s);
    return undefined;
  };

  const resolveFile = (rawTarget: string, fromId?: string): string | undefined => {
    let target = rawTarget.trim().replace(/\\/g, '/');
    try {
      target = decodeURIComponent(target);
    } catch {}
    if (/^[a-z]+:\/\//i.test(target)) return undefined;
    if (fromId && !target.startsWith('/')) {
      const rel = path.posix.normalize(path.posix.join(path.posix.dirname(fromId), target));
      if (files.has(rel)) return files.get(rel);
    }
    const exact = target.replace(/^\//, '');
    if (files.has(exact)) return files.get(exact);
    const att = `${config.dirs.attachments}/${exact}`;
    if (files.has(att)) return files.get(att);
    const name = normalizePersian(path.posix.basename(exact).toLowerCase());
    const c = closest(filesByName.get(name) ?? [], fromId);
    if (c) return files.get(c);
    // `.excalidraw` embeds may point at `.excalidraw.md`
    if (extOf(exact) === 'excalidraw') return resolveFile(`${exact}.md`, fromId);
    return undefined;
  };

  return { config, notes, files, byBasename, byAlias, filesByName, resolveNote, resolveFile, warnings };
}
