import { unified, type Processor, type PluggableList } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeCallouts from 'rehype-callouts';
import { visit } from 'unist-util-visit';
import rehypeKatex, { type Options as KatexOptions } from 'rehype-katex';
import rehypeShiki, { type RehypeShikiOptions } from '@shikijs/rehype';
import { bundledLanguages, type BundledLanguage, type BundledTheme } from 'shiki';
import { transformerMetaHighlight, transformerNotationHighlight, transformerNotationDiff, transformerNotationFocus } from '@shikijs/transformers';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeStringify from 'rehype-stringify';
import { VFile } from 'vfile';
import type { ResolvedConfig } from '../config.ts';
import type { RenderContext } from './context.ts';
import { remarkWikilinks } from './plugins/wikilinks.ts';
import { remarkHighlight } from './plugins/highlight.ts';
import { remarkBlockIds } from './plugins/block-ids.ts';
import { remarkInlineTags } from './plugins/inline-tags.ts';
import { remarkInlineFootnotes } from './plugins/inline-footnotes.ts';
import { remarkFaq } from './plugins/faq.ts';
import { remarkQuery } from './plugins/query.ts';
import { remarkPluginFences } from './plugins/fences.ts';
import { remarkHeadings } from './plugins/headings.ts';
import { rehypeCodeFigure, shikiMetaTitle } from './plugins/code.ts';
import { rehypeImages } from './plugins/images.ts';
import { rehypeBidi } from './plugins/bidi.ts';
import { rehypeLinks } from './plugins/links.ts';
import { rehypeCollect, headingNeedsAnchor } from './plugins/collect.ts';

export type { RenderContext } from './context.ts';

type AnyProcessor = Processor<any, any, any, any, any>;

function asPluggables(list: unknown[]): PluggableList {
  return list as PluggableList;
}

/** rehype-raw drops `node.data`; carry code-fence meta (`title="…" {1,3}`) through as a property Shiki reads. */
function rehypeKeepCodeMeta() {
  return (tree: import('hast').Root) => {
    visit(tree, 'element', (node) => {
      const meta = (node.data as { meta?: string } | undefined)?.meta;
      if (node.tagName === 'code' && meta) node.properties = { ...node.properties, metastring: meta };
    });
  };
}

const NOTE_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';

/** Custom callout types (unknown to the Obsidian theme) render like Obsidian does: default style, type name as title. */
const OBSIDIAN_TYPES = new Set(
  'note abstract summary tldr info todo tip hint important success check done question help faq warning caution attention failure fail missing danger error bug example quote cite'.split(' '),
);

function customCallouts(types: string[]): Record<string, { title: string; indicator: string }> {
  const out: Record<string, { title: string; indicator: string }> = {};
  for (const t of types) if (!OBSIDIAN_TYPES.has(t)) out[t] = { title: t.charAt(0).toUpperCase() + t.slice(1).replace(/[-_]/g, ' '), indicator: NOTE_ICON };
  return out;
}

/** Build the unified processor for notes. One instance per (config, math) pair is reused across notes. */
export function createProcessor(config: ResolvedConfig, opts: { math: boolean; calloutTypes?: string[]; codeLangs?: string[] }): AnyProcessor {
  const pluginRemark = config.plugins.flatMap((p) => p.remarkPlugins ?? []);
  const pluginRehype = config.plugins.flatMap((p) => p.rehypePlugins ?? []);
  let p: AnyProcessor = unified().use(remarkParse).use(remarkGfm, { singleTilde: false }) as AnyProcessor;
  if (opts.math) p = p.use(remarkMath);
  p = p
    .use(remarkHeadings)
    .use(remarkPluginFences)
    .use(remarkQuery)
    .use(remarkFaq)
    .use(remarkWikilinks)
    .use(remarkInlineFootnotes)
    .use(remarkHighlight)
    .use(remarkBlockIds)
    .use(remarkInlineTags)
    .use(asPluggables(pluginRemark))
    .use(asPluggables(config.markdown.remarkPlugins))
    .use(remarkRehype, { allowDangerousHtml: true, footnoteLabel: 'Footnotes' })
    .use(rehypeKeepCodeMeta)
    .use(rehypeRaw)
    .use(rehypeCallouts, { theme: 'obsidian', callouts: customCallouts(opts.calloutTypes ?? []) }) as AnyProcessor;
  // rehype-katex renders errors inline itself (throwOnError is managed by the plugin)
  const katexOptions: KatexOptions = { output: 'htmlAndMathml', strict: 'ignore' };
  if (opts.math) p = p.use([[rehypeKatex, katexOptions]] as PluggableList);
  const shikiOptions: RehypeShikiOptions = {
      themes: config.markdown.shikiThemes as Record<'light' | 'dark', BundledTheme>,
      defaultColor: false,
      // Without an explicit list @shikijs/rehype loads every bundled grammar (~2.5 s startup).
      langs: (opts.codeLangs ?? []).filter((l): l is BundledLanguage => l in bundledLanguages),
      lazy: true,
      fallbackLanguage: 'text',
      addLanguageClass: false,
      transformers: [
        shikiMetaTitle() as never,
        transformerMetaHighlight(),
        transformerNotationHighlight(),
        transformerNotationDiff(),
        transformerNotationFocus(),
      ],
  };
  p = p
    .use([[rehypeShiki, shikiOptions]] as PluggableList)
    .use(rehypeCodeFigure)
    .use(rehypeSlug)
    .use(rehypeAutolinkHeadings, {
      behavior: 'append',
      test: headingNeedsAnchor,
      properties: { className: ['heading-anchor'], ariaHidden: 'true', tabIndex: -1, dataPagefindIgnore: '' },
      content: { type: 'text', value: '#' },
    })
    .use(rehypeImages)
    .use(rehypeLinks)
    .use(asPluggables(pluginRehype))
    .use(asPluggables(config.markdown.rehypePlugins))
    .use(rehypeBidi)
    .use(rehypeCollect)
    .use(rehypeStringify, { allowDangerousHtml: true }) as AnyProcessor;
  return p;
}

export interface RenderResult {
  html: string;
}

export async function renderWithContext(processor: AnyProcessor, markdown: string, ctx: RenderContext): Promise<RenderResult> {
  const file = new VFile({ value: markdown, path: ctx.note.absPath, data: { pw: ctx } });
  const out = await processor.process(file);
  return { html: String(out.value) };
}
