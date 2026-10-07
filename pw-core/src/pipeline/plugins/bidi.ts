import type { Root, Element, Text } from 'hast';
import type { VFile } from 'vfile';
import { visit, SKIP } from 'unist-util-visit';
import { ctxOf } from '../context.ts';
import { persianTypography, hasLatin } from '../../i18n/persian.ts';
import { buildStrings } from '../../i18n/strings.ts';

const BLOCKS = new Set(['p', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'td', 'th', 'dd', 'dt', 'figcaption', 'summary']);
const SKIP_TAGS = new Set(['code', 'pre', 'kbd', 'samp', 'script', 'style', 'math', 'svg']);

/**
 * Mixed-direction text:
 * - block elements get dir="auto" so a Latin-first paragraph inside an RTL page lays out correctly
 * - code is always LTR
 * - in RTL notes, Latin-script links are wrapped in <bdi>
 * - Persian typography helpers on text nodes (outside code) for locales that enable them
 */
export function rehypeBidi() {
  return (tree: Root, file: VFile) => {
    const ctx = ctxOf(file);
    const rtl = ctx.note.dir === 'rtl';
    const locale = ctx.config.locales.supported[ctx.note.lang];
    const typography = locale?.typography ?? false;
    visit(tree, 'element', (node: Element) => {
      if (node.properties?.id === 'footnote-label') {
        const label = buildStrings(ctx.note.lang, {}, ctx.config.i18n)['post.footnotes'] ?? 'Footnotes';
        node.children = [{ type: 'text', value: label }];
      }
      if (SKIP_TAGS.has(node.tagName)) {
        if (node.tagName === 'code' || node.tagName === 'pre') node.properties = { ...node.properties, dir: 'ltr' };
        return SKIP;
      }
      if (BLOCKS.has(node.tagName) && !node.properties?.dir) node.properties = { ...node.properties, dir: 'auto' };
      if (rtl && node.tagName === 'a') {
        const text = node.children.map((c) => (c.type === 'text' ? c.value : '')).join('');
        if (hasLatin(text)) node.children = [{ type: 'element', tagName: 'bdi', properties: {}, children: node.children }];
      }
    });
    if (typography) {
      const walk = (n: Root | Element) => {
        for (const c of n.children) {
          if (c.type === 'text') (c as Text).value = persianTypography((c as Text).value);
          else if (c.type === 'element' && !SKIP_TAGS.has(c.tagName)) walk(c);
        }
      };
      walk(tree);
    }
  };
}
