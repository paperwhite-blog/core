import { glob } from 'astro/loaders';
import type { PaperwhiteUserConfig } from '../config.ts';
import { paperwhiteLoader } from './loader.ts';

/**
 * Content collections for a PaperWhite site. Use in `src/content.config.ts`:
 *
 * ```ts
 * import { paperwhiteCollections } from '@paperwhite/core/content';
 * export const collections = paperwhiteCollections(readUserConfig(root), root);
 * ```
 *
 * With `mdx: true`, `.mdx` files in the vault are loaded as a second collection rendered by
 * @astrojs/mdx. They bypass the Obsidian pipeline (no wikilinks, callouts, backlinks).
 */
/** `root`: the site root when it differs from the Astro project root (PaperWhite's generated Astro root). */
export function paperwhiteCollections(config: PaperwhiteUserConfig, root?: string) {
  const collections: Record<string, { type: 'content_layer'; loader: unknown }> = {
    notes: { type: 'content_layer' as const, loader: paperwhiteLoader(config, root) },
  };
  if (config.mdx) {
    collections.mdx = {
      type: 'content_layer' as const,
      loader: glob({ pattern: ['**/*.mdx', '!**/_*/**', '!**/.*/**'], base: config.contentDir ?? './content' }),
    };
  }
  return collections as { notes: { type: 'content_layer'; loader: ReturnType<typeof paperwhiteLoader> } };
}

export { paperwhiteLoader };
