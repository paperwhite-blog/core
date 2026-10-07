import path from 'node:path';
import * as pagefind from 'pagefind';
import type { ResolvedConfig } from '../config.ts';

/**
 * Build the Pagefind index from the HTML output. Arabic-script text is normalized
 * (ي→ی, ك→ک) before indexing so Persian queries match regardless of keyboard layout;
 * the search island applies the same normalization to queries.
 */
export async function runPagefind(outDir: string, config: ResolvedConfig): Promise<{ pages: number; languages: string[] }> {
  const { index, errors } = await pagefind.createIndex({});
  if (!index) throw new Error(`pagefind: ${errors.join(', ')}`);
  // Persian text is already normalized in the HTML by the typography helpers, so the
  // native directory indexer (much faster than per-file IPC) can be used directly.
  const r = await index.addDirectory({ path: outDir, glob: '**/*.html' });
  if (r.errors.length) throw new Error(`pagefind: ${r.errors.join(', ')}`);
  await index.writeFiles({ outputPath: path.join(outDir, 'pagefind') });
  await pagefind.close();
  const languages = Object.entries(config.locales.supported).map(([code]) => code);
  return { pages: r.page_count, languages };
}
