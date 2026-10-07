import fs from 'node:fs';
import path from 'node:path';
import { defineCommand } from 'citty';
import pc from 'picocolors';
import { resolveTheme, listThemes, coreDir, siteThemesDir } from '../../theme/resolve.ts';
import { loadSiteConfig, findConfigFile, resolveSite } from '../site.ts';

function slots(dir: string, kind: 'components' | 'layouts'): string[] {
  const d = path.join(dir, kind);
  return fs.existsSync(d) ? fs.readdirSync(d).filter((f) => f.endsWith('.astro')).map((f) => f.replace(/\.astro$/, '')) : [];
}

/** Rewrite core-relative imports so an ejected file works from `src/overrides/`. */
export function rewriteEjected(source: string, from: 'core' | 'theme'): string {
  if (from === 'theme') return source;
  return source
    .replace(/(['"])\.\.\/src\/runtime\/index\.ts\1/g, `'@paperwhite/core/runtime'`)
    .replace(/(['"])\.\.\/islands\/([\w-]+\.ts)\1/g, `'@paperwhite/core/islands/$2'`)
    .replace(/(['"])\.\.\/components\/([\w-]+\.astro)\1/g, `'@paperwhite/core/components/$2'`);
}

/** Point `theme:` in paperwhite.config.* at `name` (adds the key if missing). Returns the file edited. */
export function setConfigTheme(root: string, name: string): string | undefined {
  const file = findConfigFile(root);
  if (!file) return undefined;
  const src = fs.readFileSync(file, 'utf8');
  const next = /theme:\s*['"][^'"]*['"]/.test(src)
    ? src.replace(/theme:\s*['"][^'"]*['"]/, `theme: '${name}'`)
    : src.replace(/defineConfig\(\{/, `defineConfig({\n  theme: '${name}',`);
  if (next !== src) fs.writeFileSync(file, next);
  return file;
}

/**
 * Copy a theme (built-in or site) into `<site>/themes/<name>/` so it can be edited.
 * The copy is a complete theme folder: theme.json, styles/, components/, layouts/.
 */
export function copyTheme(root: string, name: string, from: string, opts: { force?: boolean } = {}): string {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) throw new Error(`Theme names are lowercase letters, digits and dashes: "${name}"`);
  const src = resolveTheme(from, root);
  const dest = path.join(siteThemesDir(root), name);
  if (fs.existsSync(dest) && !opts.force) throw new Error(`${path.relative(root, dest)} exists (use --force to overwrite)`);
  if (path.resolve(src.dir) === path.resolve(dest)) throw new Error(`themes/${name} is already the active theme folder`);
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  fs.cpSync(src.dir, dest, { recursive: true, filter: (p) => !/\/(node_modules|dist|\.git)(\/|$)/.test(p) });
  const manifest = { ...src.manifest, name, version: name === from ? src.manifest.version : '0.1.0' };
  if (name !== from) manifest.description = `${name} — based on ${src.manifest.name}`;
  fs.writeFileSync(path.join(dest, 'theme.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return dest;
}

const list = defineCommand({
  meta: { name: 'list', description: 'Show available themes, the active one, and where each slot comes from' },
  args: { site: { type: 'string', description: 'Site folder' } },
  async run({ args }) {
    const root = resolveSite(args.site);
    const config = await loadSiteConfig(root);
    const active = resolveTheme(config.theme, root);
    console.log(pc.bold('themes'));
    for (const t of listThemes(root)) {
      const mark = t.dir === active.dir ? pc.green('●') : pc.dim('○');
      console.log(`  ${mark} ${t.name.padEnd(18)} ${t.source === 'site' ? pc.cyan(`themes/${t.name}/`) : pc.dim('built-in')}`);
    }
    if (active.source === 'path') console.log(`  ${pc.green('●')} ${active.manifest.name.padEnd(18)} ${pc.cyan(path.relative(root, active.dir))}`);
    console.log(`\n${pc.bold(active.manifest.name)} ${pc.dim(active.manifest.version ?? '')} · themeApi ${active.manifest.themeApi} · RTL ${active.manifest.rtl}\n`);
    const odir = path.join(root, 'src/overrides');
    for (const kind of ['components', 'layouts'] as const) {
      console.log(pc.bold(kind));
      const all = [...new Set([...slots(coreDir, kind), ...slots(active.dir, kind)])].sort();
      for (const s of all) {
        const from = fs.existsSync(path.join(odir, kind, `${s}.astro`)) ? pc.green('site') : slots(active.dir, kind).includes(s) ? pc.cyan('theme') : pc.dim('core');
        console.log(`  ${s.padEnd(18)} ${from}`);
      }
    }
  },
});

const create = defineCommand({
  meta: { name: 'new', description: 'Copy a theme into themes/<name>/ and make it the active theme' },
  args: {
    name: { type: 'positional', required: true, description: 'Folder name under themes/, e.g. ink' },
    from: { type: 'string', description: 'Theme to start from', default: 'paper' },
    force: { type: 'boolean', description: 'Overwrite an existing folder' },
    site: { type: 'string', description: 'Site folder' },
  },
  run({ args }) {
    const root = resolveSite(args.site);
    try {
      const dest = copyTheme(root, args.name, args.from, { force: args.force });
      console.log(`${pc.green('created')} ${path.relative(root, dest)}/ ${pc.dim(`(from ${args.from})`)}`);
      const file = setConfigTheme(root, args.name);
      if (file) console.log(`${pc.green('theme set')} ${args.name} in ${path.basename(file)}`);
      console.log(`\nEdit ${path.relative(root, dest)}/styles/theme.css to change tokens, or drop components into ${path.relative(root, dest)}/components/.`);
    } catch (e) {
      console.error(pc.red((e as Error).message));
      process.exitCode = 1;
    }
  },
});

const eject = defineCommand({
  meta: { name: 'eject', description: 'Copy one component or layout into src/overrides/ to customize it' },
  args: {
    name: { type: 'positional', required: true, description: 'Component name, e.g. Header or layouts/Post' },
    force: { type: 'boolean', description: 'Overwrite an existing override' },
    site: { type: 'string', description: 'Site folder' },
  },
  async run({ args }) {
    const root = resolveSite(args.site);
    const config = await loadSiteConfig(root);
    const [kind, name] = args.name.includes('/') ? (args.name.split('/') as ['components' | 'layouts', string]) : (['components', args.name] as const);
    const tdir = resolveTheme(config.theme, root).dir;
    const fromTheme = path.join(tdir, kind, `${name}.astro`);
    const fromCore = path.join(coreDir, kind, `${name}.astro`);
    const src = fs.existsSync(fromTheme) ? fromTheme : fs.existsSync(fromCore) ? fromCore : undefined;
    if (!src) {
      console.error(pc.red(`No ${kind.slice(0, -1)} named "${name}" in the theme or core. Run \`paperwhite theme list\`.`));
      process.exitCode = 1;
      return;
    }
    const dest = path.join(root, 'src/overrides', kind, `${name}.astro`);
    if (fs.existsSync(dest) && !args.force) {
      console.error(pc.red(`${path.relative(root, dest)} exists (use --force)`));
      process.exitCode = 1;
      return;
    }
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, rewriteEjected(fs.readFileSync(src, 'utf8'), src === fromTheme ? 'theme' : 'core'));
    console.log(`${pc.green('ejected')} ${path.relative(root, dest)} ${pc.dim(`(from ${src === fromTheme ? 'theme' : 'core'})`)}`);
  },
});

export const theme = defineCommand({
  meta: { name: 'theme', description: 'Manage themes: list | new | eject' },
  subCommands: { list, new: create, eject },
});
