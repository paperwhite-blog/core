import type { Root, Paragraph, Parent, Text } from 'mdast';
import { visit } from 'unist-util-visit';

const TRAIL = /\s*\^([A-Za-z0-9-]+)\s*$/;

/** `^block-id` anchors: assigned as element ids and removed from visible text. */
export function remarkBlockIds() {
  return (tree: Root) => {
    visit(tree, 'paragraph', (node: Paragraph, index, parent: Parent | undefined) => {
      const last = node.children[node.children.length - 1];
      if (!last || last.type !== 'text') return;
      const m = TRAIL.exec(last.value);
      if (!m) return;
      const id = `^${m[1]}`;
      const standalone = node.children.length === 1 && last.value.trim() === `^${m[1]}`;
      if (standalone && parent && index !== undefined && index > 0) {
        // `^id` on its own line applies to the previous block (table, list, quote…)
        const prev = parent.children[index - 1]!;
        prev.data = { ...prev.data, hProperties: { ...(prev.data as { hProperties?: object })?.hProperties, id } } as never;
        parent.children.splice(index, 1);
        return index;
      }
      (last as Text).value = last.value.replace(TRAIL, '');
      const holder = parent?.type === 'listItem' ? parent : node;
      holder.data = { ...holder.data, hProperties: { ...(holder.data as { hProperties?: object })?.hProperties, id } } as never;
    });
  };
}
