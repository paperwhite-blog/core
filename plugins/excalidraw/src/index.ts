import fs from 'node:fs/promises';
import path from 'node:path';
import LZString from 'lz-string';
import type { PaperwhitePlugin, EmbedContext } from '@paperwhite/core/types';

export interface ExcalidrawOptions {
  /** Prefer an exported sibling `.svg` (Obsidian Excalidraw "auto-export SVG") when present. Default true */
  preferExported?: boolean;
}

interface El {
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  angle?: number;
  strokeColor?: string;
  backgroundColor?: string;
  fillStyle?: string;
  strokeWidth?: number;
  strokeStyle?: string;
  opacity?: number;
  roundness?: unknown;
  points?: [number, number][];
  text?: string;
  fontSize?: number;
  fontFamily?: number;
  textAlign?: string;
  isDeleted?: boolean;
  endArrowhead?: string | null;
  startArrowhead?: string | null;
}

/** Extract the scene JSON from `.excalidraw` (plain JSON) or `.excalidraw.md` (json / compressed-json block). */
export function parseDrawing(source: string): { elements: El[]; appState?: { viewBackgroundColor?: string } } {
  const trimmed = source.trim();
  if (trimmed.startsWith('{')) return JSON.parse(trimmed);
  const compressed = /```compressed-json\n([\s\S]*?)```/.exec(source);
  if (compressed) {
    const json = LZString.decompressFromBase64(compressed[1]!.replace(/\s+/g, ''));
    if (!json) throw new Error('could not decompress Excalidraw drawing');
    return JSON.parse(json);
  }
  const plain = /```json\n([\s\S]*?)```/.exec(source);
  if (plain) return JSON.parse(plain[1]!);
  throw new Error('no Excalidraw scene found');
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Clean (non-sketchy) SVG rendering of the common element types: rectangle, ellipse, diamond,
 * line, arrow, freedraw, text. Colors follow the drawing; strokes use currentColor-friendly values.
 */
export function renderSvg(scene: ReturnType<typeof parseDrawing>, title = 'Drawing'): string {
  const els = scene.elements.filter((e) => !e.isDeleted);
  if (!els.length) return `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(title)}" viewBox="0 0 10 10"></svg>`;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const e of els) {
    const pts = e.points?.length ? e.points.map(([px, py]) => [e.x + px, e.y + py]) : [[e.x, e.y], [e.x + e.width, e.y + e.height]];
    for (const [px, py] of pts) {
      minX = Math.min(minX, px!); minY = Math.min(minY, py!); maxX = Math.max(maxX, px!); maxY = Math.max(maxY, py!);
    }
  }
  const pad = 16;
  const w = Math.ceil(maxX - minX + pad * 2);
  const h = Math.ceil(maxY - minY + pad * 2);
  const ox = -minX + pad;
  const oy = -minY + pad;
  const parts: string[] = [];
  let markers = false;
  for (const e of els) {
    const stroke = e.strokeColor && e.strokeColor !== 'transparent' ? e.strokeColor : 'none';
    const fill = e.backgroundColor && e.backgroundColor !== 'transparent' ? e.backgroundColor : 'none';
    const sw = e.strokeWidth ?? 1;
    const dash = e.strokeStyle === 'dashed' ? ' stroke-dasharray="8 6"' : e.strokeStyle === 'dotted' ? ' stroke-dasharray="2 4"' : '';
    const op = e.opacity != null && e.opacity < 100 ? ` opacity="${e.opacity / 100}"` : '';
    const x = e.x + ox;
    const y = e.y + oy;
    const rot = e.angle ? ` transform="rotate(${(e.angle * 180) / Math.PI} ${x + e.width / 2} ${y + e.height / 2})"` : '';
    const common = `stroke="${stroke}" stroke-width="${sw}" fill="${fill}"${dash}${op}${rot}`;
    switch (e.type) {
      case 'rectangle':
        parts.push(`<rect x="${x}" y="${y}" width="${e.width}" height="${e.height}" rx="${e.roundness ? Math.min(16, e.width / 4, e.height / 4) : 0}" ${common}/>`);
        break;
      case 'ellipse':
        parts.push(`<ellipse cx="${x + e.width / 2}" cy="${y + e.height / 2}" rx="${e.width / 2}" ry="${e.height / 2}" ${common}/>`);
        break;
      case 'diamond':
        parts.push(`<polygon points="${x + e.width / 2},${y} ${x + e.width},${y + e.height / 2} ${x + e.width / 2},${y + e.height} ${x},${y + e.height / 2}" ${common}/>`);
        break;
      case 'line':
      case 'arrow':
      case 'freedraw': {
        const pts = (e.points ?? []).map(([px, py]) => `${x + px},${y + py}`).join(' ');
        const arrow = e.type === 'arrow' && e.endArrowhead !== null ? ' marker-end="url(#pw-xd-arrow)"' : '';
        const start = e.type === 'arrow' && e.startArrowhead ? ' marker-start="url(#pw-xd-arrow)"' : '';
        if (arrow || start) markers = true;
        parts.push(`<polyline points="${pts}" stroke="${stroke}" stroke-width="${sw}" fill="${e.type === 'freedraw' ? 'none' : fill}" stroke-linecap="round" stroke-linejoin="round"${dash}${op}${rot}${arrow}${start}/>`);
        break;
      }
      case 'text': {
        const size = e.fontSize ?? 20;
        const family = e.fontFamily === 3 ? 'ui-monospace, monospace' : e.fontFamily === 2 ? 'system-ui, sans-serif' : "'Virgil', 'Comic Sans MS', system-ui, sans-serif";
        const anchor = e.textAlign === 'center' ? 'middle' : e.textAlign === 'right' ? 'end' : 'start';
        const tx = anchor === 'middle' ? x + e.width / 2 : anchor === 'end' ? x + e.width : x;
        const lines = (e.text ?? '').split('\n');
        parts.push(
          `<text x="${tx}" y="${y}" font-size="${size}" font-family="${family}" fill="${stroke === 'none' ? '#1e1e1e' : stroke}" text-anchor="${anchor}" dominant-baseline="text-before-edge"${op}${rot}>${lines
            .map((l, i) => `<tspan x="${tx}" dy="${i === 0 ? 0 : size * 1.25}">${esc(l)}</tspan>`)
            .join('')}</text>`,
        );
        break;
      }
      default:
        break;
    }
  }
  const defs = markers
    ? '<defs><marker id="pw-xd-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10" fill="none" stroke="context-stroke" stroke-width="1.5"/></marker></defs>'
    : '';
  const bg = scene.appState?.viewBackgroundColor && scene.appState.viewBackgroundColor !== '#ffffff' ? `<rect width="100%" height="100%" fill="${scene.appState.viewBackgroundColor}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(title)}" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${defs}${bg}${parts.join('')}</svg>`;
}

async function exported(abs: string): Promise<string | undefined> {
  const base = abs.replace(/\.md$/, '');
  for (const c of [`${base}.svg`, `${base.replace(/\.excalidraw$/, '')}.svg`]) {
    try {
      return await fs.readFile(c, 'utf8');
    } catch {}
  }
  return undefined;
}

export default function excalidraw(opts: ExcalidrawOptions = {}): PaperwhitePlugin {
  const embed = async (ctx: EmbedContext): Promise<string> => {
    const title = ctx.alias ?? path.basename(ctx.absPath).replace(/\.excalidraw(\.md)?$/, '');
    let svg = opts.preferExported !== false ? await exported(ctx.absPath) : undefined;
    if (!svg) {
      try {
        svg = renderSvg(parseDrawing(await fs.readFile(ctx.absPath, 'utf8')), title);
      } catch (e) {
        return `<span class="unresolved" title="Excalidraw: ${esc((e as Error).message)}">${esc(title)}</span>`;
      }
    }
    svg = svg.replace(/<\?xml[^>]*>/, '').replace(/<svg\b/, `<svg role="img" aria-label="${esc(title)}"`);
    const style = ctx.width ? ` style="max-inline-size:${ctx.width}px"` : '';
    return `<figure class="pw-excalidraw"${style}>${svg}</figure>`;
  };
  return { name: '@paperwhite/plugin-excalidraw', embeds: { excalidraw: embed, 'excalidraw.md': embed } };
}
