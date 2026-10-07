import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { defineCommand } from 'citty';
import pc from 'picocolors';
import { loadSiteConfig, findConfigFile } from '../site.ts';

function coreDir(root: string): string {
  const req = createRequire(path.join(root, 'package.json'));
  return path.dirname(req.resolve('@paperwhite/core/package.json'));
}

function themeDir(root: string, theme: string): string {
  if (theme.startsWith('.') || path.isAbsolute(theme)) return path.resolve(root, theme);
  const req = createRequire(path.join(root, 'package.json'));
  return path.dirname(req.resolve(`${theme}/theme.json`));
}

function slots(dir: string, kind: 'components' | 'layouts'): string[] {
  const d = path.join(dir, kind);
  return fs.existsSync(d) ? fs.readdirSync(d).filter((f) => f.endsWith('.astro')).map((f) => f.replace(/\.astro$/, '')) : [];
}

function packageManager(root: string): string {
  if (fs.existsSync(path.join(root, 'pnpm-lock.yaml'))) return 'pnpm';
  if (fs.existsSync(path.join(root, 'yarn.lock'))) return 'yarn';
  if (fs.existsSync(path.join(root, 'bun.lockb')) || fs.existsSync(path.join(root, 'bun.lock'))) return 'bun';
  return 'npm';
}

/** Rewrite core-relative imports so an ejected file works from `src/overrides/`. */
export function rewriteEjected(source: string, from: 'core' | 'theme'): string {
  if (from === 'theme') return source;
  return source
    .replace(/(['"])\.\.\/src\/runtime\/index\.ts\1/g, `'@paperwhite/core/runtime'`)
    .replace(/(['"])\.\.\/islands\/([\w-]+\.ts)\1/g, `'@paperwhite/core/islands/$2'`)
    .replace(/(['"])\.\.\/components\/([\w-]+\.astro)\1/g, `'@paperwhite/core/components/$2'`);
}

const add = defineCommand({
  meta: { name: 'add', description: 'Install a theme package and select it' },
  args: { pkg: { type: 'positional', required: true, description: 'Theme package, e.g. paperwhite-theme-paper' } },
  run({ args }) {
    const root = process.cwd();
    const pm = packageManager(root);
    const r = spawnSync(pm, [pm === 'npm' ? 'install' : 'add', args.pkg], { stdio: 'inherit', cwd: root });
    if (r.status !== 0) {
      process.exitCode = r.status ?? 1;
      return;
    }
    const file = findConfigFile(root);
    if (file) {
      const src = fs.readFileSync(file, 'utf8');
      const name = args.pkg.replace(/@[^/@]+$/, '');
      const next = /theme:\s*['"][^'"]*['"]/.test(src)
        ? src.replace(/theme:\s*['"][^'"]*['"]/, `theme: '${name}'`)
        : src.replace(/defineConfig\(\{/, `defineConfig({\n  theme: '${name}',`);
      fs.writeFileSync(file, next);
      console.log(`${pc.green('theme set')} ${name} in ${path.basename(file)}`);
    }
  },
});

const list = defineCommand({
  meta: { name: 'list', description: 'Show the active theme, its slots and your overrides' },
  async run() {
    const root = process.cwd();
    const config = await loadSiteConfig(root);
    const tdir = themeDir(root, config.theme);
    const manifest = JSON.parse(fs.readFileSync(path.join(tdir, 'theme.json'), 'utf8')) as { name: string; version?: string; rtl: string; themeApi: number };
    const cdir = coreDir(root);
    const odir = path.join(root, 'src/overrides');
    console.log(`${pc.bold(manifest.name)} ${pc.dim(manifest.version ?? '')} · themeApi ${manifest.themeApi} · RTL ${manifest.rtl}\n`);
    for (const kind of ['components', 'layouts'] as const) {
      console.log(pc.bold(kind));
      const all = [...new Set([...slots(cdir, kind), ...slots(tdir, kind)])].sort();
      for (const s of all) {
        const from = fs.existsSync(path.join(odir, kind, `${s}.astro`)) ? pc.green('site') : slots(tdir, kind).includes(s) ? pc.cyan('theme') : pc.dim('core');
        console.log(`  ${s.padEnd(18)} ${from}`);
      }
    }
  },
});

const eject = defineCommand({
  meta: { name: 'eject', description: 'Copy a component or layout into src/overrides/ to customize it' },
  args: {
    name: { type: 'positional', required: true, description: 'Component name, e.g. Header or layouts/Post' },
    force: { type: 'boolean', description: 'Overwrite an existing override' },
  },
  async run({ args }) {
    const root = process.cwd();
    const config = await loadSiteConfig(root);
    const [kind, name] = args.name.includes('/') ? (args.name.split('/') as ['components' | 'layouts', string]) : (['components', args.name] as const);
    const tdir = themeDir(root, config.theme);
    const cdir = coreDir(root);
    const fromTheme = path.join(tdir, kind, `${name}.astro`);
    const fromCore = path.join(cdir, kind, `${name}.astro`);
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
  meta: { name: 'theme', description: 'Manage themes: add | list | eject' },
  subCommands: { add, list, eject },
});
