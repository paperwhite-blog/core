import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import sharp from 'sharp';
import type { ImageInfo } from '../types.ts';
import { registerAsset } from './assets.ts';
import { extOf } from './text.ts';

export interface ImageOptions {
  cacheDir: string;
  widths?: number[];
  formats?: ('avif' | 'webp')[];
}

const DEFAULT_WIDTHS = [480, 800, 1200, 1600];
const memo = new Map<string, Promise<ImageInfo>>();

async function fileHash(file: string): Promise<string> {
  const buf = await fs.readFile(file);
  return createHash('sha1').update(buf).digest('hex').slice(0, 12);
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Optimize a local image: resized variants in AVIF/WebP plus the original format,
 * cached by content hash in `<cacheDir>/img`. Returns dimensions and srcsets so the
 * HTML can carry width/height (no CLS).
 */
export function processImage(absPath: string, opts: ImageOptions): Promise<ImageInfo> {
  const key = `${absPath}|${opts.formats?.join(',')}|${opts.widths?.join(',')}`;
  let p = memo.get(key);
  if (!p) {
    p = doProcess(absPath, opts);
    memo.set(key, p);
    p.catch(() => memo.delete(key));
  }
  return p;
}

async function doProcess(absPath: string, opts: ImageOptions): Promise<ImageInfo> {
  const ext = extOf(absPath);
  const hash = await fileHash(absPath);
  const base = path.basename(absPath, path.extname(absPath)).replace(/[^\p{L}\p{N}_-]+/gu, '-').slice(0, 40) || 'image';
  const outDir = path.join(opts.cacheDir, 'img');
  await fs.mkdir(outDir, { recursive: true });

  // Vector and animated images are served untouched.
  if (ext === 'svg' || ext === 'gif') {
    let width = 0;
    let height = 0;
    try {
      const meta = await sharp(absPath, { animated: ext === 'gif' }).metadata();
      width = meta.width ?? 0;
      height = (ext === 'gif' ? meta.pageHeight : meta.height) ?? 0;
    } catch {}
    const url = registerAsset(`/_pw/img/${base}-${hash}.${ext}`, absPath);
    return { src: url, width, height, sources: [], srcset: '', assets: { [url]: absPath } };
  }

  const img = sharp(absPath, { failOn: 'none' }).rotate();
  const meta = await img.metadata();
  const oriented = (meta.orientation ?? 1) >= 5;
  const origW = (oriented ? meta.height : meta.width) ?? 0;
  const origH = (oriented ? meta.width : meta.height) ?? 0;
  const fallbackFmt = ext === 'png' ? 'png' : 'jpeg';
  const fallbackExt = fallbackFmt === 'png' ? 'png' : 'jpg';
  const widths = [...new Set((opts.widths ?? DEFAULT_WIDTHS).filter((w) => w < origW).concat(Math.min(origW, 2400)))].sort(
    (a, b) => a - b,
  );
  const formats = opts.formats ?? ['avif', 'webp'];

  const assets: Record<string, string> = {};
  const make = async (w: number, fmt: 'avif' | 'webp' | 'png' | 'jpeg', fileExt: string) => {
    const name = `${base}-${hash}-${w}.${fileExt}`;
    const out = path.join(outDir, name);
    if (!(await exists(out))) {
      let pipe = sharp(absPath, { failOn: 'none' }).rotate().resize({ width: w, withoutEnlargement: true });
      if (fmt === 'avif') pipe = pipe.avif({ quality: 55, effort: 2 });
      else if (fmt === 'webp') pipe = pipe.webp({ quality: 78, effort: 4 });
      else if (fmt === 'png') pipe = pipe.png({ compressionLevel: 9, palette: true });
      else pipe = pipe.jpeg({ quality: 80, mozjpeg: true });
      // unique temp name: the same variant may be requested concurrently (cover + inline embed)
      const tmp = `${out}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
      await pipe.toFile(tmp);
      await fs.rename(tmp, out);
    }
    const url = registerAsset(`/_pw/img/${name}`, out);
    assets[url] = out;
    return `${url} ${w}w`;
  };

  const sources: ImageInfo['sources'] = [];
  for (const fmt of formats) {
    const set = await Promise.all(widths.map((w) => make(w, fmt, fmt)));
    sources.push({ type: `image/${fmt}`, srcset: set.join(', ') });
  }
  const fallback = await Promise.all(widths.map((w) => make(w, fallbackFmt, fallbackExt)));
  const largestFallback = fallback[fallback.length - 1]!.split(' ')[0]!;
  // `src` points at a mid-size fallback; `srcset` covers all widths.
  const mid = fallback[Math.min(fallback.length - 1, 1)]!.split(' ')[0]!;
  return {
    src: mid || largestFallback,
    width: origW,
    height: origH,
    sources,
    srcset: fallback.join(', '),
    assets,
  };
}

/** Largest fallback URL in a srcset (used as the lightbox/full-size target). */
export function largestFromSrcset(srcset: string, fallback: string): string {
  const parts = srcset.split(',').map((s) => s.trim().split(' ')[0]).filter(Boolean);
  return parts[parts.length - 1] ?? fallback;
}
