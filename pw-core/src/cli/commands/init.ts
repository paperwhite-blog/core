import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { defineCommand } from 'citty';
import pc from 'picocolors';
import { parseDocument, YAMLMap } from 'yaml';
import { coreDir } from '../../theme/resolve.ts';
import { findConfigFile } from '../../config/load.ts';

export const DEPLOY_TARGETS = ['github-pages', 'cloudflare', 'netlify', 'vercel', 'none'] as const;
export type DeployTarget = (typeof DEPLOY_TARGETS)[number];

export interface InitAnswers {
  title: string;
  description: string;
  url: string;
  author?: string;
  locales: string[];
  deploy: DeployTarget;
  removeSamples: boolean;
  freshHistory: boolean;
}

export interface InitOptions {
  /** Touch git (remove origin / fresh history). Off in tests. */
  git?: boolean;
  /** Run the package manager to prune the lockfile afterwards. Off in tests. */
  install?: boolean;
  log?: (line: string) => void;
}

/** Everything a blog does not need from the core repository. */
export const DEV_PATHS = ['dev', 'pw-core/test', '.github/workflows/ci.yml', 'CONTRIBUTING.md', '.lighthouseci', 'test-results', 'playwright-report'];
export const DEV_SCRIPTS = ['test', 'test:watch', 'typecheck', 'fixture:build', 'fixture:dev', 'e2e', 'lhci', 'bench', 'check:audit', 'link-cli', 'unlink-cli'];

export function writeConfig(root: string, a: InitAnswers): string {
  const file = findConfigFile(root) ?? path.join(root, 'paperwhite.config.yaml');
  const doc = fs.existsSync(file) ? parseDocument(fs.readFileSync(file, 'utf8')) : parseDocument('site: {}\n');
  if (!doc.has('site')) doc.set('site', new YAMLMap());
  doc.setIn(['site', 'url'], a.url.replace(/\/+$/, ''));
  doc.setIn(['site', 'title'], a.title);
  doc.setIn(['site', 'description'], a.description);
  if (a.author) doc.setIn(['site', 'author'], a.author);
  const supported = new YAMLMap();
  for (const l of a.locales) supported.set(l, new YAMLMap());
  doc.setIn(['locales', 'default'], a.locales[0]);
  doc.setIn(['locales', 'supported'], supported);
  fs.writeFileSync(file, doc.toString());
  return file;
}

export function stripDevFiles(root: string): string[] {
  const removed: string[] = [];
  for (const rel of DEV_PATHS) {
    const p = path.join(root, rel);
    if (fs.existsSync(p)) {
      fs.rmSync(p, { recursive: true, force: true });
      removed.push(rel);
    }
  }
  const pkgFile = path.join(root, 'package.json');
  if (fs.existsSync(pkgFile)) {
    const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8')) as { scripts?: Record<string, string>; devDependencies?: unknown; description?: string };
    for (const s of DEV_SCRIPTS) delete pkg.scripts?.[s];
    delete pkg.devDependencies;
    fs.writeFileSync(pkgFile, `${JSON.stringify(pkg, null, 2)}\n`);
  }
  const ws = path.join(root, 'pnpm-workspace.yaml');
  if (fs.existsSync(ws)) {
    const doc = parseDocument(fs.readFileSync(ws, 'utf8'));
    doc.set('packages', ['pw-core']);
    fs.writeFileSync(ws, doc.toString());
  }
  return removed;
}

export function replaceSamples(root: string, a: InitAnswers): string[] {
  const content = path.join(root, 'content');
  for (const d of ['posts', 'pages']) fs.rmSync(path.join(content, d), { recursive: true, force: true });
  fs.rmSync(path.join(content, 'attachments/cat.jpg'), { force: true });
  fs.rmSync(path.join(root, 'paperwhite.slugs.json'), { force: true });
  fs.mkdirSync(path.join(content, 'posts'), { recursive: true });
  fs.mkdirSync(path.join(content, 'pages'), { recursive: true });
  fs.mkdirSync(path.join(content, 'attachments'), { recursive: true });
  const today = new Date().toISOString().slice(0, 10);
  const written = ['content/posts/hello-world.md', 'content/pages/about.md'];
  fs.writeFileSync(
    path.join(content, 'posts/hello-world.md'),
    `---\ntitle: Hello, world\ndescription: The first post on ${a.title}.\ndate: ${today}\ntags: [meta]\n---\n\nThis blog is a folder of Markdown. Link notes with [[About|wikilinks]], add callouts:\n\n> [!tip] Obsidian syntax works\n> Embeds, ==highlights==, footnotes[^1] and more.\n\n[^1]: Rendered at build time, zero JavaScript.\n`,
  );
  fs.writeFileSync(path.join(content, 'pages/about.md'), `---\ntitle: About\ndescription: About ${a.title}.\n---\n\nWrite something about yourself.\n`);
  if (a.locales.includes('fa')) {
    fs.mkdirSync(path.join(content, 'posts/fa'), { recursive: true });
    fs.writeFileSync(path.join(content, 'posts/fa/سلام.md'), `---\ntitle: سلام دنیا\ndescription: نخستین نوشته.\ndate: ${today}\nlang: fa\n---\n\nاین نخستین نوشتهٔ فارسی است.\n`);
    written.push('content/posts/fa/سلام.md');
  }
  return written;
}

export function writeDeployWorkflow(root: string, target: DeployTarget): string | undefined {
  if (target === 'none') return undefined;
  const src = path.join(coreDir, 'templates/deploy', `${target}.yml`);
  const dest = path.join(root, '.github/workflows/deploy.yml');
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  return dest;
}

export function writeReadme(root: string, a: InitAnswers): string {
  const tpl = fs.readFileSync(path.join(coreDir, 'templates/README.md'), 'utf8');
  const dest = path.join(root, 'README.md');
  fs.writeFileSync(dest, tpl.replace(/\{\{title\}\}/g, a.title));
  return dest;
}

function git(root: string, args: string[]): { ok: boolean; out: string } {
  const r = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  return { ok: r.status === 0, out: `${r.stdout ?? ''}${r.stderr ?? ''}`.trim() };
}

export function resetGit(root: string, fresh: boolean, log: (l: string) => void): void {
  if (!fs.existsSync(path.join(root, '.git'))) return;
  if (fresh) {
    fs.rmSync(path.join(root, '.git'), { recursive: true, force: true });
    if (!git(root, ['init', '-q', '-b', 'main']).ok) return log(pc.yellow('git init failed; initialise the repository yourself'));
    git(root, ['add', '-A']);
    const c = git(root, ['commit', '-q', '-m', 'Initial commit: PaperWhite blog']);
    log(c.ok ? 'git: fresh history with one commit' : pc.yellow(`git: repository initialised; commit yourself (${c.out.split('\n')[0]})`));
  } else {
    const origin = git(root, ['remote', 'get-url', 'origin']);
    if (origin.ok && /paperwhite-blog\/core/.test(origin.out)) {
      git(root, ['remote', 'remove', 'origin']);
      log('git: removed the `origin` remote that pointed at PaperWhite core');
    }
  }
}

export function initSite(root: string, a: InitAnswers, opts: InitOptions = {}): { config: string; removed: string[]; samples: string[]; workflow?: string } {
  const log = opts.log ?? (() => {});
  const config = writeConfig(root, a);
  log(`${pc.green('wrote')} ${path.relative(root, config)}`);
  const removed = stripDevFiles(root);
  if (removed.length) log(`${pc.green('removed')} ${removed.join(', ')} ${pc.dim('(core development files)')}`);
  const samples = a.removeSamples ? replaceSamples(root, a) : [];
  if (samples.length) log(`${pc.green('replaced samples with')} ${samples.join(', ')}`);
  const workflow = writeDeployWorkflow(root, a.deploy);
  if (workflow) log(`${pc.green('wrote')} ${path.relative(root, workflow)} ${pc.dim(`(${a.deploy})`)}`);
  log(`${pc.green('wrote')} README.md`);
  writeReadme(root, a);
  if (opts.install !== false) {
    const r = spawnSync('pnpm', ['install'], { cwd: root, stdio: 'ignore' });
    log(r.status === 0 ? `${pc.green('pruned')} lockfile` : pc.yellow('pnpm install failed; run it before building'));
  }
  if (opts.git !== false) resetGit(root, a.freshHistory, log);
  return { config, removed, samples, workflow };
}

const DEPLOY_NOTES: Record<DeployTarget, string> = {
  'github-pages': 'GitHub → Settings → Pages → Source: GitHub Actions. Use a custom domain (public/CNAME) or a <user>.github.io repo.',
  cloudflare: 'Connect the repo in Cloudflare Pages (build `pnpm build --strict`, output `dist`) and add the DEPLOY_HOOK_URL secret.',
  netlify: 'Connect the repo in Netlify (build `pnpm build --strict`, publish `dist`) and add the DEPLOY_HOOK_URL secret.',
  vercel: 'Import the repo in Vercel (build `pnpm build --strict`, output `dist`) and add the DEPLOY_HOOK_URL secret.',
  none: '',
};

export const init = defineCommand({
  meta: { name: 'init', description: 'Turn this clone of PaperWhite into your blog: config, deploy workflow, no dev files' },
  args: {
    title: { type: 'string', description: 'Site title' },
    description: { type: 'string', description: 'Site description' },
    url: { type: 'string', description: 'Production URL, e.g. https://blog.example.com' },
    author: { type: 'string', description: 'Author name' },
    locale: { type: 'string', description: 'Comma-separated locales, first is default (default: en)' },
    deploy: { type: 'string', description: `Deploy target: ${DEPLOY_TARGETS.join(' | ')}` },
    'keep-samples': { type: 'boolean', description: 'Keep the sample posts and pages' },
    'keep-history': { type: 'boolean', description: 'Keep the git history of PaperWhite core (only the origin remote is removed)' },
    yes: { type: 'boolean', description: 'Non-interactive: use the flags given and defaults for the rest' },
    site: { type: 'string', description: 'Site folder (default: current folder)' },
  },
  async run({ args }) {
    const root = path.resolve(args.site ?? '.');
    if (!fs.existsSync(path.join(root, 'pw-core/package.json'))) throw new Error(`${root} is not a clone of PaperWhite (no pw-core/). Clone https://github.com/paperwhite-blog/core first.`);
    if (!args.yes && !process.stdin.isTTY) throw new Error('No terminal to ask questions in. Pass --yes together with --title, --url, --deploy … to run init non-interactively.');
    const rl = args.yes ? undefined : createInterface({ input: process.stdin, output: process.stdout });
    const ask = async (label: string, def: string | undefined, given?: string): Promise<string> => {
      if (given !== undefined) return given;
      if (!rl) return def ?? '';
      const v = (await rl.question(`${label}${def ? pc.dim(` (${def})`) : ''}: `)).trim();
      return v || def || '';
    };
    const confirm = async (label: string, def: boolean, given?: boolean): Promise<boolean> => {
      if (given !== undefined) return given;
      if (!rl) return def;
      const v = (await rl.question(`${label} ${pc.dim(def ? '[Y/n]' : '[y/N]')}: `)).trim().toLowerCase();
      return v ? v.startsWith('y') : def;
    };
    try {
      console.log(pc.bold('PaperWhite init') + pc.dim(' — answer a few questions; Enter keeps the default.\n'));
      const title = await ask('Site title', 'My Blog', args.title);
      const description = await ask('Description', 'Notes from my Obsidian vault.', args.description);
      const url = await ask('Production URL', 'https://example.com', args.url);
      const author = (await ask('Your name (blank to skip)', undefined, args.author)) || undefined;
      const locales = (await ask('Locales, comma-separated (first is default)', 'en', args.locale)).split(',').map((s) => s.trim()).filter(Boolean);
      let deploy = (await ask(`Deploy target (${DEPLOY_TARGETS.join(' | ')})`, 'github-pages', args.deploy)) as DeployTarget;
      if (!DEPLOY_TARGETS.includes(deploy)) throw new Error(`Unknown deploy target "${deploy}". Choose one of: ${DEPLOY_TARGETS.join(', ')}`);
      const removeSamples = await confirm('Remove the sample posts and pages?', true, args['keep-samples'] ? false : undefined);
      const freshHistory = await confirm('Start a fresh git history (recommended)?', true, args['keep-history'] ? false : undefined);
      if (rl) {
        console.log(`\nThis will edit paperwhite.config.yaml, delete ${DEV_PATHS.filter((p) => fs.existsSync(path.join(root, p))).join(', ')}${removeSamples ? ', replace the sample content' : ''}${freshHistory ? ', and reset git history' : ''}.`);
        if (!(await confirm('Continue?', true))) return;
      }
      console.log('');
      const r = initSite(root, { title, description, url, author, locales: locales.length ? locales : ['en'], deploy, removeSamples, freshHistory }, { log: console.log });
      console.log(`\n${pc.bold('Done.')} Next:\n  pnpm dev                      ${pc.dim('write at http://localhost:4321')}\n  git remote add origin <your repo> && git push -u origin main`);
      if (deploy !== 'none') console.log(`  ${DEPLOY_NOTES[deploy]}`);
      void r;
    } finally {
      rl?.close();
    }
  },
});
