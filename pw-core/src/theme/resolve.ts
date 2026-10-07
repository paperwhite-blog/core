import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ThemeManifest } from '../types.ts';

export interface ResolvedTheme {
  /** Absolute directory holding theme.json */
  dir: string;
  manifest: ThemeManifest;
  /** Where the theme came from */
  source: 'site' | 'core' | 'path';
}

/** `pw-core` (the directory that holds `themes/`, `components/`, `layouts/`). */
export const coreDir = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');

/** The site-local themes folder: `<site>/themes/<name>/`. */
export function siteThemesDir(root: string): string {
  return path.join(root, 'themes');
}

/** Built-in themes shipped with core: `pw-core/themes/<name>/`. */
export function coreThemesDir(): string {
  return path.join(coreDir, 'themes');
}

function themeNames(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && fs.existsSync(path.join(dir, e.name, 'theme.json')))
    .map((e) => e.name)
    .sort();
}

/** Every theme a site can select by name, with site themes shadowing built-in ones. */
export function listThemes(root: string): { name: string; dir: string; source: 'site' | 'core' }[] {
  const out: { name: string; dir: string; source: 'site' | 'core' }[] = [];
  for (const name of themeNames(siteThemesDir(root))) out.push({ name, dir: path.join(siteThemesDir(root), name), source: 'site' });
  for (const name of themeNames(coreThemesDir())) if (!out.some((t) => t.name === name)) out.push({ name, dir: path.join(coreThemesDir(), name), source: 'core' });
  return out;
}

export function readManifest(dir: string): ThemeManifest {
  const file = path.join(dir, 'theme.json');
  if (!fs.existsSync(file)) throw new Error(`PaperWhite: ${file} is missing (a theme folder must contain theme.json)`);
  const manifest = JSON.parse(fs.readFileSync(file, 'utf8')) as ThemeManifest;
  if (manifest.themeApi !== 1) throw new Error(`PaperWhite: theme "${manifest.name}" targets themeApi ${manifest.themeApi}; this core supports 1`);
  return manifest;
}

/**
 * Resolve the `theme` config value, from the site root:
 * 1. `<site>/themes/<name>/`  — a folder you added or copied in
 * 2. a built-in theme in core — `paper` by default
 * 3. a relative or absolute directory path (`./my-theme`)
 */
export function resolveTheme(theme: string, root: string): ResolvedTheme {
  if (theme.startsWith('.') || path.isAbsolute(theme)) {
    const dir = path.resolve(root, theme);
    return { dir, manifest: readManifest(dir), source: 'path' };
  }
  const site = path.join(siteThemesDir(root), theme);
  if (fs.existsSync(path.join(site, 'theme.json'))) return { dir: site, manifest: readManifest(site), source: 'site' };
  const core = path.join(coreThemesDir(), theme);
  if (fs.existsSync(path.join(core, 'theme.json'))) return { dir: core, manifest: readManifest(core), source: 'core' };
  const available = listThemes(root).map((t) => `${t.name} (${t.source})`);
  throw new Error(
    `PaperWhite: theme "${theme}" not found. Add a folder at themes/${theme}/ (with a theme.json) or pick one of: ${available.join(', ') || 'none'}.`,
  );
}

export const SLOT_KINDS = ['components', 'layouts'] as const;

/**
 * Override cascade: site `overrides/<kind>/<Name>` → theme `<kind>/<Name>` → core `<kind>/<Name>`.
 * `@pw/theme/...` skips site overrides; `@pw/core/...` resolves to core only (for wrapping).
 */
export function cascade(spec: string, dirs: { site: string; theme: string; core: string }): string | undefined {
  const m = /^@pw\/(?:(theme|core)\/)?(components|layouts)\/(.+)$/.exec(spec);
  if (!m) return undefined;
  const [, scope, kind, name] = m as unknown as [string, string | undefined, string, string];
  const bases =
    scope === 'core' ? [dirs.core] : scope === 'theme' ? [dirs.theme, dirs.core] : [path.join(dirs.site, 'overrides'), dirs.theme, dirs.core];
  const names = /\.[a-z]+$/.test(name) ? [name] : [`${name}.astro`, `${name}.ts`, name];
  for (const b of bases) for (const n of names) {
    const f = path.join(b, kind, n);
    if (fs.existsSync(f)) return f;
  }
  return undefined;
}
