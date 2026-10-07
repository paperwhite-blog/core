import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { shortHash } from './text.ts';

/**
 * Registry of files PaperWhite serves under `/_pw/`: optimized images, attachments,
 * KaTeX assets, etc. Maps public URL path → absolute source file.
 * Shared through globalThis so the content loader, the dev middleware and
 * `astro:build:done` (all in one process) see the same map. Also persisted to
 * `<cacheDir>/assets.json` for out-of-process consumers.
 */
const KEY = Symbol.for('paperwhite.assets');
type Registry = Map<string, string>;

export function assetRegistry(): Registry {
  const g = globalThis as unknown as Record<symbol, Registry>;
  return (g[KEY] ??= new Map());
}

export function registerAsset(url: string, file: string): string {
  assetRegistry().set(url, file);
  return url;
}

/**
 * Register a vault file as a public attachment, keeping a readable filename. The id hashes the
 * path relative to the vault, so URLs are stable across machines and when the vault moves.
 */
export function attachmentUrl(absPath: string, vaultDir: string): string {
  const name = path.basename(absPath);
  const rel = path.relative(vaultDir, absPath).split(path.sep).join('/');
  const url = `/_pw/files/${shortHash(rel)}/${encodeURIComponent(name)}`;
  return registerAsset(url, absPath);
}

export async function persistRegistry(cacheDir: string): Promise<void> {
  await fsp.mkdir(cacheDir, { recursive: true });
  await fsp.writeFile(path.join(cacheDir, 'assets.json'), JSON.stringify(Object.fromEntries(assetRegistry()), null, 0));
}

export function loadRegistry(cacheDir: string): Registry {
  const file = path.join(cacheDir, 'assets.json');
  if (fs.existsSync(file)) {
    const data = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, string>;
    for (const [k, v] of Object.entries(data)) assetRegistry().set(k, v);
  }
  return assetRegistry();
}

/** Copy every registered asset into the build output. */
export async function copyAssets(outDir: string): Promise<number> {
  let n = 0;
  await Promise.all(
    [...assetRegistry()].map(async ([url, file]) => {
      const dest = path.join(outDir, decodeURIComponent(url));
      await fsp.mkdir(path.dirname(dest), { recursive: true });
      try {
        await fsp.copyFile(file, dest);
        n++;
      } catch {
        /* source vanished */
      }
    }),
  );
  return n;
}

const MIME: Record<string, string> = {
  avif: 'image/avif',
  webp: 'image/webp',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  pdf: 'application/pdf',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  m4a: 'audio/mp4',
  mp4: 'video/mp4',
  webm: 'video/webm',
  css: 'text/css',
  woff2: 'font/woff2',
  woff: 'font/woff',
  ttf: 'font/ttf',
  json: 'application/json',
};

export function mimeOf(file: string): string {
  return MIME[path.extname(file).slice(1).toLowerCase()] ?? 'application/octet-stream';
}
