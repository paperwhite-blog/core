import fs from 'node:fs/promises';
import path from 'node:path';

export interface ExternalResult {
  url: string;
  status: number | 'error';
  ok: boolean;
  checkedAt: number;
  sources: string[];
  error?: string;
}

const TTL = 7 * 86_400_000;

/** Check external links with HEAD (falling back to GET), cached on disk for a week. */
export async function checkExternalLinks(
  links: Map<string, string[]>,
  cacheDir: string,
  opts: { concurrency?: number; timeout?: number; force?: boolean } = {},
): Promise<ExternalResult[]> {
  const cacheFile = path.join(cacheDir, 'external-links.json');
  let cache: Record<string, ExternalResult> = {};
  try {
    cache = JSON.parse(await fs.readFile(cacheFile, 'utf8')) as Record<string, ExternalResult>;
  } catch {}
  const now = Date.now();
  const urls = [...links.keys()];
  const results: ExternalResult[] = [];
  let i = 0;
  const worker = async () => {
    while (i < urls.length) {
      const url = urls[i++]!;
      const hit = cache[url];
      if (hit && !opts.force && now - hit.checkedAt < TTL) {
        results.push({ ...hit, sources: links.get(url)! });
        continue;
      }
      const r = await probe(url, opts.timeout ?? 10_000);
      const res: ExternalResult = { url, ...r, checkedAt: now, sources: links.get(url)! };
      cache[url] = res;
      results.push(res);
    }
  };
  await Promise.all(Array.from({ length: opts.concurrency ?? 8 }, worker));
  await fs.mkdir(cacheDir, { recursive: true });
  await fs.writeFile(cacheFile, JSON.stringify(cache, null, 2));
  return results.sort((a, b) => a.url.localeCompare(b.url));
}

async function probe(url: string, timeout: number): Promise<{ status: number | 'error'; ok: boolean; error?: string }> {
  const attempt = async (method: 'HEAD' | 'GET') => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeout);
    try {
      const res = await fetch(url, { method, redirect: 'follow', signal: ctrl.signal, headers: { 'user-agent': 'PaperWhite link checker' } });
      return res.status;
    } finally {
      clearTimeout(t);
    }
  };
  try {
    let status = await attempt('HEAD');
    if (status === 405 || status === 403 || status === 501) status = await attempt('GET');
    return { status, ok: status < 400 };
  } catch (e) {
    return { status: 'error', ok: false, error: (e as Error).message };
  }
}

export function extractExternalLinks(html: string): string[] {
  const out = new Set<string>();
  for (const m of html.matchAll(/<a\b[^>]*\shref="(https?:\/\/[^"]+)"/g)) out.add(m[1]!.replace(/&amp;/g, '&'));
  return [...out];
}
