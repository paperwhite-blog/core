import fs from 'node:fs/promises';
import path from 'node:path';
import { XMLParser } from 'fast-xml-parser';
import { unzipSync, strFromU8 } from 'fflate';
import TurndownService from 'turndown';
// @ts-expect-error no types
import { gfm } from 'turndown-plugin-gfm';
import { slugify } from '../../i18n/index.ts';

export interface WxrComment {
  id: number;
  parent: number;
  author: string;
  url?: string;
  date: string;
  content: string;
}

export interface WxrItem {
  id: number;
  type: 'post' | 'page' | 'attachment' | string;
  status: string;
  title: string;
  slug: string;
  link: string;
  date?: string;
  modified?: string;
  author?: string;
  excerpt?: string;
  html: string;
  tags: string[];
  categories: string[];
  attachmentUrl?: string;
  parent?: number;
  comments: WxrComment[];
  meta: Record<string, string>;
}

export interface WxrSite {
  title: string;
  link: string;
  language?: string;
  items: WxrItem[];
}

const arr = <T>(v: T | T[] | undefined): T[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
const text = (v: unknown): string => (v == null ? '' : typeof v === 'object' && '#text' in (v as object) ? String((v as { '#text': unknown })['#text']) : String(v));

export async function readWxr(file: string): Promise<string> {
  const buf = await fs.readFile(file);
  if (file.endsWith('.zip')) {
    const files = unzipSync(new Uint8Array(buf));
    const xml = Object.keys(files).find((f) => f.endsWith('.xml'));
    if (!xml) throw new Error(`No .xml export found inside ${file}`);
    return strFromU8(files[xml]!);
  }
  return buf.toString('utf8');
}

export function parseWxr(xml: string): WxrSite {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@', cdataPropName: false, parseTagValue: false, trimValues: false });
  const doc = parser.parse(xml) as { rss: { channel: Record<string, unknown> } };
  const ch = doc.rss.channel;
  const items = arr(ch.item as Record<string, unknown>[]).map((it): WxrItem => {
    const cats = arr(it.category as unknown[]).map((c) => ({ domain: (c as Record<string, string>)['@domain'], name: text(c).trim() }));
    const meta: Record<string, string> = {};
    for (const m of arr(it['wp:postmeta'] as Record<string, unknown>[])) meta[text(m['wp:meta_key'])] = text(m['wp:meta_value']);
    return {
      id: Number(text(it['wp:post_id'])),
      type: text(it['wp:post_type']),
      status: text(it['wp:status']),
      title: text(it.title).trim(),
      slug: decodeURIComponentSafe(text(it['wp:post_name'])),
      link: text(it.link),
      date: text(it['wp:post_date_gmt']) || text(it['wp:post_date']) || undefined,
      modified: text(it['wp:post_modified_gmt']) || undefined,
      author: text(it['dc:creator']) || undefined,
      excerpt: text(it['excerpt:encoded']).trim() || undefined,
      html: text(it['content:encoded']),
      tags: cats.filter((c) => c.domain === 'post_tag').map((c) => c.name),
      categories: cats.filter((c) => c.domain === 'category' && c.name !== 'Uncategorized').map((c) => c.name),
      attachmentUrl: text(it['wp:attachment_url']) || undefined,
      parent: Number(text(it['wp:post_parent'])) || undefined,
      comments: arr(it['wp:comment'] as Record<string, unknown>[])
        .filter((c) => text(c['wp:comment_approved']) === '1' && !['pingback', 'trackback'].includes(text(c['wp:comment_type'])))
        .map((c) => ({
          id: Number(text(c['wp:comment_id'])),
          parent: Number(text(c['wp:comment_parent'])) || 0,
          author: text(c['wp:comment_author']),
          url: text(c['wp:comment_author_url']) || undefined,
          date: toIso(text(c['wp:comment_date_gmt']) || text(c['wp:comment_date'])) ?? '',
          content: text(c['wp:comment_content']),
        })),
      meta,
    };
  });
  return { title: text(ch.title), link: text(ch.link), language: text(ch.language) || undefined, items };
}

function decodeURIComponentSafe(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function toIso(wp: string): string | undefined {
  if (!wp || wp.startsWith('0000')) return undefined;
  return `${wp.replace(' ', 'T')}Z`;
}

/** WordPress HTML → Obsidian-flavoured Markdown. */
export function htmlToMarkdown(html: string, rewriteSrc: (src: string) => string | undefined = () => undefined): string {
  const td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced', bulletListMarker: '-', emDelimiter: '*' });
  td.use(gfm);
  td.addRule('wpImage', {
    filter: 'img',
    replacement: (_c, node) => {
      const el = node as HTMLElement;
      const src = el.getAttribute('src') ?? '';
      const alt = el.getAttribute('alt') ?? '';
      const local = rewriteSrc(src);
      if (local) return `![[${local}${alt ? `|${alt}` : ''}]]`;
      return `![${alt}](${src})`;
    },
  });
  td.addRule('wpPreCode', {
    filter: (node) => node.nodeName === 'PRE',
    replacement: (_c, node) => {
      const el = node as HTMLElement;
      const classes = `${el.getAttribute('class') ?? ''} ${el.firstElementChild?.getAttribute('class') ?? ''}`;
      const lang = /(?:lang(?:uage)?-|brush:\s*)(\w+)/.exec(classes)?.[1] ?? '';
      return `\n\n\`\`\`${lang}\n${el.textContent?.replace(/\n$/, '') ?? ''}\n\`\`\`\n\n`;
    },
  });
  const cleaned = html
    .replace(/<!--\s*\/?wp:[\s\S]*?-->/g, '')
    .replace(/\[caption[^\]]*\]([\s\S]*?)\[\/caption\]/g, '$1')
    .replace(/\[(\/?)(gallery|embed|audio|video)[^\]]*\]/g, '')
    // WordPress autop: blank-line separated text without <p>
    .split(/\n{2,}/)
    .map((block) => (/^\s*<(p|div|h\d|ul|ol|pre|blockquote|figure|table|hr)/i.test(block) || !block.trim() ? block : `<p>${block.replace(/\n/g, '<br>')}</p>`))
    .join('\n\n');
  return td.turndown(cleaned).replace(/\n{3,}/g, '\n\n').trim();
}

export interface ImportOptions {
  outDir: string;
  /** download attachments into attachments/ */
  download?: boolean;
  /** include drafts as `draft: true` */
  drafts?: boolean;
  lang?: string;
  fetchImpl?: typeof fetch;
}

export interface ImportReport {
  posts: number;
  pages: number;
  comments: number;
  attachments: number;
  skipped: number;
  files: string[];
}

const yaml = (v: string) => (/^[\w./-]+$/.test(v) && !/^(true|false|null|yes|no|\d+)$/i.test(v) ? v : JSON.stringify(v));

function oldPath(link: string): string | undefined {
  try {
    const u = new URL(link);
    return decodeURIComponentSafe(u.pathname + u.search);
  } catch {
    return undefined;
  }
}

export async function importWxr(site: WxrSite, opts: ImportOptions): Promise<ImportReport> {
  const report: ImportReport = { posts: 0, pages: 0, comments: 0, attachments: 0, skipped: 0, files: [] };
  const write = async (rel: string, content: string | Uint8Array) => {
    const file = path.join(opts.outDir, rel);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, content);
    report.files.push(rel);
  };
  // attachments: map remote URL (and resized variants) → local filename
  const attachments = new Map<string, string>();
  for (const a of site.items.filter((i) => i.type === 'attachment' && i.attachmentUrl)) {
    const name = decodeURIComponentSafe(path.basename(new URL(a.attachmentUrl!).pathname));
    attachments.set(a.attachmentUrl!, name);
  }
  const baseOf = (u: string) => u.replace(/-\d+x\d+(\.\w+)$/, '$1').split('?')[0]!;
  const rewrite = (src: string) => (opts.download ? (attachments.get(src) ?? attachments.get(baseOf(src))) : undefined);
  if (opts.download) {
    const f = opts.fetchImpl ?? fetch;
    for (const [url, name] of attachments) {
      try {
        const res = await f(url);
        if (!res.ok) throw new Error(String(res.status));
        await write(`attachments/${name}`, new Uint8Array(await res.arrayBuffer()));
        report.attachments++;
      } catch {
        attachments.delete(url);
      }
    }
  }
  const usedSlugs = new Set<string>();
  for (const it of site.items) {
    if (it.type !== 'post' && it.type !== 'page') continue;
    const draft = it.status !== 'publish';
    if (draft && !opts.drafts) {
      report.skipped++;
      continue;
    }
    if (it.status === 'trash' || it.status === 'auto-draft' || it.status === 'inherit') {
      report.skipped++;
      continue;
    }
    let slug = slugify(it.slug || it.title) || String(it.id);
    while (usedSlugs.has(`${it.type}:${slug}`)) slug = `${slug}-${it.id}`;
    usedSlugs.add(`${it.type}:${slug}`);
    const body = htmlToMarkdown(it.html, rewrite);
    const redirectFrom = [`/?p=${it.id}`];
    const old = oldPath(it.link);
    if (old && old !== `/${slug}/` && !old.startsWith('/?p=')) redirectFrom.push(old);
    const fm: string[] = ['---', `title: ${JSON.stringify(it.title || slug)}`];
    if (it.type === 'post' && it.date) fm.push(`date: ${toIso(it.date) ?? it.date}`);
    if (it.modified && toIso(it.modified) !== toIso(it.date ?? '')) fm.push(`updated: ${toIso(it.modified)}`);
    fm.push(`slug: ${yaml(slug)}`);
    if (it.excerpt) fm.push(`description: ${JSON.stringify(htmlToMarkdown(it.excerpt).replace(/\s+/g, ' '))}`);
    if (it.author) fm.push(`author: ${yaml(it.author)}`);
    if (it.tags.length) fm.push(`tags: [${it.tags.map(yaml).join(', ')}]`);
    if (it.categories.length) fm.push(`categories: [${it.categories.map(yaml).join(', ')}]`);
    if (opts.lang) fm.push(`lang: ${opts.lang}`);
    const thumb = it.meta._thumbnail_id ? site.items.find((x) => x.id === Number(it.meta._thumbnail_id))?.attachmentUrl : undefined;
    if (thumb) {
      const local = rewrite(thumb);
      fm.push(`cover: ${JSON.stringify(local ? `[[${local}]]` : thumb)}`);
    }
    if (draft) fm.push('draft: true');
    fm.push('redirect_from:', ...redirectFrom.map((r) => `  - ${JSON.stringify(r)}`));
    if (it.comments.length) fm.push(`comments: comments/${slug}.json`);
    fm.push('---', '');
    await write(`${it.type === 'post' ? 'posts' : 'pages'}/${slug}.md`, `${fm.join('\n')}\n${body}\n`);
    if (it.type === 'post') report.posts++;
    else report.pages++;
    if (it.comments.length) {
      await write(
        `comments/${slug}.json`,
        `${JSON.stringify(
          it.comments.map((c) => ({ id: c.id, parent: c.parent || null, author: c.author, url: c.url, date: c.date, html: c.content.includes('<') ? c.content : `<p>${c.content.replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>')}</p>` })),
          null,
          2,
        )}\n`,
      );
      report.comments += it.comments.length;
    }
  }
  return report;
}
