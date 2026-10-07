import type { Root, Parent, PhrasingContent } from 'mdast';
import { visit } from 'unist-util-visit';

const MARK = Symbol('mark');
type Tok = PhrasingContent | typeof MARK;

/** Obsidian `==highlight==` → <mark>. Delimiters may span sibling nodes (e.g. `==**bold**==`). */
export function remarkHighlight() {
  return (tree: Root) => {
    visit(tree, (node) => {
      const parent = node as Parent;
      if (!Array.isArray(parent.children) || parent.type === 'code' || parent.type === 'inlineCode') return;
      if (!parent.children.some((c) => c.type === 'text' && c.value.includes('=='))) return;
      const toks: Tok[] = [];
      for (const c of parent.children as PhrasingContent[]) {
        if (c.type !== 'text' || !c.value.includes('==')) {
          toks.push(c);
          continue;
        }
        const parts = c.value.split('==');
        parts.forEach((part, i) => {
          if (i > 0) toks.push(MARK);
          if (part) toks.push({ type: 'text', value: part });
        });
      }
      const out: PhrasingContent[] = [];
      let open: PhrasingContent[] | null = null;
      for (const t of toks) {
        if (t === MARK) {
          if (open) {
            if (open.length) out.push({ type: 'mark', children: open, data: { hName: 'mark' } } as unknown as PhrasingContent);
            else out.push({ type: 'text', value: '====' });
            open = null;
          } else open = [];
        } else (open ?? out).push(t);
      }
      if (open) out.push({ type: 'text', value: '==' }, ...open);
      // merge adjacent text nodes
      const merged: PhrasingContent[] = [];
      for (const n of out) {
        const prev = merged[merged.length - 1];
        if (prev?.type === 'text' && n.type === 'text') prev.value += n.value;
        else merged.push(n);
      }
      parent.children = merged as Parent['children'];
    });
  };
}
