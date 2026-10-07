import type { Root, Element } from 'hast';
import { visit } from 'unist-util-visit';
import type { VFile } from 'vfile';
import { ctxOf } from '../context.ts';

/** External links get rel="noopener" + class; internal absolute URLs to our own site are relativized. */
export function rehypeLinks() {
  return (tree: Root, file: VFile) => {
    const ctx = ctxOf(file);
    const site = ctx.config.site.url;
    visit(tree, 'element', (node: Element) => {
      if (node.tagName !== 'a') return;
      const href = String(node.properties?.href ?? '');
      if (href.startsWith(site + '/')) {
        node.properties!.href = href.slice(site.length);
        return;
      }
      if (/^https?:\/\//i.test(href)) {
        const cls = ([] as unknown[]).concat(node.properties?.className ?? []).map(String);
        node.properties = { ...node.properties, rel: ['noopener'], className: [...cls, 'external'] };
      }
    });
  };
}

/** For user-generated HTML (comments): every link gets rel="nofollow ugc noopener". */
export function rehypeUgcLinks() {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element) => {
      if (node.tagName === 'a') node.properties = { ...node.properties, rel: ['nofollow', 'ugc', 'noopener'] };
    });
  };
}
