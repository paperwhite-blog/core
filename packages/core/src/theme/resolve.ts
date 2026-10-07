import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import type { ThemeManifest } from '../types.ts';

export interface ResolvedTheme {
  dir: string;
  manifest: ThemeManifest;
}

/** Resolve a theme by package name (from the site root) or by directory path. */
export function resolveTheme(theme: string, root: string): ResolvedTheme {
  let dir: string | undefined;
  if (theme.startsWith('.') || path.isAbsolute(theme)) dir = path.resolve(root, theme);
  else {
    const req = createRequire(path.join(root, 'package.json'));
    try {
      dir = path.dirname(req.resolve(`${theme}/theme.json`));
    } catch {
      try {
        dir = path.dirname(req.resolve(`${theme}/package.json`));
      } catch {
        throw new Error(`PaperWhite: theme "${theme}" not found. Install it: pnpm add ${theme}`);
      }
    }
  }
  const file = path.join(dir, 'theme.json');
  if (!fs.existsSync(file)) throw new Error(`PaperWhite: ${file} is missing (themes must ship a theme.json)`);
  const manifest = JSON.parse(fs.readFileSync(file, 'utf8')) as ThemeManifest;
  if (manifest.themeApi !== 1) throw new Error(`PaperWhite: theme "${manifest.name}" targets themeApi ${manifest.themeApi}; this core supports 1`);
  return { dir, manifest };
}

export const SLOT_KINDS = ['components', 'layouts'] as const;

/**
 * Override cascade: site `src/overrides/<kind>/<Name>` → theme `<kind>/<Name>` → core `<kind>/<Name>`.
 * `@pw/theme/...` skips site overrides; `@pw/core/...` resolves to core only (for wrapping).
 */
export function cascade(spec: string, dirs: { site: string; theme: string; core: string }): string | undefined {
  const m = /^@pw\/(?:(theme|core)\/)?(components|layouts)\/(.+)$/.exec(spec);
  if (!m) return undefined;
  const [, scope, kind, name] = m as unknown as [string, string | undefined, string, string];
  const bases =
    scope === 'core' ? [dirs.core] : scope === 'theme' ? [dirs.theme, dirs.core] : [path.join(dirs.site, 'src/overrides'), dirs.theme, dirs.core];
  const names = /\.[a-z]+$/.test(name) ? [name] : [`${name}.astro`, `${name}.ts`, name];
  for (const b of bases) for (const n of names) {
    const f = path.join(b, kind, n);
    if (fs.existsSync(f)) return f;
  }
  return undefined;
}
