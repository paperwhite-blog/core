import type { Root, Text, PhrasingContent, RootContent, Parent, Link } from 'mdast';
import type { VFile } from 'vfile';
import { visit, SKIP } from 'unist-util-visit';
import { slug as githubSlug } from 'github-slugger';
import { ctxOf, type RenderContext } from '../context.ts';
import { WIKILINK_RE, parseWikilink, extOf, IMAGE_EXT, AUDIO_EXT, VIDEO_EXT, type ParsedWikilink } from '../../content/text.ts';
import { attachmentUrl } from '../../content/assets.ts';
import { href } from '../../content/vault-index.ts';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function anchorHash(anchor: string | undefined): string {
  if (!anchor) return '';
  if (anchor.startsWith('^')) return `#${encodeURIComponent(anchor)}`;
  // `[[Note#H1#H2]]` → last heading wins
  const last = anchor.split('#').pop()!;
  return `#${encodeURIComponent(githubSlug(last))}`;
}

function displayText(l: ParsedWikilink): string {
  if (l.alias) return l.alias;
  if (l.anchor) return l.target ? `${l.target} › ${l.anchor.replace(/^\^/, '')}` : l.anchor.replace(/^\^/, '');
  return l.target;
}

function unresolvedNode(text: string, title: string): PhrasingContent {
  return { type: 'html', value: `<span class="unresolved" title="${esc(title)}">${esc(text)}</span>` } as PhrasingContent;
}

function parseSize(params: string[]): { width?: number; height?: number; alt?: string } {
  let width: number | undefined;
  let height: number | undefined;
  const altParts: string[] = [];
  for (const p of params) {
    const m = /^(\d+)(?:x(\d+))?$/.exec(p);
    if (m) {
      width = Number(m[1]);
      height = m[2] ? Number(m[2]) : undefined;
    } else if (p) altParts.push(p);
  }
  return { width, height, alt: altParts.length ? altParts.join('|') : undefined };
}

async function embedNode(ctx: RenderContext, l: ParsedWikilink): Promise<{ node: RootContent | PhrasingContent; block: boolean }> {
  const { index, note } = ctx;
  const ext = extOf(l.target);
  const isNoteTarget = !ext || ext === 'md';

  if (!isNoteTarget) {
    const abs = index.resolveFile(l.target, note.id);
    if (!abs) {
      ctx.unresolved.push({ source: note.relPath, target: l.target });
      return { node: unresolvedNode(l.raw, `Missing file: ${l.target}`), block: false };
    }
    // plugin-provided embed handler (e.g. excalidraw)
    const realExt = abs.endsWith('.excalidraw.md') ? 'excalidraw' : extOf(abs);
    for (const p of ctx.plugins) {
      const h = p.embeds?.[realExt];
      if (h) {
        const { width, height, alt } = parseSize(l.params);
        const html = await h({ target: l.target, absPath: abs, alias: alt, width, height });
        return { node: { type: 'html', value: html } as RootContent, block: true };
      }
    }
    if (IMAGE_EXT.has(realExt)) {
      const { width, height, alt } = parseSize(l.params);
      const props: Record<string, string> = { 'data-pw-src': abs };
      if (width) props['data-pw-width'] = String(width);
      if (height) props['data-pw-height'] = String(height);
      if (alt === undefined) props['data-pw-noalt'] = '';
      return {
        node: { type: 'image', url: abs, alt: alt ?? '', data: { hProperties: props } } as PhrasingContent,
        block: false,
      };
    }
    const url = attachmentUrl(abs, ctx.config.contentDir);
    ctx.assets[url] = abs;
    if (AUDIO_EXT.has(realExt)) {
      return { node: { type: 'html', value: `<audio class="pw-audio" controls preload="none" src="${url}"></audio>` } as RootContent, block: true };
    }
    if (VIDEO_EXT.has(realExt)) {
      return {
        node: {
          type: 'html',
          value: `<video class="pw-video" controls preload="metadata" playsinline src="${url}" width="1280" height="720"></video>`,
        } as RootContent,
        block: true,
      };
    }
    if (realExt === 'pdf') {
      const name = esc(l.alias ?? l.target.split('/').pop()!);
      return {
        node: {
          type: 'html',
          value: `<figure class="pw-pdf"><object data="${url}" type="application/pdf" width="100%" height="720" aria-label="${name}"><a href="${url}">${name}</a></object><figcaption><a href="${url}">${name}</a></figcaption></figure>`,
        } as RootContent,
        block: true,
      };
    }
    return {
      node: { type: 'html', value: `<a class="pw-file" href="${url}" download>${esc(l.alias ?? l.target.split('/').pop()!)}</a>` } as PhrasingContent,
      block: false,
    };
  }

  // note transclusion
  const target = l.target ? index.resolveNote(l.target, note.id) : note;
  if (!target || !target.published) {
    if (!target) ctx.unresolved.push({ source: note.relPath, target: l.target });
    return { node: unresolvedNode(l.raw, target ? 'Unpublished note' : `Unresolved embed: ${l.target}`), block: false };
  }
  if (ctx.stack.includes(target.id) && !l.anchor) {
    return {
      node: { type: 'html', value: `<div class="pw-embed pw-embed-cycle">↻ <a href="${href(target.url)}">${esc(target.title)}</a></div>` } as RootContent,
      block: true,
    };
  }
  if (ctx.stack.length >= 4) {
    return { node: { type: 'html', value: `<a class="internal" href="${href(target.url)}">${esc(target.title)}</a>` } as PhrasingContent, block: false };
  }
  ctx.outgoing.add(target.id);
  const inner = await ctx.renderEmbed(target, l.anchor, [...ctx.stack, ctx.note.id]);
  const link = `${href(target.url)}${anchorHash(l.anchor)}`;
  const heading = l.anchor && !l.anchor.startsWith('^') ? `${target.title} › ${l.anchor}` : target.title;
  return {
    node: {
      type: 'html',
      value: `<div class="pw-embed" data-embed="${esc(target.id)}"><div class="pw-embed-title"><a href="${link}">${esc(heading)}</a></div><div class="pw-embed-body">${inner}</div></div>`,
    } as RootContent,
    block: true,
  };
}

function linkNode(ctx: RenderContext, l: ParsedWikilink, children?: PhrasingContent[]): PhrasingContent {
  const { index, note } = ctx;
  const target = l.target ? index.resolveNote(l.target, note.id) : note;
  if (!target) {
    ctx.unresolved.push({ source: note.relPath, target: l.target + (l.anchor ? `#${l.anchor}` : '') });
    return unresolvedNode(displayText(l), `Unresolved link: ${l.target}`);
  }
  if (!target.published) {
    return { type: 'html', value: `<span class="unresolved unpublished">${esc(displayText(l))}</span>` } as PhrasingContent;
  }
  if (l.anchor && target) {
    const a = l.anchor.split('#').pop()!;
    const ok = a.startsWith('^') ? target.blockIds.has(a.slice(1)) : target.headings.some((h) => h.slug === githubSlug(a) || h.text === a);
    if (!ok) ctx.unresolved.push({ source: note.relPath, target: `${l.target || target.basename}#${l.anchor}` });
  }
  if (target.id !== note.id) ctx.outgoing.add(target.id);
  const url = target.id === note.id && l.anchor ? anchorHash(l.anchor) : `${href(target.url)}${anchorHash(l.anchor)}`;
  return {
    type: 'link',
    url,
    title: null,
    children: children ?? [{ type: 'text', value: displayText(l) }],
    data: {
      hProperties: {
        className: ['internal'],
        'data-preview': target.id !== note.id ? ctx.previewUrl(target) : undefined,
      },
    },
  } as Link;
}

/** Obsidian `[[wikilinks]]`, `![[embeds]]`, transclusion, and `[text](note.md)` links. */
export function remarkWikilinks() {
  return async (tree: Root, file: VFile) => {
    const ctx = ctxOf(file);
    const jobs: { parent: Parent; index: number; node: Text }[] = [];
    visit(tree, 'text', (node, index, parent) => {
      if (parent && index !== undefined && node.value.includes('[[')) jobs.push({ parent, index, node });
    });
    // Markdown links pointing at notes
    visit(tree, 'link', (node, index, parent) => {
      const url = node.url;
      if (!parent || index === undefined) return;
      if (/^[a-z]+:/i.test(url) || url.startsWith('#') || url.startsWith('/')) return;
      const [p, hash] = url.split('#');
      if (!p || !/\.md$/i.test(decodeURIComponentSafe(p))) return;
      const l: ParsedWikilink = {
        embed: false,
        target: decodeURIComponentSafe(p).replace(/\.md$/i, ''),
        anchor: hash ? decodeURIComponentSafe(hash) : undefined,
        params: [],
        raw: url,
      };
      parent.children.splice(index, 1, linkNode(ctx, l, node.children) as never);
      return SKIP;
    });

    for (const job of jobs.reverse()) {
      const { parent, index, node } = job;
      const value = node.value;
      const out: (PhrasingContent | RootContent)[] = [];
      let last = 0;
      for (const m of value.matchAll(WIKILINK_RE)) {
        const start = m.index!;
        if (start > last) out.push({ type: 'text', value: value.slice(last, start) });
        const l = parseWikilink(m[2]!, m[1] === '!');
        if (l.embed) {
          const r = await embedNode(ctx, l);
          out.push(r.node);
        } else out.push(linkNode(ctx, l));
        last = start + m[0].length;
      }
      if (last === 0) continue;
      if (last < value.length) out.push({ type: 'text', value: value.slice(last) });
      parent.children.splice(index, 1, ...(out as typeof parent.children));
    }

    // Lift paragraphs that contain only a block-level embed out of their <p>.
    visit(tree, 'paragraph', (node, index, parent) => {
      if (!parent || index === undefined) return;
      const meaningful = node.children.filter((c) => !(c.type === 'text' && !c.value.trim()));
      if (meaningful.length === 1 && meaningful[0]!.type === 'html' && /^<(div|figure|audio|video)\b/.test((meaningful[0] as { value: string }).value)) {
        parent.children.splice(index, 1, meaningful[0] as never);
      } else if (meaningful.some((c) => c.type === 'html' && /^<(div|figure)\b/.test((c as { value: string }).value))) {
        // split the paragraph around block embeds
        const parts: RootContent[] = [];
        let buf: PhrasingContent[] = [];
        const flush = () => {
          if (buf.some((c) => !(c.type === 'text' && !c.value.trim()))) parts.push({ type: 'paragraph', children: buf });
          buf = [];
        };
        for (const c of node.children) {
          if (c.type === 'html' && /^<(div|figure)\b/.test(c.value)) {
            flush();
            parts.push(c as RootContent);
          } else buf.push(c);
        }
        flush();
        parent.children.splice(index, 1, ...(parts as never[]));
        return index + parts.length;
      }
    });
  };
}

function decodeURIComponentSafe(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}
