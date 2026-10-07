import type { Root, Blockquote, Paragraph } from 'mdast';
import { visit } from 'unist-util-visit';
import { toString } from 'mdast-util-to-string';
import type { VFile } from 'vfile';
import { ctxOf } from '../context.ts';

/** Collect `> [!faq] Question` callouts for FAQPage JSON-LD. Rendering is left to rehype-callouts. */
export function remarkFaq() {
  return (tree: Root, file: VFile) => {
    const ctx = ctxOf(file);
    if (ctx.embedded) return;
    visit(tree, 'blockquote', (node: Blockquote) => {
      const first = node.children[0] as Paragraph | undefined;
      if (!first || first.type !== 'paragraph') return;
      const text = toString(first);
      const m = /^\[!(faq|question)\][+-]?\s*([^\n]*)/i.exec(text);
      if (!m) return;
      const question = m[2]!.trim();
      // answer: rest of the first paragraph after the title line + following blocks
      const restFirst = text.split('\n').slice(1).join('\n');
      const rest = node.children.slice(1).map((c) => toString(c)).join('\n');
      const answer = [restFirst, rest].filter(Boolean).join('\n').trim();
      if (question && answer) ctx.faq.push({ question, answerText: answer, answerHtml: answer });
    });
  };
}
