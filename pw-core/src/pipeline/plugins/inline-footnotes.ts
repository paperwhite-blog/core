import type { Root, Text, PhrasingContent, FootnoteDefinition } from 'mdast';
import { visit, SKIP } from 'unist-util-visit';
import { unified } from 'unified';
import remarkParse from 'remark-parse';

/** Obsidian inline footnotes `^[note text]` → GFM footnotes. */
export function remarkInlineFootnotes() {
  return (tree: Root) => {
    const defs: FootnoteDefinition[] = [];
    let n = 0;
    visit(tree, 'text', (node: Text, index, parent) => {
      if (!parent || index === undefined || !node.value.includes('^[')) return;
      const out: PhrasingContent[] = [];
      let last = 0;
      for (const m of node.value.matchAll(/\^\[([^\]]+)\]/g)) {
        if (m.index! > last) out.push({ type: 'text', value: node.value.slice(last, m.index) });
        const id = `inline-${++n}`;
        out.push({ type: 'footnoteReference', identifier: id, label: id });
        const parsed = unified().use(remarkParse).parse(m[1]!);
        const para = parsed.children[0];
        defs.push({
          type: 'footnoteDefinition',
          identifier: id,
          label: id,
          children: [para && para.type === 'paragraph' ? para : { type: 'paragraph', children: [{ type: 'text', value: m[1]! }] }],
        });
        last = m.index! + m[0].length;
      }
      if (!out.length) return;
      if (last < node.value.length) out.push({ type: 'text', value: node.value.slice(last) });
      parent.children.splice(index, 1, ...out);
      return [SKIP, index + out.length];
    });
    tree.children.push(...defs);
  };
}
