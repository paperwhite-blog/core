/** Regex helpers that operate on raw Markdown source (pre-pass). */

/** Remove fenced code blocks, keeping line count (for line numbers). */
export function maskFences(md: string): string {
  const lines = md.split('\n');
  let fence: string | null = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const m = /^\s{0,3}(`{3,}|~{3,})/.exec(line);
    if (fence) {
      if (m && m[1]![0] === fence[0] && m[1]!.length >= fence.length && line.trim() === m[1]) fence = null;
      lines[i] = '';
    } else if (m) {
      fence = m[1]!;
      lines[i] = '';
    }
  }
  return lines.join('\n');
}

/** Replace inline code spans with spaces of equal length. */
export function maskInlineCode(md: string): string {
  return md.replace(/(`+)([\s\S]*?[^`])\1(?!`)/g, (m) => ' '.repeat(m.length));
}

export function maskCode(md: string): string {
  return maskInlineCode(maskFences(md));
}

/**
 * Strip Obsidian `%% comments %%` (inline and multi-line) outside of code.
 */
export function stripObsidianComments(md: string): string {
  if (!md.includes('%%')) return md;
  // Protect code by tokenizing: split on fenced blocks and inline code.
  const out: string[] = [];
  const lines = md.split('\n');
  let fence: string | null = null;
  let buffer: string[] = [];
  const flush = () => {
    if (buffer.length) {
      out.push(stripInProse(buffer.join('\n')));
      buffer = [];
    }
  };
  for (const line of lines) {
    const m = /^\s{0,3}(`{3,}|~{3,})/.exec(line);
    if (fence) {
      out.push(line);
      if (m && m[1]![0] === fence[0] && m[1]!.length >= fence.length && line.trim() === m[1]) fence = null;
    } else if (m) {
      flush();
      fence = m[1]!;
      out.push(line);
    } else buffer.push(line);
  }
  flush();
  return out.join('\n');
}

function stripInProse(text: string): string {
  const codes: string[] = [];
  const masked = text.replace(/(`+)([\s\S]*?[^`])\1(?!`)/g, (m) => {
    codes.push(m);
    return `\u0000${codes.length - 1}\u0000`;
  });
  const stripped = masked.replace(/%%[\s\S]*?(%%|$)/g, '');
  return stripped.replace(/\u0000(\d+)\u0000/g, (_, i: string) => codes[Number(i)]!);
}

export const WIKILINK_RE = /(!?)\[\[([^\[\]\n]+?)\]\]/g;

export interface ParsedWikilink {
  embed: boolean;
  target: string;
  /** heading text or `^blockid` */
  anchor?: string;
  alias?: string;
  /** remaining `|` parts (image sizes etc.) */
  params: string[];
  raw: string;
}

export function parseWikilink(raw: string, embed: boolean): ParsedWikilink {
  const inner = raw.replace(/\\\|/g, '|');
  const [left = '', ...rest] = inner.split('|');
  const hashAt = left.indexOf('#');
  const target = (hashAt >= 0 ? left.slice(0, hashAt) : left).trim();
  const anchor = hashAt >= 0 ? left.slice(hashAt + 1).trim() : undefined;
  return {
    embed,
    target,
    anchor: anchor || undefined,
    alias: rest.length ? rest.join('|').trim() || undefined : undefined,
    params: rest.map((s) => s.trim()),
    raw,
  };
}

/** Very small Markdown → plain text, for excerpts around backlinks. */
export function roughPlain(md: string): string {
  return md
    .replace(WIKILINK_RE, (_m, bang: string, inner: string) => {
      if (bang) return '';
      const p = parseWikilink(inner, false);
      return p.alias ?? (p.anchor ? `${p.target} › ${p.anchor}` : p.target);
    })
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^>\s*\[![^\]]+\][+-]?\s*/gm, '')
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, '')
    .replace(/[*_~=`]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export const IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'svg', 'bmp', 'tif', 'tiff']);
export const AUDIO_EXT = new Set(['mp3', 'wav', 'm4a', 'ogg', 'flac', '3gp', 'aac']);
export const VIDEO_EXT = new Set(['mp4', 'webm', 'ogv', 'mov', 'mkv']);

export function extOf(p: string): string {
  const base = p.split('/').pop() ?? '';
  const i = base.lastIndexOf('.');
  return i > 0 ? base.slice(i + 1).toLowerCase() : '';
}

/** FNV-1a 32-bit, hex. Stable short ids for URLs. */
export function shortHash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** Word count via Intl.Segmenter (works for Persian and CJK). */
export function countWords(text: string, locale: string): number {
  const seg = new Intl.Segmenter(locale, { granularity: 'word' });
  let n = 0;
  for (const s of seg.segment(text)) if (s.isWordLike) n++;
  return n;
}

export function truncate(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const sp = cut.lastIndexOf(' ');
  return `${(sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,.;:،؛]+$/, '')}…`;
}
