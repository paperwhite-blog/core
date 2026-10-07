import type { Root, Code } from 'mdast';
import type { VFile } from 'vfile';
import { visit } from 'unist-util-visit';
import { ctxOf } from '../context.ts';

/** Let plugins (e.g. mermaid) render fenced blocks to HTML at build time. */
export function remarkPluginFences() {
  return async (tree: Root, file: VFile) => {
    const ctx = ctxOf(file);
    const handlers = new Map<string, NonNullable<(typeof ctx.plugins)[number]['fences']>[string]>();
    for (const p of ctx.plugins) for (const [lang, h] of Object.entries(p.fences ?? {})) handlers.set(lang, h);
    if (!handlers.size) return;
    const jobs: { node: Code; index: number; parent: { children: unknown[] } }[] = [];
    visit(tree, 'code', (node: Code, index, parent) => {
      if (node.lang && handlers.has(node.lang) && parent && index !== undefined) jobs.push({ node, index, parent });
    });
    for (const { node, index, parent } of jobs.reverse()) {
      const html = await handlers.get(node.lang!)!(node.value, node.meta ?? null);
      if (html != null) parent.children.splice(index, 1, { type: 'html', value: html });
    }
  };
}
