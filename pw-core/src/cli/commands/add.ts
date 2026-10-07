import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { defineCommand } from 'citty';
import pc from 'picocolors';
import { parseDocument, isSeq, isMap, YAMLSeq } from 'yaml';
import { findConfigFile, resolveSite } from '../site.ts';
import { readManifest } from '../../theme/resolve.ts';
import { downloadRepo, parseGitHubSource } from '../github.ts';
import { setConfigTheme } from './theme.ts';

export type Kind = 'theme' | 'plugin';

export interface AddManifest {
  name: string;
  kind: Kind;
  dependencies: Record<string, string>;
  description?: string;
}

const NAME = /^[a-z0-9][a-z0-9-]*$/;

/** A theme folder has theme.json; a plugin folder has plugin.json (and index.ts). */
export function detectKind(dir: string): AddManifest {
  if (fs.existsSync(path.join(dir, 'theme.json'))) {
    const m = readManifest(dir) as { name: string; description?: string; dependencies?: Record<string, string> };
    return { name: m.name, kind: 'theme', dependencies: m.dependencies ?? {}, description: m.description };
  }
  if (fs.existsSync(path.join(dir, 'plugin.json'))) {
    const m = JSON.parse(fs.readFileSync(path.join(dir, 'plugin.json'), 'utf8')) as { name?: string; pluginApi?: number; description?: string; dependencies?: Record<string, string> };
    if (m.pluginApi !== 1) throw new Error(`plugin.json: pluginApi must be 1 (got ${m.pluginApi ?? 'none'})`);
    if (typeof m.name !== 'string') throw new Error('plugin.json: "name" is required');
    if (!['index.ts', 'index.mts', 'index.js', 'index.mjs'].some((f) => fs.existsSync(path.join(dir, f)))) throw new Error('a plugin folder needs an index.ts next to plugin.json');
    return { name: m.name, kind: 'plugin', dependencies: m.dependencies ?? {}, description: m.description };
  }
  throw new Error('not a PaperWhite theme or plugin: expected a theme.json or plugin.json at the top level');
}

/** Repository housekeeping that has no business in a site's themes/ or plugins/ folder. */
const SKIP = /^\/?(\.git|node_modules|\.github|\.paperwhite|dist|test|tests|__tests__|package\.json|pnpm-lock\.yaml|package-lock\.json|yarn\.lock|bun\.lockb?|tsconfig[^/]*\.json|vitest\.config\.[cm]?[jt]s|\.npmrc|\.gitignore|\.DS_Store)(\/|$)/;

function copyDir(src: string, dest: string) {
  fs.mkdirSync(dest, { recursive: true });
  fs.cpSync(src, dest, { recursive: true, filter: (p) => !SKIP.test(p.slice(src.length)) });
}

/** Append `name` to `plugins:` in paperwhite.config.yaml (list or mapping form), keeping comments. */
export function addPluginToConfig(root: string, name: string): string | undefined {
  const file = findConfigFile(root);
  if (!file) return undefined;
  const doc = parseDocument(fs.readFileSync(file, 'utf8'));
  const current = doc.get('plugins', true);
  if (isSeq(current)) {
    const has = current.items.some((it) => (isMap(it) ? it.has(name) : String((it as { value?: unknown }).value ?? it) === name));
    if (current.items.length === 0) current.flow = false; // `plugins: []` becomes a block list
    if (!has) current.add(doc.createNode(name));
  } else if (isMap(current)) {
    if (!current.has(name)) current.set(name, null);
  } else {
    const seq = new YAMLSeq();
    seq.add(doc.createNode(name));
    doc.set('plugins', seq);
  }
  fs.writeFileSync(file, doc.toString());
  return file;
}

export function packageManager(root: string): string {
  if (fs.existsSync(path.join(root, 'pnpm-lock.yaml'))) return 'pnpm';
  if (fs.existsSync(path.join(root, 'yarn.lock'))) return 'yarn';
  if (fs.existsSync(path.join(root, 'bun.lockb')) || fs.existsSync(path.join(root, 'bun.lock'))) return 'bun';
  return 'npm';
}

export interface InstallResult {
  manifest: AddManifest;
  dest: string;
  installed: string[];
  configFile?: string;
}

/** Copy a theme or plugin folder into the site, install its dependencies, and switch it on in the config. */
export function installFromDir(root: string, src: string, opts: { name?: string; force?: boolean; install?: boolean; config?: boolean } = {}): InstallResult {
  const manifest = detectKind(src);
  const name = opts.name ?? manifest.name;
  if (!NAME.test(name)) throw new Error(`"${name}" is not a valid folder name (lowercase letters, digits, dashes). Use --name to pick one.`);
  const dest = path.join(root, manifest.kind === 'theme' ? 'themes' : 'plugins', name);
  if (fs.existsSync(dest)) {
    if (!opts.force) throw new Error(`${path.relative(root, dest)} already exists (use --force to replace it)`);
    fs.rmSync(dest, { recursive: true, force: true });
  }
  copyDir(src, dest);
  if (name !== manifest.name) {
    const file = path.join(dest, manifest.kind === 'theme' ? 'theme.json' : 'plugin.json');
    const m = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;
    fs.writeFileSync(file, `${JSON.stringify({ ...m, name }, null, 2)}\n`);
  }
  const deps = Object.entries(manifest.dependencies).map(([k, v]) => `${k}@${v}`);
  if (deps.length && opts.install !== false) {
    const pm = packageManager(root);
    const r = spawnSync(pm, [pm === 'npm' ? 'install' : 'add', ...deps], { stdio: 'inherit', cwd: root });
    if (r.status !== 0) throw new Error(`${pm} failed to install ${deps.join(' ')}`);
  }
  let configFile: string | undefined;
  if (opts.config !== false) configFile = manifest.kind === 'theme' ? setConfigTheme(root, name) : addPluginToConfig(root, name);
  return { manifest: { ...manifest, name }, dest, installed: opts.install === false ? [] : deps, configFile };
}

export const add = defineCommand({
  meta: { name: 'add', description: 'Add a theme or plugin from GitHub (owner/repo[#ref]) or a local folder into themes/ or plugins/' },
  args: {
    source: { type: 'positional', required: true, description: 'owner/repo, owner/repo#tag, a github.com URL, or a local path' },
    name: { type: 'string', description: 'Folder name to install as (default: the name in theme.json / plugin.json)' },
    force: { type: 'boolean', description: 'Replace an existing folder' },
    install: { type: 'boolean', default: true, description: 'Install the dependencies it declares (--no-install to skip)' },
    config: { type: 'boolean', default: true, description: 'Switch it on in paperwhite.config.yaml (--no-config to skip)' },
    site: { type: 'string', description: 'Site folder' },
  },
  async run({ args }) {
    const root = resolveSite(args.site);
    const gh = parseGitHubSource(args.source);
    let src: string;
    let from: string;
    if (gh) {
      process.stdout.write(pc.dim(`downloading ${gh.owner}/${gh.repo}${gh.ref ? `@${gh.ref}` : ''}… `));
      const dl = await downloadRepo(gh);
      console.log(pc.dim(dl.ref));
      src = dl.dir;
      from = `${gh.owner}/${gh.repo}@${dl.ref}`;
    } else {
      src = path.resolve(args.source);
      if (!fs.existsSync(src)) throw new Error(`${args.source} does not exist, and it is not a GitHub owner/repo`);
      from = path.relative(process.cwd(), src) || '.';
    }
    const r = installFromDir(root, src, { name: args.name, force: args.force, install: args.install, config: args.config });
    console.log(`${pc.green('added')} ${r.manifest.kind} ${pc.bold(r.manifest.name)} → ${path.relative(root, r.dest)}/ ${pc.dim(`(from ${from})`)}`);
    if (r.installed.length) console.log(`${pc.green('installed')} ${r.installed.join(' ')}`);
    if (r.configFile) console.log(`${pc.green(r.manifest.kind === 'theme' ? 'theme set' : 'plugin enabled')} in ${path.basename(r.configFile)}`);
    if (r.manifest.kind === 'theme') console.log(`\nEdit ${path.relative(root, r.dest)}/styles/theme.css to make it yours.`);
  },
});
