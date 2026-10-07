import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { Loader, LoaderContext } from 'astro/loaders';
import { resolveConfig, type PaperwhiteUserConfig, type ResolvedConfig } from '../config.ts';
import { buildVault, previewUrl, type VaultResult } from './vault.ts';
import { persistRegistry } from './assets.ts';
import type { NoteData } from '../types.ts';

const STATE = Symbol.for('paperwhite.state');

export interface PaperwhiteState {
  config: ResolvedConfig;
  result: VaultResult;
  builtAt: number;
}

/** Latest vault result, shared with the integration (same process). */
export function vaultState(): PaperwhiteState | undefined {
  return (globalThis as unknown as Record<symbol, PaperwhiteState | undefined>)[STATE];
}

function setState(s: PaperwhiteState) {
  (globalThis as unknown as Record<symbol, PaperwhiteState>)[STATE] = s;
}

async function writeReports(config: ResolvedConfig, result: VaultResult, cacheDir: string) {
  await fs.mkdir(cacheDir, { recursive: true });
  await Promise.all([
    fs.writeFile(path.join(cacheDir, 'graph.json'), JSON.stringify(result.graph)),
    fs.writeFile(
      path.join(cacheDir, 'report.json'),
      JSON.stringify(
        {
          builtAt: new Date().toISOString(),
          notes: result.notes.length,
          excluded: result.excluded,
          warnings: result.warnings,
          unresolved: result.unresolved,
          imagesMissingAlt: result.notes.flatMap((n) => n.data.imagesMissingAlt.map((i) => ({ source: n.data.path, image: i }))),
        },
        null,
        2,
      ),
    ),
    persistRegistry(cacheDir),
  ]);
  void config;
}

/**
 * Content Layer loader for an Obsidian vault. Builds the global index (wikilinks, aliases,
 * backlinks) once, then renders each note with the PaperWhite pipeline. Rendered HTML is
 * stored on the entry, so Astro's own Markdown processor is never involved.
 * Unchanged notes reuse their cached render (digest covers source + link surface).
 */
export function paperwhiteLoader(user: PaperwhiteUserConfig): Loader {
  return {
    name: 'paperwhite-vault',
    load: async (context: LoaderContext) => {
      const root = fileURLToPath(context.config.root);
      const config = resolveConfig(user, root);
      const cacheDir = path.join(root, '.paperwhite');
      const isDev = !!context.watcher;

      const sync = async (reason: string) => {
        const t0 = Date.now();
        const prof = process.env.PW_PROFILE ? (l: string) => context.logger.info(`[profile] ${l} +${Date.now() - t0}ms`) : () => {};
        const prev = new Map(context.store.entries());
        prof('entries');
        const result = await buildVault(config, {
          cacheDir,
          updateSlugHistory: !isDev,
          previous: (id) => {
            const e = prev.get(id);
            const data = e?.data as unknown as NoteData | undefined;
            if (!e?.rendered || !data?.digest) return undefined;
            return { digest: data.digest, html: e.rendered.html, data };
          },
        });
        prof('buildVault');
        const keep = new Set(result.notes.map((n) => n.id));
        for (const id of context.store.keys()) if (!keep.has(id)) context.store.delete(id);
        for (const n of result.notes) {
          context.store.set({
            id: n.id,
            data: n.data as unknown as Record<string, unknown>,
            filePath: path.relative(root, path.join(config.contentDir, n.data.path)),
            // Entry digest also covers derived cross-note data, so Astro updates the entry when backlinks change.
            digest: context.generateDigest({
              d: n.data.digest,
              b: n.data.backlinks.map((r) => r.id),
              r: n.data.related.map((r) => r.id),
              a: n.data.alternates,
              t: n.data.translations,
            }),
            rendered: {
              html: n.html,
              metadata: { headings: n.data.headings, frontmatter: {}, imagePaths: [] },
            },
          });
        }
        prof('store.set');
        setState({ config, result, builtAt: Date.now() });
        await writeReports(config, result, cacheDir);
        prof('reports');
        const ms = Date.now() - t0;
        context.logger.info(
          `${reason}: ${result.notes.length} notes (${result.rendered} rendered, ${result.reused} cached) in ${ms}ms` +
            (result.excluded.length ? `, ${result.excluded.length} excluded` : ''),
        );
        for (const w of result.warnings) context.logger.warn(w);
        for (const u of result.unresolved) context.logger.warn(`unresolved link in ${u.source}: ${u.target}`);
      };

      await sync('vault loaded');

      if (context.watcher) {
        const watcher = context.watcher;
        watcher.add(config.contentDir);
        let timer: NodeJS.Timeout | undefined;
        let running: Promise<void> | undefined;
        const schedule = (file: string) => {
          const rel = path.relative(config.contentDir, file);
          if (rel.startsWith('..') || rel.split(path.sep).some((s) => s.startsWith('.') || s.startsWith('_'))) return;
          clearTimeout(timer);
          // Obsidian writes atomically (tmp file + rename): debounce bursts.
          timer = setTimeout(() => {
            running = (running ?? Promise.resolve()).then(() => sync(`changed ${rel}`)).catch((e: Error) => context.logger.error(e.message));
          }, 150);
        };
        watcher.on('change', schedule);
        watcher.on('add', schedule);
        watcher.on('unlink', schedule);
      }
    },
  };
}

export { previewUrl };
