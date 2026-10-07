import type { Root, Element } from 'hast';
import type { VFile } from 'vfile';
import { visit, SKIP } from 'unist-util-visit';
import { toString } from 'hast-util-to-string';
import { ctxOf } from '../context.ts';

function hasClass(node: Element, c: string): boolean {
  return ([] as unknown[]).concat(node.properties?.className ?? []).map(String).includes(c);
}

/** Collect headings (for TOC), plain text (for word count, excerpt, llms.txt) and the first paragraph. */
export function rehypeCollect() {
  return (tree: Root, file: VFile) => {
    const ctx = ctxOf(file);
    const texts: string[] = [];
    visit(tree, 'element', (node: Element) => {
      if (hasClass(node, 'pw-embed') || hasClass(node, 'footnotes') || node.tagName === 'style' || node.tagName === 'script') return SKIP;
      if (/^h[2-6]$/.test(node.tagName) && node.properties?.id) {
        const text = toString({ ...node, children: node.children.filter((c) => !(c.type === 'element' && hasClass(c, 'heading-anchor'))) }).trim();
        ctx.headings.push({ depth: Number(node.tagName[1]), slug: String(node.properties.id), text });
      }
      if (node.tagName === 'p' && !ctx.firstParagraph) {
        const t = toString(node).trim();
        if (t.length > 20) ctx.firstParagraph = t;
      }
      if (['p', 'li', 'h2', 'h3', 'h4', 'h5', 'h6', 'td', 'th', 'blockquote', 'pre', 'figcaption', 'dt', 'dd'].includes(node.tagName)) {
        texts.push(toString(node));
        return SKIP;
      }
    });
    // drop whitespace-only runs at the root (e.g. foster-parented table whitespace)
    tree.children = tree.children.filter((c, i, arr) => !(c.type === 'text' && !c.value.trim() && arr[i - 1]?.type === 'text'));
    for (const c of tree.children) if (c.type === 'text' && !c.value.trim()) c.value = '\n';
    ctx.text = texts.join('\n').replace(/[ \t]+/g, ' ').trim();
  };
}

/** Skip autolinking headings that already carry an anchor (transcluded content). */
export function headingNeedsAnchor(el: Element): boolean {
  if (el.properties?.id === 'footnote-label') return false;
  return !el.children.some((c) => c.type === 'element' && hasClass(c, 'heading-anchor'));
}
