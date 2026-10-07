import type { Root, Element } from 'hast';
import type { VFile } from 'vfile';
import path from 'node:path';
import { visit } from 'unist-util-visit';
import { ctxOf } from '../context.ts';
import { processImage, largestFromSrcset } from '../../content/images.ts';

/**
 * Optimize local images: <picture> with AVIF/WebP sources, width/height inlined (no CLS),
 * lazy loading, and a no-JS lightbox link to the largest rendition.
 */
export function rehypeImages() {
  return async (tree: Root, file: VFile) => {
    const ctx = ctxOf(file);
    const jobs: { node: Element; index: number; parent: Element | Root }[] = [];
    visit(tree, 'element', (node: Element, index, parent) => {
      if (node.tagName === 'img' && parent && index !== undefined) jobs.push({ node, index, parent: parent as Element });
    });
    let first = !ctx.embedded;
    for (const { node, index, parent } of jobs) {
      const p = node.properties ?? {};
      let abs = p.dataPwSrc as string | undefined;
      const src = String(p.src ?? '');
      if (!abs && src && !/^([a-z]+:)?\/\//i.test(src) && !src.startsWith('data:')) {
        abs = ctx.index.resolveFile(src.replace(/^<|>$/g, ''), ctx.note.id);
        if (!abs) ctx.unresolved.push({ source: ctx.note.relPath, target: src });
      }
      const alt = String(p.alt ?? '');
      const noAlt = 'dataPwNoalt' in p || !alt;
      if (noAlt) ctx.imagesMissingAlt.push(abs ? path.basename(abs) : src);
      delete p.dataPwNoalt;
      if (!abs) {
        p.loading = 'lazy';
        p.decoding = 'async';
        continue;
      }
      try {
        const info = await processImage(abs, ctx.imageOptions);
        ctx.images.push(info.src);
        Object.assign(ctx.assets, info.assets);
        const hintW = p.dataPwWidth ? Number(p.dataPwWidth) : undefined;
        const hintH = p.dataPwHeight ? Number(p.dataPwHeight) : undefined;
        let width = info.width;
        let height = info.height;
        if (hintW && width) {
          height = hintH ?? Math.round((height / width) * hintW);
          width = hintW;
        }
        const sizes = hintW ? `${hintW}px` : '(min-width: 48rem) 46rem, 100vw';
        const img: Element = {
          type: 'element',
          tagName: 'img',
          properties: {
            src: info.src,
            srcSet: info.srcset || undefined,
            sizes: info.srcset ? sizes : undefined,
            alt,
            width: width || undefined,
            height: height || undefined,
            // The first image is a likely LCP candidate: load it eagerly.
            loading: first ? 'eager' : 'lazy',
            fetchPriority: first ? 'high' : undefined,
            decoding: 'async',
          },
          children: [],
        };
        first = false;
        const picture: Element = info.sources.length
          ? {
              type: 'element',
              tagName: 'picture',
              properties: {},
              children: [
                ...info.sources.map(
                  (s): Element => ({ type: 'element', tagName: 'source', properties: { type: s.type, srcSet: s.srcset, sizes }, children: [] }),
                ),
                img,
              ],
            }
          : img;
        const full = largestFromSrcset(info.srcset, info.src);
        const wrapped: Element =
          (parent as Element).tagName === 'a'
            ? picture
            : {
                type: 'element',
                tagName: 'a',
                properties: { href: full, className: ['pw-zoom'], 'data-pw-lightbox': '', 'data-pw-width': info.width, 'data-pw-height': info.height },
                children: [picture],
              };
        parent.children[index] = wrapped;
      } catch (e) {
        ctx.unresolved.push({ source: ctx.note.relPath, target: `${src || abs} (image error: ${(e as Error).message})` });
      }
    }
  };
}
