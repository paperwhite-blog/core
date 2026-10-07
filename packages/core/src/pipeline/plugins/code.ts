import type { Root, Element, ElementContent } from 'hast';
import { visit, SKIP } from 'unist-util-visit';
import type { VFile } from 'vfile';

/** Parse `title="file.ts"` / `file=...` and `{1,3-5}` from a fence meta string. */
export function parseCodeMeta(meta: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of meta.matchAll(/(\w+)=(?:"([^"]*)"|'([^']*)'|(\S+))/g)) out[m[1]!] = m[2] ?? m[3] ?? m[4] ?? '';
  return out;
}

/**
 * Wrap Shiki output in <figure class="pw-code"> with an optional file-name label
 * and a copy button (hidden until the copy island enables it — no-JS safe).
 */
export function rehypeCodeFigure() {
  return (tree: Root, _file: VFile) => {
    visit(tree, 'element', (node: Element, index, parent) => {
      if (node.tagName !== 'pre' || !parent || index === undefined) return;
      if ((parent as Element).tagName === 'figure') return;
      const raw = node.properties?.className ?? node.properties?.class ?? [];
      const cls = (Array.isArray(raw) ? raw : String(raw).split(/\s+/)).map(String);
      if (!cls.includes('shiki')) return;
      const title = (node.properties?.dataTitle as string | undefined) ?? undefined;
      const lang = (node.properties?.dataLanguage as string | undefined) ?? '';
      node.properties = { ...node.properties, dir: 'ltr' };
      const children: ElementContent[] = [];
      if (title) {
        children.push({ type: 'element', tagName: 'figcaption', properties: { className: ['pw-code-title'], dir: 'ltr' }, children: [{ type: 'text', value: title }] });
      }
      children.push({
        type: 'element',
        tagName: 'button',
        properties: { type: 'button', className: ['pw-copy'], hidden: true, 'data-pw-copy': '', ariaLabel: 'Copy code' },
        children: [{ type: 'text', value: 'Copy' }],
      });
      children.push(node);
      const figure: Element = {
        type: 'element',
        tagName: 'figure',
        properties: { className: ['pw-code'], 'data-lang': lang || undefined },
        children,
      };
      parent.children[index] = figure;
      return SKIP;
    });
  };
}

/** Shiki transformer: carry `title="…"` from the meta string onto <pre data-title>. */
export function shikiMetaTitle() {
  return {
    name: 'paperwhite:meta-title',
    pre(this: { options: { meta?: { __raw?: string } } }, node: Element) {
      const raw = this.options.meta?.__raw ?? '';
      const meta = parseCodeMeta(raw);
      const title = meta.title ?? meta.file ?? meta.filename;
      if (title) node.properties = { ...node.properties, dataTitle: title };
      const lang = (this.options as { lang?: string }).lang;
      if (lang) node.properties = { ...node.properties, dataLanguage: lang };
    },
  };
}
