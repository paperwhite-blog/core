import fs from 'node:fs';
import path from 'node:path';
import { resolveConfig, type ResolvedConfig } from '../config.ts';
import { CONFIG_FILES, findConfigFile, readUserConfig } from '../config/load.ts';

export { CONFIG_FILES, findConfigFile };

const SKIP = new Set(['node_modules', 'dist', '.git', '.astro', '.paperwhite']);

function findSitesBelow(dir: string, depth = 3): string[] {
  const out: string[] = [];
  const walk = (d: string, level: number) => {
    if (findConfigFile(d)) out.push(d);
    if (level >= depth) return;
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) if (e.isDirectory() && !SKIP.has(e.name) && !e.name.startsWith('.')) walk(path.join(d, e.name), level + 1);
  };
  walk(dir, 0);
  return out;
}

/**
 * Find the site to operate on, so commands work from anywhere inside a project:
 * 1. an explicit `--site <dir>` (or PAPERWHITE_SITE)
 * 2. the nearest folder (cwd or a parent) containing paperwhite.config.yaml
 * 3. a `"paperwhite": { "site": "<dir>" }` default in a parent package.json (monorepos)
 */
export function resolveSite(explicit?: string, start = process.cwd()): string {
  const chosen = explicit ?? process.env.PAPERWHITE_SITE;
  if (chosen) {
    const dir = path.resolve(start, chosen);
    if (!findConfigFile(dir)) throw new Error(`No paperwhite.config.yaml in ${dir}`);
    return dir;
  }
  let dir = path.resolve(start);
  for (;;) {
    if (findConfigFile(dir)) return dir;
    const pkg = path.join(dir, 'package.json');
    if (fs.existsSync(pkg)) {
      try {
        const site = (JSON.parse(fs.readFileSync(pkg, 'utf8')) as { paperwhite?: { site?: string } }).paperwhite?.site;
        if (site && findConfigFile(path.resolve(dir, site))) return path.resolve(dir, site);
      } catch {}
    }
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  const below = findSitesBelow(start);
  const hint = below.length
    ? `Sites found below this folder:\n${below.map((d) => `  ${path.relative(start, d)}`).join('\n')}\nRun the command inside one of them, or pass --site <dir>.`
    : 'Clone https://github.com/paperwhite-blog/core and run `paperwhite init` inside it.';
  throw new Error(`No PaperWhite site here (no paperwhite.config.yaml in this folder or its parents).\n${hint}`);
}

/** Load, validate and resolve `paperwhite.config.yaml` (plugins instantiated from `plugins/`). */
export async function loadSiteConfig(root: string): Promise<ResolvedConfig> {
  return resolveConfig(readUserConfig(root), root);
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
