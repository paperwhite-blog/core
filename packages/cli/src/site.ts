import fs from 'node:fs';
import path from 'node:path';
import { createJiti } from 'jiti';
import { resolveConfig, type PaperwhiteUserConfig, type ResolvedConfig } from '@paperwhite/core/config';

export const CONFIG_FILES = ['paperwhite.config.ts', 'paperwhite.config.mts', 'paperwhite.config.js', 'paperwhite.config.mjs'];

export function findConfigFile(root: string): string | undefined {
  for (const f of CONFIG_FILES) if (fs.existsSync(path.join(root, f))) return path.join(root, f);
  return undefined;
}

/** Load and resolve `paperwhite.config.ts` (TypeScript supported via jiti). */
export async function loadSiteConfig(root: string): Promise<ResolvedConfig> {
  const file = findConfigFile(root);
  if (!file) throw new Error(`No paperwhite.config.ts found in ${root}. Run \`paperwhite init\` first.`);
  const jiti = createJiti(import.meta.url, { interopDefault: true, moduleCache: false });
  const mod = (await jiti.import(file)) as PaperwhiteUserConfig | { default: PaperwhiteUserConfig };
  const user = 'default' in mod ? mod.default : mod;
  return resolveConfig(user, root);
}

/** Locate the site's `astro` binary. */
export function astroBin(root: string): string {
  let dir = root;
  for (;;) {
    const bin = path.join(dir, 'node_modules/.bin/astro');
    if (fs.existsSync(bin)) return bin;
    const up = path.dirname(dir);
    if (up === dir) throw new Error('astro is not installed in this project. Run your package manager install first.');
    dir = up;
  }
}
