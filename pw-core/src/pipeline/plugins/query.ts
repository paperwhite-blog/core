import type { Root, Code, List, ListItem } from 'mdast';
import { visit } from 'unist-util-visit';
import type { VFile } from 'vfile';
import { ctxOf } from '../context.ts';
import { href } from '../../content/vault-index.ts';
import { parseDate, formatDate } from '../../i18n/dates.ts';

interface Query {
  tags?: string[];
  folder?: string;
  from?: Date;
  to?: Date;
  lang?: string;
  type?: 'post' | 'page';
  sort: 'date' | 'title';
  order: 'asc' | 'desc';
  limit?: number;
}

export function parseQuery(src: string): Query {
  const q: Query = { sort: 'date', order: 'desc' };
  for (const line of src.split('\n')) {
    const m = /^\s*([a-z]+)\s*:\s*(.+?)\s*$/i.exec(line);
    if (!m) continue;
    const key = m[1]!.toLowerCase();
    const val = m[2]!.replace(/^\[|\]$/g, '');
    if (key === 'tags' || key === 'tag') q.tags = val.split(',').map((s) => s.trim().replace(/^#/, '')).filter(Boolean);
    else if (key === 'folder') q.folder = val.replace(/^\/|\/$/g, '');
    else if (key === 'from') q.from = parseDate(val);
    else if (key === 'to') q.to = parseDate(val);
    else if (key === 'lang') q.lang = val;
    else if (key === 'type') q.type = val as Query['type'];
    else if (key === 'limit') q.limit = Number(val);
    else if (key === 'sort') {
      const [field, order] = val.split(/\s+/);
      q.sort = field === 'title' ? 'title' : 'date';
      if (order === 'asc' || order === 'desc') q.order = order;
    }
  }
  return q;
}

/** Static alternative to Dataview: ```paperwhite:query fences resolved at build time. */
export function remarkQuery() {
  return (tree: Root, file: VFile) => {
    const ctx = ctxOf(file);
    visit(tree, 'code', (node: Code, index, parent) => {
      if (node.lang !== 'paperwhite:query' || !parent || index === undefined) return;
      const q = parseQuery(node.value);
      let notes = [...ctx.index.notes.values()].filter((n) => n.published && n.id !== ctx.note.id);
      if (q.tags?.length) notes = notes.filter((n) => q.tags!.some((t) => n.tags.some((nt) => nt === t || nt.startsWith(`${t}/`))));
      if (q.folder) notes = notes.filter((n) => n.relPath.startsWith(`${q.folder}/`));
      if (q.from) notes = notes.filter((n) => n.date && n.date >= q.from!);
      if (q.to) notes = notes.filter((n) => n.date && n.date <= q.to!);
      if (q.lang) notes = notes.filter((n) => n.lang === q.lang);
      if (q.type) notes = notes.filter((n) => n.type === q.type);
      notes.sort((a, b) =>
        q.sort === 'title' ? a.title.localeCompare(b.title) : (a.date?.getTime() ?? 0) - (b.date?.getTime() ?? 0),
      );
      if (q.order === 'desc') notes.reverse();
      if (q.limit) notes = notes.slice(0, q.limit);
      const locale = ctx.config.locales.supported[ctx.note.lang] ?? ctx.config.locales.supported[ctx.config.locales.default]!;
      for (const n of notes) ctx.outgoing.add(n.id);
      const list: List = {
        type: 'list',
        ordered: false,
        spread: false,
        data: { hProperties: { className: ['pw-query'] } },
        children: notes.map(
          (n): ListItem => ({
            type: 'listItem',
            spread: false,
            children: [
              {
                type: 'paragraph',
                children: [
                  { type: 'link', url: href(n.url), children: [{ type: 'text', value: n.title }], data: { hProperties: { className: ['internal'] } } },
                  ...(n.date
                    ? [{ type: 'html' as const, value: ` <time datetime="${n.date.toISOString()}">${formatDate(n.date, locale, 'medium')}</time>` }]
                    : []),
                ],
              },
            ],
          }),
        ),
      };
      parent.children.splice(index, 1, list);
    });
  };
}
