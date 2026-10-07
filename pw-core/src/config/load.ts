/**
 * `paperwhite.config.yaml`: the one file a site author edits. This module reads it, checks the
 * shape with clear messages, and turns plugin names into plugin instances from `plugins/<name>/`.
 * It is synchronous so the generated Astro config and the content config can call it directly.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createJiti } from 'jiti';
import { parse } from 'yaml';
import type { PaperwhiteUserConfig } from '../config.ts';
import type { PaperwhitePlugin } from '../types.ts';

export const CONFIG_FILES = ['paperwhite.config.yaml', 'paperwhite.config.yml'];

export class ConfigError extends Error {}

export function findConfigFile(root: string): string | undefined {
  for (const f of CONFIG_FILES) if (fs.existsSync(path.join(root, f))) return path.join(root, f);
  return undefined;
}

/** Plugin entries in YAML: a name, `{ name: options }`, or `{ name: "x", options: {...} }`; or a map of name → options. */
export type PluginSpec = string | Record<string, unknown> | { name: string; options?: Record<string, unknown> };

const TOP_LEVEL = new Set([
  'site', 'authors', 'contentDir', 'dirs', 'publishedOnly', 'includeFuture', 'includeDrafts', 'permalink', 'trailingSlash',
  'locales', 'theme', 'markdown', 'plugins', 'seo', 'feeds', 'pagination', 'search', 'toc', 'related', 'comments', 'editUrl',
  'graph', 'api', 'mdx', 'i18n',
]);

const SCALARS: Record<string, 'string' | 'boolean' | 'number'> = {
  contentDir: 'string', publishedOnly: 'boolean', includeFuture: 'boolean', includeDrafts: 'boolean', permalink: 'string',
  trailingSlash: 'boolean', theme: 'string', search: 'boolean', editUrl: 'string', graph: 'boolean', api: 'boolean', mdx: 'boolean',
};

function isMap(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Shape checks that catch the usual YAML mistakes with one clear line each. */
export function validateUserConfig(raw: unknown, file = 'paperwhite.config.yaml'): asserts raw is Record<string, unknown> {
  const where = path.basename(file);
  if (!isMap(raw)) throw new ConfigError(`${where}: expected a mapping at the top level (site:, contentDir:, theme:, …)`);
  const unknown = Object.keys(raw).filter((k) => !TOP_LEVEL.has(k));
  if (unknown.length) throw new ConfigError(`${where}: unknown option${unknown.length > 1 ? 's' : ''} ${unknown.map((k) => `"${k}"`).join(', ')}. Allowed: ${[...TOP_LEVEL].join(', ')}`);
  if (!isMap(raw.site)) throw new ConfigError(`${where}: "site" is required, with at least "url" and "title"`);
  if (typeof raw.site.url !== 'string' || !/^https?:\/\//.test(raw.site.url)) throw new ConfigError(`${where}: "site.url" must be the absolute production URL, e.g. https://example.com`);
  if (typeof raw.site.title !== 'string' || !raw.site.title.trim()) throw new ConfigError(`${where}: "site.title" must be a non-empty string`);
  for (const [k, t] of Object.entries(SCALARS)) if (k in raw && raw[k] !== undefined && typeof raw[k] !== t) throw new ConfigError(`${where}: "${k}" must be a ${t}`);
  if ('locales' in raw && raw.locales !== undefined) {
    if (!isMap(raw.locales)) throw new ConfigError(`${where}: "locales" must be a mapping with "default" and "supported"`);
    if ('supported' in raw.locales && !isMap(raw.locales.supported)) throw new ConfigError(`${where}: "locales.supported" must be a mapping of locale codes, e.g. { en: {}, fa: {} }`);
  }
  if ('plugins' in raw && raw.plugins !== undefined && !Array.isArray(raw.plugins) && !isMap(raw.plugins)) throw new ConfigError(`${where}: "plugins" must be a list of plugin names (or a mapping of name → options)`);
}

export function normalizePlugins(spec: unknown): { name: string; options: Record<string, unknown> }[] {
  if (!spec) return [];
  const out: { name: string; options: Record<string, unknown> }[] = [];
  const push = (name: unknown, options: unknown) => {
    if (typeof name !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(name)) throw new ConfigError(`plugins: "${String(name)}" is not a valid plugin name (lowercase letters, digits, dashes)`);
    out.push({ name, options: isMap(options) ? options : {} });
  };
  if (Array.isArray(spec)) {
    for (const item of spec) {
      if (typeof item === 'string') push(item, {});
      else if (isMap(item) && typeof item.name === 'string') push(item.name, item.options);
      else if (isMap(item) && Object.keys(item).length === 1) push(Object.keys(item)[0], Object.values(item)[0]);
      else throw new ConfigError(`plugins: each entry is a name or "{ name: options }", got ${JSON.stringify(item)}`);
    }
  } else if (isMap(spec)) for (const [k, v] of Object.entries(spec)) push(k, v);
  return out;
}

export function pluginDir(root: string, name: string): string {
  return path.join(root, 'plugins', name);
}

function pluginEntry(dir: string): string | undefined {
  for (const f of ['index.ts', 'index.mts', 'index.js', 'index.mjs']) if (fs.existsSync(path.join(dir, f))) return path.join(dir, f);
  return undefined;
}

/**
 * Load `plugins/<name>/index.ts` for each configured plugin. The module's default export is a
 * factory `(options) => PaperwhitePlugin` (or a plugin object). Dependencies resolve from the
 * plugin folder, so `paperwhite add` installing them into the site's package.json is enough.
 */
export function resolvePlugins(root: string, spec: unknown): { plugins: PaperwhitePlugin[]; sources: string[] } {
  const entries = normalizePlugins(spec);
  if (!entries.length) return { plugins: [], sources: [] };
  const jiti = createJiti(pathToFileURL(path.join(root, 'package.json')).href, { interopDefault: true, moduleCache: false });
  const plugins: PaperwhitePlugin[] = [];
  const sources: string[] = [];
  for (const { name, options } of entries) {
    const dir = pluginDir(root, name);
    const entry = pluginEntry(dir);
    if (!entry) throw new ConfigError(`plugin "${name}" not found: expected ${path.relative(root, dir)}/index.ts. Add it with \`paperwhite add <owner/repo>\` or remove it from plugins:`);
    const manifestFile = path.join(dir, 'plugin.json');
    if (fs.existsSync(manifestFile)) {
      const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8')) as { pluginApi?: number };
      if (manifest.pluginApi !== undefined && manifest.pluginApi !== 1) throw new ConfigError(`plugin "${name}" targets pluginApi ${manifest.pluginApi}; this core supports 1`);
    }
    const mod = jiti(entry) as { default?: unknown } | ((o: unknown) => PaperwhitePlugin);
    const factory = (typeof mod === 'object' && mod && 'default' in mod ? mod.default : mod) as unknown;
    const plugin = (typeof factory === 'function' ? (factory as (o: unknown) => PaperwhitePlugin)(options) : factory) as PaperwhitePlugin | undefined;
    if (!plugin || typeof plugin !== 'object' || typeof plugin.name !== 'string') throw new ConfigError(`plugin "${name}": index.ts must default-export a function (options) => plugin, returning an object with a "name"`);
    plugins.push(plugin);
    sources.push(dir);
  }
  return { plugins, sources };
}

/** Read and validate the site's YAML config, with plugins resolved. */
export function readUserConfig(root: string): PaperwhiteUserConfig {
  const file = findConfigFile(root);
  if (!file) throw new ConfigError(`No paperwhite.config.yaml in ${root}`);
  let raw: unknown;
  try {
    raw = parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    throw new ConfigError(`${path.basename(file)}: ${(e as Error).message}`);
  }
  validateUserConfig(raw, file);
  const { plugins: spec, ...rest } = raw;
  const { plugins, sources } = resolvePlugins(root, spec);
  return { ...(rest as unknown as PaperwhiteUserConfig), plugins, pluginSources: sources };
}
