import type { Root, Heading, RootContent } from 'mdast';
import type { VFile } from 'vfile';
import { toString } from 'mdast-util-to-string';
import { slug as githubSlug } from 'github-slugger';
import { ctxOf } from '../context.ts';

/**
 * - For `![[note#section]]` transclusion, slice the tree to that heading section or ^block.
 * - Remove a leading H1 that duplicates the title (layouts render the title as the page H1).
 * - Demote headings when the body still contains an H1 so the page keeps a single H1.
 */
export function remarkHeadings() {
  return (tree: Root, file: VFile) => {
    const ctx = ctxOf(file);
    if (ctx.section) {
      tree.children = sliceSection(tree.children, ctx.section);
      if (tree.children[0]?.type === 'heading') tree.children.shift();
    } else if (ctx.embedded && ctx.config.markdown.transclusion === 'first-section') {
      const i = tree.children.findIndex((c, idx) => idx > 0 && c.type === 'heading');
      if (i > 0) tree.children = tree.children.slice(0, i);
    }
    const first = tree.children.find((c) => c.type !== 'yaml' && c.type !== 'html');
    if (first?.type === 'heading' && first.depth === 1) {
      const text = toString(first).trim();
      if (ctx.note.titleFromH1 || text === ctx.note.title || ctx.embedded) {
        tree.children.splice(tree.children.indexOf(first), 1);
      }
    }
    if (ctx.config.markdown.demoteHeadings && !ctx.embedded) {
      const hasH1 = tree.children.some((c) => c.type === 'heading' && c.depth === 1);
      if (hasH1) {
        const walk = (nodes: RootContent[]) => {
          for (const n of nodes) {
            if (n.type === 'heading') n.depth = Math.min(6, n.depth + 1) as Heading['depth'];
            if ('children' in n && Array.isArray(n.children)) walk(n.children as RootContent[]);
          }
        };
        walk(tree.children);
      }
    }
    if (ctx.embedded) {
      // embedded headings sit below the embed title
      const walk = (nodes: RootContent[]) => {
        for (const n of nodes) {
          if (n.type === 'heading') n.depth = Math.min(6, Math.max(3, n.depth + 1)) as Heading['depth'];
          if ('children' in n && Array.isArray(n.children)) walk(n.children as RootContent[]);
        }
      };
      walk(tree.children);
    }
  };
}

export function sliceSection(nodes: RootContent[], section: string): RootContent[] {
  if (section.startsWith('^')) {
    const id = section.slice(1);
    const re = new RegExp(`\\^${id.replace(/[-]/g, '\\-')}\\s*$`);
    const find = (list: RootContent[]): RootContent[] | null => {
      for (let i = 0; i < list.length; i++) {
        const n = list[i]!;
        const text = toString(n);
        if (n.type === 'paragraph' && text.trim() === `^${id}` && i > 0) return [list[i - 1]!];
        if ((n.type === 'paragraph' || n.type === 'heading') && re.test(text)) return [n];
        if (n.type === 'list' || n.type === 'blockquote' || n.type === 'listItem') {
          for (const c of (n as { children: RootContent[] }).children) {
            if (c.type === 'listItem' && re.test(toString(c.children[0] ?? c))) return [{ ...(n as object), children: [c] } as RootContent];
          }
          const inner = find((n as { children: RootContent[] }).children);
          if (inner) return inner;
        }
      }
      return null;
    };
    return find(nodes) ?? [];
  }
  const want = section.split('#').pop()!.trim();
  const wantSlug = githubSlug(want);
  const start = nodes.findIndex((n) => n.type === 'heading' && (toString(n).trim() === want || githubSlug(toString(n)) === wantSlug));
  if (start < 0) return [];
  const depth = (nodes[start] as Heading).depth;
  let end = nodes.length;
  for (let i = start + 1; i < nodes.length; i++) {
    const n = nodes[i]!;
    if (n.type === 'heading' && n.depth <= depth) {
      end = i;
      break;
    }
  }
  return nodes.slice(start, end);
}
