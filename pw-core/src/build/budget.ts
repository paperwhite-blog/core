import path from 'node:path';
import fs from 'node:fs/promises';
import fg from 'fast-glob';

export interface BudgetReport {
  pages: { page: string; js: number }[];
  maxPostJs: number;
  warnings: string[];
}

const LIMIT = 30 * 1024;

/** JS shipped per page (external + inline scripts), excluding Pagefind which loads on demand. */
export async function measurePageJs(outDir: string, rel: string, sizes: Map<string, number>): Promise<number> {
  const html = await fs.readFile(path.join(outDir, rel), 'utf8');
  let total = 0;
  const seen = new Set<string>();
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    const attrs = m[1]!;
    if (/type="application\/(ld\+)?json"/.test(attrs)) continue;
    const src = /src="([^"]+)"/.exec(attrs)?.[1];
    if (src) {
      if (src.includes('/pagefind/') || seen.has(src) || /^https?:/.test(src)) continue;
      seen.add(src);
      total += await sizeOf(outDir, src, sizes);
    } else total += Buffer.byteLength(m[2]!);
  }
  // module preloads pull in chunks too
  for (const m of html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+)"/g)) {
    if (!seen.has(m[1]!)) {
      seen.add(m[1]!);
      total += await sizeOf(outDir, m[1]!, sizes);
    }
  }
  return total;
}

async function sizeOf(outDir: string, src: string, sizes: Map<string, number>): Promise<number> {
  const cached = sizes.get(src);
  if (cached !== undefined) return cached;
  let n = 0;
  try {
    const code = await fs.readFile(path.join(outDir, decodeURI(src.split('?')[0]!)), 'utf8');
    n = Buffer.byteLength(code);
    // static imports of other chunks
    for (const m of code.matchAll(/(?:import|from)\s*["']\.\/([^"']+\.js)["']/g)) {
      n += await sizeOf(outDir, path.posix.join(path.posix.dirname(src), m[1]!), sizes);
    }
  } catch {}
  sizes.set(src, n);
  return n;
}

export async function reportBudgets(outDir: string): Promise<BudgetReport> {
  const files = await fg('**/index.html', { cwd: outDir, ignore: ['pagefind/**', '_pw/**'] });
  const sizes = new Map<string, number>();
  const pages: BudgetReport['pages'] = [];
  const warnings: string[] = [];
  let maxPostJs = 0;
  for (const rel of files) {
    const html = await fs.readFile(path.join(outDir, rel), 'utf8');
    const js = await measurePageJs(outDir, rel, sizes);
    pages.push({ page: rel, js });
    if (html.includes('data-pw-kind="note"')) maxPostJs = Math.max(maxPostJs, js);
    if (js > LIMIT) warnings.push(`JS budget exceeded on ${rel}: ${(js / 1024).toFixed(1)} KB > 30 KB`);
  }
  return { pages, maxPostJs, warnings };
}
