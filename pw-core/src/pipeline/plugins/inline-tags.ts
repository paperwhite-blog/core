import type { Root, Text, PhrasingContent } from 'mdast';
import { visit, SKIP } from 'unist-util-visit';
import type { VFile } from 'vfile';
import { ctxOf } from '../context.ts';
import { tagPath, href } from '../../content/vault-index.ts';
import { normalizePersian } from '../../i18n/persian.ts';

const RE = /(^|[\s(,;،])#([\p{L}\p{N}_\-/‌]*[\p{L}_\-/‌][\p{L}\p{N}_\-/‌]*)/gu;

/** Inline `#tags` → tag links (or stripped / kept as text, per config). */
export function remarkInlineTags() {
  return (tree: Root, file: VFile) => {
    const ctx = ctxOf(file);
    const mode = ctx.config.markdown.inlineTags;
    if (mode === 'keep') return;
    visit(tree, 'text', (node: Text, index, parent) => {
      if (!parent || index === undefined || !node.value.includes('#')) return;
      if (parent.type === 'link' || parent.type === 'heading') return;
      const out: PhrasingContent[] = [];
      let last = 0;
      for (const m of node.value.matchAll(RE)) {
        const tag = normalizePersian(m[2]!.replace(/[-/]+$/, ''));
        const start = m.index! + m[1]!.length;
        if (start > last) out.push({ type: 'text', value: node.value.slice(last, start) });
        if (mode === 'link') {
          out.push({
            type: 'link',
            url: href(tagPath(ctx.config, tag, ctx.note.lang)),
            children: [{ type: 'text', value: `#${tag}` }],
            data: { hProperties: { className: ['tag'], rel: ['tag'] } },
          });
        }
        last = start + 1 + m[2]!.length;
      }
      if (!out.length) return;
      if (last < node.value.length) out.push({ type: 'text', value: node.value.slice(last) });
      parent.children.splice(index, 1, ...out);
      return [SKIP, index + out.length];
    });
  };
}
