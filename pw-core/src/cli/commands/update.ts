import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { defineCommand } from 'citty';
import pc from 'picocolors';
import { resolveSite } from '../site.ts';
import { compareSemver, downloadRepo, extractTarGz, latestRelease, latestTag, type GitHubSource } from '../github.ts';
import { packageManager } from './add.ts';

/** The repository `update` follows. Forks can point elsewhere with PAPERWHITE_CORE_REPO=owner/repo. */
export function coreRepo(): GitHubSource {
  const [owner, repo] = (process.env.PAPERWHITE_CORE_REPO ?? 'paperwhite-blog/core').split('/');
  return { owner: owner!, repo: repo ?? 'core' };
}

/** Folders that `update` replaces. Everything else in the site is the user's. */
export const MANAGED = ['pw-core', 'pw-docs'] as const;

export function readLocalVersion(root: string): string | undefined {
  const file = path.join(root, 'pw-core/package.json');
  if (!fs.existsSync(file)) return undefined;
  return (JSON.parse(fs.readFileSync(file, 'utf8')) as { version?: string }).version;
}

export function versionOf(tag: string): string {
  return tag.replace(/^v/, '');
}

export interface RemoteCheck {
  tag: string;
  version: string;
  url?: string;
  notes?: string;
}

/** Latest core release (or tag). Throws on network errors; returns undefined when nothing is tagged yet. */
export async function latestCore(src = coreRepo()): Promise<RemoteCheck | undefined> {
  const rel = await latestRelease(src);
  if (rel) return { tag: rel.tag, version: versionOf(rel.tag), url: rel.url, notes: rel.notes };
  const tag = await latestTag(src);
  return tag ? { tag, version: versionOf(tag), url: `https://github.com/${src.owner}/${src.repo}/releases/tag/${tag}` } : undefined;
}

/**
 * A once-a-day check used by `dev` and `build` to print a one-line notice. Silent on any failure,
 * never blocks for more than a few seconds, cached in .paperwhite/update-check.json.
 */
export async function cachedUpdateNotice(root: string): Promise<string | undefined> {
  const local = readLocalVersion(root);
  if (!local || process.env.PAPERWHITE_NO_UPDATE_CHECK) return undefined;
  const cacheFile = path.join(root, '.paperwhite', 'update-check.json');
  let cached: { checkedAt: number; version?: string } | undefined;
  try {
    cached = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
  } catch {}
  if (!cached || Date.now() - cached.checkedAt > 24 * 60 * 60 * 1000) {
    try {
      const remote = await Promise.race([latestCore(), new Promise<undefined>((r) => setTimeout(() => r(undefined), 3000))]);
      cached = { checkedAt: Date.now(), version: remote?.version };
      fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
      fs.writeFileSync(cacheFile, JSON.stringify(cached));
    } catch {
      return undefined;
    }
  }
  if (cached.version && compareSemver(cached.version, local) > 0) return `PaperWhite ${cached.version} is available (you have ${local}). Run \`paperwhite update\`.`;
  return undefined;
}

/** Files changed under the managed folders, per git. Empty when clean or when git is unavailable. */
export function dirtyManaged(root: string): string[] {
  const r = spawnSync('git', ['status', '--porcelain', '--', ...MANAGED], { cwd: root, encoding: 'utf8' });
  if (r.status !== 0) return [];
  return r.stdout.split('\n').filter(Boolean).map((l) => l.slice(3).trim());
}

function replaceDirContents(src: string, dest: string, keep: Set<string>, skip: Set<string>) {
  fs.mkdirSync(dest, { recursive: true });
  for (const e of fs.readdirSync(dest)) if (!keep.has(e)) fs.rmSync(path.join(dest, e), { recursive: true, force: true });
  for (const e of fs.readdirSync(src)) {
    if (skip.has(e) || keep.has(e)) continue;
    fs.cpSync(path.join(src, e), path.join(dest, e), { recursive: true });
  }
}

export interface ApplyResult {
  from?: string;
  to?: string;
  replaced: string[];
  skippedTests: boolean;
}

/**
 * Replace pw-core/ and pw-docs/ with the copies in `source` (a checkout or extracted tarball of
 * core). pw-core/node_modules is kept. pw-core/test is only copied when the site still has one
 * (init removes it), so a slimmed-down site stays slim.
 */
export function applyUpdate(root: string, source: string): ApplyResult {
  if (!fs.existsSync(path.join(source, 'pw-core/package.json'))) throw new Error(`${source} is not a PaperWhite core checkout (no pw-core/package.json)`);
  const from = readLocalVersion(root);
  const skippedTests = !fs.existsSync(path.join(root, 'pw-core/test'));
  const replaced: string[] = [];
  for (const dir of MANAGED) {
    const s = path.join(source, dir);
    if (!fs.existsSync(s)) continue;
    const keep = new Set(dir === 'pw-core' ? ['node_modules'] : []);
    const skip = new Set(dir === 'pw-core' && skippedTests ? ['test', 'node_modules'] : ['node_modules']);
    replaceDirContents(s, path.join(root, dir), keep, skip);
    replaced.push(dir);
  }
  return { from, to: readLocalVersion(root), replaced, skippedTests };
}

export const update = defineCommand({
  meta: { name: 'update', description: 'Update pw-core/ and pw-docs/ to the latest PaperWhite release from GitHub' },
  args: {
    check: { type: 'boolean', description: 'Only report whether a newer version exists' },
    from: { type: 'string', description: 'Update from a local core checkout or .tar.gz instead of GitHub' },
    force: { type: 'boolean', description: 'Proceed even if pw-core/ or pw-docs/ have uncommitted changes' },
    install: { type: 'boolean', default: true, description: 'Run the package manager afterwards (--no-install to skip)' },
    site: { type: 'string', description: 'Site folder' },
  },
  async run({ args }) {
    const root = resolveSite(args.site);
    const local = readLocalVersion(root);
    if (!local) throw new Error(`No pw-core/package.json in ${root}: this does not look like a PaperWhite site`);
    let source: string | undefined;
    let target: RemoteCheck | undefined;
    if (args.from) {
      const p = path.resolve(args.from);
      if (!fs.existsSync(p)) throw new Error(`${args.from} does not exist`);
      if (fs.statSync(p).isDirectory()) source = p;
      else {
        source = fs.mkdtempSync(path.join(root, '.paperwhite', 'update-'));
        extractTarGz(fs.readFileSync(p), source);
      }
      target = { tag: 'local', version: readLocalVersion(source) ?? '?' };
    } else {
      const repo = coreRepo();
      process.stdout.write(pc.dim(`checking ${repo.owner}/${repo.repo}… `));
      target = await latestCore(repo);
      if (!target) {
        console.log(pc.yellow('no releases or tags yet'));
        console.log(`Core has not published a version to follow. You have ${local}.`);
        return;
      }
      console.log(target.tag);
      const cmp = compareSemver(target.version, local);
      if (cmp <= 0) {
        console.log(`${pc.green('up to date')} — PaperWhite ${local}${cmp < 0 ? ` (ahead of the latest release ${target.version})` : ''}`);
        return;
      }
      console.log(`${pc.bold(local)} → ${pc.bold(pc.green(target.version))}${target.url ? pc.dim(`  ${target.url}`) : ''}`);
      if (args.check) {
        if (target.notes) console.log(`\n${target.notes.trim().split('\n').slice(0, 20).join('\n')}`);
        return;
      }
    }
    const dirty = dirtyManaged(root);
    if (dirty.length && !args.force) {
      throw new Error(`pw-core/ or pw-docs/ have uncommitted changes (${dirty.slice(0, 5).join(', ')}${dirty.length > 5 ? ', …' : ''}).\nCommit or discard them first, or pass --force to overwrite.`);
    }
    if (!source) {
      process.stdout.write(pc.dim('downloading… '));
      source = (await downloadRepo({ ...coreRepo(), ref: target.tag })).dir;
      console.log(pc.dim('ok'));
    }
    const r = applyUpdate(root, source);
    console.log(`${pc.green('updated')} ${r.replaced.join(', ')} ${pc.dim(`${r.from} → ${r.to}`)}${r.skippedTests ? pc.dim(' (tests not copied)') : ''}`);
    if (args.install) {
      const pm = packageManager(root);
      const res = spawnSync(pm, ['install'], { stdio: 'inherit', cwd: root });
      if (res.status !== 0) console.error(pc.yellow(`${pm} install failed; run it yourself before building.`));
    }
    console.log(`\nWhat changed: pw-docs/changelog.md${target.url ? ` · ${target.url}` : ''}\nThen: paperwhite build`);
  },
});
